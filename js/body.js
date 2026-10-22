let bodyRange = 90;

function bodyText(key, vars) {
  return typeof I18n !== 'undefined' ? I18n.t(key, vars) : key;
}

function activityLabel(level) {
  return bodyText('activity.' + level.id);
}

function bmiLabel(value) {
  const raw = bmiCategory(value);
  const keys = { 'bajo peso': 'bmi.under', normal: 'bmi.normal', sobrepeso: 'bmi.over', obesidad: 'bmi.obese' };
  return keys[raw] ? bodyText(keys[raw]) : raw;
}

function ffmiLabel(value) {
  const raw = ffmiCategory(value);
  const keys = {
    bajo: 'ffmi.low',
    promedio: 'ffmi.avg',
    bueno: 'ffmi.good',
    'muy bueno': 'ffmi.very',
    excelente: 'ffmi.excellent',
    'por encima del techo natural aprox.': 'ffmi.above',
  };
  return keys[raw] ? bodyText(keys[raw]) : raw;
}

async function renderBodyPage() {
  const el = document.getElementById('page-cuerpo');
  if (!el) return;
  const profile = (await Storage.getProfile()) || {
    sex: 'M',
    birthDate: '',
    heightCm: '',
    activityLevel: 'moderate',
    goal: 'maintain',
    targetBodyFat: '',
  };
  const metrics = await Storage.getBodyMetrics();
  const summary = bodySummary(profile, metrics);
  el.innerHTML = `
    <h2>${bodyText('body.h')}</h2>
    <p class="sub">${bodyText('body.sub')}</p>
    <div class="summary-grid">
      ${summary.cards}
    </div>
    <form class="editor-card" id="profileForm" onsubmit="saveBodyProfile(event)">
      <h3 class="block-title">${bodyText('body.profile')}</h3>
      <div class="editor-row">
        <div>
          <label>${bodyText('body.sex')}</label>
          <select name="sex"><option value="M"${profile.sex !== 'F' ? ' selected' : ''}>${bodyText('body.male')}</option><option value="F"${profile.sex === 'F' ? ' selected' : ''}>${bodyText('body.female')}</option></select>
        </div>
        <div>
          <label>${bodyText('body.birth')}</label>
          <input name="birthDate" type="date" value="${escapeHtml(profile.birthDate || '')}">
        </div>
      </div>
      <div class="editor-row">
        <div><label>${bodyText('body.height')}</label><input name="heightCm" type="number" inputmode="decimal" min="120" max="230" value="${escapeHtml(profile.heightCm || '')}"></div>
        <div><label>${bodyText('body.targetFat')}</label><input name="targetBodyFat" type="number" inputmode="decimal" min="3" max="40" step="0.5" value="${escapeHtml(profile.targetBodyFat || '')}"></div>
      </div>
      <label>${bodyText('body.activity')}</label>
      <select name="activityLevel">
        ${ACTIVITY_LEVELS.map((level) => `<option value="${level.id}"${profile.activityLevel === level.id ? ' selected' : ''}>${activityLabel(level)}</option>`).join('')}
      </select>
      <label>${bodyText('body.goal')}</label>
      <select name="goal">
        <option value="cut"${profile.goal === 'cut' ? ' selected' : ''}>${bodyText('body.cut')}</option>
        <option value="maintain"${!profile.goal || profile.goal === 'maintain' ? ' selected' : ''}>${bodyText('body.maintain')}</option>
        <option value="bulk"${profile.goal === 'bulk' ? ' selected' : ''}>${bodyText('body.bulk')}</option>
      </select>
      <button type="submit" class="log-btn">${bodyText('body.saveProfile')}</button>
    </form>
    <form class="editor-card" id="metricForm" onsubmit="saveBodyMetric(event)">
      <h3 class="block-title">${bodyText('body.today')}</h3>
      <label>${bodyText('body.weight')}</label>
      <input name="weight" type="number" inputmode="decimal" min="30" max="250" step="0.1" required>
      <details>
        <summary>${bodyText('body.measures')}</summary>
        <label>${bodyText('body.waist')}</label><input name="waistCm" type="number" inputmode="decimal" step="0.1">
        <label>${bodyText('body.neck')}</label><input name="neckCm" type="number" inputmode="decimal" step="0.1">
        <label>${bodyText('body.hip')}</label><input name="hipCm" type="number" inputmode="decimal" step="0.1">
        <label>${bodyText('body.fatManual')}</label><input name="bodyFatManual" type="number" inputmode="decimal" step="0.1">
        <label>${bodyText('body.note')}</label><input name="note" type="text">
      </details>
      <button type="submit" class="log-btn">${bodyText('body.saveWeight')}</button>
    </form>
    <div class="metric-switch">
      ${[30, 90, 0].map((days) => `<button type="button" class="mf-btn${bodyRange === days ? ' active' : ''}" onclick="setBodyRange(${days})">${days === 0 ? bodyText('body.all') : bodyText('body.days', { n: days })}</button>`).join('')}
    </div>
    <h3 class="block-title">${bodyText('body.weightTitle')}</h3>
    ${renderWeightChart(metrics)}
    <h3 class="block-title">${bodyText('body.waistTitle')}</h3>
    ${renderWaistChart(metrics)}
    <div class="calc-list">${summary.details}</div>
    <h3 class="block-title">${bodyText('body.history')}</h3>
    ${renderMetricHistory(metrics)}
    <p class="disclaimer">${typeof I18n !== 'undefined' ? I18n.t('body.disclaimer') : 'Las fórmulas son estimaciones. El IMC no distingue músculo de grasa: si entrenas, mira el % de grasa y el FFMI. Esto no es consejo médico.'}</p>`;
}

