let supabaseClient = null;
let syncTimer = null;
let syncUser = null;
let signingIn = null;
let loginMode = 'signup';
let syncProblem = '';
let droppedQueueIds = new Set();
const omitColumns = new Set();

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
  const authError = readAuthRedirectError();
  let pendingRecovery = peekAuthType('recovery');
  updateSyncDot();
  if (authError) showAuthError(authError);
  if (!syncConfigured()) {
    showLoginGate();
    return;
  }
  try {
    const client = await ensureClient();
    let sawInitial = false;
    const initialSession = new Promise((resolve) => {
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (pendingRecovery && session)) {
          pendingRecovery = false;
          showSetPassword();
        }
        if (!sawInitial && event === 'INITIAL_SESSION') {
          sawInitial = true;
          resolve(session || null);
        }
        if (session) onSignedIn(session).catch((error) => console.error(error));
        else if (event !== 'INITIAL_SESSION') {
          syncUser = null;
          signingIn = null;
          showLoginGate();
          updateSyncDot();
        }
      });
    });
    const session = await Promise.race([
      initialSession,
      new Promise((resolve) => setTimeout(() => resolve(undefined), 10000)),
    ]);
    if (session) showAuthLoading();
    else if (!syncUser) showLoginGate();
  } catch (error) {
    console.error(error);
    showLoginGate();
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
    dot.title = syncProblem || 'Cambios pendientes';
    return;
  }
  dot.classList.add('synced');
  dot.textContent = '☁';
  dot.title = 'Sincronizado';
}

async function onSignedIn(session) {
  if (!session || !session.user) return;
  const gate = document.getElementById('loginGate');
  const gateOpen = !gate || gate.classList.contains('show');
  const sameUser = syncUser && syncUser.id === session.user.id;
  syncUser = session.user;
  if (sameUser && !gateOpen) return;
  if (typeof showAuthLoading === 'function') showAuthLoading();
  if (!signingIn) {
    signingIn = (async () => {
      try {
        await handleSession(session);
      } catch (error) {
        console.error(error);
      }
      if (typeof bootApp === 'function') await bootApp();
    })();
  }
  try {
    await signingIn;
  } finally {
    signingIn = null;
  }
}

async function trainerPupilIds() {
  const client = supabaseClient || (await ensureClient());
  if (!client || !syncUser) return new Set();
  const { data, error } = await client.from('students').select('id').eq('trainer_id', syncUser.id);
  if (error) return new Set();
  return new Set((data || []).map((row) => row.id));
}

function withoutPupilRows(rows, pupils) {
  return (rows || []).filter((row) => !row.student_id || !pupils.has(row.student_id));
}

async function handleSession(session) {
  syncUser = session.user;
  updateSyncDot();
  try {
    const client = await ensureClient();
    await client.rpc('claim_student');
  } catch (err) {
    /* La función aparece cuando se vuelve a correr el SQL. */
  }
  if (typeof Subscription !== 'undefined' && Subscription.syncSubscription) {
    try { await Subscription.syncSubscription(); } catch (err) { console.error(err); }
  }
  await Storage.setSyncChoice(syncUser.id);
  try {
    await syncAccount();
  } catch (err) {
    console.error(err);
  }
}

function savedResult(result) {
  if (result && result.error) throw result.error;
  return result;
}

function errorText(error) {
  return ((error && (error.message || error.details)) || String(error || '')).replace(/\s+/g, ' ').trim();
}

function noteSyncProblem(error) {
  syncProblem = errorText(error).slice(0, 180);
  console.error(error);
}

function timeOf(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}

function numericOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value) {
  const n = numericOrNull(value);
  return n == null ? null : Math.round(n);
}

function missingColumn(error) {
  const text = errorText(error);
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /column "([^"]+)" does not exist/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return '';
}

