#!/usr/bin/env node
/*
 * FirmAlways Personal hook: checks what you send to AI coding agents (Codex, the Work tab
 * of ChatGPT Desktop, Claude Code) on your own machine, before it leaves.
 *
 *   firmalways init [codex|claude|all]   add the hook (like `rtk init`)
 *   firmalways hook codex|claude         called by the agent, reads hook JSON on stdin
 *
 * Runs locally, sends nothing anywhere, stores counts only (never text) in its report.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const Engine = require(path.join(ROOT, "src/core/engine.js"));
const Vault = require(path.join(ROOT, "src/core/vault.js"));
const Policy = require(path.join(ROOT, "src/core/policy.js"));
const I18n = require(path.join(ROOT, "src/i18n.js"));

const VERSION = "0.2.0";
const HOME = process.env.FIRMALWAYS_HOME || path.join(os.homedir(), ".firmalways");
const FILES = {
  settings: path.join(HOME, "settings.json"),
  vault: path.join(HOME, "vault.json"),
  stats: path.join(HOME, "stats.json"),
  allow: path.join(HOME, "allow-next.json"),
};
const MAX_TEXT = 200000;
const VAULT_TTL_MS = 24 * 3600 * 1000;
const ALLOW_TTL_MS = 10 * 60 * 1000;

// ---- storage ---------------------------------------------------------------------------------
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function loadSettings() {
  const s = Policy.withDefaults(readJson(FILES.settings, {}));
  const user = readJson(FILES.settings, {});
  s.clipboard = user.clipboard !== false; // copy the safe version to the clipboard
  s.restoreTools = user.restoreTools || "files"; // "files" | "all" | "off"
  s.failClosed = user.failClosed !== false;
  return s;
}

function lang(settings) {
  if (settings.lang === "th" || settings.lang === "en") return settings.lang;
  const envs = [process.env.FIRMALWAYS_LANG, process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANG];
  let intl = "";
  try {
    intl = Intl.DateTimeFormat().resolvedOptions().locale || "";
  } catch (_) {}
  for (const v of [...envs, intl]) if (v && /^th/i.test(v)) return "th";
  for (const v of envs) if (v && /^en/i.test(v)) return "en";
  return "th";
}

function loadVault() {
  const v = readJson(FILES.vault, null);
  if (!v || !v.byToken || Date.now() - (v.updatedAt || 0) > VAULT_TTL_MS) return Object.assign(Vault.createVault(), { updatedAt: Date.now() });
  return v;
}
function saveVault(v) {
  v.updatedAt = Date.now();
  writeJson(FILES.vault, v);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Content-free counters: how many prompts were checked, masked, blocked, and which data types. */
function record(agent, outcome, counts) {
  try {
    const stats = readJson(FILES.stats, { days: {} });
    const day = (stats.days[today()] = stats.days[today()] || { checked: 0, masked: 0, blocked: 0, warned: 0, allowed: 0, restored: 0, items: 0, byType: {}, byAgent: {} });
    if (outcome !== "restored") day.checked += 1;
    if (outcome in day) day[outcome] += 1;
    day.byAgent[agent] = (day.byAgent[agent] || 0) + 1;
    for (const [t, n] of Object.entries(counts || {})) {
      day.items += n;
      day.byType[t] = (day.byType[t] || 0) + n;
    }
    const keep = Math.max(1, Number(loadSettings().retentionDays) || 30);
    const cutoff = new Date(Date.now() - keep * 86400000).toISOString().slice(0, 10);
    for (const k of Object.keys(stats.days)) if (k < cutoff) delete stats.days[k];
    writeJson(FILES.stats, stats);
  } catch (_) {
    // the report is optional; never fail a hook because of it
  }
}

const sha = (text) => crypto.createHash("sha256").update(String(text).trim()).digest("hex");

function takeAllowance(prompt) {
  const a = readJson(FILES.allow, null);
  if (!a || Date.now() - a.at > ALLOW_TTL_MS) return false;
  if (a.hash && a.hash !== sha(prompt)) return false;
  fs.rmSync(FILES.allow, { force: true });
  return true;
}

