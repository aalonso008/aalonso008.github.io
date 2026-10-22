async function loadDefaultRoutine() {
  const res = await fetch('data/default-routine.json');
  if (!res.ok) throw new Error('No se pudo cargar la plantilla');
  return res.json();
}

function createEmptyRoutine() {
  return {
    version: 2,
    id: createId('rt'),
    title: 'Mi Rutina',
    subtitle: 'Personalizá tus días de entrenamiento',
    days: [
      {
        id: uid(),
        name: 'Día 1',
        short: 'D1',
        focus: '',
        tag: null,
        sections: [],
      },
    ],
  };
}

function usableExerciseName(value) {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  if (!text || lower === 'ejercicio' || lower === 'exercise') return '';
  return text;
}

function resolveSlot(slot, library) {
  const lib = (library || []).find((ex) => ex.id === slot.exerciseId);
  const sets = slot.sets && typeof slot.sets === 'object' ? slot.sets : parseSetsText(slot.sets);
  const name = usableExerciseName(lib && lib.name) || usableExerciseName(slot && slot.name) || 'Ejercicio';
  return {
    slotId: slot.id,
    exerciseId: slot.exerciseId,
    sets,
    name,
    muscleGroup: (lib && lib.muscleGroup) || (slot && slot.muscleGroup) || 'Otro',
    muscles: (lib && lib.muscles && lib.muscles.length ? lib.muscles : (slot && slot.muscles) || []),
    tip: (lib && lib.tip) || (slot && slot.tip) || '',
    linkUrl: (lib && lib.linkUrl) || (slot && slot.linkUrl) || '',
    linkLabel: (lib && lib.linkLabel) || (slot && slot.linkLabel) || '',
    archived: !!(lib && lib.archived),
  };
}

function rememberExercise(byId, source) {
  const name = usableExerciseName(source && source.name);
  const id = source && (source.id || source.exerciseId);
  if (!id || !name) return false;
  const prev = byId.get(id);
  if (!prev) {
    byId.set(id, {
      id,
      name,
      muscleGroup: source.muscleGroup || 'Otro',
      muscles: source.muscles || [],
      tip: source.tip || '',
      linkUrl: source.linkUrl || '',
      linkLabel: source.linkLabel || '',
      archived: !!source.archived,
      catalogKey: source.catalogKey || source.key || '',
    });
    return true;
  }
  if (usableExerciseName(prev.name)) return false;
  prev.name = name;
  if (!prev.muscleGroup && source.muscleGroup) prev.muscleGroup = source.muscleGroup;
  if ((!prev.muscles || !prev.muscles.length) && source.muscles) prev.muscles = source.muscles;
  if (!prev.tip && source.tip) prev.tip = source.tip;
  if (!prev.linkUrl && source.linkUrl) prev.linkUrl = source.linkUrl;
  if (!prev.linkLabel && source.linkLabel) prev.linkLabel = source.linkLabel;
  return true;
}

function harvestRoutineNames(routine, byId) {
  let changed = false;
  (routine && routine.exercises ? routine.exercises : []).forEach((exercise) => {
    if (rememberExercise(byId, exercise)) changed = true;
  });
  ((routine && routine.days) || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        if (rememberExercise(byId, {
          id: slot.exerciseId || slot.id,
          name: slot.name || slot.ex,
          muscleGroup: slot.muscleGroup,
          muscles: slot.muscles,
          tip: slot.tip,
          linkUrl: slot.linkUrl,
          linkLabel: slot.linkLabel,
        })) changed = true;
      });
    });
  });
  return changed;
}

