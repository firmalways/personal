const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/core/engine.js");
const vaultApi = require("../src/core/vault.js");
globalThis.FirmAlwaysEngine = engine;
globalThis.FirmAlwaysVault = vaultApi;
const policy = require("../src/core/policy.js");

const ID = "1-1017-00230-73-2";

function run(text, settings) {
  const compiled = policy.compile(settings);
  const decision = policy.decide(text, compiled);
  const vault = vaultApi.createVault();
  return { decision, vault, sent: policy.protect(text, decision, vault, vaultApi) };
}

test("default policy masks personal data and restores it locally", () => {
  const { decision, vault, sent } = run(`ช่วยร่างจดหมายถึงนายสมชาย ใจดี เลขบัตร ${ID} โทร 081-234-5678`);
  assert.equal(decision.verdict, "mask");
  assert.equal(sent, "ช่วยร่างจดหมายถึงนาย«PERSON_1» เลขบัตร «THAI_NATIONAL_ID_1» โทร «PHONE_1»");
  assert.ok(!sent.includes("สมชาย") && !sent.includes("081"));
  assert.equal(vaultApi.restore("เรียน «PERSON_1» (PHONE_1)", vault), "เรียน สมชาย ใจดี (081-234-5678)");
});

test("the same value keeps the same placeholder; the phone in +66 form too", () => {
  const vault = vaultApi.createVault();
  assert.equal(vaultApi.placeholderFor(vault, "PHONE", "081-234-5678"), "«PHONE_1»");
  assert.equal(vaultApi.placeholderFor(vault, "PHONE", "+66 81 234 5678"), "«PHONE_1»");
  assert.equal(vaultApi.placeholderFor(vault, "PHONE", "0899999999"), "«PHONE_2»");
});

test("restore leaves unknown placeholders alone", () => {
  const vault = vaultApi.createVault();
  vaultApi.placeholderFor(vault, "EMAIL", "a@example.com");
  assert.equal(vaultApi.restore("«EMAIL_1» «EMAIL_9» PHONE_1", vault), "a@example.com «EMAIL_9» PHONE_1");
});

test("secrets and PDPA s.26 data about a person are blocked", () => {
  assert.equal(run("my key sk-proj-abcdefghijklmnopqrstuvwxyz123456").decision.verdict, "block");
  assert.equal(run("นายสมชาย ใจดี ป่วยเป็นมะเร็ง").decision.verdict, "block");
  assert.equal(run("อาการของโรคเบาหวานมีอะไรบ้าง").decision.verdict, "pass");
});

test("basic switches: secrets off allows them, autoMask off asks first", () => {
  const key = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";
  assert.equal(run(`key ${key}`, { basic: { secrets: false } }).decision.verdict, "pass");
  assert.equal(run("โทร 0812345678", { basic: { autoMask: false } }).decision.verdict, "ask");
  assert.equal(run("โทร 0812345678", { basic: { personal: false } }).decision.verdict, "pass");
});

test("advanced mode: per-type actions override packs", () => {
  const settings = { mode: "advanced", actions: { PHONE: "allow", EMAIL: "redact", PERSON: "warn" } };
  const { decision, sent } = run("คุณสมศรี โทร 0812345678 อีเมล a@example.com", settings);
  assert.equal(sent, "คุณสมศรี โทร 0812345678 อีเมล «REDACTED_EMAIL»");
  assert.equal(decision.verdict, "mask");
  assert.equal(run("คุณสมศรี มาแล้ว", settings).decision.verdict, "warn");
});

test("custom keywords and custom rules", () => {
  const settings = {
    keywords: [{ text: "Project Phoenix", action: "mask" }, { text: "งบลับ", action: "block" }],
    rules: [{ name: "employee id", pattern: "EMP-[0-9]{5}", action: "mask" }],
  };
  const { sent } = run("สรุป project phoenix ของ EMP-12345", settings);
  assert.equal(sent, "สรุป «KEYWORD_1» ของ «CUSTOM_EMPLOYEE_ID_1»");
  assert.equal(run("ตัวเลขงบลับปีนี้", settings).decision.verdict, "block");
});

test("a broken custom rule is reported and skipped", () => {
  assert.ok(policy.ruleError("([a-z"));
  assert.ok(policy.ruleError("a*"));
  assert.equal(policy.ruleError("EMP-[0-9]+"), null);
  assert.equal(run("โทร 0812345678", { rules: [{ name: "x", pattern: "([" }] }).decision.verdict, "mask");
});

test("policy packs: finance blocks OTP and cards, dev blocks connection strings", () => {
  const finance = { packs: ["th-pdpa", "personal-finance"] };
  assert.equal(run("รหัส OTP คือ 482913 ใช้ภายใน 5 นาที", finance).decision.verdict, "block");
  assert.equal(run("บัตร 4111 1111 1111 1111 ใช้ไม่ได้", finance).decision.verdict, "block");
  assert.equal(run("บัตร 4111 1111 1111 1111 ใช้ไม่ได้").decision.verdict, "mask");
  assert.equal(run("DATABASE_URL=postgres://app:s3cretpw@db.internal:5432/app").decision.verdict, "block");
  assert.equal(run("Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123").decision.verdict, "block");
});

test("ask before sending turns every finding into a question", () => {
  assert.equal(run("โทร 0812345678", { askBeforeSending: true }).decision.verdict, "ask");
});

test("settings defaults survive bad input", () => {
  const s = policy.withDefaults({ actions: { PHONE: "explode" }, packs: ["nope", "th-pdpa"], keywords: [{ text: " " }] });
  assert.deepEqual(s.actions, {});
  assert.deepEqual(s.packs, ["th-pdpa"]);
  assert.deepEqual(s.keywords, []);
  assert.equal(s.sites["claude.ai"], true);
});

test("every pack declares its sources and valid actions", () => {
  for (const p of policy.PACKS) {
    assert.ok(p.legal_reference.length && p.related_controls.length && p.version, p.id);
    for (const a of Object.values(p.actions)) assert.ok(policy.ACTIONS.includes(a), p.id);
    for (const r of p.rules) assert.equal(policy.ruleError(r.pattern), null, r.type);
  }
});

test("engine: Thai ID checksum and Luhn", () => {
  assert.equal(engine.isValidThaiId(ID), true);
  assert.equal(engine.isValidThaiId("1-1017-00230-73-9"), false);
  assert.equal(engine.luhnValid("4111111111111111"), true);
});