// ---- clipboard -------------------------------------------------------------------------------
function clipboardCommands() {
  if (process.platform === "darwin") return { copy: ["pbcopy", []], paste: ["pbpaste", []] };
  if (process.platform === "win32") return { copy: ["clip", []], paste: ["powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"]] };
  if (process.env.WAYLAND_DISPLAY) return { copy: ["wl-copy", []], paste: ["wl-paste", ["-n"]] };
  return { copy: ["xclip", ["-selection", "clipboard"]], paste: ["xclip", ["-selection", "clipboard", "-o"]] };
}
// pbcopy turns Thai into "?" when a locale variable is set the way agents set it for hooks;
// without LANG/LC_* it reads UTF-8. Other platforms keep the environment as is.
const CLIP_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => process.platform !== "darwin" || !/^(LANG|LC_)/.test(k)));
function copyToClipboard(text) {
  try {
    const [cmd, args] = clipboardCommands().copy;
    execFileSync(cmd, args, { input: text, stdio: ["pipe", "ignore", "ignore"], timeout: 3000, env: CLIP_ENV });
    return true;
  } catch (_) {
    return false;
  }
}
function readClipboard() {
  const [cmd, args] = clipboardCommands().paste;
  return execFileSync(cmd, args, { encoding: "utf8", timeout: 3000, env: CLIP_ENV });
}

// ---- core ------------------------------------------------------------------------------------
/** Check text and build the safe version. Blocked items become «REMOVED_TYPE». */
function analyzeText(text, settings, vault) {
  const compiled = Policy.compile(settings);
  if (text.length > MAX_TEXT) return { verdict: "toolong", entities: [], counts: {}, safe: "" };
  const decision = Policy.decide(text, compiled);
  if (decision.verdict === "pass") return Object.assign(decision, { safe: text });
  let out = "";
  let pos = 0;
  for (const e of decision.entities.slice().sort((a, b) => a.start - b.start)) {
    if (e.start < pos || e.action === "warn") continue;
    const value = text.slice(e.start, e.end);
    let token;
    if (e.action === "block") token = `«REMOVED_${e.type}»`;
    else if (e.action === "redact") token = `«REDACTED_${e.type}»`;
    else token = Vault.placeholderFor(vault, e.type, value);
    out += text.slice(pos, e.start) + token;
    pos = e.end;
  }
  return Object.assign(decision, { safe: out + text.slice(pos) });
}

function countsOf(entities, actions) {
  const c = {};
  for (const e of entities) if (!actions || actions.includes(e.action)) c[e.type] = (c[e.type] || 0) + 1;
  return c;
}

