let supabaseClient = null;
let syncTimer = null;
let syncUser = null;

function syncConfigured() {
  return typeof APP_CONFIG === 'object' && APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY;
}

function redirectUrl() {
  return window.location.origin + window.location.pathname;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Supabase'));
    document.head.appendChild(script);
  });
}

async function ensureClient() {
  if (!syncConfigured()) return null;
  if (supabaseClient) return supabaseClient;
  await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
  supabaseClient = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  return supabaseClient;
}

async function initSync() {
  document.addEventListener('sync:queued', scheduleSync);
  window.addEventListener('online', () => {
    updateSyncDot();
    scheduleSync();
  });
  window.addEventListener('offline', updateSyncDot);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync();
  });
  updateSyncDot();
  if (!syncConfigured()) return;
  try {
    const client = await ensureClient();
    client.auth.onAuthStateChange((event, session) => {
      if (session) onSignedIn(session).catch((error) => console.error(error));
      else if (event !== 'INITIAL_SESSION') {
        syncUser = null;
        showLoginGate();
        updateSyncDot();
      }
    });
  } catch (error) {
    console.error(error);
  }
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushAndPull().catch((error) => console.error(error));
  }, 2000);
}

async function updateSyncDot() {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  const queue = await Storage.getSyncQueue();
  dot.classList.remove('synced', 'pending', 'offline');
  if (!navigator.onLine) {
    dot.classList.add('offline');
    dot.textContent = '⚠';
    dot.title = 'Sin conexión';
    return;
  }
  if (!syncUser) {
    dot.textContent = '☁';
    dot.title = 'Solo en este dispositivo';
    return;
  }
  if (queue.length) {
    dot.classList.add('pending');
    dot.textContent = '⏳';
    dot.title = 'Cambios pendientes';
    return;
  }
  dot.classList.add('synced');
  dot.textContent = '☁';
  dot.title = 'Sincronizado';
}

async function onSignedIn(session) {
  syncUser = session.user;
  await handleSession(session);
  if (typeof bootApp === 'function') await bootApp();
}

async function handleSession(session) {
  syncUser = session.user;
  updateSyncDot();
  const choice = await Storage.getSyncChoice();
  if (choice === syncUser.id) {
    await pushAndPull();
    return;
  }
  const remoteSets = await supabaseClient.from('workout_sets').select('id', { count: 'exact', head: true });
  const remoteExercises = await supabaseClient.from('exercises').select('id', { count: 'exact', head: true });
  const remoteCount = (remoteSets.count || 0) + (remoteExercises.count || 0);
  const local = await Storage.exportAll();
  const localHas = (local.sets && local.sets.length) || (local.exercises && local.exercises.length) || local.routine;
  if (localHas && !remoteCount) {
    openChoice('Tenés datos en este dispositivo. ¿Subirlos a tu cuenta?', 'Subir', 'upload', 'Ahora no', 'skip');
    return;
  }
  if (localHas && remoteCount) {
    openChoice('La cuenta ya tiene datos y este dispositivo también.', 'Combinar', 'merge', 'Usar los de la cuenta', 'remote');
    return;
  }
  await Storage.setSyncChoice(syncUser.id);
  await pushAndPull();
}

function openChoice(text, okLabel, okAction, cancelLabel, cancelAction) {
  const modal = document.getElementById('syncChoice');
  document.getElementById('syncChoiceText').textContent = text;
  const ok = document.getElementById('syncChoiceOk');
  const cancel = document.getElementById('syncChoiceCancel');
  ok.textContent = okLabel;
  cancel.textContent = cancelLabel;
  ok.onclick = () => finishChoice(okAction);
  cancel.onclick = () => finishChoice(cancelAction);
  modal.classList.add('show');
}

async function finishChoice(action) {
  document.getElementById('syncChoice').classList.remove('show');
  if (syncUser) await Storage.setSyncChoice(syncUser.id);
  if (action === 'upload' || action === 'merge') await uploadAll();
  if (action === 'remote') await pullAll(true);
  if (action === 'skip') updateSyncDot();
  await refreshVisible();
}

