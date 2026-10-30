import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const themeSource=readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');
function themeHarness(saved=null,darkSystem=false){
  const handlers={},buttons=[{textContent:'',setAttribute(name,value){this[name]=value}}];
  const storage=new Map(saved?[['mathroom-theme',saved]]:[]);
  const html={dataset:{}};
  const context=vm.createContext({document:{documentElement:html,querySelectorAll:()=>buttons,addEventListener:(event,fn)=>handlers[event]=fn},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{matchMedia:()=>({matches:darkSystem,addEventListener:(event,fn)=>handlers.system=fn})}});
  vm.runInContext(themeSource,context);
  return {handlers,storage,html,buttons,context};
}
test('theme follows system initially and saves explicit choice',()=>{
  const h=themeHarness(null,true);
  assert.equal(h.html.dataset.theme,'dark');
  h.handlers.click({target:{closest:()=>true}});
  assert.equal(h.html.dataset.theme,'light');assert.equal(h.storage.get('mathroom-theme'),'light');
  assert.equal(h.buttons[0]['aria-label'],'Switch to dark mode');
  const reload=themeHarness(h.storage.get('mathroom-theme'),true);assert.equal(reload.html.dataset.theme,'light');
  reload.handlers.system();assert.equal(reload.html.dataset.theme,'light');
});
test('saved dark mode survives recreated page controls',()=>{
  const h=themeHarness('dark',false);h.context.window.refreshThemeControls();
  assert.equal(h.html.dataset.theme,'dark');assert.equal(h.buttons[0].textContent,'☀ Light mode');
});
function interfaceHarness(){
  const nodes=new Map(),handlers={};const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){}},setAttribute(name,value){this[name]=value},removeAttribute(name){delete this[name]},showModal(){this.open=true},close(){this.open=false}});return nodes.get(s)};
  const listeners={};
  const context=vm.createContext({document:{querySelector:node,addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn);handlers[event]=async e=>{for(const listener of listeners[event])await listener(e)}}},window:{refreshThemeControls(){},addEventListener(){}},Intl,Date,setTimeout:()=>1,clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({needsSetup:true})})});
  vm.runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
  return {run:s=>vm.runInContext(s,context),nodes,node,handlers};
}
test('lesson calendar consistently uses Bangkok date and time',()=>{
  const h=interfaceHarness();
  assert.equal(h.run('dateKey("2026-10-30T20:00:00Z")'),'2026-10-31');
  assert.equal(h.run('localDateTime("2026-11-02T09:00:00Z")'),'2026-11-02T16:00');
});
test('student navigation omits account management and role switching',()=>{
  const h=interfaceHarness();h.run('state.user={id:2,name:"Maya Chen",username:"maya",role:"student"};render()');
  const html=h.node('#app').innerHTML;assert.ok(!html.includes('data-page="Students"'));assert.ok(!html.includes('admin-role'));assert.ok(!html.includes('data-action="new-student"'));assert.ok(html.includes('data-theme-toggle'));
});
test('public page offers sign-in only; student creation remains in admin view',()=>{
  const h=interfaceHarness();h.run('authScreen()');
  assert.ok(h.node('#app').innerHTML.includes('login-form'));
  assert.ok(!h.node('#app').innerHTML.includes('setup-form'));
  assert.ok(!h.node('#app').innerHTML.includes('Create tutor account'));
  h.run('state.user={id:1,name:"Tutor",username:"tutor",role:"admin"};render()');
  assert.ok(h.node('#app').innerHTML.includes('data-action="new-student"'));
});
test('saved tutor feedback is escaped in student screens',()=>{
  const h=interfaceHarness();h.run('state.user={id:2,name:"Maya Chen",username:"maya",role:"student"};state.lessons=[{id:1,starts_at:"2026-11-02T09:00:00Z",status:"completed",chapter_number:2,title:"Roots",duration:60,comment:"<script>bad()</script>"}];render()');
  assert.ok(h.node('#app').innerHTML.includes('&lt;script&gt;'));assert.ok(!h.node('#app').innerHTML.includes('<script>bad()'));
});
test('chapter student selector only lists active enrolled students',()=>{
  const h=interfaceHarness();h.run('state.chapters=[{id:1,studentIds:[2,3]}];state.students=[{id:2,name:"Alice",active:true},{id:3,name:"Bob",active:false},{id:4,name:"Other",active:true}]');
  const result=h.run('studentOptions(1,2)');assert.match(result,/Alice/);assert.ok(!result.includes('Bob'));assert.ok(!result.includes('Other'));
});
test('assignment editor lists every active student before chapter selection',()=>{
  const h=interfaceHarness();
  h.run('state.students=[{id:2,name:"Alice",username:"alice",active:true},{id:3,name:"Bob",username:"bob",active:false},{id:4,name:"Maya",username:"maya",active:true}];state.editor={id:1,status:"draft",title:"Paper",chapter_id:null,due_at:null,studentIds:[4],questions:[],warnings:[]}');
  const html=h.run('assignmentEditor()');
  assert.match(html,/Alice/);assert.match(html,/Maya/);assert.ok(!html.includes('>Bob'));
  assert.match(html,/value="4" checked/);assert.match(html,/2 available/);
});
test('calendar shows published deadlines on Bangkok dates and respects student filter',()=>{
  const h=interfaceHarness();
  h.run('state.user={id:1,name:"Tutor",role:"admin"};state.month="2026-11";state.date="2026-11-06";state.assignments=[{id:5,title:"Published paper",status:"published",due_at:"2026-11-05T20:00:00Z",studentIds:[2],questionCount:3,totalPoints:10},{id:6,title:"Private draft",status:"draft",due_at:"2026-11-05T20:00:00Z",studentIds:[2]}]');
  const html=h.run('calendar()');assert.match(html,/Published paper/);assert.ok(!html.includes('Private draft'));assert.match(html,/2026-11-06, 0 lessons and 1 deadlines/);
  h.run('state.filter="3"');assert.ok(!h.run('calendar()').includes('Published paper'));
});
test('paper upload rejects multiple files, unsupported files and oversize files',async()=>{
  const h=interfaceHarness();
  await h.run('importSelectedPaper([{name:"a.tex",size:5},{name:"b.tex",size:5}])');
  assert.match(h.node('#import-status').textContent,/Drop one/);
  await h.run('importSelectedPaper([{name:"paper.pdf",size:5}])');
  assert.match(h.node('#import-status').textContent,/\.tex/);
  await h.run('importSelectedPaper([{name:"paper.zip",size:21*1024*1024}])');
  assert.match(h.node('#import-status').textContent,/20 MB/);
});
test('dropping a paper prevents navigation and uses the same import request',async()=>{
  const h=interfaceHarness();
  h.run('globalThis.sent=[];fetch=async(url,options)=>{sent.push({url,options});return {ok:false,json:async()=>({error:"Test import rejected"})}}');
  let prevented=false;
  await h.handlers.drop({preventDefault(){prevented=true},target:{closest:s=>s==='#paper-drop-zone'?{}:null},dataTransfer:{types:['Files'],files:[{name:'paper.tex',size:5}]}});
  assert.equal(prevented,true);assert.equal(h.run('sent.length'),1);
  assert.equal(h.run('sent[0].url'),'/api/assignments/import');
  assert.equal(h.run('sent[0].options.headers["X-File-Name"]'),'paper.tex');
  assert.equal(h.node('#import-status').textContent,'Test import rejected');
  assert.equal(h.node('#paper-upload').disabled,false);
  assert.equal(h.run('paperImportBusy'),false);
});

