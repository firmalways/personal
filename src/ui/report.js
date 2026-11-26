(function () {
  "use strict";
  const P = globalThis.FirmAlwaysPage;
  const I18n = globalThis.FirmAlwaysI18n;
  const $ = (id) => document.getElementById(id);

  const D = {
    title: ["Personal Privacy Report", "Personal Privacy Report"],
    lead: ["ข้อมูลที่คุณเกือบส่งให้ AI และ FirmAlways ช่วยซ่อนหรือหยุดไว้ นับจากเบราว์เซอร์นี้เท่านั้น", "What you nearly sent to an AI and FirmAlways masked or stopped, counted in this browser only."],
    d7: ["7 วัน", "7 days"],
    d30: ["30 วัน", "30 days"],
    export: ["ดาวน์โหลดรายงาน (JSON)", "Download report (JSON)"],
    checked: ["ข้อความที่ตรวจ", "Messages checked"],
    items: ["ข้อมูลที่ซ่อนหรือหยุดไว้", "Items masked or stopped"],
    blocked: ["ข้อความที่ไม่ได้ส่ง", "Messages not sent"],
    sites: ["เว็บ AI ที่ใช้", "AI sites used"],
    hTypes: ["ประเภทข้อมูลที่พบ", "Data found, by type"],
    hSites: ["แยกตามเว็บ AI", "By AI site"],
    hHistory: ["ประวัติ", "History"],
    historyHelp: ["บันทึกเฉพาะเวลา เว็บ และประเภทข้อมูล ไม่มีข้อความของคุณ", "Time, site and data types only. None of your text."],
    colTime: ["เวลา", "Time"],
    colSite: ["เว็บ", "Site"],
    colOutcome: ["ผล", "Outcome"],
    colTypes: ["ข้อมูล", "Data"],
    empty: ["ยังไม่มีข้อมูลในช่วงนี้", "Nothing in this period yet."],
    masked: ["ซ่อนแล้วส่ง", "Masked"],
    blockedOut: ["ไม่ได้ส่ง", "Not sent"],
    warned: ["ส่งพร้อมแจ้งเตือน", "Sent with warning"],
    paste: ["วาง", "paste"],
    send: ["ส่ง", "send"],
  };

  let l;

  function bars(target, entries, label) {
    target.innerHTML = "";
    if (!entries.length) {
      target.append(P.el("p", { class: "empty", text: P.pick(D.empty, l) }));
      return;
    }
    const max = Math.max(...entries.map(([, n]) => n));
    for (const [k, n] of entries) {
      const i = P.el("i", { style: `width:${Math.max(2, Math.round((n / max) * 100))}%` });
      target.append(P.el("div", { class: "bar" }, P.el("span", { text: label(k) }), P.el("span", {}, i), P.el("b", { text: String(n) })));
    }
  }

  async function render() {
    const settings = await P.load();
    l = P.lang(settings);
    P.header("report.html");
    P.translate(D, l);
    const period = Number(document.querySelector('input[name="period"]:checked').value);
    const { stats = { days: {} }, history = [] } = await chrome.storage.local.get(["stats", "history"]);
    const since = new Date(Date.now() - (period - 1) * 86400000);
    const sinceKey = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    const total = { checked: 0, items: 0, blocked: 0, byType: {}, bySite: {} };
    for (const [day, d] of Object.entries(stats.days)) {
      if (day < sinceKey) continue;
      total.checked += d.checked;
      total.items += d.items;
      total.blocked += d.blocked;
      for (const [t, n] of Object.entries(d.byType)) total.byType[t] = (total.byType[t] || 0) + n;
      for (const [s, n] of Object.entries(d.bySite)) total.bySite[s] = (total.bySite[s] || 0) + n;
    }
    $("sChecked").textContent = total.checked.toLocaleString();
    $("sItems").textContent = total.items.toLocaleString();
    $("sBlocked").textContent = total.blocked.toLocaleString();
    $("sSites").textContent = String(Object.keys(total.bySite).length);
    const sort = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    bars($("types"), sort(total.byType), (t) => I18n.typeName(t, l));
    bars($("bySite"), sort(total.bySite), (s) => s);

    const tbody = $("history");
    tbody.innerHTML = "";
    const cutoff = since.setHours(0, 0, 0, 0);
    const rows = history.filter((h) => h.t >= cutoff).slice(0, 200);
    if (!rows.length) tbody.append(P.el("tr", {}, P.el("td", { colspan: "4", class: "empty", text: P.pick(D.empty, l) })));
    const fmt = new Intl.DateTimeFormat(l === "en" ? "en-GB" : "th-TH", { dateStyle: "medium", timeStyle: "short" });
    for (const h of rows) {
      const outcome = h.outcome === "blocked" ? D.blockedOut : h.outcome === "masked" ? D.masked : D.warned;
      const chips = P.el("td", {});
      for (const [t, n] of Object.entries(h.counts || {})) {
        chips.append(P.el("span", { class: "chip" + (h.outcome === "blocked" ? " block" : h.outcome === "warned" ? " warn" : ""), text: `${I18n.typeName(t, l)} × ${n}` }));
      }
      tbody.append(
        P.el("tr", {},
          P.el("td", { text: fmt.format(new Date(h.t)) }),
          P.el("td", { text: `${h.host} · ${P.pick(D[h.source] || D.send, l)}` }),
          P.el("td", { text: P.pick(outcome, l) }),
          chips)
      );
    }
    $("export").onclick = () => {
      const blob = new Blob([JSON.stringify({ generated: new Date().toISOString(), periodDays: period, summary: total, history: rows }, null, 2)], { type: "application/json" });
      const a = P.el("a", { href: URL.createObjectURL(blob), download: `firmalways-privacy-report-${period}d.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }

  document.querySelectorAll('input[name="period"]').forEach((r) => r.addEventListener("change", render));
  render();
})();
