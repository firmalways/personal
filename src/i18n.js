/* Thai and English text for the extension. */
(function (root) {
  "use strict";

  const TYPES = {
    THAI_NATIONAL_ID: ["เลขบัตรประชาชน", "Thai ID number"],
    TAX_ID: ["เลขผู้เสียภาษีนิติบุคคล", "Company tax ID"],
    PHONE: ["เบอร์โทรศัพท์", "Phone number"],
    EMAIL: ["อีเมล", "Email"],
    BANK_ACCOUNT: ["เลขบัญชีธนาคาร", "Bank account"],
    CREDIT_CARD: ["เลขบัตรเครดิต", "Card number"],
    SECRET: ["รหัสผ่าน / API key", "Password / API key"],
    PERSON: ["ชื่อบุคคล", "Person's name"],
    THAI_ADDRESS: ["ที่อยู่", "Address"],
    PASSPORT: ["เลขหนังสือเดินทาง", "Passport number"],
    LICENSE_PLATE: ["ทะเบียนรถ", "Licence plate"],
    LINE_ID: ["LINE ID", "LINE ID"],
    IP_ADDRESS: ["IP address", "IP address"],
    DATE_OF_BIRTH: ["วันเกิด", "Date of birth"],
    NATIONALITY: ["สัญชาติ", "Nationality"],
    SENSITIVE_HEALTH: ["ข้อมูลสุขภาพ", "Health data"],
    SENSITIVE_RELIGION: ["ศาสนา", "Religion"],
    SENSITIVE_CRIMINAL: ["ประวัติอาชญากรรม", "Criminal record"],
    SENSITIVE_DISABILITY: ["ความพิการ", "Disability"],
    SENSITIVE_BIOMETRIC: ["ข้อมูลชีวภาพ", "Biometric data"],
    SENSITIVE_GENETIC: ["ข้อมูลพันธุกรรม", "Genetic data"],
    SENSITIVE_POLITICAL: ["ความคิดเห็นทางการเมือง", "Political opinion"],
    SENSITIVE_UNION: ["สหภาพแรงงาน", "Trade union"],
    SENSITIVE_SEXUAL: ["พฤติกรรมทางเพศ", "Sexual orientation"],
    SENSITIVE_RACE: ["เชื้อชาติ", "Race or ethnicity"],
    OTP_CODE: ["รหัส OTP", "OTP code"],
    CARD_CVV: ["รหัส CVV", "Card CVV"],
    CARD_PIN: ["รหัส PIN", "PIN code"],
    CONNECTION_STRING: ["Connection string ที่มีรหัสผ่าน", "Connection string with password"],
    ENV_SECRET: ["ค่าลับในไฟล์ .env", ".env secret"],
    BEARER_TOKEN: ["Bearer token", "Bearer token"],
    KEYWORD: ["คำที่คุณกำหนด", "Your keyword"],
  };

  const S = {
    appName: ["FirmAlways Personal", "FirmAlways Personal"],
    masked: ["ซ่อนข้อมูล {n} จุดก่อนส่งให้ AI แล้ว", "Masked {n} item(s) before sending to the AI"],
    maskedPaste: ["ซ่อนข้อมูล {n} จุดก่อนวาง", "Masked {n} item(s) before pasting"],
    maskedPressSend: ["ซ่อนข้อมูลแล้ว กดส่งอีกครั้งได้เลย", "Masked. Press send again."],
    blocked: ["ไม่ได้ส่ง: พบ {types}", "Not sent: found {types}"],
    blockedPaste: ["ไม่ได้วาง: พบ {types}", "Not pasted: found {types}"],
    warned: ["ข้อความนี้มี {types}", "This message contains {types}"],
    showMirror: ["ดูสิ่งที่ AI ได้รับ", "See what the AI got"],
    mirrorTitle: ["Privacy Mirror", "Privacy Mirror"],
    mirrorAskLead: ["ข้อความนี้มีข้อมูลส่วนบุคคล เลือกว่าจะส่งแบบไหน", "This message has personal data. Choose how to send it."],
    mirrorBlockLead: ["ข้อความนี้จะไม่ถูกส่ง เพราะมีข้อมูลที่ตั้งให้บล็อกไว้", "This message will not be sent because it contains data set to be blocked."],
    yourText: ["ข้อความของคุณ", "Your text"],
    aiGets: ["สิ่งที่ AI ได้รับ", "What the AI gets"],
    found: ["ที่พบ", "Found"],
    sendMasked: ["ส่งแบบซ่อนข้อมูล", "Send masked"],
    sendOriginal: ["ส่งข้อความเดิม", "Send original"],
    cancel: ["ยกเลิก", "Cancel"],
    editText: ["กลับไปแก้ไข", "Back to edit"],
    close: ["ปิด", "Close"],
    mapLocal: ["ค่าจริงเก็บไว้ในเครื่องนี้เท่านั้น และจะแสดงกลับในคำตอบให้คุณคนเดียว", "Real values stay on this device and come back in the answer for you only."],
    tooLong: ["ข้อความยาวเกินกว่าจะตรวจได้ จึงไม่ได้ส่ง", "The text is too long to check, so it was not sent."],
    actions: {
      allow: ["ส่งตามปกติ", "Allow"],
      warn: ["แจ้งเตือน", "Warn"],
      ask: ["ถามก่อนส่ง", "Ask"],
      mask: ["ซ่อนแล้วคืนค่า", "Mask"],
      redact: ["ลบทิ้ง", "Redact"],
      block: ["บล็อก", "Block"],
    },
  };

  function lang(setting) {
    if (setting === "th" || setting === "en") return setting;
    const nav = (root.navigator && root.navigator.language) || "th";
    return nav.toLowerCase().startsWith("th") ? "th" : "en";
  }

  function pick(pair, l) {
    return Array.isArray(pair) ? pair[l === "en" ? 1 : 0] : pair;
  }

  function t(key, l, vars) {
    const path = key.split(".");
    let v = S;
    for (const p of path) v = v && v[p];
    let s = pick(v, l) || key;
    for (const [k, val] of Object.entries(vars || {})) s = s.split("{" + k + "}").join(val);
    return s;
  }

  function typeName(type, l) {
    if (TYPES[type]) return pick(TYPES[type], l);
    if (type.startsWith("CUSTOM_")) return (l === "en" ? "Custom rule: " : "กฎที่คุณสร้าง: ") + type.slice(7).replace(/_/g, " ").toLowerCase();
    return type;
  }

  function typeList(counts, l) {
    return Object.keys(counts).map((tp) => typeName(tp, l)).join(", ");
  }

  const api = { lang, t, typeName, typeList, TYPES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FirmAlwaysI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
