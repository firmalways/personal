(function () {
  "use strict";
  const P = globalThis.FirmAlwaysPage;
  const Policy = globalThis.FirmAlwaysPolicy;
  const I18n = globalThis.FirmAlwaysI18n;
  const $ = (id) => document.getElementById(id);

  const D = {
    title: ["ตั้งค่า", "Settings"],
    lead: ["ทุกการตั้งค่าใช้ได้ฟรี และเก็บไว้ในเบราว์เซอร์นี้เท่านั้น", "Every setting is free and stays in this browser."],
    hProtect: ["การป้องกัน", "Protection"],
    enabled: ["เปิดการป้องกัน", "Protection on"],
    enabledHelp: ["ตรวจข้อความก่อนวางและก่อนส่งในเว็บ AI ที่เลือกไว้", "Check text before pasting and sending on the AI sites you choose."],
    mode: ["โหมด", "Mode"],
    basicMode: ["Basic", "Basic"],
    advancedMode: ["Advanced", "Advanced"],
    hBasic: ["Basic Mode", "Basic mode"],
    basicHelp: ["เปิดหรือปิดเป็นกลุ่ม ค่าเริ่มต้นเหมาะกับคนส่วนใหญ่", "Turn whole groups on or off. The defaults suit most people."],
    bPersonal: ["ปกป้องข้อมูลส่วนบุคคล", "Protect personal data"],
    bPersonalHelp: ["ชื่อ เบอร์โทร อีเมล เลขบัตรประชาชน บัญชี ที่อยู่ วันเกิด ฯลฯ", "Names, phones, email, ID numbers, accounts, addresses, birth dates and more."],
    bSensitive: ["ปกป้องข้อมูลอ่อนไหว (PDPA มาตรา 26)", "Protect sensitive data (PDPA s.26)"],
    bSensitiveHelp: ["สุขภาพ ศาสนา ประวัติอาชญากรรม ความพิการ ข้อมูลชีวภาพ เมื่ออยู่คู่กับตัวบุคคล", "Health, religion, criminal records, disability, biometrics, when tied to a person."],
    bSecrets: ["ปกป้องรหัสผ่านและ API key", "Protect passwords and API keys"],
    bSecretsHelp: ["รหัสผ่าน key token และค่าลับอื่น ๆ จะไม่ถูกส่ง", "Passwords, keys, tokens and other secrets are not sent."],
    bAutoMask: ["ซ่อนข้อมูลอัตโนมัติ", "Mask automatically"],
    bAutoMaskHelp: ["ปิดไว้ถ้าอยากเห็น Privacy Mirror และเลือกเองทุกครั้ง", "Turn off to see the Privacy Mirror and choose each time."],
    hAdvanced: ["Advanced Mode", "Advanced mode"],
    advancedHelp: ["เลือกการทำงานกับข้อมูลแต่ละประเภท ค่า \"ตาม Policy Pack\" ใช้ค่าจากชุดนโยบายที่เปิดไว้", "Choose what happens to each kind of data. \"Policy pack\" uses the packs you turned on."],
    colType: ["ประเภทข้อมูล", "Data type"],
    colAction: ["การทำงาน", "Action"],
    hBehaviour: ["พฤติกรรม", "Behaviour"],
    askBefore: ["ถามก่อนส่งทุกครั้งที่พบข้อมูล", "Ask before every send that has data"],
    askBeforeHelp: ["แสดง Privacy Mirror ให้เลือกส่งแบบซ่อนข้อมูลหรือข้อความเดิม", "Shows the Privacy Mirror so you choose masked or original."],
    autoSend: ["ส่งต่ออัตโนมัติหลังซ่อนข้อมูล", "Send automatically after masking"],
    autoSendHelp: ["ปิดไว้ถ้าอยากตรวจข้อความที่ซ่อนแล้วก่อนกดส่งเอง", "Turn off to review the masked text and press send yourself."],
    linked: ["ข้อมูลอ่อนไหวต้องอยู่คู่กับตัวบุคคล", "Sensitive data only when tied to a person"],
    linkedHelp: ["ปิดไว้เพื่อตรวจคำอย่าง \"มะเร็ง\" แม้ไม่มีชื่อหรือเลขบัตร (เข้มงวดขึ้น)", "Turn off to flag words like \"cancer\" even without a name or ID (stricter)."],
    restore: ["แสดงค่าจริงในคำตอบของ AI", "Show real values in AI answers"],
    restoreHelp: ["แทน «PHONE_1» ด้วยค่าจริงบนหน้าจอคุณเท่านั้น", "Replaces «PHONE_1» with the real value on your screen only."],
    notify: ["แจ้งเตือนทุกครั้งที่ซ่อนหรือบล็อก", "Notify on every mask or block"],
    notifyHelp: ["การบล็อกจะแจ้งเตือนเสมอ", "Blocks are always shown."],
    hPacks: ["Policy Library", "Policy library"],
    packsHelp: ["ชุดนโยบายสาธารณะ เปิดได้หลายชุด ถ้าซ้อนกันจะใช้ข้อที่เข้มงวดที่สุด", "Public policy packs. Turn on several; where they overlap the strictest wins."],
    hKeywords: ["คำที่ต้องการปกป้อง", "Your keywords"],
    keywordsHelp: ["เช่น ชื่อโปรเจกต์ ชื่อลูกค้ารายใหญ่ หรือชื่อสินค้าที่ยังไม่เปิดตัว", "For example project names, key customers or unreleased products."],
    kwLabel: ["คำ", "Keyword"],
    kwPlaceholder: ["เช่น Project Phoenix", "e.g. Project Phoenix"],
    add: ["เพิ่ม", "Add"],
    remove: ["ลบ", "Remove"],
    hRules: ["กฎของคุณ", "Your rules"],
    rulesHelp: ["รูปแบบข้อความแบบ Regular Expression เช่น รหัสพนักงาน EMP-[0-9]{5}", "Regular expressions, for example employee IDs: EMP-[0-9]{5}"],
    ruleNamePh: ["ชื่อกฎ เช่น รหัสพนักงาน", "Rule name, e.g. employee id"],
    rulePatternPh: ["รูปแบบ เช่น EMP-[0-9]{5}", "Pattern, e.g. EMP-[0-9]{5}"],
    hSites: ["เว็บ AI ที่ป้องกัน", "Protected AI sites"],
    sitesHelp: ["FirmAlways Personal ทำงานเฉพาะเว็บเหล่านี้", "FirmAlways Personal works only on these sites."],
    hPrivacy: ["ความเป็นส่วนตัวของรายงาน", "Report privacy"],
    privacyHelp: ["รายงานเก็บเฉพาะจำนวนและประเภทข้อมูล ไม่เก็บข้อความของคุณ ค่าจริงที่ซ่อนไว้อยู่ในหน่วยความจำและหายไปเมื่อปิดเบราว์เซอร์", "The report keeps counts and data types only, never your text. Masked real values live in memory and are gone when the browser closes."],
    retention: ["เก็บประวัติ", "Keep history for"],
    days: ["วัน", "days"],
    forget: ["ล้างค่าจริงที่จำไว้ตอนนี้", "Forget masked values now"],
    clearHistory: ["ลบประวัติและรายงาน", "Delete history and report"],
    language: ["ภาษา", "Language"],
    forgotten: ["ล้างค่าจริงแล้ว คำตอบเก่าจะแสดงเป็น «PLACEHOLDER»", "Forgotten. Old answers will show «PLACEHOLDER»."],
    cleared: ["ลบประวัติแล้ว", "History deleted"],
    packDefault: ["ตาม Policy Pack", "Policy pack"],
    confirmClear: ["ลบประวัติและรายงานทั้งหมดในเบราว์เซอร์นี้? ย้อนกลับไม่ได้", "Delete all history and report data in this browser? This cannot be undone."],
  };

  let s;
  let l;

  function actionSelect(value, withDefault, defaultLabel) {
    const sel = P.el("select", {});
    if (withDefault) sel.append(P.el("option", { value: "", text: defaultLabel }));
    for (const a of Policy.ACTIONS) sel.append(P.el("option", { value: a, text: I18n.t("actions." + a, l) }));
    sel.value = value || "";
    return sel;
  }

  async function commit(message) {
    await P.save(s);
    $("saved").textContent = message || P.pick(P.STRINGS.saved, l);
    clearTimeout(commit.timer);
    commit.timer = setTimeout(() => ($("saved").textContent = ""), 2500);
  }

  function packActions() {
    return Policy.compile(Object.assign({}, s, { mode: "advanced", actions: {}, keywords: [], rules: [] })).actions;
  }

  function render() {
    l = P.lang(s);
    P.header("options.html");
    P.translate(D, l);
    $("enabled").checked = s.enabled;
    document.querySelectorAll('input[name="mode"]').forEach((r) => (r.checked = r.value === s.mode));
    $("basic").classList.toggle("hidden", s.mode !== "basic");
    $("advanced").classList.toggle("hidden", s.mode !== "advanced");
    document.querySelectorAll("[data-basic]").forEach((c) => (c.checked = !!s.basic[c.dataset.basic]));
    document.querySelectorAll("[data-flag]").forEach((c) => (c.checked = !!s[c.dataset.flag]));

    const fromPacks = packActions();
    const tbody = $("types");
    tbody.innerHTML = "";
    for (const type of [...Policy.PERSONAL_TYPES, ...Policy.SENSITIVE_TYPES, ...Policy.SECRET_TYPES]) {
      const def = fromPacks[type] || "allow";
      const sel = actionSelect(s.actions[type], true, `${P.pick(D.packDefault, l)}: ${I18n.t("actions." + def, l)}`);
      sel.setAttribute("aria-label", I18n.typeName(type, l));
      sel.addEventListener("change", () => {
        if (sel.value) s.actions[type] = sel.value;
        else delete s.actions[type];
        commit();
      });
      tbody.append(P.el("tr", {}, P.el("td", { text: I18n.typeName(type, l) }), P.el("td", {}, sel)));
    }

    const packs = $("packs");
    packs.innerHTML = "";
    for (const pack of Policy.PACKS) {
      const box = P.el("input", { type: "checkbox", id: "pack-" + pack.id });
      box.checked = s.packs.includes(pack.id);
      box.addEventListener("change", () => {
        s.packs = box.checked ? [...new Set([...s.packs, pack.id])] : s.packs.filter((p) => p !== pack.id);
        commit().then(render);
      });
      const info = P.el(
        "label",
        { for: box.id },
        P.el("b", { text: P.pick([pack.name.th, pack.name.en], l) }),
        P.el("span", { class: "meta", text: `  v${pack.version} · ${pack.jurisdiction}` }),
        P.el("p", { text: P.pick([pack.description.th, pack.description.en], l), style: "margin:2px 0" }),
        P.el("span", { class: "meta", text: [...pack.legal_reference, ...pack.related_controls].join(" · ") }),
        pack.note ? P.el("p", { class: "meta", text: P.pick([pack.note.th, pack.note.en], l), style: "margin:2px 0 0" }) : null
      );
      packs.append(P.el("div", { class: "pack" }, box, info));
    }

    const kw = $("keywords");
    kw.innerHTML = "";
    s.keywords.forEach((k, i) => {
      const sel = actionSelect(k.action || "mask");
      sel.addEventListener("change", () => {
        k.action = sel.value;
        commit();
      });
      kw.append(
        P.el("div", { class: "row", style: "padding:6px 0;border-top:1px solid var(--line)" },
          P.el("span", { text: k.text, style: "flex:1 1 200px" }), sel,
          P.el("button", { type: "button", text: P.pick(D.remove, l), onclick: () => { s.keywords.splice(i, 1); commit().then(render); } }))
      );
    });
    $("kwAction").replaceChildren(...actionSelect("mask").children);
    $("kwAction").value = "mask";

    const rules = $("rules");
    rules.innerHTML = "";
    s.rules.forEach((r, i) => {
      rules.append(
        P.el("div", { class: "row", style: "padding:6px 0;border-top:1px solid var(--line)" },
          P.el("b", { text: r.name, style: "flex:0 1 160px" }), P.el("code", { text: r.pattern, style: "flex:1 1 200px;word-break:break-all" }),
          P.el("span", { class: "chip", text: I18n.t("actions." + r.action, l) }),
          P.el("button", { type: "button", text: P.pick(D.remove, l), onclick: () => { s.rules.splice(i, 1); commit().then(render); } }))
      );
    });
    $("ruleAction").replaceChildren(...actionSelect("mask").children);
    $("ruleAction").value = "mask";

    const sites = $("sites");
    sites.innerHTML = "";
    for (const site of Object.keys(s.sites)) {
      const box = P.el("input", { type: "checkbox" });
      box.checked = s.sites[site] !== false;
      box.addEventListener("change", () => {
        s.sites[site] = box.checked;
        commit();
      });
      sites.append(P.el("label", { class: "switch", style: "border:0" }, box, P.el("span", { text: site })));
    }
    $("retention").value = String(s.retentionDays);
    $("lang").value = s.lang;
  }

  function wire() {
    $("enabled").addEventListener("change", (e) => { s.enabled = e.target.checked; commit(); });
    document.querySelectorAll('input[name="mode"]').forEach((r) =>
      r.addEventListener("change", () => { s.mode = r.value; commit().then(render); })
    );
    document.querySelectorAll("[data-basic]").forEach((c) =>
      c.addEventListener("change", () => { s.basic[c.dataset.basic] = c.checked; commit(); })
    );
    document.querySelectorAll("[data-flag]").forEach((c) =>
      c.addEventListener("change", () => { s[c.dataset.flag] = c.checked; commit(); })
    );
    $("kwForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = $("kwText").value.trim();
      if (!text) return;
      s.keywords.push({ text, action: $("kwAction").value });
      $("kwText").value = "";
      commit().then(render);
    });
    $("ruleForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("ruleName").value.trim() || "rule";
      const pattern = $("rulePattern").value;
      const error = Policy.ruleError(pattern);
      $("ruleError").textContent = error || "";
      if (error) return;
      s.rules.push({ name, pattern, action: $("ruleAction").value });
      $("ruleName").value = "";
      $("rulePattern").value = "";
      commit().then(render);
    });
    $("retention").addEventListener("change", (e) => { s.retentionDays = Number(e.target.value); commit(); });
    $("lang").addEventListener("change", (e) => { s.lang = e.target.value; commit().then(render); });
    $("forget").addEventListener("click", () =>
      chrome.runtime.sendMessage({ type: "forget", all: true }, () => commit(P.pick(D.forgotten, l)))
    );
    $("clearHistory").addEventListener("click", async () => {
      if (!confirm(P.pick(D.confirmClear, l))) return;
      await chrome.storage.local.remove(["stats", "history"]);
      commit(P.pick(D.cleared, l));
    });
  }

  P.load().then((settings) => {
    s = settings;
    wire();
    render();
  });
})();
