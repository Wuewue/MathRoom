import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const dom=new JSDOM('<div id="app"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><div id="toast"></div>',{url:'https://example.com',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
w.matchMedia=()=>({matches:false,addEventListener(){}});w.fetch=()=>new Promise(()=>{});w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
for(const file of ['language.js','theme.js','app.js'])vm.runInContext(readFileSync('local-review/public/'+file,'utf8'),ctx);
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
vm.runInContext(`state.user={id:1,name:'Demo Tutor',username:'tutor',role:'admin'};state.students=[{id:2,name:'Demo Student',username:'student',active:true}];state.chapters=[{id:1,number:1,title:'Demo chapter',description:'Demo description',studentIds:[2]}];state.lessons=[{id:1,student_id:2,student_name:'Demo Student',chapter_id:1,chapter_number:1,chapter_title:'Demo chapter',title:'Demo lesson',starts_at:'2026-11-02T09:00:00Z',duration:60,status:'completed',performance:'Good progress',summary:'Demo summary',comment:'Demo comment'}];state.assignments=[{id:1,title:'Demo paper',chapter_id:1,studentIds:[2],due_at:'2026-11-03T12:00:00Z',status:'published',questionCount:2,totalPoints:10}];state.results=[];state.editor={...state.assignments[0],status:'draft',warnings:[],questions:[{source:'Demo question',type:'mc',points:2,options:['A','B'],correctIndex:0,html:'Demo equation',issues:[]}]}`,ctx);
const missing=new Set();
for(const action of ["authScreen()",...['Overview','Assignments','Progress','Students','Chapters','Calendar','Settings','Editor'].map(p=>`state.page='${p}';render()`),'studentForm()','studentForm(2)','resetPassword(2)','chapterForm()','chapterDetail(1)','lessonForm()','lessonDetail(1)','passwordForm()','uploadPaper()']){
 w.document.querySelector('#dialog-content').innerHTML='';vm.runInContext(action,ctx);w.mathroomLanguage.set('vi');
 const walker=w.document.createTreeWalker(w.document.body,w.NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){
  if(n.parentElement.closest('[translate=no],[data-user-content],.paper-content,.option,input,textarea,script,style,[data-language-switch],#student-filter option,#progress-student option,#lesson-student option,select[name=chapterId] option,select[name=chapter_id] option'))continue;
  const s=n.nodeValue.trim();if(/[a-z]{3}/.test(s)&&!/[À-ỹ]/.test(s)&&!s.startsWith('Demo')&&!['mathroom','tutor','student'].includes(s))missing.add(s);
 }
}
console.log([...missing].join('\n'));dom.window.close();