async function uploadAll() {
  const client = await ensureClient();
  if (!client || !syncUser) return;
  const data = await Storage.exportAll();
  const userId = syncUser.id;
  if (data.profile || data.settings) await client.from('profiles').upsert(profileRow(data.profile || { id: 'profile' }, data.settings, userId));
  if (data.exercises) {
    for (const exercise of data.exercises) await client.from('exercises').upsert(exerciseRow(exercise, userId));
  }
  if (data.routines) {
    for (const routine of data.routines) await client.from('routines').upsert(routineRow(routine, userId, data.routine && routine.id === data.routine.id));
  } else if (data.routine) {
    await client.from('routines').upsert(routineRow(data.routine, userId, true));
  }
  for (const set of data.sets || []) await client.from('workout_sets').upsert(setRow(set, userId));
  for (const metric of data.bodyMetrics || []) await client.from('body_metrics').upsert(metricRow(metric, userId));
  await Storage.clearSyncQueue();
  await Storage.saveSyncMeta({ lastPulledAt: new Date().toISOString() });
  updateSyncDot();
}

async function pushAndPull() {
  if (!syncUser || !navigator.onLine) {
    updateSyncDot();
    return;
  }
  const client = await ensureClient();
  const queue = await Storage.getSyncQueue();
  for (const item of queue) {
    if (item.op === 'delete') {
      await client.from(item.table).update({ deleted: true, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', syncUser.id);
    } else if (item.table === 'profiles') {
      const data = await Storage.exportAll();
      await client.from('profiles').upsert(profileRow(item.record, data.settings, syncUser.id));
    } else if (item.table === 'routines') {
      const active = await Storage.getRoutine();
      await client.from('routines').upsert(routineRow(item.record, syncUser.id, active && active.id === item.record.id));
    } else if (item.table === 'exercises') {
      await client.from('exercises').upsert(exerciseRow(item.record, syncUser.id));
    } else if (item.table === 'workout_sets') {
      await client.from('workout_sets').upsert(setRow(item.record, syncUser.id));
    } else if (item.table === 'body_metrics') {
      await client.from('body_metrics').upsert(metricRow(item.record, syncUser.id));
    }
  }
  await Storage.clearSyncQueue();
  await pullAll(false);
  updateSyncDot();
}

async function pullAll(replace) {
  const client = await ensureClient();
  const meta = await Storage.getSyncMeta();
  const since = replace ? '1970-01-01T00:00:00Z' : meta.lastPulledAt || '1970-01-01T00:00:00Z';
  const queued = new Set((await Storage.getSyncQueue()).map((item) => item.id));
  const [exercises, sets, metrics, routines, profile] = await Promise.all([
    client.from('exercises').select('*').gt('updated_at', since),
    client.from('workout_sets').select('*').gt('updated_at', since),
    client.from('body_metrics').select('*').gt('updated_at', since),
    client.from('routines').select('*').gt('updated_at', since),
    client.from('profiles').select('*').limit(1),
  ]);
  const local = await Storage.exportAll();
  const nextExercises = mergeRows(local.exercises, (exercises.data || []).map(exerciseFromRow), queued, replace);
  const nextSets = mergeRows(local.sets, (sets.data || []).map(setFromRow), queued, replace);
  const nextMetrics = mergeRows(local.bodyMetrics, (metrics.data || []).map(metricFromRow), queued, replace);
  const nextRoutines = mergeRows(
    local.routines || [],
    (routines.data || []).map((row) => Object.assign({}, row.data, { id: row.id, updatedAt: row.updated_at, deleted: !!row.deleted })),
    queued,
    replace
  );
  let nextProfile = local.profile;
  let nextSettings = local.settings;
  if (profile.data && profile.data[0]) {
    const remoteProfile = profileFromRow(profile.data[0]);
    if (replace || !nextProfile || String(remoteProfile.updatedAt || '') >= String(nextProfile.updatedAt || '')) {
      nextProfile = remoteProfile;
      nextSettings = profile.data[0].settings || nextSettings;
    }
  }
  const active = nextRoutines.find((routine) => routine && local.routine && routine.id === local.routine.id) || nextRoutines[0] || local.routine;
  await Storage.applyRemoteSnapshot({
    exercises: nextExercises,
    sets: nextSets,
    bodyMetrics: nextMetrics,
    routines: nextRoutines,
    routine: active,
    profile: nextProfile,
    settings: nextSettings,
  });
  await Storage.saveSyncMeta({ lastPulledAt: new Date().toISOString() });
  if (typeof currentRoutine !== 'undefined' && active) currentRoutine = active;
}

function mergeRows(local, remote, queued, replace) {
  const map = new Map((replace ? [] : local || []).map((item) => [item.id, item]));
  remote.forEach((item) => {
    if (!item || !item.id) return;
    if (item.deleted) {
      map.delete(item.id);
      return;
    }
    if (queued.has(item.id)) return;
    const prev = map.get(item.id);
    if (!prev || String(item.updatedAt || '') >= String(prev.updatedAt || '')) map.set(item.id, item);
  });
  return [...map.values()];
}

function exerciseRow(ex, userId) {
  return {
    id: ex.id,
    user_id: userId,
    name: ex.name,
    muscle_group: ex.muscleGroup,
    muscles: ex.muscles || [],
    tip: ex.tip || '',
    link_url: ex.linkUrl || '',
    link_label: ex.linkLabel || '',
    archived: !!ex.archived,
    updated_at: ex.updatedAt || new Date().toISOString(),
    deleted: false,
  };
}

function exerciseFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    muscles: row.muscles || [],
    tip: row.tip || '',
    linkUrl: row.link_url || '',
    linkLabel: row.link_label || '',
    archived: !!row.archived,
    updatedAt: row.updated_at,
    deleted: !!row.deleted,
  };
}

