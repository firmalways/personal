(function () {
  "use strict";
  const P = globalThis.FirmAlwaysPage;
  const Policy = globalThis.FirmAlwaysPolicy;
  const Vault = globalThis.FirmAlwaysVault;
  const I18n = globalThis.FirmAlwaysI18n;
  const $ = (id) => document.getElementById(id);
  const MAX_FILE = 5 * 1024 * 1024;

  const D = {
    title: ["สแกนเอกสาร", "Scan text"],
    lead: ["วางข้อความหรือเปิดไฟล์ เพื่อดูว่ามีข้อมูลอะไรบ้าง และได้ฉบับที่ซ่อนข้อมูลแล้วไปใช้กับ AI ตัวไหนก็ได้ ไฟล์ไม่ถูกอัปโหลด", "Paste text or open a file to see what it contains and get a masked copy for any AI. Files are not uploaded."],
    inputLabel: ["ข้อความ", "Text"],
    placeholder: ["วางข้อความที่นี่", "Paste text here"],
    openFile: ["เปิดไฟล์ (.txt .md .csv .json .docx)", "Open a file (.txt .md .csv .json .docx)"],
    sample: ["ลองตัวอย่าง", "Try a sample"],
    outTitle: ["ฉบับที่ปลอดภัยสำหรับ AI", "Safe copy for the AI"],
    copy: ["คัดลอก", "Copy"],
    copied: ["คัดลอกแล้ว", "Copied"],
    note: ["ฉบับนี้ใช้ placeholder ใหม่ทุกครั้งที่สแกน และไม่เก็บค่าจริงไว้ จึงไม่คืนค่าในคำตอบของ AI", "This copy uses fresh placeholders and keeps no real values, so they are not restored in AI answers."],
    none: ["ไม่พบข้อมูลส่วนบุคคล", "No personal data found."],
    found: ["พบข้อมูล {n} จุด", "Found {n} item(s)."],
    blocked: ["มีข้อมูลที่ตั้งให้บล็อก: ส่วนนั้นถูกลบออกจากฉบับนี้", "Contains data set to be blocked: those parts are removed from this copy."],
    tooBig: ["ไฟล์ใหญ่เกิน 5 MB", "The file is larger than 5 MB."],
    badFile: ["อ่านไฟล์นี้ไม่ได้: ", "Could not read this file: "],
  };
  const SAMPLE = [
    "เรียนฝ่ายบุคคล",
    "ขอส่งข้อมูลพนักงานใหม่ นางสาวมาลี ใจงาม เลขบัตรประชาชน 1-1017-00230-73-2",
    "โทร 089-765-4321 อีเมล malee@example.co.th วันเกิด 12 มีนาคม 2538",
    "ที่อยู่ 88/9 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400",
    "บัญชีเงินเดือน กสิกร 123-4-56789-0",
  ].join("\n");

  let compiled;
  let l;

  function render() {
    const text = $("input").value;
    const decision = Policy.decide(text, compiled);
    // Blocked parts are redacted here: the point of this page is a copy that is safe to paste anywhere.
    const forCopy = Object.assign({}, decision, {
      entities: decision.entities.map((e) => (e.action === "block" ? Object.assign({}, e, { action: "redact" }) : e)),
    });
    const safe = Policy.protect(text, forCopy, Vault.createVault(), Vault);
    const out = $("output");
    out.innerHTML = "";
    const re = /«[A-Z][A-Z0-9_]*»/g;
    let pos = 0;
    let m;
    while ((m = re.exec(safe))) {
      out.append(document.createTextNode(safe.slice(pos, m.index)), P.el("span", { class: "tok", text: m[0] }));
      pos = m.index + m[0].length;
    }
    out.append(document.createTextNode(safe.slice(pos)));
    out.dataset.text = safe;
    const n = decision.entities.length;
    let verdict = n ? P.pick(D.found, l).replace("{n}", n) : P.pick(D.none, l);
    if (decision.verdict === "block") verdict += " " + P.pick(D.blocked, l);
    $("verdict").textContent = text.trim() ? verdict : "";
    const chips = $("chips");
    chips.innerHTML = "";
    for (const [type, count] of Object.entries(decision.counts)) {
      const blocked = decision.entities.some((e) => e.type === type && e.action === "block");
      chips.append(P.el("span", { class: "chip" + (blocked ? " block" : ""), text: `${I18n.typeName(type, l)} × ${count}` }));
    }
  }

  async function openFile(file) {
    $("error").textContent = "";
    if (file.size > MAX_FILE) {
      $("error").textContent = P.pick(D.tooBig, l);
      return;
    }
    try {
      const text = /\.docx$/i.test(file.name)
        ? await globalThis.FirmAlwaysDocx.docxText(await file.arrayBuffer())
        : await file.text();
      $("input").value = text;
      $("fileInfo").textContent = file.name;
      render();
    } catch (error) {
      $("error").textContent = P.pick(D.badFile, l) + (error.message || error);
    }
  }

  P.load().then((settings) => {
    compiled = Policy.compile(settings);
    l = P.lang(settings);
    P.header("scan.html");
    P.translate(D, l);
    $("input").addEventListener("input", render);
    $("file").addEventListener("change", (e) => e.target.files[0] && openFile(e.target.files[0]));
    $("sample").addEventListener("click", () => {
      $("input").value = SAMPLE;
      render();
    });
    $("copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText($("output").dataset.text || "");
      $("copy").textContent = P.pick(D.copied, l);
      setTimeout(() => ($("copy").textContent = P.pick(D.copy, l)), 1500);
    });
    if (location.hash === "#sample") $("input").value = SAMPLE;
    render();
  });
})();
