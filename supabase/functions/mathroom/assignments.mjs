import {Buffer} from 'node:buffer';
import { importPaper, renderQuestion } from './paper.mjs';
export function assignmentRoutes({
  db,
  readJson,
  send,
  requireThat,
  admin,
  transaction
}) {
  const one = (sql, ...args) => db.prepare(sql).get(...args),
    all = (sql, ...args) => db.prepare(sql).all(...args),
    run = (sql, ...args) => db.prepare(sql).run(...args);
  const allowed = async (id, u) => u.role === 'admin' || (await one('SELECT 1 FROM assignments a JOIN assignment_students s ON s.assignment_id=a.id WHERE a.id=? AND a.status=\'published\' AND s.student_id=?', id, u.id));
  async function detail(a, u) {
    const assets = await all('SELECT id,path FROM assignment_assets WHERE assignment_id=?', a.id);
    const questions = JSON.parse(a.questions).map(q => {
      const rendered = renderQuestion(q.source, assets, a.base_dir),
        optionRenders = q.type === 'mc' ? q.options.map(s => renderQuestion(s, assets, a.base_dir)) : [];
      const item = {
        source: q.source,
        type: q.type,
        points: q.points,
        options: q.options,
        html: rendered.html,
        optionHtml: optionRenders.map(r => r.html),
        issues: [...rendered.issues, ...optionRenders.flatMap(r => r.issues)]
      };
      if (u.role === 'admin') item.correctIndex = q.correctIndex;
      return item;
    });
    const result = {
      ...a,
      questions,
      warnings: JSON.parse(a.warnings),
      totalPoints: questions.reduce((n, q) => n + q.points, 0)
    };
      if (u.role === 'admin') {
        result.studentIds = (await all('SELECT student_id FROM assignment_students WHERE assignment_id=?', a.id)).map(s => s.student_id);
        result.hasSubmissions = !!(await one('SELECT 1 FROM responses WHERE assignment_id=?', a.id));
      }
    delete result.base_dir;
    return result;
  }
  async function validate(b, publish = false) {
    requireThat(typeof b.title === 'string' && b.title.trim().length > 0 && b.title.length <= 160, 'Enter an assignment title (up to 160 characters).');
    requireThat(Array.isArray(b.questions) && b.questions.length > 0 && b.questions.length <= 100, 'Add 1–100 questions.');
    const questions = b.questions.map(q => {
      requireThat(typeof q.source === 'string' && q.source.trim().length > 0 && q.source.length <= 10000, 'Every question needs text (up to 10,000 characters).');
      requireThat(['mc', 'reasoning'].includes(q.type), 'Choose a supported question type.');
      requireThat(Number.isFinite(q.points) && q.points > 0 && q.points <= 100, 'Question points must be greater than 0 and no more than 100.');
      const options = q.type === 'mc' ? q.options : ['', '', '', ''];
      requireThat(Array.isArray(options) && options.length >= 2 && options.length <= 6 && options.every(s => typeof s === 'string' && s.length <= 2000), 'Multiple choice needs 2–6 options.');
      if (publish && q.type === 'mc') requireThat(options.every(s => s.trim()) && new Set(options.map(s => s.trim())).size === options.length && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < options.length, 'Every multiple-choice question needs distinct options and a correct answer.');
      return {
        source: q.source.trim(),
        type: q.type,
        points: q.points,
        options,
        correctIndex: q.type === 'mc' && Number.isInteger(q.correctIndex) ? q.correctIndex : null
      };
    });
    const chapterId = b.chapter_id ? Number(b.chapter_id) : null;
    requireThat(chapterId === null || (await one('SELECT id FROM chapters WHERE id=?', chapterId)), 'Choose an existing chapter.');
    requireThat(Array.isArray(b.studentIds), 'Choose assigned students.');
    const ids = [...new Set(b.studentIds.map(Number))];
    requireThat((await Promise.all(ids.map(async id => Number.isSafeInteger(id) && (await one('SELECT 1 FROM users WHERE id=? AND active=1 AND role=\'student\'', id))))).every(Boolean), 'Choose available active students.');
    const due = b.due_at ? new Date(b.due_at) : null;
    requireThat(!due || Number.isFinite(due.getTime()), 'Choose a valid deadline.');
    if (publish) requireThat(chapterId && ids.length && due, 'Choose a chapter, at least one student, and a deadline before publishing.');
    return {
      title: b.title.trim(),
      chapterId,
      ids,
      due: due?.toISOString() || null,
      questions
    };
  }
  return async function (req, res, u, path) {
    const method = req.method;
    if (path === '/api/assignments/import' && method === 'POST') {
      admin(u);
      let size = 0,
        chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        requireThat(size <= 20 * 1024 * 1024, 'Upload limit is 20 MB.', 413);
        chunks.push(chunk);
      }
      let filename;
      try {
        filename = decodeURIComponent(req.headers['x-file-name'] || '');
      } catch {
        requireThat(false, 'Invalid filename.');
      }
      let paper;
      try {
        paper = importPaper(filename, Buffer.concat(chunks));
      } catch (e) {
        requireThat(false, e.message);
      }
      const id = await transaction(async () => {
        const id = Number((await run('INSERT INTO assignments(title,questions,base_dir,warnings) VALUES(?,?,?,?)', paper.title.slice(0, 160), JSON.stringify(paper.questions), paper.baseDir, JSON.stringify(paper.warnings))).lastInsertRowid);
        for (const image of paper.images) await run('INSERT INTO assignment_assets(assignment_id,path,mime,data) VALUES(?,?,?,?)', id, image.path, image.mime, image.data);
        return id;
      });
      send(res, 201, {
        assignment: await detail(await one('SELECT * FROM assignments WHERE id=?', id), u)
      });
      return true;
    }
    if (path === '/api/assignments') {
      if (method === 'GET') {
        const rows = u.role === 'admin' ? await all('SELECT * FROM assignments ORDER BY id DESC') : await all('SELECT a.* FROM assignments a JOIN assignment_students s ON s.assignment_id=a.id WHERE a.status=\'published\' AND s.student_id=? ORDER BY a.due_at', u.id);
        send(res, 200, {
          assignments: await Promise.all(rows.map(async a => ({
            id: a.id,
            title: a.title,
            chapter_id: a.chapter_id,
            due_at: a.due_at,
            status: a.status,
            questionCount: JSON.parse(a.questions).length,
            totalPoints: JSON.parse(a.questions).reduce((n, q) => n + q.points, 0),
            ...(u.role === 'admin' ? {
              studentIds: (await all('SELECT student_id FROM assignment_students WHERE assignment_id=?', a.id)).map(s => s.student_id)
            } : {})
          })))
        });
        return true;
      }
      if (method === 'POST') {
        admin(u);
        const id = Number((await run('INSERT INTO assignments(title,questions) VALUES(?,?)', 'New assignment', JSON.stringify([{
          source: 'Write your question here.',
          type: 'reasoning',
          points: 1,
          options: ['', '', '', ''],
          correctIndex: null
        }]))).lastInsertRowid);
        send(res, 201, {
          assignment: await detail(await one('SELECT * FROM assignments WHERE id=?', id), u)
        });
        return true;
      }
    }
    const asset = path.match(/^\/api\/assignment-assets\/(\d+)$/);
    if (asset && method === 'GET') {
      const row = await one('SELECT * FROM assignment_assets WHERE id=?', Number(asset[1]));
      requireThat(row && (await allowed(row.assignment_id, u)), 'Image not found.', 404);
      res.writeHead(200, {
        'Content-Type': row.mime,
        'Cache-Control': 'private, no-store'
      });
      res.end(row.data);
      return true;
    }
    const match = path.match(/^\/api\/assignments\/(\d+)(\/publish|\/unpublish)?$/);
    if (!match) return false;
    const id = Number(match[1]),
      a = await one('SELECT * FROM assignments WHERE id=?', id);
    requireThat(a && (await allowed(id, u)), 'Assignment not found.', 404);
    if (method === 'GET' && !match[2]) {
      send(res, 200, {
        assignment: await detail(a, u)
      });
      return true;
    }
    admin(u);
    if (method === 'PUT' && !match[2]) {
      requireThat(a.status === 'draft', 'Return this assignment to draft before editing.', 409);
      requireThat(!(await one('SELECT 1 FROM responses WHERE assignment_id=?', id)), 'Students have submitted work. This paper is locked to protect their results. Create a new assignment for changes.', 409);
      const b = await validate(await readJson(req));
      await transaction(async () => {
        await run('UPDATE assignments SET title=?,chapter_id=?,due_at=?,questions=? WHERE id=?', b.title, b.chapterId, b.due, JSON.stringify(b.questions), id);
        await run('DELETE FROM assignment_students WHERE assignment_id=?', id);
        for (const s of b.ids) {
          await run('INSERT INTO assignment_students(assignment_id,student_id) VALUES(?,?)', id, s);
          if (b.chapterId) await run('INSERT OR IGNORE INTO enrollments(student_id,chapter_id) VALUES(?,?)', s, b.chapterId);
        }
      });
      send(res, 200, {
        assignment: await detail(await one('SELECT * FROM assignments WHERE id=?', id), u)
      });
      return true;
    }
    if (method === 'POST' && match[2] === '/publish') {
      const d = await detail(a, u);
      await validate(d, true);
      requireThat(d.questions.every(q => q.issues.length === 0), 'Resolve the question preview errors before publishing.');
      await run('UPDATE assignments SET status=\'published\' WHERE id=?', id);
      send(res, 200, {
        ok: true
      });
      return true;
    }
    if (method === 'POST' && match[2] === '/unpublish') {
      await run('UPDATE assignments SET status=\'draft\' WHERE id=?', id);
      send(res, 200, {
        ok: true
      });
      return true;
    }
    return false;
  };
}
