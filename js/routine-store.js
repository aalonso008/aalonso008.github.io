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

function resolveSlot(slot, library) {
  const lib = (library || []).find((ex) => ex.id === slot.exerciseId);
  const sets = slot.sets && typeof slot.sets === 'object' ? slot.sets : parseSetsText(slot.sets);
  return {
    slotId: slot.id,
    exerciseId: slot.exerciseId,
    sets,
    name: (lib && lib.name) || 'Ejercicio',
    muscleGroup: (lib && lib.muscleGroup) || 'Otro',
    muscles: (lib && lib.muscles) || [],
    tip: (lib && lib.tip) || '',
    linkUrl: (lib && lib.linkUrl) || '',
    linkLabel: (lib && lib.linkLabel) || '',
    archived: !!(lib && lib.archived),
  };
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
