"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "fa-hook-"));
process.env.FIRMALWAYS_HOME = HOME;
fs.writeFileSync(path.join(HOME, "settings.json"), JSON.stringify({ clipboard: false, lang: "en" }));
const CLI = path.join(__dirname, "..", "hook", "firmalways.js");
const H = require(CLI);

function hook(input, agent = "codex") {
  const r = spawnSync(process.execPath, [CLI, "hook", agent], { input: JSON.stringify(input), encoding: "utf8", env: Object.assign({}, process.env, { FIRMALWAYS_HOME: HOME }) });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const prompt = (text) => ({ hook_event_name: "UserPromptSubmit", prompt: text, session_id: "s", cwd: "/tmp", model: "m", permission_mode: "default", transcript_path: null, turn_id: "t" });

test("clean prompt passes with no output", () => {
  assert.strictEqual(hook(prompt("สรุปการประชุมวันนี้ให้หน่อย")), null);
});

test("personal data blocks the prompt and offers a masked copy", () => {
  const out = hook(prompt("ร่างจดหมายถึงนายสมชาย ใจดี เลขบัตร 1-1017-00230-73-2 โทร 081-234-5678"));
  assert.strictEqual(out.decision, "block");
  assert.match(out.reason, /«PERSON_1» เลขบัตร «THAI_NATIONAL_ID_1» โทร «PHONE_1»/);
  assert.ok(!/081-234-5678|1017-00230/.test(out.reason.split("\n").slice(1).join("\n")));
});

test("the masked copy goes through when sent again", () => {
  assert.strictEqual(hook(prompt("ร่างจดหมายถึงนาย«PERSON_1» เลขบัตร «THAI_NATIONAL_ID_1» โทร «PHONE_1»")), null);
});

test("secrets are blocked and removed, not masked", () => {
  const out = hook(prompt("use sk-proj-abcdefghijklmnopqrstuvwxyz123456 to call the API"));
  assert.strictEqual(out.decision, "block");
  assert.match(out.reason, /«REMOVED_SECRET»/);
  assert.ok(!out.reason.includes("sk-proj-abc"));
});

test("allow-next lets one masked prompt through, never a secret", () => {
  spawnSync(process.execPath, [CLI, "allow-next"], { env: Object.assign({}, process.env, { FIRMALWAYS_HOME: HOME }) });
  const out = hook(prompt("โทรหาคุณมาลี 0899999999"));
  assert.ok(out && !out.decision && /original/.test(out.systemMessage));
  assert.strictEqual(hook(prompt("โทรหาคุณมาลี 0899999999")).decision, "block");
  spawnSync(process.execPath, [CLI, "allow-next"], { env: Object.assign({}, process.env, { FIRMALWAYS_HOME: HOME }) });
  assert.strictEqual(hook(prompt("key sk-proj-abcdefghijklmnopqrstuvwxyz123456")).decision, "block");
});

test("real values go back into files the agent writes", () => {
  const out = hook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", permission_mode: "bypassPermissions", tool_input: { command: "*** Add File: a.txt\n+เรียน คุณ«PERSON_1» โทร «PHONE_1»\n" } });
  assert.strictEqual(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.match(out.hookSpecificOutput.updatedInput.command, /เรียน คุณสมชาย ใจดี โทร 081-234-5678/);
  assert.strictEqual(out.hookSpecificOutput.permissionDecision, "allow");
  const asking = hook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", permission_mode: "default", tool_input: { command: "+«PHONE_1»" } });
  assert.ok(!asking.hookSpecificOutput && /approval/.test(asking.systemMessage), "never skips an approval");
  const claude = hook({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "/tmp/a", content: "«PHONE_1»" } }, "claude");
  assert.strictEqual(claude.hookSpecificOutput.permissionDecision, "ask");
  assert.strictEqual(claude.hookSpecificOutput.updatedInput.content, "081-234-5678");
});

test("shell commands get real values only when they write a file", () => {
  assert.strictEqual(hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "echo «PHONE_1»" } }), null);
  assert.strictEqual(hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "grep «PHONE_1» a.txt 2>/dev/null" } }), null);
  const out = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", permission_mode: "bypassPermissions", tool_input: { command: "cat > letter.txt <<'EOF'\nโทร «PHONE_1»\nEOF" } });
  assert.match(out.hookSpecificOutput.updatedInput.command, /โทร 081-234-5678/);
  assert.ok(hook({ hook_event_name: "PreToolUse", tool_name: "Bash", permission_mode: "dontAsk", tool_input: { command: "printf '«PHONE_1»' | tee out.txt" } }));
});

test("broken input never blocks tools; nothing personal in the report", () => {
  const r = spawnSync(process.execPath, [CLI, "hook", "codex"], { input: "not json", encoding: "utf8", env: Object.assign({}, process.env, { FIRMALWAYS_HOME: HOME }) });
  assert.strictEqual(r.status, 0);
  const stats = fs.readFileSync(path.join(HOME, "stats.json"), "utf8");
  for (const v of ["สมชาย", "081-234-5678", "sk-proj", "0899999999"]) assert.ok(!stats.includes(v), v);
});