const T = {
  maskedTitle: ["FirmAlways ยังไม่ได้ส่งข้อความนี้ เพราะพบ {types}", "FirmAlways did not send this prompt. It contains {types}."],
  blockedTitle: ["FirmAlways ไม่ส่งข้อความนี้ เพราะพบ {types} ซึ่งไม่ควรส่งให้ AI", "FirmAlways did not send this prompt. It contains {types}, which should not go to an AI."],
  copied: ["ฉบับที่ซ่อนข้อมูลแล้วอยู่ในคลิปบอร์ด กด ⌘V (หรือ Ctrl+V) แล้วส่งได้เลย:", "A safe copy is on your clipboard. Paste it (⌘V or Ctrl+V) and send:"],
  notCopied: ["คัดลอกฉบับที่ซ่อนข้อมูลด้านล่างแล้วส่งแทน:", "Copy the safe version below and send it instead:"],
  restoreNote: ["AI จะเห็นแค่ placeholder เช่น «PHONE_1» เมื่อ AI เขียนไฟล์ในเครื่องคุณ FirmAlways จะใส่ค่าจริงกลับให้", "The AI only sees placeholders such as «PHONE_1». When it writes files on your machine, FirmAlways puts the real values back."],
  allowHint: ["ถ้าต้องการส่งต้นฉบับจริง รัน `firmalways allow-next` แล้วส่งข้อความเดิมอีกครั้ง", "To send the original anyway, run `firmalways allow-next` and send it again."],
  blockedHint: ["ลบส่วนนั้นออกแล้วส่งใหม่ หรือใช้ฉบับที่ตัดออกแล้วด้านล่าง", "Remove it and send again, or use the version below with it removed"],
  blockedCopied: [" (อยู่ในคลิปบอร์ดแล้ว กด ⌘V แล้วส่งได้เลย):", " (already on your clipboard, paste and send):"],
  warned: ["FirmAlways: ข้อความนี้มี {types} (ตั้งไว้ให้เตือนอย่างเดียว)", "FirmAlways: this prompt contains {types} (set to warn only)."],
  tooLong: ["FirmAlways ไม่ส่งข้อความนี้ เพราะยาวเกินกว่าจะตรวจได้ทั้งหมด แบ่งเป็นหลายข้อความแล้วส่งใหม่", "FirmAlways did not send this prompt because it is too long to check. Split it and send again."],
  failed: ["FirmAlways ตรวจข้อความไม่สำเร็จจึงยังไม่ส่ง ({error}) ปิดการป้องกันชั่วคราวได้ด้วย `firmalways off`", "FirmAlways could not check this prompt, so it was not sent ({error}). Turn protection off with `firmalways off`."],
  allowed: ["FirmAlways: ส่งต้นฉบับตามที่คุณอนุญาต (ครั้งเดียว)", "FirmAlways: sent the original once, as you allowed."],
  keptPlaceholders: ["FirmAlways ไม่ได้ใส่ค่าจริงกลับ เพราะงานนี้ต้องให้คุณอนุมัติก่อน ใส่กลับเองได้ด้วย `firmalways restore ไฟล์ > ไฟล์ใหม่`", "FirmAlways left the placeholders because this action needs your approval. Put values back with `firmalways restore file > newfile`."],
  restored: ["FirmAlways ใส่ค่าจริงกลับใน {n} ตำแหน่งก่อนเขียนลงเครื่องคุณ", "FirmAlways put {n} real value(s) back before writing to your machine."],
};
const tr = (key, l, vars) => {
  let s = T[key][l === "th" ? 0 : 1];
  for (const [k, v] of Object.entries(vars || {})) s = s.split(`{${k}}`).join(String(v));
  return s;
};

/** UserPromptSubmit: returns the hook JSON to print, or null to let the prompt through untouched. */
function onPrompt(input, agent) {
  const settings = loadSettings();
  const l = lang(settings);
  if (!settings.enabled) return null;
  const prompt = String(input.prompt || "");
  if (!prompt.trim()) return null;
  const vault = loadVault();
  const r = analyzeText(prompt, settings, vault);
  if (r.verdict === "pass") {
    record(agent, "checked", {});
    return null;
  }
  if (r.verdict === "toolong") return { decision: "block", reason: tr("tooLong", l) };
  if (r.verdict === "warn") {
    record(agent, "warned", r.counts);
    return { systemMessage: tr("warned", l, { types: I18n.typeList(r.counts, l) }) };
  }
  if (r.verdict !== "block" && takeAllowance(prompt)) {
    record(agent, "allowed", r.counts);
    return { systemMessage: tr("allowed", l) };
  }
  saveVault(vault);
  const copied = settings.clipboard && copyToClipboard(r.safe);
  if (r.verdict === "block") {
    record(agent, "blocked", r.counts);
    const types = I18n.typeList(countsOf(r.entities, ["block"]), l);
    return { decision: "block", reason: [tr("blockedTitle", l, { types }), tr("blockedHint", l) + (copied ? tr("blockedCopied", l) : ":"), "", r.safe].join("\n") };
  }
  record(agent, "masked", r.counts);
  return {
    decision: "block",
    reason: [tr("maskedTitle", l, { types: I18n.typeList(r.counts, l) }), tr(copied ? "copied" : "notCopied", l), "", r.safe, "", tr("restoreNote", l), tr("allowHint", l)].join("\n"),
  };
}

const FILE_TOOLS = /^(apply_patch|applypatch|write|edit|multiedit|notebookedit|create_file|str_replace_based_edit_tool)$/i;

const SHELL_TOOLS = /^(bash|shell|exec_command|local_shell|unified_exec|run_shell_command)$/i;
/** A shell command that writes a file: `> file`, `>> file`, `tee file`. Codex writes most files this way. */
function writesFile(toolInput) {
  const cmd = typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput || "");
  return /(^|[^0-9&>])>>?\s*(?![&\s|])/.test(cmd) || /\btee\s+(-a\s+)?[^\s|-]/.test(cmd);
}

