/* FirmAlways Security Core, JavaScript edition.
 *
 * A line-by-line port of the FirmAlways Gate 0.3 detectors (Python). The parity
 * test (test/parity.test.js) runs both engines on the same Thai test set, so a
 * change in one that is not made in the other fails the build.
 *
 * Everything runs locally. Nothing here sends text anywhere.
 *
 * Offsets are JavaScript string indices (UTF-16 units). Thai is in the BMP, so
 * for Thai text they equal Python's code-point offsets.
 */
(function (root) {
  "use strict";

  const DIGIT = "[0-9๐-๙]";
  const T = "[ก-ฺเ-๎]"; // Thai letters and marks, without the baht sign and Thai digits
  const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

  function digitsOnly(value) {
    return String(value)
      .replace(/[^0-9๐-๙]/g, "")
      .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
  }

  function entity(type, start, end, text, score) {
    return { type, start, end, text, score };
  }

  /** Iterate matches of a global regex (with the `d` flag when groups are used). */
  function* matches(re, text) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      yield m;
    }
  }

  function group(m, name) {
    const span = m.indices && m.indices.groups && m.indices.groups[name];
    return span ? { start: span[0], end: span[1], text: m.groups[name] } : null;
  }

  // --- Thai national ID and juristic tax ID -------------------------------------------------
  const ID_SEP = "[- \\u00a0]?";
  const ID_RE = new RegExp(
    `(?<!${DIGIT})${DIGIT}${ID_SEP}${DIGIT}{4}${ID_SEP}${DIGIT}{5}${ID_SEP}${DIGIT}{2}${ID_SEP}${DIGIT}(?!${DIGIT})`,
    "g"
  );
  const TAX_CONTEXT = new RegExp(
    "(?:เลขประจำตัวผู้เสียภาษี|เลขผู้เสียภาษี|ผู้เสียภาษี|เลขทะเบียนนิติบุคคล|นิติบุคคล|tax\\s*id|tin)[^0-9๐-๙\\n]{0,30}$",
    "i"
  );

  function isValidThaiId(value) {
    const d = digitsOnly(value);
    if (d.length !== 13) return false;
    let total = 0;
    for (let i = 0; i < 12; i++) total += Number(d[i]) * (13 - i);
    return (11 - (total % 11)) % 10 === Number(d[12]);
  }

  function detectThaiId(text, requireChecksum) {
    const found = [];
    for (const m of matches(ID_RE, text)) {
      const raw = m[0];
      const valid = isValidThaiId(raw);
      if (requireChecksum && !valid) continue;
      let kind = "THAI_NATIONAL_ID";
      if (digitsOnly(raw).startsWith("0") && TAX_CONTEXT.test(text.slice(Math.max(0, m.index - 60), m.index))) {
        kind = "TAX_ID";
      }
      found.push(entity(kind, m.index, m.index + raw.length, raw, valid ? 1.0 : 0.5));
    }
    return found;
  }

  // --- Phone ---------------------------------------------------------------------------------
  const PS = "[-. \\u00a0]?";
  const PHONE_RE = new RegExp(
    `(?<![0-9๐-๙+])(?:\\(\\+66\\)|\\+66|0|๐)${PS}(?:[689๖๘๙](?:${PS}${DIGIT}){8}|[2-57๒-๕๗](?:${PS}${DIGIT}){7})(?!${DIGIT})`,
    "g"
  );
  function detectPhone(text) {
    return [...matches(PHONE_RE, text)].map((m) => entity("PHONE", m.index, m.index + m[0].length, m[0], 0.8));
  }

  // --- Email ---------------------------------------------------------------------------------
  const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9\\-]*[A-Za-z0-9])?";
  const EMAIL_RE = new RegExp(
    `(?<![A-Za-z0-9._%+\\-])[A-Za-z0-9][A-Za-z0-9._%+\\-]*@${LABEL}(?:\\.${LABEL})*\\.[A-Za-z]{2,24}(?![A-Za-z0-9\\-])`,
    "g"
  );
  function detectEmail(text) {
    return [...matches(EMAIL_RE, text)].map((m) => entity("EMAIL", m.index, m.index + m[0].length, m[0], 1.0));
  }

  // --- Bank account --------------------------------------------------------------------------
  const BANK_FORMATTED = new RegExp(`(?<!${DIGIT})${DIGIT}{3}-${DIGIT}-${DIGIT}{5}-${DIGIT}(?!${DIGIT})`, "g");
  const BANK_KEYWORD =
    "(?:เลขที่บัญชี|เลขบัญชี|บัญชีเลขที่|บัญชี|บช\\.|account\\s*(?:no\\.?|number|#)?|acct\\.?|a/c|" +
    "ธนาคาร|ธ\\.ก\\.ส\\.|กสิกรไทย|กสิกร|ไทยพาณิชย์|กรุงไทย|กรุงศรี|บัวหลวง|ทีทีบี|ออมสิน|" +
    "kbank|scb|ktb|bbl|ttb|krungsri|gsb|baac)";
  const BANK_CONTEXT = new RegExp(
    `${BANK_KEYWORD}[^0-9๐-๙\\n]{0,30}?(?<num>(?<!${DIGIT})${DIGIT}(?:[- ]?${DIGIT}){9,14})(?!${DIGIT})`,
    "gid"
  );
  function detectBank(text) {
    const found = [...matches(BANK_FORMATTED, text)].map((m) =>
      entity("BANK_ACCOUNT", m.index, m.index + m[0].length, m[0], 0.9)
    );
    for (const m of matches(BANK_CONTEXT, text)) {
      const g = group(m, "num");
      found.push(entity("BANK_ACCOUNT", g.start, g.end, g.text, 0.85));
    }
    return found;
  }

  // --- Credit card ---------------------------------------------------------------------------
  const D = DIGIT;
  const CARD_RE = new RegExp(
    `(?<!${D})(?:[2-6]${D}{12,18}|[2-6]${D}{3}(?<sep>[- ])${D}{4}\\k<sep>${D}{4}\\k<sep>${D}{4}(?:\\k<sep>${D}{1,3})?|3${D}{3}[- ]${D}{6}[- ]${D}{5})(?!${D})`,
    "g"
  );
  function luhnValid(value) {
    const d = digitsOnly(value);
    if (d.length < 13 || d.length > 19) return false;
    let total = 0;
    for (let i = 0; i < d.length; i++) {
      let n = Number(d[d.length - 1 - i]);
      if (i % 2 === 1) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      total += n;
    }
    return total % 10 === 0;
  }
  function detectCard(text) {
    return [...matches(CARD_RE, text)]
      .filter((m) => luhnValid(m[0]))
      .map((m) => entity("CREDIT_CARD", m.index, m.index + m[0].length, m[0], 0.95));
  }

  // --- Secrets -------------------------------------------------------------------------------
  const SECRET_PATTERNS = [
    [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, null, 1.0],
    [/(?<![A-Za-z0-9_\-])sk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}/g, null, 1.0],
    [/(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])/g, null, 1.0],
    [/(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36,}/g, null, 1.0],
    [/(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{22,}/g, null, 1.0],
    [/(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9\-]{10,}/g, null, 1.0],
    [/(?<![A-Za-z0-9_\-])AIza[0-9A-Za-z_\-]{35}/g, null, 1.0],
    [/(?<![A-Za-z0-9])[rs]k_live_[0-9A-Za-z]{20,}/g, null, 1.0],
    [/(?<![A-Za-z0-9_\-])eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, null, 1.0],
    [/(?:password|passwd|pwd|รหัสผ่าน|พาสเวิร์ด)\s*(?:[:=]|คือ|is)\s*["']?(?<value>[^\s"',;]{4,})/gid, "value", 0.9],
  ];
  function detectSecret(text) {
    const found = [];
    for (const [re, name, score] of SECRET_PATTERNS) {
      for (const m of matches(re, text)) {
        const g = name ? group(m, name) : { start: m.index, end: m.index + m[0].length };
        found.push(entity("SECRET", g.start, g.end, text.slice(g.start, g.end), score));
      }
    }
    return found;
  }

  // --- Person names after a title -----------------------------------------------------------
  const FORMAL = ["เด็กชาย", "เด็กหญิง", "ด.ช.", "ด.ญ.", "นางสาว", "น.ส.", "นายแพทย์", "แพทย์หญิง",
    "นพ.", "พญ.", "ดร.", "คุณหญิง", "นาง", "นาย"];
  const CASUAL = ["คุณ"];
  const TITLES = [...FORMAL, ...CASUAL].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  const NAME_TH = new RegExp(
    `(?<title>${TITLES})[ \\u00a0]?(?<first>${T}{2,20})(?!${T})(?:[ \\u00a0](?<last>${T}{2,25})(?!${T}))?`,
    "gd"
  );
  const NAME_EN = /(?<![A-Za-z])(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+(?<first>[A-Z][a-z]+)(?:\s+(?<last>[A-Z][a-z]+))?/gd;
  const BLOCK_BEFORE = { "คุณ": ["ขอบ", "บุญ", "พระ"], "นาย": ["ท", "ทำ"] };
  const FORMAL_STOP_EXACT = new Set(["ก", "พล", "ทุน", "ช่าง", "ด่าน", "ท่าน", "ร้อย", "สิบ", "พัน", "พราน",
    "ห้าง", "งาน", "เรือ", "ฟ้า", "งาม", "เอก", "รำ"]);
  const FORMAL_STOP_PREFIX = ["จ้าง", "หน้า", "กรัฐ", "กเทศ", "อำเภอ", "ประกัน", "ทะเบียน", "ตรวจ", "ธนาคาร",
    "ความ", "แบบ", "พยาบาล", "กวัก", "สนม", "ร้าย", "เงือก", "ข้าหลวง"];
  const CASUAL_STOP_PREFIX = [
    // nouns: คุณไสย (black magic), คุณวิเศษ, คุณความดี, คุณงามความดี, คุณานุประโยชน์, คุณโทษ
    "ไสย", "วิเศษ", "ความ", "งามความ", "านุ", "โทษ", "ภาพ", "ค่า", "สมบัติ", "ประโยชน์", "ธรรม", "ลักษณะ", "วุฒิ", "ูป", "ครับ", "ค่ะ", "คะ", "นะ",
    "ช่วย", "คิด", "เป็น", "จะ", "มี", "ได้", "สามารถ", "ควร", "ต้อง", "อยาก", "ทำ", "รู้", "เห็น",
    "ชอบ", "ไม่", "ก็", "เคย", "กำลัง", "ยัง", "อาจ", "ว่า", "บอก", "ใช้", "ลอง", "ขอ", "ให้", "คือ",
    "เลือก", "ดู", "อ่าน", "ส่ง", "เขียน", "ถาม", "ตอบ", "และ", "กับ", "ทุก", "เอง", "ที่", "สำหรับ",
    "จริง", "มาก", "ลูกค้า", "ผู้", "แม่", "พ่อ", "ครู", "หมอ", "ป้า", "ลุง", "ยาย", "ปู่", "ย่า",
    "น้า", "พี่", "น้อง", "ต่อ", "ไป",
    // verbs and particles: "คุณ" used as "you" ("สิ่งที่คุณเสนอมา"), not as a title
    "เสนอ", "แนะนำ", "อธิบาย", "เล่า", "พูด", "คุย", "ตั้ง", "สร้าง", "แก้ไข", "แก้ให้", "หาให้", "หาข้อมูล", "ค้นหา", "เปิด", "ปิด", "กด", "รัน", "เอา", "เข้าใจ", "จำได้", "ลืม", "รอ", "เริ่ม", "หยุด", "ลบ", "เช็ค", "เช็ก", "คงจะ", "น่าจะ", "กลัว", "เชื่อ", "วาง", "ออกแบบ", "ปรับ", "แปล", "สรุป", "เตรียม", "เข้า", "ออก", "กลับ", "อยู่", "เพิ่ง", "จึง", "ถึง", "หรือ", "ด้วย", "เลย", "แล้ว", "อีก", "สนใจ", "พยายาม", "รับ", "จ่าย", "ซื้อ", "ขาย", "เดิน", "นั่ง", "กิน", "นอน", "ตื่น", "เจอ", "ทราบ", "ฟัง", "เรียก", "ตัด", "ใส่", "ระบุ", "กำหนด", "จัด", "เก็บ", "ย้าย", "แชร์", "โพสต์", "สั่ง", "ทดสอบ", "วิเคราะห์", "ถ้า", "ผิด", "ถูก", "ทั้ง", "เท่านั้น", "ล่ะ", "ฉลาด", "เหนื่อย"];
  const SURNAME_STOP_PREFIX = [
    "เลข", "โทร", "อายุ", "ที่", "ตำแหน่ง", "รหัส", "เบอร์", "อีเมล", "เป็น", "ได้", "มา", "ไป", "จะ",
    "และ", "กับ", "ซึ่ง", "ผู้", "ขอ", "ช่วย", "แจ้ง", "ทำ", "มี", "ใน", "จาก", "ถึง", "ให้", "ว่า",
    "บ้าน", "หมู่", "ถนน", "ซอย", "ตำบล", "อำเภอ", "จังหวัด", "แผนก", "ฝ่าย", "ค้าง", "ยอด", "ครับ",
    "ค่ะ", "คะ", "นะ", "เรื่อง", "เพื่อ", "แล้ว", "ด้วย", "หรือ", "บัตร", "บัญชี", "ลูกค้า", "พนักงาน",
    "วันที่", "เมื่อ", "ซื้อ", "จ่าย", "โอน", "ส่ง", "ติดต่อ", "รหัสผ่าน"];
  const startsWithAny = (s, list) => list.some((p) => s.startsWith(p));

  function isName(title, first, before) {
    if ((BLOCK_BEFORE[title] || []).some((b) => before.endsWith(b))) return false;
    if (CASUAL.includes(title)) return !startsWithAny(first, CASUAL_STOP_PREFIX);
    return !FORMAL_STOP_EXACT.has(first) && !startsWithAny(first, FORMAL_STOP_PREFIX);
  }

  function detectName(text) {
    const found = [];
    for (const m of matches(NAME_TH, text)) {
      const title = m.groups.title;
      const first = group(m, "first");
      const last = group(m, "last");
      if (!isName(title, first.text, text.slice(0, m.index))) continue;
      const end = last && !startsWithAny(last.text, SURNAME_STOP_PREFIX) ? last.end : first.end;
      found.push(entity("PERSON", first.start, end, text.slice(first.start, end), CASUAL.includes(title) ? 0.6 : 0.75));
    }
    for (const m of matches(NAME_EN, text)) {
      const first = group(m, "first");
      const last = group(m, "last");
      const end = last ? last.end : first.end;
      found.push(entity("PERSON", first.start, end, text.slice(first.start, end), 0.7));
    }
    return found;
  }

  // --- Thai address --------------------------------------------------------------------------
  const NUM = `${DIGIT}+(?:/${DIGIT}+)?`;
  const ADDRESS_PART = new RegExp(
    [
      `(?<!${T})${T}{0,25}?(?:คอนโดมิเนียม|คอนโด|อาคาร|ทาวน์โฮม|ทาวน์เฮ้าส์|อพาร์ตเมนต์|อพาร์ทเมนท์|แมนชั่น|เรสซิเดนซ์)(?:\\s*${T}+)?`,
      `(?:บ้านเลขที่|เลขที่)\\s*${NUM}`,
      `(?<![0-9๐-๙/])${DIGIT}{1,5}/${DIGIT}{1,5}(?![0-9๐-๙/])`,
      `หมู่บ้าน\\s*${T}+`,
      `(?:หมู่ที่|หมู่|ม\\.)\\s*${DIGIT}{1,3}`,
      `(?:ซอย|ซ\\.)\\s*(?:${T}+(?:\\s*${NUM})?|${NUM})`,
      `(?:ถนน|ถ\\.)\\s*${T}+`,
      `(?:ตำบล|แขวง|ต\\.)\\s*${T}+`,
      `(?:อำเภอ|เขต|อ\\.)\\s*${T}+`,
      `(?:จังหวัด|จ\\.)\\s*${T}+`,
      "กรุงเทพมหานคร|กรุงเทพฯ|กทม\\.?",
      `(?<!${DIGIT})[1-9]${DIGIT}{4}(?!${DIGIT})`,
    ].join("|"),
    "g"
  );
  const GAP = /^[\s,]{0,3}$/;
  const LEAD_IN = ["ส่งไปที่", "ไปที่", "อยู่ที่", "ส่งที่", "พักที่", "ที่", "ณ"];

  function detectAddress(text) {
    const groups = [];
    for (const m of matches(ADDRESS_PART, text)) {
      const start = m.index;
      const end = m.index + m[0].length;
      const last = groups[groups.length - 1];
      if (last && GAP.test(text.slice(last[1], start))) {
        last[1] = end;
        last[2] += 1;
      } else {
        groups.push([start, end, 1]);
      }
    }
    const found = [];
    for (let [start, end, count] of groups) {
      if (count < 2) continue;
      for (const lead of LEAD_IN) {
        if (text.startsWith(lead, start) && end - start > lead.length + 4) {
          start += lead.length;
          break;
        }
      }
      found.push(entity("THAI_ADDRESS", start, end, text.slice(start, end), count >= 3 ? 0.7 : 0.6));
    }
    return found;
  }

  // --- Passport, plate, LINE, IP, date of birth, nationality --------------------------------
  const PASSPORT_RE =
    /(?:หนังสือเดินทาง|พาสปอร์ต|passport(?:\s*(?:no\.?|number|#))?)[^A-Za-z0-9\n]{0,20}?(?<value>(?<![A-Za-z0-9])[A-Za-z]{1,2}[0-9]{6,8})(?![A-Za-z0-9])/gid;
  const PLATE_RE = new RegExp(
    "(?:ป้ายทะเบียน|ทะเบียนรถ|ทะเบียน|license\\s+plate|plate\\s*(?:no\\.?|number)?)[^\\n0-9ก-ฮ]{0,10}?(?<value>(?:[0-9]\\s?)?[ก-ฮ]{2}\\s?-?\\s?[0-9]{1,4})(?![0-9])",
    "gid"
  );
  const LINE_RE =
    /(?:ไอดีไลน์|ไลน์ไอดี|ไลน์|(?<![A-Za-z])line\s*id|(?<![A-Za-z])line(?=\s*[:：]))\s*[:：]?\s*(?<value>@?[A-Za-z0-9][A-Za-z0-9._\-]{2,29})(?![A-Za-z0-9._\-])/gid;
  const OCTET = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])";
  const IPV4 = new RegExp(`(?<![0-9.])${OCTET}(?:\\.${OCTET}){3}(?![0-9]|\\.[0-9])`, "g");
  const IPV6 = /(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}(?![0-9A-Fa-f:])/g;

  const THAI_MONTH =
    "(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|" +
    "ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.)";
  const EN_MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
  const DATE =
    `(?:${D}{1,2}\\s*[/\\-.]\\s*${D}{1,2}\\s*[/\\-.]\\s*${D}{2,4}` +
    `|${D}{4}-${D}{2}-${D}{2}` +
    `|${D}{1,2}\\s*${THAI_MONTH}\\s*(?:พ\\.ศ\\.\\s*|ค\\.ศ\\.\\s*)?${D}{2,4}` +
    `|${D}{1,2}\\s+${EN_MONTH}\\s+${D}{4}` +
    `|${EN_MONTH}\\s+${D}{1,2},?\\s+${D}{4})`;
  const DOB_RE = new RegExp(
    "(?:วัน\\s*/?\\s*เดือน\\s*/?\\s*ปี\\s*เกิด|ว\\s*/\\s*ด\\s*/\\s*ป\\s*เกิด|วันเกิด|เกิดวันที่|เกิดเมื่อ|" +
      "date\\s+of\\s+birth|d\\.?o\\.?b\\.?|birthday|born\\s+on)" +
      `\\s*(?:คือ|is)?\\s*[:：]?\\s*(?<value>${DATE})(?![0-9๐-๙])`,
    "gid"
  );
  const NATIONALITY_RE = new RegExp(
    `(?<th>สัญชาติ\\s*${T}{2,15})(?!${T})|(?<![A-Za-z])nationality\\s*[:：]?\\s*(?<en>[A-Z][a-z]{2,20})`,
    "gid"
  );

  function byGroup(re, type, score, name, text, accept) {
    const found = [];
    for (const m of matches(re, text)) {
      const g = group(m, name);
      if (g && (!accept || accept(g.text))) found.push(entity(type, g.start, g.end, g.text, score));
    }
    return found;
  }

  const detectPassport = (t) => byGroup(PASSPORT_RE, "PASSPORT", 0.85, "value", t);
  const detectPlate = (t) => byGroup(PLATE_RE, "LICENSE_PLATE", 0.85, "value", t);
  const detectLine = (t) => byGroup(LINE_RE, "LINE_ID", 0.85, "value", t, (v) => v.startsWith("@") || /[A-Za-z]/.test(v));
  const detectBirthDate = (t) => byGroup(DOB_RE, "DATE_OF_BIRTH", 0.85, "value", t);
  function detectIp(text) {
    const found = [];
    for (const re of [IPV4, IPV6]) {
      for (const m of matches(re, text)) found.push(entity("IP_ADDRESS", m.index, m.index + m[0].length, m[0], 0.75));
    }
    return found;
  }
  function detectNationality(text) {
    const found = [];
    for (const m of matches(NATIONALITY_RE, text)) {
      const g = group(m, "th") || group(m, "en");
      found.push(entity("NATIONALITY", g.start, g.end, g.text, 0.7));
    }
    return found;
  }

  // --- PDPA section 26 sensitive data --------------------------------------------------------
  const SENSITIVE = {
    SENSITIVE_HEALTH: [
      ["ผู้ป่วย", "คนไข้", "ป่วยเป็น", "เป็นโรค", "โรคเบาหวาน", "เบาหวาน", "มะเร็ง", "ความดันโลหิตสูง", "โรคหัวใจ", "โรคไต",
        "ซึมเศร้า", "ไบโพลาร์", "จิตเภท", "โรคจิต", "เอชไอวี", "เอดส์", "ติดเชื้อ", "ตั้งครรภ์", "แท้ง",
        "ผลตรวจเลือด", "ผลตรวจสุขภาพ", "ผลตรวจโรค", "ผลแล็บ", "วินิจฉัย", "ประวัติการรักษา", "ใบรับรองแพทย์",
        "เวชระเบียน", "ผ่าตัด", "ยาต้านไวรัส", "กรุ๊ปเลือด", "หมู่เลือด", "บำบัดยาเสพติด"],
      ["patient", "diagnosed", "diagnosis", "cancer", "diabetes", "depression", "bipolar", "schizophrenia", "hiv",
        "pregnant", "pregnancy", "medical record", "blood test", "surgery"],
    ],
    SENSITIVE_RELIGION: [
      ["นับถือศาสนาพุทธ", "นับถือศาสนาอิสลาม", "นับถือศาสนาคริสต์", "นับถือศาสนาฮินดู", "นับถือศาสนาซิกข์",
        "นับถือศาสนา", "ศาสนาพุทธ", "ศาสนาอิสลาม", "ศาสนาคริสต์", "ศาสนาฮินดู", "ศาสนาซิกข์", "ชาวพุทธ",
        "มุสลิม", "คริสเตียน", "ไม่มีศาสนา", "ความเชื่อทางศาสนา"],
      ["religion", "muslim", "christian", "buddhist", "hindu", "atheist"],
    ],
    SENSITIVE_CRIMINAL: [
      ["ประวัติอาชญากรรม", "ประวัติคดี", "ต้องโทษ", "จำคุก", "ติดคุก", "ถูกจับ", "หมายจับ", "คดีอาญา",
        "ศาลพิพากษา", "พ้นโทษ"],
      ["criminal record", "convicted", "arrested", "arrest warrant", "prison"],
    ],
    SENSITIVE_DISABILITY: [
      ["ผู้พิการ", "พิการ", "ทุพพลภาพ", "บัตรคนพิการ", "ตาบอด", "หูหนวก", "ออทิสติก", "สมาธิสั้น"],
      ["disability", "disabled", "wheelchair", "autism", "adhd"],
    ],
    SENSITIVE_BIOMETRIC: [
      ["ลายนิ้วมือ", "สแกนใบหน้า", "ข้อมูลใบหน้า", "จำลองใบหน้า", "ม่านตา", "ลายเสียง"],
      ["fingerprint", "face scan", "facial recognition", "iris scan", "biometric", "voiceprint"],
    ],
    SENSITIVE_GENETIC: [["ดีเอ็นเอ", "พันธุกรรม", "ผลตรวจยีน"], ["dna", "genetic", "genome"]],
    SENSITIVE_POLITICAL: [
      ["ความคิดเห็นทางการเมือง", "สมาชิกพรรค", "เลือกพรรค", "ฝักใฝ่การเมือง", "แนวคิดทางการเมือง"],
      ["political opinion", "party member", "political affiliation"],
    ],
    SENSITIVE_UNION: [["สหภาพแรงงาน", "สมาชิกสหภาพ"], ["trade union", "labor union", "labour union", "union member"]],
    SENSITIVE_SEXUAL: [
      ["เพศวิถี", "รสนิยมทางเพศ", "เกย์", "เลสเบี้ยน", "ไบเซ็กชวล", "คนข้ามเพศ", "แปลงเพศ", "พฤติกรรมทางเพศ"],
      ["sexual orientation", "gay", "lesbian", "bisexual", "transgender", "lgbtq"],
    ],
    SENSITIVE_RACE: [["เชื้อชาติ", "เผ่าพันธุ์", "ชาติพันธุ์"], ["ethnicity", "ethnic origin", "race"]],
  };
  const byLength = (a, b) => b.length - a.length;
  const SENSITIVE_RE = Object.entries(SENSITIVE).map(([kind, [thai, english]]) => {
    const th = [...thai].sort(byLength).map(escapeRe).join("|");
    const en = [...english].sort(byLength).map((k) => escapeRe(k).replace(/ /g, "\\s+")).join("|");
    return [kind, new RegExp(`(?:${th})|(?<![A-Za-z])(?:${en})(?![A-Za-z])`, "gi")];
  });
  function detectSensitive(text) {
    const found = [];
    for (const [kind, re] of SENSITIVE_RE) {
      for (const m of matches(re, text)) found.push(entity(kind, m.index, m.index + m[0].length, m[0], 0.7));
    }
    return found;
  }

  // --- Analyzer ------------------------------------------------------------------------------
  const IDENTIFIER_TYPES = new Set(["THAI_NATIONAL_ID", "PHONE", "EMAIL", "BANK_ACCOUNT", "CREDIT_CARD", "PERSON",
    "THAI_ADDRESS", "PASSPORT", "LICENSE_PLATE", "LINE_ID", "DATE_OF_BIRTH"]);
  const SENSITIVE_TYPES = Object.keys(SENSITIVE);
  const ENTITY_TYPES = ["THAI_NATIONAL_ID", "TAX_ID", "PHONE", "EMAIL", "BANK_ACCOUNT", "CREDIT_CARD", "SECRET",
    "PERSON", "THAI_ADDRESS", "PASSPORT", "LICENSE_PLATE", "LINE_ID", "IP_ADDRESS", "DATE_OF_BIRTH", "NATIONALITY",
    ...SENSITIVE_TYPES];
  const OTHER_DETECTORS = [detectPhone, detectEmail, detectBank, detectCard, detectSecret, detectName, detectAddress,
    detectPassport, detectPlate, detectLine, detectIp, detectBirthDate];

  function trimName(e, flagged, text) {
    if (e.type !== "PERSON") return e;
    const cuts = flagged.filter((s) => e.start < s.start && s.start < e.end).map((s) => s.start);
    if (!cuts.length) return e;
    let end = Math.min(...cuts);
    while (end > e.start && /\s/.test(text[end - 1])) end--;
    return entity(e.type, e.start, end, text.slice(e.start, end), e.score);
  }

  function resolveOverlaps(entities) {
    const sorted = [...entities].sort(
      (a, b) => b.end - b.start - (a.end - a.start) || b.score - a.score || a.start - b.start
    );
    const chosen = [];
    for (const e of sorted) {
      if (chosen.every((c) => e.end <= c.start || e.start >= c.end)) chosen.push(e);
    }
    return chosen.sort((a, b) => a.start - b.start);
  }

  /**
   * Return non-overlapping entities in `text`, ordered by position.
   * options: minScore (0.5), lenientThaiId (true), sensitiveRequiresIdentifier (true),
   * extraDetectors (functions text -> entities, e.g. custom keywords and rules).
   */
  function analyze(text, options) {
    const o = Object.assign(
      { minScore: 0.5, lenientThaiId: true, sensitiveRequiresIdentifier: true, extraDetectors: [] },
      options || {}
    );
    text = String(text || "");
    let found = detectThaiId(text, !o.lenientThaiId);
    for (const detect of OTHER_DETECTORS) found.push(...detect(text));
    for (const detect of o.extraDetectors) found.push(...detect(text));
    found = found.filter((e) => e.score >= o.minScore);
    const identified = found.some((e) => IDENTIFIER_TYPES.has(e.type));
    if (identified || !o.sensitiveRequiresIdentifier) {
      const flagged = [...detectSensitive(text), ...detectNationality(text)].filter((e) => e.score >= o.minScore);
      found = [...found.map((e) => trimName(e, flagged, text)), ...flagged];
    }
    return resolveOverlaps(found);
  }

  const api = {
    analyze,
    resolveOverlaps,
    isValidThaiId,
    luhnValid,
    digitsOnly,
    escapeRe,
    ENTITY_TYPES,
    SENSITIVE_TYPES,
    IDENTIFIER_TYPES,
    VERSION: "0.3.0",
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FirmAlwaysEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
