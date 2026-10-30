import {Buffer} from 'node:buffer';
import {unzipSync} from 'fflate';
import katex from 'katex';
import {posix} from 'node:path';
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function check(ok,message){if(!ok){const e=new Error(message);e.status=400;throw e}}
function safePath(path){check(!path.includes('\\')&&!path.startsWith('/')&&!path.includes(':')&&!path.split('/').includes('..')&&!path.includes('\0'),'Archive contains an unsafe path.');return path.replace(/^\.\//,'')}
function mime(bytes){
  const b=Buffer.from(bytes);
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
  if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'image/webp';
  return null;
}
// Worksheet metadata: marks affect new imports; working space is a print layout hint.
export function questionPoints(source){
  const top=[],nested=[];let depth=0;
  const tokens=/\\begin\{(?:enumerate|itemize)\}|\\end\{(?:enumerate|itemize)\}|\\markspoints\s*\{\s*(\d+(?:\.\d+)?)\s*\}/g;
  for(const m of source.matchAll(tokens)){
    if(m[0].startsWith('\\begin'))depth++;
    else if(m[0].startsWith('\\end'))depth=Math.max(0,depth-1);
    else (depth===0?top:nested).push(Number(m[1]));
  }
  const values=top.length?top:nested,total=values.reduce((a,b)=>a+b,0);
  return total>0&&total<=100?total:1;
}
export function splitQuestions(source){
  source=source.replace(/(?<!\\)%[^\n]*/g,'');
  const document=source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  let body=(document?document[1]:source).replace(/\\maketitle\b/g,'').trim();
  // Top-level question boundaries only: nested lists remain in their question.
  const tokens=/\\(?:begin\{(enumerate|questions|itemize)\}|end\{(enumerate|questions|itemize)\}|(item|question)\b(?:\[[^\]]*\])?)/g;
  let depth=0,splitDepth=null,starts=[],match;
  while((match=tokens.exec(body))){
    if(match[1])depth++;
    else if(match[2])depth--;
    else if(splitDepth===null||depth===splitDepth){if(splitDepth===null)splitDepth=depth;starts.push({start:match.index,end:tokens.lastIndex})}
  }
  let items=starts.length?starts.map((s,i)=>body.slice(s.end,starts[i+1]?.start||body.length).replace(/\\end\{(?:enumerate|questions)\}\s*$/,'').trim()):[body];
  check(items.length>0&&items.length<=100,'A paper must contain 1–100 questions.');
  return items.map(source=>({source,type:'reasoning',points:questionPoints(source),options:['','','',''],correctIndex:null}));
}
export function importPaper(filename,data){
  check(data.length<=20*1024*1024,'Upload a file no larger than 20 MB.');
  let source,texPath='',images=[],warnings=[];
  if(/\.tex$/i.test(filename)){check(data.length<=512*1024,'LaTeX source is limited to 512 KB.');source=data.toString('utf8')}
  else if(/\.zip$/i.test(filename)){
    let count=0,total=0,names=new Set(),files;
    try{files=unzipSync(data,{filter:file=>{
      const name=safePath(file.name);check(!names.has(name),'Archive has duplicate filenames.');names.add(name);
      check(++count<=150,'Archive contains too many files.');
      check(file.originalSize<=10*1024*1024,'An archive file is larger than 10 MB.');
      total+=file.originalSize;check(total<=30*1024*1024,'Expanded archive must be under 30 MB.');
      return /\.(tex|png|jpe?g|webp)$/i.test(name)&&!name.startsWith('__MACOSX/');
    }})}catch(e){check(false,e.status?e.message:'Unable to read this ZIP archive.')}
    const tex=Object.keys(files).filter(name=>/\.tex$/i.test(name));
    check(tex.length===1,'Include exactly one .tex file in the ZIP, plus PNG/JPG/WebP images.');
    texPath=tex[0];check(files[texPath].length<=512*1024,'LaTeX source is limited to 512 KB.');source=Buffer.from(files[texPath]).toString('utf8');
    images=Object.entries(files).filter(([name])=>name!==texPath).map(([path,bytes])=>{const type=mime(bytes);check(type,'Invalid or unsupported image: '+path);return {path:safePath(path),mime:type,data:Buffer.from(bytes)}});
  }else check(false,'Choose a .tex file or a .zip archive.');
  check(!source.includes('\0'),'The LaTeX file must be UTF-8 text.');
  const title=source.match(/\\title\{([^}]*)\}/)?.[1]||filename.replace(/\.(tex|zip)$/i,'');
  if(/\\(?:newcommand|renewcommand|def|input|include|usepackage)/.test(source))warnings.push('Custom macros, included TeX files, and package-specific layouts are not executed. Review the rendered questions.');
  return {title,questions:splitQuestions(source),images,baseDir:texPath?posix.dirname(texPath):'.',warnings};
}
export function renderQuestion(source,assets=[],baseDir='.'){
  const issues=[];
  // Unwrap section titles before math tokenization; keep their text and equations.
  function unwrapSections(value){
    const command=/\\(?:subsubsection|subsection|section)\*?(?:\[[^\]]*\])?\s*\{/g;
    let output='',cursor=0,m;
    while((m=command.exec(value))){
      let depth=1,end=command.lastIndex;
      for(;end<value.length&&depth;end++){
        if(value[end]==='\\'){end++;continue}
        if(value[end]==='{')depth++;
        if(value[end]==='}')depth--;
      }
      if(depth)continue;
      output+=value.slice(cursor,m.index)+'\n\n'+value.slice(command.lastIndex,end-1)+'\n\n';
      cursor=end;command.lastIndex=end;
    }
    return output+value.slice(cursor);
  }
  source=unwrapSections(source);
  const lists=[];
  function roman(number){
    let result='';for(const [value,symbol]of [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']])while(number>=value){result+=symbol;number-=value}
    return result;
  }
  function plain(value){
    value=value.replace(/\\markspoints\s*\{\s*(\d+(?:\.\d+)?)\s*\}/g,(_,n)=>' ('+n+(Number(n)===1?' mark':' marks')+')')
      .replace(/\\(?:working|vspace\*?)\s*\{\s*-?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:cm|mm|in|pt|em|ex|bp|pc)\s*\}/g,'');
    if(/(?<!\\)\$|\\[\[\]()]/.test(value))issues.push('Unmatched math delimiter. Check the question’s dollar signs or math brackets.');
    value=value.replace(/\\begin\{(enumerate|itemize)\}(?:\s*\[([^\]]*)\])?|\\end\{(enumerate|itemize)\}|\\item\b(?:\s*\[([^\]]*)\])?/g,(token,begin,options,end,label)=>{
      if(begin){lists.push({kind:begin,options:options||'',count:0});return '\n'}
      if(end){lists.pop();return '\n'}
      const current=lists.at(-1);if(!current)return '\n• ';
      current.count++;
      if(label)return '\n'+label+' ';
      if(current.kind==='itemize')return '\n• ';
      const n=current.count,lowerAlpha=String.fromCharCode(97+(n-1)%26);
      let number=/\\[Rr]oman/.test(current.options)?roman(n):/\\[Aa]lph/.test(current.options)?lowerAlpha:String(n);
      if(/\\(?:Roman|Alph)/.test(current.options))number=number.toUpperCase();
      return '\n'+(current.options.includes('(')?'('+number+')':number+'.')+' ';
    });
    value=value.replace(/\\(?:textbf|emph|textit)\{([^{}]*)\}/g,'$1').replace(/\\(?:begin|end)\{center\}/g,'').replace(/\\(?:hfill|vfill)\b/g,' ').replace(/\\hrule\b/g,'\n')
      .replace(/\\(?:noindent|centering|smallskip|medskip|bigskip)\b/g,'').replace(/\\\\/g,'\n');
    const unknown=[...value.matchAll(/\\([a-zA-Z]+)/g)].map(m=>m[1]);
    if(unknown.length)issues.push('Unsupported text commands: '+[...new Set(unknown)].join(', ')+'. Edit this question before publishing.');
    return escapeHtml(value.replace(/\\([%&#_$])/g,'$1')).replace(/\n/g,'<br>');
  }
  let html='',cursor=0;
  const token=/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}|\$\$([\s\S]*?)\$\$|(?<!\\)\$([^$\n]*?)(?<!\\)\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\\begin\{(equation\*?|align\*?)\}([\s\S]*?)\\end\{\6\}/g;
  for(const m of source.matchAll(token)){
    html+=plain(source.slice(cursor,m.index));cursor=m.index+m[0].length;
    if(m[1]){
      let path;
      try{path=safePath(posix.normalize(posix.join(baseDir,m[1])))}catch{issues.push('Unsafe image reference.');html+='<span class="import-error">Invalid image reference</span>';continue}
      const asset=assets.find(a=>a.path===path)||(!posix.extname(path)?assets.find(a=>a.path.replace(/\.[^.]+$/,'')===path):null);
      if(asset)html+='<img class="paper-image" src="/api/assignment-assets/'+asset.id+'" alt="'+escapeHtml(m[1])+'">';
      else{issues.push('Missing image: '+m[1]);html+='<span class="import-error">Missing image: '+escapeHtml(m[1])+'</span>'}
    }else{
      let math=m[2]??m[3]??m[4]??m[5]??m[7],display=!!(m[2]!==undefined||m[4]!==undefined||m[6]);
      if(m[6]?.startsWith('align'))math='\\begin{aligned}'+math+'\\end{aligned}';
      try{html+=katex.renderToString(math,{displayMode:display,throwOnError:true,trust:false,strict:'error',maxExpand:500,maxSize:20,output:'htmlAndMathml'})}
      catch{issues.push('An equation could not be rendered. Check its LaTeX.');html+='<code class="import-error">'+escapeHtml(m[0])+'</code>'}
    }
  }
  html+=plain(source.slice(cursor));
  return {html,issues:[...new Set(issues)]};
}