/** PreToolUse: put real values back into what the agent writes on this machine. */
function onTool(input, agent) {
  const settings = loadSettings();
  if (!settings.enabled || settings.restoreTools === "off") return null;
  const tool = String(input.tool_name || "");
  if (settings.restoreTools === "files" && !FILE_TOOLS.test(tool) && !(SHELL_TOOLS.test(tool) && writesFile(input.tool_input))) return null;
  const vault = loadVault();
  if (!Object.keys(vault.byToken).length) return null;
  let n = 0;
  const walk = (v) => {
    if (typeof v === "string") {
      const out = Vault.restore(v, vault);
      if (out !== v) n += 1;
      return out;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const updated = walk(input.tool_input);
  if (!n) return null;
  const l = lang(settings);
  // Claude Code shows the rewritten call and asks. Codex only accepts a rewrite together with
  // "allow", so rewrite only when Codex would not have asked anyway: never skip an approval.
  const mode = String(input.permission_mode || "default");
  let decision = "ask";
  if (agent !== "claude") {
    const noPrompt = mode === "bypassPermissions" || mode === "dontAsk" || (mode === "acceptEdits" && FILE_TOOLS.test(tool));
    if (!noPrompt) return { systemMessage: tr("keptPlaceholders", l) };
    decision = "allow";
  }
  record(agent, "restored", {});
  return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: tr("restored", l, { n }), updatedInput: updated },
    systemMessage: tr("restored", l, { n }),
  };
}

