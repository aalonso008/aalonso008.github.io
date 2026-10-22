function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lastLoggedWeight(exerciseId, logs, unit) {
  if (typeof previousSession !== 'function') return '';
  const session = previousSession(logs, exerciseId) || (typeof todaySession === 'function' ? todaySession(logs, exerciseId) : null);
  if (!session) return '';
  const weights = session.filter((set) => set && !set.bodyweight && Number(set.weight)).map((set) => Number(set.weight));
  if (!weights.length) return '';
  return formatWeight(Math.max(...weights), unit || 'kg');
}

function renderExerciseCard(exercise, logs, settings) {
  const muscles = (exercise.muscles || []).map((muscle) => `<span class="muscle-tag">${escapeHtml(muscle)}</span>`).join('');
  const link = exercise.linkUrl
    ? `<a class="ex-link" href="${escapeHtml(exercise.linkUrl)}" target="_blank" rel="noopener">${escapeHtml(exercise.linkLabel || 'Ver técnica')}</a>`
    : '';
  const tip = exercise.tip ? `<p class="ex-tip">${escapeHtml(exercise.tip)}</p>` : '';
  const lastWeight = lastLoggedWeight(exercise.exerciseId, logs, settings && settings.unit);
  return `
    <div class="ex-card" data-exercise-id="${escapeHtml(exercise.exerciseId)}">
      <div class="ex-main" onclick="toggleEx(this)">
        <div class="ex-left">
          <div class="ex-name">${escapeHtml(exercise.name)}</div>
          <div class="ex-sets">${escapeHtml(formatSets(exercise.sets))}${lastWeight ? ' · ' + escapeHtml(lastWeight) : ''}</div>
        </div>
        <div class="ex-main-actions">
          <button type="button" class="ex-log-btn" onclick="event.stopPropagation(); openQuickLog(this)" aria-label="Registrar peso">+</button>
          <div class="ex-chevron">⌄</div>
        </div>
      </div>
      <div class="ex-detail">
        ${tip}
        ${muscles ? `<div class="ex-muscles">${muscles}</div>` : ''}
        ${link ? `<div class="ex-detail-actions">${link}</div>` : ''}
        ${renderSetEditor(exercise, logs, settings)}
      </div>
    </div>`;
}

