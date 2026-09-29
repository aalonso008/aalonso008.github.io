/* Afirmaciones compartidas por node --test y tests/index.html. */
function runChecks(assert) {
  const parsed = parseSetsText('4 series × 6–8 reps');
  assert.equal(parsed.count, 4);
  assert.equal(parsed.repMin, 6);
  assert.equal(parsed.repMax, 8);
  assert.equal(parsed.note, '');

  assert.equal(parseSetsText('3x10').repMax, 10);
  assert.equal(parseSetsText('3 × 12-15').repMin, 12);
  assert.equal(parseSetsText('3 × 12-15').repMax, 15);
  assert.equal(parseSetsText('4 series de 8').count, 4);
  const messy = parseSetsText('al fallo');
  assert.equal(messy.count, 3);
  assert.equal(messy.note, 'al fallo');

  assert.equal(normalizeName('  Press   Militar '), normalizeName('press militar'));
  assert.equal(normalizeName('Bíceps'), 'biceps');

  const migrated = migrateV1toV2({
    routine: {
      version: 1,
      title: 'Test',
      days: [
        {
          id: 'd1',
          name: 'Lunes',
          sections: [
            {
              id: 's1',
              exercises: [
                { id: 'slot1', name: 'Press militar', sets: '4 series × 6–8 reps', muscles: ['Deltoides anterior'] },
              ],
            },
          ],
        },
      ],
    },
    logs: [
      { id: 10, ex: 'Press militar', peso: '60', series: '3', reps: '8', nota: 'bien', date: '21/09/26', ts: 1000 },
      { id: 11, ex: 'Curl raro', peso: '20', series: '2', reps: '10', date: '21/09/26', ts: 2000 },
    ],
    exercises: [],
  });

  assert.equal(migrated.routine.version, 2);
  assert.equal(migrated.exercises.length, 2);
  const press = migrated.exercises.find((ex) => ex.name === 'Press militar');
  const curl = migrated.exercises.find((ex) => ex.name === 'Curl raro');
  assert.equal(press.muscleGroup, 'Hombros');
  assert.equal(curl.archived, true);
  assert.equal(migrated.routine.days[0].sections[0].exercises[0].exerciseId, press.id);
  assert.equal(migrated.sets.filter((set) => set.exerciseId === press.id).length, 3);
  assert.equal(migrated.sets.filter((set) => set.exerciseId === curl.id).length, 2);
  assert.equal(migrated.sets.find((set) => set.exerciseId === press.id && set.setNumber === 1).weight, 60);
  assert.equal(migrated.sets.find((set) => set.exerciseId === press.id && set.setNumber === 1).date, '2026-09-21');

  const renamed = migrateV1toV2({
    routine: migrated.routine,
    logs: migrated.sets,
    exercises: migrated.exercises,
  });
  assert.equal(renamed.exercises.length, 2);
  assert.equal(renamed.sets.length, 5);

  assert.ok(Math.abs(epley(100, 5) - 116.666) < 0.01);
  assert.equal(epleyReliable(11), false);
  assert.equal(epleyReliable(8), true);

  const up = suggestProgression({
    prescription: { count: 2, repMin: 6, repMax: 8 },
    lastSession: [
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8 },
    ],
    prevSession: null,
    increment: 2.5,
  });
  assert.equal(up.kind, 'up');
  assert.match(up.text, /62\.5 kg/);

  const hold = suggestProgression({
    prescription: { count: 1, repMin: 6, repMax: 8 },
    lastSession: [{ weight: 60, reps: 7 }],
    increment: 2.5,
  });
  assert.equal(hold.kind, 'hold');

  const down = suggestProgression({
    prescription: { count: 1, repMin: 6, repMax: 8 },
    lastSession: [{ weight: 60, reps: 4 }],
    prevSession: [{ weight: 60, reps: 5 }],
    increment: 2.5,
  });
  assert.equal(down.kind, 'down');

  const cycle = cycleInfo('2026-09-07', new Date('2026-10-05T12:00:00'));
  assert.equal(cycle.week, 5);
  assert.equal(cycle.phase, 'Peso');

  assert.equal(Math.round(bmi(78.4, 178) * 10) / 10, 24.7);
  assert.equal(bmiCategory(24.7), 'normal');
  assert.equal(bmiCategory(30), 'obesidad');

  const ideals = idealWeights(178, 'M');
  assert.ok(ideals.devine > 70 && ideals.devine < 76);
  assert.ok(ideals.average > Math.min(ideals.devine, ideals.robinson, ideals.miller));
  assert.ok(ideals.average < Math.max(ideals.devine, ideals.robinson, ideals.miller));

  const fat = navyBodyFat({ sex: 'M', heightCm: 178, waistCm: 84, neckCm: 38 });
  assert.ok(fat > 8 && fat < 25);

  const lean = leanMass(80, 20);
  assert.equal(lean, 64);
  const goal = goalWeight(lean, 12);
  assert.ok(Math.abs(goal - 72.727) < 0.01);

  const bmr = mifflin(80, 178, 30, 'M');
  assert.equal(bmr, 10 * 80 + 6.25 * 178 - 5 * 30 + 5);
  const maintenance = tdee(bmr, 'moderate');
  assert.equal(calorieTargets(maintenance).cut, Math.round(maintenance - 400));

  const trend = trendPerWeek([
    { date: '2026-09-01', value: 80 },
    { date: '2026-09-08', value: 79.6 },
  ]);
  assert.ok(Math.abs(trend + 0.4) < 0.05);

  const projected = projectDate(80, 74, -0.4, new Date('2026-09-01T00:00:00'));
  assert.equal(projected, '2026-12-15');
}

if (typeof module === 'object' && module.exports) module.exports = { runChecks };
