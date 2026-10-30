// One-time migration helper. Generated modules are checked in and reviewed separately.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parse} from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
mkdirSync('supabase/functions/mathroom',{recursive:true});
export function convert(source){
 const ast=parse(source,{sourceType:'module'}),names=new Set(['one','all','run','take','transaction','readJson']);
 for(let round=0;round<12;round++){
  traverse(ast,{CallExpression:{exit(p){
   if(t.isIdentifier(p.node.callee)&&names.has(p.node.callee.name)&&!p.parentPath.isAwaitExpression()){
    p.replaceWith(t.awaitExpression(p.node));p.skip();
   }
  }}});
  traverse(ast,{AwaitExpression(p){const f=p.getFunctionParent();if(f){f.node.async=true;if(f.node.id)names.add(f.node.id.name);if(f.parentPath.isVariableDeclarator()&&t.isIdentifier(f.parentPath.node.id))names.add(f.parentPath.node.id.name)}}});
  traverse(ast,{CallExpression:{exit(p){
   const n=p.node;if(!t.isMemberExpression(n.callee)||!t.isIdentifier(n.callee.property))return;
   if(p.parentPath.isCallExpression()&&t.isMemberExpression(p.parentPath.node.callee)&&t.isIdentifier(p.parentPath.node.callee.object,{name:'Promise'})&&t.isIdentifier(p.parentPath.node.callee.property,{name:'all'}))return;
   const method=n.callee.property.name,callback=n.arguments[0];if(!t.isFunction(callback)||!callback.async||!['map','every','some','forEach'].includes(method))return;
   n.callee.property=t.identifier('map');
   const awaited=t.awaitExpression(t.callExpression(t.memberExpression(t.identifier('Promise'),t.identifier('all')),[n]));
   p.replaceWith(['every','some'].includes(method)?t.callExpression(t.memberExpression(awaited,t.identifier(method)),[t.identifier('Boolean')]):awaited);p.skip();
  }}});
 }
 return generate(ast,{comments:true}).code;
}
for(const file of ['assignments','submissions']){
 let s=readFileSync('local-review/'+file+'.mjs','utf8');
 const start=s.indexOf('  db.exec('),end=s.indexOf('  const one=',start);s=s.slice(0,start)+s.slice(end);
 s=convert(s);writeFileSync('supabase/functions/mathroom/'+file+'.mjs',"import {Buffer} from 'node:buffer';\n"+s+'\n');
}
let paper=readFileSync('local-review/paper.mjs','utf8');writeFileSync('supabase/functions/mathroom/paper.mjs',"import {Buffer} from 'node:buffer';\n"+paper);
// Preserve the chapter/lesson validation and routes; authentication is rewritten for Supabase.
const original=readFileSync('local-review/server.mjs','utf8');
const helper=original.slice(original.indexOf('  function lessonData'),original.indexOf('  function send(res'));
const routes=original.slice(original.indexOf("      if(pathname==='/api/chapters'"),original.indexOf("      throw new HttpError(404"));
const common=`function text(value,label,max=160,optional=false){requireThat(typeof value==='string',label+' must be text.');const s=value.trim();requireThat((optional||s.length>0)&&s.length<=max,label+' is missing or too long.');return s;}`;
const output=`export function lessonRoutes({db,readJson,send,requireThat,admin,transaction}){const take=(sql,...p)=>db.prepare(sql).get(...p),all=(sql,...p)=>db.prepare(sql).all(...p),run=(sql,...p)=>db.prepare(sql).run(...p);${common}${helper}return async function(req,res,u,pathname){const method=req.method;${routes}return false;}}`;
// send() returns true in the hosted response bridge.
writeFileSync('supabase/functions/mathroom/lessons.mjs',convert(output)+'\n');
