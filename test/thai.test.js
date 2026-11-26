"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { normalizeThai: n, hideWrappedNameParts: h } = require("../hook/thai.js");
const Policy = require("../src/core/policy.js");

test("broken Thai from PDFs and OCR is repaired", () => {
  assert.strictEqual(n("กํา"), "กำ");
  assert.strictEqual(n("ก่ิ"), "กิ่");
  assert.strictEqual(n("เ วปไซต์"), "เวปไซต์");
  assert.strictEqual(n("ตาม¡สถานที่"), "ตามสถานที่");
  assert.strictEqual(n("ก ้า"), "ก้า");
  assert.strictEqual(n("ป"), "ป้");
  assert.strictEqual(n("hello"), "hello");
});

test("OCR misreads of titles become titles again, ordinary words stay", () => {
  assert.strictEqual(n("จำเลย  บางสาวสมศรี รักไทย ที่ 2"), "จำเลย  นางสาวสมศรี รักไทย ที่ 2");
  assert.strictEqual(n("น.ส.มาลี ดีงาม"), "นางสาวมาลี ดีงาม");
  assert.strictEqual(n("ไปบางสาวน้อย"), "ไปบางสาวน้อย");
  const d = Policy.decide(n("จำเลย บางสาวสมศรี รักไทย ที่ 2"), Policy.compile({}));
  assert.ok(d.entities.some((e) => e.type === "PERSON"));
});

test("a surname wrapped onto the next line is hidden", () => {
  assert.strictEqual(h("นาย«PERSON_9»\n   พจน์,นางสาว«PERSON_8»"), "นาย«PERSON_9»\n   «PERSON_PART»,นางสาว«PERSON_8»");
  assert.strictEqual(h("นาย«PERSON_1»\nติดต่อ สำนักงาน"), "นาย«PERSON_1»\nติดต่อ สำนักงาน");
});
