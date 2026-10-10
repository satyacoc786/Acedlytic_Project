(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* =====================================================
     API LAYER  (replace these with real backend calls)
     ===================================================== */
  const api = {
    // POST /api/auth/login
    async login({ role, id, password }) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username_or_id: id, password: password })
        });
        if (response.ok) {
          const data = await response.json();
          return {
            ok: true,
            role: data.user.role,
            user: data.user.name || data.user.username,
            userId: data.user.id,
            token: data.access_token,
            userObj: data.user
          };
        }
      } catch (err) {
        console.warn('Backend login attempt failed, utilizing local fallback:', err);
      }
      // Demo fallback if backend is offline
      await sleep(700);
      return { ok: true, role, user: id, userId: id, token: 'demo-token', userObj: { id, role, name: id } };
    },
    // POST /auth/frs
    async verifyFace({ imageDataUrl }) {
      await sleep(1200);
      return { ok: true, studentId: 'STU2026001' };
    },
  };

  /* =====================================================
     Validation helpers
     ===================================================== */
  const ID_RE = /^[A-Za-z0-9/-]{3,30}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, message) {
    const err = $('#' + input.getAttribute('aria-describedby'));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (err) err.textContent = message || '';
  }

  function showAlert(form, type, message) {
    const box = $('.alert', form);
    box.hidden = !message;
    box.className = 'alert' + (type ? ' alert--' + type : '');
    box.textContent = message || '';
  }

  function setLoading(btn, on) {
    btn.disabled = on;
    btn.classList.toggle('is-loading', on);
  }

  /* =====================================================
     Show / hide password
     ===================================================== */
  $$('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggle);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  /* =====================================================
     Generic form handler (student + teacher)
     ===================================================== */
  function bindLoginForm({ form, role, idInput, validateId }) {
    const idEl = $(idInput, form);
    const passEl = $('input[type="password"], input[name="password"]', form);
    const submitBtn = $('button[type="submit"]', form);

    [idEl, passEl].forEach((el) => el.addEventListener('input', () => setError(el, '')));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAlert(form, null, '');

      const idMsg = validateId(idEl.value.trim());
      const passMsg = passEl.value.length < 6 ? 'Password must be at least 6 characters.' : '';
      setError(idEl, idMsg);
      setError(passEl, passMsg);
      if (idMsg || passMsg) {
        (idMsg ? idEl : passEl).focus();
        return;
      }

      setLoading(submitBtn, true);
      try {
        const res = await api.login({
          role,
          id: idEl.value.trim(),
          password: passEl.value,
          remember: form.elements.remember.checked,
        });
        if (!res.ok) throw new Error('Invalid credentials');

        // Store tokens & sessions
        const storage = (form.elements.remember && form.elements.remember.checked) ? localStorage : sessionStorage;
        storage.setItem('acadivance_token', res.token || '');
        storage.setItem('acadivance_user', JSON.stringify(res.userObj || { id: res.userId, role: res.role }));
        storage.setItem('sp_session', JSON.stringify({ id: res.userId || res.user, role: res.role }));

        showAlert(form, 'success', `Signed in successfully. Redirecting to dashboard…`);
        await sleep(700);

        const isStaff = ['admin', 'faculty', 'placement_officer', 'teacher'].includes(res.role.toLowerCase());
        window.location.href = isStaff ? 'staff-dashboard.html' : 'student-dashboard.html';
      } catch (err) {
        showAlert(form, 'error', 'Login failed. Check your details and try again.');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  bindLoginForm({
    form: $('#student-form'),
    role: 'student',
    idInput: '#student-id',
    validateId: (v) => (!v ? 'Enter your Student ID.' : !ID_RE.test(v) ? 'Student ID must be 4–20 letters or numbers.' : ''),
  });

  bindLoginForm({
    form: $('#teacher-form'),
    role: 'teacher',
    idInput: '#teacher-id',
    validateId: (v) => (!v ? 'Enter your Teacher ID or email.' : !(ID_RE.test(v) || EMAIL_RE.test(v)) ? 'Enter a valid Teacher ID or email address.' : ''),
  });

  /* =====================================================
     Student login method tabs (ID / FRS)
     ===================================================== */
  const tabs = $$('.tab');
  const panes = { 'tab-id': $('#pane-id'), 'tab-frs': $('#pane-frs') };

  function selectTab(tab, focus = false) {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      panes[t.id].hidden = !active;
    });
    if (focus) tab.focus();
    if (tab.id !== 'tab-frs') frs.stop(true);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next, true);
      }
    });
  });

  /* =====================================================
     FRS (Face Recognition System)
     ===================================================== */
  const frs = (() => {
    const frame = $('#frs-frame');
    const video = $('#frs-video');
    const canvas = $('#frs-canvas');
    const statusEl = $('#frs-status');
    const mainBtn = $('#frs-main');
    const stopBtn = $('#frs-stop');
    let stream = null;
    let busy = false;

    const setStatus = (msg, kind) => {
      statusEl.textContent = msg;
      statusEl.className = 'frs__status' + (kind ? ' is-' + kind : '');
    };
    const setFrame = (...states) => {
      ['is-live', 'is-scanning', 'is-success', 'is-error'].forEach((c) => frame.classList.remove(c));
      states.forEach((c) => frame.classList.add(c));
    };
    const setMain = (label) => ($('.btn__label', mainBtn).textContent = label);

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFrame('is-error');
        return setStatus('Camera is not supported in this browser. Please use Student ID login.', 'error');
      }
      try {
        setStatus('Starting camera…');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false });
        video.srcObject = stream;
        await video.play();
        setFrame('is-live');
        setStatus('Position your face inside the oval, then press “Scan my face”.');
        setMain('Scan my face');
        stopBtn.hidden = false;
      } catch (err) {
        setFrame('is-error');
        const msg = err && err.name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow camera permission or use Student ID login.'
          : err && err.name === 'NotFoundError'
          ? 'No camera found on this device. Please use Student ID login.'
          : 'Could not start the camera. Please use Student ID login.';
        setStatus(msg, 'error');
      }
    }

    function stop(reset = false) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
      busy = false;
      stopBtn.hidden = true;
      mainBtn.disabled = false;
      setMain('Start camera');
      if (reset) {
        setFrame();
        setStatus('Turn on your camera, then position your face inside the oval.');
      }
    }

    async function scan() {
      if (busy || !stream) return;
      busy = true;
      mainBtn.disabled = true;
      setFrame('is-live', 'is-scanning');
      setStatus('Hold still… scanning your face.');
      await sleep(2200);

      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 600;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      try {
        const res = await api.verifyFace({ imageDataUrl });
        if (!res.ok) throw new Error('No match');
        setFrame('is-live', 'is-success');
        setStatus('Face verified. Signing you in…', 'success');

        // Store session for dashboard.html
        sessionStorage.setItem('sp_session', JSON.stringify({ id: res.studentId, role: 'student' }));

        await sleep(1400);
        window.location.href = 'student-dashboard.html';
        stop();
      } catch (err) {
        setFrame('is-live', 'is-error');
        setStatus('We could not recognise your face. Try again in good lighting, or use Student ID login.', 'error');
        mainBtn.disabled = false;
        busy = false;
      }
    }

    mainBtn.addEventListener('click', () => (stream ? scan() : start()));
    stopBtn.addEventListener('click', () => stop(true));
    $('#frs-fallback').addEventListener('click', () => selectTab($('#tab-id'), true));
    window.addEventListener('pagehide', () => stop());

    return { start, stop };
  })();
})();