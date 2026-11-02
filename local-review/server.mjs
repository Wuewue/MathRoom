import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import {assignmentRoutes} from './assignments.mjs';
import {submissionRoutes} from './submissions.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const lifetime = 12 * 60 * 60 * 1000;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function requireThat(condition, message, status = 400) { if (!condition) throw new HttpError(status, message); }
function text(value, label, max = 160, optional = false) {
  requireThat(typeof value === 'string', label + ' must be text.');
  const result = value.trim();
  requireThat((optional || result.length > 0) && result.length <= max, label + ' must be ' + (optional ? '0' : '1') + '–' + max + ' characters.');
  return result;
}
function username(value) {
  const result = text(value, 'Username', 32).toLowerCase();
  requireThat(/^[a-z0-9][a-z0-9._-]{2,31}$/.test(result), 'Use 3–32 letters, numbers, dots, underscores, or hyphens.');
  return result;
}
function password(value) {
  requireThat(typeof value === 'string' && value.length >= 10 && value.length <= 128, 'Use a password of 10–128 characters.');
  return value;
}
async function hashPassword(value) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + Buffer.from(await derive(value, salt, 64)).toString('hex');
}
async function verifyPassword(value, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex'), actual = Buffer.from(await derive(value, salt, 64));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function cleanUser(u) { return {id:u.id, username:u.username, name:u.name, role:u.role, active:!!u.active, mustChange:!!u.must_change}; }
async function readJson(req) {
  requireThat((req.headers['content-type'] || '').startsWith('application/json'), 'Send JSON.', 415);
  let chunks = [], size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    requireThat(size <= 1024 * 1024, 'Request is too large.', 413);
    chunks.push(chunk);
  }
  try { const value = JSON.parse(Buffer.concat(chunks).toString()); requireThat(value && typeof value === 'object' && !Array.isArray(value), 'Send a JSON object.'); return value; }
  catch (err) { if (err instanceof HttpError) throw err; throw new HttpError(400, 'Invalid JSON.'); }
}