async function upsertRow(client, table, row, returning) {
  const payload = Object.assign({}, row);
  omitColumns.forEach((key) => {
    const splitAt = key.indexOf('.');
    if (key.slice(0, splitAt) === table) delete payload[key.slice(splitAt + 1)];
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    let query = client.from(table).upsert(payload);
    if (returning) query = query.select().maybeSingle();
    const result = await query;
    if (!result.error) return result;
    const column = missingColumn(result.error);
    if (!column || !Object.prototype.hasOwnProperty.call(payload, column)) throw result.error;
    omitColumns.add(table + '.' + column);
    delete payload[column];
  }
  throw new Error('No se pudo guardar');
}

async function syncAccount() {
  if (!syncUser || !navigator.onLine) {
    updateSyncDot();
    return;
  }
  try {
    const queue = await Storage.getSyncQueue();
    let remoteHasData = true;
    try {
      const remoteSets = await countOwnRemote('workout_sets');
      const remoteRoutines = await countOwnRemote('routines');
      const remoteExercises = await countOwnRemote('exercises');
      remoteHasData = remoteSets || remoteRoutines || remoteExercises;
    } catch (error) {
      console.error(error);
    }
    const local = await Storage.exportAll();
    const localHasData = (local.sets || []).length || (local.routines || []).length || (local.exercises || []).length;
    if (queue.length) await pushAndPull();
    else if (!remoteHasData && localHasData) await uploadAll();
    else await pullAll(true);
  } catch (err) {
    noteSyncProblem(err);
  }
  updateSyncDot();
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
  let failed = false;
  const step = async (fn) => {
    try {
      await fn();
    } catch (error) {
      failed = true;
      noteSyncProblem(error);
    }
  };
  if (data.profile || data.settings) {
    await step(() => upsertRow(client, 'profiles', profileRow(data.profile || {}, data.settings, userId)));
  }
  for (const exercise of data.exercises || []) {
    if (!exercise || !String(exercise.name || '').trim() || placeholderExerciseName(exercise.name)) continue;
    await step(() => upsertRow(client, 'exercises', exerciseRow(exercise, userId)));
  }
  const routines = data.routines && data.routines.length ? data.routines : (data.routine ? [data.routine] : []);
  for (const routine of routines) {
    if (routine) await step(() => upsertRow(client, 'routines', routineRow(routine, userId, data.routine && routine.id === data.routine.id)));
  }
  for (const set of data.sets || []) await step(() => upsertRow(client, 'workout_sets', setRow(set, userId)));
  for (const metric of data.bodyMetrics || []) await step(() => upsertRow(client, 'body_metrics', metricRow(metric, userId)));
  if (!failed) {
    await Storage.clearSyncQueue();
    syncProblem = '';
  }
  await Storage.saveSyncMeta({ lastPulledAt: new Date().toISOString() });
  updateSyncDot();
}

async function pushQueueItem(client, item) {
  if (item.op === 'delete') {
    const result = await client.from(item.table).update({ deleted: true, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', syncUser.id);
    if (result.error) throw result.error;
    return;
  }
  if (item.table === 'profiles') {
    const data = await Storage.exportAll();
    await upsertRow(client, 'profiles', profileRow(item.record || data.profile || {}, data.settings, syncUser.id));
    return;
  }
  if (!item.record) return;
  if (item.table === 'routines') {
    const active = await Storage.getRoutine();
    await upsertRow(client, 'routines', routineRow(item.record, syncUser.id, active && active.id === item.record.id));
    return;
  }
  if (item.table === 'exercises') {
    if (!String(item.record.name || '').trim() || placeholderExerciseName(item.record.name)) return;
    await upsertRow(client, 'exercises', exerciseRow(item.record, syncUser.id));
    return;
  }
  if (item.table === 'workout_sets') {
    await upsertRow(client, 'workout_sets', setRow(item.record, syncUser.id));
    return;
  }
  if (item.table === 'body_metrics') {
    await upsertRow(client, 'body_metrics', metricRow(item.record, syncUser.id));
  }
}

async function remoteUpdatedAt(client, table, ids) {
  const found = new Map();
  for (let index = 0; index < ids.length; index += 100) {
    const slice = ids.slice(index, index + 100);
    const { data, error } = await client.from(table).select('id, updated_at').in('id', slice).eq('user_id', syncUser.id);
    if (error) throw error;
    (data || []).forEach((row) => found.set(row.id, row.updated_at));
  }
  return found;
}

async function dropStaleQueue(client, queue) {
  const stale = [];
  const blocked = new Set();
  const groups = new Map();
  const keyOf = (item) => [item.table, item.id, item.op, item.queuedAt].join('\0');
  (queue || []).forEach((item) => {
    if (!item || item.op === 'delete' || !item.record || !item.id || item.table === 'profiles') return;
    if (!groups.has(item.table)) groups.set(item.table, []);
    groups.get(item.table).push(item);
  });
  for (const [table, items] of groups) {
    let remote;
    try {
      remote = await remoteUpdatedAt(client, table, items.map((item) => item.id));
    } catch (error) {
      noteSyncProblem(error);
      items.forEach((item) => blocked.add(keyOf(item)));
      continue;
    }
    items.forEach((item) => {
      if (!remote.has(item.id)) return;
      if (timeOf(remote.get(item.id)) > timeOf(item.record.updatedAt)) stale.push(item);
    });
  }
  if (stale.length) await Storage.ackSyncQueue(stale);
  const gone = new Set(stale.map(keyOf));
  return (queue || []).filter((item) => !gone.has(keyOf(item)) && !blocked.has(keyOf(item)));
}

async function pushAndPull() {
  if (!syncUser || !navigator.onLine) {
    updateSyncDot();
    return;
  }
  const client = await ensureClient();
  if (!client) return;
  syncProblem = '';
  let queue = await Storage.getSyncQueue();
  queue = await dropStaleQueue(client, queue);
  const done = [];
  for (const item of queue) {
    try {
      await pushQueueItem(client, item);
      done.push(item);
    } catch (error) {
      noteSyncProblem(error);
    }
  }
  if (done.length) await Storage.ackSyncQueue(done);
  await pullAll(true);
  updateSyncDot();
}

async function fetchOwn(table) {
  const client = await ensureClient();
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await client.from(table).select('*').eq('user_id', syncUser.id).order('id', { ascending: true }).range(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return rows;
}

async function countOwnRemote(table) {
  const client = await ensureClient();
  const pupils = await trainerPupilIds();
  let owned = await client.from(table).select('id, student_id').eq('user_id', syncUser.id);
  if (owned.error) owned = await client.from(table).select('id').eq('user_id', syncUser.id);
  if (owned.error) throw owned.error;
  return withoutPupilRows(owned.data, pupils).length;
}

async function insertMissing(client, table, localRows, remoteRows, toRow) {
  const ids = new Set((remoteRows || []).map((row) => row && row.id).filter(Boolean));
  const added = [];
  for (const record of localRows || []) {
    if (!record || !record.id || ids.has(record.id) || record.deleted) continue;
    if (table === 'exercises' && (!String(record.name || '').trim() || placeholderExerciseName(record.name))) continue;
    try {
      const result = await upsertRow(client, table, toRow(record), true);
      if (result.data) {
        added.push(result.data);
        ids.add(record.id);
      }
    } catch (error) {
      noteSyncProblem(error);
    }
  }
  return (remoteRows || []).concat(added);
}

async function pullAll(replace) {
  const client = await ensureClient();
  const queuedItems = await Storage.getSyncQueue();
  const queued = new Set(queuedItems.map((item) => item.id));
  droppedQueueIds = new Set();
  const pupils = await trainerPupilIds();
  let [exerciseRows, setRows, metricRows, routineRows, profile] = await Promise.all([
    fetchOwn('exercises'),
    fetchOwn('workout_sets'),
    fetchOwn('body_metrics'),
    fetchOwn('routines'),
    client.from('profiles').select('*').eq('user_id', syncUser.id).maybeSingle(),
  ]);
  const local = await Storage.exportAll();
  if (replace) {
    const userId = syncUser.id;
    exerciseRows = await insertMissing(client, 'exercises', local.exercises, exerciseRows, (row) => exerciseRow(row, userId));
    setRows = await insertMissing(client, 'workout_sets', local.sets, setRows, (row) => setRow(row, userId));
    metricRows = await insertMissing(client, 'body_metrics', local.bodyMetrics, metricRows, (row) => metricRow(row, userId));
    routineRows = await insertMissing(client, 'routines', local.routines, routineRows, (row) => routineRow(row, userId, local.routine && row.id === local.routine.id));
    if (!profile.data && (local.profile || local.settings)) {
      try {
        const result = await upsertRow(client, 'profiles', profileRow(local.profile || {}, local.settings, userId), true);
        profile = { data: result.data };
      } catch (error) {
        noteSyncProblem(error);
      }
    }
  }
  const nextExercises = mergeRows(local.exercises, withoutPupilRows(exerciseRows, pupils).map(exerciseFromRow), queued, replace);
  const nextSets = mergeRows(local.sets, withoutPupilRows(setRows, pupils).map(setFromRow), queued, replace);
  const nextMetrics = mergeRows(local.bodyMetrics, withoutPupilRows(metricRows, pupils).map(metricFromRow), queued, replace);
  const remoteRoutines = withoutPupilRows(routineRows, pupils).map((row) => Object.assign({}, row.data, { id: row.id, updatedAt: row.updated_at, deleted: !!row.deleted, isActive: !!row.is_active }));
  let nextRoutines = mergeRows(local.routines || [], remoteRoutines, queued, replace);
  if (!nextRoutines.some((routine) => routine && Array.isArray(routine.days) && routine.days.length)) {
    const kept = (local.routines || []).filter((routine) => routine && Array.isArray(routine.days) && routine.days.length);
    if (kept.length) nextRoutines = kept.concat(nextRoutines.filter((routine) => !kept.some((item) => item.id === routine.id)));
    else if (local.routine && Array.isArray(local.routine.days) && local.routine.days.length) nextRoutines = [local.routine];
  }
  let nextProfile = local.profile;
  let nextSettings = local.settings;
  if (profile.data) {
    const remoteProfile = profileFromRow(profile.data);
    if (replace || !nextProfile || timeOf(remoteProfile.updatedAt) >= timeOf(nextProfile.updatedAt)) {
      nextProfile = remoteProfile;
      nextSettings = profile.data.settings || nextSettings;
    }
  }
  const active = pickActiveRoutine(nextRoutines, nextSets, local.routine);
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
  if (droppedQueueIds.size) {
    await Storage.ackSyncQueue(queuedItems.filter((item) => item.op !== 'delete' && droppedQueueIds.has(item.id)));
  }
  if (typeof currentRoutine !== 'undefined' && active) currentRoutine = active;
}

function routineExerciseIds(routine) {
  const ids = new Set();
  (routine.days || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        if (slot && slot.exerciseId) ids.add(slot.exerciseId);
      });
    });
  });
  return ids;
}

