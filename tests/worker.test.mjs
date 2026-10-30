import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
test('proxy rejects foreign origins and missing CSRF header before reaching backend',async()=>{
 for(const headers of [{'X-Mathroom-Request':'1',Origin:'https://other.example'},{}]){const r=await worker.fetch(new Request('https://app.example/api/login',{method:'POST',headers}),{});assert.equal(r.status,403)}
});
test('proxy uses fixed backend and forwards only necessary headers and secure cookie',async()=>{
 const original=globalThis.fetch;let target,options;globalThis.fetch=async(u,o)=>{target=u;options=o;return new Response('{}',{headers:{'Set-Cookie':'mathroom_session=test; Secure; HttpOnly','Content-Type':'application/json'}})};
 try{const r=await worker.fetch(new Request('https://app.example/api/me?student=2',{headers:{Cookie:'mathroom_session=test',Authorization:'untrusted'}}),{SUPABASE_API:'https://backend.example/mathroom'});assert.equal(target,'https://backend.example/mathroom/api/me?student=2');assert.equal(options.headers.get('Authorization'),null);assert.equal(options.headers.get('cookie'),'mathroom_session=test');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.ok(r.headers.has('Content-Security-Policy'))}finally{globalThis.fetch=original}
});
