import { existsSync, copyFileSync, chmodSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute } from "node:path";
import { platformStatus } from "./platform.mjs";
const platform = platformStatus();
if (!platform.allowed) { console.error(`This release targets macOS arm64/x64 and native Windows 11 x64. ${platform.label} is outside the current supported targets; do not bypass the guard or install WSL automatically.`); process.exit(1); }
if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Install a compatible Node.js 24+ release with npm first. No system tools were changed."); process.exit(1); }
if (!existsSync("package-lock.json")) { console.error("Run setup from the II studio repository root."); process.exit(1); }
const npm = process.env.npm_execpath;
if (!npm || !isAbsolute(npm) || !existsSync(npm) || !/\.(?:c?js|mjs)$/i.test(npm)) { console.error("Run npm run setup so npm supplies its Node entry point. No configuration changed."); process.exit(1); }
if (platform.experimental) console.warn(`${platform.label}: experimental. Installation checks do not establish authenticated AI provider compatibility.`);
if (!existsSync(".env.local")) {
  copyFileSync(".env.example", ".env.local", constants.COPYFILE_EXCL);
  if (process.platform === "darwin") chmodSync(".env.local", 0o600);
}
const result = spawnSync(process.execPath, [npm, "ci"], { stdio: "inherit", windowsHide: true });
if (result.error) { console.error("Dependency installation could not start. Check Node/npm and filesystem permissions; existing settings were preserved."); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Dependencies ready. Choose your installed CLI in .env.local and authenticate through its official login. Then run npm run dev. No existing settings were overwritten; Windows file permissions follow your account's filesystem ACLs.");