function pickActiveRoutine(routines, sets, localRoutine) {
  const withDays = (routines || []).filter((routine) => routine && Array.isArray(routine.days) && routine.days.length);
  if (!withDays.length) return localRoutine || null;
  const ranked = withDays.map((routine) => {
    const ids = routineExerciseIds(routine);
    const count = (sets || []).filter((set) => ids.has(set.exerciseId)).length;
    return { routine, count, active: routine.isActive ? 1 : 0 };
  });
  ranked.sort((a, b) => b.count - a.count || b.active - a.active);
  return ranked[0].routine;
}

function placeholderExerciseName(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text === 'ejercicio' || text === 'exercise';
}

function healMerged(primary, fallback) {
  if (!primary || !fallback) return primary;
  const copy = Object.assign({}, primary);
  let changed = false;
  if (placeholderExerciseName(copy.name) && !placeholderExerciseName(fallback.name)) {
    copy.name = fallback.name;
    if (!copy.muscleGroup && fallback.muscleGroup) copy.muscleGroup = fallback.muscleGroup;
    if ((!copy.muscles || !copy.muscles.length) && fallback.muscles) copy.muscles = fallback.muscles;
    if (!copy.tip && fallback.tip) copy.tip = fallback.tip;
    if (!copy.linkUrl && fallback.linkUrl) copy.linkUrl = fallback.linkUrl;
    if (!copy.linkLabel && fallback.linkLabel) copy.linkLabel = fallback.linkLabel;
    changed = true;
  }
  if (Array.isArray(copy.days) && !String(copy.title || '').trim() && String(fallback.title || '').trim()) {
    copy.title = fallback.title;
    if (!copy.subtitle && fallback.subtitle) copy.subtitle = fallback.subtitle;
    changed = true;
  }
  return changed ? copy : primary;
}

