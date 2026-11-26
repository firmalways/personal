/* FirmAlways Personal on AI chat sites.
 *
 * Before a message leaves the page (pasting, pressing Enter or clicking Send),
 * the text is checked on this device. Personal data is replaced with
 * placeholders such as «PHONE_1», data set to be blocked is not sent, and the
 * Privacy Mirror shows exactly what the AI receives. Placeholders in the AI's
 * answer are shown with the real values, for you only; editable fields are
 * never touched, so what you send stays masked.
 *
 * Not covered: files and images you upload, voice input, and apps outside the browser.
 */
(function () {
  "use strict";
  if (window.__firmalwaysPersonal) return;
  window.__firmalwaysPersonal = true;

  const Policy = globalThis.FirmAlwaysPolicy;
  const Vault = globalThis.FirmAlwaysVault;
  const I18n = globalThis.FirmAlwaysI18n;
  const MAX_TEXT = 200000;
  const host = location.host;

  let compiled = Policy.compile({});
  let vault = Vault.createVault();
  let lang = I18n.lang("auto");
  let bypassText = null; // text the user already approved (sent as is)
  let syntheticPaste = false; // our own paste event, used to insert text into rich editors

  const t = (key, vars) => I18n.t(key, lang, vars);
  const types = (counts) => I18n.typeList(counts, lang);
  const active = () => compiled.settings.enabled && compiled.settings.sites[host] !== false;

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(Object.assign({ host }, message), (reply) => {
          resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : reply || { ok: false });
        });
      } catch (error) {
        resolve({ ok: false, error: String(error) }); // the extension was updated or removed
      }
    });
  }

  async function refresh() {
    const state = await send({ type: "state" });
    if (!state.ok) return;
    compiled = Policy.compile(state.settings);
    lang = I18n.lang(compiled.settings.lang);
    vault.byToken = state.byToken || {};
    restoreAll();
  }

  // ---- editors ---------------------------------------------------------------------------
  const COMPOSERS = [
    "#prompt-textarea",
    'div.ProseMirror[contenteditable="true"]',
    'rich-textarea [contenteditable="true"]',
    "textarea#userInput",
    "textarea#chat-input",
    'div[contenteditable="true"][role="textbox"]',
    "textarea",
    '[contenteditable="true"]',
  ];
  const SEND_BUTTONS = [
    '[data-testid="send-button"]',
    "#composer-submit-button",
    '[data-testid="submit-button"]',
    "button.send-button",
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button[aria-label*="ส่ง"]',
    '[role="button"][aria-label*="Send" i]',
  ];

  function inOurUi(node) {
    return !!(node && node.getRootNode && node.getRootNode() === shadow);
  }

  function editableRoot(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || inOurUi(el)) return null;
    if (el.closest("textarea, input")) return el.closest("textarea, input");
    if (!el.isContentEditable) return null;
    while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement;
    return el;
  }

  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findComposer() {
    const focused = editableRoot(document.activeElement);
    if (focused) return focused;
    for (const sel of COMPOSERS) {
      const el = [...document.querySelectorAll(sel)].find((e) => visible(e) && !inOurUi(e));
      if (el) return editableRoot(el) || el;
    }
    return null;
  }

  function findSendButton() {
    for (const sel of SEND_BUTTONS) {
      const el = [...document.querySelectorAll(sel)].find((e) => visible(e) && !e.disabled);
      if (el) return el;
    }
    return null;
  }

  function isSendButton(el) {
    if (!el || inOurUi(el)) return false;
    const label = (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("data-testid") || "");
    if (/stop|หยุด|voice|เสียง|attach|แนบ/i.test(label)) return false;
    if (SEND_BUTTONS.some((sel) => el.matches(sel))) return true;
    const form = el.closest("form");
    return !!(el.matches('button[type="submit"]') && form && form.querySelector('textarea, [contenteditable="true"]'));
  }

  function getText(el) {
    if (!el) return "";
    if ("value" in el && el.tagName !== "DIV") return el.value;
    return (el.innerText || "").replace(/\n$/, "");
  }

  function selectAll(el) {
    el.focus();
    if ("value" in el && el.tagName !== "DIV") {
      el.select();
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Insert `text` at the cursor the way the site expects: a paste event first (rich editors), then insertText. */
  function insertAtCursor(el, text) {
    el.focus();
    if (!("value" in el && el.tagName !== "DIV")) {
      try {
        const data = new DataTransfer();
        data.setData("text/plain", text);
        syntheticPaste = true;
        const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
        el.dispatchEvent(event);
        syntheticPaste = false;
        if (event.defaultPrevented) return;
      } catch (_) {
        syntheticPaste = false;
      }
    }
    if (document.execCommand && document.execCommand("insertText", false, text)) return;
    if ("value" in el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
      setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
  }

  function replaceText(el, text) {
    selectAll(el);
    insertAtCursor(el, text);
  }

  function resend(trigger, composer, text) {
    bypassText = text;
    setTimeout(() => {
      const btn = trigger && trigger.btn && trigger.btn.isConnected ? trigger.btn : findSendButton();
      if (btn && !btn.disabled) btn.click();
      else composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }));
      setTimeout(() => {
        if (composer.isConnected && getText(composer).trim() === text.trim()) toast(t("maskedPressSend"), "info");
      }, 1500);
    }, 60);
  }

  // ---- checking ----------------------------------------------------------------------------
  function check(text) {
    if (text.length > MAX_TEXT) return { verdict: "toolong", entities: [], counts: {} };
    return Policy.decide(text, compiled);
  }

  async function protect(text, decision) {
    const reply = await send({ type: "protect", text, entities: decision.entities });
    if (!reply.ok) return null;
    vault.byToken = reply.byToken || vault.byToken;
    return reply.sent;
  }

  function record(source, outcome, counts, sent) {
    send({ type: "record", event: { host, source, outcome, counts, sent } });
  }

  /** Handle a message about to be sent (source "send") or pasted (source "paste"). */
  async function handle(source, text, decision, composer, trigger) {
    const blockedCounts = {};
    for (const e of decision.entities) if (e.action === "block") blockedCounts[e.type] = (blockedCounts[e.type] || 0) + 1;

    if (decision.verdict === "toolong") {
      toast(t("tooLong"), "block");
      return;
    }
    if (decision.verdict === "block") {
      record(source, "blocked", decision.counts);
      toast(t(source === "paste" ? "blockedPaste" : "blocked", { types: types(blockedCounts) }), "block", {
        label: t("showMirror"),
        run: () => mirror({ mode: "block", text, decision }),
      });
      return;
    }
    const sent = await protect(text, decision);
    if (sent === null) {
      toast(t("blocked", { types: "FirmAlways" }), "block"); // fail closed: the extension could not protect the text
      return;
    }
    const finish = (choice) => {
      if (choice === "cancel") return;
      const out = choice === "original" ? text : sent;
      record(source, choice === "original" ? "warned" : "masked", decision.counts, out);
      if (source === "paste") insertAtCursor(composer, out);
      else {
        if (choice === "original") bypassText = text;
        else replaceText(composer, out);
        if (compiled.settings.autoSend || choice === "original") resend(trigger, composer, out);
        else toast(t("maskedPressSend"), "info");
      }
      if (choice !== "original" && compiled.settings.notifications) {
        const n = decision.entities.length;
        toast(t(source === "paste" ? "maskedPaste" : "masked", { n }), "info", {
          label: t("showMirror"),
          run: () => mirror({ mode: "info", text, sent: out, decision }),
        });
      }
    };
    if (decision.verdict === "ask") mirror({ mode: "ask", text, sent, decision, done: finish });
    else finish("masked");
  }

  function onPaste(event) {
    if (syntheticPaste || !active()) return;
    const composer = editableRoot(event.target);
    if (!composer) return;
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (!text) return;
    const decision = check(text);
    if (decision.verdict === "pass") return;
    if (decision.verdict === "warn") {
      record("paste", "warned", decision.counts);
      if (compiled.settings.notifications) toast(t("warned", { types: types(decision.counts) }), "warn");
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    handle("paste", text, decision, composer, null);
  }

  function beforeSend(event, composer, trigger) {
    if (!active() || !composer) return;
    const text = getText(composer);
    if (!text.trim()) return;
    if (bypassText !== null && text.trim() === bypassText.trim()) {
      bypassText = null;
      return;
    }
    const decision = check(text);
    if (decision.verdict === "pass") {
      record("send", "clean", {});
      return;
    }
    if (decision.verdict === "warn") {
      record("send", "warned", decision.counts);
      if (compiled.settings.notifications) toast(t("warned", { types: types(decision.counts) }), "warn");
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    handle("send", text, decision, composer, trigger);
  }

  function onKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing || event.keyCode === 229) return;
    const composer = editableRoot(event.target);
    if (!composer || composer.tagName === "INPUT") return;
    beforeSend(event, composer, { kind: "enter" });
  }

  function onClick(event) {
    const btn = event.target && event.target.closest && event.target.closest('button, [role="button"]');
    if (!isSendButton(btn)) return;
    const form = btn.closest("form");
    const composer = (form && editableRoot(form.querySelector('textarea, [contenteditable="true"]'))) || findComposer();
    beforeSend(event, composer, { kind: "click", btn });
  }

  window.addEventListener("paste", onPaste, true);
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("click", onClick, true);

  // ---- showing real values in answers -----------------------------------------------------
  function restoreNode(node) {
    if (node.nodeType === 3) {
      if (!editableRoot(node.parentElement) && node.nodeValue.length > 3) {
        const restored = Vault.restore(node.nodeValue, vault);
        if (restored !== node.nodeValue) node.nodeValue = restored;
      }
      return;
    }
    if (node.nodeType !== 1 || inOurUi(node) || node === uiHost || editableRoot(node)) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(restoreNode);
  }

  function canRestore() {
    return active() && compiled.settings.restoreAnswers && Vault.size(vault) > 0;
  }

  function restoreAll() {
    if (canRestore() && document.body) restoreNode(document.body);
  }

  new MutationObserver((mutations) => {
    if (!canRestore()) return;
    for (const m of mutations) {
      if (m.type === "characterData") restoreNode(m.target);
      m.addedNodes.forEach(restoreNode);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && refresh());
  chrome.storage.onChanged.addListener((changes, area) => area === "local" && changes.settings && refresh());

  // ---- toasts and the Privacy Mirror ------------------------------------------------------
  let uiHost = null;
  let shadow = null;
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "IBM Plex Sans Thai", system-ui, -apple-system, "Segoe UI", sans-serif; }
    .toasts { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: grid; gap: 8px; max-width: 380px; }
    .toast { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 10px; font-size: 14px; line-height: 1.45;
      color: #fff; background: #4f46e5; box-shadow: 0 8px 24px rgba(15, 23, 42, .25); }
    .toast.block { background: #b42318; } .toast.warn { background: #b54708; }
    .toast button { margin-left: auto; flex: none; border: 1px solid rgba(255,255,255,.6); background: transparent; color: #fff;
      border-radius: 6px; padding: 4px 8px; font-size: 13px; cursor: pointer; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483647; background: rgba(15, 23, 42, .45); display: grid; place-items: center; padding: 16px; }
    .dialog { width: min(760px, 100%); max-height: 90vh; overflow: auto; background: #fff; color: #18181b; border-radius: 14px;
      padding: 20px; box-shadow: 0 24px 64px rgba(15, 23, 42, .35); }
    h2 { margin: 0 0 4px; font-size: 18px; } p { margin: 0 0 12px; color: #52525b; font-size: 14px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .cols { grid-template-columns: 1fr; } }
    .col h3 { margin: 0 0 6px; font-size: 13px; color: #52525b; font-weight: 600; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: 13px/1.6 inherit; background: #f4f4f5; border-radius: 8px;
      padding: 10px; max-height: 260px; overflow: auto; }
    mark { border-radius: 4px; padding: 0 2px; background: #dbeafe; color: #1e3a8a; }
    mark.block { background: #fee2e2; color: #991b1b; } mark.warn { background: #fef3c7; color: #92400e; }
    .tok { color: #4338ca; font-weight: 600; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
    .chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; }
    .chip.block { background: #fee2e2; color: #991b1b; }
    .note { font-size: 12px; color: #71717a; }
    .row { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-top: 16px; }
    .row button { border-radius: 8px; padding: 8px 14px; font-size: 14px; cursor: pointer; border: 1px solid #d4d4d8; background: #fff; color: #18181b; }
    .row button.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
    button:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; }
  `;

  function ui() {
    if (shadow) return shadow;
    uiHost = document.createElement("firmalways-personal");
    shadow = uiHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    const toasts = document.createElement("div");
    toasts.className = "toasts";
    toasts.setAttribute("role", "status");
    shadow.append(style, toasts);
    document.documentElement.appendChild(uiHost);
    return shadow;
  }

  function toast(message, kind, action) {
    const root = ui();
    const el = document.createElement("div");
    el.className = "toast " + (kind || "info");
    el.setAttribute("data-kind", kind || "info");
    const span = document.createElement("span");
    span.textContent = message;
    el.appendChild(span);
    if (action) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.addEventListener("click", () => {
        el.remove();
        action.run();
      });
      el.appendChild(b);
    }
    root.querySelector(".toasts").appendChild(el);
    setTimeout(() => el.remove(), action ? 9000 : 5000);
  }

  function highlighted(text, entities) {
    const pre = document.createElement("pre");
    let pos = 0;
    for (const e of entities) {
      pre.appendChild(document.createTextNode(text.slice(pos, e.start)));
      const m = document.createElement("mark");
      m.className = e.action === "block" ? "block" : e.action === "warn" ? "warn" : "";
      m.title = I18n.typeName(e.type, lang) + " · " + t("actions." + e.action);
      m.textContent = text.slice(e.start, e.end);
      pre.appendChild(m);
      pos = e.end;
    }
    pre.appendChild(document.createTextNode(text.slice(pos)));
    return pre;
  }

  function withTokens(text) {
    const pre = document.createElement("pre");
    const re = /«[A-Z][A-Z0-9_]*»/g;
    let pos = 0;
    let m;
    while ((m = re.exec(text))) {
      pre.appendChild(document.createTextNode(text.slice(pos, m.index)));
      const s = document.createElement("span");
      s.className = "tok";
      s.textContent = m[0];
      pre.appendChild(s);
      pos = m.index + m[0].length;
    }
    pre.appendChild(document.createTextNode(text.slice(pos)));
    return pre;
  }

  /** Privacy Mirror: your text next to what the AI gets. mode: "ask" | "block" | "info". */
  function mirror({ mode, text, sent, decision, done }) {
    const root = ui();
    const back = document.createElement("div");
    back.className = "backdrop";
    const dlg = document.createElement("div");
    dlg.className = "dialog";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", t("mirrorTitle"));
    const h = document.createElement("h2");
    h.textContent = t("mirrorTitle");
    const lead = document.createElement("p");
    lead.textContent = mode === "block" ? t("mirrorBlockLead") : mode === "ask" ? t("mirrorAskLead") : t("mapLocal");
    const cols = document.createElement("div");
    cols.className = "cols";
    const c1 = document.createElement("div");
    c1.className = "col";
    const h1 = document.createElement("h3");
    h1.textContent = t("yourText");
    c1.append(h1, highlighted(text, decision.entities));
    cols.appendChild(c1);
    if (mode !== "block") {
      const c2 = document.createElement("div");
      c2.className = "col";
      const h2 = document.createElement("h3");
      h2.textContent = t("aiGets");
      c2.append(h2, withTokens(sent));
      cols.appendChild(c2);
    }
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const [type, n] of Object.entries(decision.counts)) {
      const c = document.createElement("span");
      const blocked = decision.entities.some((e) => e.type === type && e.action === "block");
      c.className = "chip" + (blocked ? " block" : "");
      c.textContent = `${I18n.typeName(type, lang)} × ${n}`;
      chips.appendChild(c);
    }
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = mode === "ask" ? t("mapLocal") : "";
    const row = document.createElement("div");
    row.className = "row";
    const close = (choice) => {
      back.remove();
      if (done) done(choice);
    };
    const button = (label, choice, primary) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (primary) b.className = "primary";
      b.addEventListener("click", () => close(choice));
      row.appendChild(b);
      return b;
    };
    let first;
    if (mode === "ask") {
      button(t("cancel"), "cancel");
      button(t("sendOriginal"), "original");
      first = button(t("sendMasked"), "masked", true);
    } else {
      first = button(mode === "block" ? t("editText") : t("close"), "cancel", true);
    }
    back.addEventListener("keydown", (e) => e.key === "Escape" && close("cancel"));
    back.addEventListener("click", (e) => e.target === back && close("cancel"));
    dlg.append(h, lead, cols, chips);
    if (note.textContent) dlg.appendChild(note);
    dlg.appendChild(row);
    back.appendChild(dlg);
    root.appendChild(back);
    first.focus();
  }

  refresh();
})();
