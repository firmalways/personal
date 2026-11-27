/*
 * Prompt injection: text inside a document or a pasted block that tries to give orders to the AI
 * ("ignore all previous instructions", "หมายเหตุถึงระบบ AI: ...", hidden HTML comments, invisible
 * characters). FirmAlways never blocks for this; it marks the text so the agent treats it as content
 * and checks with the user first.
 */
"use strict";

// Characters that hide or reorder text: bidi overrides and Unicode tag characters. Zero-width
// spaces are common in Thai web text, so they are removed quietly but not reported.
const HIDDEN = /[‪-‮⁦-⁩\u{E0000}-\u{E007F}]/gu;
const ZERO_WIDTH = /[​-‍⁠﻿]/g;

const AI = "(?:AI|A\\.I\\.|assistant|LLM|language model|chatbot|agent|GPT|ChatGPT|Codex|Claude|เอไอ|ปัญญาประดิษฐ์|ผู้ช่วย\\s*AI|แชทบอท)";

const PATTERNS = [
  // "ignore all previous instructions", "disregard the rules above"
  ["override", /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}?\b(?:previous|prior|above|earlier|preceding|all|any|your|system|original)\b[^.\n]{0,30}?\b(?:instructions?|prompts?|rules|messages|directions|guidelines|context)\b/i],
  ["override", /(?:ลืม|เพิกเฉย|ละเว้น|ละทิ้ง|ไม่ต้องสนใจ|ไม่ต้องทำตาม|ยกเลิก)\s*(?:ทุก)?(?:คำสั่ง|คำแนะนำ|ข้อความ|กฎ|ข้อกำหนด)[^\n]{0,20}?(?:ก่อนหน้า|ที่ผ่านมา|ข้างต้น|เดิม|ทั้งหมด)/],
  // a new role that removes the rules
  ["role", /\b(?:you are now|from now on,? you (?:are|will)|act as|pretend (?:to be|you are))\b[^.\n]{0,40}?\b(?:DAN|jailbr\w*|unrestricted|unfiltered|developer mode|no (?:rules|restrictions|limits))\b/i],
  ["reveal", /\b(?:reveal|print|show|output|repeat|leak)\b[^.\n]{0,30}?\b(?:system prompt|hidden instructions?|developer (?:message|prompt)|initial instructions)\b/i],
  // text written to the AI rather than to the reader
  ["addressed", new RegExp(`\\b(?:note|message|instructions?|attention)\\s+(?:to|for)\\s+(?:the\\s+|any\\s+)?${AI}\\b`, "i")],
  ["addressed", new RegExp(`(?:^|\\n|[.!>])\\s*(?:dear\\s+|hey\\s+)?${AI}(?:\\s+(?:assistant|agent|model))?\\s*[:,]\\s*(?:please\\s+)?(?:ignore|disregard|run|execute|send|upload|delete|email|forward|do not tell)`, "i")],
  ["addressed", new RegExp(`(?:หมายเหตุ|ข้อความ|คำสั่ง|คำแนะนำ)?\\s*(?:ถึง|สำหรับ)\\s*(?:ระบบ\\s*)?${AI}\\s*[:：]`, "i")],
  // asks to send secrets or files somewhere, or to destroy data
  ["exfiltrate", /(?:\b(?:cat|send|upload|post|curl|wget|email|forward|exfiltrate|include)\b|ส่ง|อัปโหลด|อัพโหลด)[^\n]{0,60}?(?:id_rsa|id_ed25519|\.ssh\/|\.env\b|\.aws\/credentials|\.netrc|keychain)/i],
  ["exfiltrate", /(?:\b(?:send|upload|post|forward)\b|ส่ง|อัปโหลด|อัพโหลด)[^\n]{0,15}?(?:\ball\b|\bevery\b|ทั้งหมด|ทุก|\bfiles?\b|ไฟล์|\bfolder\b|โฟลเดอร์)[^\n]{0,60}?https?:\/\//i],
  ["destroy", /\brm\s+-[a-z]*r[a-z]*f?\s+(?:~|\/|\$HOME)(?:\s|\/?$)/i],
];

const COMMENT = /<!--([\s\S]{0,2000}?)-->/g;
const COMMENT_HINT = new RegExp(`\\b(?:ignore|disregard|instruction|assistant|run|execute|${AI})\\b|คำสั่ง|ถึง\\s*(?:ระบบ\\s*)?${AI}`, "i");

/** Places in `text` that look like instructions aimed at an AI. */
function findInjections(text) {
  const found = [];
  if (!text) return found;
  const hidden = text.match(HIDDEN);
  if (hidden) found.push({ kind: "hidden", index: text.search(HIDDEN), snippet: `${hidden.length} hidden character(s)` });
  for (const m of text.matchAll(COMMENT)) {
    if (COMMENT_HINT.test(m[1])) found.push({ kind: "comment", index: m.index, snippet: m[0] });
  }
  for (const [kind, re] of PATTERNS) {
    const m = re.exec(text);
    if (m && !found.some((f) => f.index <= m.index && m.index < f.index + f.snippet.length)) found.push({ kind, index: m.index, snippet: m[0] });
  }
  return found
    .sort((a, b) => a.index - b.index)
    .map((f) => Object.assign(f, { snippet: f.snippet.replace(/\s+/g, " ").trim().slice(0, 120) }));
}

/**
 * Injections in a prompt the user typed. A person may well tell their own agent "forget the earlier
 * instructions", so wording alone counts only inside a long message (text pasted from elsewhere) or a
 * quoted/fenced block. Hidden characters and HTML comments count everywhere.
 */
function findInPrompt(prompt) {
  const all = findInjections(prompt);
  const quoted = [];
  for (const m of prompt.matchAll(/```[\s\S]*?```|^>.*$/gm)) quoted.push([m.index, m.index + m[0].length]);
  const inQuote = (i) => quoted.some(([a, b]) => i >= a && i < b);
  return all.filter((f) => f.kind === "hidden" || f.kind === "comment" || inQuote(f.index) || (prompt.length > 500 && f.index > 150));
}

/** Text with hidden characters removed, so the agent reads what a person sees. */
function stripHidden(text) {
  return text.replace(HIDDEN, "").replace(ZERO_WIDTH, "");
}

module.exports = { findInjections, findInPrompt, stripHidden };
