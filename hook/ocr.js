/*
 * On-device OCR with macOS Vision (Thai and English), for scanned PDF pages and images.
 * Runs through osascript (JavaScript for Automation), so nothing extra needs installing.
 * Returns null where OCR is not available (other platforms fall back to tesseract if installed).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const JXA = `
ObjC.import("Vision");
ObjC.import("AppKit");
ObjC.import("PDFKit");
function recognize(cg) {
  const req = $.VNRecognizeTextRequest.alloc.init;
  req.recognitionLevel = 0; // accurate
  req.usesLanguageCorrection = true;
  req.recognitionLanguages = $(["th-TH", "en-US"]);
  const handler = $.VNImageRequestHandler.alloc.initWithCGImageOptions(cg, $.NSDictionary.dictionary);
  handler.performRequestsError($([req]), $());
  // Vision reads a table column by column; put the pieces back into rows by their position so a
  // title ("นางสาว") ends up next to the name it belongs to.
  const boxes = [];
  const results = req.results;
  for (let i = 0; i < results.count; i++) {
    const o = results.objectAtIndex(i);
    const c = o.topCandidates(1);
    if (!c.count) continue;
    const b = o.boundingBox;
    boxes.push({ t: ObjC.unwrap(c.objectAtIndex(0).string), x: b.origin.x, y: b.origin.y + b.size.height / 2, h: b.size.height });
  }
  boxes.sort((a, b) => b.y - a.y);
  const rows = [];
  for (const b of boxes) {
    const row = rows.find((r) => Math.abs(r.y - b.y) < Math.max(r.h, b.h) * 0.5);
    if (row) row.items.push(b);
    else rows.push({ y: b.y, h: b.h, items: [b] });
  }
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((b) => b.t).join("  ")).join("\\n");
}
function cgOf(nsimage) {
  return nsimage.CGImageForProposedRectContextHints($(), $(), $());
}
function run(argv) {
  const file = argv[0], kind = argv[1];
  if (kind === "image") {
    const img = $.NSImage.alloc.initWithContentsOfFile(file);
    if (img.isNil()) throw new Error("cannot open image"); // a failure, not "no text"
    return recognize(cgOf(img));
  }
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(file));
  if (doc.isNil()) throw new Error("cannot open PDF");
  const pages = argv[2] ? argv[2].split(",").map(Number) : [];
  const out = [];
  for (const n of pages) {
    if (n < 1 || n > doc.pageCount) continue;
    const page = doc.pageAtIndex(n - 1);
    const box = page.boundsForBox(0);
    const scale = 2200 / Math.max(box.size.width, box.size.height);
    const thumb = page.thumbnailOfSizeForBox($.NSMakeSize(box.size.width * scale, box.size.height * scale), 0);
    out.push("[page " + n + "]\\n" + recognize(cgOf(thumb)));
  }
  return out.join("\\f");
}`;

const IMAGE_EXT = /\.(png|jpe?g|heic|webp|tiff?|bmp|gif)$/i;

function available() {
  return process.platform === "darwin" && fs.existsSync("/usr/bin/osascript");
}

function tesseract() {
  for (const dir of ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]) {
    const f = path.join(dir, "tesseract");
    if (fs.existsSync(f)) return f;
  }
  return null;
}

/** OCR an image file. */
function imageText(file, timeout = 60000) {
  if (available()) {
    try {
      return execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", JXA, file, "image"], { encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    } catch (_) {
      return null;
    }
  }
  const t = tesseract();
  if (!t) return null;
  try {
    return execFileSync(t, [file, "-", "-l", "tha+eng"], { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] });
  } catch (_) {
    return null;
  }
}

/** OCR some pages of a PDF (1-based page numbers). macOS only. */
function pdfPagesText(file, pages, timeout = 300000) {
  if (!available() || !pages.length) return null;
  try {
    return execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", JXA, file, "pdf", pages.join(",")], { encoding: "utf8", timeout, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch (_) {
    return null;
  }
}

module.exports = { IMAGE_EXT, available, imageText, pdfPagesText };
