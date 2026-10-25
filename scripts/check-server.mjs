import { spawn } from "node:child_process";
const child=spawn(process.execPath,['scripts/next.mjs','start','--port','4317'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let diagnostic='';child.stdout.on('data',c=>diagnostic+=c);child.stderr.on('data',c=>diagnostic+=c);
let ready=false;
try {
 for(let i=0;i<100;i++) {
  if(child.exitCode!==null)throw new Error('Server exited: '+diagnostic);
  try{const response=await fetch('http://127.0.0.1:4317/',{signal:AbortSignal.timeout(2000)});if(response.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!ready)throw new Error('Loopback server did not become ready: '+diagnostic);
 if(!diagnostic.includes('127.0.0.1'))throw new Error('Loopback hostname missing');
 console.log('Production page responds on loopback. No provider calls made.');
}finally {
 if(process.platform==='win32') {
  const {spawnSync}=await import('node:child_process');const {join}=await import('node:path');
  spawnSync(join(process.env.SystemRoot,'System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
 }else child.kill('SIGTERM');
}
