(function () {
  "use strict";
  const P = globalThis.FirmAlwaysPage;
  const $ = (id) => document.getElementById(id);

  const D = {
    on: ["กำลังปกป้อง {site}", "Protecting {site}"],
    off: ["ไม่ได้ปกป้องหน้านี้", "This page is not protected"],
    offAll: ["ปิดการป้องกันอยู่ เปิดได้ในหน้าตั้งค่า", "Protection is off. Turn it on in Settings."],
    protectSite: ["ปกป้องเว็บนี้", "Protect this site"],
    checked: ["ตรวจวันนี้", "Checked today"],
    items: ["ข้อมูลที่ซ่อน", "Items masked"],
    blocked: ["ไม่ได้ส่ง", "Not sent"],
    mirror: ["Privacy Mirror: สิ่งที่ AI ได้รับล่าสุด", "Privacy Mirror: what the AI got last"],
    noMirror: ["ยังไม่มีข้อความที่ซ่อนข้อมูลในรอบนี้", "Nothing masked in this browser session yet."],
    report: ["รายงาน", "Report"],
    settings: ["ตั้งค่า", "Settings"],
    scan: ["สแกนเอกสาร", "Scan text"],
    forget: ["ล้างค่าจริง", "Forget values"],
    forgotten: ["ล้างแล้ว", "Forgotten"],
  };

  async function main() {
    const settings = await P.load();
    const l = P.lang(settings);
    P.translate(D, l);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let host = "";
    try {
      host = new URL(tab.url).host;
    } catch (_) {}
    const known = host in settings.sites;
    const on = settings.enabled && known && settings.sites[host] !== false;
    $("status").textContent = !settings.enabled ? P.pick(D.offAll, l) : on ? P.pick(D.on, l).replace("{site}", host) : P.pick(D.off, l);
    $("status").classList.toggle("off", !on);
    $("siteLabel").textContent = P.pick(D.protectSite, l) + (host ? ` (${host})` : "");
    $("siteToggle").checked = on;
    $("siteToggle").disabled = !settings.enabled;
    $("siteToggle").closest("label").classList.toggle("hidden", !known);
    $("siteToggle").onchange = async (e) => {
      settings.sites[host] = e.target.checked;
      await P.save(settings);
      main();
    };

    const { stats = { days: {} } } = await chrome.storage.local.get("stats");
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = stats.days[key] || { checked: 0, items: 0, blocked: 0 };
    $("checked").textContent = today.checked;
    $("items").textContent = today.items;
    $("blocked").textContent = today.blocked;

    const { mirror } = await chrome.storage.session.get("mirror");
    $("mirror").textContent = mirror ? mirror.sent : P.pick(D.noMirror, l);
    $("forget").onclick = () =>
      chrome.runtime.sendMessage({ type: "forget", all: true }, () => {
        $("forget").textContent = P.pick(D.forgotten, l);
        $("mirror").textContent = P.pick(D.noMirror, l);
      });
  }
  main();
})();
