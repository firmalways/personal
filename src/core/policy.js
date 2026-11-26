/* Personal policy: what to do with each kind of data before it is sent to an AI.
 *
 * Actions, from least to most strict:
 *   allow  - send as is
 *   warn   - send as is, but tell the user
 *   ask    - show the Privacy Mirror and let the user choose before sending
 *   mask   - replace with a placeholder («PHONE_1»); the real value comes back in the answer, on this device only
 *   redact - replace with «REDACTED_TYPE»; nothing comes back
 *   block  - do not send
 *
 * The rules come from public policy packs (Thailand PDPA Baseline and others),
 * then the user's own settings. In Basic mode four switches adjust the packs;
 * in Advanced mode the user sets an action per data type. Both are free.
 */
(function (root) {
  "use strict";
  const engine = root.FirmAlwaysEngine || (typeof require === "function" ? require("./engine.js") : null);

  const ACTIONS = ["allow", "warn", "ask", "mask", "redact", "block"];
  const RANK = Object.fromEntries(ACTIONS.map((a, i) => [a, i]));
  const stricter = (a, b) => (RANK[a] >= RANK[b] ? a : b);

  const PERSONAL_TYPES = ["THAI_NATIONAL_ID", "TAX_ID", "PHONE", "EMAIL", "BANK_ACCOUNT", "CREDIT_CARD", "PERSON",
    "THAI_ADDRESS", "PASSPORT", "LICENSE_PLATE", "LINE_ID", "IP_ADDRESS", "DATE_OF_BIRTH", "NATIONALITY"];
  const SENSITIVE_TYPES = engine.SENSITIVE_TYPES;
  const SECRET_TYPES = ["SECRET", "OTP_CODE", "CARD_CVV", "CARD_PIN", "CONNECTION_STRING", "ENV_SECRET", "BEARER_TOKEN"];

  const PDPA_ACTIONS = Object.assign(
    Object.fromEntries(PERSONAL_TYPES.map((t) => [t, "mask"])),
    Object.fromEntries(SENSITIVE_TYPES.map((t) => [t, "block"])),
    { SECRET: "block" }
  );

  /** Public policy packs. Metadata says where each rule comes from, so it can be reviewed. */
  const PACKS = [
    {
      id: "th-pdpa",
      version: "1.0.0",
      jurisdiction: "TH",
      name: { th: "Thailand PDPA Baseline", en: "Thailand PDPA Baseline" },
      description: {
        th: "ซ่อนข้อมูลส่วนบุคคลทั่วไป และไม่ส่งข้อมูลอ่อนไหวตามมาตรา 26 ที่อยู่คู่กับตัวบุคคล",
        en: "Masks personal data and does not send PDPA section 26 sensitive data about a person.",
      },
      legal_reference: ["PDPA s.26", "PDPA s.27", "PDPA s.28–29", "PDPA s.37(1)"],
      related_controls: ["ISO/IEC 27001:2022 A.5.34", "A.8.11", "A.8.12"],
      note: {
        th: "การบล็อกข้อมูลมาตรา 26 เป็นนโยบายเริ่มต้นของ FirmAlways ไม่ใช่ข้อห้ามตามกฎหมายในทุกกรณี",
        en: "Blocking section 26 data is FirmAlways' default policy, not a legal prohibition in every case.",
      },
      actions: PDPA_ACTIONS,
      rules: [],
    },
    {
      id: "global-privacy",
      version: "1.0.0",
      jurisdiction: "GLOBAL",
      name: { th: "Global Privacy Baseline", en: "Global Privacy Baseline" },
      description: {
        th: "ใช้หลักให้ข้อมูลเท่าที่จำเป็น ซ่อนอีเมล เบอร์โทร ชื่อ บัตร พาสปอร์ต และ IP",
        en: "Data minimisation: masks email, phone, names, cards, passports and IP addresses.",
      },
      legal_reference: ["GDPR Art. 5(1)(c)", "PDPA s.22"],
      related_controls: ["ISO/IEC 27701:2025", "ISO/IEC 27001:2022 A.8.11"],
      actions: {
        EMAIL: "mask", PHONE: "mask", PERSON: "mask", CREDIT_CARD: "mask", PASSPORT: "mask",
        IP_ADDRESS: "mask", DATE_OF_BIRTH: "mask", SECRET: "block",
      },
      rules: [],
    },
    {
      id: "personal-finance",
      version: "1.0.0",
      jurisdiction: "TH",
      name: { th: "Personal Finance Protection", en: "Personal Finance Protection" },
      description: {
        th: "ไม่ส่งเลขบัตรเครดิต รหัส OTP, CVV และ PIN ให้ AI เด็ดขาด กันมิจฉาชีพหลอกให้คัดลอกไปวาง",
        en: "Never sends card numbers, OTP, CVV or PIN codes, a common target of scams.",
      },
      legal_reference: ["PDPA s.37(1)"],
      related_controls: ["ISO/IEC 27001:2022 A.8.12"],
      actions: { CREDIT_CARD: "block", BANK_ACCOUNT: "mask", THAI_NATIONAL_ID: "mask" },
      rules: [
        { type: "OTP_CODE", action: "block", pattern: "(?:otp|รหัส\\s*otp|รหัสยืนยัน|รหัส\\s*ref|verification\\s+code)\\s*(?:คือ|is|[:：])?\\s*[0-9]{4,8}(?![0-9])", flags: "gi" },
        { type: "CARD_CVV", action: "block", pattern: "(?<![A-Za-z])(?:cvv|cvc|cvv2|รหัสหลังบัตร)\\s*(?:คือ|is|[:：])?\\s*[0-9]{3,4}(?![0-9])", flags: "gi" },
        { type: "CARD_PIN", action: "block", pattern: "(?<![A-Za-z])(?:pin|รหัส\\s*atm|รหัส\\s*pin)\\s*(?:คือ|is|[:：])?\\s*[0-9]{4,6}(?![0-9])", flags: "gi" },
      ],
    },
    {
      id: "dev-secrets",
      version: "1.0.0",
      jurisdiction: "GLOBAL",
      name: { th: "Developer Secret Protection", en: "Developer Secret Protection" },
      description: {
        th: "ไม่ส่ง API key, token, รหัสผ่านในไฟล์ .env และ connection string ที่มีรหัสผ่าน",
        en: "Never sends API keys, tokens, .env passwords or connection strings with passwords.",
      },
      legal_reference: ["OWASP Top 10 for LLM Applications: LLM02 Sensitive Information Disclosure"],
      related_controls: ["ISO/IEC 27001:2022 A.5.17", "A.8.12"],
      actions: { SECRET: "block", IP_ADDRESS: "mask" },
      rules: [
        { type: "CONNECTION_STRING", action: "block", pattern: "(?<![A-Za-z0-9+])[a-z][a-z0-9+]{1,15}://[^\\s:/@]+:[^\\s@/]{3,}@[^\\s/]+", flags: "gi" },
        { type: "ENV_SECRET", action: "block", pattern: "(?<![A-Za-z0-9_])[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS)\\s*=\\s*[\"']?[^\\s\"']{6,}", flags: "g" },
        { type: "BEARER_TOKEN", action: "block", pattern: "(?<![A-Za-z])Bearer\\s+[A-Za-z0-9._\\-~+/]{20,}=*", flags: "g" },
      ],
    },
  ];

  const DEFAULT_SITES = {
    "chatgpt.com": true,
    "chat.openai.com": true,
    "claude.ai": true,
    "gemini.google.com": true,
    "copilot.microsoft.com": true,
    "www.perplexity.ai": true,
    "chat.deepseek.com": true,
  };

  const DEFAULT_SETTINGS = {
    version: 1,
    enabled: true,
    mode: "basic", // "basic" | "advanced"
    basic: { personal: true, sensitive: true, secrets: true, autoMask: true },
    packs: ["th-pdpa", "dev-secrets"],
    actions: {}, // advanced: TYPE -> action, overrides the packs
    keywords: [], // [{ text, action }]
    rules: [], // [{ name, pattern, action }]
    sites: DEFAULT_SITES,
    askBeforeSending: false, // show the Privacy Mirror before every send that contains data
    autoSend: true, // after masking, send automatically
    sensitiveRequiresIdentifier: true,
    restoreAnswers: true,
    notifications: true,
    retentionDays: 30,
    lang: "auto",
  };

  function withDefaults(settings) {
    const s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    s.basic = Object.assign({}, DEFAULT_SETTINGS.basic, (settings && settings.basic) || {});
    s.sites = Object.assign({}, DEFAULT_SITES, (settings && settings.sites) || {});
    s.actions = Object.assign({}, (settings && settings.actions) || {});
    for (const [t, a] of Object.entries(s.actions)) if (!(a in RANK)) delete s.actions[t];
    s.keywords = ((settings && settings.keywords) || []).filter((k) => k && String(k.text || "").trim());
    s.rules = ((settings && settings.rules) || []).filter((r) => r && r.pattern);
    s.packs = (s.packs || []).filter((id) => PACKS.some((p) => p.id === id));
    return s;
  }

  function customType(name) {
    const slug = String(name || "RULE").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
    return "CUSTOM_" + (slug || "RULE");
  }

  /** Check a user rule. Returns an error message, or null when the pattern can be used. */
  function ruleError(pattern) {
    if (!pattern || pattern.length > 500) return "pattern must be 1–500 characters";
    try {
      const re = new RegExp(pattern, "g");
      if (re.test("")) return "pattern matches empty text";
      return null;
    } catch (e) {
      return String(e.message || e);
    }
  }

  function regexDetector(type, pattern, flags, fixedAction) {
    let re;
    try {
      re = new RegExp(pattern, flags && flags.includes("g") ? flags : (flags || "") + "g");
    } catch (_) {
      return () => [];
    }
    return (text) => {
      const out = [];
      re.lastIndex = 0;
      let m;
      let guard = 0;
      while ((m = re.exec(text)) !== null && guard++ < 1000) {
        if (m[0] === "") {
          re.lastIndex++;
          continue;
        }
        const e = { type, start: m.index, end: m.index + m[0].length, text: m[0], score: 0.9 };
        if (fixedAction) e.fixedAction = fixedAction;
        out.push(e);
      }
      return out;
    };
  }

  /** One detector per action, so "mask this word" and "block that word" can live side by side. */
  function keywordDetectors(keywords) {
    const byAction = {};
    for (const k of keywords) {
      const action = k.action in RANK ? k.action : "mask";
      const text = String(k.text).trim();
      if (text) (byAction[action] = byAction[action] || []).push(text);
    }
    return Object.entries(byAction).map(([action, words]) => {
      const parts = words
        .sort((a, b) => b.length - a.length)
        .map((k) => {
          const esc = engine.escapeRe(k).replace(/\s+/g, "\\s+");
          return /^[A-Za-z0-9]/.test(k) ? `(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])` : esc;
        });
      return regexDetector("KEYWORD", parts.join("|"), "gi", action);
    });
  }

  /** Compile settings into what the analyzer and the decision need. */
  function compile(settings) {
    const s = withDefaults(settings);
    const actions = {};
    const detectors = [];
    for (const pack of PACKS.filter((p) => s.packs.includes(p.id))) {
      for (const [type, action] of Object.entries(pack.actions)) actions[type] = actions[type] ? stricter(actions[type], action) : action;
      for (const rule of pack.rules) {
        actions[rule.type] = actions[rule.type] ? stricter(actions[rule.type], rule.action) : rule.action;
        detectors.push(regexDetector(rule.type, rule.pattern, rule.flags));
      }
    }
    if (s.mode === "basic") {
      const groups = [
        [s.basic.personal, PERSONAL_TYPES],
        [s.basic.sensitive, SENSITIVE_TYPES],
        [s.basic.secrets, SECRET_TYPES],
      ];
      for (const [on, types] of groups) if (!on) for (const t of types) if (actions[t]) actions[t] = "allow";
      if (!s.basic.autoMask) for (const t of Object.keys(actions)) if (actions[t] === "mask") actions[t] = "ask";
    } else {
      Object.assign(actions, s.actions);
    }
    detectors.push(...keywordDetectors(s.keywords));
    for (const rule of s.rules) {
      if (ruleError(rule.pattern)) continue;
      const type = customType(rule.name);
      actions[type] = rule.action in RANK ? rule.action : "mask";
      detectors.push(regexDetector(type, rule.pattern, "g"));
    }
    return { settings: s, actions, detectors };
  }

  /**
   * Decide what happens to `text`.
   * Returns { verdict, entities: [{type,start,end,text,action}], counts }.
   * verdict: "pass" | "warn" | "ask" | "mask" | "block".
   */
  function decide(text, compiled) {
    const found = engine.analyze(text, {
      extraDetectors: compiled.detectors,
      sensitiveRequiresIdentifier: compiled.settings.sensitiveRequiresIdentifier,
    });
    const entities = found
      .map((e) => Object.assign({}, e, { action: e.fixedAction || compiled.actions[e.type] || "allow" }))
      .filter((e) => e.action !== "allow");
    const counts = {};
    for (const e of entities) counts[e.type] = (counts[e.type] || 0) + 1;
    let verdict = "pass";
    if (entities.some((e) => e.action === "block")) verdict = "block";
    else if (entities.some((e) => e.action === "ask")) verdict = "ask";
    else if (entities.some((e) => e.action === "mask" || e.action === "redact")) verdict = compiled.settings.askBeforeSending ? "ask" : "mask";
    else if (entities.length) verdict = compiled.settings.askBeforeSending ? "ask" : "warn";
    return { verdict, entities, counts };
  }

  /** Text to send after masking/redacting. `ask` entities are masked (the safe choice in the Privacy Mirror). */
  function protect(text, decision, vault, vaultApi) {
    const v = vaultApi || root.FirmAlwaysVault || require("./vault.js");
    const toMask = decision.entities.filter((e) => e.action === "mask" || e.action === "ask");
    const toRedact = decision.entities.filter((e) => e.action === "redact");
    let out = "";
    let pos = 0;
    for (const e of [...toMask, ...toRedact].sort((a, b) => a.start - b.start)) {
      const value = text.slice(e.start, e.end);
      out += text.slice(pos, e.start) + (e.action === "redact" ? `«REDACTED_${e.type}»` : v.placeholderFor(vault, e.type, value));
      pos = e.end;
    }
    return out + text.slice(pos);
  }

  const api = {
    ACTIONS, PACKS, PERSONAL_TYPES, SENSITIVE_TYPES, SECRET_TYPES, DEFAULT_SETTINGS, DEFAULT_SITES,
    withDefaults, compile, decide, protect, ruleError, customType, stricter,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FirmAlwaysPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
