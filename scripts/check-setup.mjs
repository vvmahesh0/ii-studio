import { readFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (process.env.CI !== 'true') throw new Error('This preservation fixture is CI-only; it must not touch user configuration.');
appendFileSync('.env.local','\n# Synthetic setup preservation marker\n');
const before=readFileSync('.env.local');
const result=spawnSync(process.execPath,['scripts/setup.mjs'],{stdio:'inherit',env:{...process.env,npm_execpath:process.env.npm_execpath},windowsHide:true});
if(result.status!==0)process.exit(result.status??1);
if(!readFileSync('.env.local').equals(before))throw new Error('Setup changed existing configuration');
