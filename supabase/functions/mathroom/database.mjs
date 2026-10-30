import {Buffer} from 'node:buffer';

// Route SQL uses positional ? placeholders; only source-owned SQL enters this adapter.
export function postgresStatement(source){
 let index=0,quoted=false,out='';
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(ch==="'"){if(quoted&&source[i+1]==="'"){out+="''";i++;continue}quoted=!quoted}
  out+=ch==='?'&&!quoted?'$'+(++index):ch;
 }
 if(/^INSERT OR IGNORE /i.test(out))out=out.replace(/^INSERT OR IGNORE /i,'INSERT ')+' ON CONFLICT DO NOTHING';
 return out;
}
const idTables=new Set(['users','chapters','lessons','assignments','assignment_assets','response_photos']);
export function database(sql,storage,uploaded){
 async function query(source,args,mode){
  let statement=postgresStatement(source);const params=[...args];
  const insert=statement.match(/^INSERT INTO (\w+)\(([^)]+)\)/i),fileTable=insert&&['assignment_assets','response_photos'].includes(insert[1]);
  if(fileTable){
   const fields=insert[2].split(',').map(v=>v.trim()),position=fields.indexOf('data'),mime=params[fields.indexOf('mime')],path=insert[1]+'/'+crypto.randomUUID();
   const {error}=await storage.upload(path,params[position],{contentType:mime,upsert:false});if(error)throw new Error('Photo storage unavailable. Try again.');
   uploaded.push(path);params[position]=path;
  }
  if(/^DELETE FROM response_photos /i.test(statement)){
   const old=await sql.unsafe(statement.replace(/^DELETE FROM/i,'SELECT data FROM'),params);
   for(const row of old)await sql.unsafe('INSERT INTO storage_cleanup(path) VALUES($1) ON CONFLICT DO NOTHING',[row.data]);
  }
  if(mode==='run'&&insert&&idTables.has(insert[1]))statement+=' RETURNING id';
  const rows=await sql.unsafe(statement,params);
  if(mode==='run')return {changes:rows.count,lastInsertRowid:rows[0]?.id};
  // File content is fetched only for the image endpoint query, never for list/results queries.
  if(/^SELECT \* FROM (assignment_assets|response_photos) WHERE id=/i.test(statement)){
   for(const row of rows){const {data,error}=await storage.download(row.data);if(error)throw new Error('Photo unavailable. Try again.');row.data=Buffer.from(await data.arrayBuffer())}
  }
  return mode==='get'?rows[0]:Array.from(rows);
 }
 return {prepare:source=>({get:(...p)=>query(source,p,'get'),all:(...p)=>query(source,p,'all'),run:(...p)=>query(source,p,'run')})};
}
