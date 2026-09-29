let selectedExerciseId = '';
let currentFilter = 'Todos';
const setDrafts = {};
let skipDraftCapture = null;
let currentSettings = null;

async function getActiveRoutine() {
  if (typeof currentRoutine !== 'undefined' && currentRoutine) return currentRoutine;
  return Storage.getRoutine();
}

function captureSetDrafts() {
  document.querySelectorAll('[data-set-editor]').forEach((editor) => {
    const id = editor.dataset.exerciseId;
    if (!id || id === skipDraftCapture) return;
    setDrafts[id] = [...editor.querySelectorAll('.set-row')].map((row) => ({
      id: row.dataset.setId || '',
      weight: row.querySelector('.set-weight').value,
      reps: row.querySelector('.set-reps').value,
      rpe: row.querySelector('.set-rpe').value,
    }));
  });
  skipDraftCapture = null;
}

function previousSession(sets, exerciseId) {
  const today = todayIso();
  const sessions = groupSessions((sets || []).filter((set) => set.exerciseId === exerciseId));
  return [...sessions].reverse().find((session) => session[0] && session[0].date !== today) || null;
}

function todaySession(sets, exerciseId) {
  const today = todayIso();
  const sessions = groupSessions((sets || []).filter((set) => set.exerciseId === exerciseId));
  return [...sessions].reverse().find((session) => session[0] && session[0].date === today) || null;
}

function rowsForExercise(exercise, allSets, unit) {
  if (setDrafts[exercise.exerciseId]) return setDrafts[exercise.exerciseId];
  const today = todaySession(allSets, exercise.exerciseId);
  const previous = previousSession(allSets, exercise.exerciseId);
  const source = today || previous || [];
  const count = Math.max((exercise.sets && exercise.sets.count) || 1, source.length || 0, 1);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const set = source[i];
    rows.push({
      id: today && set ? set.id : '',
      weight: set ? String(toDisplayWeight(set.weight, unit)) : '',
      reps: set ? String(set.reps || '') : '',
      rpe: set && set.rpe != null ? String(set.rpe) : '',
    });
  }
  return rows;
}

function lastSessionLine(sets, exerciseId, unit) {
  const previous = previousSession(sets, exerciseId) || todaySession(sets, exerciseId);
  if (!previous) return 'Sin registros todavía';
  const reps = previous.map((set) => set.reps).join(' · ');
  return `Última vez (${formatDisplayDate(previous[0].date)}): ${formatWeight(previous[0].weight, unit)} × ${reps}`;
}

function renderSetEditor(exercise, allSets, settings) {
  const unit = (settings && settings.unit) || 'kg';
  const rows = rowsForExercise(exercise, allSets, unit);
  const suggestion = suggestionFor(exercise, allSets, settings);
  return `
    <div class="ex-quick-log" data-set-editor data-exercise-id="${escapeHtml(exercise.exerciseId)}" data-muscle="${escapeHtml(exercise.muscleGroup)}" data-name="${escapeHtml(exercise.name)}" data-unit="${unit}" data-rest="${exercise.sets.restSec || settings.defaultRestSec || 90}">
      <div class="ex-last-log">${escapeHtml(lastSessionLine(allSets, exercise.exerciseId, unit))}</div>
      ${suggestion ? `<p class="set-suggestion">${escapeHtml(suggestion.text)}</p>` : ''}
      ${rows
        .map(
          (row, index) => `
        <div class="set-row" data-set-id="${escapeHtml(row.id)}">
          <span class="set-num">${index + 1}</span>
          <button type="button" class="step-btn" onclick="stepSetInput(this,-1,'weight')" aria-label="Menos peso">−</button>
          <input class="set-weight" inputmode="decimal" placeholder="${unit}" aria-label="Peso serie ${index + 1}" value="${escapeHtml(row.weight)}">
          <button type="button" class="step-btn" onclick="stepSetInput(this,1,'weight')" aria-label="Más peso">+</button>
          <button type="button" class="step-btn" onclick="stepSetInput(this,-1,'reps')" aria-label="Menos reps">−</button>
          <input class="set-reps" inputmode="numeric" placeholder="reps" aria-label="Reps serie ${index + 1}" value="${escapeHtml(row.reps)}">
          <button type="button" class="step-btn" onclick="stepSetInput(this,1,'reps')" aria-label="Más reps">+</button>
          <input class="set-rpe" inputmode="decimal" min="6" max="10" step="0.5" placeholder="RPE" aria-label="RPE serie ${index + 1}" value="${escapeHtml(row.rpe)}">
          <button type="button" class="set-save" onclick="saveSetRow(this)" aria-label="Guardar serie ${index + 1}">✓</button>
        </div>`
        )
        .join('')}
      <div class="set-row-actions">
        <button type="button" class="btn-secondary-sm" onclick="addDraftRow(this)">+ Serie</button>
        <button type="button" class="btn-secondary-sm" onclick="removeDraftRow(this)">Quitar serie</button>
      </div>
    </div>`;
}

