/* Shared helpers for the extension's own pages: language, navigation, settings storage. */
(function (root) {
  "use strict";
  const Policy = root.FirmAlwaysPolicy;

  const STRINGS = {
    navSettings: ["ตั้งค่า", "Settings"],
    navReport: ["รายงาน", "Report"],
    navScan: ["สแกนเอกสาร", "Scan text"],
    navLearn: ["เริ่มต้นใช้งาน", "Get started"],
    navRecommend: ["แนะนำให้องค์กร", "Recommend"],
    saved: ["บันทึกแล้ว", "Saved"],
    footer: ["FirmAlways Personal ฟรี ทำงานในเครื่องของคุณ ไม่ส่งข้อความของคุณไปที่ใด", "FirmAlways Personal is free and runs on your device. Your text is not sent anywhere."],
  };

  async function load() {
    const { settings } = await chrome.storage.local.get("settings");
    return Policy.withDefaults(settings);
  }

  async function save(settings) {
    await chrome.storage.local.set({ settings });
  }

  function lang(settings) {
    return root.FirmAlwaysI18n.lang(settings && settings.lang);
  }

  /** Fill every [data-t] element from `dict` ({key: [th, en]}). */
  function translate(dict, l) {
    const all = Object.assign({}, STRINGS, dict);
    document.documentElement.lang = l;
    document.querySelectorAll("[data-t]").forEach((el) => {
      const pair = all[el.dataset.t];
      if (pair) el.textContent = pair[l === "en" ? 1 : 0];
    });
    document.querySelectorAll("[data-t-placeholder]").forEach((el) => {
      const pair = all[el.dataset.tPlaceholder];
      if (pair) el.placeholder = pair[l === "en" ? 1 : 0];
    });
    const title = all[document.body.dataset.title];
    if (title) document.title = title[l === "en" ? 1 : 0] + " · FirmAlways Personal";
  }

  function header(current) {
    const el = document.getElementById("top");
    if (!el) return;
    const links = [["welcome.html", "navLearn"], ["options.html", "navSettings"], ["report.html", "navReport"], ["scan.html", "navScan"], ["recommend.html", "navRecommend"]];
    el.innerHTML = "";
    const img = document.createElement("img");
    img.src = "../../icons/icon-128.png";
    img.alt = "";
    img.width = 40;
    img.height = 40;
    const brand = document.createElement("span");
    brand.className = "brand";
    brand.textContent = "FirmAlways Personal";
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "FirmAlways Personal");
    for (const [href, key] of links) {
      const a = document.createElement("a");
      a.href = href;
      a.dataset.t = key;
      if (href === current) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }
    el.append(img, brand, nav);
  }

  function pick(pair, l) {
    return pair[l === "en" ? 1 : 0];
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c !== null && c !== undefined) node.append(c);
    return node;
  }

  root.FirmAlwaysPage = { load, save, lang, translate, header, pick, el, STRINGS };
})(globalThis);