export function createApp({ dbPath = process.env.MATHROOM_DB || join(root, '..', '..', 'work', 'phase2-data', 'mathroom.sqlite') } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), {recursive:true});
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(
    'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN (\'admin\',\'student\')), active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);' +
    'CREATE UNIQUE INDEX IF NOT EXISTS only_one_tutor ON users(role) WHERE role=\'admin\';' +
    'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY, number INTEGER NOT NULL UNIQUE CHECK(number>0), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\');' +
    'CREATE TABLE IF NOT EXISTS enrollments (student_id INTEGER NOT NULL REFERENCES users(id), chapter_id INTEGER NOT NULL REFERENCES chapters(id), PRIMARY KEY(student_id,chapter_id));' +
    'CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id), chapter_id INTEGER NOT NULL REFERENCES chapters(id), title TEXT NOT NULL, starts_at TEXT NOT NULL, duration INTEGER NOT NULL, status TEXT NOT NULL DEFAULT \'scheduled\', summary TEXT NOT NULL DEFAULT \'\', performance TEXT NOT NULL DEFAULT \'Not reviewed\', comment TEXT NOT NULL DEFAULT \'\');' +
    'CREATE INDEX IF NOT EXISTS lessons_student ON lessons(student_id,starts_at);' +
    'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);'
  );
  const failures = new Map();
  const take = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (err) { db.exec('ROLLBACK'); throw err; } };
  // Local tooling/test provisioning only. Deliberately not exposed as an HTTP route.
  // Hosted tutor provisioning will be managed in Supabase.
  async function provisionTutor(body) {
    requireThat(!take('SELECT id FROM users LIMIT 1'),'Tutor account already exists.',409);
    const login=username(body.username),name=text(body.name,'Name',80),pw=await hashPassword(password(body.password));
    const id=transaction(()=>{
      requireThat(!take('SELECT id FROM users LIMIT 1'),'Tutor account already exists.',409);
      return Number(run('INSERT INTO users(username,name,password_hash,role,created_at) VALUES(?,?,?,\'admin\',?)',login,name,pw,new Date().toISOString()).lastInsertRowid);
    });
    return cleanUser(take('SELECT * FROM users WHERE id=?',id));
  }
  const tokenFrom = req => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('mathroom_session='))?.slice(17);
  const sessionUser = req => { const token = tokenFrom(req); return token ? take('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1', digest(token), Date.now()) : null; };
  const authenticate = (req, allowPasswordChange = false) => {
    const u = sessionUser(req);
    requireThat(u, 'Please sign in.', 401);
    requireThat(allowPasswordChange || !u.must_change, 'Change your temporary password first.', 403);
    return u;
  };
  const admin = u => requireThat(u.role === 'admin', 'Tutor access required.', 403);
  const handleAssignments=assignmentRoutes({db,readJson,send,requireThat,admin,transaction});
  const handleSubmissions=submissionRoutes({db,readJson,send,requireThat,admin,transaction});
  function newSession(res, userId) {
    run('DELETE FROM sessions WHERE expires_at<=?', Date.now());
    const token = randomBytes(32).toString('hex');
    run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', digest(token), userId, Date.now()+lifetime);
    res.setHeader('Set-Cookie','mathroom_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+lifetime/1000);
  }
  function lessonData(body, id = 0) {
    const studentId=Number(body.studentId), chapterId=Number(body.chapterId);
    requireThat(Number.isSafeInteger(studentId) && Number.isSafeInteger(chapterId), 'Choose a student and chapter.');
    requireThat(take('SELECT 1 FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.student_id=? AND e.chapter_id=? AND u.role=\'student\' AND u.active=1',studentId,chapterId), 'Choose an active student enrolled in this chapter.');
    const title=text(body.title,'Lesson title');
    requireThat(typeof body.startsAt==='string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(body.startsAt) && Number.isFinite(Date.parse(body.startsAt)), 'Choose a valid lesson date and time.');
    const startsAt=new Date(body.startsAt).toISOString(), duration=Number(body.duration);
    requireThat(Number.isInteger(duration) && duration>=15 && duration<=240, 'Duration must be 15–240 minutes.');
    const status=body.status || 'scheduled', performance=body.performance || 'Not reviewed';
    requireThat(['scheduled','completed','cancelled'].includes(status),'Choose a valid lesson status.');
    requireThat(['Not reviewed','Needs practice','Good progress','Confident'].includes(performance),'Choose a valid performance.');
    const summary=text(body.summary ?? '', 'Lesson summary',5000,true), comment=text(body.comment ?? '', 'Student comment',5000,true);
    const start=Date.parse(startsAt), end=start+duration*60000;
    if(status!=='cancelled') {
      const overlaps=all('SELECT starts_at,duration FROM lessons WHERE id<>? AND status<>\'cancelled\'',id).some(l=>Date.parse(l.starts_at)<end && Date.parse(l.starts_at)+l.duration*60000>start);
      requireThat(!overlaps,'This time overlaps another individual lesson.',409);
    }
    return [studentId,chapterId,title,startsAt,duration,status,summary,performance,comment];
  }
  const lessonSelect='SELECT l.*,u.name AS student_name,c.number AS chapter_number,c.title AS chapter_title FROM lessons l JOIN users u ON u.id=l.student_id JOIN chapters c ON c.id=l.chapter_id ';
  function chapterData(body) {
    const number=Number(body.number),title=text(body.title,'Chapter title'),description=text(body.description ?? '','Chapter description',2000,true);
    requireThat(Number.isSafeInteger(number)&&number>0&&number<10000,'Chapter number must be between 1 and 9999.');
    requireThat(Array.isArray(body.studentIds),'Choose students for this chapter.');
    const ids=[...new Set(body.studentIds.map(Number))];
    requireThat(ids.every(id=>Number.isSafeInteger(id)&&take('SELECT id FROM users WHERE id=? AND role=\'student\'',id)), 'One of the selected students does not exist.');
    return {number,title,description,ids};
  }
  function send(res, status, value) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
  const server = http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host=req.headers.host || '';
      requireThat(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host),'This review server only accepts local requests.',403);
      const pathname=new URL(req.url,'http://'+host).pathname, method=req.method;
      if(!pathname.startsWith('/api/')) {
        requireThat(method==='GET'||method==='HEAD','Method not allowed.',405);
        if(/^\/katex\/(?:katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(?:woff2?|ttf))$/.test(pathname)){
          const file=join(root,'node_modules','katex','dist',pathname.slice(7));
          requireThat(existsSync(file),'Asset not found.',404);
          res.setHeader('Content-Type',pathname.endsWith('.css')?'text/css':pathname.endsWith('.woff2')?'font/woff2':pathname.endsWith('.woff')?'font/woff':'font/ttf');
          res.end(method==='HEAD'?'':readFileSync(file));return;
        }
        const files={'/':'index.html','/style.css':'style.css','/app.js':'app.js','/theme.js':'theme.js','/language.js':'language.js','/favicon.svg':'favicon.svg','/assignment-template.tex':'assignment-template.tex'};
        requireThat(files[pathname],'Page not found.',404);
        const file=join(root,'public',files[pathname]);
        requireThat(existsSync(file),'Page not found.',404);
        res.setHeader('Cache-Control','no-cache');
        res.setHeader('Content-Type',pathname.endsWith('.css')?'text/css; charset=utf-8':pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');
        res.end(method==='HEAD'?'':readFileSync(file));return;
      }
      if(!['GET','HEAD'].includes(method)){
        requireThat(req.headers['x-mathroom-request']==='1','Request verification failed.',403);
        if(req.headers.origin)requireThat(req.headers.origin==='http://'+host,'Request origin is not allowed.',403);
      }
      if(pathname==='/api/status'&&method==='GET')return send(res,200,{mode:'local-review',timezone:'Asia/Bangkok'});
      if(pathname==='/api/login'&&method==='POST'){
        const body=await readJson(req),login=typeof body.username==='string'?body.username.trim().toLowerCase():'',pw=body.password;
        requireThat(login.length<=32&&typeof pw==='string'&&pw.length<=128,'Invalid username or password.',401);
        const key=(req.socket.remoteAddress || '')+':'+login,now=Date.now(),bucket=failures.get(key);
        if(bucket&&bucket.until>now)requireThat(bucket.count<8,'Too many attempts. Try again in 15 minutes.',429);
        else failures.delete(key);
        if(failures.size>1000)for(const [k,v] of failures)if(v.until<=now)failures.delete(k);
        const u=take('SELECT * FROM users WHERE username=?',login);
        const valid=await verifyPassword(pw,u?.password_hash || '00000000000000000000000000000000:'+ '00'.repeat(64));
        if(!u||!u.active||!valid){const prior=failures.get(key);failures.set(key,{count:(prior?.count||0)+1,until:prior?.until||now+15*60000});throw new HttpError(401,'Invalid username or password.');}
        failures.delete(key);
        const previous=tokenFrom(req);if(previous)run('DELETE FROM sessions WHERE token_hash=?',digest(previous));
        newSession(res,u.id);return send(res,200,{user:cleanUser(u)});
      }
      if(pathname==='/api/logout'&&method==='POST'){
        const token=tokenFrom(req);if(token)run('DELETE FROM sessions WHERE token_hash=?',digest(token));
        res.setHeader('Set-Cookie','mathroom_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});
      }
      if(pathname==='/api/me'&&method==='GET')return send(res,200,{user:cleanUser(authenticate(req,true))});
      if(pathname==='/api/password'&&method==='POST'){
        const u=authenticate(req,true),body=await readJson(req);
        requireThat(typeof body.currentPassword==='string'&&body.currentPassword.length<=128&&await verifyPassword(body.currentPassword,u.password_hash),'Current password is incorrect.',400);
        const next=password(body.newPassword);requireThat(next!==body.currentPassword,'Choose a different password.');
        const hashed=await hashPassword(next);
        transaction(()=>{run('UPDATE users SET password_hash=?,must_change=0 WHERE id=?',hashed,u.id);run('DELETE FROM sessions WHERE user_id=?',u.id)});
        newSession(res,u.id);return send(res,200,{user:cleanUser(take('SELECT * FROM users WHERE id=?',u.id))});
      }
      const u=authenticate(req);
      if(await handleAssignments(req,res,u,pathname))return;
      if(await handleSubmissions(req,res,u,pathname))return;
      if(pathname==='/api/students'){
        admin(u);
        if(method==='GET')return send(res,200,{students:all('SELECT * FROM users WHERE role=\'student\' ORDER BY name').map(cleanUser)});
        if(method==='POST'){
          const b=await readJson(req),login=username(b.username),name=text(b.name,'Student name',80);
          requireThat(!take('SELECT id FROM users WHERE username=?',login),'That username is already used.',409);
          const hashed=await hashPassword(password(b.password));
          const id=transaction(()=>{
            requireThat(take('SELECT count(*) AS count FROM users WHERE role=\'student\' AND active=1').count<10,'The workspace supports 10 active students.',409);
            return Number(run('INSERT INTO users(username,name,password_hash,role,must_change,created_at) VALUES(?,?,?,\'student\',1,?)',login,name,hashed,new Date().toISOString()).lastInsertRowid);
          });return send(res,201,{student:cleanUser(take('SELECT * FROM users WHERE id=?',id))});
        }
      }
      const studentMatch=pathname.match(/^\/api\/students\/(\d+)(\/reset-password)?$/);
      if(studentMatch){
        admin(u);const id=Number(studentMatch[1]),student=take('SELECT * FROM users WHERE id=? AND role=\'student\'',id);requireThat(student,'Student not found.',404);
        if(studentMatch[2]&&method==='POST'){
          const b=await readJson(req),hashed=await hashPassword(password(b.password));
          transaction(()=>{run('UPDATE users SET password_hash=?,must_change=1 WHERE id=?',hashed,id);run('DELETE FROM sessions WHERE user_id=?',id)});
          return send(res,200,{ok:true});
        }
        if(!studentMatch[2]&&method==='PATCH'){
          const b=await readJson(req),name=text(b.name ?? student.name,'Student name',80),active=b.active ?? !!student.active;
          requireThat(typeof active==='boolean','Active must be true or false.');
          transaction(()=>{
            if(active&&!student.active)requireThat(take('SELECT count(*) AS count FROM users WHERE role=\'student\' AND active=1').count<10,'The workspace supports 10 active students.',409);
            run('UPDATE users SET name=?,active=? WHERE id=?',name,active?1:0,id);
            if(!active)run('DELETE FROM sessions WHERE user_id=?',id);
          });return send(res,200,{student:cleanUser(take('SELECT * FROM users WHERE id=?',id))});
        }
      }
      if(pathname==='/api/chapters'&&method==='GET'){
        const chapters=u.role==='admin'?all('SELECT * FROM chapters ORDER BY number'):all('SELECT c.* FROM chapters c JOIN enrollments e ON e.chapter_id=c.id WHERE e.student_id=? ORDER BY c.number',u.id);
        for(const c of chapters)if(u.role==='admin')c.studentIds=all('SELECT student_id FROM enrollments WHERE chapter_id=?',c.id).map(r=>r.student_id);
        return send(res,200,{chapters});
      }
      if(pathname==='/api/chapters'&&method==='POST'){
        admin(u);const b=chapterData(await readJson(req));
        requireThat(!take('SELECT id FROM chapters WHERE number=?',b.number),'That chapter number already exists.',409);
        const id=transaction(()=>{const id=Number(run('INSERT INTO chapters(number,title,description) VALUES(?,?,?)',b.number,b.title,b.description).lastInsertRowid);for(const s of b.ids)run('INSERT INTO enrollments(student_id,chapter_id) VALUES(?,?)',s,id);return id});
        return send(res,201,{id});
      }
      const chapterMatch=pathname.match(/^\/api\/chapters\/(\d+)$/);
      if(chapterMatch&&method==='PUT'){
        admin(u);const id=Number(chapterMatch[1]);requireThat(take('SELECT id FROM chapters WHERE id=?',id),'Chapter not found.',404);
        const b=chapterData(await readJson(req));requireThat(!take('SELECT id FROM chapters WHERE number=? AND id<>?',b.number,id),'That chapter number already exists.',409);
        const withLessons=all('SELECT DISTINCT student_id FROM lessons WHERE chapter_id=?',id);
        requireThat(withLessons.every(l=>b.ids.includes(l.student_id)),'Keep students who already have lessons in this chapter.',409);
        transaction(()=>{run('UPDATE chapters SET number=?,title=?,description=? WHERE id=?',b.number,b.title,b.description,id);run('DELETE FROM enrollments WHERE chapter_id=?',id);for(const s of b.ids)run('INSERT INTO enrollments(student_id,chapter_id) VALUES(?,?)',s,id)});
        return send(res,200,{ok:true});
      }
      if(pathname==='/api/lessons'&&method==='GET'){
        return send(res,200,{lessons:u.role==='admin'?all(lessonSelect+'ORDER BY l.starts_at'):all(lessonSelect+'WHERE l.student_id=? ORDER BY l.starts_at',u.id)});
      }
      if(pathname==='/api/lessons'&&method==='POST'){
        admin(u);const values=lessonData(await readJson(req));
        const id=Number(run('INSERT INTO lessons(student_id,chapter_id,title,starts_at,duration,status,summary,performance,comment) VALUES(?,?,?,?,?,?,?,?,?)',...values).lastInsertRowid);
        return send(res,201,{lesson:take(lessonSelect+'WHERE l.id=?',id)});
      }
      const lessonMatch=pathname.match(/^\/api\/lessons\/(\d+)$/);
      if(lessonMatch){
        const id=Number(lessonMatch[1]),lesson=take(lessonSelect+'WHERE l.id=?'+(u.role==='student'?' AND l.student_id=?':''),...(u.role==='student'?[id,u.id]:[id]));
        requireThat(lesson,'Lesson not found.',404);
        if(method==='GET')return send(res,200,{lesson});
        if(method==='PUT'){
          admin(u);const values=lessonData(await readJson(req),id);run('UPDATE lessons SET student_id=?,chapter_id=?,title=?,starts_at=?,duration=?,status=?,summary=?,performance=?,comment=? WHERE id=?',...values,id);
          return send(res,200,{lesson:take(lessonSelect+'WHERE l.id=?',id)});
        }
      }
      throw new HttpError(404,'This action is unavailable.');
    }catch(err){
      const status=err instanceof HttpError?err.status:err.code?.startsWith('ERR_SQLITE')||String(err.message).includes('UNIQUE constraint')?409:500;
      if(status===500)console.error('Request error:',err.message);
      if(!res.headersSent)send(res,status,{error:err instanceof HttpError?err.message:status===409?'This record conflicts with an existing entry.':'Something went wrong. Please try again.'});else res.end();
    }
  });
  return {server,db,provisionTutor,close:()=>new Promise((resolve,reject)=>server.close(err=>{db.close();err?reject(err):resolve()}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const app=createApp(),port=Number(process.env.PORT||4178);
  app.server.listen(port,'127.0.0.1',()=>console.log('Mathroom Phase 4 · http://127.0.0.1:'+port+' · local review database'));
  const shutdown=()=>app.close().then(()=>process.exit(0));
  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
