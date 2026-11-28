# FirmAlways Personal

**Free hook that stops your personal data before it reaches an AI.**
Hook ฟรีแบบ RTK สำหรับ ChatGPT Desktop, Codex และ Claude Code ตรวจข้อความในเครื่องก่อนส่งให้ AI

```bash
curl -fsSL https://firmalways.meapplication.co.th/personal/install.sh | sh
```

Then open ChatGPT Desktop or Codex → Settings → Hooks and click **Trust** on
`firmalways hook codex` (Codex reviews every new hook before it runs).

```
You type:          ร่างจดหมายถึงนายสมชาย ใจดี โทร 081-234-5678
FirmAlways:        holds the prompt, puts a safe copy on your clipboard
You paste & send:  ร่างจดหมายถึงนาย«PERSON_1» โทร «PHONE_1»
AI writes a file:  the file on your machine gets สมชาย ใจดี and 081-234-5678 back
```

Part of FirmAlways: **Personal** (free, for everyone) · **Gate** (Tier 1, for
builders: gateway, coding agents, MCP) · **Pro** (Tier 2, for organisations).
All three use the same security core.

## The hook

| Event | What FirmAlways does |
|---|---|
| `UserPromptSubmit` | Personal data: the prompt is not sent; a masked copy goes to your clipboard. Passwords, API keys and PDPA s.26 data: always cut out as `«REMOVED_…»`. Warn-only types: sent, with a note. |
| `PreToolUse` (files) | Before the agent opens a document (pdf, docx, xlsx, pptx, csv, txt, md, json, images) in any way — `cat`, `pdftotext`, `pdftoppm`, Python, `view_image` — FirmAlways reads it on your machine, with OCR for scanned pages and images (macOS Vision, Thai and English; tesseract elsewhere). If it holds personal data the call is denied and the agent is told to use `firmalways read <file>`, which returns a masked copy. Files it cannot fully check are held too (fail closed). |
| `UserPromptSubmit` (attachments) | Files named in the prompt are checked up front, and the agent is told to open them only through `firmalways read`. |
| `UserPromptSubmit` (prompt injection) | Text pasted into the prompt that tries to give orders to the AI ("ignore all previous instructions", "หมายเหตุถึงระบบ AI: …", hidden HTML comments, bidi/tag characters) is never blocked: the agent is told to treat it as content, tell you about it, and ask you before acting on it. (Codex CLI shows FirmAlways' own note too; the ChatGPT desktop app shows hook notes only when a prompt is held, so there you hear it from the agent.) The same words typed as your own short request are left alone. |
| `PreToolUse` (injection in files) | A document with such text opens only through `firmalways read`, which prints a warning with the suspicious parts above the content and removes hidden characters. |
| `PreToolUse` (token saver) | When the agent renders a PDF to images to read it (`pdftoppm`, `pdftocairo`, `magick`, `pdf2image`, `get_pixmap`…), it is sent to `firmalways read` instead: Thai is read as text (OCR on your machine for scanned pages) and no page images are sent. If it really needs the pictures (layout, charts, photos) it reruns the command with `FIRMALWAYS_VISUAL=1`. Turn off with `"tokenSaver": false`. |
| `PreToolUse` (self-protection) | The agent may not run `firmalways allow-file/allow-next/off/uninstall`, or edit `~/.firmalways`, `~/.codex/hooks.json` or Claude settings. |
| `PreToolUse` (writes) | When the agent writes a file (apply_patch, Write/Edit, or a shell command with `>`, `tee`, `sed -i`, or a Python/Node script that opens a file for writing), placeholders are replaced with the real values on your machine. In Codex this happens only when the action would not have asked you anyway; it never skips an approval. Claude Code shows the rewrite and asks. |

Commands: `firmalways init [codex|claude|all]`, `uninstall`, `check "text"|file`,
`read <file> [--pages 6-9]`, `allow-file <file> [hours]` (you only; the real data then goes to the AI provider),
`mask`, `restore`, `clip [--restore]`, `allow-next`, `forget`, `status`,
`report`, `on`, `off`. Settings live in `~/.firmalways/settings.json` (same
policy packs and actions as the extension, plus `clipboard`, `restoreTools`
(`files` | `all` | `off`) and `failClosed`).

Real values are kept in `~/.firmalways/vault.json` (mode 600) for 24 hours so
files can be restored; the report keeps counts only. Nothing is sent anywhere.

Known limits: if anything edits `~/.codex/hooks.json` (another tool, or you), Codex stops running
FirmAlways without a warning until you click **Trust** again in Settings → Hooks (`firmalways init`
writes this file; normal updates do not). A chat started while the hook was not trusted keeps
running without it; start a new chat. A hook can only stop a prompt, not rewrite it; the ChatGPT app may
title a new chat from its first message before hooks run, so use `firmalways
clip` before pasting personal data into a new chat; answers in the app keep
placeholders (`firmalways clip --restore`). The file guard looks for file names in
each tool call; a command that reaches a file without naming it (after `cd`, from a
variable filled by an earlier command, from inside a script) can get past it, so it
is a guard, not a sandbox — enforced isolation is FirmAlways Gate. Before checking,
FirmAlways repairs Thai broken by PDF fonts and OCR (shifted marks, split SARA AM,
marks cut off by spaces, titles misread as "บางสาว"/"น.ส."), and on pages that
already have real Thai text it gives the agent the text layer, not a noisier OCR
copy. OCR can miss
text in dense tables; what it cannot read is left out of `firmalways read`, not
sent unmasked.

## Browser extension

For AI websites (ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek) there is
also a free extension, `firmalways-personal-extension-v*.zip` in the releases.

### What the extension does

- Checks text when you **paste** and when you **press Enter or Send** on
  ChatGPT, Claude, Gemini, Copilot, Perplexity and DeepSeek.
- **Masks** personal data with placeholders and shows the real values in the
  AI's answer, for you only. Thai ID numbers (checksum), Thai phones, emails,
  bank accounts, cards, titled names, Thai addresses, dates of birth, passports,
  plates, LINE IDs, IP addresses.
- **Blocks** passwords, API keys and PDPA section 26 sensitive data about a person.
- **Privacy Mirror**: see exactly what the AI received.
- **Basic and Advanced mode, both free**: four switches, or an action per data
  type (allow, warn, ask, mask, redact, block), your own keywords and rules.
- **Policy library**: Thailand PDPA Baseline, Global Privacy Baseline, Personal
  Finance Protection (OTP, CVV, PIN), Developer Secret Protection. Each pack
  lists its legal references and ISO controls.
- **Personal Privacy Report** and history, with counts and data types only.
- **Scan text** page for text and .txt / .md / .csv / .json / .docx files.
- **Recommend to my organisation**: a one-page brief for IT or the DPO, with
  none of your usage data.
- Thai and English.

Security is free: no message limits, and detection is never weakened to make
you upgrade.

### Install the extension

Until it is listed in the browser stores:

1. Download `firmalways-personal-extension-v*.zip` from the
   [latest release](https://github.com/firmalways/personal/releases/latest) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.

Works in Chrome, Edge, Brave, Arc and other Chromium browsers.

## Privacy

Everything runs in your browser. The extension makes no network requests.
Masked values live in memory and are gone when the browser closes. See
[PRIVACY.md](PRIVACY.md) for details and limits.

## Known limits

- `firmalways report` counts tokens saved only where page images were not sent (rendering avoided, or a scanned page read as OCR text), using OpenAI's published tile formula for a 150 dpi A4 page (1,105 tokens). It is an estimate. Dense Thai text can cost as many tokens as a page image; the gain there is accuracy, not tokens.
- Prompt-injection checks look for known wording and hidden characters. New phrasing can get through; the agent's own safeguards still apply.
- Typed text sits in the site's input box before you send it, so the site can
  technically read it. Pasting is checked before it enters the box.
- Uploaded files and images, voice input and mobile or desktop apps are not covered.
- Names without a title (นาย, คุณ, Mr ...) and data that identifies someone
  only through context are missed.
- Site updates can move the Send button; the extension falls back to checking
  on Enter and on paste. Please report a site that breaks.

## Development

```bash
npm test                      # unit tests + parity with FirmAlways Gate
uv run --with playwright python test/e2e_playwright.py   # end-to-end in Chromium
uv run --with fpdf2 --with uharfbuzz --with tiktoken scripts/e2e_codex.py   # hook in real Codex (macOS)
sh scripts/build.sh           # dist/: hook tar.gz, extension zip, install.sh
```

Before a release, follow [docs/release-test-plan.md](docs/release-test-plan.md).

`src/core/engine.js` is a port of the FirmAlways Gate detectors.
`test/parity.test.js` checks that both engines find exactly the same data on
the same Thai test set; regenerate the fixture with
`python3 scripts/gen_parity.py ../firmalways-gate` after a Gate change.

## License

Apache-2.0