test('chapter averages weight assignments equally and exclude missing or unmarked results',()=>{
 const h=interfaceHarness();
 h.run('state.user={id:2,name:"Maya",role:"student"};state.chapters=[{id:1,number:1,title:"First"},{id:2,number:2,title:"Second"}];state.results=[{chapterId:1,studentId:2,percentage:62,status:"Graded",title:"A"},{chapterId:1,studentId:2,percentage:80,status:"Graded",title:"B"},{chapterId:1,studentId:2,percentage:null,status:"Missing work",title:"C"},{chapterId:2,studentId:2,percentage:80,status:"Graded",title:"D"},{chapterId:2,studentId:2,percentage:null,status:"Awaiting marking",title:"E"}]');
 assert.equal(h.run('chapterStats(state.results,state.chapters)[0].average'),71);
 const html=h.run('progressPage()');assert.match(html,/71%/);assert.match(html,/\+9 percentage points/);assert.match(html,/1 assignments with missing work/);assert.match(html,/1 awaiting marking/);assert.match(html,/<details/);assert.match(html,/<svg/);
});
test('assignment has separate MC and reasoning steps, one shared upload, then answers and review message',()=>{
 const h=interfaceHarness();h.run('state.user={id:2,name:"Maya",role:"student"};state.work={id:1,title:"Test",due_at:"2026-11-06T12:00:00Z",questions:[{type:"mc",points:2,html:"Compute",optionHtml:["One","Two"]},{type:"reasoning",points:4,html:"Explain first"},{type:"reasoning",points:4,html:"Explain second"}]};state.photoDrafts={};state.mcDraft={};state.workResult={submitted:false,reasoningAttempt:0,photos:[],percentage:null,status:"Missing work",items:[{type:"mc",points:2,attempt:0},{type:"reasoning",points:4,attempt:0},{type:"reasoning",points:4,attempt:0}]}');
 let html=h.run('workPage()');assert.ok(!html.includes('Correct answer:'));assert.match(html,/Continue to reasoning/);assert.ok(!html.includes('data-photo-picker'));assert.ok(!html.includes('Explain first'));
 h.run('state.workResult.items[0]={type:"mc",points:2,attempt:1,score:null,answer:0}');
 html=h.run('workPage()');assert.match(html,/Explain first/);assert.match(html,/Explain second/);assert.equal((html.match(/data-photo-picker/g)||[]).length,1);assert.ok(!html.includes('Correct answer:'));assert.ok(!html.includes('data-send-mc'));
 h.run('state.workResult.submitted=true;state.workResult.reasoningAttempt=1;state.workResult.photos=[1];state.workResult.items[0].score=2;state.workResult.items[0].correctIndex=0;state.workResult.items[1].attempt=1;state.workResult.items[1].score=null;state.workResult.items[2].attempt=1;state.workResult.items[2].score=null;');
 html=h.run('workPage()');assert.match(html,/Correct answer: A/);assert.match(html,/Wait for A Tung review/);assert.ok(!html.includes('data-photo-picker'));assert.match(html,/data-replace-reasoning/);
 h.run('state.workResult.reasoningAttempt=2');assert.ok(!h.run('workPage()').includes('data-replace-reasoning'));
});
test('calendar results follow Bangkok submission dates and student filters',()=>{
 const h=interfaceHarness();h.run('state.user={id:2,role:"student"};state.results=[{assignmentId:1,studentId:2,title:"Algebra",percentage:80,items:[{submittedAt:"2026-11-01T20:00:00Z"}]}]');
 assert.match(h.run('dailyResults("2026-11-02",2)'),/80%/);assert.ok(!h.run('dailyResults("2026-11-01",2)').includes('Algebra'));assert.ok(!h.run('dailyResults("2026-11-02",3)').includes('Algebra'));
});