function mergeRows(local, remote, queued, replace) {
  const localById = new Map();
  const map = new Map();
  (local || []).forEach((item) => {
    if (!item || !item.id) return;
    localById.set(item.id, item);
    if (!replace || (queued && queued.has(item.id))) map.set(item.id, item);
  });
  remote.forEach((item) => {
    if (!item || !item.id) return;
    const localItem = localById.get(item.id);
    const queuedHere = !!(queued && queued.has(item.id));
    const localIsNewer = queuedHere && localItem && timeOf(localItem.updatedAt) > timeOf(item.updatedAt);
    if (item.deleted) {
      if (localIsNewer) return;
      if (queuedHere) droppedQueueIds.add(item.id);
      map.delete(item.id);
      return;
    }
    if (localIsNewer) return;
    if (queuedHere) droppedQueueIds.add(item.id);
    const prev = map.get(item.id);
    const newer = !prev || timeOf(item.updatedAt) >= timeOf(prev.updatedAt);
    const winner = newer ? item : prev;
    const other = newer ? (prev || localItem) : item;
    map.set(item.id, healMerged(winner, other));
  });
  return [...map.values()];
}

function exerciseRow(ex, userId) {
  const muscles = Array.isArray(ex.muscles) ? ex.muscles : (ex.muscles ? [ex.muscles] : []);
  return {
    id: ex.id,
    user_id: userId,
    name: ex.name,
    muscle_group: ex.muscleGroup || null,
    muscles: muscles.map((item) => String(item)),
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
  const bodyweight = !!set.bodyweight;
  const weight = bodyweight ? 0 : numericOrNull(set.weight);
  return {
    id: set.id,
    user_id: userId,
    exercise_id: set.exerciseId || null,
    session_id: set.sessionId || null,
    date: set.date || null,
    set_number: intOrNull(set.setNumber),
    weight: weight == null ? 0 : weight,
    bodyweight,
    reps: intOrNull(set.reps),
    rpe: numericOrNull(set.rpe),
    note: set.note || '',
    ts: intOrNull(set.ts),
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
    weight: Number(row.weight) || 0,
    bodyweight: !!row.bodyweight,
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
    weight: numericOrNull(metric.weight),
    waist_cm: numericOrNull(metric.waistCm),
    neck_cm: numericOrNull(metric.neckCm),
    hip_cm: numericOrNull(metric.hipCm),
    body_fat_manual: numericOrNull(metric.bodyFatManual),
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
    box.innerHTML = '<p>' + (typeof I18n !== 'undefined' ? I18n.t('sync.offline') : 'La app funciona sin cuenta: todo queda en este dispositivo.') + '</p>';
  } else if (!syncUser) {
    box.innerHTML = authFormHtml('accountLoginForm');
  } else {
    const queue = await Storage.getSyncQueue();
    const client = await ensureClient();
    const role = await client.from('profiles').select('role').eq('user_id', syncUser.id).maybeSingle();
    const roleName = role.data && role.data.role;
    const coach = typeof Subscription !== 'undefined' && Subscription.allowsCoach();
    const studentsLabel = typeof I18n !== 'undefined' ? I18n.t('trainer.students') : 'Alumnos';
    const adminBtn = roleName === 'admin'
      ? `<button type="button" class="log-btn" onclick="openAdmin()">${escapeHtml(trAuth('admin.title'))}</button>`
      : '';
    const coachBtn = coach
      ? `<button type="button" class="trainer-entry" onclick="openTrainer()"><span class="trainer-kicker">${escapeHtml(trAuth('trainer.kicker'))}</span><strong>${escapeHtml(studentsLabel)}</strong><em>${escapeHtml(trAuth('trainer.entryLead'))}</em></button>`
      : '';
    const googleBtn = userHasProvider(syncUser, 'google')
      ? ''
      : `<button type="button" class="btn-secondary" onclick="linkGoogle()" data-i18n="login.linkgoogle">${escapeHtml(trAuth('login.linkgoogle'))}</button>`;
    let status = queue.length ? trAuth('account.pending').replace('{n}', String(queue.length)) : trAuth('account.synced');
    if (syncProblem) status += '. ' + trAuth('account.syncFail').replace('{error}', syncProblem);
    box.innerHTML = `
      ${coachBtn}
      <p>${escapeHtml(syncUser.email || trAuth('account.session'))}</p>
      <p class="sub">${escapeHtml(status)}</p>
      ${adminBtn}
      ${googleBtn}
      <button type="button" class="log-btn" onclick="syncNow()">${escapeHtml(trAuth('account.sync'))}</button>
      <button type="button" class="btn-secondary" onclick="exportEverything()">${escapeHtml(trAuth('account.export'))}</button>
      <button type="button" class="btn-secondary" onclick="signOutAccount()">${escapeHtml(trAuth('admin.signout'))}</button>
      <button type="button" class="btn-danger" onclick="deleteAccount()">${escapeHtml(trAuth('account.delete'))}</button>`;
  }
  if (typeof Subscription !== 'undefined') box.insertAdjacentHTML('afterbegin', Subscription.summaryHtml());
  if (typeof I18n !== 'undefined') I18n.apply(box);
  applyLoginMode();
  modal.classList.add('show');
}

function closeAccount() {
  document.getElementById('accountModal').classList.remove('show');
}

function trAuth(key) {
  return typeof I18n !== 'undefined' ? I18n.t(key) : key;
}

function authErrorText(error) {
  const code = (error && (error.code || error.error_code)) || '';
  const message = (error && (error.message || error.error_description)) || '';
  const blob = (code + ' ' + message).toLowerCase();
  if (/already registered|user_already_exists|email_exists|already been registered/.test(blob)) return trAuth('login.err.exists');
  if (/invalid login|invalid_credentials/.test(blob)) return trAuth('login.err.credentials');
  if (/weak_password|at least 6|should be at least/.test(blob)) return trAuth('login.err.weak');
  if (/rate limit|over_email_send_rate_limit|too many/.test(blob)) return trAuth('login.err.rate');
  if (/provider is not enabled|unsupported provider/.test(blob)) return trAuth('login.err.google');
  if (/manual_linking|manual linking/.test(blob)) return trAuth('login.err.link');
  if (/signups not allowed|user_not_found|user not found/.test(blob)) return trAuth('login.err.none');
  if (/redirect/.test(blob) && /not allowed|invalid/.test(blob)) return trAuth('login.err.redirect');
  return message || trAuth('login.err.generic');
}

function peekAuthType(type) {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  return params.get('type') === type || hash.get('type') === type;
}

function readAuthRedirectError() {
  const params = new URLSearchParams(window.location.search);
  let code = params.get('error_code') || '';
  let description = params.get('error_description') || params.get('error') || '';
  let hasError = params.has('error') || params.has('error_code');
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  if (!hasError && (hash.has('error') || hash.has('error_code'))) {
    hasError = true;
    code = hash.get('error_code') || '';
    description = hash.get('error_description') || hash.get('error') || '';
  }
  if (!hasError) return null;
  const url = new URL(window.location.href);
  ['error', 'error_code', 'error_description'].forEach((key) => url.searchParams.delete(key));
  if (/error=/.test(url.hash)) url.hash = '';
  history.replaceState({}, '', url.pathname + url.search + url.hash);
  let message = String(description || '').replace(/\+/g, ' ');
  try { message = decodeURIComponent(message); } catch (err) { /* el texto ya venía plano */ }
  return { code, message };
}

function showAuthError(error) {
  const form = document.getElementById('loginForm') || document.getElementById('accountLoginForm');
  const text = authErrorText(error);
  if (form) setAuthNotice(form, text, 'error');
  else alert(text);
}

function setAuthNotice(form, text, kind) {
  const root = (form && (form.closest('.login-panel') || form)) || document;
  const error = root.querySelector('.login-error');
  const sent = root.querySelector('.login-sent');
  if (error) {
    error.hidden = kind !== 'error' || !text;
    error.textContent = kind === 'error' ? text : '';
  }
  if (sent) {
    sent.hidden = kind !== 'ok' || !text;
    if (kind === 'ok') sent.textContent = text;
  }
}

function setLoginMode(mode) {
  loginMode = mode === 'signin' ? 'signin' : 'signup';
  applyLoginMode();
}

function applyLoginMode() {
  const signup = loginMode === 'signup';
  document.querySelectorAll('[data-login-mode]').forEach((btn) => {
    const on = btn.getAttribute('data-login-mode') === loginMode;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-login-submit]').forEach((btn) => {
    if (!btn.disabled) btn.textContent = trAuth(signup ? 'login.signup' : 'login.signin');
  });
  document.querySelectorAll('[data-login-password]').forEach((input) => {
    input.autocomplete = signup ? 'new-password' : 'current-password';
  });
}

