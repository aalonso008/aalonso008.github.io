/* Capa única de datos. localStorage es la fuente inmediata; la cola sync_queue
   la vacía js/sync.js cuando hay sesión de Supabase. */
const Storage = (function () {
  const KEYS = {
    routine: 'tu_rutina_data',
    routines: 'tu_rutina_routines',
    meta: 'tu_rutina_meta',
    logs: 'gym_logs',
    sets: 'gym_sets',
    exercises: 'tu_rutina_exercises',
    body: 'body_metrics',
    profile: 'tu_rutina_profile',
    settings: 'tu_rutina_settings',
    queue: 'sync_queue',
    syncMeta: 'tu_rutina_sync_meta',
    backupRoutine: 'tu_rutina_data_backup_v1',
    backupLogs: 'gym_logs_backup_v1',
    wizardDraft: 'routine_wizard_draft',
  };

  const SCHEMA_VERSION = 2;
  let writeChain = Promise.resolve();

  function enqueue(fn) {
    const run = writeChain.then(fn, fn);
    writeChain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function emit(type) {
    document.dispatchEvent(new CustomEvent('data:changed', { detail: { type } }));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stamp(record) {
    if (!record || typeof record !== 'object') return record;
    if (!record.updatedAt) record.updatedAt = new Date().toISOString();
    return record;
  }

  function queueUpsert(table, record) {
    if (!record || !record.id) return;
    const queue = readJson(KEYS.queue, []);
    const entry = { op: 'upsert', table, id: record.id, record: clone(record), queuedAt: Date.now() };
    const index = queue.findIndex((item) => item.table === table && item.id === record.id);
    if (index >= 0) queue[index] = entry;
    else queue.push(entry);
    writeJson(KEYS.queue, queue);
    document.dispatchEvent(new CustomEvent('sync:queued'));
  }

  function queueDelete(table, id) {
    const queue = readJson(KEYS.queue, []).filter((item) => !(item.table === table && item.id === id && item.op === 'upsert'));
    queue.push({ op: 'delete', table, id, queuedAt: Date.now() });
    writeJson(KEYS.queue, queue);
    document.dispatchEvent(new CustomEvent('sync:queued'));
  }

  function readRoutineList() {
    const list = readJson(KEYS.routines, null);
    if (Array.isArray(list) && list.length) return list;
    const active = readJson(KEYS.routine, null);
    return active ? [active] : [];
  }

  function writeActive(routine) {
    writeJson(KEYS.routine, routine);
    const list = readRoutineList();
    const index = list.findIndex((item) => item.id === routine.id);
    if (index >= 0) list[index] = routine;
    else list.push(routine);
    writeJson(KEYS.routines, list);
  }

  function getRoutine() {
    return enqueue(() => readJson(KEYS.routine, null));
  }

  function getRoutines() {
    return enqueue(() => readRoutineList());
  }

  function saveRoutine(routine) {
    const snapshot = clone(routine);
    snapshot.version = SCHEMA_VERSION;
    if (!snapshot.id) snapshot.id = createId('rt');
    snapshot.updatedAt = new Date().toISOString();
    delete snapshot.exercises;
    return enqueue(() => {
      writeActive(snapshot);
      queueUpsert('routines', snapshot);
      emit('routine');
      return snapshot;
    });
  }

  function setActiveRoutine(id) {
    return enqueue(() => {
      const list = readRoutineList();
      const found = list.find((item) => item.id === id);
      if (!found) return null;
      writeJson(KEYS.routine, found);
      emit('routine');
      return found;
    });
  }

  function deleteRoutine(id) {
    return enqueue(() => {
      let list = readRoutineList();
      if (list.length <= 1) return list;
      list = list.filter((item) => item.id !== id);
      writeJson(KEYS.routines, list);
      const active = readJson(KEYS.routine, null);
      if (!active || active.id === id) writeJson(KEYS.routine, list[0]);
      queueDelete('routines', id);
      emit('routine');
      return list;
    });
  }

  function getExercises() {
    return enqueue(() => readJson(KEYS.exercises, []));
  }

  function replaceExercises(list) {
    const snapshot = clone(list || []);
    return enqueue(() => {
      writeJson(KEYS.exercises, snapshot);
      snapshot.forEach((ex) => queueUpsert('exercises', ex));
      emit('exercises');
      return snapshot;
    });
  }

  function saveExercise(ex) {
    const snapshot = clone(ex);
    if (!snapshot.id) snapshot.id = createId('ex');
    snapshot.updatedAt = new Date().toISOString();
    return enqueue(() => {
      const list = readJson(KEYS.exercises, []);
      const index = list.findIndex((item) => item.id === snapshot.id);
      if (index >= 0) list[index] = snapshot;
      else list.push(snapshot);
      writeJson(KEYS.exercises, list);
      queueUpsert('exercises', snapshot);
      emit('exercises');
      return snapshot;
    });
  }

  function deleteExercise(id) {
    return enqueue(() => {
      const list = readJson(KEYS.exercises, []).filter((item) => item.id !== id);
      writeJson(KEYS.exercises, list);
      queueDelete('exercises', id);
      emit('exercises');
      return list;
    });
  }

  function matchSet(set, filter) {
    if (!filter) return true;
    if (filter.exerciseId != null && set.exerciseId !== filter.exerciseId) return false;
    if (filter.sessionId != null && set.sessionId !== filter.sessionId) return false;
    if (filter.date != null && set.date !== filter.date) return false;
    if (filter.id != null && set.id !== filter.id) return false;
    return true;
  }

  function getSets(filter) {
    return enqueue(() => {
      const sets = readJson(KEYS.sets, []);
      if (!filter) return sets;
      return sets.filter((set) => matchSet(set, filter));
    });
  }

  function addSet(set) {
    const snapshot = clone(set);
    if (!snapshot.id) snapshot.id = createId('set');
    snapshot.updatedAt = new Date().toISOString();
    return enqueue(() => {
      const sets = readJson(KEYS.sets, []);
      const index = sets.findIndex((item) => item.id === snapshot.id);
      if (index >= 0) sets[index] = snapshot;
      else sets.unshift(snapshot);
      writeJson(KEYS.sets, sets);
      queueUpsert('workout_sets', snapshot);
      emit('sets');
      return snapshot;
    });
  }

  function replaceSets(list) {
    const snapshot = clone(list || []);
    return enqueue(() => {
      writeJson(KEYS.sets, snapshot);
      emit('sets');
      return snapshot;
    });
  }

  function deleteSet(id) {
    return enqueue(() => {
      const sets = readJson(KEYS.sets, []).filter((set) => set.id !== id);
      writeJson(KEYS.sets, sets);
      queueDelete('workout_sets', id);
      emit('sets');
      return sets;
    });
  }

  function getBodyMetrics() {
    return enqueue(() => readJson(KEYS.body, []));
  }

  function addBodyMetric(metric) {
    const snapshot = clone(metric);
    if (!snapshot.id) snapshot.id = createId('bm');
    snapshot.updatedAt = new Date().toISOString();
    return enqueue(() => {
      const list = readJson(KEYS.body, []);
      const index = list.findIndex((item) => item.id === snapshot.id);
      if (index >= 0) list[index] = snapshot;
      else list.unshift(snapshot);
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      writeJson(KEYS.body, list);
      queueUpsert('body_metrics', snapshot);
      emit('body');
      return snapshot;
    });
  }

  function deleteBodyMetric(id) {
    return enqueue(() => {
      const list = readJson(KEYS.body, []).filter((item) => item.id !== id);
      writeJson(KEYS.body, list);
      queueDelete('body_metrics', id);
      emit('body');
      return list;
    });
  }

  function getWizardDraft() {
    return enqueue(() => readJson(KEYS.wizardDraft, null));
  }

  function saveWizardDraft(draft) {
    const snapshot = clone(draft);
    return enqueue(() => {
      writeJson(KEYS.wizardDraft, snapshot);
      return snapshot;
    });
  }

  function clearWizardDraft() {
    return enqueue(() => {
      localStorage.removeItem(KEYS.wizardDraft);
      return null;
    });
  }

  function getProfile() {
    return enqueue(() => readJson(KEYS.profile, null));
  }

  function saveProfile(profile) {
    const snapshot = clone(profile || {});
    snapshot.id = snapshot.id || 'profile';
    snapshot.updatedAt = new Date().toISOString();
    return enqueue(() => {
      writeJson(KEYS.profile, snapshot);
      queueUpsert('profiles', snapshot);
      emit('profile');
      return snapshot;
    });
  }

  function getSettings() {
    return enqueue(() => Object.assign({}, DEFAULT_SETTINGS, readJson(KEYS.settings, {})));
  }

  function saveSettings(settings) {
    const snapshot = Object.assign({}, DEFAULT_SETTINGS, settings);
    snapshot.updatedAt = new Date().toISOString();
    return enqueue(() => {
      writeJson(KEYS.settings, snapshot);
      const profile = readJson(KEYS.profile, null);
      if (profile) {
        profile.settings = snapshot;
        profile.updatedAt = snapshot.updatedAt;
        writeJson(KEYS.profile, profile);
        queueUpsert('profiles', profile);
      }
      emit('settings');
      return snapshot;
    });
  }

  function getSyncQueue() {
    return enqueue(() => readJson(KEYS.queue, []));
  }

  function clearSyncQueue() {
    return enqueue(() => {
      writeJson(KEYS.queue, []);
      return [];
    });
  }

  function getSyncMeta() {
    return enqueue(() => readJson(KEYS.syncMeta, { lastPulledAt: null }));
  }

  function getSyncChoice() {
    return enqueue(() => localStorage.getItem('tu_rutina_sync_choice'));
  }

  function setSyncChoice(value) {
    return enqueue(() => {
      if (value == null) localStorage.removeItem('tu_rutina_sync_choice');
      else localStorage.setItem('tu_rutina_sync_choice', value);
      return value;
    });
  }

  function saveSyncMeta(meta) {
    const snapshot = clone(meta);
    return enqueue(() => {
      writeJson(KEYS.syncMeta, snapshot);
      return snapshot;
    });
  }

  function snapshotAll() {
    return {
      version: readJson(KEYS.meta, { version: SCHEMA_VERSION }).version,
      routine: readJson(KEYS.routine, null),
      routines: readRoutineList(),
      sets: readJson(KEYS.sets, []),
      exercises: readJson(KEYS.exercises, []),
      bodyMetrics: readJson(KEYS.body, []),
      profile: readJson(KEYS.profile, null),
      settings: Object.assign({}, DEFAULT_SETTINGS, readJson(KEYS.settings, {})),
    };
  }

  function exportAll() {
    return enqueue(() => snapshotAll());
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') {
      return Promise.reject(new Error('El archivo no tiene un formato válido'));
    }
    return enqueue(() => {
      if ('routine' in data) {
        if (data.routine) writeActive(data.routine);
        else localStorage.removeItem(KEYS.routine);
      }
      if ('routines' in data && Array.isArray(data.routines)) writeJson(KEYS.routines, data.routines);
      if ('sets' in data) writeJson(KEYS.sets, Array.isArray(data.sets) ? data.sets : []);
      if ('exercises' in data) writeJson(KEYS.exercises, Array.isArray(data.exercises) ? data.exercises : []);
      if ('bodyMetrics' in data) writeJson(KEYS.body, Array.isArray(data.bodyMetrics) ? data.bodyMetrics : []);
      if ('profile' in data) writeJson(KEYS.profile, data.profile);
      if ('settings' in data && data.settings) writeJson(KEYS.settings, Object.assign({}, DEFAULT_SETTINGS, data.settings));
      emit('import');
      return snapshotAll();
    });
  }

  function applyRemoteSnapshot(data) {
    return enqueue(() => {
      if (data.routines) writeJson(KEYS.routines, data.routines);
      if (data.routine) writeJson(KEYS.routine, data.routine);
      if (data.exercises) writeJson(KEYS.exercises, data.exercises);
      if (data.sets) writeJson(KEYS.sets, data.sets);
      if (data.bodyMetrics) writeJson(KEYS.body, data.bodyMetrics);
      if (data.profile) writeJson(KEYS.profile, data.profile);
      if (data.settings) writeJson(KEYS.settings, Object.assign({}, DEFAULT_SETTINGS, data.settings));
      emit('import');
      return snapshotAll();
    });
  }

  function migrate() {
    return enqueue(() => {
      const meta = readJson(KEYS.meta, { version: 0 });
      if ((meta.version || 0) >= SCHEMA_VERSION) return meta;

      const routineRaw = localStorage.getItem(KEYS.routine);
      const logsRaw = localStorage.getItem(KEYS.logs);
      if (routineRaw != null && localStorage.getItem(KEYS.backupRoutine) == null) {
        localStorage.setItem(KEYS.backupRoutine, routineRaw);
      }
      if (logsRaw != null && localStorage.getItem(KEYS.backupLogs) == null) {
        localStorage.setItem(KEYS.backupLogs, logsRaw);
      }

      const result = migrateV1toV2({
        routine: readJson(KEYS.routine, null),
        logs: readJson(KEYS.logs, []),
        exercises: readJson(KEYS.exercises, []),
      });

      if (result.routine) writeActive(result.routine);
      writeJson(KEYS.exercises, result.exercises);
      writeJson(KEYS.sets, result.sets);

      const next = { version: SCHEMA_VERSION };
      writeJson(KEYS.meta, next);
      emit('routine');
      return next;
    });
  }

  return {
    getRoutine,
    getRoutines,
    saveRoutine,
    setActiveRoutine,
    deleteRoutine,
    getExercises,
    saveExercise,
    replaceExercises,
    deleteExercise,
    getSets,
    addSet,
    replaceSets,
    deleteSet,
    getBodyMetrics,
    addBodyMetric,
    deleteBodyMetric,
    getWizardDraft,
    saveWizardDraft,
    clearWizardDraft,
    getProfile,
    saveProfile,
    getSettings,
    saveSettings,
    getSyncQueue,
    clearSyncQueue,
    getSyncMeta,
    saveSyncMeta,
    getSyncChoice,
    setSyncChoice,
    exportAll,
    importAll,
    applyRemoteSnapshot,
    migrate,
  };
})();
