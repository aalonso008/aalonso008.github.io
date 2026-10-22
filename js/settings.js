function settingsText(key) {
  return typeof I18n !== 'undefined' ? I18n.t(key) : key;
}

async function openSettings() {
  const settings = await Storage.getSettings();
  const modal = document.getElementById('settingsModal');
  const form = document.getElementById('settingsForm');
  const muscle = (group) => (typeof I18n !== 'undefined' && I18n.muscle ? I18n.muscle(group) : group);
  form.innerHTML = `
    <label>${settingsText('settings.unit')}</label>
    <select name="unit">
      <option value="kg"${settings.unit !== 'lb' ? ' selected' : ''}>${settingsText('settings.kg')}</option>
      <option value="lb"${settings.unit === 'lb' ? ' selected' : ''}>${settingsText('settings.lb')}</option>
    </select>
    <label>${settingsText('settings.rest')}</label>
    <input name="defaultRestSec" type="number" min="15" step="15" value="${settings.defaultRestSec}">
    <label>${settingsText('settings.cycle')}</label>
    <input name="cycleStart" type="date" value="${escapeHtml(settings.cycleStart || '')}">
    <label class="check-row"><input name="vibrate" type="checkbox"${settings.vibrate !== false ? ' checked' : ''}> ${settingsText('settings.vibrate')}</label>
    <h3 class="block-title">${settingsText('settings.increments')}</h3>
    ${MUSCLE_GROUPS.map(
      (group) =>
        `<label>${escapeHtml(muscle(group))}</label><input name="inc-${group}" type="number" min="0.5" step="0.5" value="${settings.increments[group]}">`
    ).join('')}
    <button type="submit" class="log-btn">${settingsText('settings.save')}</button>
    ${
      location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? `<button type="button" class="btn-secondary" onclick="loadDemoData()">${settingsText('settings.demo')}</button>`
        : ''
    }`;
  modal.classList.add('show');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('show');
}

async function saveSettingsForm(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const increments = {};
  MUSCLE_GROUPS.forEach((group) => {
    increments[group] = Number(form.get('inc-' + group)) || DEFAULT_SETTINGS.increments[group];
  });
  currentSettings = await Storage.saveSettings({
    unit: form.get('unit'),
    defaultRestSec: Number(form.get('defaultRestSec')) || 90,
    cycleStart: form.get('cycleStart') || '',
    vibrate: form.get('vibrate') === 'on',
    increments,
  });
  closeSettings();
  showToast(settingsText('settings.saved'));
  const routine = await getActiveRoutine();
  if (routine) await renderRoutineView(routine);
}

async function loadDemoData() {
  if (!confirm(typeof I18n !== 'undefined' ? I18n.t('settings.demo.confirm') : '¿Agregar 8 semanas de entrenamientos y peso de prueba?')) return;
  const routine = await getActiveRoutine();
  const library = await Storage.getExercises();
  const exercises = collectRoutineExercises(routine, library).filter((ex) => !ex.archived).slice(0, 6);
  if (!exercises.length) return alert(typeof I18n !== 'undefined' ? I18n.t('settings.demo.need') : 'Primero crea una rutina con ejercicios.');
  const sets = await Storage.getSets();
  const now = new Date();
  for (let week = 8; week >= 1; week -= 1) {
    for (let session = 0; session < 3; session += 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - week * 7 + session * 2);
      const iso = isoDate(date);
      exercises.forEach((exercise, index) => {
        const step = incrementFor(exercise.muscleGroup, exercise.name, currentSettings || DEFAULT_SETTINGS);
        const weight = 30 + index * 10 + (8 - week) * (step / 2);
        const reps = Math.min(exercise.sets.repMax || 12, (exercise.sets.repMin || 8) + (week <= 4 ? 2 : 0));
        const count = exercise.sets.count || 3;
        for (let n = 1; n <= count; n += 1) {
          sets.push({
            id: createId('set'),
            exerciseId: exercise.exerciseId,
            sessionId: `ses_${iso}_${exercise.exerciseId}`,
            date: iso,
            setNumber: n,
            weight: Math.round(weight * 2) / 2,
            reps,
            rpe: 8,
            note: '',
            ts: date.getTime() + n * 1000,
          });
        }
      });
    }
  }
  await Storage.replaceSets(sets);
  let weight = 82;
  for (let i = 56; i >= 0; i -= 3) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    weight -= 0.15;
    await Storage.addBodyMetric({
      id: createId('bm'),
      date: isoDate(date),
      weight: Math.round(weight * 10) / 10,
      waistCm: Math.round((90 - (56 - i) * 0.08) * 10) / 10,
      neckCm: 38,
      hipCm: null,
      bodyFatManual: null,
      note: '',
      ts: date.getTime(),
    });
  }
  const profile = (await Storage.getProfile()) || {};
  if (!profile.heightCm) {
    await Storage.saveProfile({
      ...profile,
      sex: 'M',
      birthDate: '1996-03-03',
      heightCm: 178,
      activityLevel: 'moderate',
      goal: 'cut',
      targetBodyFat: 12,
    });
  }
  closeSettings();
  showToast(settingsText('settings.demo.done'));
  const active = await getActiveRoutine();
  if (active) await renderRoutineView(active);
}
