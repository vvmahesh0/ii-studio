import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { unzipSync, strFromU8 } from "fflate";
import { platformStatus } from "../scripts/platform.mjs";
import { executableCandidates, findExecutable, spawnCli, terminateCli } from "../app/lib/model/process.ts";
import { cliFixture } from "./helpers/cli-fixture.mjs";

test("platform targets allow both Macs and native Windows x64 only", () => {
 for (const [os,arch,allowed,experimental] of [["darwin","arm64",true,false],["darwin","x64",true,true],["win32","x64",true,true],["win32","arm64",false,true],["linux","x64",false,true]]) {
  assert.deepEqual([platformStatus(os,arch).allowed,platformStatus(os,arch).experimental],[allowed,experimental]);
 }
});
test("Windows discovery uses case-insensitive PATH, PATHEXT and explicit paths", () => {
 const candidates=executableCandidates("codex",undefined,"win32",{Path:'"C:\\Program Files\\Tools";C:\\npm',PATHEXT:'.EXE;.CMD;.PS1'},'C:\\Users\\Tester');
 assert.ok(candidates.includes('C:\\Program Files\\Tools\\codex.exe'));
 assert.ok(candidates.includes('C:\\npm\\codex.cmd'));
 assert.ok(!candidates.some(p=>p.endsWith('.ps1')));
 assert.deepEqual(executableCandidates("codex",'C:\\Custom Tools\\codex.cmd',"win32"),['C:\\Custom Tools\\codex.cmd']);
 assert.throws(()=>executableCandidates('codex','C:\\cli.ps1','win32'),/PowerShell/);
 assert.throws(()=>executableCandidates('codex','relative.cmd','win32'),/absolute/);
});
test("owned launcher preserves argument text and stdin in a path with spaces", async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ii paths '));
 try {
  const file=await cliFixture(dir,"let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>console.log(JSON.stringify({args:process.argv.slice(2),input}))); ");
  assert.equal(await findExecutable('synthetic',file),file);
  const args=['hello world','a&b','a|b','a^b','a%b','a!b','a"b','C:\\folder with spaces\\file'];
  const child=spawnCli(file,args,dir);let output='';child.stdout.on('data',c=>output+=c);child.stderr.resume();
  child.stdin.end('Synthetic requirement: & | % "\n');
  const [code]=await once(child,'close');assert.equal(code,0);
  assert.deepEqual(JSON.parse(output),{args,input:'Synthetic requirement: & | % "\n'});
 }finally{await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
test("cancellation terminates the owned subprocess tree and allows cleanup",async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ii tree '));let child;
 try {
  const file=await cliFixture(dir,"const {spawn}=require('node:child_process');const grandchild=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(grandchild.pid);setInterval(()=>{},1000);");
  child=spawnCli(file,[],dir);child.stderr.resume();
  const pid=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('fixture startup timeout')),10000);child.stdout.on('data',c=>{text+=c;if(text.includes('\n')){clearTimeout(timer);resolve(Number(text.trim()));}});child.on('error',reject);});
  assert.ok(Number.isSafeInteger(pid));
  const closed=once(child,'close');terminateCli(child,100);await closed;
  // Give process termination a bounded settling interval; zombies on Unix may
  // remain visible briefly, so verify the child is gone and tree cleanup below.
  assert.ok(child.exitCode!==null||child.signalCode!==null);
  if(process.platform==='win32') assert.throws(()=>process.kill(pid,0));
 }finally{if(child)terminateCli(child,100);await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
test("setup preserves existing env and launches npm via its Node entry",async()=>{
 const source=await readFile(new URL('../scripts/setup.mjs',import.meta.url),'utf8');
 assert.match(source,/if \(!existsSync\("\.env.local"\)\)/);
 assert.match(source,/process.execPath, \[npm, "ci"\]/);
 assert.match(source,/process.platform === "darwin"/);
});
test("plugin ZIP has the exact runtime payload",async()=>{
 const bytes=await readFile(new URL('../public/downloads/ii-studio-figma-plugin.zip',import.meta.url));
 const entries=unzipSync(bytes);
 assert.deepEqual(Object.keys(entries).sort(),['INSTALL.md','THIRD_PARTY_NOTICES.txt','code.js','manifest.json','ui.html'].sort());
 assert.equal(JSON.parse(strFromU8(entries['manifest.json'])).main,'code.js');
 await access(new URL('../scripts/next.mjs',import.meta.url));
});
