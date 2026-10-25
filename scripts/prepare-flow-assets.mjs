import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await mkdir("public/vendor", { recursive: true });
await copyFile(
  require.resolve("elkjs/lib/elk-worker.min.js"),
  "public/vendor/elk-worker.min.js",
);
await copyFile(
  require.resolve("elkjs/LICENSE.md"),
  "public/vendor/ELK-LICENSE.md",
);
