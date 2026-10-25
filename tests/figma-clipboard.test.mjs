import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['app/lib/figma/clipboard.ts'],bundle:true,format:'iife',globalName:'subject',write:false});
function setup(clipboard,secure=true){
 const context=vm.createContext({window:{isSecureContext:secure},navigator:{clipboard},Blob,performance,Error,ClipboardItem:class {constructor(data){this.data=data;}}});
 vm.runInContext(bundled.outputFiles[0].text,context);return context.subject.copyForFigma;
}
test('clipboard reservation happens before asynchronous extraction',async()=>{
 let reserve=false,prepared=false;
 const copy=setup({write:async items=>{reserve=true;assert.equal(prepared,false);assert.equal(await(await items[0].data['text/plain']).text(),'II_STUDIO_DESIGN_V1\n{}');}});
 const result=await copy(async()=>{assert.equal(reserve,true);prepared=true;return 'II_STUDIO_DESIGN_V1\n{}';});
 assert.equal(result.bytes,22);assert.ok(result.totalMs>=0);
});
test('denied clipboard write cannot report success',async()=>{
 const copy=setup({write:async()=>{throw new Error('NotAllowedError');}});
 await assert.rejects(copy(async()=>'payload'),/Nothing was copied/);
});
test('extraction failure remains actionable even when clipboard rejects',async()=>{
 const copy=setup({write:async items=>{await items[0].data['text/plain'];}});
 await assert.rejects(copy(async()=>{throw new Error('Unsupported image');}),/Unsupported image/);
});
test('insecure or unavailable clipboard fails before extraction',async()=>{
 let called=false;await assert.rejects(setup(undefined,false)(async()=>{called=true;return '';}),/secure/);assert.equal(called,false);
});

test('synchronous clipboard denial waits for extraction and explains recovery',async()=>{let prepared=false;const copy=setup({write(){throw new Error('NotAllowedError');}});await assert.rejects(copy(async()=>{await Promise.resolve();prepared=true;return 'payload';}),/Nothing was copied/);assert.equal(prepared,true);});