function setRow(set, userId) {
  return {
    id: set.id,
    user_id: userId,
    exercise_id: set.exerciseId,
    session_id: set.sessionId,
    date: set.date,
    set_number: set.setNumber,
    weight: set.weight,
    reps: set.reps,
    rpe: set.rpe,
    note: set.note || '',
    ts: set.ts,
    updated_at: set.updatedAt || new Date().toISOString(),
    deleted: false,
  };
}

function setFromRow(row) {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    sessionId: row.session_id,
    date: row.date,
    setNumber: row.set_number,
    weight: Number(row.weight),
    reps: row.reps,
    rpe: row.rpe,
    note: row.note || '',
    ts: row.ts,
    updatedAt: row.updated_at,
    deleted: !!row.deleted,
  };
}

function metricRow(metric, userId) {
  return {
    id: metric.id,
    user_id: userId,
    date: metric.date,
    weight: metric.weight,
    waist_cm: metric.waistCm,
    neck_cm: metric.neckCm,
    hip_cm: metric.hipCm,
    body_fat_manual: metric.bodyFatManual,
    note: metric.note || '',
    updated_at: metric.updatedAt || new Date().toISOString(),
    deleted: false,
  };
}

function metricFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    weight: row.weight == null ? null : Number(row.weight),
    waistCm: row.waist_cm == null ? null : Number(row.waist_cm),
    neckCm: row.neck_cm == null ? null : Number(row.neck_cm),
    hipCm: row.hip_cm == null ? null : Number(row.hip_cm),
    bodyFatManual: row.body_fat_manual == null ? null : Number(row.body_fat_manual),
    note: row.note || '',
    updatedAt: row.updated_at,
    deleted: !!row.deleted,
  };
}

function routineRow(routine, userId, active) {
  return {
    id: routine.id,
    user_id: userId,
    data: routine,
    is_active: !!active,
    updated_at: routine.updatedAt || new Date().toISOString(),
    deleted: false,
  };
}

function profileRow(profile, settings, userId) {
  return {
    user_id: userId,
    sex: profile.sex || null,
    birth_date: profile.birthDate || null,
    height_cm: profile.heightCm || null,
    activity_level: profile.activityLevel || null,
    goal: profile.goal || null,
    target_body_fat: profile.targetBodyFat || null,
    settings: settings || {},
    updated_at: profile.updatedAt || new Date().toISOString(),
  };
}

