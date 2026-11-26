const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const docx = require("../src/core/docx.js");

/** Build a minimal zip holding one deflated file (enough for a .docx reader). */
function zip(name, content) {
  const data = zlib.deflateRawSync(Buffer.from(content, "utf8"));
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20);
  central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + n.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + n.length, 12); end.writeUInt32LE(cdOffset, 16);
  const buf = Buffer.concat([local, n, data, central, n, end]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

test("reads paragraphs, tabs and entities from word/document.xml", async () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>นายสมชาย &amp; ทีม</w:t></w:r></w:p>' +
    "<w:p><w:r><w:t>โทร</w:t><w:tab/><w:t>081-234-5678</w:t></w:r></w:p></w:body></w:document>";
  assert.equal(await docx.docxText(zip("word/document.xml", xml)), "นายสมชาย & ทีม\nโทร\t081-234-5678");
});

test("a zip without a document is rejected", async () => {
  await assert.rejects(docx.docxText(zip("other.txt", "x")), /not found/);
});
