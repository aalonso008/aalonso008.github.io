let chartMetric = 'peso';

function toggleProgEx(header) {
  header.closest('.prog-ex-card').classList.toggle('open');
}

function sessionMetric(session, metric) {
  if (metric === 'volumen') return Math.round(sessionVolume(session));
  if (metric === 'reps') return Math.max(...session.map((set) => Number(set.reps) || 0));
  if (metric === '1rm') return Math.round(sessionBestEpley(session).value);
  return Math.max(...session.map((set) => Number(set.weight) || 0));
}

function renderLineChart(points) {
  if (points.length < 2) return '<p class="empty-log">Hacen falta al menos dos sesiones.</p>';
  const width = 320;
  const height = 120;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * (width - 16) + 8;
    const y = height - 16 - ((point.value - min) / span) * (height - 28);
    return `${x},${y}`;
  });
  return `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de progreso">
      <polyline fill="none" stroke="#c8ff57" stroke-width="2" points="${coords.join(' ')}"></polyline>
    </svg>
    <div class="chart-caption">${points[0].label} → ${points[points.length - 1].label}</div>`;
}

async function renderProgressCharts() {
  const el = document.getElementById('progressCharts');
  if (!el) return;
  const routine = await getActiveRoutine();
  const library = await Storage.getExercises();
  const settings = await Storage.getSettings();
  const sets = await Storage.getSets();
  const exercises = collectRoutineExercises(routine, library).filter((ex) => !ex.archived);
  const cycle = cycleInfo(settings.cycleStart);
  const bounds = weekBounds();
  const prevBounds = previousWeekBounds();
  const thisWeek = setsInRange(sets, bounds.start, bounds.end);
  const lastWeek = setsInRange(sets, prevBounds.start, prevBounds.end);
  const volumeNow = Math.round(sessionVolume(thisWeek));
  const volumePrev = Math.round(sessionVolume(lastWeek));

  const muscleCounts = MUSCLE_GROUPS.map((group) => {
    const ids = new Set(library.filter((ex) => ex.muscleGroup === group).map((ex) => ex.id));
    return { group, count: thisWeek.filter((set) => ids.has(set.exerciseId)).length };
  }).filter((item) => item.count > 0);

  el.innerHTML = `
    <p class="section-label" style="padding-top:0">Tu progreso</p>
    ${cycle ? `<div class="cycle-chip">Semana ${cycle.week}/8 · Fase: ${escapeHtml(cycle.phase)}</div>` : '<p class="empty-log">Marcá el inicio del ciclo de 8 semanas en Ajustes.</p>'}
    <div class="summary-grid">
      <div class="summary-card"><span>Volumen semanal</span><strong>${volumeNow} kg</strong><small>${volumePrev ? (volumeNow - volumePrev >= 0 ? '+' : '') + (volumeNow - volumePrev) + ' vs sem. anterior' : 'Sin semana anterior'}</small></div>
      <div class="summary-card"><span>Sesiones del mes</span><strong>${monthSessions(sets)}</strong><small>Racha ${streakDays(sets)} ${streakDays(sets) === 1 ? 'día' : 'días'}</small></div>
    </div>
    <h3 class="block-title">Series de la semana</h3>
    ${
      muscleCounts.length
        ? muscleCounts
            .map((item) => {
              const width = Math.min(100, Math.round((item.count / 20) * 100));
              const tone = item.count < 10 ? 'low' : item.count <= 20 ? 'ok' : 'high';
              return `<div class="muscle-bar"><div class="muscle-bar-label"><span>${item.group}</span><span>${item.count}</span></div><div class="muscle-track"><div class="muscle-fill ${tone}" style="width:${width}%"></div></div></div>`;
            })
            .join('')
        : '<p class="empty-log">Todavía no hay series esta semana.</p>'
    }
    <p class="hint">Orientativo: 10–20 series por grupo.</p>
    <h3 class="block-title">Días entrenados</h3>
    ${renderHeatmap(sets)}
    <div class="metric-switch">
      ${['peso', '1rm', 'volumen', 'reps']
        .map((metric) => `<button type="button" class="mf-btn${chartMetric === metric ? ' active' : ''}" onclick="setChartMetric('${metric}')">${metric === '1rm' ? '1RM' : metric}</button>`)
        .join('')}
    </div>
    ${renderExerciseProgress(exercises, sets)}`;
}

function monthSessions(sets) {
  const prefix = todayIso().slice(0, 7);
  return new Set(sets.filter((set) => (set.date || '').startsWith(prefix)).map((set) => set.sessionId || set.date)).size;
}

function streakDays(sets) {
  const trained = new Set(sets.map((set) => set.date));
  let count = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!trained.has(isoDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (trained.has(isoDate(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function renderHeatmap(sets) {
  const trained = new Set(sets.map((set) => set.date));
  const cells = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 111; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const iso = isoDate(date);
    cells.push(`<i class="${trained.has(iso) ? 'on' : ''}" title="${formatDisplayDate(iso)}"></i>`);
  }
  return `<div class="heatmap" aria-label="Calendario de entrenamientos">${cells.join('')}</div>`;
}

function renderExerciseProgress(exercises, sets) {
  const cards = exercises
    .map((exercise) => {
      const sessions = groupSessions(sets.filter((set) => set.exerciseId === exercise.exerciseId));
      if (!sessions.length) return '';
      const recent = sessions.slice(-12);
      const points = recent.map((session) => ({
        value: sessionMetric(session, chartMetric),
        label: formatDisplayDate(session[0].date),
      }));
      const bestWeight = Math.max(...sessions.flat().map((set) => Number(set.weight) || 0));
      const bestEpley = Math.max(...sessions.map((session) => sessionBestEpley(session).value));
      const bestVolume = Math.max(...sessions.map((session) => sessionVolume(session)));
      const suggestion = suggestionFor(exercise, sets, currentSettings || DEFAULT_SETTINGS);
      const unreliable = chartMetric === '1rm' && recent.some((session) => !sessionBestEpley(session).reliable);
      return `
        <div class="prog-ex-card">
          <div class="prog-ex-header" onclick="toggleProgEx(this)">
            <div class="prog-ex-left">
              <div class="prog-ex-name">${escapeHtml(exercise.name)}</div>
              <div class="prog-ex-meta">PR ${trimNum(bestWeight)}kg · 1RM ${trimNum(bestEpley)} · vol ${Math.round(bestVolume)}</div>
            </div>
            <div class="ex-chevron">⌄</div>
          </div>
          <div class="prog-ex-body">
            ${suggestion ? `<p class="set-suggestion">${escapeHtml(suggestion.text)}</p>` : ''}
            ${renderLineChart(points)}
            ${unreliable ? '<p class="hint">Hay series de más de 10 reps: el 1RM es menos confiable.</p>' : ''}
          </div>
        </div>`;
    })
    .filter(Boolean);
  if (!cards.length) {
    return '<p class="empty-day">Todavía no hay registros.<br>Guardá una serie en la rutina para ver el progreso.</p>';
  }
  return cards.join('');
}

async function setChartMetric(metric) {
  chartMetric = metric;
  await renderProgressCharts();
}