function openQuickLog(btn) {
  const card = btn.closest('.ex-card');
  card.classList.add('open');
  const input = card.querySelector('.set-weight');
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderDayPanel(day, index, active, library, logs, settings) {
  const tag = day.tag
    ? `<span class="focus-tag" style="background:${escapeHtml(day.tag.bg)};color:${escapeHtml(day.tag.color)};">${escapeHtml(day.tag.text)}</span>`
    : '';
  const sections = (day.sections || [])
    .map((section) => {
      const exercises = (section.exercises || [])
        .map((slot) => renderExerciseCard(resolveSlot(slot, library), logs, settings))
        .join('');
      return `
        <div class="section-label">${escapeHtml(section.label)}</div>
        ${exercises || '<p class="empty-day">Sin ejercicios en esta sección.</p>'}`;
    })
    .join('');
  const cycle = cycleInfo(settings.cycleStart);

  return `
    <div class="day-panel${active ? ' active' : ''}" id="day-${index}">
      <div class="day-header">
        <h2>${escapeHtml(day.name)}</h2>
        ${day.focus ? `<div class="focus">${escapeHtml(day.focus)}</div>` : ''}
        ${tag}
        ${cycle ? `<div class="cycle-chip">${escapeHtml(typeof I18n !== 'undefined' ? I18n.t('cycle.chip', { week: cycle.week, phase: I18n.t('phase.' + cycle.phase) }) : 'Semana ' + cycle.week + '/8 · ' + cycle.phase)}</div>` : ''}
        <button type="button" class="log-btn day-start" onclick="startWorkout(${index})">${typeof I18n !== 'undefined' ? I18n.t('day.start') : '▶ Empezar entrenamiento'}</button>
      </div>
      ${sections || '<p class="empty-day">' + (typeof I18n !== 'undefined' ? I18n.t('day.empty') : 'Este día no tiene ejercicios todavía. Ve a Editar para agregar.') + '</p>'}
    </div>`;
}

async function renderRoutinePicker(routine) {
  const box = document.getElementById('routinePicker');
  if (!box || typeof Storage === 'undefined' || typeof Storage.getRoutines !== 'function') return;
  const routines = await Storage.getRoutines();
  if (!routines.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const label = typeof I18n !== 'undefined' ? I18n.t('routine.pick') : 'Rutina para hoy';
  const fresh = typeof I18n !== 'undefined' ? I18n.t('routine.new') : 'Nueva';
  const shared = typeof I18n !== 'undefined' ? I18n.t('routine.shared') : 'El contador de días es el mismo para todas.';
  const options = routines
    .map((item) => `<option value="${escapeHtml(item.id)}"${item.id === routine.id ? ' selected' : ''}>${escapeHtml(item.title || 'Rutina')}</option>`)
    .join('');
  const removeLabel = typeof I18n !== 'undefined' ? I18n.t('routine.remove') : 'Borrar';
  const remove = routines.length > 1
    ? `<button type="button" class="btn-secondary-sm" onclick="deleteRoutineFromPicker()">${escapeHtml(removeLabel)}</button>`
    : '';
  box.hidden = false;
  box.innerHTML = `
    <label for="activeRoutine">${escapeHtml(label)}</label>
    <div class="routine-picker-row">
      <select id="activeRoutine" onchange="switchActiveRoutine(this.value)">${options}</select>
      ${remove}
      <button type="button" class="btn-secondary-sm" onclick="openRoutineWizard('routine')">${escapeHtml(fresh)}</button>
    </div>
    <p class="hint">${escapeHtml(shared)}</p>`;
}

async function renderRoutineView(routine) {
  if (typeof captureSetDrafts === 'function') captureSetDrafts();
  const headerTitle = document.getElementById('headerTitle');
  const headerSub = document.getElementById('headerSub');
  if (headerTitle) headerTitle.textContent = routine.title || 'Mi Rutina';
  if (headerSub) headerSub.textContent = routine.subtitle || '';
  await renderRoutinePicker(routine);

  const tabsEl = document.getElementById('dayTabs');
  const daysEl = document.getElementById('routineDays');
  if (!routine.days.length) {
    tabsEl.innerHTML = '';
    daysEl.innerHTML = '<p class="empty-day">' + (typeof I18n !== 'undefined' ? I18n.t('routine.nodays') : 'No hay días en tu rutina. Ve a Editar para crear uno.') + '</p>';
    return;
  }

  const [library, logs, settings] = await Promise.all([Storage.getExercises(), Storage.getSets(), Storage.getSettings()]);
  currentSettings = settings;
  const currentTab = [...tabsEl.querySelectorAll('.tab')].findIndex((tab) => tab.classList.contains('active'));
  let activeIndex = currentTab;
  if (activeIndex < 0 || activeIndex >= routine.days.length) {
    const guessed = weekdayIndex(routine.days);
    activeIndex = guessed >= 0 ? guessed : 0;
  }

  const openIds = new Set([...daysEl.querySelectorAll('.ex-card.open')].map((card) => card.dataset.exerciseId));

  tabsEl.innerHTML = routine.days
    .map(
      (day, i) =>
        `<button type="button" class="tab${i === activeIndex ? ' active' : ''}" onclick="showDay(${i})">${escapeHtml(day.short || day.name.slice(0, 3))}</button>`
    )
    .join('');

  daysEl.innerHTML = routine.days
    .map((day, i) => renderDayPanel(day, i, i === activeIndex, library, logs, settings))
    .join('');

  openIds.forEach((id) => {
    const card = [...daysEl.querySelectorAll('.ex-card')].find((item) => item.dataset.exerciseId === id);
    if (card) card.classList.add('open');
  });
}
