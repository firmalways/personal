/*
 * File guard: find the documents a tool call is about to touch, read their text locally and say
 * whether they hold personal data. Used by the PreToolUse hook and by `firmalways read`.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const Docx = require(path.join(__dirname, "..", "src/core/docx.js"));
const Ocr = require(path.join(__dirname, "ocr.js"));
const { normalizeThai } = require(path.join(__dirname, "thai.js"));

const DOC_EXT = /\.(pdf|docx|xlsx|pptx|csv|tsv|txt|md|markdown|json|jsonl|rtf|html?)$/i;
const GUARD_EXT = new RegExp(`(${DOC_EXT.source})|(${Ocr.IMAGE_EXT.source})`, "i");
const MAX_FILE = 50 * 1024 * 1024;
const SCANNED_PAGE_CHARS = 40;
const MAX_CANDIDATES = 40;

function findBinary(name) {
  const dirs = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", ...(process.env.PATH || "").split(path.delimiter)];
  for (const dir of dirs) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return file;
    } catch (_) {}
  }
  return null;
}

/** Text of a PDF: poppler's pdftotext when installed, macOS PDFKit otherwise. null if neither works. */
function pdfText(file, range) {
  const bin = findBinary("pdftotext");
  if (bin) {
    const args = ["-layout", "-enc", "UTF-8"];
    if (range) args.push("-f", String(range[0]), "-l", String(range[1]));
    try {
      return execFileSync(bin, [...args, file, "-"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] });
    } catch (_) {}
  }
  if (process.platform === "darwin") {
    const script = `function run(argv) {
      ObjC.import("PDFKit");
      const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]));
      if (doc.isNil()) return "";
      const from = Math.max(1, parseInt(argv[1] || "1", 10)), to = Math.min(doc.pageCount, parseInt(argv[2] || String(doc.pageCount), 10));
      const out = [];
      for (let i = from - 1; i < to; i++) { const s = doc.pageAtIndex(i).string; out.push(s.isNil() ? "" : ObjC.unwrap(s)); }
      return out.join("\\f");
    }`;
    try {
      const args = ["-l", "JavaScript", "-e", script, file];
      if (range) args.push(String(range[0]), String(range[1]));
      return execFileSync("/usr/bin/osascript", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] });
    } catch (_) {}
  }
  return null;
}

async function zipText(ab, prefix, first) {
  const parts = [];
  const names = first ? [first] : [];
  for (let i = 1; i <= 300; i++) names.push(`${prefix}${i}.xml`);
  for (const name of names) {
    const data = await Docx.readZipEntry(ab, name).catch(() => null);
    if (!data) {
      if (name !== first) break;
      continue;
    }
    const xml = new TextDecoder().decode(data).replace(/<\/(row|a:p|si|w:p)>/g, "\n").replace(/<\/c>/g, "\t");
    parts.push(Docx.xmlToText(xml));
  }
  return parts.join("\n");
}