function userHasProvider(user, provider) {
  const meta = user && user.app_metadata && user.app_metadata.providers;
  if (Array.isArray(meta) && meta.includes(provider)) return true;
  return ((user && user.identities) || []).some((item) => item.provider === provider);
}

function googleButtonHtml() {
  return `<button type="button" class="login-google" data-google onclick="signInWithGoogle()">
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.3 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
    <span data-i18n="login.google">${escapeHtml(trAuth('login.google'))}</span>
  </button>`;
}

function authFormHtml(formId) {
  return `<div class="login-panel">
    ${googleButtonHtml()}
    <p class="login-or" data-i18n="login.or">${escapeHtml(trAuth('login.or'))}</p>
    <div class="login-modes" role="tablist">
      <button type="button" role="tab" data-login-mode="signup" onclick="setLoginMode('signup')" data-i18n="login.signup">${escapeHtml(trAuth('login.signup'))}</button>
      <button type="button" role="tab" data-login-mode="signin" onclick="setLoginMode('signin')" data-i18n="login.signin">${escapeHtml(trAuth('login.signin'))}</button>
    </div>
    <form id="${formId}" onsubmit="submitEmailAuth(event)">
      <label>Email</label>
      <input name="email" type="email" required placeholder="tu@email.com" autocomplete="email">
      <label data-i18n="login.password">${escapeHtml(trAuth('login.password'))}</label>
      <input name="password" type="password" required minlength="6" autocomplete="new-password" data-login-password>
      <button type="submit" class="log-btn" data-login-submit data-i18n="login.signup">${escapeHtml(trAuth('login.signup'))}</button>
      <p class="login-error" hidden></p>
      <p class="login-sent" hidden></p>
      <div class="login-links">
        <button type="button" onclick="sendPasswordReset(event)" data-i18n="login.reset">${escapeHtml(trAuth('login.reset'))}</button>
      </div>
    </form>
  </div>`;
}

