import {existsSync,copyFileSync,chmodSync,constants} from "node:fs";
import {spawnSync} from "node:child_process";
if(process.platform!=="darwin" || process.arch!=="arm64") {console.error("This release currently supports Apple Silicon macOS only.");process.exit(1);}
if(Number(process.versions.node.split(".")[0])<24){console.error("Install Node.js 24 or later first.");process.exit(1);}
if(!existsSync("package-lock.json")){console.error("Run setup from the II studio repository root.");process.exit(1);}
if(!existsSync(".env.local")){copyFileSync(".env.example",".env.local",constants.COPYFILE_EXCL);chmodSync(".env.local",0o600);}
const result=spawnSync("npm",["ci"],{stdio:"inherit"});
if(result.status!==0)process.exit(result.status??1);
console.log("Dependencies ready. Choose your CLI in .env.local, authenticate through that CLI, then run npm run dev. No existing settings were overwritten.");