/** Pages that carry a large picture (a scan or a photo of a document), from poppler's pdfimages. */
function imagePages(file, range) {
  const bin = findBinary("pdfimages");
  if (!bin) return null;
  const args = ["-list"];
  if (range) args.push("-f", String(range[0]), "-l", String(range[1]));
  try {
    const out = execFileSync(bin, [...args, file], { encoding: "utf8", timeout: 15000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const pages = new Set();
    for (const line of out.split("\n").slice(2)) {
      const c = line.trim().split(/\s+/);
      if (c.length > 4 && Number(c[3]) * Number(c[4]) >= 600 * 600) pages.add(Number(c[0]));
    }
    return pages;
  } catch (_) {
    return null;
  }
}

/**
 * Everything FirmAlways can read in a document, with OCR for scanned PDF pages and images.
 * budgetMs limits OCR time (the hook must answer quickly); pages it could not reach are listed in
 * `unverified`. Returns { text, unverified } or { text: null } when the file cannot be read at all.
 */
async function documentText(file, { range = null, budgetMs = Infinity, ocr = true } = {}) {
  const started = Date.now();
  if (Ocr.IMAGE_EXT.test(file)) {
    const text = ocr ? Ocr.imageText(file, Math.min(60000, Math.max(1000, budgetMs))) : null;
    return text === null ? { text: null, output: null, unverified: ["image"] } : { text: normalizeThai(text), output: normalizeThai(text), unverified: [] };
  }
  if (!/\.pdf$/i.test(file)) {
    const text = await extractText(file, range);
    return { text: text && normalizeThai(text), output: text && normalizeThai(text), unverified: [] };
  }
  const raw = pdfText(file, range);
  if (raw === null) return { text: null, output: null, unverified: ["pdf"] };
  const pages = normalizeThai(raw).split("\f");
  if (pages.length > 1 && !pages[pages.length - 1].trim()) pages.pop();
  const first = range ? range[0] : 1;
  // A page needs OCR when it has almost no text, or carries a large picture: scanners and phone apps
  // often add an invisible text layer that is useless for Thai.
  const pictures = imagePages(file, range);
  const scanned = [];
  pages.forEach((p, i) => {
    const t = p.replace(/\s+/g, "");
    const n = first + i;
    if (t.length < SCANNED_PAGE_CHARS || (pictures ? pictures.has(n) : !/[\u0E00-\u0E7F]/.test(t))) scanned.push(n);
  });
  const unverified = [];
  const ocrText = {};
  if (scanned.length && ocr && Ocr.available()) {
    for (let i = 0; i < scanned.length; i += 2) {
      const left = budgetMs - (Date.now() - started);
      const batch = scanned.slice(i, i + 2);
      if (left < 2500) {
        unverified.push(...scanned.slice(i));
        break;
      }
      const out = Ocr.pdfPagesText(file, batch, Math.min(300000, left));
      if (out === null) {
        unverified.push(...batch);
        continue;
      }
      out.split("\f").forEach((t, j) => {
        ocrText[batch[j]] = normalizeThai(t);
      });
    }
  } else unverified.push(...scanned);
  // Detection looks at both the text layer and OCR. The copy given to the agent uses the text layer
  // when it already holds real Thai text, so a noisier OCR duplicate cannot leak what OCR misreads.
  const thaiChars = (t) => (t.match(/[\u0E01-\u0E2E]/g) || []).length;
  const text = pages.map((p, i) => (ocrText[first + i] ? `${p}\n${ocrText[first + i]}` : p)).join("\f");
  const output = pages.map((p, i) => (ocrText[first + i] && thaiChars(p) < 80 ? `${p}\n${ocrText[first + i]}` : p)).join("\f");
  return { text, output, unverified };
}

/** Plain text of a document without OCR, or null when it cannot be read. */
async function extractText(file, range) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return pdfText(file, range);
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  if (ext === ".docx") return Docx.docxText(ab);
  if (ext === ".xlsx") return zipText(ab, "xl/worksheets/sheet", "xl/sharedStrings.xml");
  if (ext === ".pptx") return zipText(ab, "ppt/slides/slide", null);
  let text = buf.toString("utf8");
  if (ext === ".rtf") text = text.replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode((Number(n) + 65536) % 65536)).replace(/\\[a-z]+-?\d* ?|[{}]/gi, "");
  if (/^\.html?$/.test(ext)) text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ");
  return text;
}

/** Existing document files named anywhere in a tool call: quoted strings, words, simple globs. */
function candidatePaths(toolInput, cwd) {
  const strings = [];
  const walk = (v) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(toolInput);
  const tokens = new Set();
  for (let s of strings) {
    // our own safe reader is allowed: `firmalways read <file>` prints a masked copy
    s = s.replace(/\bfirmalways\s+(?:read|check|mask|scan)\s+(?:'[^']*'|"[^"]*"|\S+)/g, " ");
    for (const m of s.matchAll(/'([^'\n]+)'|"([^"\n]+)"/g)) tokens.add(m[1] || m[2]);
    for (const w of s.split(/[\s;|&()<>`=,]+/)) if (w) tokens.add(w.replace(/^['"]+|['"]+$/g, ""));
    if (s.length < 4096 && !s.includes("\n")) tokens.add(s.trim());
    // unquoted paths with spaces, e.g. "## file.pdf: /Users/me/Downloads/My File.pdf" in a prompt
    const ext = `(?:${DOC_EXT.source.replace(/^\\\./, "").replace(/\$$/, "")}|${Ocr.IMAGE_EXT.source.replace(/^\\\./, "").replace(/\$$/, "")})`;
    for (const m of s.matchAll(new RegExp(`(?:~|/)[^\\n'"\`|;&<>]*?\\.${ext}(?![A-Za-z0-9])`, "gi"))) tokens.add(m[0]);
  }
  const base = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
  const found = new Set();
  for (let t of tokens) {
    if (found.size >= MAX_CANDIDATES) break;
    if (!t || t.length > 1024 || !/[./~]/.test(t)) continue;
    t = t.replace(/^file:\/\//, "");
    if (t.startsWith("~/")) t = path.join(os.homedir(), t.slice(2));
    const hasGlob = /[*?[]/.test(t);
    if (!hasGlob && !GUARD_EXT.test(t)) continue;
    const abs = path.resolve(base, t);
    let files = [abs];
    if (hasGlob && fs.globSync) {
      try {
        files = fs.globSync(abs).slice(0, MAX_CANDIDATES);
      } catch (_) {
        files = [];
      }
    }
    for (const f of files) {
      if (!GUARD_EXT.test(f)) continue;
      try {
        const st = fs.statSync(f);
        if (st.isFile() && st.size > 0 && st.size <= MAX_FILE) found.add(f);
      } catch (_) {}
    }
  }
  return [...found];
}

function parseRange(value) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(String(value || ""));
  return m ? [Number(m[1]), Number(m[2] || m[1])] : null;
}

module.exports = { DOC_EXT, GUARD_EXT, extractText, documentText, candidatePaths, parseRange, pdfText };
