import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeWorld, buildingPlacement, gridPath } from "../src/world.js";
import { coniferMeshes, roundedRoofSnow } from "../src/detail-geometry.js";
import { groundDetailMap } from "../src/ground-map.js";

const data = JSON.parse(
  fs.readFileSync(new URL("../data/frostecho-map.json", import.meta.url)),
);

test("close and distant conifers share a silhouette family while distant geometry stays smaller", () => {
  const m = coniferMeshes();
  assert.ok(m.pineFar.ib.length < m.pine.ib.length / 2);
  assert.ok(m.pineSnowFar.ib.length < m.pineSnow.ib.length / 2);
  for (const mesh of Object.values(m))
    assert.ok(mesh.nv > 0 && mesh.ib.length > 0);
  const roof = roundedRoofSnow();
  const vertices = new Float32Array(roof.vb);
  const ridge = [];
  for (let i = 0; i < vertices.length; i += 4)
    if (Math.abs(vertices[i]) < 0.001) ridge.push(vertices[i + 1]);
  assert.ok(
    Math.max(...ridge) - Math.min(...ridge) > 0.005,
    "roof snow must have a varying surface, not a flat sheet",
  );
});

test("snow-path texture contains local wear without changing source navigation", () => {
  const cells = new Set(["15,30"]);
  const map = groundDetailMap(
    cells,
    (x, y) => [(x - 25) * 2, (y - 20) * 2],
    [],
  );
  const channel = (x, z, c) =>
    map.data[
      (Math.floor((x / map.span + 0.5) * map.size) +
        Math.floor((z / map.span + 0.5) * map.size) * map.size) *
        4 +
        c
    ];
  assert.ok(channel(-19, 21, 0) > 0);
  assert.equal(channel(70, 70, 0), 0);
  assert.ok(
    map.data.some((v, i) => i % 4 === 1 && v > 0),
    "footprints must be represented",
  );
  assert.equal(cells.size, 1);
});
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
