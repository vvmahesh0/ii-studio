import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('tools/figma-adapter-poc/plugin/ui.html','utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function setup(){
 const elements=new Map(),listeners={},messages=[];
 const node=()=>({value:'',hidden:false,disabled:false,dataset:{},children:[],textContent:'',classList:{add(){},remove(){}},focus(){this.focused=true;},append(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(type,fn){this.listeners??={};this.listeners[type]=fn;}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);},querySelector(selector){return this.getElementById(selector);},createElement:()=>node(),createTextNode:t=>t,addEventListener(type,fn){listeners[type]=fn;}};
 const context=vm.createContext({document,navigator:{userAgent:'test',clipboard:{}},isSecureContext:true,parent:{postMessage:m=>messages.push(m.pluginMessage)},Blob,URL,Date,Math,performance,setTimeout});
 vm.runInContext(code,context);
 return {elements,listeners,messages,context};
}
test('plugin paste target is an editable, autofocused textarea rather than a button',()=>{
 assert.match(html,/<textarea[^>]+id="payload"[^>]+autofocus/);
 assert.doesNotMatch(html,/<button[^>]+id="payload"/);
 const s=setup();assert.equal(s.elements.get('payload').focused,true);
 assert.doesNotMatch(code,/clipboard\.read(?:Text)?\(/);
});
test('one native paste dispatches exactly one automatic import and blocks duplicates while busy',()=>{
 const s=setup();let prevented=0;const event={preventDefault(){prevented++;},clipboardData:{getData:()=>'{"format":"ii-studio-design"}',types:['text/plain']}};
 s.listeners.paste(event);assert.equal(prevented,1);assert.equal(s.messages.length,1);assert.equal(s.messages[0].type,'import');assert.equal(s.elements.get('payload').disabled,true);
 s.listeners.paste(event);assert.equal(s.messages.length,1);
});
test('missing clipboard data reports a recoverable failure without importing',()=>{
 const s=setup();s.listeners.paste({preventDefault(){},clipboardData:null});assert.equal(s.messages.length,0);assert.equal(s.elements.get('status').dataset.state,'error');assert.equal(s.elements.get('payload').disabled,false);
});
test('text-input paste fallback automatically imports and clears the editable value',()=>{
 const s=setup(),field=s.elements.get('payload');field.value='II_STUDIO_DESIGN_V1\n{}';field.listeners.input();assert.equal(s.messages.length,1);assert.equal(field.value,'');
});
test('success message correlates request ID, re-enables paste, and preserves report functionality',()=>{
 const s=setup();s.listeners.paste({preventDefault(){},clipboardData:{getData:()=>'{}',types:['text/plain']}});
 s.context.onmessage({data:{pluginMessage:{type:'success',requestId:s.messages[0].requestId,title:'Synthetic card',result:{layers:3,warnings:[]}}}});
 assert.equal(s.elements.get('payload').disabled,false);assert.equal(s.elements.get('status').dataset.state,'success');assert.equal(s.elements.get('import').disabled,false);
 assert.ok(s.elements.get('report').onclick);
});
test('file drop uses the same bounded import path, not clipboard-read permissions',async()=>{
 const s=setup();await s.elements.get('dropzone').listeners.drop({preventDefault(){},dataTransfer:{files:[{size:2,text:async()=>'{}'}]}});await new Promise(r=>setTimeout(r,0));assert.equal(s.messages.length,1);assert.equal(s.messages[0].type,'import');
});
