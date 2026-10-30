import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createApp} from '../server.mjs';
import {backupDatabase} from '../scripts/backup.mjs';
test('online backup restores committed WAL data and photo bytes without overwriting snapshots',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mathroom-backup-')),source=join(root,'source.sqlite'),app=createApp({dbPath:source});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{
  await app.provisionTutor({username:'backup_tutor',name:'Tutor',password:'Backup-test-123'});
  app.db.prepare("INSERT INTO assignments(title,questions) VALUES('Saved paper','[]')").run();
  app.db.prepare("INSERT INTO response_photos(assignment_id,student_id,question_index,mime,data) VALUES(1,1,-1,'image/png',?)").run(Buffer.from([1,2,3,4]));
  const first=await backupDatabase(source,join(root,'snapshots'));
  app.db.prepare("UPDATE assignments SET title='Changed paper' WHERE id=1").run();
  const second=await backupDatabase(source,join(root,'snapshots'));assert.notEqual(first.folder,second.folder);
  const copy=new DatabaseSync(join(first.folder,first.file),{readOnly:true});
  try{assert.equal(copy.prepare('SELECT title FROM assignments').get().title,'Saved paper');assert.deepEqual(Buffer.from(copy.prepare('SELECT data FROM response_photos').get().data),Buffer.from([1,2,3,4]));assert.equal(copy.prepare('SELECT username FROM users').get().username,'backup_tutor')}finally{copy.close()}
  const bytes=await readFile(join(first.folder,first.file));assert.equal(first.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(first.counts.response_photos,1);
  await assert.rejects(backupDatabase(join(root,'missing.sqlite'),join(root,'snapshots')));
 }finally{await app.close();await rm(root,{recursive:true,force:true})}
});