async function requireAuthClient() {
  const client = await ensureClient();
  if (!client) throw new Error(trAuth('login.err.config'));
  return client;
}

function authEmailFrom(event) {
  const form = event.target.closest('form');
  const email = String((form && new FormData(form).get('email')) || '').trim().toLowerCase();
  return { form, email };
}

async function signInWithGoogle() {
  const buttons = document.querySelectorAll('[data-google]');
  buttons.forEach((btn) => { btn.disabled = true; });
  try {
    const client = await requireAuthClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl(),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  } catch (err) {
    buttons.forEach((btn) => { btn.disabled = false; });
    showAuthError(err);
  }
}

async function linkGoogle() {
  try {
    const client = await requireAuthClient();
    const { error } = await client.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: redirectUrl() },
    });
    if (error) throw error;
  } catch (err) {
    alert(authErrorText(err));
  }
}

async function submitEmailAuth(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type="submit"]');
  const email = String(new FormData(form).get('email') || '').trim().toLowerCase();
  const password = String(new FormData(form).get('password') || '');
  setAuthNotice(form, '', 'error');
  if (!email.includes('@')) {
    setAuthNotice(form, trAuth('login.err.email'), 'error');
    return;
  }
  if (password.length < 6) {
    setAuthNotice(form, trAuth('login.err.weak'), 'error');
    return;
  }
  button.disabled = true;
  button.textContent = trAuth('login.sending');
  try {
    const client = await requireAuthClient();
    if (loginMode === 'signup') {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl() },
      });
      if (error) throw error;
      const identities = data.user && data.user.identities;
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        setLoginMode('signin');
        setAuthNotice(form, trAuth('login.err.exists'), 'error');
        return;
      }
      if (!data.session) setAuthNotice(form, trAuth('login.confirm'), 'ok');
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    const blob = ((err && err.code) || '') + ' ' + ((err && err.message) || '');
    if (/already registered|user_already_exists|email_exists/i.test(blob)) setLoginMode('signin');
    setAuthNotice(form, authErrorText(err), 'error');
  } finally {
    button.disabled = false;
    applyLoginMode();
  }
}

