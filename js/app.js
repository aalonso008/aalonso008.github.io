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
  showToast(typeof I18n !== 'undefined' ? I18n.t('rest.done') : 'Descanso listo');
}

function setAppLocked(locked) {
  document.querySelectorAll('header, nav, [id^="page-"], #resumeBanner, #restBar, #trialStrip').forEach((el) => {
    if (locked) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  });
}

function showAuthLoading() {
  document.documentElement.classList.add('auth-pending');
  const gate = document.getElementById('loginGate');
  if (gate) {
    gate.classList.add('show');
    gate.setAttribute('aria-busy', 'true');
  }
  setAppLocked(true);
  const label = document.getElementById('authLoadingText');
  if (label && typeof I18n !== 'undefined') label.textContent = I18n.t('login.entering');
}

async function showLoginGate() {
  document.documentElement.classList.remove('auth-pending');
  if (typeof closeTrainer === 'function') closeTrainer();
  if (typeof closeAdmin === 'function') closeAdmin();
  const gate = document.getElementById('loginGate');
  if (gate) {
    gate.classList.add('show');
    gate.removeAttribute('aria-busy');
  }
  setAppLocked(true);
  if (typeof hideWelcome === 'function') hideWelcome();
  currentRoutine = null;
  const days = document.getElementById('routineDays');
  const tabs = document.getElementById('dayTabs');
  if (days) days.innerHTML = '';
  if (tabs) tabs.innerHTML = '';
  const picker = document.getElementById('routinePicker');
  if (picker) {
    picker.hidden = true;
    picker.innerHTML = '';
  }
  const title = document.getElementById('headerTitle');
  if (title) title.textContent = 'Tu Rutina';
  const sub = document.getElementById('headerSub');
  if (sub) sub.textContent = typeof I18n !== 'undefined' ? I18n.t('login.sub') : 'Entra para ver tu rutina';
  if (typeof Subscription !== 'undefined') Subscription.refreshUi();
}

function hideLoginGate() {
  document.documentElement.classList.remove('auth-pending');
  const gate = document.getElementById('loginGate');
  if (gate) {
    gate.classList.remove('show');
    gate.removeAttribute('aria-busy');
  }
  setAppLocked(false);
  if (typeof Subscription !== 'undefined') Subscription.refreshUi();
}

let appBooted = false;

async function bootApp() {
  if (!syncUser) {
    showLoginGate();
    return;
  }
  const choice = document.getElementById('syncChoice');
  if (choice && choice.classList.contains('show')) {
    hideLoginGate();
    return;
  }
  showAuthLoading();
  const role = typeof loadOwnRole === 'function' ? await loadOwnRole() : null;
  if (role === 'admin') {
    if (typeof hideWelcome === 'function') hideWelcome();
    const panel = document.getElementById('adminPanel');
    if (!panel || !panel.classList.contains('show')) await openAdmin();
    else {
      hideLoginGate();
      setAppLocked(true);
    }
    return;
  }
  try {
    if (typeof repairExerciseLibrary === 'function') await repairExerciseLibrary();
    if (!appBooted) {
      appBooted = true;
      const theory = await loadHtml('content/progression.html');
      const progPage = document.getElementById('page-prog');
      progPage.innerHTML = '<div id="progressCharts"></div><div class="prog-theory">' + theory + '</div>';
      if (typeof I18n !== 'undefined') I18n.apply(progPage);
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
      showWelcome(syncUser ? 'account' : 'new');
      document.getElementById('routineDays').innerHTML = '<p class="empty-day">' + (typeof I18n !== 'undefined' ? I18n.t(syncUser ? 'welcome.account' : 'empty.routine') : 'Crea tu rutina para empezar.') + '</p>';
      await renderLogPage();
    }
  } finally {
    if (syncUser) hideLoginGate();
  }
}

async function initApp() {
  await Storage.migrate();
  currentSettings = await Storage.getSettings();
  if (document.documentElement.classList.contains('auth-pending')) showAuthLoading();
  else await showLoginGate();
  document.getElementById('settingsBtn').addEventListener('click', () => {
    if (!syncUser && !currentRoutine) return showLoginGate();
    openSettings();
  });
  document.getElementById('accountBtn').addEventListener('click', () => {
    openAccount();
  });
  document.getElementById('settingsForm').addEventListener('submit', saveSettingsForm);
  document.getElementById('resumeGo').addEventListener('click', resumeWorkout);
  document.getElementById('resumeSkip').addEventListener('click', () => {
    sessionStorage.removeItem('tu_rutina_workout');
    document.getElementById('resumeBanner').hidden = true;
  });
  await initSync();
  document.addEventListener('lang:change', () => {
    const gate = document.getElementById('loginGate');
    if (gate && gate.classList.contains('show')) {
      const sub = document.getElementById('headerSub');
      if (sub) sub.textContent = I18n.t('login.sub');
    }
    if (typeof Subscription !== 'undefined') Subscription.refreshUi();
    const adminEl = document.getElementById('adminPanel');
    if (adminEl && adminEl.classList.contains('show') && typeof renderAdmin === 'function') renderAdmin();
    const wizardEl = document.getElementById('routineWizard');
    if (wizardEl && !wizardEl.hidden && typeof renderWizard === 'function') renderWizard();
    if (!appBooted) return;
    if (typeof renderLogPage === 'function') renderLogPage();
    if (typeof renderBodyPage === 'function' && document.getElementById('page-cuerpo') && document.getElementById('page-cuerpo').classList.contains('active')) {
      renderBodyPage();
    }
    if (typeof renderProgressCharts === 'function' && document.getElementById('progressCharts')) renderProgressCharts();
    if (typeof currentRoutine !== 'undefined' && currentRoutine && typeof renderRoutineView === 'function') renderRoutineView(currentRoutine);
    if (typeof I18n !== 'undefined') I18n.apply(document.getElementById('page-prog'));
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && settingsModal.classList.contains('show') && typeof openSettings === 'function') openSettings();
    const accountModal = document.getElementById('accountModal');
    if (accountModal && accountModal.classList.contains('show') && typeof openAccount === 'function') openAccount();
    const trainerEl = document.getElementById('trainerPanel');
    if (trainerEl && trainerEl.classList.contains('show') && typeof renderTrainer === 'function') renderTrainer();
    const editor = document.getElementById('page-editor');
    if (editor && editor.classList.contains('active') && typeof renderEditor === 'function') renderEditor();
  });
}

initApp().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<p style="padding:16px;color:#eb5757">' + (typeof I18n !== 'undefined' ? I18n.t('boot.error') : 'Error cargando la app. Usa <code>npm start</code> para servirla.') + '</p>'
  );
});
