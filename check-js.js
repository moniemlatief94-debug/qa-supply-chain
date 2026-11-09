import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const directories = ["server", "public", "scripts"];
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) await collect(target);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(target);
  }
}

for (const directory of directories) await collect(join(root, directory));
let failed = false;
for (const file of files.sort()) {
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status !== 0) {
    failed = true;
    process.stderr.write(`${file}\n${check.stderr || check.stdout}`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`JavaScript syntax OK (${files.length} files).`);
