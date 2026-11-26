/* Local Secure Vault: reversible placeholders («PHONE_1») and their real values.
 *
 * The same value always gets the same placeholder within one vault, so a
 * conversation stays consistent across messages. A vault is plain data
 * ({byKey, byToken, counters}) so the extension can keep it in session storage
 * (memory only, cleared when the browser closes). It never leaves the device.
 */
(function (root) {
  "use strict";

  const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

  function createVault() {
    return { byKey: {}, byToken: {}, counters: {} };
  }

  function key(type, value) {
    let v = String(value)
      .replace(/[\s\-.()+ ]/g, "")
      .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
      .toLowerCase();
    if (type === "PHONE" && v.startsWith("66")) v = "0" + v.slice(2);
    return type + ":" + v;
  }

  function placeholderFor(vault, type, value) {
    const k = key(type, value);
    let token = vault.byKey[k];
    if (!token) {
      const n = (vault.counters[type] || 0) + 1;
      vault.counters[type] = n;
      token = `${type}_${n}`;
      vault.byKey[k] = token;
      vault.byToken[token] = value;
    }
    return `«${token}»`;
  }

  /** Replace each entity span with its placeholder. Entities must not overlap. */
  function mask(text, entities, vault) {
    let out = "";
    let pos = 0;
    for (const e of [...entities].sort((a, b) => a.start - b.start)) {
      if (e.start < pos) throw new Error("entities overlap; resolve them before masking");
      out += text.slice(pos, e.start) + placeholderFor(vault, e.type, text.slice(e.start, e.end));
      pos = e.end;
    }
    return out + text.slice(pos);
  }

  /** Replace the entity spans with a fixed redaction mark («REDACTED_TYPE»); nothing can be restored. */
  function redact(text, entities) {
    let out = "";
    let pos = 0;
    for (const e of [...entities].sort((a, b) => a.start - b.start)) {
      out += text.slice(pos, e.start) + `«REDACTED_${e.type}»`;
      pos = e.end;
    }
    return out + text.slice(pos);
  }

  const TOKEN_RE = /«\s*([A-Z][A-Z0-9_]*_[0-9]+)\s*»|(?<![A-Za-z0-9_])([A-Z][A-Z0-9_]*_[0-9]+)(?![A-Za-z0-9_])/g;

  /** Put real values back for display. Placeholders this vault did not create are left as they are. */
  function restore(text, vault) {
    if (!text || !Object.keys(vault.byToken).length) return text;
    return text.replace(TOKEN_RE, (match, wrapped, bare) => {
      const token = wrapped || bare;
      return Object.prototype.hasOwnProperty.call(vault.byToken, token) ? vault.byToken[token] : match;
    });
  }

  /** Number of values in the vault. */
  function size(vault) {
    return Object.keys(vault.byToken).length;
  }

  const api = { createVault, key, placeholderFor, mask, redact, restore, size };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FirmAlwaysVault = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
