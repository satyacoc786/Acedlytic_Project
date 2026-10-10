(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  /* =====================================================
     1. LOGIN GUARD: no session means back to the login page
     ===================================================== */
  const SESSION_KEY = 'sp_session';
  const getSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  };
  const session = getSession();
  if (!session) { window.location.replace('index.html'); return; }

  $('#who-name').textContent = session.id;
  $('#avatar').textContent = String(session.id).charAt(0).toUpperCase();
  if (session.role === 'teacher') $('#role-note').hidden = false;

  $('#logout').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('index.html');
  });

  /* =====================================================
     2. DATA INTEGRATION: one function per source system
        (mock data now; swap each for a real call, e.g. fetch('/api/lms/' + id))
     ===================================================== */
  const sources = {
    academic: async () => ({ cgpa: 8.1, semester: 5, backlogs: 0, subjects: [
      { name: 'Data Structures', marks: 82 }, { name: 'DBMS', marks: 74 },
      { name: 'Operating Systems', marks: 69 }, { name: 'Maths III', marks: 79 } ] }),
    attendance: async () => ({ percent: 75, present: 150, total: 200 }),
    lms: async () => ({ courses: 6, completion: 68, assignmentsSubmitted: 21, assignmentsTotal: 25, quizAvg: 72, lastLogin: '2 days ago' }),
    engagement: async () => ({ score: 70, clubs: 2, events: 5, forumPosts: 14, mentorMeetings: 3 }),
    placement: async () => ({ readiness: 62, mockInterviews: 3, resumeScore: 74, applications: 4, shortlisted: 1 }),
    skills: async () => ({ certifications: 2, list: [
      { name: 'Python', level: 80 }, { name: 'SQL', level: 65 }, { name: 'Communication', level: 70 }, { name: 'React', level: 45 } ] }),
    feedback: async () => ({ rating: 4.1, comments: [
      { by: 'Prof. Rao', text: 'Participates well in class discussions.' },
      { by: 'Mentor', text: 'Needs to be more consistent with attendance.' } ] }),
  };

  // Merge every source into ONE unified student view
  async function loadStudentView(id) {
    const keys = Object.keys(sources);
    const results = await Promise.all(keys.map((k) => sources[k](id)));
    return keys.reduce((view, k, i) => ({ ...view, [k]: results[i] }), { id });
  }

  /* =====================================================
     3. STUDENT SUCCESS SCORE (weighted, total = 100)
     ===================================================== */
  const WEIGHTS = { academics: 30, attendance: 20, lms: 15, engagement: 15, skills: 10, placement: 10 };
  const LABELS = { academics: 'Academics', attendance: 'Attendance', lms: 'LMS activity', engagement: 'Engagement', skills: 'Skills', placement: 'Placement readiness' };

  function indicators(v) {
    return {
      academics: clamp(v.academic.cgpa * 10),
      attendance: clamp(v.attendance.percent),
      lms: clamp((v.lms.completion + (v.lms.assignmentsSubmitted / v.lms.assignmentsTotal) * 100) / 2),
      engagement: clamp(v.engagement.score),
      skills: clamp(avg(v.skills.list.map((s) => s.level))),
      placement: clamp(v.placement.readiness),
    };
  }
  const successScore = (ind) => Math.round(Object.keys(WEIGHTS).reduce((sum, k) => sum + ind[k] * WEIGHTS[k], 0) / 100);

  function renderScore(view) {
    const ind = indicators(view);
    const s = successScore(ind);
    const band = s >= 75 ? ['On track', 'good'] : s >= 50 ? ['Needs attention', 'warn'] : ['At risk', 'bad'];
    $('#score-num').textContent = s;
    $('#score-bar').style.width = s + '%';
    const badge = $('#score-badge');
    badge.textContent = band[0];
    badge.className = 'badge ' + band[1];
    $('#score-how').innerHTML = Object.keys(WEIGHTS)
      .map((k) => `<li><span>${LABELS[k]} (${WEIGHTS[k]}%)</span><b>${Math.round(ind[k])}/100</b></li>`).join('');
  }

  /* =====================================================
     4. ATTENDANCE CIRCLE
        below 50  -> red number,    "SHAME ON YOU"
        50 to 74  -> yellow number, "TRY MORE"
        75 and up -> green number,  "GOOD JOB"
     ===================================================== */
  function captionFor(p) {
    if (p < 50) return { text: 'SHAME ON YOU', cls: 'bad' };
    if (p < 75) return { text: 'TRY MORE', cls: 'warn' };
    return { text: 'GOOD JOB', cls: 'good' };
  }

  const CIRC = 2 * Math.PI * 100; // circle length (r = 100)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let countFrame = null;

  function renderAttendance(p, animate = true) {
    const { text, cls } = captionFor(p);
    const ring = $('#ring');
    ring.className = 'ring ' + cls;
    ring.setAttribute('aria-label', `Attendance ${p} percent. ${text}`);
    $('#ring-bar').style.strokeDashoffset = CIRC * (1 - p / 100);
    $('#att-caption').textContent = text;

    // number counts up from 0 to the real value
    cancelAnimationFrame(countFrame);
    const el = $('#att-percent');
    if (!animate || reduceMotion) { el.textContent = p + '%'; return; }
    const start = performance.now(), dur = 1200;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(p * (1 - Math.pow(1 - t, 3))) + '%';
      if (t < 1) countFrame = requestAnimationFrame(tick);
    };
    countFrame = requestAnimationFrame(tick);
  }

  /* =====================================================
     5. BOXES (rendered in sequence, same order as the sketch)
     ===================================================== */
  const ICONS = {
    academics: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
    lms: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    engagement: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c3 0 5 1.5 5 4"/>',
    placement: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    skills: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    feedback: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>',
  };

  const kv = (pairs) => `<dl class="kv">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  const bar = (name, pct) => `<div><b><span>${esc(name)}</span><span>${Math.round(pct)}%</span></b><div class="mini"><span style="width:${clamp(pct)}%"></span></div></div>`;

  const TILES = [
    { id: 'academics', title: 'Academics',
      metric: (v) => `${v.academic.cgpa} CGPA`, sub: (v) => `Semester ${v.academic.semester} · ${v.academic.backlogs} backlogs`, pct: (v) => v.academic.cgpa * 10,
      detail: (v) => kv([['CGPA', v.academic.cgpa], ['Semester', v.academic.semester], ['Backlogs', v.academic.backlogs]]) +
        `<div class="bars">${v.academic.subjects.map((s) => bar(s.name, s.marks)).join('')}</div>` },
    { id: 'lms', title: 'LMS',
      metric: (v) => `${v.lms.completion}%`, sub: () => 'Course completion', pct: (v) => v.lms.completion,
      detail: (v) => kv([['Courses enrolled', v.lms.courses], ['Course completion', v.lms.completion + '%'],
        ['Assignments', `${v.lms.assignmentsSubmitted}/${v.lms.assignmentsTotal}`], ['Quiz average', v.lms.quizAvg + '%'], ['Last login', v.lms.lastLogin]]) },
    { id: 'engagement', title: 'Engagement',
      metric: (v) => `${v.engagement.score}/100`, sub: (v) => `${v.engagement.events} events · ${v.engagement.clubs} clubs`, pct: (v) => v.engagement.score,
      detail: (v) => kv([['Engagement score', v.engagement.score + '/100'], ['Clubs joined', v.engagement.clubs], ['Events attended', v.engagement.events],
        ['Forum posts', v.engagement.forumPosts], ['Mentor meetings', v.engagement.mentorMeetings]]) },
    { id: 'placement', title: 'Placement',
      metric: (v) => `${v.placement.readiness}%`, sub: () => 'Placement readiness', pct: (v) => v.placement.readiness,
      detail: (v) => kv([['Readiness', v.placement.readiness + '%'], ['Resume score', v.placement.resumeScore + '/100'], ['Mock interviews', v.placement.mockInterviews],
        ['Applications', v.placement.applications], ['Shortlisted', v.placement.shortlisted]]) },
    { id: 'skills', title: 'Skills',
      metric: (v) => `${Math.round(avg(v.skills.list.map((s) => s.level)))}%`, sub: (v) => `${v.skills.certifications} certifications`, pct: (v) => avg(v.skills.list.map((s) => s.level)),
      detail: (v) => `<div class="bars">${v.skills.list.map((s) => bar(s.name, s.level)).join('')}</div>` + kv([['Certifications', v.skills.certifications]]) },
    { id: 'feedback', title: 'Feedback',
      metric: (v) => `${v.feedback.rating}/5`, sub: () => 'Average rating', pct: (v) => (v.feedback.rating / 5) * 100,
      detail: (v) => kv([['Average rating', v.feedback.rating + '/5']]) +
        v.feedback.comments.map((c) => `<p class="quote">${esc(c.text)}<small>${esc(c.by)}</small></p>`).join('') },
  ];

  function renderTiles(view) {
    $('#tiles').innerHTML = TILES.map((t, i) => `
      <button class="tile" style="--i:${i}" data-tile="${t.id}" aria-haspopup="dialog">
        <span class="tile__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[t.id]}</svg></span>
        <span><span class="tile__title">${t.title}</span><span class="tile__sub">${esc(t.sub(view))}</span></span>
        <span class="tile__metric">${esc(t.metric(view))}</span>
        <span class="mini"><span style="width:${clamp(t.pct(view))}%"></span></span>
      </button>`).join('');
  }

  $('#tiles').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tile]');
    if (!btn) return;
    const t = TILES.find((x) => x.id === btn.dataset.tile);
    $('#detail-title').textContent = t.title;
    $('#detail-body').innerHTML = t.detail(view);
    $('#detail').showModal();
  });

  /* =====================================================
     6. START (runs right after login)
     ===================================================== */
  let view = null;

  (async function init() {
    view = await loadStudentView(session.id);
    renderScore(view);
    renderTiles(view);
    await sleep(300);                        // short pause, then the attendance reveals
    renderAttendance(view.attendance.percent);

    // Demo slider: try 30, 60 and 90 to see red / yellow / green
    const slider = $('#demo-att');
    slider.value = view.attendance.percent;
    $('#demo-att-val').textContent = slider.value;
    slider.addEventListener('input', () => {
      view.attendance.percent = Number(slider.value);
      $('#demo-att-val').textContent = slider.value;
      renderAttendance(view.attendance.percent, false);
      renderScore(view);
    });
  })();
})();