async function sendLoginLink(event) {
  const { form, email } = authEmailFrom(event);
  const button = event.target.closest('button');
  if (!form || !email.includes('@')) {
    if (form) setAuthNotice(form, trAuth('login.err.email'), 'error');
    return;
  }
  button.disabled = true;
  try {
    const client = await requireAuthClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl(), shouldCreateUser: false },
    });
    if (error) throw error;
    setAuthNotice(form, trAuth('login.sent'), 'ok');
  } catch (err) {
    setAuthNotice(form, authErrorText(err), 'error');
  } finally {
    button.disabled = false;
  }
}

async function sendMagicLink(event) {
  return sendLoginLink(event);
}

async function sendPasswordReset(event) {
  const { form, email } = authEmailFrom(event);
  const button = event.target.closest('button');
  if (!form || !email.includes('@')) {
    if (form) setAuthNotice(form, trAuth('login.err.email'), 'error');
    return;
  }
  button.disabled = true;
  try {
    const client = await requireAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
    if (error) throw error;
    setAuthNotice(form, trAuth('login.reset.sent'), 'ok');
  } catch (err) {
    setAuthNotice(form, authErrorText(err), 'error');
  } finally {
    button.disabled = false;
  }
}

function showSetPassword() {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.add('show');
}

function closeSetPassword() {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.remove('show');
}

