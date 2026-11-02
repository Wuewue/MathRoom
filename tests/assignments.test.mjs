import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {importPaper,renderQuestion,splitQuestions,questionPoints} from '../supabase/functions/mathroom/paper.mjs';
import {createApp} from './harness.mjs';
const tex='\\documentclass{article}\n\\title{Quadratics}\n\\begin{document}\\begin{enumerate}\\item Solve $x^2-5x+6=0$.\\item Find the area.\\includegraphics{triangle.png}\\end{enumerate}\\end{document}';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=','base64');
test('import splits question lists without splitting nested lists',()=>{
  assert.equal(splitQuestions(tex).length,2);
  const questions=splitQuestions('\\begin{enumerate}\\item First \\begin{itemize}\\item subpart\\end{itemize}\\item Second\\end{enumerate}');
  assert.equal(questions.length,2);assert.match(questions[0].source,/subpart/);
});
test('ZIP imports one paper and referenced image; rejects unsafe/ambiguous archives',()=>{
  const paper=importPaper('paper.zip',Buffer.from(zipSync({'paper.tex':strToU8(tex),'triangle.png':png})));
  assert.equal(paper.questions.length,2);assert.equal(paper.images.length,1);
  assert.throws(()=>importPaper('bad.zip',Buffer.from(zipSync({'../a.tex':strToU8(tex)}))),/unsafe/);
  assert.throws(()=>importPaper('bad.zip',Buffer.from(zipSync({'a.tex':strToU8(tex),'b.tex':strToU8(tex)}))),/exactly one/);
  assert.throws(()=>importPaper('bad.zip',Buffer.from(zipSync({'a.tex':strToU8(tex),'x.png':strToU8('<script>bad</script>')}))),/Invalid/);
});
test('math renders, source is escaped, missing assets and unsupported commands are flagged',()=>{
  const r=renderQuestion('<script>bad()</script> $\\frac{1}{2}$');
  assert.match(r.html,/class="katex"/);assert.ok(!r.html.includes('<script>'));assert.equal(r.issues.length,0);
  assert.equal(renderQuestion('\\includegraphics{missing.png}').issues.length,1);
  assert.ok(renderQuestion('$\\invalidcommand$').issues.length);
  assert.ok(renderQuestion('Unclosed $x^2').issues.length);
  assert.ok(renderQuestion('\\input{secret}').issues.length);
  assert.ok(renderQuestion('\\includegraphics{triangle.png}',[{id:3,path:'triangle.png'}]).html.includes('/api/assignment-assets/3'));
});
test('worksheet marks and working-space macros render and carry points into new imports',()=>{
  const source='$\\dfrac{18}{24}$ \\markspoints{2}\n\\working{0.55cm}';
  const rendered=renderQuestion(source);
  assert.equal(rendered.issues.length,0);
  assert.match(rendered.html,/\(2 marks\)/);
  assert.ok(!rendered.html.includes('0.55cm'));
  assert.equal(splitQuestions('\\begin{enumerate}\\item '+source+'\\end{enumerate}')[0].points,2);
  assert.equal(questionPoints('\\begin{enumerate}\\item First \\markspoints{1}\\item Second \\markspoints{2}\\end{enumerate}'),3);
  assert.equal(questionPoints('\\markspoints{3}\\begin{enumerate}\\item Part \\markspoints{1}\\end{enumerate}'),3);
  assert.match(renderQuestion('\\markspoints{1} \\working{1cm}').html,/\(1 mark\)/);
  assert.ok(renderQuestion('\\working{unsupported}').issues.length);
});
test('section headings, fill spacing and alphabetic/roman lists render safely',()=>{
  const rendered=renderQuestion('\\vspace{3pt}\\hrule\\section*{Question 2 \\hfill (5 marks)}\\begin{enumerate}[label=(\\alph*)]\\item First $x=1$\\begin{enumerate}[label=(\\roman*)]\\item Nested $y=2$\\item Next\\end{enumerate}\\item Second\\end{enumerate}\\vfill');
  assert.deepEqual(rendered.issues,[]);
  assert.match(rendered.html,/Question 2/);assert.match(rendered.html,/\(a\)\s+First/);
  assert.match(rendered.html,/\(i\)\s+Nested/);assert.match(rendered.html,/\(ii\)\s+Next/);assert.match(rendered.html,/\(b\)\s+Second/);
  assert.ok(!rendered.html.includes('label='));
  assert.ok(!renderQuestion('\\section{<script>bad()</script>}').html.includes('<script>'));
});
test('assignment draft, edit, publication, image authorization, and answer-key privacy',async()=>{
  const app=createApp({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  function client(){let cookie='';return async(path,method='GET',body,raw=false)=>{
    const response=await fetch(base+'/api'+path,{method,headers:{cookie,...(method==='GET'?{}:{'x-mathroom-request':'1'}),...(raw?{'x-file-name':'paper.zip'}:method==='GET'?{}:{'content-type':'application/json'})},body:body===undefined?undefined:raw?body:JSON.stringify(body)});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer()};
  }}
  const admin=client(),student=client(),other=client();
  try{
    await app.provisionTutor({username:'tutor',name:'Tutor',password:'Tutor-test-123'});
    await admin('/login','POST',{username:'tutor',password:'Tutor-test-123'});
    const s=(await admin('/students','POST',{name:'Maya',username:'maya',password:'Student-temp-123'})).body.student;
    const o=(await admin('/students','POST',{name:'Other',username:'other',password:'Other-temp-123'})).body.student;
    for(const [c,name,pass]of [[student,'maya','Student-temp-123'],[other,'other','Other-temp-123']]){await c('/login','POST',{username:name,password:pass});await c('/password','POST',{currentPassword:pass,newPassword:pass+'new'})}
    const chapter=(await admin('/chapters','POST',{number:2,title:'Quadratics',studentIds:[o.id]})).body.id;
    assert.equal((await student('/chapters')).body.chapters.length,0);
    const archive=Buffer.from(zipSync({'paper.tex':strToU8(tex),'triangle.png':png}));
    assert.equal((await student('/assignments/import','POST',archive,true)).status,403);
    const imported=await admin('/assignments/import','POST',archive,true);assert.equal(imported.status,201);const a=imported.body.assignment;
    assert.equal(a.questions.length,2);assert.match(a.questions[0].html,/katex/);
    assert.equal((await student('/assignments')).body.assignments.length,0);
    assert.equal((await student('/assignments/'+a.id)).status,404);
    assert.equal((await admin('/assignments/'+a.id+'/publish','POST',{})).status,400);
    a.chapter_id=chapter;a.studentIds=[s.id];a.due_at='2026-11-05T16:59:00Z';
    a.questions[0].type='mc';a.questions[0].options=['$x=1,2$','$x=2,3$','$x=3,4$'];a.questions[0].correctIndex=1;a.questions[0].points=4;
    a.questions[1].points=6;
    assert.equal((await admin('/assignments/'+a.id,'PUT',a)).status,200);
    assert.equal((await student('/chapters')).body.chapters[0].id,chapter);
    assert.equal((await admin('/assignments/'+a.id+'/publish','POST',{})).status,200);
    const published=(await student('/assignments/'+a.id)).body.assignment;
    assert.equal(published.totalPoints,10);assert.equal(published.questions[0].correctIndex,undefined);
    assert.equal(published.studentIds,undefined);assert.match(published.questions[1].html,/assignment-assets/);
    const imageId=published.questions[1].html.match(/assignment-assets\/(\d+)/)[1];
    assert.equal((await student('/assignment-assets/'+imageId)).status,200);
    assert.equal((await other('/assignment-assets/'+imageId)).status,404);
    assert.equal((await other('/assignments/'+a.id)).status,404);
    assert.equal((await student('/assignments/'+a.id,'PUT',a)).status,403);
    assert.equal((await admin('/assignments/'+a.id,'PUT',a)).status,409);
    await admin('/assignments/'+a.id+'/unpublish','POST',{});
    assert.equal((await student('/assignments/'+a.id)).status,404);
    a.questions[1].source='Missing \\includegraphics{not-found.png}';
    await admin('/assignments/'+a.id,'PUT',a);
    assert.equal((await admin('/assignments/'+a.id+'/publish','POST',{})).status,400);
    a.questions[1].source='Explain your work.';a.questions[0].correctIndex=null;
    await admin('/assignments/'+a.id,'PUT',a);
    assert.equal((await admin('/assignments/'+a.id+'/publish','POST',{})).status,400);
    assert.equal((await fetch(base+'/katex/katex.min.css')).status,200);
    assert.equal((await fetch(base+'/katex/fonts/KaTeX_Main-Regular.woff2')).status,200);
    const repair=(await admin('/assignments','POST',{})).body.assignment;
    repair.questions[0].source='begin{questions}\nquestion First\nbegin{choices}\nchoice A\nCorrectChoice B\nend{choices}\nquestion Explain\nend{questions}';
    await admin('/assignments/'+repair.id,'PUT',repair);
    assert.equal((await student('/assignments/'+repair.id+'/reparse','POST',{})).status,404);
    const fixed=await admin('/assignments/'+repair.id+'/reparse','POST',{});
    assert.equal(fixed.status,200);assert.deepEqual(fixed.body.assignment.questions.map(q=>q.type),['mc','reasoning']);
    assert.equal(fixed.body.assignment.questions[0].correctIndex,1);
    assert.equal((await admin('/assignments/'+repair.id+'/reparse','POST',{})).status,400);
  }finally{await app.close()}
});
