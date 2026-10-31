import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {authRoutes} from '../supabase/functions/mathroom/auth.mjs';
function harness(){
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE users(id integer primary key,auth_id text,email text,username text,name text,role text,active integer,must_change integer);
 CREATE TABLE sessions(token_hash text primary key,user_id integer,expires_at integer);
 CREATE TABLE login_limits(key text primary key,count integer,until_at integer);
 INSERT INTO users VALUES(1,'auth-tutor','long.tutor.address@example.com','tung','Tutor','admin',1,0);
 INSERT INTO users VALUES(2,'auth-student','maya@students.mathroom.invalid','maya','Maya','student',1,0);`);
 const calls=[];let identityOverride;
 const routes=authRoutes({db,provider:{},publicProvider:()=>({auth:{signInWithPassword:async({email,password})=>{
  calls.push(email);const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  return password==='Test-password-123'?{data:{user:identityOverride||{id:u.auth_id,email_confirmed_at:'2026-01-01'}},error:null}:{data:{user:null},error:{message:'invalid'}};
 }}}),requireThat:(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})},readJson:async req=>req.body,send:(res,status,body)=>{res.status=status;res.body=body;return true}});
 return {db,calls,setIdentity:v=>identityOverride=v,async login(identifier,password='Test-password-123',field='username'){
  const res={headers:{},setHeader(k,v){this.headers[k]=v}};
  try{await routes.handle({method:'POST',headers:{},body:{[field]:identifier,password}},res,'/api/login')}catch(e){res.status=e.status;res.body={error:e.message}}
  return res;
 }};
}
test('hosted login accepts normalized email and existing student usernames',async()=>{
 const h=harness();try{
  const email=await h.login('  LONG.TUTOR.ADDRESS@EXAMPLE.COM  ');assert.equal(email.status,200);assert.equal(email.body.user.username,'tung');assert.match(email.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await h.login('long.tutor.address@example.com','Test-password-123','email')).status,200);
  assert.equal((await h.login('maya')).body.user.role,'student');assert.equal((await h.login('tung')).status,200);
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM sessions').get().n,4);
 }finally{h.db.close()}
});
test('email login does not bypass account restrictions or reveal account existence',async()=>{
 const h=harness();try{
  const bad=await h.login('long.tutor.address@example.com','wrong'),unknown=await h.login('unknown@example.com','wrong');assert.equal(bad.status,401);assert.deepEqual(bad.body,unknown.body);
  h.db.prepare('UPDATE users SET active=0 WHERE id=1').run();const n=h.calls.length;assert.equal((await h.login('long.tutor.address@example.com')).status,401);assert.equal(h.calls.length,n);
  h.db.prepare('UPDATE users SET active=1 WHERE id=1').run();h.setIdentity({id:'wrong-user',email_confirmed_at:'2026-01-01'});assert.equal((await h.login('tung')).status,401);
  h.setIdentity({id:'auth-tutor',email_confirmed_at:null});assert.equal((await h.login('tung')).status,401);
 }finally{h.db.close()}
});
test('email and username cannot alternate to evade login throttling',async()=>{
 const h=harness();try{
  for(let i=0;i<8;i++)assert.equal((await h.login(i%2?'tung':'long.tutor.address@example.com','wrong')).status,401);
  assert.equal((await h.login('tung')).status,429);assert.equal((await h.login('LONG.TUTOR.ADDRESS@example.com')).status,429);
 }finally{h.db.close()}
});
