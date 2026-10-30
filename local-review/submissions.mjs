export function submissionRoutes({db,readJson,send,requireThat,admin,transaction}){
  db.exec(`CREATE TABLE IF NOT EXISTS responses(
    assignment_id INTEGER REFERENCES assignments(id),student_id INTEGER REFERENCES users(id),
    question_index INTEGER,attempt INTEGER NOT NULL,answers TEXT,submitted_at TEXT NOT NULL,
    score REAL,feedback TEXT NOT NULL DEFAULT '',PRIMARY KEY(assignment_id,student_id,question_index));
    CREATE TABLE IF NOT EXISTS response_photos(id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,student_id INTEGER,question_index INTEGER,mime TEXT,data BLOB);`);
  const one=(sql,...p)=>db.prepare(sql).get(...p),all=(sql,...p)=>db.prepare(sql).all(...p),run=(sql,...p)=>db.prepare(sql).run(...p);
  function assignment(id,sid){const a=one("SELECT a.* FROM assignments a JOIN assignment_students s ON s.assignment_id=a.id WHERE a.id=? AND s.student_id=? AND a.status='published'",id,sid);requireThat(a,'Assignment not found.',404);return a}
  function result(a,sid,viewer){
    const qs=JSON.parse(a.questions),responses=all('SELECT * FROM responses WHERE assignment_id=? AND student_id=?',a.id,sid);
    const submitted=qs.every((q,i)=>responses.some(r=>r.question_index===i));
    const reveal=submitted||viewer==='admin';
    const items=qs.map((q,i)=>{const r=responses.find(r=>r.question_index===i);return {index:i,type:q.type,points:q.points,attempt:r?.attempt||0,score:q.type==='mc'&&!reveal?null:r?.score??null,feedback:r?.feedback||'',submittedAt:r?.submitted_at||null,late:!!r&&r.submitted_at>a.due_at,photos:all('SELECT id FROM response_photos WHERE assignment_id=? AND student_id=? AND question_index=? ORDER BY id',a.id,sid,i).map(p=>p.id),...(r&&q.type==='mc'?{answer:JSON.parse(r.answers),...(reveal?{correctIndex:q.correctIndex}:{})}:{})}});
    const complete=items.every(r=>r.score!==null),total=qs.reduce((s,q)=>s+q.points,0);
    return {submitted,photos:all('SELECT id FROM response_photos WHERE assignment_id=? AND student_id=? ORDER BY id',a.id,sid).map(p=>p.id),reasoningAttempt:Math.max(0,...items.filter(q=>q.type==='reasoning').map(q=>q.attempt)),assignmentId:a.id,title:a.title,chapterId:a.chapter_id,studentId:sid,items,percentage:complete?100*items.reduce((s,r)=>s+r.score,0)/total:null,status:complete?'Graded':items.some(r=>!r.attempt)?'Missing work':'Awaiting marking',late:items.some(r=>r.late)};
  }
  return async(req,res,u,path)=>{
    const photo=path.match(/^\/api\/response-photos\/(\d+)$/);
    if(photo&&req.method==='GET'){
      const p=one('SELECT * FROM response_photos WHERE id=?',Number(photo[1]));requireThat(p&&(u.role==='admin'||p.student_id===u.id),'Photo not found.',404);
      if(u.role!=='admin')assignment(p.assignment_id,u.id);
      res.writeHead(200,{'Content-Type':p.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(p.data);return true;
    }
    if(path==='/api/results'&&req.method==='GET'){
      const rows=u.role==='admin'?all("SELECT a.*,s.student_id FROM assignments a JOIN assignment_students s ON s.assignment_id=a.id WHERE a.status='published'"):all("SELECT a.*,s.student_id FROM assignments a JOIN assignment_students s ON s.assignment_id=a.id WHERE a.status='published' AND s.student_id=?",u.id);
      send(res,200,{results:rows.map(a=>result(a,a.student_id,u.role))});return true;
    }
    const m=path.match(/^\/api\/work\/(\d+)(?:\/(mc|photo|grade))?$/);if(!m)return false;
    const id=Number(m[1]);
    if(req.method==='GET'&&!m[2]){const sid=u.role==='admin'?Number(new URL(req.url,'http://localhost').searchParams.get('student')):u.id;send(res,200,{result:result(assignment(id,sid),sid,u.role)});return true}
    if(req.method!=='POST')return false;
    if(m[2]==='grade'){
      admin(u);const b=await readJson(req),a=assignment(id,b.studentId),qs=JSON.parse(a.questions),q=qs[b.index];
      requireThat(Number.isInteger(b.index)&&q?.type==='reasoning','Choose a reasoning question.');
      requireThat(Number.isFinite(b.score)&&b.score>=0&&b.score<=q.points,'Score must be between zero and the available points.');
      requireThat(typeof b.feedback==='string'&&b.feedback.length<=5000,'Feedback must be at most 5,000 characters.');
      const changed=run('UPDATE responses SET score=?,feedback=? WHERE assignment_id=? AND student_id=? AND question_index=? AND attempt=?',b.score,b.feedback,id,b.studentId,b.index,b.attempt).changes;
      requireThat(changed===1,'This submission changed. Reload before marking.',409);send(res,200,{result:result(a,b.studentId,u.role)});return true;
    }
    requireThat(u.role==='student','Only students can submit work.',403);
    // Read and validate the body before checking current state: another request may finish while uploading.
    let b,files=[];
    if(m[2]==='photo'){
      requireThat((req.headers['content-type']||'').startsWith('multipart/form-data;'),'Upload photos using the file picker.',415);
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;requireThat(size<=21*1024*1024,'Total upload limit is 20 MB.',413);chunks.push(chunk)}
      let form;try{form=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':req.headers['content-type']},body:Buffer.concat(chunks)}).formData()}catch{requireThat(false,'Invalid photo upload.')}
      b={index:Number(form.get('index')),attempt:Number(form.get('attempt'))};files=form.getAll('photos');
      requireThat(files.length>=1&&files.length<=8,'Choose 1–8 photos.');let total=0;
      files=await Promise.all(files.map(async file=>{requireThat(typeof file.arrayBuffer==='function'&&file.size>0&&file.size<=8*1024*1024,'Each photo must be under 8 MB.');const data=Buffer.from(await file.arrayBuffer());total+=data.length;
        const mime=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'?'image/webp':null;
        requireThat(mime,'Only PNG, JPEG and WebP photos are supported.');return {mime,data};}));requireThat(total<=20*1024*1024,'Total upload limit is 20 MB.',413);
    }else b=await readJson(req);
    const a=assignment(id,u.id),qs=JSON.parse(a.questions),now=new Date().toISOString();
    if(m[2]==='mc'){
      const mc=qs.map((q,i)=>({...q,index:i})).filter(q=>q.type==='mc');
      requireThat(mc.length&&Array.isArray(b.answers)&&b.answers.length===mc.length,'Answer every multiple-choice question.');
      requireThat(mc.every((q,i)=>Number.isInteger(b.answers[i])&&b.answers[i]>=0&&b.answers[i]<q.options.length),'Choose one valid answer for every question.');
      requireThat(!one("SELECT 1 FROM responses WHERE assignment_id=? AND student_id=? AND answers IS NOT NULL",id,u.id),'Multiple-choice answers have already been submitted.',409);
      transaction(()=>mc.forEach((q,i)=>run('INSERT INTO responses(assignment_id,student_id,question_index,attempt,answers,submitted_at,score) VALUES(?,?,?,1,?,?,?)',id,u.id,q.index,JSON.stringify(b.answers[i]),now,b.answers[i]===q.correctIndex?q.points:0)));
    }else if(m[2]==='photo'){
      const reasoning=qs.map((q,i)=>({...q,index:i})).filter(q=>q.type==='reasoning');
      requireThat(reasoning.length,'This paper has no reasoning questions.');
      requireThat(qs.every((q,i)=>q.type!=='mc'||one('SELECT 1 FROM responses WHERE assignment_id=? AND student_id=? AND question_index=?',id,u.id,i)),'Complete multiple choice first.',409);
      const previous=one('SELECT MAX(attempt) AS attempt FROM responses WHERE assignment_id=? AND student_id=? AND answers IS NULL',id,u.id)?.attempt||0;
      requireThat(previous<2,'Two submissions have already been used.',409);requireThat(b.attempt===previous,'Submission changed. Reload before uploading again.',409);
      transaction(()=>{
        for(const q of reasoning)run("INSERT INTO responses(assignment_id,student_id,question_index,attempt,submitted_at) VALUES(?,?,?,?,?) ON CONFLICT(assignment_id,student_id,question_index) DO UPDATE SET attempt=excluded.attempt,submitted_at=excluded.submitted_at,score=NULL,feedback=''",id,u.id,q.index,previous+1,now);
        run('DELETE FROM response_photos WHERE assignment_id=? AND student_id=?',id,u.id);
        for(const f of files)run('INSERT INTO response_photos(assignment_id,student_id,question_index,mime,data) VALUES(?,?,?,?,?)',id,u.id,-1,f.mime,f.data);
      });
    }else return false;
    send(res,200,{result:result(a,u.id,u.role)});return true;
  };
}
