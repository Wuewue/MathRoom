import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApp} from '../server.mjs';
import {request} from 'node:http';

test('Phase 2 API and persistence', async t=>{
  const prefix=join(tmpdir(),'mathroom-phase2-'),directory=mkdtempSync(prefix),dbPath=join(directory,'test.sqlite');
  let app=createApp({dbPath}),base;
  async function listen(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port}
  await listen();
  function client(){
    let cookie='';
    return async(path,method='GET',data,extra={})=>{
      const response=await fetch(base+'/api'+path,{method,headers:{...(method==='GET'?{}:{'content-type':'application/json','x-mathroom-request':'1'}),...(cookie?{cookie}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});
      if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
      return {status:response.status,body:await response.json(),headers:response.headers};
    }
  }
  const tutor=client(),alice=client(),bob=client(),anon=client();
  let aliceId,bobId,chapterId,privateChapter,lessonId,secondLesson;
  const lesson={title:'Factoring together',startsAt:'2026-11-02T09:00:00.000Z',duration:60,status:'scheduled',performance:'Good progress',summary:'Factoring and roots',comment:'Show each step.'};
  try{
    await t.test('public signup is unavailable; tutor is provisioned outside HTTP',async()=>{
      assert.equal((await anon('/chapters')).status,401);
      assert.equal((await anon('/setup','POST',{username:'intruder',name:'Intruder',password:'Intruder-password-123'})).status,401);
      await app.provisionTutor({username:'Tutor',name:'Test tutor',password:'Tutor-password-123'});
      const result=await tutor('/login','POST',{username:'Tutor',password:'Tutor-password-123'});
      assert.equal(result.status,200);assert.equal(result.body.user.username,'tutor');
      assert.match(result.headers.get('set-cookie'),/HttpOnly/);assert.match(result.headers.get('set-cookie'),/SameSite=Strict/);
      assert.equal((await tutor('/setup','POST',{username:'second',name:'Second',password:'Another-password'})).status,404);
      await assert.rejects(app.provisionTutor({username:'second',name:'Second',password:'Another-password'}),/already exists/);
    });
    await t.test('password validation, normalized unique usernames, no hashes returned',async()=>{
      assert.equal((await tutor('/students','POST',{name:'Alice',username:'alice',password:'short'})).status,400);
      const a=await tutor('/students','POST',{name:'Alice',username:'Alice',password:'Alice-temp-123'});
      assert.equal(a.status,201);aliceId=a.body.student.id;
      assert.equal('password_hash' in a.body.student,false);assert.equal(a.body.student.mustChange,true);
      const b=await tutor('/students','POST',{name:'Bob',username:'bob',password:'Bob-temp-123'});bobId=b.body.student.id;
      assert.equal((await tutor('/students','POST',{name:'Other',username:'ALICE',password:'Other-temp-123'})).status,409);
    });
    await t.test('temporary passwords force change before data access',async()=>{
      assert.equal((await alice('/login','POST',{username:'ALICE',password:'Alice-temp-123'})).status,200);
      assert.equal((await alice('/chapters')).status,403);
      assert.equal((await alice('/password','POST',{currentPassword:'incorrect',newPassword:'Alice-own-123'})).status,400);
      assert.equal((await alice('/password','POST',{currentPassword:'Alice-temp-123',newPassword:'Alice-own-123'})).status,200);
      assert.equal((await alice('/me')).body.user.mustChange,false);
      await bob('/login','POST',{username:'bob',password:'Bob-temp-123'});
      await bob('/password','POST',{currentPassword:'Bob-temp-123',newPassword:'Bob-own-123'});
    });
    await t.test('students cannot list accounts, create users, or create chapters',async()=>{
      assert.equal((await alice('/students')).status,403);
      assert.equal((await alice('/students','POST',{name:'Intruder',username:'xuser',password:'Password-123'})).status,403);
      assert.equal((await alice('/chapters','POST',{number:1,title:'Bad',studentIds:[]})).status,403);
      assert.equal((await alice('/students/'+aliceId,'PATCH',{role:'admin',name:'Alice'})).status,403);
    });
    await t.test('chapter creation, enrollment and student isolation',async()=>{
      const chapter=await tutor('/chapters','POST',{number:2,title:'Quadratics',description:'Factors and roots',studentIds:[aliceId,bobId]});
      assert.equal(chapter.status,201);chapterId=chapter.body.id;
      const hidden=await tutor('/chapters','POST',{number:3,title:'Alice private chapter',studentIds:[aliceId]});privateChapter=hidden.body.id;
      assert.equal((await bob('/chapters')).body.chapters.length,1);
      assert.equal((await alice('/chapters')).body.chapters.length,2);
      assert.equal((await bob('/chapters')).body.chapters[0].studentIds,undefined);
      assert.equal((await tutor('/chapters','POST',{number:2,title:'Duplicate',studentIds:[]})).status,409);
      assert.equal((await tutor('/chapters','POST',{number:5,title:'Invalid',studentIds:[999]})).status,400);
    });
    await t.test('chapter edits persist and are visible to enrolled students',async()=>{
      assert.equal((await tutor('/chapters/'+chapterId,'PUT',{number:2,title:'Quadratic equations',description:'Revised plan',studentIds:[aliceId,bobId]})).status,200);
      assert.equal((await alice('/chapters')).body.chapters[0].title,'Quadratic equations');
    });
    await t.test('lessons validate membership, duration, dates and overlap',async()=>{
      assert.equal((await tutor('/lessons','POST',{...lesson,studentId:bobId,chapterId:privateChapter})).status,400);
      assert.equal((await tutor('/lessons','POST',{...lesson,studentId:aliceId,chapterId,duration:1})).status,400);
      assert.equal((await tutor('/lessons','POST',{...lesson,studentId:aliceId,chapterId,startsAt:'invalid'})).status,400);
      const created=await tutor('/lessons','POST',{...lesson,studentId:aliceId,chapterId});
      assert.equal(created.status,201);lessonId=created.body.lesson.id;
      assert.equal(created.body.lesson.starts_at,'2026-11-02T09:00:00.000Z');
      assert.equal((await tutor('/lessons','POST',{...lesson,studentId:bobId,chapterId,startsAt:'2026-11-02T09:30:00Z'})).status,409);
      const second=await tutor('/lessons','POST',{...lesson,studentId:bobId,chapterId,startsAt:'2026-11-02T10:00:00Z'});assert.equal(second.status,201);secondLesson=second.body.lesson.id;
    });
    await t.test('each student can only read their own lessons and comments',async()=>{
      const mine=await alice('/lessons');assert.equal(mine.body.lessons.length,1);assert.equal(mine.body.lessons[0].comment,'Show each step.');
      assert.equal((await bob('/lessons/'+lessonId)).status,404);
      assert.equal((await alice('/lessons/'+secondLesson)).status,404);
      assert.equal((await alice('/lessons/'+lessonId)).status,200);
      assert.equal((await alice('/lessons/'+lessonId,'PUT',{...lesson,studentId:aliceId,chapterId})).status,403);
    });
    await t.test('lesson feedback edits and cancellation update student view',async()=>{
      const updated=await tutor('/lessons/'+lessonId,'PUT',{...lesson,studentId:aliceId,chapterId,status:'completed',comment:'Improved checking of both roots.'});
      assert.equal(updated.status,200);
      assert.equal((await alice('/lessons/'+lessonId)).body.lesson.comment,'Improved checking of both roots.');
      assert.equal((await tutor('/chapters/'+chapterId,'PUT',{number:2,title:'Quadratics',studentIds:[bobId]})).status,409);
      assert.equal((await tutor('/lessons/'+lessonId,'PUT',{...lesson,studentId:aliceId,chapterId,status:'cancelled'})).status,200);
      assert.equal((await alice('/lessons/'+lessonId)).body.lesson.status,'cancelled');
    });
    await t.test('disabling student revokes existing sessions and blocks login',async()=>{
      assert.equal((await tutor('/students/'+aliceId,'PATCH',{active:false})).status,200);
      assert.equal((await alice('/me')).status,401);
      assert.equal((await alice('/login','POST',{username:'alice',password:'Alice-own-123'})).status,401);
      assert.equal((await tutor('/students/'+aliceId,'PATCH',{active:true})).status,200);
      assert.equal((await alice('/login','POST',{username:'alice',password:'Alice-own-123'})).status,200);
    });
    await t.test('tutor password reset revokes sessions and old password',async()=>{
      assert.equal((await tutor('/students/'+aliceId+'/reset-password','POST',{password:'Alice-reset-123'})).status,200);
      assert.equal((await alice('/me')).status,401);
      assert.equal((await alice('/login','POST',{username:'alice',password:'Alice-own-123'})).status,401);
      const reset=await alice('/login','POST',{username:'alice',password:'Alice-reset-123'});
      assert.equal(reset.status,200);assert.equal(reset.body.user.mustChange,true);
      await alice('/password','POST',{currentPassword:'Alice-reset-123',newPassword:'Alice-final-123'});
    });
    await t.test('CSRF header, origin and local host protections',async()=>{
      assert.equal((await tutor('/chapters','POST',{number:9,title:'Cross origin',studentIds:[]},{origin:'https://evil.example'})).status,403);
      assert.equal((await tutor('/chapters','POST',{number:9,title:'No header',studentIds:[]},{'x-mathroom-request':''})).status,403);
      const status=await new Promise((resolve,reject)=>{const req=request(base+'/api/status',{headers:{host:'evil.example'}},response=>{response.resume();resolve(response.statusCode)});req.on('error',reject);req.end()});
      assert.equal(status,403);
    });
    await t.test('failed logins are rate limited',async()=>{
      for(let i=0;i<8;i++)assert.equal((await anon('/login','POST',{username:'unknown',password:'incorrect'})).status,401);
      assert.equal((await anon('/login','POST',{username:'unknown',password:'incorrect'})).status,429);
    });
    await t.test('passwords and session tokens are stored as hashes',async()=>{
      const rows=app.db.prepare('SELECT password_hash FROM users').all();
      for(const row of rows){assert.match(row.password_hash,/^[a-f0-9]{32}:[a-f0-9]{128}$/);assert.ok(!row.password_hash.includes('password'))}
      const sessions=app.db.prepare('SELECT token_hash FROM sessions').all();assert.ok(sessions.length>0);assert.match(sessions[0].token_hash,/^[a-f0-9]{64}$/);
    });
    await t.test('data and valid sessions survive a server restart',async()=>{
      await app.close();app=createApp({dbPath});await listen();
      assert.equal((await tutor('/me')).status,200);
      assert.equal((await tutor('/students')).body.students.length,2);
      assert.equal((await tutor('/chapters')).body.chapters.length,2);
      assert.equal((await alice('/lessons')).body.lessons.length,1);
    });
    await t.test('logout invalidates session and active student limit enforced',async()=>{
      assert.equal((await alice('/logout','POST',{})).status,200);assert.equal((await alice('/me')).status,401);
      for(let i=0;i<8;i++)assert.equal((await tutor('/students','POST',{name:'Extra '+i,username:'extra'+i,password:'Temporary-123'})).status,201);
      assert.equal((await tutor('/students','POST',{name:'Excess',username:'excess',password:'Temporary-123'})).status,409);
      await tutor('/students/'+bobId,'PATCH',{active:false});
      assert.equal((await tutor('/students','POST',{name:'Replacement',username:'replacement',password:'Temporary-123'})).status,201);
      assert.equal((await tutor('/students/'+bobId,'PATCH',{active:true})).status,409);
    });
    await t.test('static app is served with theme and security headers',async()=>{
      const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/theme.js/);
      assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
      assert.equal((await fetch(base+'/style.css')).status,200);assert.equal((await fetch(base+'/app.js')).status,200);
      assert.equal((await fetch(base+'/server.mjs')).status,404);
    });
  }finally{
    await app.close();
    assert.ok(resolve(directory).startsWith(resolve(prefix)));
    rmSync(directory,{recursive:true,force:true});
  }
});
