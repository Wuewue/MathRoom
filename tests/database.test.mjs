import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database,postgresStatement} from '../supabase/functions/mathroom/database.mjs';
test('Postgres parameters remain data and quoted question marks are preserved',()=>{
 assert.equal(postgresStatement("SELECT '?' AS literal FROM users WHERE name=? AND role='student'"),"SELECT '?' AS literal FROM users WHERE name=$1 AND role='student'");
 assert.equal(postgresStatement('INSERT OR IGNORE INTO enrollments(student_id,chapter_id) VALUES(?,?)'),'INSERT INTO enrollments(student_id,chapter_id) VALUES($1,$2) ON CONFLICT DO NOTHING');
});
test('photos go to private storage and deletion is queued in the same transaction',async()=>{
 const calls=[],uploaded=[];let removed=false;
 const sql={unsafe:async(s,p)=>{calls.push({s,p});if(s.startsWith('SELECT data FROM'))return [{data:'old/object'}];const rows=[{id:7}];rows.count=1;return rows}};
 const storage={upload:async(path,data,options)=>{assert.equal(options.upsert,false);assert.equal(data.toString(),'photo');return {}},remove:async()=>{removed=true}};
 const db=database(sql,storage,uploaded),r=await db.prepare('INSERT INTO response_photos(assignment_id,student_id,question_index,mime,data) VALUES(?,?,?,?,?)').run(1,2,-1,'image/png',Buffer.from('photo'));
 assert.equal(r.lastInsertRowid,7);assert.equal(uploaded.length,1);assert.equal(calls[0].p[4],uploaded[0]);assert.match(calls[0].s,/RETURNING id$/);
 await db.prepare('DELETE FROM response_photos WHERE assignment_id=? AND student_id=?').run(1,2);
 assert.ok(calls.some(c=>c.s.startsWith('INSERT INTO storage_cleanup')&&c.p[0]==='old/object'));assert.equal(removed,false);
});