function suggestionFor(exercise, allSets, settings) {
  const sessions = groupSessions((allSets || []).filter((set) => set.exerciseId === exercise.exerciseId));
  if (!sessions.length && !(settings && cycleInfo(settings.cycleStart) && cycleInfo(settings.cycleStart).deload)) return null;
  const cycle = cycleInfo(settings && settings.cycleStart);
  const suggestion = suggestProgression({
    prescription: exercise.sets,
    lastSession: sessions[sessions.length - 1] || [],
    prevSession: sessions[sessions.length - 2] || null,
    increment: incrementFor(exercise.muscleGroup, exercise.name, settings),
    deload: !!(cycle && cycle.deload),
  });
  if (suggestion && settings && settings.unit === 'lb') {
    suggestion.text = suggestion.text.replace(/(\d+(?:\.\d+)?) kg/g, (_, value) => formatWeight(Number(value), 'lb'));
  }
  return suggestion;
}

function personalBests(sets) {
  let maxWeight = 0;
  let maxEpley = 0;
  (sets || []).forEach((set) => {
    maxWeight = Math.max(maxWeight, Number(set.weight) || 0);
    maxEpley = Math.max(maxEpley, epley(set.weight, set.reps));
  });
  return { maxWeight, maxEpley };
}

function isNewPr(before, set) {
  const weight = Number(set.weight) || 0;
  return weight > before.maxWeight + 0.001 || epley(set.weight, set.reps) > before.maxEpley + 0.05;
}

function stepSetInput(btn, dir, field) {
  const editor = btn.closest('[data-set-editor]');
  const row = btn.closest('.set-row');
  const input = row.querySelector(field === 'weight' ? '.set-weight' : '.set-reps');
  const unit = editor.dataset.unit || 'kg';
  const settings = currentSettings || DEFAULT_SETTINGS;
  const step = field === 'reps' ? 1 : incrementFor(editor.dataset.muscle, editor.dataset.name, settings);
  const current = parseFloat(String(input.value).replace(',', '.'));
  const base = Number.isFinite(current) ? current : 0;
  if (field === 'weight') {
    const kg = fromDisplayWeight(base, unit) + dir * step;
    input.value = String(toDisplayWeight(Math.max(0, kg), unit));
    return;
  }
  input.value = String(Math.max(0, base + dir * step));
}

async function saveSetRow(btn) {
  const row = btn.closest('.set-row');
  const editor = btn.closest('[data-set-editor]');
  const exerciseId = editor.dataset.exerciseId;
  const unit = editor.dataset.unit || 'kg';
  const weight = fromDisplayWeight(row.querySelector('.set-weight').value, unit);
  const reps = parseInt(row.querySelector('.set-reps').value, 10);
  const rpeRaw = row.querySelector('.set-rpe').value.trim();
  if (!weight) return alert('Ingresá el peso.');
  if (!reps) return alert('Ingresá las reps.');
  let rpe = null;
  if (rpeRaw) {
    rpe = Number(rpeRaw);
    if (!Number.isFinite(rpe) || rpe < 6 || rpe > 10 || Math.round(rpe * 2) !== rpe * 2) {
      return alert('El RPE va de 6 a 10, de a 0.5.');
    }
  }

  const existing = await Storage.getSets({ exerciseId });
  const before = personalBests(existing);
  const date = todayIso();
  const setNumber = [...editor.querySelectorAll('.set-row')].indexOf(row) + 1;
  const record = await Storage.addSet({
    id: row.dataset.setId || createId('set'),
    exerciseId,
    sessionId: `ses_${date}_${exerciseId}`,
    date,
    setNumber,
    weight,
    reps,
    rpe,
    note: '',
    ts: Date.now(),
  });
  row.dataset.setId = record.id;
  if (isNewPr(before, record)) {
    showToast('🏆 ¡Nuevo PR!');
    if (typeof noteWorkoutPr === 'function') noteWorkoutPr(exerciseId);
  }
  const settings = currentSettings || (await Storage.getSettings());
  startRest(Number(editor.dataset.rest) || settings.defaultRestSec || 90, settings.vibrate !== false);
  delete setDrafts[exerciseId];
  skipDraftCapture = exerciseId;
  await refreshAfterSetChange();
}