function runHook(agent) {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch (_) {}
  let input = {};
  let out = null;
  try {
    input = JSON.parse(raw || "{}");
    const event = input.hook_event_name || input.hookEventName;
    if (event === "UserPromptSubmit") out = onPrompt(input, agent);
    else if (event === "PreToolUse") out = onTool(input, agent);
  } catch (error) {
    const settings = loadSettings();
    if ((input.hook_event_name || "") === "UserPromptSubmit" && settings.failClosed) out = { decision: "block", reason: tr("failed", lang(settings), { error: String(error.message || error).slice(0, 200) }) };
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
}

// ---- install ---------------------------------------------------------------------------------
/** The command written into the agent's config. Short (`firmalways hook codex`, like `rtk hook codex`)
 * when the installed `firmalways` launcher is on PATH, so updates never change it; full paths otherwise. */
function onPath(name) {
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return file;
    } catch (_) {}
  }
  return null;
}
function hookCommand(agent) {
  if (onPath(process.platform === "win32" ? "firmalways.cmd" : "firmalways")) return `firmalways hook ${agent}`;
  const q = (s) => (/[\s"'$`\\]/.test(s) ? `"${s.replace(/(["$`\\])/g, "\\$1")}"` : s);
  return `${q(process.execPath)} ${q(path.join(ROOT, "hook", "firmalways.js"))} hook ${agent}`;
}
const isOurs = (h) => h && typeof h.command === "string" && /firmalways(\.js)?["']?\s+hook\s+/.test(h.command);

function mergeHooks(config, agent, remove) {
  config.hooks = config.hooks || {};
  for (const event of ["UserPromptSubmit", "PreToolUse"]) {
    const groups = (config.hooks[event] || [])
      .map((g) => Object.assign({}, g, { hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length);
    if (!remove) groups.push({ hooks: [{ type: "command", command: hookCommand(agent), timeout: 10 }] });
    if (groups.length) config.hooks[event] = groups;
    else delete config.hooks[event];
  }
  if (!Object.keys(config.hooks).length) delete config.hooks;
  return config;
}

function agentFile(agent) {
  if (agent === "codex") return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "hooks.json");
  return path.join(os.homedir(), ".claude", "settings.json");
}

function install(which, remove) {
  const l = lang(loadSettings());
  const agents = which === "all" || !which ? ["codex", "claude"] : [which];
  for (const agent of agents) {
    const file = agentFile(agent);
    const exists = fs.existsSync(file);
    if (!exists && (remove || !fs.existsSync(path.dirname(file)))) {
      if (which && which !== "all") console.log(`- ${agent}: ${l === "th" ? "ไม่พบ" : "not found"} (${path.dirname(file)})`);
      continue;
    }
    let config = {};
    if (exists) {
      try {
        config = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (e) {
        console.log(`! ${agent}: ${file}: ${e.message}`);
        continue;
      }
      fs.copyFileSync(file, `${file}.bak-firmalways`);
    }
    writeJson(file, mergeHooks(config, agent, remove));
    console.log(`${remove ? "-" : "+"} ${agent}: ${file}`);
  }
  if (!remove) {
    console.log(
      l === "th"
        ? "\nขั้นต่อไป: เปิด Codex หรือแท็บ Work ใน ChatGPT Desktop แล้วอนุมัติ hook ของ FirmAlways (Codex ให้ตรวจ hook ใหม่ก่อนใช้งานทุกครั้ง)\nลองดูผลโดยไม่ส่งจริง: firmalways check \"โทร 081-234-5678\""
        : "\nNext: open Codex or the Work tab in ChatGPT Desktop and approve the FirmAlways hook (Codex reviews new hooks before they run).\nTry it without sending anything: firmalways check \"call 081-234-5678\""
    );
  }
}

// ---- other commands --------------------------------------------------------------------------
function readInput(arg) {
  if (arg && arg !== "-") return fs.existsSync(arg) ? fs.readFileSync(arg, "utf8") : arg;
  return fs.readFileSync(0, "utf8");
}

function status() {
  const s = loadSettings();
  const l = lang(s);
  const v = loadVault();
  const day = (readJson(FILES.stats, { days: {} }).days || {})[today()] || {};
  const installed = ["codex", "claude"].map((a) => {
    const cfg = readJson(agentFile(a), {});
    const on = Object.values(cfg.hooks || {}).some((gs) => (gs || []).some((g) => (g.hooks || []).some(isOurs)));
    return `${a}: ${on ? (l === "th" ? "ติดตั้งแล้ว" : "installed") : "-"}`;
  });
  console.log(`FirmAlways Personal ${VERSION} (${s.enabled ? (l === "th" ? "เปิดอยู่" : "on") : l === "th" ? "ปิดอยู่" : "off"})`);
  console.log(installed.join("   "));
  console.log(`${l === "th" ? "ชุดนโยบาย" : "Policy packs"}: ${s.packs.join(", ")}   ${l === "th" ? "ตั้งค่า" : "settings"}: ${FILES.settings}`);
  console.log(`${l === "th" ? "ค่าจริงที่จำไว้" : "Remembered values"}: ${Vault.size(v)} (${l === "th" ? "ลบอัตโนมัติหลัง 24 ชม. หรือรัน firmalways forget" : "auto-deleted after 24 h, or run firmalways forget"})`);
  console.log(`${l === "th" ? "วันนี้" : "Today"}: ${l === "th" ? "ตรวจ" : "checked"} ${day.checked || 0}, ${l === "th" ? "ซ่อน" : "masked"} ${day.masked || 0}, ${l === "th" ? "ไม่ส่ง" : "blocked"} ${day.blocked || 0}`);
}

function report() {
  const s = loadSettings();
  const l = lang(s);
  const days = readJson(FILES.stats, { days: {} }).days || {};
  const sum = { checked: 0, masked: 0, blocked: 0, warned: 0, items: 0, byType: {} };
  for (const d of Object.values(days)) {
    for (const k of ["checked", "masked", "blocked", "warned", "items"]) sum[k] += d[k] || 0;
    for (const [t, n] of Object.entries(d.byType || {})) sum.byType[t] = (sum.byType[t] || 0) + n;
  }
  console.log(l === "th" ? `รายงาน ${Object.keys(days).length} วันล่าสุด (เก็บแค่จำนวน ไม่เก็บข้อความ)` : `Last ${Object.keys(days).length} days (counts only, never text)`);
  console.log(`${l === "th" ? "ตรวจ" : "checked"} ${sum.checked}  ${l === "th" ? "ซ่อนแล้วให้ส่งใหม่" : "masked"} ${sum.masked}  ${l === "th" ? "ไม่ส่ง" : "blocked"} ${sum.blocked}  ${l === "th" ? "เตือน" : "warned"} ${sum.warned}`);
  for (const [t, n] of Object.entries(sum.byType).sort((a, b) => b[1] - a[1])) console.log(`  ${I18n.typeName(t, l)}: ${n}`);
}

function setEnabled(on) {
  const user = readJson(FILES.settings, {});
  user.enabled = on;
  writeJson(FILES.settings, user);
  console.log(on ? "FirmAlways: on" : "FirmAlways: off");
}

const HELP = `FirmAlways Personal ${VERSION} — checks what you send to AI coding agents, on your machine

  firmalways init [codex|claude|all]   add the hook (default: every agent found)
  firmalways uninstall [codex|claude|all]
  firmalways check "text" | file | -   show what would happen, send nothing
  firmalways mask [file|-]             print a safe copy (placeholders)
  firmalways restore [file|-]          put real values back into a text
  firmalways clip [--restore]          make the clipboard safe (for ChatGPT chat, Claude, Gemini)
  firmalways allow-next                let the next blocked prompt through once (10 min)
  firmalways forget                    delete remembered real values
  firmalways status | report           what it did, counts only
  firmalways on | off
  firmalways hook codex|claude         used by the agent (reads hook JSON on stdin)

Settings: ${FILES.settings}`;

function main(argv) {
  const [cmd, arg, arg2] = argv;
  const s = loadSettings();
  const l = lang(s);
  switch (cmd) {
    case "hook":
      return runHook(arg === "claude" ? "claude" : arg || "codex");
    case "init":
    case "install":
      return install(arg, false);
    case "uninstall":
      return install(arg, true);
    case "check": {
      const text = readInput(arg);
      const r = analyzeText(text, s, Vault.createVault());
      console.log(`${l === "th" ? "ผล" : "verdict"}: ${r.verdict}`);
      for (const e of r.entities) console.log(`  ${e.action.padEnd(6)} ${I18n.typeName(e.type, l)}: ${text.slice(e.start, e.end)}`);
      if (r.verdict !== "pass") console.log(`\n${l === "th" ? "AI จะได้รับ" : "The AI would get"}:\n${r.safe}`);
      return;
    }
    case "mask": {
      const v = loadVault();
      const r = analyzeText(readInput(arg), s, v);
      saveVault(v);
      process.stdout.write(r.safe);
      return;
    }
    case "restore":
      process.stdout.write(Vault.restore(readInput(arg), loadVault()));
      return;
    case "clip": {
      const text = readClipboard();
      if (arg === "--restore") {
        copyToClipboard(Vault.restore(text, loadVault()));
        console.log(l === "th" ? "ใส่ค่าจริงกลับในคลิปบอร์ดแล้ว" : "Real values put back on the clipboard.");
        return;
      }
      const v = loadVault();
      const r = analyzeText(text, s, v);
      saveVault(v);
      copyToClipboard(r.safe);
      console.log(r.verdict === "pass" ? (l === "th" ? "ไม่พบข้อมูลที่ต้องซ่อน" : "Nothing to hide.") : `${l === "th" ? "ซ่อนแล้ว" : "Masked"}: ${I18n.typeList(r.counts, l)}`);
      return;
    }
    case "allow-next":
      writeJson(FILES.allow, { at: Date.now(), hash: arg ? sha(arg) : null });
      console.log(l === "th" ? "ข้อความถัดไปที่ถูกกันไว้จะส่งได้ 1 ครั้ง (ภายใน 10 นาที) ยกเว้นรหัสลับและข้อมูลอ่อนไหวซึ่งยังไม่ส่ง" : "The next held prompt goes through once (within 10 minutes). Secrets and sensitive data stay blocked.");
      return;
    case "forget":
      fs.rmSync(FILES.vault, { force: true });
      console.log(l === "th" ? "ลบค่าจริงที่จำไว้แล้ว" : "Remembered values deleted.");
      return;
    case "status":
      return status();
    case "report":
      return report();
    case "on":
    case "off":
      return setEnabled(cmd === "on");
    case "version":
    case "--version":
    case "-v":
      console.log(VERSION);
      return;
    default:
      console.log(HELP);
      if (cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h") process.exitCode = 2;
  }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { analyzeText, onPrompt, onTool, mergeHooks, hookCommand, FILES, VERSION };
