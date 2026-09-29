const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../data/exercise-catalog.json');
require('../js/routine-generator.js');

const goals = ['hypertrophy', 'strength', 'fat_loss', 'recomp', 'general'];
const levels = ['beginner', 'intermediate', 'advanced'];
const dayCounts = [2, 3, 4, 5, 6];
const equipments = ['full_gym', 'basic_gym', 'home_dumbbells', 'bodyweight'];
const ranges = {
  beginner: { min: 6, max: 10, priority: 12 },
  intermediate: { min: 10, max: 16, priority: 20 },
  advanced: { min: 12, max: 20, priority: 22 },
};
const priorityMuscles = {
  chest: ['Pecho'],
  upper_chest: ['Pecho'],
  back: ['Espalda'],
  shoulders: ['Hombros'],
  arms: ['Bíceps', 'Tríceps'],
  legs: ['Piernas'],
  glutes: ['Glúteos'],
  core: ['Core'],
};

function answersFor(goal, level, days, equipment, extra) {
  const presets = {
    2: ['lun', 'jue'],
    3: ['lun', 'mie', 'vie'],
    4: ['lun', 'mar', 'jue', 'vie'],
    5: ['lun', 'mar', 'mie', 'jue', 'vie'],
    6: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
  };
  return Object.assign({
    goal,
    level,
    daysPerWeek: days,
    preferredDays: presets[days],
    sessionMinutes: '60-75',
    equipment,
    priorities: [],
    limitations: [],
    cardio: 'none',
  }, extra || {});
}

function slots(routine) {
  const list = [];
  routine.days.forEach((day) => day.sections.forEach((section) => section.exercises.forEach((slot) => list.push(slot))));
  return list;
}

function byKey(key) {
  return catalog.find((exercise) => exercise.key === key);
}

test('genera todas las combinaciones principales', () => {
  goals.forEach((goal) => {
    levels.forEach((level) => {
      dayCounts.forEach((days) => {
        equipments.forEach((equipment) => {
          const result = generateRoutine(answersFor(goal, level, days, equipment), catalog, { seed: 7 });
          assert.equal(result.routine.days.length, days);
          result.routine.days.forEach((day) => {
            const count = day.sections.reduce((sum, section) => sum + section.exercises.length, 0);
            assert.ok(count >= 3, goal + ' ' + level + ' ' + days + ' ' + equipment + ' ' + day.name);
          });
          assert.equal(result.routine.version, 2);
          slots(result.routine).forEach((slot) => {
            assert.equal(typeof slot.sets.count, 'number');
            assert.ok(slot.sets.repMin <= slot.sets.repMax);
          });
        });
      });
    });
  });
});

test('respeta lesiones, equipo, nivel y volumen', () => {
  const limitations = ['shoulder', 'knee'];
  const result = generateRoutine(answersFor('hypertrophy', 'beginner', 4, 'home_dumbbells', {
    limitations,
    priorities: ['upper_chest', 'back'],
    sessionMinutes: '45-60',
  }), catalog, { seed: 3 });
  const range = ranges.beginner;
  slots(result.routine).forEach((slot) => {
    const exercise = byKey(slot.exerciseId);
    assert.ok(exercise);
    assert.equal(exercise.equipment.includes('home_dumbbells'), true);
    assert.equal(exercise.avoidIf.some((item) => limitations.includes(item)), false);
    assert.ok(exercise.difficulty < 3);
  });
  Object.entries(result.meta.weeklyVolume).forEach(([group, sets]) => {
    const cap = ['Pecho', 'Espalda'].includes(group) ? range.priority : range.max;
    assert.ok(sets >= range.min - 2 && sets <= cap + 2, group + ' ' + sets);
  });
  ['Pecho', 'Espalda'].forEach((group) => {
    const trained = result.routine.days.filter((day) => day.sections.some((section) => section.exercises.some((slot) => slot.muscleGroup === group))).length;
    assert.ok(trained >= 2, group + ' frecuencia ' + trained);
  });
});

test('el mismo seed repite la rutina y otro seed cambia un ejercicio', () => {
  const answers = answersFor('hypertrophy', 'intermediate', 4, 'full_gym', { priorities: ['chest'] });
  const a = generateRoutine(answers, catalog, { seed: 11 });
  const b = generateRoutine(answers, catalog, { seed: 11 });
  const c = generateRoutine(answers, catalog, { seed: 99 });
  assert.deepEqual(slots(a.routine).map((slot) => slot.exerciseId + ':' + slot.sets.count), slots(b.routine).map((slot) => slot.exerciseId + ':' + slot.sets.count));
  const left = slots(a.routine).map((slot) => slot.exerciseId).join('|');
  const right = slots(c.routine).map((slot) => slot.exerciseId).join('|');
  assert.notEqual(left, right);
});

test('la cantidad de ejercicios respeta el tiempo', () => {
  Object.entries({ '30-45': 5, '45-60': 6, '60-75': 7, '75-90': 8 }).forEach(([minutes, max]) => {
    const result = generateRoutine(answersFor('general', 'intermediate', 3, 'basic_gym', { sessionMinutes: minutes, cardio: 'regular' }), catalog, { seed: 4 });
    result.routine.days.forEach((day) => {
      const count = day.sections.reduce((sum, section) => sum + section.exercises.length, 0);
      assert.ok(count <= max, minutes + ' ' + count);
      assert.ok(count >= 3);
    });
  });
});

test('catálogo: claves únicas y cobertura por patrón', () => {
  const keys = new Set();
  const patterns = new Set();
  catalog.forEach((exercise) => {
    assert.equal(keys.has(exercise.key), false);
    keys.add(exercise.key);
    ['name', 'pattern', 'muscleGroup', 'equipment', 'type', 'difficulty'].forEach((field) => assert.ok(exercise[field] != null));
    patterns.add(exercise.pattern);
  });
  assert.ok(catalog.length >= 70);
  patterns.forEach((pattern) => {
    ['full_gym', 'basic_gym', 'home_dumbbells', 'bodyweight'].forEach((equipment) => {
      assert.ok(catalog.some((exercise) => exercise.pattern === pattern && exercise.equipment.includes(equipment)));
    });
  });
  assert.ok(priorityMuscles.chest);
});