async function repairExerciseLibrary() {
  if (typeof Storage === 'undefined') return;
  const [routines, library] = await Promise.all([Storage.getRoutines(), Storage.getExercises()]);
  const byId = new Map((library || []).map((exercise) => [exercise.id, exercise]));
  let changed = false;
  (routines || []).forEach((routine) => {
    if (harvestRoutineNames(routine, byId)) changed = true;
  });
  try {
    const backupRaw = localStorage.getItem('tu_rutina_data_backup_v1');
    if (backupRaw) {
      const backup = JSON.parse(backupRaw);
      if (harvestRoutineNames(backup, byId)) changed = true;
    }
  } catch (error) {
    /* El respaldo viejo no se pudo leer. */
  }
  let template = null;
  try {
    const response = await fetch('data/default-routine.json');
    if (response.ok) template = await response.json();
  } catch (error) {
    template = null;
  }
  const templateById = new Map(((template && template.exercises) || []).map((exercise) => [exercise.id, exercise]));
  let catalog = [];
  try {
    const response = await fetch('data/exercise-catalog.json');
    if (response.ok) catalog = await response.json();
  } catch (error) {
    catalog = [];
  }
  const catalogByKey = new Map((catalog || []).map((exercise) => [exercise.key, exercise]));
  (routines || []).forEach((routine) => {
    ((routine && routine.days) || []).forEach((day) => {
      (day.sections || []).forEach((section) => {
        (section.exercises || []).forEach((slot) => {
          const templated = templateById.get(slot.exerciseId);
          if (templated && rememberExercise(byId, templated)) changed = true;
          const cat = catalogByKey.get(slot.catalogKey || slot.exerciseId);
          if (cat && rememberExercise(byId, {
            id: slot.exerciseId,
            name: cat.name,
            muscleGroup: cat.muscleGroup,
            muscles: cat.primary || [],
            tip: cat.tip || '',
            linkUrl: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cat.name + ' técnica'),
            linkLabel: cat.linkLabel || '',
            catalogKey: cat.key,
          })) changed = true;
        });
      });
    });
  });
  if (changed) await Storage.replaceExercises([...byId.values()]);
  const repaired = [...byId.values()];
  for (const routine of routines || []) {
    let routineChanged = false;
    const slotIds = [];
    (routine.days || []).forEach((day) => {
      (day.sections || []).forEach((section) => {
        (section.exercises || []).forEach((slot) => {
          if (slot.exerciseId) slotIds.push(slot.exerciseId);
          const lib = repaired.find((exercise) => exercise.id === slot.exerciseId);
          const name = usableExerciseName(lib && lib.name);
          if (name && slot.name !== name) {
            slot.name = name;
            if (lib.muscleGroup) slot.muscleGroup = lib.muscleGroup;
            routineChanged = true;
          }
        });
      });
    });
    const generic = !usableExerciseName(routine.title) || routine.title === 'Mi Rutina' || routine.title === 'Rutina';
    const known = slotIds.filter((id) => templateById.has(id));
    if (
      template &&
      generic &&
      slotIds.length &&
      known.length === slotIds.length &&
      (routine.days || []).length === (template.days || []).length
    ) {
      routine.title = template.title;
      if (!routine.subtitle && template.subtitle) routine.subtitle = template.subtitle;
      routineChanged = true;
    }
    if (routineChanged) await Storage.saveRoutine(routine);
  }
}

function collectRoutineExercises(routine, library) {
  const list = [];
  const seen = new Set();
  ((routine && routine.days) || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        if (!slot.exerciseId || seen.has(slot.exerciseId)) return;
        seen.add(slot.exerciseId);
        list.push(resolveSlot(slot, library));
      });
    });
  });
  (library || []).forEach((ex) => {
    if (!ex || !ex.id || seen.has(ex.id) || ex.deleted) return;
    seen.add(ex.id);
    list.push(resolveSlot({ id: ex.id, exerciseId: ex.id, sets: parseSetsText('') }, library));
  });
  return list;
}

function cloneRoutine(routine) {
  return JSON.parse(JSON.stringify(routine));
}

async function adoptTemplate(data) {
  const incoming = data.exercises || [];
  const current = await Storage.getExercises();
  const byName = new Map(current.map((ex) => [normalizeName(ex.name), ex]));
  const idMap = {};
  incoming.forEach((ex) => {
    const hit = byName.get(normalizeName(ex.name));
    if (hit) {
      idMap[ex.id] = hit.id;
      return;
    }
    current.push(ex);
    byName.set(normalizeName(ex.name), ex);
    idMap[ex.id] = ex.id;
  });
  if (incoming.length) await Storage.replaceExercises(current);

  const routine = cloneRoutine(data);
  delete routine.exercises;
  routine.version = 2;
  routine.id = createId('rt');
  (routine.days || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        if (idMap[slot.exerciseId]) slot.exerciseId = idMap[slot.exerciseId];
      });
    });
  });
  return routine;
}
