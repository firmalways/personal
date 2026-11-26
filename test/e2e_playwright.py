"""End-to-end test of FirmAlways Personal in real Chromium.

Loads the unpacked extension and opens two local pages that behave like AI chat
sites: one with a <textarea> and a Send button, one with a rich-text editor
that sends on Enter and handles paste itself (like ChatGPT and Claude). The
fake sites record exactly what they would send to the AI.

    uv run --with playwright python -m playwright install chromium
    uv run --with playwright python test/e2e_playwright.py
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ID = "1-1017-00230-73-2"
KEY = "sk-proj-" + "abcdefghijklmnopqrstuvwxyz123456"

# The fake AI: shows what it received, then answers by echoing it back.
COMMON = """
<div id="chat"></div>
<script>
window.sent = [];
function deliver(text) {
  window.sent.push(text);
  const q = document.createElement('div'); q.className = 'user'; q.textContent = text; chat.appendChild(q);
  setTimeout(() => { const a = document.createElement('div'); a.className = 'answer';
    a.textContent = 'Answer: ' + text; chat.appendChild(a); }, 50);
}
</script>"""

TEXTAREA_PAGE = """<!doctype html><meta charset="utf-8"><title>fake chat A</title>
<form id="f" onsubmit="return false"><textarea id="box" style="width:600px;height:80px"></textarea>
<button type="button" id="send" data-testid="send-button" aria-label="Send">Send</button></form>""" + COMMON + """
<script>
document.getElementById('send').addEventListener('click', () => { deliver(box.value); box.value = ''; });
</script>"""

RICH_PAGE = """<!doctype html><meta charset="utf-8"><title>fake chat B</title>
<div id="ed" contenteditable="true" class="ProseMirror" style="width:600px;min-height:60px;border:1px solid #ccc"></div>""" + COMMON + """
<script>
ed.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); deliver(ed.innerText.trim()); ed.innerHTML = ''; } });
ed.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, t); window.siteHandledPaste = (window.siteHandledPaste || 0) + 1; });
</script>"""


def serve(directory: Path) -> ThreadingHTTPServer:
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(directory)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main() -> int:
    work = Path(tempfile.mkdtemp())
    ext = work / "ext"
    shutil.copytree(ROOT, ext, ignore=shutil.ignore_patterns("test", "dist", ".git", "node_modules", "scripts"))
    manifest = json.loads((ext / "manifest.json").read_text())
    manifest["content_scripts"][0]["matches"].append("http://127.0.0.1/*")
    (ext / "manifest.json").write_text(json.dumps(manifest))
    site = work / "site"
    site.mkdir()
    (site / "a.html").write_text(TEXTAREA_PAGE, encoding="utf-8")
    (site / "b.html").write_text(RICH_PAGE, encoding="utf-8")
    server = serve(site)
    base = f"http://127.0.0.1:{server.server_address[1]}"

    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, bool(ok), detail))

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(work / "profile"),
            channel="chromium",
            headless=True,
            args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}"],
        )
        sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
        ext_id = sw.url.split("/")[2]
        ext_url = f"chrome-extension://{ext_id}/src/ui"
        for page in list(ctx.pages):
            if "welcome.html" in page.url:
                check("welcome page opens on install", True)
                page.close()

        def toasts(page) -> list[str]:
            return page.evaluate(
                "() => { const h = document.querySelector('firmalways-personal'); return h && h.shadowRoot ?"
                " [...h.shadowRoot.querySelectorAll('.toast')].map(t => t.dataset.kind + ':' + t.textContent) : []; }"
            )

        # --- textarea site: type, click Send -------------------------------------------------
        a = ctx.new_page()
        a.goto(f"{base}/a.html")
        a.wait_for_timeout(300)
        a.fill("#box", f"ช่วยร่างจดหมายถึงนายสมชาย ใจดี เลขบัตร {ID} โทร 081-234-5678")
        a.click("#send")
        a.wait_for_function("window.sent.length === 1", timeout=5000)
        sent = a.evaluate("window.sent[0]")
        check("send button: AI receives placeholders", "«PERSON_1»" in sent and "«THAI_NATIONAL_ID_1»" in sent and "«PHONE_1»" in sent, sent)
        check("send button: no real value reaches the AI", "สมชาย" not in sent and "081" not in sent and "1017" not in sent, sent)
        a.wait_for_selector(".answer")
        a.wait_for_timeout(200)
        answer = a.inner_text(".answer")
        check("answer shows real values on screen", "สมชาย ใจดี" in answer and "081-234-5678" in answer, answer)
        check("toast tells the user", any(t.startswith("info:") for t in toasts(a)), str(toasts(a)))

        a.fill("#box", "สรุปการประชุมวันนี้ให้หน่อย")
        a.click("#send")
        a.wait_for_function("window.sent.length === 2")
        check("clean text is sent unchanged", a.evaluate("window.sent[1]") == "สรุปการประชุมวันนี้ให้หน่อย")

        a.fill("#box", f"ใช้ key นี้ {KEY} เขียนโค้ดให้หน่อย")
        a.click("#send")
        a.wait_for_timeout(600)
        check("secret is not sent", a.evaluate("window.sent.length") == 2)
        check("block toast shown", any(t.startswith("block:") for t in toasts(a)), str(toasts(a)))
        check("blocked text stays in the box for editing", KEY in a.input_value("#box"))

        # paste into the textarea
        a.fill("#box", "")
        a.focus("#box")
        a.evaluate(
            """(t) => { const d = new DataTransfer(); d.setData('text/plain', t);
            box.dispatchEvent(new ClipboardEvent('paste', {clipboardData: d, bubbles: true, cancelable: true})); }""",
            "ลูกค้าอีเมล somchai@example.com",
        )
        a.wait_for_timeout(400)
        check("paste is masked before it enters the box", a.input_value("#box") == "ลูกค้าอีเมล «EMAIL_1»", a.input_value("#box"))

        # --- rich editor site: Enter to send, site-handled paste ----------------------------
        b = ctx.new_page()
        b.goto(f"{base}/b.html")
        b.wait_for_timeout(300)
        b.click("#ed")
        b.keyboard.type("โทรหาคุณมาลี 0899999999 ด่วน")
        b.keyboard.press("Enter")
        b.wait_for_function("window.sent.length === 1", timeout=5000)
        sent_b = b.evaluate("window.sent[0]")
        check("Enter in rich editor: AI receives placeholders", "«PHONE_" in sent_b and "0899999999" not in sent_b and "มาลี" not in sent_b, sent_b)

        b.click("#ed")
        before = b.evaluate("window.siteHandledPaste || 0")
        b.evaluate(
            """(t) => { const d = new DataTransfer(); d.setData('text/plain', t);
            ed.dispatchEvent(new ClipboardEvent('paste', {clipboardData: d, bubbles: true, cancelable: true})); }""",
            "บัญชีกสิกร 123-4-56789-0",
        )
        b.wait_for_timeout(400)
        check("paste into rich editor goes through the site's own paste handler, masked",
              b.inner_text("#ed").strip() == "บัญชีกสิกร «BANK_ACCOUNT_1»" and b.evaluate("window.siteHandledPaste") == before + 1,
              f'{b.inner_text("#ed")!r} handled={b.evaluate("window.siteHandledPaste")}')
        b.keyboard.press("Enter")
        b.wait_for_function("window.sent.length === 2")

        # same value in another tab of the same site keeps its placeholder (shared site vault)
        a.fill("#box", "อีกครั้ง โทร 081-234-5678")
        a.click("#send")
        a.wait_for_function("window.sent.length === 3")
        check("same value, same placeholder across messages", a.evaluate("window.sent[2]") == "อีกครั้ง โทร «PHONE_1»", a.evaluate("window.sent[2]"))

        # --- ask mode: Privacy Mirror ------------------------------------------------------
        opts = ctx.new_page()
        opts.goto(f"{ext_url}/options.html")
        opts.wait_for_selector("#types tr", state="attached")
        opts.uncheck('[data-basic="autoMask"]')
        opts.wait_for_timeout(300)
        a.fill("#box", "ส่งให้ test@example.org")
        a.click("#send")
        a.wait_for_timeout(400)
        dialog = a.evaluate("() => { const r = document.querySelector('firmalways-personal').shadowRoot; const d = r.querySelector('.dialog');"
                            " return d ? d.innerText : ''; }")
        check("ask mode shows the Privacy Mirror", "Privacy Mirror" in dialog and "«EMAIL_" in dialog, dialog)
        check("nothing is sent while the user decides", a.evaluate("window.sent.length") == 3)
        a.evaluate("() => document.querySelector('firmalways-personal').shadowRoot.querySelector('.row button.primary').click()")
        a.wait_for_function("window.sent.length === 4", timeout=5000)
        check("'Send masked' sends placeholders", "«EMAIL_" in a.evaluate("window.sent[3]") and "test@" not in a.evaluate("window.sent[3]"))

        # --- extension pages --------------------------------------------------------------
        report = ctx.new_page()
        report.goto(f"{ext_url}/report.html")
        report.wait_for_timeout(500)
        checked = int(report.inner_text("#sChecked").replace(",", ""))
        items = int(report.inner_text("#sItems").replace(",", ""))
        blocked = int(report.inner_text("#sBlocked").replace(",", ""))
        check("report counts checked, masked and blocked", checked >= 6 and items >= 6 and blocked >= 1, f"{checked} {items} {blocked}")
        history = report.inner_text("#history")
        check("history has no message text", "สมชาย" not in history and "081" not in history and KEY not in history)
        stored = report.evaluate("chrome.storage.local.get(null).then(x => JSON.stringify(x))")
        check("nothing personal in local storage", all(v not in stored for v in ("สมชาย", "081-234-5678", KEY, "somchai@", "0899999999")))

        scan = ctx.new_page()
        scan.goto(f"{ext_url}/scan.html#sample")
        scan.wait_for_timeout(400)
        out = scan.inner_text("#output")
        check("scan page masks the sample", "«THAI_NATIONAL_ID_1»" in out and "«THAI_ADDRESS_1»" in out and "1017" not in out, out)

        for name in ("popup", "welcome", "recommend"):
            pg = ctx.new_page()
            errors: list[str] = []
            pg.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
            pg.goto(f"{ext_url}/{name}.html")
            pg.wait_for_timeout(300)
            check(f"{name} page renders without errors", not errors and len(pg.inner_text("body")) > 50, "; ".join(errors))

        # turning protection off for nothing else: forget the vault, answers keep placeholders
        opts.click("#forget")
        opts.wait_for_timeout(300)
        ctx.close()

    width = max(len(n) for n, _, _ in checks)
    failed = 0
    for name, ok, detail in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {'' if ok else detail}")
        failed += not ok
    print(f"\n{len(checks) - failed}/{len(checks)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
