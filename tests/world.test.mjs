import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeWorld, buildingPlacement, gridPath } from "../src/world.js";

const data = JSON.parse(
  fs.readFileSync(new URL("../data/frostecho-map.json", import.meta.url)),
);
test("every building and door preserves the FrostEcho grid coordinates and dimensions", () => {
  assert.equal(data.village.buildings.length, 7);
  for (const b of data.village.buildings) {
    const p = buildingPlacement(b);
    assert.equal(p.x, (b.x + b.w / 2 - 25) * 2);
    assert.equal(p.z, (b.y + b.h / 2 - 20) * 2);
    assert.deepEqual(p.door, [(b.doorX + 0.5 - 25) * 2, (b.doorY - 20) * 2]);
    assert.equal(p.width, b.w * 2);
    assert.equal(p.depth, b.h * 2);
  }
});
test("all seven approaches follow source walkability and actually end at their doors", () => {
  for (const b of data.village.buildings) {
    const path = gridPath(data.village, [24, 24], [b.doorX, b.doorY]);
    assert.ok(path.length > 0, b.id);
    assert.deepEqual(path.at(-1), [b.doorX, b.doorY]);
    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i];
      assert.notEqual(data.village.blockedRows[y][x], "#");
      if (i)
        assert.equal(
          Math.abs(x - path[i - 1][0]) + Math.abs(y - path[i - 1][1]),
          1,
        );
    }
  }
  const solid = data.village.blockedRows.flatMap((row, y) =>
    [...row].flatMap((v, x) => (v === "#" ? [[x, y]] : [])),
  )[0];
  assert.deepEqual(gridPath(data.village, [24, 24], solid), []);
});
test("procedural geometry is finite, indices stay in bounds, and generation is repeatable", () => {
  const a = makeWorld(data),
    b = makeWorld(data);
  assert.equal(a.trees, b.trees);
  assert.ok(a.trees > 500);
  assert.equal(a.batches.length, b.batches.length);
  for (const [id, m] of a.meshes) {
    const n = m.vb.byteLength / 16;
    for (const i of m.ib) assert.ok(i < n, `${id}: ${i}/${n}`);
    const f = new Float32Array(m.vb);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < 3; k++) assert.ok(Number.isFinite(f[i * 4 + k]), id);
  }
  for (let i = 0; i < a.batches.length; i++) {
    const batch = a.batches[i];
    assert.equal(batch.data.length % 16, 0);
    assert.ok(batch.data.every(Number.isFinite));
    assert.deepEqual(batch.data, b.batches[i].data);
  }
  assert.equal(a.paths.length, 7);
  assert.ok(a.paths.every((p) => p.length));
  assert.ok(a.lights.length <= 32);
});
