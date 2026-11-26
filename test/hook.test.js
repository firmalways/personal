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