test("init merges with other hooks and uninstall removes only ours", () => {
  const cfg = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "rtk hook codex" }] }] } };
  const added = H.mergeHooks(JSON.parse(JSON.stringify(cfg)), "codex", false);
  assert.strictEqual(added.hooks.PreToolUse.length, 2);
  assert.strictEqual(added.hooks.UserPromptSubmit.length, 1);
  assert.strictEqual(H.mergeHooks(JSON.parse(JSON.stringify(added)), "codex", false).hooks.PreToolUse.length, 2, "idempotent");
  assert.deepStrictEqual(H.mergeHooks(added, "codex", true), cfg);
});

// ---- file guard ------------------------------------------------------------------------------
const DOCS = fs.mkdtempSync(path.join(os.tmpdir(), "fa-docs-"));
fs.writeFileSync(path.join(DOCS, "names.csv"), "ลำดับ,ชื่อ,โทร\n1,นางสาวสมศรี รักไทย,081-111-2222\n2,นายมานะ ใจกล้า,089-765-4321\n");
fs.writeFileSync(path.join(DOCS, "notes.md"), "# Meeting\nWe agreed to ship on Friday.\n");
fs.writeFileSync(path.join(DOCS, "ไฟล์ ภาษาไทย.txt"), "ติดต่อนายมานะ ใจกล้า โทร 089-765-4321\n");
const bash = (command) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", cwd: DOCS, permission_mode: "default", tool_input: { command } });
const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: DOCS, env: Object.assign({}, process.env, { FIRMALWAYS_HOME: HOME }) });

test("the agent cannot open a document that holds personal data", () => {
  for (const cmd of ["cat names.csv", `python3 -c "print(open('${DOCS}/names.csv').read())"`, "head -5 ./names.csv | sort", "cat 'ไฟล์ ภาษาไทย.txt'", "cat *.csv"]) {
    const out = hook(bash(cmd));
    assert.ok(out && out.hookSpecificOutput, cmd);
    assert.strictEqual(out.hookSpecificOutput.permissionDecision, "deny", cmd);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /firmalways read '/);
    assert.ok(!/สมศรี|081-111-2222/.test(JSON.stringify(out)), "the denial carries no real values");
  }
  assert.ok(hook({ hook_event_name: "PreToolUse", tool_name: "view_image", cwd: DOCS, tool_input: { path: `${DOCS}/names.csv` } }).hookSpecificOutput);
});

test("clean documents and the safe reader are allowed", () => {
  assert.strictEqual(hook(bash("cat notes.md")), null);
  assert.strictEqual(hook(bash("firmalways read 'names.csv'")), null);
  assert.strictEqual(hook(bash("firmalways read names.csv --pages 1-2 | head -20")), null);
  assert.ok(hook(bash("firmalways read notes.md; cat names.csv")).hookSpecificOutput, "a second reader in the same command is still checked");
});

test("firmalways read prints a masked copy", () => {
  const r = run(["read", "names.csv"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /นางสาว«PERSON_\d+»,«PHONE_\d+»/);
  assert.ok(!/สมศรี|081-111-2222/.test(r.stdout));
});

test("allow-file lets the user open one file on purpose", () => {
  run(["allow-file", path.join(DOCS, "names.csv")]);
  assert.strictEqual(hook(bash("cat names.csv")), null);
  assert.ok(hook(bash("cat 'ไฟล์ ภาษาไทย.txt'")).hookSpecificOutput, "other files stay guarded");
});

test("an attached document gets a note before the agent starts", () => {
  const out = hook(Object.assign(prompt(`อ่านไฟล์ให้หน่อย\n# Files mentioned by the user:\n## ไฟล์ ภาษาไทย.txt: ${DOCS}/ไฟล์ ภาษาไทย.txt`), { cwd: DOCS }));
  assert.match(out.hookSpecificOutput.additionalContext, /firmalways read/);
});

test("the agent cannot switch FirmAlways off or allow files for itself", () => {
  for (const cmd of ["firmalways allow-file names.csv", "firmalways off", "cd /tmp && firmalways allow-next", "echo '{}' > ~/.firmalways/allowed-files.json", "rm -f $HOME/.firmalways/settings.json", "cat ~/.codex/hooks.json", "node ~/.firmalways/app/hook/firmalways.js uninstall"]) {
    const out = hook(bash(cmd));
    assert.ok(out && out.hookSpecificOutput && out.hookSpecificOutput.permissionDecision === "deny", cmd);
  }
  assert.ok(hook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", cwd: DOCS, tool_input: { command: "*** Update File: /Users/me/.firmalways/settings.json\n" } }).hookSpecificOutput);
  assert.strictEqual(hook(bash("firmalways status")), null);
  assert.strictEqual(hook(bash("firmalways read notes.md")), null);
});

test("firmalways read repairs OCR-style titles before masking", () => {
  fs.writeFileSync(path.join(DOCS, "ocr.txt"), "จำเลย  นาย มานะ ใจกล้า ที่ 1 บางสาวสมศรี รักไทย ที่ 2\n");
  const r = run(["read", "ocr.txt"]);
  assert.ok(!/สมศรี|รักไทย|มานะ/.test(r.stdout), r.stdout);
});
