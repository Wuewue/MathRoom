import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
function harness(saved='en'){
 const dom=new JSDOM('<!doctype html><html><body><div id="app"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><div id="toast"></div></body></html>',{url:'https://mathroom.example',runScripts:'outside-only'}),w=dom.window;
 w.localStorage.setItem('mathroom-language',saved);w.matchMedia=()=>({matches:false,addEventListener(){}});w.fetch=()=>new Promise(()=>{});w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const file of ['language.js','theme.js','app.js'])vm.runInContext(readFileSync(new URL('../local-review/public/'+file,import.meta.url),'utf8'),dom.getInternalVMContext());
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,dom,run:s=>vm.runInContext(s,dom.getInternalVMContext()),switch:lang=>w.mathroomLanguage.set(lang),text:()=>w.document.body.textContent};
}
test('language persists, translates login and theme, and round-trips without replacing input nodes',()=>{
 const h=harness('vi');try{
  h.run('authScreen()');h.switch('vi');const input=h.w.document.querySelector('[name=username]');input.value='parent@example.com';
  assert.match(h.text(),/Đăng nhập/);assert.equal(h.w.document.documentElement.lang,'vi');assert.equal(h.w.document.querySelector('[data-language-switch]').value,'vi');assert.match(h.text(),/Giao diện tối/);
  h.switch('en');assert.match(h.text(),/Sign in/);assert.equal(h.w.document.querySelector('[name=username]'),input);assert.equal(input.value,'parent@example.com');assert.equal(h.w.localStorage.getItem('mathroom-language'),'en');
 }finally{h.dom.window.close()}
});
test('Vietnamese lesson review preserves tutor comments, titles, names and input values exactly',()=>{
 const h=harness();try{
  h.run(`state.user={id:2,name:'Progress',username:'maya',role:'student'};state.lessons=[{id:1,title:'Question 1',chapter_title:'Chapters',chapter_number:1,student_id:2,starts_at:'2026-11-02T09:00:00Z',duration:60,status:'completed',performance:'Good progress',summary:'Good progress',comment:'Needs practice'}];state.results=[];render();lessonDetail(1)`);
  h.switch('vi');const dialog=h.w.document.querySelector('#dialog-content');assert.match(dialog.textContent,/Nội dung đã học/);assert.match(dialog.textContent,/Nhận xét của gia sư/);assert.match(dialog.textContent,/Tiến bộ tốt/);
  const protectedText=[...dialog.querySelectorAll('[data-user-content]')].map(n=>n.textContent);assert.ok(protectedText.includes('Good progress'));assert.ok(protectedText.includes('Needs practice'));assert.equal(dialog.querySelector('h2').textContent,'Question 1');
  h.switch('en');assert.match(dialog.textContent,/What we covered/);assert.match(dialog.textContent,/Needs practice/);
 }finally{h.dom.window.close()}
});
test('switching languages preserves a draft lesson and internal status values',()=>{
 const h=harness();try{
  h.run(`state.user={id:1,name:'Tutor',role:'admin'};state.students=[{id:2,name:'Progress',active:true}];state.chapters=[{id:1,number:1,title:'Question 1',studentIds:[2]}];lessonForm()`);
  const note=h.w.document.querySelector('[name=comment]'),status=h.w.document.querySelector('[name=status]');note.value='Em đã tiến bộ 9% — keep this exactly.';status.value='completed';h.switch('vi');
  assert.equal(note.value,'Em đã tiến bộ 9% — keep this exactly.');assert.equal(status.value,'completed');assert.equal(status.selectedOptions[0].textContent,'Đã hoàn thành');assert.equal(h.w.document.querySelector('#lesson-student option').textContent,'Progress');
  assert.equal(h.w.document.querySelector('[name=chapterId] option').textContent,'1 · Question 1');h.switch('en');assert.equal(status.value,'completed');assert.equal(status.selectedOptions[0].textContent,'Completed');
 }finally{h.dom.window.close()}
});
test('assignment paper, selected answers and photo drafts survive the language switch',()=>{
 const h=harness();try{
  h.run(`state.user={id:2,name:'Maya',role:'student'};state.page='Work';state.work={id:1,title:'Progress',due_at:'2026-11-03T12:00:00Z',questions:[{type:'mc',points:2,html:'Question 2',optionHtml:['Good progress','Needs practice']}]};state.workResult={submitted:false,items:[{attempt:0,type:'mc'}]};state.mcDraft={0:1};state.photoDrafts={all:[{file:{name:'photo.jpg'},url:'blob:test'}]};render()`);
  const radio=h.w.document.querySelector('input[value="1"]');h.switch('vi');assert.equal(radio.checked,true);assert.equal(h.run('state.photoDrafts.all[0].file.name'),'photo.jpg');assert.equal(h.w.document.querySelector('h1').textContent,'Progress');assert.equal(h.w.document.querySelector('.paper-content').textContent,'Question 2');assert.match(h.text(),/Good progress/);assert.match(h.text(),/Phần 1 · Trắc nghiệm/);
 }finally{h.dom.window.close()}
});
test('late dynamic errors are translated, and unsupported languages are ignored',async()=>{
 const h=harness();try{h.switch('vi');h.run(`toast('Invalid email, username or password.')`);await new Promise(r=>setTimeout(r,10));assert.equal(h.w.document.querySelector('#toast').textContent,'Email, tên đăng nhập hoặc mật khẩu không đúng.');h.switch('xx');assert.equal(h.w.mathroomLanguage.get(),'vi');assert.equal(h.w.mathroomLanguage.translate('Wait for A Tung review'),'Chờ anh Tùng chấm bài')}finally{h.dom.window.close()}
});
