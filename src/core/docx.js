/* Read the text of a .docx file in the browser, without uploading it.
 * A .docx is a zip; the text is in word/document.xml. Uses the built-in
 * DecompressionStream, so there is no third-party code. */
(function (root) {
  "use strict";

  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Return the bytes of `name` inside a zip, or null. */
  async function readZipEntry(buffer, name) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("not a zip file");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip directory");
      const method = view.getUint16(p + 10, true);
      const size = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const local = view.getUint32(p + 42, true);
      const entry = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      if (entry === name) {
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = bytes.subarray(start, start + size);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        throw new Error("unsupported zip compression");
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  }

  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

  function xmlToText(xml) {
    return xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:(?:br|cr)\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e])
      .replace(/&#(x?)([0-9a-fA-F]+);/g, (_, x, n) => String.fromCodePoint(parseInt(n, x ? 16 : 10)))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function docxText(buffer) {
    const data = await readZipEntry(buffer, "word/document.xml");
    if (!data) throw new Error("word/document.xml not found");
    return xmlToText(new TextDecoder().decode(data));
  }

  const api = { docxText, xmlToText, readZipEntry };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FirmAlwaysDocx = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
