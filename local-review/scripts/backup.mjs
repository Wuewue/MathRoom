import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';

// SQLite's online backup includes committed WAL data while the review server runs.
// This artifact contains private data. Never place it in public/ or a deployment bundle.
export async function backupDatabase(source,directory){
  const input=resolve(source),root=resolve(directory);
  if(!(await stat(input)).isFile())throw new Error('Choose an existing SQLite database.');
  await mkdir(root,{recursive:true});
  const folder=join(root,'mathroom-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
  await mkdir(folder);const target=join(folder,'mathroom.sqlite');
  const db=new DatabaseSync(input,{readOnly:true});
  try{await backup(db,target)}finally{db.close()}
  const restored=new DatabaseSync(target,{readOnly:true});let counts;
  try{
    const integrity=restored.prepare('PRAGMA integrity_check').all();
    if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw new Error('Backup integrity check failed. Do not use this snapshot.');
    if(restored.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup has invalid references.');
    counts=Object.fromEntries(['users','chapters','lessons','assignments','assignment_assets','responses','response_photos'].map(table=>[table,restored.prepare('SELECT count(*) AS n FROM '+table).get().n]));
  }finally{restored.close()}
  const bytes=await readFile(target),manifest={format:1,createdAt:new Date().toISOString(),file:'mathroom.sqlite',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),counts};
  await writeFile(join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {folder,...manifest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [source,directory]=process.argv.slice(2);
  if(!source||!directory){console.error('Usage: node scripts/backup.mjs <existing-database> <private-backup-directory>');process.exitCode=1}
  else try{const result=await backupDatabase(source,directory);console.log('Verified private backup: '+result.folder);console.log(JSON.stringify({bytes:result.bytes,counts:result.counts}));}catch(error){console.error('Backup failed: '+error.message);process.exitCode=1}
}