async function saveNewPassword(event) {
  event.preventDefault();
  const form = event.target;
  const password = String(new FormData(form).get('password') || '');
  const button = form.querySelector('[type="submit"]');
  if (password.length < 6) {
    setAuthNotice(form, trAuth('login.err.weak'), 'error');
    return;
  }
  button.disabled = true;
  try {
    const client = await requireAuthClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    closeSetPassword();
    showToast(trAuth('login.newpass.ok'));
  } catch (err) {
    button.disabled = false;
    setAuthNotice(form, authErrorText(err), 'error');
  }
}

document.addEventListener('lang:change', applyLoginMode);

async function bringAccountRoutine() {
  const button = document.getElementById('welcomeBring');
  if (!syncUser) {
    openAccount();
    return;
  }
  if (button) button.disabled = true;
  try {
    await syncAccount();
    const routine = await Storage.getRoutine();
    if (routine && Array.isArray(routine.days) && routine.days.length) {
      if (typeof hideWelcome === 'function') hideWelcome();
      currentRoutine = routine;
      await renderRoutineView(routine);
      if (typeof renderLogPage === 'function') await renderLogPage();
      if (document.getElementById('progressCharts') && typeof renderProgressCharts === 'function') await renderProgressCharts();
      return;
    }
    showToast(typeof I18n !== 'undefined' ? I18n.t('welcome.still') : 'Sigue sin haber una rutina en la cuenta. Abrí la app en el celular con internet.');
  } catch (err) {
    console.error(err);
    showToast(typeof I18n !== 'undefined' ? I18n.t('welcome.still') : 'Sigue sin haber una rutina en la cuenta. Abrí la app en el celular con internet.');
  } finally {
    if (button) button.disabled = false;
  }
}

async function syncNow() {
  await pushAndPull();
  const queue = await Storage.getSyncQueue();
  if (queue.length || syncProblem) showToast(syncProblem || trAuth('account.pending').replace('{n}', String(queue.length)));
  else showToast(trAuth('sync.toast'));
  await openAccount();
  await refreshVisible();
}

async function exportEverything() {
  const data = await Storage.exportAll();
  downloadJson(`tu-rutina-${todayIso()}.json`, data);
}

async function signOutAccount() {
  await supabaseClient.auth.signOut();
  syncUser = null;
  await showLoginGate();
  closeAccount();
  updateSyncDot();
  await refreshVisible();
}

async function deleteAccount() {
  if (!confirm(trAuth('account.delete.confirm'))) return;
  const client = await ensureClient();
  const { error } = await client.rpc('delete_own_account');
  if (error) return alert(trAuth('account.delete.fail') + ' ' + error.message);
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
