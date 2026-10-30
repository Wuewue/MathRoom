export function lessonRoutes({
  db,
  readJson,
  send,
  requireThat,
  admin,
  transaction
}) {
  const take = (sql, ...p) => db.prepare(sql).get(...p),
    all = (sql, ...p) => db.prepare(sql).all(...p),
    run = (sql, ...p) => db.prepare(sql).run(...p);
  function text(value, label, max = 160, optional = false) {
    requireThat(typeof value === 'string', label + ' must be text.');
    const s = value.trim();
    requireThat((optional || s.length > 0) && s.length <= max, label + ' is missing or too long.');
    return s;
  }
  async function lessonData(body, id = 0) {
    const studentId = Number(body.studentId),
      chapterId = Number(body.chapterId);
    requireThat(Number.isSafeInteger(studentId) && Number.isSafeInteger(chapterId), 'Choose a student and chapter.');
    requireThat(await take('SELECT 1 FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.student_id=? AND e.chapter_id=? AND u.role=\'student\' AND u.active=1', studentId, chapterId), 'Choose an active student enrolled in this chapter.');
    const title = text(body.title, 'Lesson title');
    requireThat(typeof body.startsAt === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(body.startsAt) && Number.isFinite(Date.parse(body.startsAt)), 'Choose a valid lesson date and time.');
    const startsAt = new Date(body.startsAt).toISOString(),
      duration = Number(body.duration);
    requireThat(Number.isInteger(duration) && duration >= 15 && duration <= 240, 'Duration must be 15–240 minutes.');
    const status = body.status || 'scheduled',
      performance = body.performance || 'Not reviewed';
    requireThat(['scheduled', 'completed', 'cancelled'].includes(status), 'Choose a valid lesson status.');
    requireThat(['Not reviewed', 'Needs practice', 'Good progress', 'Confident'].includes(performance), 'Choose a valid performance.');
    const summary = text(body.summary ?? '', 'Lesson summary', 5000, true),
      comment = text(body.comment ?? '', 'Student comment', 5000, true);
    const start = Date.parse(startsAt),
      end = start + duration * 60000;
    if (status !== 'cancelled') {
      const overlaps = (await all('SELECT starts_at,duration FROM lessons WHERE id<>? AND status<>\'cancelled\'', id)).some(l => Date.parse(l.starts_at) < end && Date.parse(l.starts_at) + l.duration * 60000 > start);
      requireThat(!overlaps, 'This time overlaps another individual lesson.', 409);
    }
    return [studentId, chapterId, title, startsAt, duration, status, summary, performance, comment];
  }
  const lessonSelect = 'SELECT l.*,u.name AS student_name,c.number AS chapter_number,c.title AS chapter_title FROM lessons l JOIN users u ON u.id=l.student_id JOIN chapters c ON c.id=l.chapter_id ';
  async function chapterData(body) {
    const number = Number(body.number),
      title = text(body.title, 'Chapter title'),
      description = text(body.description ?? '', 'Chapter description', 2000, true);
    requireThat(Number.isSafeInteger(number) && number > 0 && number < 10000, 'Chapter number must be between 1 and 9999.');
    requireThat(Array.isArray(body.studentIds), 'Choose students for this chapter.');
    const ids = [...new Set(body.studentIds.map(Number))];
    requireThat((await Promise.all(ids.map(async id => Number.isSafeInteger(id) && (await take('SELECT id FROM users WHERE id=? AND role=\'student\'', id))))).every(Boolean), 'One of the selected students does not exist.');
    return {
      number,
      title,
      description,
      ids
    };
  }
  return async function (req, res, u, pathname) {
    const method = req.method;
    if (pathname === '/api/chapters' && method === 'GET') {
      const chapters = u.role === 'admin' ? await all('SELECT * FROM chapters ORDER BY number') : await all('SELECT c.* FROM chapters c JOIN enrollments e ON e.chapter_id=c.id WHERE e.student_id=? ORDER BY c.number', u.id);
      for (const c of chapters) if (u.role === 'admin') c.studentIds = (await all('SELECT student_id FROM enrollments WHERE chapter_id=?', c.id)).map(r => r.student_id);
      return send(res, 200, {
        chapters
      });
    }
    if (pathname === '/api/chapters' && method === 'POST') {
      admin(u);
      const b = await chapterData(await readJson(req));
      requireThat(!(await take('SELECT id FROM chapters WHERE number=?', b.number)), 'That chapter number already exists.', 409);
      const id = await transaction(async () => {
        const id = Number((await run('INSERT INTO chapters(number,title,description) VALUES(?,?,?)', b.number, b.title, b.description)).lastInsertRowid);
        for (const s of b.ids) await run('INSERT INTO enrollments(student_id,chapter_id) VALUES(?,?)', s, id);
        return id;
      });
      return send(res, 201, {
        id
      });
    }
    const chapterMatch = pathname.match(/^\/api\/chapters\/(\d+)$/);
    if (chapterMatch && method === 'PUT') {
      admin(u);
      const id = Number(chapterMatch[1]);
      requireThat(await take('SELECT id FROM chapters WHERE id=?', id), 'Chapter not found.', 404);
      const b = await chapterData(await readJson(req));
      requireThat(!(await take('SELECT id FROM chapters WHERE number=? AND id<>?', b.number, id)), 'That chapter number already exists.', 409);
      const withLessons = await all('SELECT DISTINCT student_id FROM lessons WHERE chapter_id=?', id);
      requireThat(withLessons.every(l => b.ids.includes(l.student_id)), 'Keep students who already have lessons in this chapter.', 409);
      await transaction(async () => {
        await run('UPDATE chapters SET number=?,title=?,description=? WHERE id=?', b.number, b.title, b.description, id);
        await run('DELETE FROM enrollments WHERE chapter_id=?', id);
        for (const s of b.ids) await run('INSERT INTO enrollments(student_id,chapter_id) VALUES(?,?)', s, id);
      });
      return send(res, 200, {
        ok: true
      });
    }
    if (pathname === '/api/lessons' && method === 'GET') {
      return send(res, 200, {
        lessons: u.role === 'admin' ? await all(lessonSelect + 'ORDER BY l.starts_at') : await all(lessonSelect + 'WHERE l.student_id=? ORDER BY l.starts_at', u.id)
      });
    }
    if (pathname === '/api/lessons' && method === 'POST') {
      admin(u);
      const values = await lessonData(await readJson(req));
      const id = Number((await run('INSERT INTO lessons(student_id,chapter_id,title,starts_at,duration,status,summary,performance,comment) VALUES(?,?,?,?,?,?,?,?,?)', ...values)).lastInsertRowid);
      return send(res, 201, {
        lesson: await take(lessonSelect + 'WHERE l.id=?', id)
      });
    }
    const lessonMatch = pathname.match(/^\/api\/lessons\/(\d+)$/);
    if (lessonMatch) {
      const id = Number(lessonMatch[1]),
        lesson = await take(lessonSelect + 'WHERE l.id=?' + (u.role === 'student' ? ' AND l.student_id=?' : ''), ...(u.role === 'student' ? [id, u.id] : [id]));
      requireThat(lesson, 'Lesson not found.', 404);
      if (method === 'GET') return send(res, 200, {
        lesson
      });
      if (method === 'PUT') {
        admin(u);
        const values = await lessonData(await readJson(req), id);
        await run('UPDATE lessons SET student_id=?,chapter_id=?,title=?,starts_at=?,duration=?,status=?,summary=?,performance=?,comment=? WHERE id=?', ...values, id);
        return send(res, 200, {
          lesson: await take(lessonSelect + 'WHERE l.id=?', id)
        });
      }
    }
    return false;
  };
}
