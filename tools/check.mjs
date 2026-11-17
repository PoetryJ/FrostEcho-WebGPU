import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const commands = [
  ...readdirSync("src")
    .filter((f) => f.endsWith(".js"))
    .map((f) => ["--check", `src/${f}`]),
  ["--test", "tests/world.test.mjs"],
];
for (const args of commands) {
  const r = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(
  "JavaScript syntax and map/geometry checks passed. WGSL compilation is checked in the running browser.",
);