function bodySummary(profile, metrics) {
  const latest = metrics[0];
  const height = Number(profile.heightCm);
  const weight = latest ? Number(latest.weight) : null;
  const age = ageFromBirth(profile.birthDate);
  const measures = {
    sex: profile.sex,
    heightCm: height,
    waistCm: latestNumber(metrics, 'waistCm'),
    neckCm: latestNumber(metrics, 'neckCm'),
    hipCm: latestNumber(metrics, 'hipCm'),
    bodyFatManual: latestNumber(metrics, 'bodyFatManual'),
  };
  const fat = navyBodyFat(measures);
  const lean = weight != null && fat != null ? leanMass(weight, fat) : null;
  const ffmiValue = lean != null ? ffmiNormalized(lean, height) : null;
  const bmiValue = weight != null && height ? bmi(weight, height) : null;
  const maintenance = tdee(mifflin(weight, height, age, profile.sex), profile.activityLevel);
  const calories = calorieTargets(maintenance);
  const goalKey = profile.goal === 'cut' ? 'cut' : profile.goal === 'bulk' ? 'bulk' : 'maintain';
  const points = metrics
    .filter((item) => item.weight)
    .map((item) => ({ date: item.date, value: Number(item.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const averaged = movingAverage(points, 7);
  const recent = averaged.filter((point) => {
    const limit = new Date();
    limit.setDate(limit.getDate() - 28);
    return point.date >= limit.toISOString().slice(0, 10);
  });
  const weekly = trendPerWeek(recent.length >= 2 ? recent : averaged.slice(-4));
  const target = profile.targetBodyFat ? goalWeight(lean, Number(profile.targetBodyFat)) : null;
  const arrival = target != null && weight != null ? projectDate(weight, target, weekly) : null;
  const cards = [
    card(bodyText('body.weightTitle'), weight != null ? `${round1(weight)} kg` : '—'),
    card(bodyText('body.trend'), weekly == null ? '—' : `${weekly > 0 ? '+' : ''}${round1(weekly)} ${bodyText('body.week')}`),
    card(bodyText('body.fat'), fat == null ? '—' : `${round1(fat)}%`),
    card('FFMI', ffmiValue == null ? '—' : String(round1(ffmiValue))),
    card(bodyText('body.calories'), calories ? String(calories[goalKey]) : '—'),
  ].join('');

  const healthy = height ? healthyWeightRange(height) : null;
  const ideals = height ? idealWeights(height, profile.sex) : null;
  const protein = weight ? proteinRange(weight) : null;
  const lossWarn = weight && weekly != null && weekly < -(weight * 0.01) ? '<p class="warn">' + (typeof I18n !== 'undefined' ? I18n.t('body.loss') : 'El ritmo de baja supera ~1% del peso por semana.') + '</p>' : '';
  const projection =
    arrival && target != null
      ? `<p>${typeof I18n !== 'undefined' ? I18n.t('body.arrival', { kg: round1(target), date: formatDisplayDate(arrival) }) : 'Al ritmo actual llegas a ' + round1(target) + ' kg aprox. el ' + formatDisplayDate(arrival) + '.'}</p>`
      : '';
  const details = `
    ${lossWarn}
    ${projection}
    <p>${bmiValue == null ? '—' : bodyText(healthy ? 'body.bmi' : 'body.bmi.short', { value: round1(bmiValue), cat: bmiLabel(bmiValue), min: healthy ? round1(healthy.min) : '', max: healthy ? round1(healthy.max) : '' })}</p>
    ${
      ideals
        ? `<p>${bodyText('body.ideal', { devine: round1(ideals.devine), robinson: round1(ideals.robinson), miller: round1(ideals.miller), avg: round1(ideals.average) })}</p>`
        : ''
    }
    ${fat == null ? '<p>' + bodyText('body.needMeasures') + '</p>' : `<p>${bodyText('body.mass', { fat: round1(fatMass(weight, fat)), lean: round1(lean), cat: ffmiLabel(ffmiValue), note: profile.sex === 'F' ? bodyText('body.ffmiNote') : '' })}</p>`}
    ${
      target != null && weight != null
        ? `<p>${bodyText('body.targetLine', { pct: profile.targetBodyFat, kg: round1(target), delta: (weight - target >= 0 ? '−' : '+') + round1(Math.abs(weight - target)) })}</p>`
        : ''
    }
    ${calories ? `<p>${bodyText('body.energy', { bmr: round1(mifflin(weight, height, age, profile.sex)), tdee: round1(maintenance), cut: calories.cut, maintain: calories.maintain, bulk: calories.bulk })}</p>` : ''}
    ${protein ? `<p>${bodyText('body.protein', { min: round1(protein.min), max: round1(protein.max) })}</p>` : ''}`;
  return { cards, details };
}

function card(label, value) {
  return `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function latestNumber(metrics, key) {
  const found = metrics.find((item) => item[key] != null && item[key] !== '');
  return found ? Number(found[key]) : null;
}

function pointsInRange(metrics, key) {
  const points = metrics
    .filter((item) => item[key] != null && item[key] !== '')
    .map((item) => ({ date: item.date, value: Number(item[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!bodyRange) return points;
  const limit = new Date();
  limit.setDate(limit.getDate() - bodyRange);
  const iso = limit.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= iso);
}

function renderWeightChart(metrics) {
  const points = pointsInRange(metrics, 'weight');
  if (points.length < 2) return '<p class="empty-log">' + bodyText('body.weightEmpty') + '</p>';
  const average = movingAverage(points, 7);
  return svgChart(points, average);
}

function renderWaistChart(metrics) {
  const points = pointsInRange(metrics, 'waistCm');
  if (points.length < 2) return '<p class="empty-log">' + bodyText('body.waistEmpty') + '</p>';
  return svgChart(points, []);
}

function svgChart(points, average) {
  const width = 340;
  const height = 140;
  const values = points.concat(average).map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coord = (series) =>
    series
      .map((point) => {
        const index = points.findIndex((item) => item.date === point.date);
        const slot = index >= 0 ? index : series.indexOf(point);
        const x = (slot / Math.max(points.length - 1, 1)) * (width - 16) + 8;
        const y = height - 18 - ((point.value - min) / span) * (height - 32);
        return `${x},${y}`;
      })
      .join(' ');
  const dots = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * (width - 16) + 8;
      const y = height - 18 - ((point.value - min) / span) * (height - 32);
      return `<circle cx="${x}" cy="${y}" r="2.5" fill="#57c8ff"></circle>`;
    })
    .join('');
  return `<svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${bodyText('body.chart')}">${dots}<polyline fill="none" stroke="#c8ff57" stroke-width="2" points="${coord(average.length ? average : points)}"></polyline></svg>`;
}

function renderMetricHistory(metrics) {
  if (!metrics.length) return '<p class="empty-log">' + bodyText('body.historyEmpty') + '</p>';
  return metrics
    .map(
      (item) => `
      <div class="log-entry">
        <div class="log-entry-left">
          <div class="log-entry-name">${formatDisplayDate(item.date)}</div>
          <div class="log-entry-detail">${item.weight} kg${item.waistCm ? ' · ' + bodyText('body.waistShort') + ' ' + item.waistCm : ''}${item.note ? ' · ' + escapeHtml(item.note) : ''}</div>
        </div>
        <button type="button" class="log-delete" onclick="deleteBodyEntry('${item.id}')" aria-label="${bodyText('body.delete')}">×</button>
      </div>`
    )
    .join('');
}

async function saveBodyProfile(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const current = (await Storage.getProfile()) || {};
  await Storage.saveProfile({
    ...current,
    sex: form.get('sex'),
    birthDate: form.get('birthDate'),
    heightCm: Number(form.get('heightCm')) || '',
    activityLevel: form.get('activityLevel'),
    goal: form.get('goal'),
    targetBodyFat: form.get('targetBodyFat') === '' ? '' : Number(form.get('targetBodyFat')),
  });
  showToast(bodyText('body.savedProfile'));
  await renderBodyPage();
}

async function saveBodyMetric(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const date = todayIso();
  const metrics = await Storage.getBodyMetrics();
  const existing = metrics.find((item) => item.date === date);
  if (existing && !confirm(bodyText('body.replace'))) return;
  const num = (key) => {
    const value = form.get(key);
    return value === '' || value == null ? null : Number(value);
  };
  await Storage.addBodyMetric({
    id: existing ? existing.id : createId('bm'),
    date,
    weight: num('weight'),
    waistCm: num('waistCm'),
    neckCm: num('neckCm'),
    hipCm: num('hipCm'),
    bodyFatManual: num('bodyFatManual'),
    note: form.get('note') || '',
    ts: Date.now(),
  });
  showToast(bodyText('body.savedWeight'));
  await renderBodyPage();
}

async function deleteBodyEntry(id) {
  await Storage.deleteBodyMetric(id);
  await renderBodyPage();
}

async function setBodyRange(days) {
  bodyRange = days;
  await renderBodyPage();
}
