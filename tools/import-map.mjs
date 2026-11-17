import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
// Explicit input path avoids coupling this independent repository to one developer's workspace layout.
const [input, commit] = process.argv.slice(2);
if (!input || !/^[a-f0-9]{40}$/.test(commit || ""))
  throw new Error(
    "Usage: node tools/import-map.mjs <legacy-map-data.ts> <40-character-source-commit>",
  );
const raw = readFileSync(input, "utf8"),
  value = raw
    .slice(raw.indexOf("=") + 1)
    .trim()
    .replace(/;$/, "");
const source = JSON.parse(value);
if (
  source.maps.village.w !== 50 ||
  source.maps.village.h !== 40 ||
  source.maps.village.buildings.length !== 7
)
  throw new Error(
    "Map shape changed; review placement assumptions before importing.",
  );
const output = {
  schema: "frostecho.webgpu-map/1",
  source: {
    repository: "https://github.com/PoetryJ/frostecho",
    commit,
    path: "src/spatial-v2/legacy-map-data.ts",
    sha256: createHash("sha256").update(raw).digest("hex"),
    profile: source.schema,
  },
  tileMetres: 2,
  village: source.maps.village,
  kitchen: source.maps.kitchen,
};
writeFileSync(
  new URL("../data/frostecho-map.json", import.meta.url),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  "Imported village and kitchen metadata; run node tools/check.mjs and visually inspect all viewpoints.",
);