function profileFromRow(row) {
  return {
    id: 'profile',
    sex: row.sex,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    activityLevel: row.activity_level,
    goal: row.goal,
    targetBodyFat: row.target_body_fat,
    updatedAt: row.updated_at,
  };
}

async function openAccount() {
  const modal = document.getElementById('accountModal');
  const box = document.getElementById('accountBody');
  if (!syncConfigured()) {
    box.innerHTML = '<p>La app funciona sin cuenta: todo queda en este dispositivo. Para sincronizar, copiá <code>js/config.example.js</code> a <code>js/config.js</code> y poné la URL y la anon key de Supabase.</p>';
  } else if (!syncUser) {
    box.innerHTML = `
      <form onsubmit="sendMagicLink(event)">
        <label>Email</label>
        <input type="email" name="email" required placeholder="tu@email.com">
        <button type="submit" class="log-btn">Enviar link</button>
      </form>`;
  } else {
    const queue = await Storage.getSyncQueue();
    box.innerHTML = `
      <p>${escapeHtml(syncUser.email || 'Sesión iniciada')}</p>
      <p class="sub">${queue.length ? queue.length + ' cambios pendientes' : 'Al día'}</p>
      <button type="button" class="log-btn" onclick="syncNow()">Sincronizar ahora</button>
      <button type="button" class="btn-secondary" onclick="exportEverything()">Exportar todo (JSON)</button>
      <button type="button" class="btn-secondary" onclick="signOutAccount()">Cerrar sesión</button>
      <button type="button" class="btn-danger" onclick="deleteAccount()">Borrar mi cuenta y datos</button>`;
  }
  modal.classList.add('show');
}

function closeAccount() {
  document.getElementById('accountModal').classList.remove('show');
}

async function sendMagicLink(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button');
  const email = new FormData(form).get('email');
  button.disabled = true;
  button.textContent = 'Enviando…';
  try {
    const client = await ensureClient();
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } });
    if (error) throw error;
    if (form.closest('#loginGate')) {
      button.disabled = false;
      button.textContent = 'Reenviar link';
      const sent = document.getElementById('loginSent');
      if (sent) sent.hidden = false;
      return;
    }
    closeAccount();
    showToast('Listo. Revisá tu email para entrar');
  } catch (err) {
    button.disabled = false;
    button.textContent = 'Enviar link';
    alert(err.message || 'No se pudo enviar el link');
  }
}

async function syncNow() {
  await pushAndPull();
  showToast('Sincronizado');
  await openAccount();
  await refreshVisible();
}

async function exportEverything() {
  const data = await Storage.exportAll();
  downloadJson(`tu-rutina-${todayIso()}.json`, data);
}

async function signOutAccount() {
  const wipe = confirm('¿Borrar también los datos de este dispositivo? Cancelar los conserva.');
  await supabaseClient.auth.signOut();
  syncUser = null;
  if (wipe) {
    await Storage.setSyncChoice(null);
    await Storage.importAll({ routine: null, routines: [], sets: [], exercises: [], bodyMetrics: [], profile: null, settings: DEFAULT_SETTINGS });
    currentRoutine = null;
  }
  showLoginGate();
  closeAccount();
  updateSyncDot();
  await refreshVisible();
}

async function deleteAccount() {
  if (!confirm('Esto borra la cuenta y los datos en la nube. ¿Seguro?')) return;
  const client = await ensureClient();
  const { error } = await client.rpc('delete_own_account');
  if (error) return alert('No se pudo borrar la cuenta. ' + error.message);
  await signOutAccount();
}

async function refreshVisible() {
  if (!syncUser) {
    showLoginGate();
    return;
  }
  if (typeof bootApp === 'function') {
    await bootApp();
    return;
  }
  const routine = await Storage.getRoutine();
  if (routine && document.getElementById('page-rutina')?.classList.contains('active')) await renderRoutineView(routine);
  if (document.getElementById('page-log')?.classList.contains('active')) await renderLogPage();
  if (document.getElementById('page-prog')?.classList.contains('active')) await renderProgressCharts();
  if (document.getElementById('page-cuerpo')?.classList.contains('active')) await renderBodyPage();
}
