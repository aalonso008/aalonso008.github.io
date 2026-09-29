function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderExerciseCard(exercise, logs, settings) {
  const muscles = (exercise.muscles || []).map((muscle) => `<span class="muscle-tag">${escapeHtml(muscle)}</span>`).join('');
  const link = exercise.linkUrl
    ? `<a class="ex-link" href="${escapeHtml(exercise.linkUrl)}" target="_blank" rel="noopener">${escapeHtml(exercise.linkLabel || 'Ver técnica')}</a>`
    : '';
  const tip = exercise.tip ? `<p class="ex-tip">${escapeHtml(exercise.tip)}</p>` : '';
  return `
    <div class="ex-card" data-exercise-id="${escapeHtml(exercise.exerciseId)}">
      <div class="ex-main" onclick="toggleEx(this)">
        <div class="ex-left">
          <div class="ex-name">${escapeHtml(exercise.name)}</div>
          <div class="ex-sets">${escapeHtml(formatSets(exercise.sets))}</div>
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
        ${cycle ? `<div class="cycle-chip">Semana ${cycle.week}/8 · ${escapeHtml(cycle.phase)}</div>` : ''}
        <button type="button" class="log-btn day-start" onclick="startWorkout(${index})">▶ Empezar entrenamiento</button>
      </div>
      ${sections || '<p class="empty-day">Este día no tiene ejercicios todavía.<br>Andá a <strong>Editar</strong> para agregar.</p>'}
    </div>`;
}

async function renderRoutineView(routine) {
  if (typeof captureSetDrafts === 'function') captureSetDrafts();
  const headerTitle = document.getElementById('headerTitle');
  const headerSub = document.getElementById('headerSub');
  if (headerTitle) headerTitle.textContent = routine.title || 'Mi Rutina';
  if (headerSub) headerSub.textContent = routine.subtitle || '';

  const tabsEl = document.getElementById('dayTabs');
  const daysEl = document.getElementById('routineDays');
  if (!routine.days.length) {
    tabsEl.innerHTML = '';
    daysEl.innerHTML = '<p class="empty-day">No hay días en tu rutina. Andá a <strong>Editar</strong> para crear uno.</p>';
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
