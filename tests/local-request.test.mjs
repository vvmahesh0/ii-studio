import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedOrigin,generationInput} from '../app/lib/openui/request.ts';
import {requestText} from '../app/lib/model/request-body.ts';
test('local origin rejects remote hosts, foreign/null origins and unsupported protocols',()=>{
 const request=(host,origin)=>new Request('http://127.0.0.1:3000/api/openui/generate',{headers:{host,...(origin===undefined?{}:{origin})}});
 assert.equal(allowedOrigin(request('127.0.0.1:3000','http://127.0.0.1:3000')),true);
 assert.equal(allowedOrigin(request('localhost:3000','http://localhost:3000')),true);
 assert.equal(allowedOrigin(request('attacker.example','http://attacker.example')),false);
 assert.equal(allowedOrigin(request('127.0.0.1:3000','https://attacker.example')),false);
 assert.equal(allowedOrigin(request('127.0.0.1:3000','null')),false);
});
test('request limits use actual UTF-8 byte size',async()=>{
 assert.equal((await requestText(new Request('http://localhost',{method:'POST',body:'₹'.repeat(20)}),30)).status,413);
 assert.equal(await requestText(new Request('http://localhost',{method:'POST',body:'small'}),30),'small');
});
test('generation input bounds and types are preserved without demo quotas',()=>{
 assert.equal(generationInput({prompt:'x'.repeat(20001)}),null);
 assert.equal(generationInput({prompt:'hello',previous:{}}),null);
 assert.equal(generationInput({prompt:'hello',previous:'x'.repeat(64001)}),null);
 assert.deepEqual(generationInput({prompt:'  valid screen  '}),{prompt:'valid screen',previous:''});
});
