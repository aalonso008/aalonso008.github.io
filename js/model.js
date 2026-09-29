/* Funciones puras del modelo v2. Sirven en el navegador (globales) y en node --test. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Glúteos', 'Core', 'Otro'];

  const DEFAULT_SETTINGS = {
    increments: {
      Piernas: 5,
      Glúteos: 5,
      Pecho: 2.5,
      Espalda: 2.5,
      Hombros: 2,
      Bíceps: 2,
      Tríceps: 2,
      Core: 2,
      Otro: 2.5,
    },
    defaultRestSec: 90,
    cycleStart: '',
    unit: 'kg',
    vibrate: true,
  };

  const LB_PER_KG = 2.2046226218;

  function createId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10);
  }

  function uid() {
    return createId('id');
  }

  function normalizeName(name) {
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inferMuscleGroup(ex) {
    const text = normalizeName(
      [ex && ex.muscleGroup, ...(ex && ex.muscles ? ex.muscles : []), ex && ex.name].filter(Boolean).join(' ')
    );
    if (/pecho|pectoral/.test(text)) return 'Pecho';
    if (/dorsal|espalda|romboide|trapecio/.test(text)) return 'Espalda';
    if (/deltoid|hombro|manguito/.test(text)) return 'Hombros';
    if (/biceps|braquial/.test(text)) return 'Bíceps';
    if (/triceps/.test(text)) return 'Tríceps';
    if (/abdomen|oblicuo|core|lumbar/.test(text)) return 'Core';
    if (/gluteo/.test(text) && !/cuadr|isquio|gemelo|femoral|pierna|aductor/.test(text)) return 'Glúteos';
    if (/cuadr|isquio|gemelo|femoral|pierna|gluteo|aductor/.test(text)) return 'Piernas';
    return 'Otro';
  }

  function parseSetsText(text) {
    const raw = String(text || '').trim();
    const fallback = { count: 3, repMin: 8, repMax: 12, restSec: 90, note: raw };
    if (!raw) return { count: 3, repMin: 8, repMax: 12, restSec: 90, note: '' };
    if (typeof text === 'object') return text;

    let restSec = 90;
    const restSecMatch = raw.match(/(\d+)\s*s(?:eg(?:undos)?)?\b/i);
    const restMinMatch = raw.match(/(\d+)\s*min\b/i);
    if (restSecMatch) restSec = +restSecMatch[1];
    else if (restMinMatch) restSec = +restMinMatch[1] * 60;

    const match = raw.match(/(\d+)\s*(?:series\s*)?(?:x|×|de)\s*(\d+)(?:\s*[–\-]\s*(\d+))?/i);
    if (!match) return fallback;
    return {
      count: +match[1],
      repMin: +match[2],
      repMax: match[3] ? +match[3] : +match[2],
      restSec,
      note: '',
    };
  }

  function formatSets(sets) {
    if (!sets) return '';
    if (typeof sets === 'string') return sets;
    const reps = sets.repMax != null && sets.repMax !== sets.repMin ? `${sets.repMin}–${sets.repMax}` : String(sets.repMin);
    const rest = sets.restSec ? ` · ${sets.restSec}s descanso` : '';
    const note = sets.note ? ` · ${sets.note}` : '';
    return `${sets.count} series × ${reps} reps${rest}${note}`;
  }

  function isoDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayIso(now) {
    return isoDate(now || new Date());
  }

  function formatDisplayDate(iso) {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return String(iso || '');
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  }

  function parseLegacyDate(log) {
    if (log && log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date)) return log.date;
    const parts = String((log && log.date) || '').split('/');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      let year = +parts[2];
      if (year < 100) year += 2000;
      return `${year}-${String(+parts[1]).padStart(2, '0')}-${String(+parts[0]).padStart(2, '0')}`;
    }
    if (log && log.ts) {
      const fromTs = isoDate(new Date(log.ts));
      if (fromTs) return fromTs;
    }
    return todayIso();
  }

  function isV2Set(set) {
    return set && set.exerciseId && set.weight != null && set.setNumber != null && set.date && /^\d{4}-\d{2}-\d{2}$/.test(set.date);
  }

  function routineIsV2(routine) {
    if (!routine || !routine.days) return false;
    if ((routine.version || 0) >= 2) {
      const slot = firstSlot(routine);
      return !slot || !!slot.exerciseId;
    }
    const slot = firstSlot(routine);
    return !!(slot && slot.exerciseId && slot.sets && typeof slot.sets === 'object');
  }

  function firstSlot(routine) {
    for (const day of routine.days || []) {
      for (const section of day.sections || []) {
        if (section.exercises && section.exercises.length) return section.exercises[0];
      }
    }
    return null;
  }

  function migrateV1toV2(input) {
    const routineIn = input && input.routine;
    const logs = (input && input.logs) || [];
    const library = ((input && input.exercises) || []).map((ex) => Object.assign({}, ex));
    const byName = new Map();
    library.forEach((ex) => byName.set(normalizeName(ex.name), ex));

    function ensureExercise(source, archived) {
      const name = String((source && (source.name || source.ex)) || '').trim();
      const key = normalizeName(name);
      if (!key) return null;
      const existing = byName.get(key);
      if (existing) return existing;
      const created = {
        id: createId('ex'),
        name,
        muscleGroup: inferMuscleGroup(source || {}),
        muscles: (source && source.muscles) || [],
        tip: (source && source.tip) || '',
        linkUrl: (source && source.linkUrl) || '',
        linkLabel: (source && source.linkLabel) || '',
        archived: !!archived,
        updatedAt: new Date().toISOString(),
      };
      library.push(created);
      byName.set(key, created);
      return created;
    }

    let routine = routineIn ? JSON.parse(JSON.stringify(routineIn)) : null;
    if (routine && !routineIsV2(routine)) {
      routine.version = 2;
      if (!routine.id) routine.id = createId('rt');
      routine.updatedAt = new Date().toISOString();
      (routine.days || []).forEach((day) => {
        (day.sections || []).forEach((section) => {
          (section.exercises || []).forEach((ex) => {
            const lib = ensureExercise(ex, false);
            ex.exerciseId = lib ? lib.id : ex.exerciseId;
            ex.sets = typeof ex.sets === 'object' && ex.sets ? ex.sets : parseSetsText(ex.sets);
            delete ex.name;
            delete ex.tip;
            delete ex.muscles;
            delete ex.linkUrl;
            delete ex.linkLabel;
            delete ex.muscle;
          });
        });
      });
    } else if (routine) {
      routine.version = 2;
      if (!routine.id) routine.id = createId('rt');
    }

    const sets = [];
    logs.forEach((log) => {
      if (isV2Set(log)) {
        sets.push(log);
        return;
      }
      const lib = ensureExercise({ name: log.ex, muscles: [] }, true);
      if (!lib) return;
      const count = Math.max(1, parseInt(log.series, 10) || 1);
      const reps = parseInt(log.reps, 10) || 0;
      const weight = parseFloat(String(log.peso).replace(',', '.')) || 0;
      const date = parseLegacyDate(log);
      const sessionId = `ses_${date}_${log.id || log.ts || createId('old')}`;
      const baseTs = log.ts || Date.now();
      for (let n = 1; n <= count; n += 1) {
        sets.push({
          id: `set_${log.id || baseTs}_${n}`,
          exerciseId: lib.id,
          sessionId,
          date,
          setNumber: n,
          weight,
          reps,
          rpe: null,
          note: n === 1 ? log.nota || '' : '',
          ts: baseTs + n,
          updatedAt: new Date(baseTs).toISOString(),
        });
      }
    });

    return { routine, exercises: library, sets };
  }

  function toDisplayWeight(kg, unit) {
    const n = Number(kg);
    if (!Number.isFinite(n)) return 0;
    const shown = unit === 'lb' ? n * LB_PER_KG : n;
    return Math.round(shown * 10) / 10;
  }

  function fromDisplayWeight(value, unit) {
    const n = parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    const kg = unit === 'lb' ? n / LB_PER_KG : n;
    return Math.round(kg * 1000) / 1000;
  }

  function formatWeight(kg, unit) {
    const n = toDisplayWeight(kg, unit);
    const text = Number.isInteger(n) ? String(n) : String(n);
    return `${text} ${unit === 'lb' ? 'lb' : 'kg'}`;
  }

  function incrementFor(muscleGroup, exerciseName, settings) {
    const table = (settings && settings.increments) || DEFAULT_SETTINGS.increments;
    const dumbbell = /mancuerna|dumbbell/.test(normalizeName(exerciseName));
    if (dumbbell && ['Hombros', 'Bíceps', 'Tríceps', 'Core'].includes(muscleGroup)) return 1;
    return table[muscleGroup] != null ? table[muscleGroup] : table.Otro || 2.5;
  }

  function weekdayIndex(days, date) {
    const names = [
      ['domingo', 'dom'],
      ['lunes', 'lun'],
      ['martes', 'mar'],
      ['miercoles', 'mie'],
      ['jueves', 'jue'],
      ['viernes', 'vie'],
      ['sabado', 'sab'],
    ];
    const pair = names[(date || new Date()).getDay()];
    return (days || []).findIndex((day) => {
      const name = normalizeName(day.name);
      const short = normalizeName(day.short);
      return name.startsWith(pair[0]) || short === pair[1] || name.startsWith(pair[1]);
    });
  }

  function roundTo(value, step) {
    const s = step || 0.5;
    return Math.round(value / s) * s;
  }

  function trimNum(n) {
    const rounded = Math.round(Number(n) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  return {
    MUSCLE_GROUPS,
    DEFAULT_SETTINGS,
    LB_PER_KG,
    createId,
    uid,
    normalizeName,
    inferMuscleGroup,
    parseSetsText,
    formatSets,
    isoDate,
    todayIso,
    formatDisplayDate,
    parseLegacyDate,
    migrateV1toV2,
    routineIsV2,
    toDisplayWeight,
    fromDisplayWeight,
    formatWeight,
    incrementFor,
    weekdayIndex,
    roundTo,
    trimNum,
  };
});
