'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const dayFormat = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
function dateKey(value=new Date()) { const parts=Object.fromEntries(dayFormat.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day; }
function timeLabel(value) { return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
function localDateTime(value) { return dateKey(value)+'T'+timeLabel(value); }
function niceDate(value) { return new Intl.DateTimeFormat('en',{timeZone:'Asia/Bangkok',weekday:'short',day:'numeric',month:'short'}).format(new Date(value)); }
const today=dateKey(), initialMonth=today.slice(0,7);
const state={user:null,page:'Overview',chapters:[],students:[],lessons:[],assignments:[],editor:null,month:initialMonth,date:today,filter:'',ready:false};
const isAdmin=()=>state.user?.role==='admin';
const icons={Overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',Students:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0112 0v3M17 6a3 3 0 010 6m1 3a5 5 0 013 5"/>',Chapters:'<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/>',Calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>',Settings:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'};
function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'+(icons[name]||icons.Overview)+'</svg>'}
const brand='<a class="brand" href="/"><span class="brandmark">m<span>·</span></span> mathroom</a>';
const languageButton='<label class="language-control" translate="no"><span class="sr-only">Language / Ngôn ngữ</span><select data-language-switch aria-label="Language / Ngôn ngữ"><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>';
const themeButton='<button type="button" class="btn theme-toggle" data-theme-toggle>Dark mode</button>'+languageButton;
function button(label,action,primary=false,id=''){return '<button type="button" class="btn '+(primary?'primary':'')+'" data-action="'+action+'" data-id="'+id+'">'+label+'</button>'}
function tag(label,type=''){return '<span class="pill '+type+'">'+esc(label)+'</span>'}
function heading(title,subtitle,action='',userTitle=false){return '<div class="page-heading"><div><h1'+(userTitle?' translate="no"':'')+'>'+esc(title)+'</h1><div class="subtitle">'+esc(subtitle)+'</div></div>'+action+'</div>'}
function metric(label,value,note){return '<div class="stat"><div class="stat-label">'+esc(label)+'</div><div class="stat-value">'+value+'</div><div class="stat-note">'+esc(note)+'</div></div>'}
function empty(title,description,action=''){return '<div class="empty"><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p>'+action+'</div>'}
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',4500)}
async function api(path,method='GET',data){
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Mathroom-Request':'1'},body:data===undefined?undefined:JSON.stringify(data)});
  const body=await response.json();
  if(!response.ok){const error=new Error(body.error||'Request failed.');error.status=response.status;throw error;}
  return body;
}
function modal(title,body,userTitle=false){userTitle=userTitle||[...state.lessons,...state.assignments,...state.chapters].some(x=>x.title&&String(title).includes(x.title));$('#dialog-content').innerHTML='<div class="dialog-head"><h2'+(userTitle?' translate="no"':'')+'>'+esc(title)+'</h2><button class="close" type="button" data-action="close" aria-label="Close dialog">×</button></div>'+body;if(!$('#dialog').open)$('#dialog').showModal()}
function userText(value){return '<span data-user-content translate="no">'+esc(value)+'</span>'}
function uiText(value){return window.mathroomLanguage?.translate(value)||value}
function confirmAction(value){return window.confirm(uiText(value))}
function closeModal(){$('#dialog').close()}
function input(label,name,type='text',value='',extra=''){return '<label class="field">'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>'}
function area(label,name,value='',max=5000){return '<label class="field">'+label+'<textarea name="'+name+'" maxlength="'+max+'">'+esc(value)+'</textarea></label>'}
function select(label,name,options,value='',extra=''){return '<label class="field">'+label+'<select name="'+name+'" '+extra+'>'+options.map(o=>'<option value="'+esc(o[0])+'" '+(String(o[0])===String(value)?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select></label>'}
function formEnd(label='Save'){return '<p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary" type="submit">'+label+'</button></div></form>'}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase()}
function authScreen(kind='login'){
  const change=kind==='change';
  const title=change?'Choose your own password.':'Welcome back.';
  const subtitle=change?'Replace the temporary password your tutor gave you.':'Sign in to your personal learning workspace.';
  $('#app').innerHTML='<div class="auth-wrap"><section class="auth-card"><div class="auth-head">'+brand+themeButton+'</div><h1>'+title+'</h1><p class="subtitle">'+subtitle+'</p><form id="'+(change?'forced-password-form':'login-form')+'">'+
    (!change?input('Username','username','text','','required minlength="3" maxlength="32" autocomplete="username" autocapitalize="none" spellcheck="false"'):'')+
    (change?input('Temporary password','currentPassword','password','','required maxlength="128" autocomplete="current-password"'):'')+
    input(change?'New password':'Password',change?'newPassword':'password','password','', 'required '+(change?'minlength="10" ':'')+'maxlength="128" autocomplete="'+(change?'new-password':'current-password')+'"')+
    (change?input('Confirm password','confirm','password','','required minlength="10" maxlength="128" autocomplete="new-password"'):'')+
    '<p class="form-error" role="alert"></p><button class="btn primary" type="submit">'+(change?'Save password & continue':'Sign in')+'</button></form>'+
    '<p class="notice">'+(change?'Use at least 10 characters.': 'Your tutor provides your username and password. Ask your tutor if you need a reset.')+'</p>'+
    (change?'<button class="link" data-action="logout">Sign out</button>':'')+'</section></div>';window.refreshThemeControls();
}
async function refresh(){
  const requests=[api('/chapters'),api('/lessons'),api('/assignments')];if(isAdmin())requests.push(api('/students'));
  const [chapters,lessons,assignments,students]=await Promise.all(requests);
  state.chapters=chapters.chapters;state.lessons=lessons.lessons;state.assignments=assignments.assignments;state.students=students?.students||[];state.results=(await api('/results')).results;render();
}
async function enter(user){state.user=user;state.page='Overview';state.filter='';if(user.mustChange){authScreen('change');return}await refresh()}
function render(){
  const names=isAdmin()?['Overview','Assignments','Progress','Students','Chapters','Calendar','Settings']:['Overview','Assignments','Progress','Chapters','Calendar','Settings'];
  const pages={Overview:overview,Assignments:assignmentList,Editor:assignmentEditor,Work:workPage,Progress:progressPage,Students:students,Chapters:chapters,Calendar:calendar,Settings:settings};
  $('#app').innerHTML='<div class="shell"><aside>'+brand+'<p class="eyebrow">A LITTLE PROGRESS, EVERY LESSON</p><div class="role-box"><span>'+(isAdmin()?'T':'S')+'</span><div><b>'+(isAdmin()?'Tutor workspace':'Student workspace')+'</b><small>'+(isAdmin()?'Your teaching, in one place':'Your chapters. Your progress.')+'</small></div></div><nav>'+names.map(n=>'<button data-page="'+n+'" class="'+(state.page===n?'active':'')+'">'+icon(n)+'<span>'+n+'</span></button>').join('')+'</nav><div class="side-user"><div class="avatar">'+esc(initials(state.user.name))+'</div><div class="grow"><b>'+userText(state.user.name)+'</b><small>@'+userText(state.user.username)+'</small></div>'+button('Sign out','logout')+'</div></aside><div class="workspace"><header><div id="crumb">'+(isAdmin()?'Tutor':'Student')+' / '+state.page+'</div>'+themeButton+'<div class="avatar" title="'+esc(state.user.name)+'">'+esc(initials(state.user.name))+'</div><button class="link" data-action="logout">Sign out</button></header><main>'+pages[state.page]()+'</main><footer>Mathroom · Phase 4 review<span>Lessons and notes saved on this computer.</span></footer></div></div>';
  window.refreshThemeControls();
}
function overview(){
  const pending=state.lessons.filter(l=>l.status==='scheduled'&&dateKey(l.starts_at)>=today);
  const completed=state.lessons.filter(l=>l.status==='completed');
  if(isAdmin())return heading('A clear view of their progress.',niceDate(new Date())+' · Your tutor workspace',button('+ Schedule lesson','new-lesson',true))+
    '<div class="stats">'+metric('Active students',state.students.filter(s=>s.active).length,'Up to 10 students')+metric('Chapters',state.chapters.length,'Organized your way')+metric('Upcoming lessons',pending.length,'Individual sessions')+'</div>'+
    '<div class="grid"><section><div class="card"><div class="card-head"><div><h2>Your students</h2><p>Personal accounts for individual learning.</p></div>'+button('+ Add student','new-student')+'</div>'+studentTable(true)+'</div><div class="card"><div class="card-head"><h2>Your chapters</h2><button class="link" data-page="Chapters">View chapters →</button></div>'+
    (state.chapters.length?state.chapters.slice(0,3).map(c=>'<div class="lesson"><div class="lesson-date">'+String(c.number).padStart(2,'0')+'</div><div><h3>'+userText(c.title)+'</h3><p>'+c.studentIds.length+' students · '+state.lessons.filter(l=>l.chapter_id===c.id).length+' lessons</p></div><button class="link" data-action="chapter-detail" data-id="'+c.id+'">Open</button></div>').join(''):empty('Begin with a chapter','Choose its number, title, and students.',button('Create chapter','new-chapter',true)))+'</div></section><section><div class="card"><div class="card-head"><h2>Coming up</h2><button class="link" data-page="Calendar">Calendar →</button></div>'+agenda(pending.slice(0,4))+'</div><div class="tip"><div class="eyebrow">YOUR NEXT REVIEW</div><h3>Prepare your next assignment.</h3><p>Upload a paper, review equations and images, choose question types, and publish it to your students.</p><button class="link" data-page="Settings">Account & appearance →</button></div></section></div>';
  return heading('Welcome back, '+state.user.name.split(' ')[0]+'.','Your lessons and tutor feedback, all in one place.')+
    '<div class="stats">'+metric('Your chapters',state.chapters.length,'Assigned by your tutor')+metric('Upcoming lessons',pending.length,'Your individual sessions')+metric('Lessons completed',completed.length,'Every lesson is a step forward')+'</div><div class="grid"><section><div class="card"><div class="card-head"><h2>Your next lessons</h2><button class="link" data-page="Calendar">Calendar →</button></div>'+agenda(pending.slice(0,4))+'</div><div class="card"><h2>Recent feedback</h2>'+
    (state.lessons.filter(l=>l.comment).slice(-3).reverse().map(l=>'<div class="detail-section"><span class="qnum">Chapter '+l.chapter_number+' · '+niceDate(l.starts_at)+'</span><h3>'+userText(l.title)+'</h3><div class="feedback">'+userText(l.comment)+'</div></div>').join('')||'<p class="notice">Your tutor’s lesson comments will appear here.</p>')+'</div></section><section><div class="card"><div class="card-head"><h2>Your chapters</h2></div>'+
    (state.chapters.map(c=>'<div class="lesson"><div class="lesson-date">'+String(c.number).padStart(2,'0')+'</div><div><h3>'+userText(c.title)+'</h3><p>'+state.lessons.filter(l=>l.chapter_id===c.id).length+' lessons</p></div><button class="link" data-action="chapter-detail" data-id="'+c.id+'">Open</button></div>').join('')||'<p class="notice">Your tutor will assign your first chapter.</p>')+'</div><div class="tip"><h3>A space for your learning.</h3><p>Your lesson summaries and comments are private to you and your tutor.</p><p class="next-phase">Open Assignments to submit your work, or Progress to see chapter averages.</p></div></section></div>';
}
function studentTable(compact=false){
  if(!state.students.length)return empty('Your first student starts here.','Create their username and temporary password, then share it with them.',button('Add a student','new-student',true));
  return '<div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>'+(compact?'Chapters':'Account')+'</th><th></th></tr></thead><tbody>'+state.students.map(s=>'<tr><td><div class="person"><div class="avatar">'+esc(initials(s.name))+'</div><div><b>'+userText(s.name)+'</b><small>@'+userText(s.username)+'</small></div></div></td><td>'+tag(s.active?'Active':'Disabled',s.active?'':'gray')+'</td><td>'+(compact?state.chapters.filter(c=>c.studentIds.includes(s.id)).length:tag(s.mustChange?'Password change due':'Ready',s.mustChange?'amber':''))+'</td><td><button class="link" data-action="edit-student" data-id="'+s.id+'">Manage →</button></td></tr>').join('')+'</tbody></table></div>';
}
function students(){return heading('Your students','Create accounts, manage access, and reset passwords.',button('+ Add student','new-student',true))+'<div class="card">'+studentTable()+'</div><div class="callout">You share each student’s username and temporary password yourself. Students choose a new password at first sign-in.</div>'}
function chapters(){return heading(isAdmin()?'Chapters, at your pace.':'Your chapters',isAdmin()?'Choose the number and title. Add as many individual lessons as needed.':'Your tutor organizes your lessons into chapters.',isAdmin()?button('+ New chapter','new-chapter',true):'')+
  (state.chapters.length?'<div class="card-grid">'+state.chapters.map(c=>'<div class="card"><div class="chapter-heading"><div class="chapter-number">'+String(c.number).padStart(2,'0')+'</div><div><span class="qnum">Chapter '+c.number+'</span><h2>'+userText(c.title)+'</h2></div></div><p class="chapter-description">'+(c.description?userText(c.description):esc('A new chapter in your learning.'))+'</p><div class="meta-line"><span>'+state.lessons.filter(l=>l.chapter_id===c.id&&l.status!=='cancelled').length+' lessons</span>'+(isAdmin()?'<span>'+c.studentIds.length+' students</span>':'')+'</div><div class="chapter-footer">'+button('View lessons','chapter-detail',false,c.id)+(isAdmin()?button('Edit','edit-chapter',false,c.id)+button('+ Lesson','chapter-lesson',true,c.id):'')+'</div></div>').join('')+'</div>':'<div class="card">'+empty('No chapters yet.',isAdmin()?'Create your first chapter and assign students.':'Your tutor will add your chapters here.',isAdmin()?button('Create chapter','new-chapter',true):'')+'</div>')}
function agenda(lessons){return lessons.length?lessons.map(l=>'<div class="agenda-row"><div class="agenda-time">'+timeLabel(l.starts_at)+'<small>'+niceDate(l.starts_at).replace(/^[^,]*, /,'')+'</small></div><div class="agenda-body"><h3>'+userText(l.title)+'</h3><p>'+(isAdmin()?userText(l.student_name)+' · ':'')+'Chapter '+l.chapter_number+' · '+l.duration+' min</p>'+tag(l.status,l.status==='cancelled'?'gray':l.status==='completed'?'':'amber')+'</div><button class="link" data-action="lesson-detail" data-id="'+l.id+'">Open</button></div>').join(''):empty('Nothing scheduled here.','Your next individual lesson will appear here.')}
function calendar(){
  const [year,month]=state.month.split('-').map(Number),count=new Date(year,month,0).getDate(),offset=(new Date(year,month-1,1).getDay()+6)%7;
  const visible=state.lessons.filter(l=>!state.filter||String(l.student_id)===state.filter);
  const deadlines=state.assignments.filter(a=>a.status==='published'&&a.due_at&&(!state.filter||a.studentIds?.includes(Number(state.filter))));
  let cells='';for(let i=0;i<offset;i++)cells+='<div class="day dim" aria-hidden="true"></div>';
  for(let d=1;d<=count;d++){const key=state.month+'-'+String(d).padStart(2,'0'),events=visible.filter(l=>dateKey(l.starts_at)===key),due=deadlines.filter(a=>dateKey(a.due_at)===key);
    const labels=[...events.map(l=>timeLabel(l.starts_at)+' '+l.title),...due.map(a=>'Due: '+a.title)];
    cells+='<button class="day '+(key===state.date?'selected ':'')+(key===today?'today ':'')+(labels.length?'has':'')+'" data-action="day" data-date="'+key+'" aria-label="'+key+', '+events.length+' lessons and '+due.length+' deadlines">'+d+labels.slice(0,2).map(label=>'<span class="event" translate="no">'+esc(label)+'</span>').join('')+(labels.length>2?'<small>+'+(labels.length-2)+' more</small>':'')+'</button>';
  }
  return heading('Study calendar','All lesson times and deadlines use Bangkok time (UTC+7).',isAdmin()?button('+ Schedule lesson','new-lesson',true):'')+'<div class="card"><div class="calendar-toolbar"><h2>'+new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(new Date(year,month-1,1))+'</h2><div class="toolbar">'+(isAdmin()?'<select class="filter" id="student-filter" aria-label="Filter student"><option value="">All students</option>'+state.students.map(s=>'<option value="'+s.id+'" '+(state.filter===String(s.id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select>':'')+button('←','previous-month')+button('Today','today')+button('→','next-month')+'</div></div><div class="calendar">'+['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d=>'<div class="day-name">'+d+'</div>').join('')+cells+'</div></div><div class="card"><div class="card-head"><h2>'+niceDate(state.date+'T12:00:00+07:00')+'</h2>'+(isAdmin()?button('+ Lesson on this day','new-lesson'):'')+'</div>'+agenda(visible.filter(l=>dateKey(l.starts_at)===state.date))+deadlines.filter(a=>dateKey(a.due_at)===state.date).map(a=>'<div class="agenda-row"><div class="agenda-time">'+timeLabel(a.due_at)+'<small>Due</small></div><div class="agenda-body"><h3>'+userText(a.title)+'</h3><p>'+a.questionCount+' questions · '+a.totalPoints+' points</p></div>'+button('Open','open-assignment',false,a.id)+'</div>').join('')+dailyResults(state.date,state.filter)+'</div>';
}
function settings(){return heading('Account & appearance','Make your workspace comfortable.')+'<div class="card settings-card"><h2>Appearance</h2><p class="subtitle">Your choice is remembered in this browser.</p>'+themeButton+'</div><div class="card settings-card"><h2>Your account</h2><p class="subtitle">'+userText(state.user.name)+' · @'+userText(state.user.username)+'</p>'+button('Change password','change-password')+'</div><div class="card settings-card"><h2>This review version</h2><p class="subtitle">Accounts, chapters, and lessons save on this computer. Hosting and access from other devices are configured before the real-use trial.</p></div>'}
function assignmentList(){
  return heading('Assignments',isAdmin()?'Import your paper, prepare questions, then publish.':'Papers assigned to you by your tutor.',isAdmin()?'<div class="toolbar">'+button('+ New assignment','new-assignment')+button('Upload LaTeX','upload-paper',true)+'</div>':'')+
    '<div class="card">'+(state.assignments.length?state.assignments.map(a=>{
      const chapter=state.chapters.find(c=>c.id===a.chapter_id);
      return '<div class="assignment"><div class="assignment-icon">∑</div><div class="assignment-body"><h3>'+userText(a.title)+'</h3><p>'+(chapter?'Chapter '+chapter.number+' · ':'')+a.questionCount+' questions · '+a.totalPoints+' points</p><p>'+(a.due_at?'Due '+niceDate(a.due_at)+' at '+timeLabel(a.due_at)+' Bangkok':'No deadline yet')+'</p></div>'+tag(a.status,a.status==='draft'?'gray':'')+(isAdmin()&&a.status==='published'?button('Cancel publication','unpublish',false,a.id):'')+button(isAdmin()?'Open':'Do assignment','open-assignment',false,a.id)+'</div>';
    }).join(''):empty('No assignments yet.',isAdmin()?'Upload a .tex file or a ZIP containing your paper and images.':'Your tutor will publish assignments here.'))+'</div>'+
    (!isAdmin()?'<div class="callout">Submit your answers and view tutor feedback.</div>':'');
}
function assignmentEditor(){
  const a=state.editor;if(!a)return assignmentList();
  const active=state.students.filter(s=>s.active);
  if(a.status==='published')return heading(a.title,'Published · return to draft to make changes.',button('Cancel publication','unpublish',false,a.id),true)+'<div class="card">'+paperView(a)+'</div>';
  if(a.hasSubmissions)return heading(a.title,'Publication cancelled. Submitted work is preserved; this paper is locked against edits.',button('Republish assignment','republish',true,a.id),true)+'<div class="card">'+paperView(a)+'</div>';
  return heading('Prepare your assignment','Save to update the equation and image previews.','<button type="button" class="btn" data-page="Assignments">Cancel editing</button>')+
    (a.warnings.length?'<div class="callout">'+a.warnings.map(esc).join('<br>')+'</div>':'')+
    '<form id="assignment-form"><div class="card"><div class="fields">'+input('Assignment title','title','text',a.title,'required maxlength="160"')+select('Chapter','chapter_id',[['','Choose chapter'],...state.chapters.map(c=>[c.id,c.number+' · '+c.title])],a.chapter_id||'','id="assignment-chapter"')+'</div>'+
    input('Deadline · Bangkok (UTC+7)','due_at','datetime-local',a.due_at?localDateTime(a.due_at):'')+
    '<div class="field">Assign students · '+active.length+' available<div class="student-select">'+(active.length?active.map(s=>'<label><input type="checkbox" name="studentIds" value="'+s.id+'" '+(a.studentIds.includes(s.id)?'checked':'')+'> <span>'+userText(s.name)+' <small class="muted">@'+userText(s.username)+'</small></span></label>').join(''):'<p class="form-note">No active students yet. Add a student in the admin Students page.</p>')+'</div><p class="form-note">Choose who receives this assignment. Selected students are also added to the chosen chapter when you save. Only published assignments are visible to students.</p></div></div>'+
    a.questions.map((q,i)=>'<section class="card"><div class="card-head"><h2>Question '+(i+1)+'</h2><div class="toolbar">'+(i?button('Move up','question-up',false,i):'')+(a.questions.length>1?button('Remove','question-remove',false,i):'')+'</div></div><div class="fields">'+select('Type','type'+i,[['reasoning','Reasoning · photo upload'],['mc','Multiple choice']],q.type,'data-question-type="'+i+'"')+input('Points','points'+i,'number',q.points,'required min=".5" max="100" step=".5"')+'</div>'+area('Question text and LaTeX','source'+i,q.source,10000)+
      (q.type==='mc'?'<div class="fields">'+q.options.map((option,j)=>input('Option '+String.fromCharCode(65+j),'opt'+i,'text',option,'maxlength="2000"')).join('')+'</div>'+select('Correct answer','correct'+i,[['','Choose correct answer'],...q.options.map((_,j)=>[j,'Option '+String.fromCharCode(65+j)])],q.correctIndex??''):'<p class="notice">Students upload one shared set of photos for all reasoning questions. Two submissions maximum; the latest replaces the first.</p>')+
      '<div class="question-preview"><span class="qnum">Last saved preview</span><div class="paper-content">'+(q.html||'<p class="notice">Save to render this question.</p>')+'</div></div>'+
      (q.issues?.length?'<div class="import-error">'+q.issues.map(esc).join('<br>')+'</div>':'')+'</section>').join('')+
    '<div class="card editor-actions"><div class="toolbar">'+button('Cancel editing','cancel-editing')+(a.questions.length===1?button('Split questions automatically','reparse',false,a.id):'')+button('+ Add question','question-add')+'<button class="btn primary" type="submit">Save & update preview</button>'+button('Student preview','paper-preview')+button('Publish assignment','publish',true)+'</div><p class="form-error" role="alert"></p><p class="notice">Publishing requires a chapter, deadline, assigned students, valid equations/images, and complete answer keys. Late submissions are accepted and labelled.</p></div></form>';
}
function paperView(a){
  return '<p class="subtitle">'+a.questions.length+' questions · '+a.totalPoints+' points'+(a.due_at?' · Due '+niceDate(a.due_at)+' '+timeLabel(a.due_at)+' Bangkok':'')+'</p>'+
    a.questions.map((q,i)=>'<div class="question"><span class="qnum">Question '+(i+1)+' · '+q.points+' points</span><div class="paper-content">'+q.html+'</div>'+
      (q.type==='mc'?q.optionHtml.map((option,j)=>'<label class="option"><input type="radio" name="preview-q'+i+'" value="'+j+'"> '+option+'</label>').join(''):'<div class="upload-zone"><b>Photo answer</b><small>Students can upload photos after publication.</small></div>')+'</div>').join('');
}
function collectEditor(){
  const form=$('#assignment-form');if(!form)return;
  const d=new FormData(form),a=state.editor;a.title=String(d.get('title'));a.chapter_id=Number(d.get('chapter_id'))||null;a.due_at=d.get('due_at')?new Date(d.get('due_at')+':00+07:00').toISOString():null;a.studentIds=d.getAll('studentIds').map(Number);
  a.questions=a.questions.map((q,i)=>({...q,source:String(d.get('source'+i)),type:String(d.get('type'+i)),points:Number(d.get('points'+i)),options:d.getAll('opt'+i).length?d.getAll('opt'+i).map(String):q.options,correctIndex:d.get('correct'+i)===null||d.get('correct'+i)===''?null:Number(d.get('correct'+i))}));
}
async function saveAssignment(){
  collectEditor();const a=state.editor;
  const result=await api('/assignments/'+a.id,'PUT',{title:a.title,chapter_id:a.chapter_id,due_at:a.due_at,studentIds:a.studentIds,questions:a.questions});
  state.editor=result.assignment;state.editorDirty=false;state.chapters=(await api('/chapters')).chapters;render();return result.assignment;
}
async function openAssignment(id){
  const {assignment}=await api('/assignments/'+id);
  if(isAdmin()){state.editor=assignment;state.page='Editor';state.editorDirty=false;render()}
  else {if(state.page==='Work'&&workDirty()&&!confirmAction('Discard unsent answers and open this paper?'))return;Object.values(state.photoDrafts||{}).flat().forEach(f=>URL.revokeObjectURL(f.url));state.replacingReasoning=false;state.work=assignment;state.workResult=(await api('/work/'+id)).result;state.photoDrafts={};state.mcDraft={};state.page='Work';closeModal();render()}
}
let paperImportBusy=false,paperDragDepth=0;
function uploadPaper(){paperDragDepth=0;modal('Import a LaTeX paper','<p class="subtitle">Upload one .tex file, or a ZIP containing one .tex file and PNG, JPG, or WebP images.</p><label class="upload-zone paper-drop-zone" id="paper-drop-zone"><b>Drag your paper here</b><small>or choose a file below · .tex or .zip · up to 20 MB</small><input id="paper-upload" type="file" accept=".tex,.zip"></label><p class="notice">Supported question lists: enumerate with item, or questions with question. Equations use standard math delimiters. Custom packages and macros are flagged for review.</p><p class="notice">Choices blocks automatically create multiple-choice questions. Use CorrectChoice for the answer. Questions without choices become reasoning.</p><a href="/assignment-template.tex" download>Download LaTeX template</a><p id="import-status" role="status" aria-live="polite"></p>')}
async function importSelectedPaper(files){
  if(paperImportBusy)return;
  const status=$('#import-status'),picker=$('#paper-upload'),zone=$('#paper-drop-zone');
  if(!status)return;
  if(!files?.length)return;
  if(files.length!==1){status.textContent='Drop one .tex file or one ZIP containing your paper and images.';return}
  const file=files[0];
  if(!/\.(tex|zip)$/i.test(file.name)){status.textContent='Choose a .tex file or a .zip archive.';return}
  if(file.size>20*1024*1024){status.textContent='Choose a file no larger than 20 MB.';return}
  paperImportBusy=true;picker.disabled=true;zone.setAttribute('aria-busy','true');
  status.textContent='Importing '+file.name+'…';
  try{
    const response=await fetch('/api/assignments/import',{method:'POST',headers:{'X-Mathroom-Request':'1','X-File-Name':encodeURIComponent(file.name)},body:file});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to import this paper.');
    state.editor=data.assignment;state.editorDirty=false;state.page='Editor';closeModal();render();
    try{state.assignments=(await api('/assignments')).assignments}catch{ /* The import already committed; keep its editor visible. */ }
    toast('Paper imported as a draft. Review every question before publishing.');
  }catch(error){status.textContent=error.message;if(!$('#dialog').open)toast(error.message)}
  finally{paperImportBusy=false;picker.disabled=false;picker.value='';zone.removeAttribute('aria-busy')}
}
function fileDrag(event){return Array.from(event.dataTransfer?.types||[]).includes('Files')}
function clearPaperDrag(){paperDragDepth=0;$('#paper-drop-zone')?.classList.remove('drag-active')}
document.addEventListener('dragenter',event=>{
  if(!fileDrag(event)||!event.target.closest?.('#paper-drop-zone'))return;
  event.preventDefault();paperDragDepth++;if(!paperImportBusy)$('#paper-drop-zone').classList.add('drag-active');
});
document.addEventListener('dragover',event=>{
  if(!fileDrag(event))return;
  event.preventDefault();
  event.dataTransfer.dropEffect=event.target.closest?.('#paper-drop-zone')&&!paperImportBusy?'copy':'none';
});
document.addEventListener('dragleave',event=>{
  if(!event.target.closest?.('#paper-drop-zone'))return;
  paperDragDepth=Math.max(0,paperDragDepth-1);
  if(!paperDragDepth)$('#paper-drop-zone')?.classList.remove('drag-active');
});
document.addEventListener('drop',async event=>{
  if(event.target.closest?.('[data-photo-zone]'))return;
  if(!fileDrag(event))return;
  event.preventDefault();clearPaperDrag();
  if(event.target.closest?.('#paper-drop-zone'))await importSelectedPaper(event.dataTransfer.files);
  else if($('#dialog').open&&$('#import-status'))$('#import-status').textContent='Drop your paper inside the upload area.';
  else toast('Open Assignments → Upload LaTeX, then drop your paper into the upload area.');
});
document.addEventListener('dragend',clearPaperDrag);
function studentForm(id=0){
  const s=state.students.find(x=>x.id===id);
  modal(s?'Manage '+s.name:'Add a student','<form id="student-form" data-id="'+id+'">'+input('Student name','name','text',s?.name||'','required maxlength="80" autocomplete="off"')+
    (s?'<p class="subtitle">Username: <b>@'+userText(s.username)+'</b></p>'+select('Account access','active',[['true','Active'],['false','Disabled']],String(s.active))+'<p class="form-note">Disabling immediately signs the student out. Their chapters and notes are retained.</p>':input('Username','username','text','','required minlength="3" maxlength="32" autocomplete="off" autocapitalize="none" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}"')+input('Temporary password','password','password','','required minlength="10" maxlength="128" autocomplete="new-password"')+'<p class="form-note">Share these credentials yourself. The student must change the password at first sign-in.</p>')+
    (s?'<div class="callout">'+button('Reset password','reset-password',false,s.id)+'</div>':'')+formEnd(s?'Save changes':'Create student'));
}
function resetPassword(id){const s=state.students.find(s=>s.id===id);modal('Reset '+s.name+'’s password','<p class="subtitle">This signs the student out and requires a password change at their next sign-in.</p><form id="reset-form" data-id="'+id+'">'+input('New temporary password','password','password','','required minlength="10" maxlength="128" autocomplete="new-password"')+formEnd('Reset password'))}
function chapterForm(id=0){
  const c=state.chapters.find(x=>x.id===id);
  modal(c?'Edit chapter':'Create a chapter','<form id="chapter-form" data-id="'+id+'"><div class="fields">'+input('Chapter number','number','number',c?.number||Math.max(0,...state.chapters.map(c=>c.number))+1,'required min="1" max="9999" step="1"')+input('Title','title','text',c?.title||'','required maxlength="160"')+'</div>'+area('Description (optional)','description',c?.description||'',2000)+'<div class="field">Assign students<div class="student-select">'+
    (state.students.length?state.students.map(s=>'<label><input type="checkbox" name="studentIds" value="'+s.id+'" '+(c?.studentIds.includes(s.id)?'checked':'')+'> '+userText(s.name)+(s.active?'':' (disabled)')+'</label>').join(''):'<p class="form-note">Create student accounts first, or save the chapter and assign them later.</p>')+'</div></div>'+formEnd());
}
function chapterDetail(id){const c=state.chapters.find(c=>c.id===id);modal('Chapter '+c.number+' · '+c.title,'<p class="subtitle">'+userText(c.description)+'</p>'+agenda(state.lessons.filter(l=>l.chapter_id===id))+(isAdmin()?'<div class="dialog-actions">'+button('+ Add lesson','chapter-lesson',true,id)+'</div>':''))}
function studentOptions(chapterId,selected){
  const c=state.chapters.find(c=>c.id===Number(chapterId)),students=state.students.filter(s=>s.active&&c?.studentIds.includes(s.id));
  return students.map(s=>'<option value="'+s.id+'" '+(s.id===Number(selected)?'selected':'')+'>'+esc(s.name)+'</option>').join('');
}
function lessonForm(id=0,chapterId=0){
  if(!state.chapters.length){toast('Create a chapter and assign a student first.');return}
  const l=state.lessons.find(l=>l.id===id),selectedChapter=l?.chapter_id||chapterId||state.chapters[0].id;
  modal(l?'Edit lesson':'Schedule an individual lesson','<form id="lesson-form" data-id="'+id+'"><div class="fields">'+select('Chapter','chapterId',state.chapters.map(c=>[c.id,c.number+' · '+c.title]),selectedChapter,'id="lesson-chapter" required')+'<label class="field">Student<select name="studentId" id="lesson-student" required>'+studentOptions(selectedChapter,l?.student_id||state.filter)+'</select></label></div><p class="form-note">Only active students assigned to the selected chapter appear here.</p>'+input('Lesson title','title','text',l?.title||'','required maxlength="160"')+'<div class="fields">'+input('Date & time · Bangkok (UTC+7)','startsAt','datetime-local',l?localDateTime(l.starts_at):state.date+'T16:00','required')+input('Duration in minutes','duration','number',l?.duration||60,'required min="15" max="240" step="1"')+'</div><div class="fields">'+select('Status','status',[['scheduled','Scheduled'],['completed','Completed'],['cancelled','Cancelled']],l?.status||'scheduled')+select('Student performance','performance',['Not reviewed','Needs practice','Good progress','Confident'].map(s=>[s,s]),l?.performance||'Not reviewed')+'</div>'+area('What you covered','summary',l?.summary||'')+area('Comment visible to the student','comment',l?.comment||'')+formEnd(l?'Save lesson':'Schedule lesson'));
}
function lessonDetail(id){
  const l=state.lessons.find(l=>l.id===id);
  modal(l.title,'<p class="subtitle">'+niceDate(l.starts_at)+' · '+timeLabel(l.starts_at)+' Bangkok · '+l.duration+' minutes</p><p class="subtitle">Chapter '+l.chapter_number+' · '+userText(l.chapter_title)+(isAdmin()?' · '+userText(l.student_name):'')+'</p><div class="toolbar">'+tag(l.status,l.status==='cancelled'?'gray':'')+tag(l.performance,'gray')+'</div><div class="detail-section"><h3>What we covered</h3><p>'+(l.summary?userText(l.summary):esc('Your tutor will add a summary after the lesson.'))+'</p></div><div class="detail-section"><h3>Tutor’s comment</h3><div class="feedback">'+(l.comment?userText(l.comment):esc('No comment yet.'))+'</div></div>'+dailyResults(dateKey(l.starts_at),l.student_id)+''+(isAdmin()?'<div class="dialog-actions">'+button('Edit lesson & feedback','edit-lesson',true,l.id)+'</div>':''));
}
function passwordForm(){modal('Change your password','<form id="password-form">'+input('Current password','currentPassword','password','','required maxlength="128" autocomplete="current-password"')+input('New password','newPassword','password','','required minlength="10" maxlength="128" autocomplete="new-password"')+input('Confirm new password','confirm','password','','required minlength="10" maxlength="128" autocomplete="new-password"')+formEnd('Change password'))}
async function recover(error){
  if(error.status===401){state.user=null;closeModal();authScreen();toast('Your session ended. Please sign in again.');return}
  if(error.status===403){try{const {user}=await api('/me');if(user.mustChange){closeModal();await enter(user);return}}catch{}}
  toast(error.message || 'Unable to reach the local server.');
}
document.addEventListener('click',async event=>{
  const page=event.target.closest('[data-page]');
  if(page){if(state.page==='Work'&&workDirty()&&!confirmAction('Leave with unsent answers? Opening another paper discards this draft.'))return;if(state.page==='Editor'&&state.editorDirty&&!confirmAction('Leave without saving your changes?'))return;state.page=page.dataset.page;render();return}
  const element=event.target.closest('[data-action]');if(!element)return;
  const a=element.dataset.action,id=Number(element.dataset.id);
  try{
    if(a==='upload-paper')uploadPaper();
    if(a==='new-assignment'){const r=await api('/assignments','POST',{});state.editor=r.assignment;state.editorDirty=false;state.page='Editor';state.assignments=(await api('/assignments')).assignments;render()}
    if(a==='open-assignment')await openAssignment(id);
    if(a==='question-add'){collectEditor();state.editor.questions.push({source:'New question.',type:'reasoning',points:1,options:['','','',''],correctIndex:null});state.editorDirty=true;render()}
    if(a==='question-remove'){collectEditor();state.editor.questions.splice(id,1);state.editorDirty=true;render()}
    if(a==='question-up'){collectEditor();[state.editor.questions[id-1],state.editor.questions[id]]=[state.editor.questions[id],state.editor.questions[id-1]];state.editorDirty=true;render()}
    if(a==='cancel-editing'){if(state.editorDirty&&!confirmAction('Leave without saving your changes?'))return;state.editorDirty=false;state.page='Assignments';render()}
    if(a==='reparse'){await saveAssignment();const r=await api('/assignments/'+id+'/reparse','POST',{});state.editor=r.assignment;state.editorDirty=false;state.assignments=(await api('/assignments')).assignments;render()}
    if(a==='paper-preview'){const paper=await saveAssignment();modal('Student preview: '+paper.title,'<p class="notice">Answers selected here are for preview only and are not saved.</p>'+paperView(paper))}
    if(a==='publish'){const paper=await saveAssignment();await api('/assignments/'+paper.id+'/publish','POST',{});await openAssignment(paper.id);toast('Published to the assigned students.');state.assignments=(await api('/assignments')).assignments}
    if(a==='republish'){await api('/assignments/'+id+'/publish','POST',{});await openAssignment(id);state.assignments=(await api('/assignments')).assignments;render()}
    if(a==='unpublish'){if(!confirmAction('Hide this assignment from students? Submitted work and grades will be preserved.'))return;await api('/assignments/'+id+'/unpublish','POST',{});await openAssignment(id);state.assignments=(await api('/assignments')).assignments;render()}
    if(a==='close')closeModal();
    if(a==='logout'){await api('/logout','POST',{});state.user=null;closeModal();authScreen()}
    if(a==='new-student')studentForm();
    if(a==='edit-student')studentForm(id);
    if(a==='reset-password')resetPassword(id);
    if(a==='new-chapter')chapterForm();
    if(a==='edit-chapter')chapterForm(id);
    if(a==='chapter-detail')chapterDetail(id);
    if(a==='new-lesson')lessonForm();
    if(a==='edit-lesson')lessonForm(id);
    if(a==='chapter-lesson')lessonForm(0,id);
    if(a==='lesson-detail')lessonDetail(id);
    if(a==='change-password')passwordForm();
    if(a==='day'){state.date=element.dataset.date;render()}
    if(a==='today'){state.date=dateKey();state.month=state.date.slice(0,7);render()}
    if(a==='previous-month'||a==='next-month'){const [y,m]=state.month.split('-').map(Number),d=new Date(y,m-1+(a==='next-month'?1:-1),1);state.month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');state.date=state.month+'-01';render()}
  }catch(error){await recover(error)}
});
document.addEventListener('input',event=>{if(event.target.closest('#assignment-form'))state.editorDirty=true});
window.addEventListener('beforeunload',event=>{if(state.page==='Editor'&&state.editorDirty){event.preventDefault();event.returnValue=''}});
document.addEventListener('change',async event=>{
  if(event.target.id==='assignment-chapter'){collectEditor();state.editorDirty=true;render()}
  if(event.target.hasAttribute('data-question-type')){collectEditor();state.editorDirty=true;render()}
  if(event.target.id==='paper-upload'){
    await importSelectedPaper(event.target.files);
  }
  if(event.target.id==='lesson-chapter')$('#lesson-student').innerHTML=studentOptions(event.target.value);
  if(event.target.id==='student-filter'){state.filter=event.target.value;render()}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.id.endsWith('-form'))return;event.preventDefault();
  if(form.id==='assignment-form'){const submit=form.querySelector('[type=submit]');submit.disabled=true;try{await saveAssignment();state.assignments=(await api('/assignments')).assignments;toast('Draft saved. Preview updated.')}catch(error){form.querySelector('.form-error').textContent=error.message;submit.disabled=false}return}
  const fd=new FormData(form),data=Object.fromEntries(fd.entries()),id=Number(form.dataset.id),submit=form.querySelector('[type=submit]'),errorBox=form.querySelector('.form-error');
  errorBox.textContent='';submit.disabled=true;const oldLabel=submit.textContent;submit.textContent='Saving…';
  try{
    if(form.id==='login-form'){const {user}=await api('/login','POST',data);await enter(user);return}
    if(form.id==='password-form'||form.id==='forced-password-form'){
      if(data.newPassword!==data.confirm)throw new Error('Passwords do not match.');
      const {user}=await api('/password','POST',data);closeModal();await enter(user);toast('Your password has been changed.');return;
    }
    if(form.id==='student-form'){await api(id?'/students/'+id:'/students',id?'PATCH':'POST',id?{name:data.name,active:data.active==='true'}:data)}
    if(form.id==='reset-form')await api('/students/'+id+'/reset-password','POST',{password:data.password});
    if(form.id==='chapter-form')await api(id?'/chapters/'+id:'/chapters',id?'PUT':'POST',{...data,studentIds:fd.getAll('studentIds').map(Number)});
    if(form.id==='lesson-form')await api(id?'/lessons/'+id:'/lessons',id?'PUT':'POST',{...data,startsAt:new Date(data.startsAt+':00+07:00').toISOString()});
    closeModal();await refresh();toast(form.id==='student-form'&&!id?'Student created. Share their credentials yourself.':form.id==='reset-form'?'Password reset. Share the new temporary password yourself.':'Saved.');
  }catch(error){if(error.status===401&&form.id!=='login-form')await recover(error);else errorBox.textContent=error.message||'Unable to reach the server.'}
  finally{submit.disabled=false;submit.textContent=oldLabel}
});
async function boot(){
  try{
    try{const {user}=await api('/me');await enter(user)}catch(error){if(error.status===401)authScreen();else throw error}
  }catch(error){$('#app').innerHTML='<div class="auth-wrap"><div class="auth-card">'+brand+'<h1>Workspace unavailable</h1><p>'+esc(error.message)+'</p><p class="notice">Start the local server, then reload this page.</p><a class="btn primary" href="/">Try again</a></div></div>'}
}
boot();

function percentage(value){return value===null?'—':Number(value.toFixed(1))+'%'}
function dailyResults(day,sid){
  const rows=(state.results||[]).filter(r=>(!sid||r.studentId===Number(sid))&&r.items.some(q=>q.submittedAt&&dateKey(q.submittedAt)===day));
  return '<div class="detail-section"><h3>Test work submitted this day</h3>'+(rows.length?rows.map(r=>'<div class="assignment"><div class="grow"><b>'+userText(r.title)+'</b><p>'+(isAdmin()?esc(state.students.find(s=>s.id===r.studentId)?.name||'Student')+' · ':'')+resultLabel(r)+(r.late?' · Late':'')+'</p><small>Latest result</small></div>'+(isAdmin()?'<button class="btn" data-review-assignment="'+r.assignmentId+'" data-student="'+r.studentId+'">Review work</button>':button('Open','open-assignment',false,r.assignmentId))+'</div>').join(''):'<p class="notice">No retained submissions on this date.</p>')+'</div>';
}
function workDirty(){return Object.values(state.photoDrafts||{}).some(a=>a.length)||state.page==='Work'&&Object.keys(state.mcDraft||{}).length&&state.workResult?.items.some(q=>q.type==='mc'&&!q.attempt)}
function resultLabel(r){return r.percentage===null?r.status:percentage(r.percentage)}
function workPage(){
  const a=state.work,r=state.workResult;if(!a)return assignmentList();
  const mc=a.questions.map((q,i)=>({...q,index:i})).filter(q=>q.type==='mc'),reasoning=a.questions.map((q,i)=>({...q,index:i})).filter(q=>q.type==='reasoning');
  const mcDone=mc.every(q=>r.items[q.index].attempt),finished=r.submitted,replacing=state.replacingReasoning;
  const intro=heading(a.title,'Due '+niceDate(a.due_at)+' · '+timeLabel(a.due_at)+' Bangkok','',true)+'<p class="notice">Part 1 · Multiple choice → Part 2 · Reasoning → Results</p>';
  if(finished&&!replacing)return intro+'<section class="card"><h2>Work submitted</h2>'+ (r.percentage===null?'<p class="feedback">Wait for A Tung review</p>':'<p class="feedback">Final result: '+percentage(r.percentage)+'</p>')+(r.late?tag('Late','gray'):'')+'</section>'+(mc.length?'<section class="card"><h2>Multiple-choice results</h2><p>'+r.items.filter(q=>q.type==='mc').reduce((n,q)=>n+q.score,0)+' / '+mc.reduce((n,q)=>n+q.points,0)+' points</p>'+mc.map(q=>{const item=r.items[q.index];return '<div class="question"><h3>Question '+(q.index+1)+'</h3><div class="paper-content">'+q.html+'</div><p>Your answer: '+String.fromCharCode(65+item.answer)+' · '+item.score+' / '+q.points+'</p><div class="feedback">Correct answer: '+String.fromCharCode(65+item.correctIndex)+'<div class="paper-content">'+q.optionHtml[item.correctIndex]+'</div></div></div>'}).join('')+'</section>':'')+(reasoning.length?'<section class="card"><h2>Your reasoning work</h2>'+workPhotos(r.photos||[])+reasoning.map(q=>{const item=r.items[q.index];return '<div class="question"><h3>Question '+(q.index+1)+'</h3><div class="paper-content">'+q.html+'</div><p>'+(item.score===null?'Wait for A Tung review':item.score+' / '+q.points+' points')+'</p><div class="feedback">'+userText(item.feedback)+'</div></div>'}).join('')+(r.reasoningAttempt<2?'<button class="btn" data-replace-reasoning>Replace reasoning work</button><p class="notice">One replacement allowed. It deletes the previous photos and reasoning evaluations.</p>':'<p class="notice">Both reasoning submissions have been used.</p>')+'</section>':'');
  if(!mcDone)return intro+'<section class="card"><h2>Part 1 · Multiple choice</h2><p>Complete every question, then continue to reasoning. Correct answers appear after you submit the whole assignment.</p></section>'+mc.map(q=>'<section class="card"><h3>Question '+(q.index+1)+' · '+q.points+' points</h3><div class="paper-content">'+q.html+'</div>'+q.optionHtml.map((html,j)=>'<label class="option"><input type="radio" name="answer'+q.index+'" data-answer="'+q.index+'" value="'+j+'" '+(state.mcDraft[q.index]===j?'checked':'')+'> '+html+'</label>').join('')+'</section>').join('')+'<div class="card"><button class="btn primary" data-send-mc>'+ (reasoning.length?'Continue to reasoning':'Submit assignment')+'</button><p class="notice">Your choices are final when you continue.</p></div>';
  const drafts=state.photoDrafts.all||[];
  return intro+'<section class="card"><h2>Part 2 · Reasoning</h2><p>Finish all the questions below on paper, then upload your work together once. You may include several photos for multiple pages.</p></section>'+reasoning.map(q=>'<section class="card"><h3>Question '+(q.index+1)+' · '+q.points+' points</h3><div class="paper-content">'+q.html+'</div></section>').join('')+'<section class="card"><h2>Upload all your reasoning work</h2><div class="upload-zone" data-photo-zone="all"><b>Drop your photos here or choose files</b><small>One upload for all questions · up to 8 photos · 8 MB each · 20 MB total</small><input type="file" accept="image/png,image/jpeg,image/webp" multiple data-photo-picker="all"></div><div class="photo-drafts">'+drafts.map((f,j)=>'<div><img class="work-photo" src="'+f.url+'" alt="Draft page '+(j+1)+'"><p>Page '+(j+1)+' · '+userText(f.file.name)+'</p><button class="btn" data-photo-op="remove" data-question="all" data-position="'+j+'">Remove</button>'+(j?'<button class="btn" data-photo-op="up" data-question="all" data-position="'+j+'">Move up</button>':'')+'</div>').join('')+'</div><button class="btn primary" data-send-photo="all">Submit assignment</button>'+(replacing?'<button class="btn" data-cancel-replacement>Cancel replacement</button>':'')+'</section>';
}
function workPhotos(ids){return ids.map(id=>'<a href="/api/response-photos/'+id+'" target="_blank" rel="noopener"><img class="work-photo" src="/api/response-photos/'+id+'" alt="Submitted reasoning work"></a>').join('')}
function chapterStats(results,chapters){return chapters.map(c=>{const rows=results.filter(r=>r.chapterId===c.id),graded=rows.filter(r=>r.percentage!==null);return {...c,rows,average:graded.length?graded.reduce((n,r)=>n+r.percentage,0)/graded.length:null}})}
function progressPage(){
  const sid=isAdmin()?Number(state.progressStudent||state.students[0]?.id):state.user.id,results=(state.results||[]).filter(r=>r.studentId===sid),stats=chapterStats(results,state.chapters).filter(c=>c.rows.length).sort((a,b)=>a.number-b.number);
  const graded=stats.filter(c=>c.average!==null),coords=graded.map((c,i)=>[40+i*520/Math.max(1,graded.length-1),180-c.average*1.4]);
  return heading(isAdmin()?'Progress & marking':'Your chapter progress','Chapter averages include fully graded assignments only. Each assignment has equal weight.')+(isAdmin()?'<label class="field">Student<select id="progress-student">'+state.students.map(s=>'<option value="'+s.id+'" '+(s.id===sid?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label>':'')+(graded.length?'<div class="card"><svg class="progress-chart" viewBox="0 0 620 225" role="img" aria-label="Chapter average graph. Details below."><path d="M40 40V180H580" fill="none" stroke="currentColor" opacity=".3"/><text x="0" y="45">100%</text><text x="10" y="180">0%</text><polyline points="'+coords.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="var(--green, #478268)" stroke-width="3"/>'+graded.map((c,i)=>'<circle cx="'+coords[i][0]+'" cy="'+coords[i][1]+'" r="5" fill="currentColor"/><text text-anchor="middle" x="'+coords[i][0]+'" y="210">Ch '+c.number+'</text>').join('')+'</svg></div>':'')+stats.map(c=>{const previous=graded[graded.indexOf(c)-1],change=previous?c.average-previous.average:null;return '<details class="card"><summary>Chapter '+c.number+' · '+userText(c.title)+' — <b>'+percentage(c.average)+'</b>'+(change!==null?' · '+(change>=0?'+':'')+Number(change.toFixed(1))+' percentage points':'')+'</summary><p class="notice">'+c.rows.filter(r=>r.status==='Missing work').length+' assignments with missing work · '+c.rows.filter(r=>r.status==='Awaiting marking').length+' awaiting marking</p>'+c.rows.map(r=>'<div class="assignment"><div class="grow"><b>'+userText(r.title)+'</b><p>'+resultLabel(r)+(r.late?' · Late':'')+'</p></div>'+(isAdmin()?'<button class="btn" data-review-assignment="'+r.assignmentId+'" data-student="'+sid+'">Review work</button>':button('Open','open-assignment',false,r.assignmentId))+'</div>').join('')+'</details>'}).join('')+(!stats.length?empty('No results yet','Published assignments will appear here.'): '');
}
async function reviewWork(id,sid){
  const [{assignment:a},{result:r}]=await Promise.all([api('/assignments/'+id),api('/work/'+id+'?student='+sid)]);
  modal(a.title+' · '+(state.students.find(s=>s.id===sid)?.name||'Student'),'<h3>Reasoning submission · all questions</h3>'+workPhotos(r.photos||[])+r.items.map((item,i)=>'<section class="question"><h3>Question '+(i+1)+' · '+item.points+' points</h3><div class="paper-content">'+a.questions[i].html+'</div><p>'+(!item.attempt?'Not submitted':item.type==='mc'?item.score+' / '+item.points+' · Answer '+String.fromCharCode(65+item.answer)+' · Correct '+String.fromCharCode(65+item.correctIndex):'Submission '+item.attempt+' of 2')+(item.late?' · Late':'')+'</p>'+item.photos.map(id=>'<a href="/api/response-photos/'+id+'" target="_blank" rel="noopener"><img class="work-photo" src="/api/response-photos/'+id+'" alt="Student working"></a>').join('')+(item.type==='reasoning'&&item.attempt?'<form data-grade-assignment="'+id+'" data-student="'+sid+'" data-question="'+i+'" data-attempt="'+item.attempt+'">'+input('Score','score','number',item.score??'','required min="0" max="'+item.points+'" step="any"')+area('Feedback visible to student','feedback',item.feedback)+'<p class="form-error" role="alert"></p><button class="btn primary" type="submit">Save evaluation</button></form>':'')+'</section>').join(''));
}
function addPhotos(index,files){
  const current=state.photoDrafts[index]||[],incoming=Array.from(files);
  if(current.length+incoming.length>8||incoming.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>8*1024*1024)||[...current.map(f=>f.file),...incoming].reduce((n,f)=>n+f.size,0)>20*1024*1024){toast('Choose up to 8 PNG, JPEG or WebP photos, under 8 MB each and 20 MB total.');return}
  state.photoDrafts[index]=[...current,...incoming.map(file=>({file,url:URL.createObjectURL(file)}))];render();
}
document.addEventListener('change',e=>{
  if(e.target.matches('[data-answer]'))state.mcDraft[e.target.dataset.answer]=Number(e.target.value);
  if(e.target.matches('[data-photo-picker]'))addPhotos(e.target.dataset.photoPicker,e.target.files);
  if(e.target.id==='progress-student'){state.progressStudent=e.target.value;render()}
});
document.addEventListener('dragover',e=>{if(e.target.closest('[data-photo-zone]')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
document.addEventListener('drop',e=>{const z=e.target.closest('[data-photo-zone]');if(z){e.preventDefault();addPhotos(z.dataset.photoZone,e.dataTransfer.files)}});
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-send-mc],[data-send-photo],[data-photo-op],[data-review-assignment],[data-replace-reasoning],[data-cancel-replacement]');if(!el)return;
  try{
    if(el.hasAttribute('data-replace-reasoning')){state.replacingReasoning=true;render();return}
    if(el.hasAttribute('data-cancel-replacement')){state.replacingReasoning=false;render();return}
    if(el.hasAttribute('data-review-assignment')){await reviewWork(Number(el.dataset.reviewAssignment),Number(el.dataset.student));return}
    if(el.dataset.photoOp){const arr=state.photoDrafts[el.dataset.question],pos=Number(el.dataset.position);if(el.dataset.photoOp==='remove'){URL.revokeObjectURL(arr[pos].url);arr.splice(pos,1)}else [arr[pos-1],arr[pos]]=[arr[pos],arr[pos-1]];render();return}
    el.disabled=true;
    if(el.hasAttribute('data-send-mc')){
      const answers=state.work.questions.flatMap((q,i)=>q.type==='mc'?[state.mcDraft[i]]:[]);if(answers.some(v=>v===undefined))throw new Error('Answer every multiple-choice question first.');
      if(!confirmAction('Submit your final multiple-choice answers? You have one attempt.'))return;
      state.workResult=(await api('/work/'+state.work.id+'/mc','POST',{answers})).result;
    }else{
      const i='all',photos=state.photoDrafts[i]||[],attempt=state.workResult.reasoningAttempt;
      if(!photos.length)throw new Error('Choose at least one photo first.');
      if(attempt&&!confirmAction('Replace your first photos and evaluation permanently? This is your final submission.'))return;
      const data=new FormData();data.append('index',i);data.append('attempt',attempt);photos.forEach(f=>data.append('photos',f.file));
      const response=await fetch('/api/work/'+state.work.id+'/photo',{method:'POST',headers:{'X-Mathroom-Request':'1'},body:data}),body=await response.json();if(!response.ok)throw new Error(body.error);
      state.workResult=body.result;state.replacingReasoning=false;photos.forEach(f=>URL.revokeObjectURL(f.url));state.photoDrafts[i]=[];
    }
    state.results=(await api('/results')).results;render();toast(state.workResult.submitted?'Assignment submitted.':'Multiple choice saved. Continue to reasoning.');
  }catch(error){await recover(error)}finally{el.disabled=false}
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!f.hasAttribute('data-grade-assignment'))return;e.preventDefault();const btn=f.querySelector('button');btn.disabled=true;
  try{const d=new FormData(f);await api('/work/'+f.dataset.gradeAssignment+'/grade','POST',{studentId:Number(f.dataset.student),index:Number(f.dataset.question),attempt:Number(f.dataset.attempt),score:Number(d.get('score')),feedback:String(d.get('feedback'))});state.results=(await api('/results')).results;render();toast('Evaluation saved.')}catch(error){f.querySelector('.form-error').textContent=error.message}finally{btn.disabled=false}
});
window.addEventListener('beforeunload',e=>{if(Object.values(state.photoDrafts||{}).some(a=>a.length)||state.page==='Work'&&Object.keys(state.mcDraft||{}).length&&state.workResult?.items.some(q=>q.type==='mc'&&!q.attempt)){e.preventDefault();e.returnValue=''}});


