import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {Buffer} from 'node:buffer';
import {database} from './database.mjs';
import {authRoutes} from './auth.mjs';
import {assignmentRoutes} from './assignments.mjs';
import {submissionRoutes} from './submissions.mjs';
import {lessonRoutes} from './lessons.mjs';
import {withReadRetry} from './read-retry.mjs';

const env=name=>Deno.env.get(name);
const secret=env('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;
const publishable=env('SUPABASE_ANON_KEY')||JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
const provider=createClient(env('SUPABASE_URL'),secret,{auth:{persistSession:false,autoRefreshToken:false}});
const publicProvider=()=>createClient(env('SUPABASE_URL'),publishable,{auth:{persistSession:false,autoRefreshToken:false}});
const sql=postgres(env('SUPABASE_DB_URL'),{prepare:false,max:3,idle_timeout:20,connect_timeout:10,ssl:'require'});
const storage=provider.storage.from('mathroom-private');
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
function requireThat(ok,message,status=400){if(!ok)throw new HttpError(status,message)}
async function readJson(req){requireThat((req.headers['content-type']||'').startsWith('application/json'),'Send JSON.',415);const chunks=[];let size=0;for await(const c of req){size+=c.length;requireThat(size<=1048576,'Request too large.',413);chunks.push(c)}try{const b=JSON.parse(Buffer.concat(chunks).toString());requireThat(b&&typeof b==='object'&&!Array.isArray(b),'Send a JSON object.');return b}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid JSON.')}}
const admin=u=>requireThat(u.role==='admin','Tutor access required.',403);
async function cleanup(){
 const rows=await sql.unsafe('SELECT path FROM mathroom.storage_cleanup ORDER BY created_at LIMIT 50');
 for(const row of rows){const {error}=await storage.remove([row.path]);if(!error)await sql.unsafe('DELETE FROM mathroom.storage_cleanup WHERE path=$1',[row.path])}
}
Deno.serve(async request=>{
 const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}),url=new URL(request.url),path=url.pathname.replace(/^\/functions\/v1\/mathroom/,'').replace(/^\/mathroom/,'');
 let status=200,body='',committed=false;const uploaded=[];
 const res={setHeader:(k,v)=>headers.set(k,v),writeHead:(s,h)=>{status=s;for(const [k,v]of Object.entries(h||{}))headers.set(k,v)},end:b=>{body=b??''}};
 const send=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));return true};
 try{
  requireThat(['GET','POST','PUT','PATCH'].includes(request.method),'Method not allowed.',405);
  // No CORS response is provided: browser clients use the same-origin Cloudflare proxy.
  if(request.method!=='GET')requireThat(request.headers.get('X-Mathroom-Request')==='1','Request verification failed.',403);
  const req={method:request.method,url:path+url.search,headers:Object.fromEntries(request.headers),async *[Symbol.asyncIterator](){if(request.body)for await(const chunk of request.body)yield Buffer.from(chunk)}};
  if(path==='/api/status'){send(res,200,{mode:'hosted',timezone:'Asia/Bangkok'});return new Response(body,{status,headers})}
  await withReadRetry(request.method,()=>sql.begin(async tx=>{
   await tx.unsafe('SET LOCAL search_path TO mathroom,public');
   // A small single-tutor workspace serializes mutations to preserve attempt limits,
   // account limits, paper locks and lesson overlap checks across concurrent requests.
   if(request.method!=='GET')await tx.unsafe('SELECT pg_advisory_xact_lock(76190417)');
   const db=database(tx,storage,uploaded),options={db,readJson,send,requireThat,admin,transaction:async fn=>await fn()};
   const auth=authRoutes({...options,provider,publicProvider});
   if(await auth.handle(req,res,path))return;
   const u=await auth.authenticate(req);
   if(await assignmentRoutes(options)(req,res,u,path))return;
   if(await submissionRoutes(options)(req,res,u,path))return;
   if(await lessonRoutes(options)(req,res,u,path))return;
   throw new HttpError(404,'This action is unavailable.');
  }));committed=true;
 }catch(e){const code=e.status||(['23505','23503','23514'].includes(e.code)?409:500);send(res,code,{error:e instanceof HttpError?e.message:code===409?'This record conflicts with existing data.': 'Unable to complete this request. Please try again.'});console.error(JSON.stringify({event:'request_failed',path,status:code,code:e.code||e.name,message:code===500?e.message:undefined}));}
 // Compensation after rollback; deletion failures are retained for retry on later writes.
 if(!committed&&uploaded.length){for(const p of uploaded){const {error}=await storage.remove([p]);if(error)await sql.unsafe('INSERT INTO mathroom.storage_cleanup(path) VALUES($1) ON CONFLICT DO NOTHING',[p])}}
 if(request.method!=='GET'){try{await cleanup()}catch{console.error(JSON.stringify({event:'storage_cleanup_retry_pending'}))}}
 return new Response(body,{status,headers});
});
