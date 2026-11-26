/*
 * Clean up Thai text taken out of PDFs and OCR before looking for personal data.
 * PDF fonts and OCR break Thai in predictable ways: shifted tone marks in the Private Use Area,
 * SARA AM split in two, marks in the wrong order or cut off by a space, and titles misread
 * ("บางสาว" for "นางสาว"). A name the detector cannot see is a name that leaks.
 */
"use strict";

// Microsoft/Apple Thai PUA glyphs (shifted marks and descenderless letters) -> Unicode
const PUA = {
  "\uF700": "\u0E10", "\uF701": "\u0E34", "\uF702": "\u0E35", "\uF703": "\u0E36", "\uF704": "\u0E37",
  "\uF705": "\u0E48", "\uF706": "\u0E49", "\uF707": "\u0E4A", "\uF708": "\u0E4B", "\uF709": "\u0E4C",
  "\uF70A": "\u0E48", "\uF70B": "\u0E49", "\uF70C": "\u0E4A", "\uF70D": "\u0E4B", "\uF70E": "\u0E4C",
  "\uF70F": "\u0E0D", "\uF710": "\u0E31", "\uF711": "\u0E4D", "\uF712": "\u0E47", "\uF713": "\u0E48",
  "\uF714": "\u0E49", "\uF715": "\u0E4A", "\uF716": "\u0E4B", "\uF717": "\u0E4C", "\uF718": "\u0E38",
  "\uF719": "\u0E39", "\uF71A": "\u0E3A",
};

const CONS = "\u0E01-\u0E2E"; // ก-ฮ
const ABOVE_BELOW = "\u0E31\u0E34-\u0E3A\u0E47"; // ั ิ ี ึ ื ุ ู ฺ ็
const TONES = "\u0E48-\u0E4C"; // ่ ้ ๊ ๋ ์
const MARKS = `${ABOVE_BELOW}${TONES}\u0E4D\u0E4E`;
const LEAD = "\u0E40-\u0E44"; // เ แ โ ใ ไ

function normalizeThai(text) {
  if (!text || !/[\u0E00-\u0E7F\uF700-\uF71A]/.test(text)) return text;
  let s = text.replace(/[\uF700-\uF71A]/g, (c) => PUA[c] || "");
  s = s.normalize("NFC");
  // SARA AM written as NIKHAHIT + SARA AA (often with the tone mark in between)
  s = s.replace(new RegExp(`\u0E4D([${TONES}]?)\u0E32`, "g"), "$1\u0E33");
  // a mark cut off from its letter by spaces or a stray symbol: "ก ้" -> "ก้", "ตาม¡สถานที่" -> "ตามสถานที่"
  s = s.replace(new RegExp(`([${CONS}${MARKS}])[ \\t]+(?=[${MARKS}])`, "g"), "$1");
  s = s.replace(new RegExp(`([\u0E00-\u0E7F])[¡¦§¨©ª¬®¯°±´µ¶·¸¹º¼½¾¿](?=[\u0E00-\u0E7F])`, "g"), (m, a) => a);
  // a leading vowel cut off from its consonant: "เ วป" -> "เวป"
  s = s.replace(new RegExp(`([${LEAD}])[ \\t]+(?=[${CONS}])`, "g"), "$1");
  // tone mark before an above/below vowel -> vowel first; drop repeated marks
  s = s.replace(new RegExp(`([${TONES}])([${ABOVE_BELOW}])`, "g"), "$2$1");
  s = s.replace(new RegExp(`([${MARKS}])\\1+`, "g"), "$1");
  // OCR misreads of personal titles, only at the start of a word and before a name
  s = s.replace(new RegExp(`(^|[^${CONS}${MARKS}\u0E30-\u0E33\u0E40-\u0E44])(?:บางสาว|นางลาว|บางลาว|นางสาร|นาง\\s+สาว)(?=\\s*[${CONS}${LEAD}])`, "gm"), "$1นางสาว");
  s = s.replace(new RegExp(`(^|[^${CONS}${MARKS}\u0E30-\u0E33\u0E40-\u0E44])(?:น\\.ส\\.|น\\.ส)(?=\\s*[${CONS}${LEAD}])`, "gm"), "$1นางสาว");
  return s;
}

/**
 * After masking: a surname cut onto the next line ("นาย«PERSON_9»\n   พจน์,นางสาว...") stays visible.
 * Hide a short Thai fragment that starts the next line when it is followed by a comma, the end of the
 * line, or another title.
 */
function hideWrappedNameParts(masked) {
  return masked.replace(
    new RegExp(`(«PERSON_\\d+»)([ \\t]*\\r?\\n[ \\t]*)([${CONS}${LEAD}][\u0E00-\u0E7F]{0,14})(?=[ \\t]*(?:,|\\r?\\n|$|นาย|นาง|น\\.ส\\.))`, "g"),
    (m, token, gap) => `${token}${gap}«PERSON_PART»`,
  );
}

module.exports = { normalizeThai, hideWrappedNameParts };
