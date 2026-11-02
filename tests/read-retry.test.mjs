import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withReadRetry} from '../supabase/functions/mathroom/read-retry.mjs';
test('read request recovers once after a stale database connection',async()=>{
  let calls=0;
  const value=await withReadRetry('GET',async()=>{if(++calls===1)throw Object.assign(new Error('closed'),{code:'CONNECTION_CLOSED'});return ['assignments']});
  assert.deepEqual(value,['assignments']);assert.equal(calls,2);
});
test('persistent failures stop after two attempts',async()=>{
  let calls=0;await assert.rejects(withReadRetry('GET',async()=>{calls++;throw Object.assign(new Error('closed'),{code:'CONNECTION_CLOSED'})}),/closed/);
  assert.equal(calls,2);
});
test('writes and nonconnection errors are never replayed',async()=>{
  for(const [method,code] of [['POST','CONNECTION_CLOSED'],['PUT','ECONNRESET'],['PATCH','EPIPE'],['GET','23505'],['GET',undefined]]){
    let calls=0;await assert.rejects(withReadRetry(method,async()=>{calls++;throw Object.assign(new Error('failure'),{code})}));assert.equal(calls,1);
  }
});
