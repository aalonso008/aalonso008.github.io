/* Motor de rutinas. Puro: no toca el DOM ni Storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DAY_LABELS = {
    lun: ['Lunes', 'Lun'],
    mar: ['Martes', 'Mar'],
    mie: ['Miércoles', 'Mié'],
    jue: ['Jueves', 'Jue'],
    vie: ['Viernes', 'Vie'],
    sab: ['Sábado', 'Sáb'],
    dom: ['Domingo', 'Dom'],
  };
  const DAY_ORDER = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  const TEMPLATES = {
    fullA: ['squat', 'horizontal_push', 'horizontal_pull', 'glute_iso', 'core'],
    fullB: ['hinge', 'incline_push', 'vertical_pull', 'lunge', 'lateral_raise'],
    fullC: ['squat', 'vertical_push', 'horizontal_pull', 'hamstring_iso', 'biceps'],
    upperA: ['incline_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'lateral_raise', 'biceps', 'triceps'],
    upperB: ['horizontal_push', 'vertical_pull', 'horizontal_pull', 'rear_delt', 'lateral_raise', 'triceps', 'biceps'],
    lowerA: ['squat', 'hinge', 'lunge', 'hamstring_iso', 'calves', 'core'],
    lowerB: ['hinge', 'lunge', 'quad_iso', 'glute_iso', 'calves', 'core'],
    push: ['horizontal_push', 'incline_push', 'vertical_push', 'chest_fly', 'lateral_raise', 'triceps'],
    pull: ['vertical_pull', 'horizontal_pull', 'horizontal_pull', 'rear_delt', 'biceps', 'biceps'],
    legs: ['squat', 'hinge', 'lunge', 'quad_iso', 'hamstring_iso', 'calves'],
  };
  const FOCUS = {
    fullA: 'Cuerpo completo A',
    fullB: 'Cuerpo completo B',
    fullC: 'Cuerpo completo C',
    upperA: 'Tren superior A',
    upperB: 'Tren superior B',
    lowerA: 'Tren inferior A',
    lowerB: 'Tren inferior B',
    push: 'Empuje',
    pull: 'Tracción',
    legs: 'Piernas',
  };
  const ALTERNATES = {
    squat: ['lunge', 'quad_iso'],
    hinge: ['glute_iso', 'hamstring_iso'],
    lunge: ['squat', 'quad_iso'],
    horizontal_push: ['incline_push'],
    incline_push: ['horizontal_push'],
    vertical_push: ['lateral_raise'],
    horizontal_pull: ['vertical_pull'],
    vertical_pull: ['horizontal_pull'],
    chest_fly: ['incline_push'],
    lateral_raise: ['vertical_push'],
    rear_delt: ['horizontal_pull'],
    biceps: ['vertical_pull'],
    triceps: ['horizontal_push'],
    quad_iso: ['lunge'],
    hamstring_iso: ['hinge'],
    glute_iso: ['hinge'],
    calves: ['squat'],
    core: ['carry'],
    carry: ['core'],
  };
  const PRIORITY_MUSCLES = {
    chest: ['Pecho'],
    upper_chest: ['Pecho'],
    back: ['Espalda'],
    shoulders: ['Hombros'],
    arms: ['Bíceps', 'Tríceps'],
    legs: ['Piernas'],
    glutes: ['Glúteos'],
    core: ['Core'],
  };
  const PRIORITY_PATTERNS = {
    chest: ['horizontal_push', 'incline_push', 'chest_fly'],
    upper_chest: ['incline_push', 'horizontal_push'],
    back: ['horizontal_pull', 'vertical_pull'],
    shoulders: ['vertical_push', 'lateral_raise', 'rear_delt'],
    arms: ['biceps', 'triceps'],
    legs: ['squat', 'lunge', 'quad_iso'],
    glutes: ['hinge', 'glute_iso'],
    core: ['core'],
  };
  const RANGES = {
    beginner: { min: 6, max: 10, priority: 12 },
    intermediate: { min: 10, max: 16, priority: 20 },
    advanced: { min: 12, max: 20, priority: 22 },
  };
  const SESSION_MAX = { '30-45': 5, '45-60': 6, '60-75': 7, '75-90': 8 };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(text) {
    let h = 2166136261;
    const value = String(text || '');
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeId(rng, prefix) {
    return prefix + '_' + Math.floor(rng() * 0xffffffff).toString(36);
  }

  function sessionExerciseLimit(sessionMinutes) {
    return SESSION_MAX[sessionMinutes] || 6;
  }

  function priorityMuscles(priorities) {
    const muscles = [];
    (priorities || []).forEach((item) => {
      (PRIORITY_MUSCLES[item] || []).forEach((muscle) => {
        if (!muscles.includes(muscle)) muscles.push(muscle);
      });
    });
    return muscles;
  }

  function chooseSplit(answers) {
    const days = Number(answers.daysPerWeek) || 3;
    const level = answers.level || 'beginner';
    const strength = answers.goal === 'strength';
    if (days <= 2) return { name: 'Full Body', keys: ['fullA', 'fullB'], warn: null };
    if (days === 3) {
      if (level === 'advanced' && !strength) return { name: 'Push/Pull/Legs', keys: ['push', 'pull', 'legs'], warn: null };
      return { name: 'Full Body', keys: ['fullA', 'fullB', 'fullC'], warn: null };
    }
    if (days === 4) return { name: 'Upper/Lower', keys: ['upperA', 'lowerA', 'upperB', 'lowerB'], warn: null };
    if (days === 5) {
      if (level === 'advanced' && !strength) return { name: 'Push/Pull/Legs + Upper/Lower', keys: ['push', 'pull', 'legs', 'upperA', 'lowerA'], warn: null };
      return { name: 'Upper/Lower + Push/Pull/Legs', keys: ['upperA', 'lowerA', 'push', 'pull', 'legs'], warn: null };
    }
    return {
      name: 'Push/Pull/Legs',
      keys: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
      warn: level === 'beginner' ? 'Seis días es mucho si estás empezando. Cada día queda un poco más corto.' : null,
    };
  }

  function orderSlots(patterns, priorities) {
    const preferred = new Set();
    (priorities || []).forEach((item) => (PRIORITY_PATTERNS[item] || []).forEach((pattern) => preferred.add(pattern)));
    const front = [];
    const rest = [];
    patterns.forEach((pattern) => {
      if (preferred.has(pattern)) front.push(pattern);
      else rest.push(pattern);
    });
    return front.concat(rest);
  }

  function prescription(goal, type, level, firstCompound) {
    const table = {
      hypertrophy: { compound: [4, 6, 10, 120], isolation: [3, 10, 15, 75] },
      strength: { compound: [firstCompound ? 5 : 3, firstCompound ? 3 : 6, firstCompound ? 6 : 8, 180], isolation: [3, 8, 12, 90] },
      fat_loss: { compound: [3, 6, 10, 90], isolation: [3, 10, 15, 60] },
      recomp: { compound: [4, 6, 10, 120], isolation: [3, 10, 15, 75] },
      general: { compound: [3, 8, 12, 90], isolation: [3, 12, 15, 60] },
    };
    const row = (table[goal] || table.hypertrophy)[type === 'isolation' ? 'isolation' : 'compound'];
    let count = row[0];
    let repMin = row[1];
    const repMax = row[2];
    const restSec = row[3];
    if (level === 'beginner') {
      count = Math.max(2, count - 1);
      repMin = Math.max(6, repMin);
    }
    if (level === 'advanced' && firstCompound && type !== 'isolation') count += 1;
    return { count, repMin, repMax, restSec, note: '' };
  }

  function candidates(catalog, pattern, answers, used, allowHard, allowRepeat) {
    return catalog.filter((exercise) => {
      if (exercise.pattern !== pattern) return false;
      if (!exercise.equipment.includes(answers.equipment)) return false;
      if ((exercise.avoidIf || []).some((item) => (answers.limitations || []).includes(item))) return false;
      if (!allowHard && answers.level === 'beginner' && exercise.difficulty >= 3) return false;
      if (!allowRepeat && used.has(exercise.key)) return false;
      return true;
    });
  }

  function scoreExercise(exercise, answers, dayFatigue, slotIndex, rng) {
    let score = rng() * 1.8;
    const priorities = answers.priorities || [];
    if ((exercise.emphasis || []).some((tag) => priorities.includes(tag) || (tag === 'upper_chest' && priorities.includes('upper_chest')))) score += 3;
    if (exercise.muscleGroup === 'Pecho' && priorities.includes('chest')) score += 3;
    if (exercise.muscleGroup === 'Espalda' && priorities.includes('back')) score += 3;
    if (exercise.muscleGroup === 'Hombros' && priorities.includes('shoulders')) score += 3;
    if ((exercise.muscleGroup === 'Bíceps' || exercise.muscleGroup === 'Tríceps') && priorities.includes('arms')) score += 3;
    if (exercise.muscleGroup === 'Piernas' && priorities.includes('legs')) score += 3;
    if (exercise.muscleGroup === 'Glúteos' && priorities.includes('glutes')) score += 3;
    if (exercise.muscleGroup === 'Core' && priorities.includes('core')) score += 3;
    if (exercise.type === 'compound' && slotIndex === 0) score += 2;
    if (exercise.fatigue === 3 && dayFatigue) score -= 2;
    if (answers.goal === 'strength' && exercise.difficulty >= 2 && exercise.type === 'compound') score += 2;
    return score;
  }

  function pickExercise(catalog, pattern, answers, used, dayFatigue, slotIndex, rng) {
    const queue = [pattern].concat(ALTERNATES[pattern] || []);
    const passes = [
      { hard: false, repeat: false },
      { hard: true, repeat: false },
      { hard: false, repeat: true },
      { hard: true, repeat: true },
    ];
    for (let pass = 0; pass < passes.length; pass += 1) {
      for (let i = 0; i < queue.length; i += 1) {
        const pool = candidates(catalog, queue[i], answers, used, passes[pass].hard, passes[pass].repeat);
        if (!pool.length) continue;
        const ranked = pool.map((exercise) => ({ exercise, score: scoreExercise(exercise, answers, dayFatigue, slotIndex, rng) }));
        ranked.sort((a, b) => b.score - a.score);
        return ranked[0].exercise;
      }
    }
    return null;
  }

  function sectionFor(exercise) {
    if (exercise.pattern === 'cardio') return 'Cardio';
    if (exercise.pattern === 'core' || exercise.pattern === 'carry') return 'Core';
    if (exercise.pattern === 'biceps' || exercise.pattern === 'triceps') return 'Brazos';
    if (exercise.type === 'isolation') return 'Accesorios';
    return 'Compuestos';
  }

  function countVolume(days) {
    const totals = {};
    days.forEach((day) => {
      day.sections.forEach((section) => {
        section.exercises.forEach((slot) => {
          if (!slot.muscleGroup || slot.muscleGroup === 'Otro' || slot.pattern === 'cardio') return;
          totals[slot.muscleGroup] = (totals[slot.muscleGroup] || 0) + slot.sets.count;
        });
      });
    });
    return totals;
  }

  function eachSlot(days, visit) {
    for (let d = 0; d < days.length; d += 1) {
      for (let s = 0; s < days[d].sections.length; s += 1) {
        const exercises = days[d].sections[s].exercises;
        for (let e = exercises.length - 1; e >= 0; e -= 1) {
          if (visit(days[d], exercises[e], exercises, e) === false) return;
        }
      }
    }
  }

  function dayCount(day) {
    return day.sections.reduce((sum, section) => sum + section.exercises.length, 0);
  }

  function tuneVolume(days, level, muscles) {
    const range = RANGES[level] || RANGES.beginner;
    const priority = new Set(muscles);
    const capFor = (group) => (priority.has(group) ? range.priority : range.max);
    for (let pass = 0; pass < 12; pass += 1) {
      const totals = countVolume(days);
      let changed = false;
      Object.keys(totals).forEach((group) => {
        while (totals[group] > capFor(group)) {
          let done = false;
          eachSlot(days, (day, slot, list, index) => {
            if (done || slot.muscleGroup !== group) return;
            if (slot.sets.count > 2) {
              slot.sets.count -= 1;
              totals[group] -= 1;
              done = true;
              changed = true;
              return false;
            }
            if (slot.type === 'isolation' && dayCount(day) > 3) {
              totals[group] -= slot.sets.count;
              list.splice(index, 1);
              done = true;
              changed = true;
              return false;
            }
          });
          if (!done) break;
        }
      });
      const afterCut = countVolume(days);
      Object.keys(afterCut).forEach((group) => {
        while (afterCut[group] < range.min) {
          let done = false;
          eachSlot(days, (_day, slot) => {
            if (done || slot.muscleGroup !== group || slot.sets.count >= 8) return;
            if (afterCut[group] + 1 > capFor(group) + 2) return;
            slot.sets.count += 1;
            afterCut[group] += 1;
            done = true;
            changed = true;
            return false;
          });
          if (!done) break;
        }
      });
      if (!changed) break;
    }
    const totals = countVolume(days);
    Object.keys(totals).forEach((group) => {
      const floor = range.min - 2;
      if (totals[group] >= floor) return;
      if (priority.has(group)) return;
      eachSlot(days, (day, slot, list, index) => {
        if (slot.muscleGroup !== group || dayCount(day) <= 3) return;
        list.splice(index, 1);
      });
    });
    days.forEach((day) => {
      day.sections = day.sections.filter((section) => section.exercises.length);
    });
  }

  function generateRoutine(answers, catalog, options) {
    const opts = options || {};
    const seed = opts.seed == null ? hashSeed(JSON.stringify(answers || {})) : opts.seed >>> 0;
    const rng = mulberry32(seed);
    const warnings = [];
    const split = chooseSplit(answers || {});
    if (split.warn) warnings.push(split.warn);
    const orderedDays = DAY_ORDER.filter((day) => (answers.preferredDays || []).includes(day));
    const limit = sessionExerciseLimit(answers.sessionMinutes);
    const weekUsed = new Set();
    const priorities = (answers.priorities || []).filter((item) => item !== 'balanced');
    const muscles = priorityMuscles(priorities);
    const days = split.keys.map((key, index) => {
      const patterns = orderSlots(TEMPLATES[key].slice(), priorities).slice(0, limit);
      const dayFatigue = { value: false };
      const dayUsed = new Set();
      const picked = [];
      patterns.forEach((pattern, slotIndex) => {
        const blocked = new Set(dayUsed);
        if (answers.goal !== 'strength') weekUsed.forEach((item) => blocked.add(item));
        const exercise = pickExercise(catalog, pattern, answers, blocked, dayFatigue.value, slotIndex, rng);
        if (!exercise) {
          warnings.push('No encontramos un ejercicio para ' + pattern + ' con tu equipo y tus molestias.');
          return;
        }
        weekUsed.add(exercise.key);
        dayUsed.add(exercise.key);
        if (exercise.fatigue === 3) dayFatigue.value = true;
        const firstCompound = !picked.some((item) => item.type !== 'isolation');
        picked.push({
          exercise,
          sets: prescription(answers.goal, exercise.type, answers.level, firstCompound && exercise.type !== 'isolation'),
        });
      });
      if ((answers.cardio === 'little' && index < 2) || answers.cardio === 'regular') {
        if (picked.length >= limit) picked.pop();
        const cardio = pickExercise(catalog, 'cardio', answers, new Set(), false, 9, rng);
        if (cardio) {
          const minutes = answers.cardio === 'regular' ? '20–30 min' : '15–20 min';
          picked.push({
            exercise: cardio,
            sets: { count: 1, repMin: 1, repMax: 1, restSec: 0, note: minutes },
          });
        }
      }
      const label = orderedDays[index] ? DAY_LABELS[orderedDays[index]] : ['Día ' + (index + 1), 'D' + (index + 1)];
      const sections = [];
      picked.forEach((item) => {
        const labelName = sectionFor(item.exercise);
        let section = sections.find((entry) => entry.label === labelName);
        if (!section) {
          section = { id: makeId(rng, 'id'), label: labelName, exercises: [] };
          sections.push(section);
        }
        section.exercises.push({
          id: makeId(rng, 'id'),
          exerciseId: item.exercise.key,
          catalogKey: item.exercise.key,
          muscleGroup: item.exercise.muscleGroup,
          type: item.exercise.type,
          pattern: item.exercise.pattern,
          sets: item.sets,
        });
      });
      const priorityHere = sections.some((section) => section.exercises.some((slot) => muscles.includes(slot.muscleGroup)));
      return {
        id: makeId(rng, 'id'),
        name: label[0],
        short: label[1],
        focus: FOCUS[key] || '',
        tag: priorityHere && muscles.length ? { text: 'Prioridad', bg: '#1a2540', color: '#57c8ff' } : null,
        sections,
      };
    });

    tuneVolume(days, answers.level || 'beginner', muscles);
    days.forEach((day) => {
      if (dayCount(day) < 3) warnings.push(day.name + ' quedó con pocos ejercicios por el equipo o las molestias.');
    });

    const weeklyVolume = countVolume(days);
    const goalNames = {
      hypertrophy: '💪 Hipertrofia',
      strength: '🏋️ Fuerza',
      fat_loss: '🔥 Definición',
      recomp: '⚖️ Recomposición',
      general: '🙂 Salud',
    };
    const priorityNames = {
      chest: 'Pecho',
      upper_chest: 'Pecho superior',
      back: 'Espalda',
      shoulders: 'Hombros',
      arms: 'Brazos',
      legs: 'Piernas',
      glutes: 'Glúteos',
      core: 'Core',
    };
    const priorityText = priorities.map((item) => priorityNames[item]).filter(Boolean).join(', ');
    const reasons = [
      'Elegimos ' + split.name + ' porque entrenás ' + (answers.daysPerWeek || days.length) + ' días por semana.',
    ];
    if (priorityText) reasons.push(priorityText + ' va primero en los días que lo trabajan, porque lo marcaste como prioridad.');
    if ((answers.limitations || []).length && !(answers.limitations || []).includes('none')) {
      reasons.push('Dejamos afuera los ejercicios que más cargan las molestias que marcaste.');
    }
    const reps = answers.goal === 'strength' ? '3–6 en los básicos' : answers.goal === 'general' ? '8–12' : '6–10';
    reasons.push('En los compuestos usamos reps de ' + reps + ' para este objetivo.');
    if (answers.cardio === 'regular' && (answers.goal === 'fat_loss' || answers.goal === 'recomp')) {
      reasons.push('Sumamos cardio corto y, si podés, 8 a 10 mil pasos por día.');
    }

    const routine = {
      version: 2,
      id: makeId(rng, 'rt'),
      title: (goalNames[answers.goal] || 'Rutina') + ' · ' + (answers.daysPerWeek || days.length) + ' días',
      subtitle: split.name + (priorityText ? ' · Prioridad: ' + priorityText : ''),
      days,
      generatedFrom: {
        answers: answers,
        seed,
        version: 1,
        createdAt: '',
      },
    };
    return {
      routine,
      meta: { split: split.name, weeklyVolume, warnings, seed, reasons, limit },
    };
  }

  return { generateRoutine, sessionExerciseLimit, priorityMuscles };
});
