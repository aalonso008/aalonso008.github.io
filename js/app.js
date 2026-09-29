let toastTimer = null;
let restTimer = null;

function showDay(i) {
  document.querySelectorAll('.day-panel').forEach((panel, j) => panel.classList.toggle('active', j === i));
  document.querySelectorAll('#dayTabs .tab').forEach((button, j) => button.classList.toggle('active', j === i));
}

function toggleEx(btn) {
  btn.closest('.ex-card').classList.toggle('open');
}

function toggleProg(btn) {
  btn.closest('.prog-section').classList.toggle('open');
}

function showPage(name, btn) {
  if (!syncUser) {
    showLoginGate();
    return;
  }
  document.querySelectorAll('[id^="page-"]').forEach((page) => page.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('nav button').forEach((button) => button.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const tabs = document.querySelector('.day-tabs');
  if (tabs) tabs.style.display = name === 'rutina' ? 'flex' : 'none';
  if (name === 'editor') openEditorPage();
  if (name === 'prog') renderProgressCharts().catch((error) => console.error(error));
  if (name === 'log') renderLogPage().catch((error) => console.error(error));
  if (name === 'cuerpo') renderBodyPage().catch((error) => console.error(error));
}

async function loadHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo cargar ' + url);
  return res.text();
}

function showToast(message, opts) {
  const options = opts || {};
  const el = document.getElementById('toast');
  if (!el) return;
  el.hidden = false;
  el.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (options.label && options.onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = options.label;
    button.onclick = () => {
      hideToast();
      options.onClick();
    };
    el.appendChild(button);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, options.ms || 2800);
}

function hideToast() {
  const el = document.getElementById('toast');
  if (el) el.hidden = true;
}

function startRest(seconds, vibrate) {
  const ends = Date.now() + Math.max(1, seconds) * 1000;
  sessionStorage.setItem('restEndsAt', String(ends));
  sessionStorage.setItem('restVibrate', vibrate === false ? '0' : '1');
  tickRest();
}

function adjustRest(delta) {
  const ends = Number(sessionStorage.getItem('restEndsAt') || 0);
  if (!ends) return;
  sessionStorage.setItem('restEndsAt', String(ends + delta * 1000));
  tickRest();
}

function skipRest() {
  sessionStorage.removeItem('restEndsAt');
  const bar = document.getElementById('restBar');
  if (bar) bar.hidden = true;
  clearTimeout(restTimer);
}

function tickRest() {
  const ends = Number(sessionStorage.getItem('restEndsAt') || 0);
  const bar = document.getElementById('restBar');
  const label = document.getElementById('restTime');
  const left = Math.ceil((ends - Date.now()) / 1000);
  if (!ends || left <= 0) {
    if (bar) bar.hidden = true;
    if (ends && left <= 0) finishRest();
    return;
  }
  if (bar) bar.hidden = false;
  if (label) label.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  clearTimeout(restTimer);
  restTimer = setTimeout(tickRest, 250);
}

function finishRest() {
  sessionStorage.removeItem('restEndsAt');
  if (sessionStorage.getItem('restVibrate') !== '0' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  showToast('Descanso listo');
}

function setAppLocked(locked) {
  document.querySelectorAll('header, nav, [id^="page-"], #resumeBanner, #restBar').forEach((el) => {
    if (locked) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  });
}

function showLoginGate() {
  const gate = document.getElementById('loginGate');
  if (gate) gate.classList.add('show');
  setAppLocked(true);
  if (typeof hideWelcome === 'function') hideWelcome();
  currentRoutine = null;
  const days = document.getElementById('routineDays');
  const tabs = document.getElementById('dayTabs');
  if (days) days.innerHTML = '';
  if (tabs) tabs.innerHTML = '';
  const title = document.getElementById('headerTitle');
  if (title) title.textContent = 'Tu Rutina';
  const sub = document.getElementById('headerSub');
  if (sub) sub.textContent = 'Entrá para ver tu rutina';
}

function hideLoginGate() {
  const gate = document.getElementById('loginGate');
  if (gate) gate.classList.remove('show');
  setAppLocked(false);
}

let appBooted = false;

async function bootApp() {
  if (!syncUser) {
    showLoginGate();
    return;
  }
  const choice = document.getElementById('syncChoice');
  if (choice && choice.classList.contains('show')) return;
  hideLoginGate();
  if (!appBooted) {
    appBooted = true;
    const theory = await loadHtml('content/progression.html');
    document.getElementById('page-prog').innerHTML = '<div id="progressCharts"></div><div class="prog-theory">' + theory + '</div>';
    tickRest();
    offerResumeWorkout();
  }
  const routine = await Storage.getRoutine();
  if (routine) {
    currentRoutine = routine;
    await renderRoutineView(routine);
    await renderLogPage();
    if (document.getElementById('progressCharts')) await renderProgressCharts();
  } else {
    showWelcome();
    document.getElementById('routineDays').innerHTML = '<p class="empty-day">Creá tu rutina para empezar.</p>';
    await renderLogPage();
  }
}

async function initApp() {
  showLoginGate();
  await Storage.migrate();
  currentSettings = await Storage.getSettings();
  document.getElementById('settingsBtn').addEventListener('click', () => {
    if (!syncUser) return showLoginGate();
    openSettings();
  });
  document.getElementById('accountBtn').addEventListener('click', () => {
    if (!syncUser) return showLoginGate();
    openAccount();
  });
  document.getElementById('settingsForm').addEventListener('submit', saveSettingsForm);
  document.getElementById('resumeGo').addEventListener('click', resumeWorkout);
  document.getElementById('resumeSkip').addEventListener('click', () => {
    sessionStorage.removeItem('tu_rutina_workout');
    document.getElementById('resumeBanner').hidden = true;
  });
  await initSync();
}

initApp().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<p style="padding:16px;color:#eb5757">Error cargando la app. Usá <code>npm start</code> para servirla.</p>'
  );
});