async function addDraftRow(btn) {
  captureSetDrafts();
  const editor = btn.closest('[data-set-editor]');
  const id = editor.dataset.exerciseId;
  const rows = setDrafts[id] ? setDrafts[id].slice() : [];
  const last = rows[rows.length - 1] || { weight: '', reps: '', rpe: '' };
  rows.push({ id: '', weight: last.weight, reps: '', rpe: '' });
  setDrafts[id] = rows;
  skipDraftCapture = id;
  await refreshAfterSetChange();
}

async function removeDraftRow(btn) {
  captureSetDrafts();
  const editor = btn.closest('[data-set-editor]');
  const id = editor.dataset.exerciseId;
  const rows = (setDrafts[id] || []).slice();
  if (rows.length <= 1) return;
  const last = rows.pop();
  setDrafts[id] = rows;
  if (last && last.id) await Storage.deleteSet(last.id);
  skipDraftCapture = id;
  await refreshAfterSetChange();
}

async function refreshAfterSetChange() {
  const routine = await getActiveRoutine();
  const onRoutine = document.getElementById('page-rutina')?.classList.contains('active');
  const onLog = document.getElementById('page-log')?.classList.contains('active');
  const onProg = document.getElementById('page-prog')?.classList.contains('active');
  if (onRoutine && routine) await renderRoutineView(routine);
  if (onLog) await renderLogPage();
  if (onProg && typeof renderProgressCharts === 'function') await renderProgressCharts();
  if (typeof workoutIsOpen === 'function' && workoutIsOpen()) await renderWorkout();
}

async function renderLogPage() {
  const el = document.getElementById('page-log');
  if (!el) return;
  captureSetDrafts();
  const routine = await getActiveRoutine();
  const library = await Storage.getExercises();
  const settings = await Storage.getSettings();
  currentSettings = settings;
  const exercises = collectRoutineExercises(routine, library);
  const sets = await Storage.getSets();
  const groups = ['Todos'].concat(MUSCLE_GROUPS);
  const visible = exercises.filter((ex) => currentFilter === 'Todos' || ex.muscleGroup === currentFilter);
  if (selectedExerciseId && !visible.some((ex) => ex.exerciseId === selectedExerciseId)) selectedExerciseId = '';
  const selected = visible.find((ex) => ex.exerciseId === selectedExerciseId) || null;

  el.innerHTML = `
    <h2>Registro</h2>
    <p class="sub">Anotá cada serie. El historial queda aunque le cambies el nombre al ejercicio.</p>
    <div class="log-form">
      <label>Filtrar por grupo</label>
      <div class="muscle-filter">
        ${groups
          .map(
            (group) =>
              `<button type="button" class="mf-btn${group === currentFilter ? ' active' : ''}" onclick="filterMuscle('${group}', this)">${group}</button>`
          )
          .join('')}
      </div>
      <label>Ejercicio</label>
      <div class="ex-picker" id="exPicker">
        ${
          visible.length
            ? visible
                .map(
                  (ex) =>
                    `<button type="button" class="ex-option${ex.exerciseId === selectedExerciseId ? ' selected' : ''}" onclick="selectExercise('${ex.exerciseId}')">${escapeHtml(ex.name)}</button>`
                )
                .join('')
            : '<p class="empty-log">Agregá ejercicios en tu rutina primero.</p>'
        }
      </div>
      ${selected ? renderSetEditor(selected, sets, settings) : '<p class="ex-selected">Elegí un ejercicio para cargar las series.</p>'}
    </div>
    <div class="log-toolbar">
      <span>Historial</span>
      <div>
        <button type="button" class="ghost-btn" onclick="exportLogsCsv()">CSV</button>
        <button type="button" class="ghost-btn" onclick="copyLogs()">Copiar</button>
      </div>
    </div>
    <div class="log-entries" id="logEntries">${renderHistoryHtml(sets, library)}</div>`;
}

