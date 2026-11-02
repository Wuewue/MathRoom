import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importPaper,splitQuestions,renderQuestion} from '../supabase/functions/mathroom/paper.mjs';
import {splitQuestions as localSplit} from '../local-review/paper.mjs';

const mixed=String.raw`\begin{questions}
\question What is $2+3$? \markspoints{2}
\begin{choices}
\choice $4$
% \CorrectChoice ignored comment
\CorrectChoice $5$
\choice $6$
\end{choices}
\question Solve $2x+3=11$. Show your working.
\begin{enumerate}\item Explain.\item Check.\end{enumerate}
\end{questions}`;
test('mixed import extracts choices and answer, preserves reasoning and points',()=>{
  const q=splitQuestions(mixed);
  assert.equal(q.length,2);assert.equal(q[0].type,'mc');assert.equal(q[0].points,2);
  assert.deepEqual(q[0].options,['$4$','$5$','$6$']);assert.equal(q[0].correctIndex,1);
  assert.doesNotMatch(q[0].source,/choice|CorrectChoice/);
  assert.equal(q[1].type,'reasoning');assert.equal(q[1].correctIndex,null);
  assert.match(q[1].source,/Explain/);
  for(const text of [q[0].source,...q[0].options,q[1].source])assert.deepEqual(renderQuestion(text).issues,[]);
  assert.deepEqual(localSplit(mixed),q);
});
test('missing or ambiguous correct answers are never guessed',()=>{
  for(const source of [mixed.replace('\\CorrectChoice $5$','\\choice $5$'),mixed.replace('\\choice $4$','\\CorrectChoice $4$')]){
    const paper=importPaper('paper.tex',Buffer.from(source));
    assert.equal(paper.questions[0].correctIndex,null);
    assert.ok(paper.warnings.some(w=>w.includes('exactly one correct answer')));
  }
});
test('inline choices retain image and nested list content without splitting questions',()=>{
  const [q]=splitQuestions(String.raw`\begin{questions}\question Pick.\begin{oneparchoices}\CorrectChoice \includegraphics{a.png}\begin{itemize}\item A\end{itemize}\choice $x^2$\end{oneparchoices}After.\end{questions}`);
  assert.equal(q.type,'mc');assert.equal(q.options.length,2);assert.equal(q.correctIndex,0);
  assert.match(q.source,/After/);
  assert.deepEqual(renderQuestion(q.options[0],[{id:1,path:'a.png'}]).issues,[]);
});
test('invalid blocks fail clearly or remain visible as preview errors',()=>{
  assert.throws(()=>splitQuestions(String.raw`Q\begin{choices}\choice A\end{choices}`),/2–6/);
  assert.throws(()=>splitQuestions(String.raw`Q\begin{choices}lost text\choice A\choice B\end{choices}`),/after a choice/);
  const [q]=splitQuestions(String.raw`Q\begin{choices}\choice A\choice B`);
  assert.ok(renderQuestion(q.source).issues.length);
});
test('downloadable template imports as a complete mixed paper',()=>{
  const paper=importPaper('template.tex',readFileSync(new URL('../local-review/public/assignment-template.tex',import.meta.url)));
  assert.deepEqual(paper.questions.map(q=>q.type),['mc','reasoning']);
  assert.equal(paper.questions[0].correctIndex,1);
});
