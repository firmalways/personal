"""Write test/fixtures/parity.json: what FirmAlways Gate (Python) finds in each test text.

The JavaScript core must find exactly the same entities. Regenerate after a Gate
detector change:

    python3 scripts/gen_parity.py ../firmalways-gate
"""
import json
import sys
from pathlib import Path

gate = Path(sys.argv[1] if len(sys.argv) > 1 else "../firmalways-gate").resolve()
sys.path.insert(0, str(gate / "src"))

from firmalways_gate import __version__  # noqa: E402
from firmalways_gate.analyzer import analyze  # noqa: E402
from firmalways_gate.benchmark import generate, load_curated  # noqa: E402

EXTRA = [
    "ส่งของไปที่ธันยาคารคอนโดมิเนียม 50/38 ซอยลาดพร้าว 38 แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900",
    "นัดวันที่ 22/11/2026 เวลา 10 โมง",
    "วันเกิด 12 มีนาคม พ.ศ. 2530 สัญชาติไทย เลขบัตร 1-1017-00230-73-8",
    "DOB: 1990-04-01, nationality: Thai, Mr. John Smith",
    "บัญชีไทยพาณิชย์ 4071234567 ชื่อบัญชีนางสาวมาลี ใจงาม",
    "my key is sk-proj-abcdefghijklmnopqrstuvwxyz123456 and AKIA" + "IOSFODNN7EXAMPLE",
    "ขอบคุณครับ คุณช่วยสรุปให้หน่อย",
    "ไม่ สิ่งที่คุณเสนอไอเดียมา มันเฉลยทุกอย่างทั้งหมด แต่ส่งให้คุณสมชาย ใจดี และคุณแก้ว",
    "ทนายความของนายสมศักดิ์ รักดี ติดต่อ 02-123-4567",
    "รหัสผ่านคือ Hunter2024!",
    "ผู้ป่วยชื่อนายสมชาย ป่วยเป็นมะเร็ง โทร 0891234567",
    "IPv6 2001:0db8:85a3:0000:0000:8a2e:0370:7334 และ 10.0.0.1",
    "ทะเบียนรถ 1กข 1234 ไลน์: somchai.k",
    "เลขประจำตัวผู้เสียภาษี 0105556000123",
    "บัตร 5500-0000-0000-0004 หรือ 378282246310005",
    "อาการของโรคเบาหวานมีอะไรบ้าง",
    "",
]

texts = [s.text for s in load_curated()] + [s.text for s in generate(seed=7, repeats=2)] + EXTRA
cases = [{"text": t, "entities": [[e.type, e.start, e.end] for e in analyze(t)]} for t in texts]
out = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "parity.json"
out.write_text(json.dumps({"gate_version": __version__, "cases": cases}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"wrote {len(cases)} cases from Gate {__version__} to {out}")