function renderHistoryHtml(sets, library) {
  if (!sets.length) {
    return '<div class="empty-log">Todavía no hay series.<br>Guardá una con el ✓ de cada fila.</div>';
  }
  const byDate = new Map();
  sets.forEach((set) => {
    if (!byDate.has(set.date)) byDate.set(set.date, []);
    byDate.get(set.date).push(set);
  });
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  return dates
    .map((date) => {
      const rows = byDate.get(date).slice().sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
      const byExercise = new Map();
      rows.forEach((set) => {
        if (!byExercise.has(set.exerciseId)) byExercise.set(set.exerciseId, []);
        byExercise.get(set.exerciseId).push(set);
      });
      const blocks = [...byExercise.entries()]
        .map(([exerciseId, list]) => {
          const lib = library.find((ex) => ex.id === exerciseId);
          const detail = list
            .map((set) => `${set.weight}kg × ${set.reps}${set.rpe != null ? ' @' + set.rpe : ''}`)
            .join(' · ');
          const deletes = list
            .map((set) => `<button type="button" class="log-delete" onclick="deleteLog('${set.id}')" aria-label="Borrar serie ${set.setNumber}">×</button>`)
            .join('');
          return `<div class="log-entry"><div class="log-entry-left"><div class="log-entry-name">${escapeHtml((lib && lib.name) || 'Ejercicio')}</div><div class="log-entry-detail">${escapeHtml(detail)}</div></div><div class="log-entry-side"><div class="log-entry-date">${list.length} series</div><div>${deletes}</div></div></div>`;
        })
        .join('');
      return `<div class="log-day"><h3>${formatDisplayDate(date)}</h3>${blocks}</div>`;
    })
    .join('');
}

async function filterMuscle(group) {
  currentFilter = group;
  await renderLogPage();
}

async function selectExercise(id) {
  selectedExerciseId = id;
  await renderLogPage();
}

async function deleteLog(id) {
  await Storage.deleteSet(id);
  await refreshAfterSetChange();
}

async function copyLogs() {
  const sets = await Storage.getSets();
  const library = await Storage.getExercises();
  if (!sets.length) return alert('No hay registros todavía.');
  const text = renderHistoryHtml(sets, library).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const readable = sets
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map((set) => {
      const lib = library.find((ex) => ex.id === set.exerciseId);
      return `${formatDisplayDate(set.date)} — ${(lib && lib.name) || 'Ejercicio'} · serie ${set.setNumber}: ${set.weight}kg × ${set.reps}${set.rpe != null ? ' RPE ' + set.rpe : ''}`;
    })
    .join('\n');
  try {
    await navigator.clipboard.writeText(readable);
    showToast('Copiado');
  } catch {
    alert(readable);
  }
  return text;
}

async function exportLogsCsv() {
  const sets = await Storage.getSets();
  const library = await Storage.getExercises();
  if (!sets.length) return alert('No hay registros todavía.');
  const lines = ['fecha,ejercicio,grupo,serie,kg,reps,rpe,nota'];
  sets
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.setNumber || 0) - (b.setNumber || 0))
    .forEach((set) => {
      const lib = library.find((ex) => ex.id === set.exerciseId);
      lines.push(
        [set.date, (lib && lib.name) || '', (lib && lib.muscleGroup) || '', set.setNumber, set.weight, set.reps, set.rpe ?? '', set.note || '']
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      );
    });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tu-rutina-${todayIso()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function initLog() {
  await renderLogPage();
}

async function refreshLogExercises() {
  if (document.getElementById('page-log')) await renderLogPage();
}
