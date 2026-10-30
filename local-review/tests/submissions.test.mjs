import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
test('submission lifecycle: privacy, deferred answer reveal, shared photos, attempts and assignment lock',async()=>{
 const app=createApp({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const client=()=>{let cookie='';return async(path,method='GET',data)=>{const form=data instanceof FormData,r=await fetch(base+'/api'+path,{method,headers:{cookie,...(method!=='GET'?{'X-Mathroom-Request':'1',...(!form?{'Content-Type':'application/json'}:{})}:{})},body:data===undefined?undefined:form?data:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:r.headers.get('content-type')?.includes('json')?await r.json():await r.arrayBuffer()}}};
 const tutor=client(),student=client(),other=client();
 try{
  await app.provisionTutor({username:'tutor',name:'Tutor',password:'Tutor-pass-123'});await tutor('/login','POST',{username:'tutor',password:'Tutor-pass-123'});
  let sid;for(const [c,name]of [[student,'maya'],[other,'other']]){const s=await tutor('/students','POST',{username:name,name,password:'Student-pass-123'});if(name==='maya')sid=s.body.student.id;await c('/login','POST',{username:name,password:'Student-pass-123'});await c('/password','POST',{currentPassword:'Student-pass-123',newPassword:'Student-new-123'})}
  const chapter=(await tutor('/chapters','POST',{number:1,title:'Algebra',studentIds:[sid]})).body.id;
  const a=(await tutor('/assignments','POST',{})).body.assignment;a.chapter_id=chapter;a.studentIds=[sid];a.due_at='2020-01-01T00:00:00Z';a.questions=[{source:'One?',type:'mc',points:2,options:['1','2'],correctIndex:0},{source:'Explain.',type:'reasoning',points:4,options:[]},{source:'Explain again.',type:'reasoning',points:4,options:[]}];
  assert.equal((await tutor('/assignments/'+a.id,'PUT',a)).status,200);await tutor('/assignments/'+a.id+'/publish','POST',{});const path='/work/'+a.id;
  assert.equal((await other(path)).status,404);assert.equal((await student(path)).body.result.items[0].correctIndex,undefined);
  assert.equal((await student(path+'/mc','POST',{answers:[9]})).status,400);
  let r=await student(path+'/mc','POST',{answers:[0]});assert.equal(r.body.result.items[0].score,null);assert.equal(r.body.result.items[0].correctIndex,undefined);assert.equal((await student('/results')).body.results[0].items[0].correctIndex,undefined);assert.equal(r.body.result.percentage,null);assert.equal(r.body.result.late,true);
  assert.equal((await student(path+'/mc','POST',{answers:[1]})).status,409);assert.equal((await tutor('/assignments/'+a.id+'/unpublish','POST',{})).status,409);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
  function photos(attempt,valid=true){const f=new FormData();f.set('index','1');f.set('attempt',String(attempt));f.append('photos',new Blob([valid?png:Buffer.from('bad')],{type:'image/png'}),'work.png');return f}
  assert.equal((await student(path+'/photo','POST',photos(0,false))).status,400);
  r=await student(path+'/photo','POST',photos(0));assert.equal(r.status,200);const old=r.body.result.photos[0];assert.equal(r.body.result.items[2].attempt,1);assert.equal(r.body.result.items[0].correctIndex,0);assert.equal(r.body.result.items[0].score,2);assert.equal(r.body.result.submitted,true);
  assert.equal((await other('/response-photos/'+old)).status,404);assert.equal((await student('/response-photos/'+old)).status,200);
  const grade=(attempt,score)=>({studentId:sid,index:1,attempt,score,feedback:'Keep going'});
  assert.equal((await student(path+'/grade','POST',grade(1,8))).status,403);
  assert.equal((await tutor(path+'/grade','POST',grade(1,9))).status,400);
  await tutor(path+'/grade','POST',{...grade(1,4),index:2});r=await tutor(path+'/grade','POST',grade(1,4));assert.equal(r.body.result.percentage,100);
  assert.equal((await student(path+'/photo','POST',photos(1,false))).status,400);assert.equal((await student('/response-photos/'+old)).status,200);
  r=await student(path+'/photo','POST',photos(1));assert.equal(r.body.result.items[1].attempt,2);assert.equal(r.body.result.items[2].attempt,2);assert.equal(r.body.result.items[2].score,null);assert.equal(r.body.result.items[1].feedback,'');assert.equal(r.body.result.percentage,null);
  assert.equal((await student('/response-photos/'+old)).status,404);assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM response_photos').get().n,1);
  assert.equal((await tutor(path+'/grade','POST',grade(1,4))).status,409);
  assert.equal((await student(path+'/photo','POST',photos(2))).status,409);
  await tutor(path+'/grade','POST',{...grade(2,2),index:2});r=await tutor(path+'/grade','POST',grade(2,2));assert.equal(r.body.result.percentage,60);
  assert.equal((await student('/results')).body.results[0].percentage,60);assert.equal((await other('/results')).body.results.length,0);
  async function paper(questions){const fresh=(await tutor('/assignments','POST',{})).body.assignment;await tutor('/assignments/'+fresh.id,'PUT',{...a,questions});await tutor('/assignments/'+fresh.id+'/publish','POST',{});return '/work/'+fresh.id}
  const mixed=await paper(a.questions);
  assert.equal((await student(mixed+'/photo','POST',photos(0))).status,409,'reasoning cannot bypass the multiple-choice step');
  const mcOnly=await paper([a.questions[0]]),mcResult=await student(mcOnly+'/mc','POST',{answers:[0]});
  assert.equal(mcResult.body.result.submitted,true);assert.equal(mcResult.body.result.percentage,100);assert.equal(mcResult.body.result.items[0].correctIndex,0);
  const reasoningOnly=await paper(a.questions.slice(1)),reasonResult=await student(reasoningOnly+'/photo','POST',photos(0));
  assert.equal(reasonResult.status,200);assert.equal(reasonResult.body.result.submitted,true);assert.equal(reasonResult.body.result.photos.length,1);assert.equal(reasonResult.body.result.items[1].attempt,1);
 }finally{await app.close()}
});
