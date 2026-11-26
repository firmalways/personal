# FirmAlways Personal

**Free browser extension that hides your personal data before it reaches an AI.**
ส่วนขยายเบราว์เซอร์ฟรี ซ่อนข้อมูลส่วนตัวก่อนส่งให้ AI ใช้บัญชี ChatGPT, Claude, Gemini เดิมได้ ไม่ต้องมี API key ไม่ต้องติดตั้ง Python หรือ Docker

```
You type:     ช่วยร่างข้อความถึงคุณสมศรี โทร 089-765-4321
The AI gets:  ช่วยร่างข้อความถึงคุณ«PERSON_1» โทร «PHONE_1»
You see:      the answer with คุณสมศรี and 089-765-4321 back in place, on your screen only
```

Part of FirmAlways: **Personal** (free, for everyone) · **Gate** (Tier 1, for
builders: gateway, coding agents, MCP) · **Pro** (Tier 2, for organisations).
All three use the same security core.

## What it does

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

## Install

Until it is listed in the browser stores:

1. Download `firmalways-personal-v*.zip` from the
   [latest release](https://github.com/firmalways/personal/releases/latest) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.

Works in Chrome, Edge, Brave, Arc and other Chromium browsers.

## Privacy

Everything runs in your browser. The extension makes no network requests.
Masked values live in memory and are gone when the browser closes. See
[PRIVACY.md](PRIVACY.md) for details and limits.

## Known limits

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
sh scripts/build.sh           # dist/firmalways-personal-vX.Y.Z.zip
```

`src/core/engine.js` is a port of the FirmAlways Gate detectors.
`test/parity.test.js` checks that both engines find exactly the same data on
the same Thai test set; regenerate the fixture with
`python3 scripts/gen_parity.py ../firmalways-gate` after a Gate change.

## License

Apache-2.0
