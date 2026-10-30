import {createApp as localApp} from '../local-review/server.mjs';
import {createHash} from 'node:crypto';
import {assignmentRoutes} from '../supabase/functions/mathroom/assignments.mjs';
import {submissionRoutes} from '../supabase/functions/mathroom/submissions.mjs';
import {lessonRoutes} from '../supabase/functions/mathroom/lessons.mjs';
export function createApp(options){
 const app=localApp(options),original=app.server.listeners('request')[0];app.server.removeAllListeners('request');
 const requireThat=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})};
 const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));return true};
 const readJson=async req=>{const chunks=[];for await(const c of req)chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString())};
 const transaction=async fn=>{app.db.exec('BEGIN');try{const v=await fn();app.db.exec('COMMIT');return v}catch(e){app.db.exec('ROLLBACK');throw e}};
 const params={db:app.db,requireThat,send,readJson,transaction,admin:u=>requireThat(u.role==='admin','Tutor access required.',403)};
 const assignments=assignmentRoutes(params),submissions=submissionRoutes(params),lessons=lessonRoutes(params);let queue=Promise.resolve();
 app.server.on('request',(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!/^\/api\/(assignments|assignment-assets|work|results|response-photos|chapters|lessons)(\/|$)/.test(path))return original(req,res);
  queue=queue.then(async()=>{try{
   requireThat(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''),'Local host required.',403);
   if(req.method!=='GET'){requireThat(req.headers['x-mathroom-request']==='1','CSRF header required.',403);if(req.headers.origin)requireThat(req.headers.origin==='http://'+req.headers.host,'Origin denied.',403)}
   const token=(req.headers.cookie||'').match(/mathroom_session=([^;]+)/)?.[1],u=token?app.db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND u.active=1').get(createHash('sha256').update(token).digest('hex')):null;
   requireThat(u,'Sign in.',401);requireThat(!u.must_change,'Change password.',403);
   if(await assignments(req,res,u,path)||await submissions(req,res,u,path)||await lessons(req,res,u,path))return;send(res,404,{error:'Not found'});
  }catch(e){send(res,e.status||500,{error:e.message})}});
 });return app;
}
