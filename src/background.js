/* FirmAlways Personal background worker.
 *
 * Holds three things, all on this device:
 * - settings (chrome.storage.local)
 * - the vault of real values per AI site (chrome.storage.session: memory only, gone when the browser closes)
 * - the privacy report: counts per day and a content-free history (chrome.storage.local)
 * Nothing is sent to FirmAlways or anyone else. This file makes no network requests.
 */
importScripts("core/engine.js", "core/vault.js", "core/policy.js");

const Policy = globalThis.FirmAlwaysPolicy;
const Vault = globalThis.FirmAlwaysVault;
const MAX_HISTORY = 2000;

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return Policy.withDefaults(settings);
}

async function getVault(host) {
  const k = "vault:" + host;
  const got = await chrome.storage.session.get(k);
  return got[k] || Vault.createVault();
}

// Serialise writes so two messages arriving together do not lose an update.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function today(d) {
  const x = d || new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

async function record(event) {
  const settings = await getSettings();
  const { stats = { days: {} }, history = [] } = await chrome.storage.local.get(["stats", "history"]);
  const day = (stats.days[today()] = stats.days[today()] || { checked: 0, protected: 0, blocked: 0, warned: 0, items: 0, byType: {}, bySite: {} });
  day.checked += 1;
  const items = Object.values(event.counts || {}).reduce((a, b) => a + b, 0);
  if (items) {
    if (event.outcome === "blocked") day.blocked += 1;
    else if (event.outcome === "masked") day.protected += 1;
    else day.warned += 1;
    day.items += items;
    for (const [t, n] of Object.entries(event.counts)) day.byType[t] = (day.byType[t] || 0) + n;
    day.bySite[event.host] = (day.bySite[event.host] || 0) + 1;
    history.unshift({ t: Date.now(), host: event.host, source: event.source, outcome: event.outcome, counts: event.counts });
  }
  const cutoff = Date.now() - settings.retentionDays * 86400000;
  const cutDay = today(new Date(cutoff));
  for (const d of Object.keys(stats.days)) if (d < cutDay) delete stats.days[d];
  const kept = history.filter((h) => h.t >= cutoff).slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ stats, history: kept });
  if (event.sent !== undefined) {
    await chrome.storage.session.set({ mirror: { t: Date.now(), host: event.host, sent: event.sent, counts: event.counts, outcome: event.outcome } });
  }
}

async function protect(host, text, entities) {
  const vault = await getVault(host);
  const sent = Policy.protect(text, { entities }, vault, Vault);
  await chrome.storage.session.set({ ["vault:" + host]: vault });
  return { sent, byToken: vault.byToken };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // A content script may only touch the vault of the site it runs on.
  let host = message && message.host;
  if (sender.tab && sender.url) host = new URL(sender.url).host;
  const handlers = {
    state: async () => {
      const settings = await getSettings();
      const vault = await getVault(host);
      return { settings, byToken: vault.byToken };
    },
    protect: () => serial(() => protect(host, message.text, message.entities)),
    record: () => serial(() => record(message.event)),
    forget: () =>
      serial(async () => {
        if (message.all) {
          const all = await chrome.storage.session.get(null);
          await chrome.storage.session.remove(Object.keys(all).filter((k) => k.startsWith("vault:")).concat("mirror"));
        } else {
          await chrome.storage.session.remove("vault:" + host);
        }
        return { ok: true };
      }),
  };
  const handler = message && handlers[message.type];
  if (!handler) return false;
  Promise.resolve()
    .then(handler)
    .then((result) => sendResponse(Object.assign({ ok: true }, result)))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("src/ui/welcome.html") });
});
