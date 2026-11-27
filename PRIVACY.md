# FirmAlways Personal privacy policy

Last updated: 28 November 2026

FirmAlways Personal is a browser extension that checks the text you paste or
send on AI chat sites and hides personal data before it is sent. It is made by
Me Application (FirmAlways).

## What the extension processes

- The text you paste or send on the AI sites listed in its settings
  (ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek). It is checked on
  your device, inside the browser.
- Text you put on the "Scan text" page, and files you open there. Files are
  read in the browser and are not uploaded.

## What it stores, and where

| Data | Where | How long |
| --- | --- | --- |
| Your settings, keywords and rules | Your browser (`chrome.storage.local`) | Until you change or remove them |
| Real values behind placeholders such as «PHONE_1» | Browser memory (`chrome.storage.session`) | Until the browser closes, or you press "Forget values" |
| Privacy report: counts per day, data types, site names, time | Your browser (`chrome.storage.local`) | 7, 30 or 90 days (your choice), or until you delete it |
| The last masked message (Privacy Mirror) | Browser memory (`chrome.storage.session`) | Until the browser closes |

The report never contains your text or the values that were masked.

## What it sends

Nothing. The extension makes no network requests: its pages run under a
content security policy with `connect-src 'none'`. FirmAlways does not collect
analytics, telemetry or crash reports. What you send to an AI site still goes
to that site; FirmAlways only changes what is in the message.

## The hook (`firmalways` for Codex and Claude Code)

The hook runs on your computer when an AI agent receives your prompt or is
about to use a tool. It reads prompts, and documents the agent is about to
open, on your machine (OCR with macOS Vision or tesseract). It makes no
network requests. The installer downloads the program from GitHub once.

| Data | Where | How long |
| --- | --- | --- |
| Settings | `~/.firmalways/settings.json` | Until you change it |
| Real values behind placeholders | `~/.firmalways/vault.json` (only you can read it) | 24 hours, or `firmalways forget` |
| Text read by OCR from scanned pages and images | `~/.firmalways/ocr/` (only you can read it) | 24 hours, or `firmalways forget` |
| Result of checking each file: path, size, date, counts per data type | `~/.firmalways/file-checks.json` | Last 500 files |
| Files you allowed with `allow-file` | `~/.firmalways/allowed-files.json` | Until the time you chose |
| Report: counts per day and data type, pages read, warnings, token estimate | `~/.firmalways/stats.json`, briefly in your temp folder when the agent's sandbox cannot write there | 30 days (`retentionDays`) |

The report and the file checks never contain your text or the values that were
masked. Your prompts and documents still go to the AI provider in masked form;
what you allow with `allow-next` or `allow-file` goes as it is.

## Limits you should know

- Text you type sits in the AI site's input box before you press send, so the
  site can technically read it (for example to save drafts). Pasting is safer:
  pasted text is checked before it enters the box.
- The real values shown in AI answers are displayed on that site's page.
- Placeholders that can be restored are pseudonymisation, not anonymisation.
  Under Thailand's PDPA the masked text can still be personal data.
- Files and images you upload to an AI site are not checked.

## Permissions

- `storage`: keep the settings, the report and the in-memory values above.
- `activeTab`: show in the toolbar pop-up whether the current site is protected.
- Access to the listed AI sites: to check text before it is sent.

## Contact

Questions: https://github.com/firmalways/personal/discussions
Security reports: https://github.com/firmalways/personal/security/advisories/new
