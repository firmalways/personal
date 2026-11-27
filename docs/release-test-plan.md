# Release test plan: FirmAlways Personal (hook)

Run all three layers before every release. A release is blocked when any of them fails.

| Layer | Command | Time | What it proves |
|---|---|---|---|
| Unit and integration | `npm test` | ~1 min | Detection, Thai repair, masking, hook JSON for every event, file guard, OCR cache, injection rules, stats. Runs in CI (Linux: OCR cases skip). |
| Shared core | `python3 scripts/gen_parity.py ../firmalways-gate` then `npm test` | ~10 s | The JS engine and Gate's Python detectors give the same result on 105 texts. |
| Real Codex, end to end | `uv run --with fpdf2 --with uharfbuzz --with tiktoken scripts/e2e_codex.py` | ~10 min | 8 prompts through the Codex engine bundled in ChatGPT.app, with the installed release and your trusted hooks, in the default sandbox. Checks that no real value from the test documents reaches Codex. |

Tag the release only after `npm test` exits 0 (do not pipe it through `head` or `grep` when gating). After CI publishes the
release, install it from GitHub (`FIRMALWAYS_VERSION=vX.Y.Z bash install.sh`) and run the end-to-end check against that install.

## What each area needs

| Area | Risk if it breaks | Unit / integration | End to end |
|---|---|---|---|
| Prompt with personal data | Data reaches the AI provider | masked, blocked, allow-next, secrets never allowed | `prompt-pii`: 0 input tokens |
| False positives ("คุณ" as "you", nouns like คุณไสย) | People stop using it | parity cases, `คุณ` tests | `pronoun-khun` passes |
| Documents with personal data | Data reaches the provider through a tool | cat, python, globs, Thai file names, view_image | `scanned-pii`, `table-pii`: placeholders only, leak scan |
| Scanned pages in the sandbox | Empty or wrong answers | OCR cache test with `CODEX_SANDBOX` | `scanned-pii` runs in `workspace-write` |
| Pictures with no text | Blocks normal design work | plain PNG passes, broken PNG held | `picture-no-text` |
| Token saver | Wasted tokens, misread Thai | pdftoppm / pdf2image / magick denied, `FIRMALWAYS_VISUAL=1` passes | `pdf-summary`: no page images |
| Prompt injection | The agent follows orders hidden in content | patterns, quoted vs typed prompts, hidden characters, agent files exempt | `pasted-injection`, `file-injection`: no command touches `~/.ssh` or the upload URL |
| Writing real values back | Wrong values in the user's files | apply_patch and shell writes, Codex approval modes | manual (needs Full access, see below) |
| Self-protection | The agent switches FirmAlways off | allow-file, off, settings paths | covered by unit tests |
| Report | Wrong numbers in sales material | counts only, sandbox counts merged | read `firmalways report` after the run |

## Manual checks in the ChatGPT desktop app

The end-to-end script uses the same engine and hooks, but these only show in the app:

1. Send a prompt with a fake phone number: the app shows "Hook blocked this message", the reason in Thai, and ⌘V pastes the masked copy.
2. Paste the injection email from `scripts/e2e_codex.py`: the FirmAlways note appears under the message and the agent mentions the hidden instruction.
3. In Full access mode, ask it to write a file with a placeholder from a masked prompt: the file on disk has the real value; the chat shows only the placeholder.
4. After an update that changes `~/.codex/hooks.json`, the app asks to trust the hook again. (`firmalways hook codex` does not change between versions, so normal updates need no new trust.)

## Last result (0.4.2, 28 November 2026)

`npm test` 46/46. End to end 8/8, no real value reached Codex. Tokens on the generated documents (o200k_base):

| Document | Pages | As page images | `pdftotext -layout` | `firmalways read` |
|---|---|---|---|---|
| Thai report, text layer | 4 | 4,420 | 5,075 | 3,888 (−23% vs pdftotext) |
| Table with names, IDs, phones | 2 | 2,210 | 1,520 | 1,112 (−27%) |
| Scanned letter | 1 | 1,105 | no text | 389 (−65% vs images) |

Dense Thai text costs about as much as a page image, so for text PDFs the gain is accuracy, plus the Thai repair and
compact layout. The clear token saving is on scanned pages, and whenever the agent would read both the text and the images.

## Known gaps

- The token numbers are estimates: page images use OpenAI's published high-detail tile formula. Codex may send larger images
  on newer models, which would make the real saving bigger, but this is not measured.
- Real values from `firmalways read` cannot be put back into files when the read ran inside the sandbox (the vault is read-only there).
- The file guard matches file names in commands; scripts that build paths at run time are not seen. It is not a sandbox.
- Windows and Linux: OCR needs tesseract; the end-to-end script is macOS only.
