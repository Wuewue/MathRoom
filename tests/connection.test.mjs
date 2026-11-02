import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withConnection} from '../supabase/functions/mathroom/connection.mjs';
test('each request owns a connection which closes on success or failure',async()=>{
 const connections=[];
 const create=()=>{const c={closed:0,async end(){this.closed++}};connections.push(c);return c};
 await Promise.all([withConnection(create,async c=>{assert.equal(c.closed,0);return 1}),withConnection(create,async()=>2)]);
 await assert.rejects(withConnection(create,async()=>{throw new Error('read failed')}),/read failed/);
 assert.equal(new Set(connections).size,3);assert.ok(connections.every(c=>c.closed===1));
});
