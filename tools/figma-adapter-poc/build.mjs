import { build } from "esbuild";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { zipSync } from "fflate";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL(".", import.meta.url));
await build({
  entryPoints: [dir + "src/plugin.ts"],
  bundle: true,
  platform: "browser",
  target: "es2018",
  outfile: dir + "plugin/code.js",
  minify: true,
});
await build({
  entryPoints: [dir + "src/importer.ts"],
  bundle: true,
  platform: "browser",
  target: "es2018",
  format: "iife",
  globalName: "IIStudioFigma",
  outfile: dir + "evidence/importer.js",
  minify: true,
});
console.log(
  "Built local plugin and the same importer for API verification. No network dependencies.",
);

const downloads=fileURLToPath(new URL("../../public/downloads/", import.meta.url));
await mkdir(downloads,{recursive:true});
// Archive contains only the built runtime, UI and instructions. No tooling needed.
const archive=downloads+"ii-studio-figma-plugin.zip";
// zip updates existing archives; use a fresh temporary filename to avoid stale entries.
const temporary=downloads+"ii-studio-figma-plugin-build.zip";
const files = ["manifest.json", "code.js", "ui.html", "INSTALL.md", "THIRD_PARTY_NOTICES.txt"];
const entries = Object.fromEntries(await Promise.all(files.map(async name => [name, new Uint8Array(await readFile(dir + "plugin/" + name))])));
await writeFile(temporary, zipSync(entries, { level: 6 }));
await rename(temporary, archive);
console.log("Packaged public/downloads/ii-studio-figma-plugin.zip");
