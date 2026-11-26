// The JavaScript core must find exactly what FirmAlways Gate (Python) finds.
const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/core/engine.js");
const fixture = require("./fixtures/parity.json");

function toCodePoints(text, unit) {
  return [...text.slice(0, unit)].length;
}

test(`parity with FirmAlways Gate ${fixture.gate_version} on ${fixture.cases.length} texts`, () => {
  const failures = [];
  for (const c of fixture.cases) {
    const got = engine.analyze(c.text).map((e) => [e.type, toCodePoints(c.text, e.start), toCodePoints(c.text, e.end)]);
    if (JSON.stringify(got) !== JSON.stringify(c.entities)) failures.push({ text: c.text, want: c.entities, got });
  }
  assert.deepEqual(failures, []);
});
