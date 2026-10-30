import {createHash,randomBytes} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
const clean=u=>({id:u.id,username:u.username,name:u.name,role:u.role,active:!!u.active,mustChange:!!u.must_change});
export function authRoutes({db,provider,publicProvider,send,readJson,requireThat}){
 const one=(s,...p)=>db.prepare(s).get(...p),run=(s,...p)=>db.prepare(s).run(...p),all=(s,...p)=>db.prepare(s).all(...p);
 const token=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('mathroom_session='))?.slice(17);
 const cookie=(res,value,age)=>res.setHeader('Set-Cookie','mathroom_session='+value+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+age);
 async function session(req,res,u){await run('DELETE FROM sessions WHERE expires_at<=?',Date.now());const old=token(req);if(old)await run('DELETE FROM sessions WHERE token_hash=?',digest(old));const value=randomBytes(32).toString('hex');await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',digest(value),u.id,Date.now()+12*3600000);cookie(res,value,43200)}
 async function authenticate(req,allowChange=false){const value=token(req);const u=value?await one("SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id JOIN auth.users a ON a.id=u.auth_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND (a.banned_until IS NULL OR a.banned_until<now())",digest(value),Date.now()):null;requireThat(u,'Please sign in.',401);requireThat(allowChange||!u.must_change,'Change your temporary password first.',403);return u}
 function password(p){requireThat(typeof p==='string'&&p.length>=10&&p.length<=128,'Use a password of 10–128 characters.');return p}
 async function checkPassword(email,p){const {data,error}=await publicProvider().auth.signInWithPassword({email,password:p});return !error?data.user:null}
 return {authenticate,async handle(req,res,path){
  const method=req.method;
  if(path==='/api/login'&&method==='POST'){
   const b=await readJson(req),name=typeof b.username==='string'?b.username.trim().toLowerCase():'';requireThat(name.length<=32&&typeof b.password==='string'&&b.password.length<=128,'Invalid username or password.',401);
   const key=digest(name),now=Date.now(),limit=await one('SELECT * FROM login_limits WHERE key=?',key);requireThat(!limit||Number(limit.until_at)<=now||limit.count<8,'Too many attempts. Try again in 15 minutes.',429);
   const u=await one('SELECT * FROM users WHERE username=?',name),identity=u?.active?await checkPassword(u.email,b.password):null;
   if(!identity||!identity.email_confirmed_at||(u.auth_id&&u.auth_id!==identity.id)){
    await run('INSERT INTO login_limits(key,count,until_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,until_at=excluded.until_at',key,limit&&Number(limit.until_at)>now?limit.count+1:1,limit&&Number(limit.until_at)>now?Number(limit.until_at):now+900000);
    return send(res,401,{error:'Invalid username or password.'});
   }
   if(!u.auth_id)await run('UPDATE users SET auth_id=? WHERE id=?',identity.id,u.id);
   await run('DELETE FROM login_limits WHERE key=?',key);await session(req,res,u);return send(res,200,{user:clean(u)});
  }
  if(path==='/api/logout'&&method==='POST'){const value=token(req);if(value)await run('DELETE FROM sessions WHERE token_hash=?',digest(value));cookie(res,'',0);return send(res,200,{ok:true})}
  if(path==='/api/me'&&method==='GET')return send(res,200,{user:clean(await authenticate(req,true))});
  if(path==='/api/password'&&method==='POST'){
   const u=await authenticate(req,true),b=await readJson(req);requireThat(typeof b.currentPassword==='string'&&b.currentPassword.length<=128&&await checkPassword(u.email,b.currentPassword),'Current password is incorrect.');password(b.newPassword);requireThat(b.newPassword!==b.currentPassword,'Choose a different password.');
   const {error}=await provider.auth.admin.updateUserById(u.auth_id,{password:b.newPassword});requireThat(!error,'Unable to change password. Try again.');await run('UPDATE users SET must_change=0 WHERE id=?',u.id);await run('DELETE FROM sessions WHERE user_id=?',u.id);u.must_change=0;await session(req,res,u);return send(res,200,{user:clean(u)});
  }
  if(!path.startsWith('/api/students'))return false;
  const u=await authenticate(req);requireThat(u.role==='admin','Tutor access required.',403);
  if(path==='/api/students'&&method==='GET')return send(res,200,{students:(await all("SELECT * FROM users WHERE role='student' ORDER BY name")).map(clean)});
  const b=await readJson(req);
  if(path==='/api/students'&&method==='POST'){
   requireThat(typeof b.username==='string'&&/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(b.username),'Use 3–32 letters, numbers, dots, underscores, or hyphens.');const username=b.username.toLowerCase();
   requireThat(typeof b.name==='string'&&b.name.trim()&&b.name.length<=80,'Enter a student name (up to 80 characters).');password(b.password);
   requireThat(!await one('SELECT id FROM users WHERE username=?',username),'Username already used.',409);requireThat(Number((await one("SELECT count(*) AS n FROM users WHERE role='student' AND active=1")).n)<10,'The workspace supports 10 active students.',409);
   const email=username+'@students.mathroom.invalid';
   const {data,error}=await provider.auth.admin.createUser({email,password:b.password,email_confirm:true});requireThat(!error,'Unable to create account. Check whether this username already exists in Supabase.',409);
   let id;try{id=(await run("INSERT INTO users(auth_id,email,username,name,role,must_change,created_at) VALUES(?,?,?,?,'student',1,?)",data.user.id,email,username,b.name.trim(),new Date().toISOString())).lastInsertRowid}catch(e){await provider.auth.admin.deleteUser(data.user.id);throw e}
   return send(res,201,{student:clean(await one('SELECT * FROM users WHERE id=?',id))});
  }
  const m=path.match(/^\/api\/students\/(\d+)(\/reset-password)?$/);requireThat(m,'Student not found.',404);const id=Number(m[1]),s=await one("SELECT * FROM users WHERE id=? AND role='student'",id);requireThat(s,'Student not found.',404);
  if(m[2]&&method==='POST'){password(b.password);const {error}=await provider.auth.admin.updateUserById(s.auth_id,{password:b.password});requireThat(!error,'Unable to reset password.');await run('UPDATE users SET must_change=1 WHERE id=?',id);await run('DELETE FROM sessions WHERE user_id=?',id);return send(res,200,{ok:true})}
  if(!m[2]&&method==='PATCH'){const name=b.name??s.name,active=b.active??!!s.active;requireThat(typeof name==='string'&&name.trim()&&name.length<=80&&typeof active==='boolean','Enter a valid name and access setting.');if(active&&!s.active)requireThat(Number((await one("SELECT count(*) AS n FROM users WHERE role='student' AND active=1")).n)<10,'The workspace supports 10 active students.',409);await run('UPDATE users SET name=?,active=? WHERE id=?',name.trim(),active?1:0,id);if(!active)await run('DELETE FROM sessions WHERE user_id=?',id);return send(res,200,{student:clean(await one('SELECT * FROM users WHERE id=?',id))})}
  return false;
 }};
}
