/* Cuestionario para armar una rutina. En esta fase solo junta respuestas. */
const WIZARD_DAYS = [
  { value: 'lun', label: 'Lun' },
  { value: 'mar', label: 'Mar' },
  { value: 'mie', label: 'Mié' },
  { value: 'jue', label: 'Jue' },
  { value: 'vie', label: 'Vie' },
  { value: 'sab', label: 'Sáb' },
  { value: 'dom', label: 'Dom' },
];

const WIZARD_STEPS = [
  {
    key: 'goal',
    title: '¿Cuál es tu objetivo principal?',
    help: 'Con esto definimos series, repeticiones y descansos.',
    type: 'single',
    options: [
      { value: 'hypertrophy', icon: '💪', title: 'Ganar músculo', desc: 'Más volumen y reps moderadas.' },
      { value: 'strength', icon: '🏋️', title: 'Ganar fuerza', desc: 'Pocos ejercicios básicos, más pesados.' },
      { value: 'fat_loss', icon: '🔥', title: 'Perder grasa manteniendo músculo', desc: 'Fuerza primero, sesiones más cortas.' },
      { value: 'recomp', icon: '⚖️', title: 'Recomposición', desc: 'Bajar grasa y ganar músculo a la vez.' },
      { value: 'general', icon: '🙂', title: 'Salud y estar en forma', desc: 'Una rutina simple para sostener.' },
    ],
  },
  {
    key: 'level',
    title: '¿Cuánta experiencia tienes entrenando?',
    help: 'Para ajustar la dificultad y la cantidad de series.',
    type: 'single',
    options: [
      { value: 'beginner', icon: '🌱', title: 'Principiante', desc: 'Menos de 6 meses, o volviendo después de mucho.' },
      { value: 'intermediate', icon: '📈', title: 'Intermedio', desc: 'Entre 6 meses y 2 años, constante.' },
      { value: 'advanced', icon: '🎯', title: 'Avanzado', desc: 'Más de 2 años, con técnica sólida.' },
    ],
  },
  {
    key: 'daysPerWeek',
    title: '¿Cuántos días por semana puedes entrenar?',
    help: 'Incluye solo los días que de verdad puedes sostener.',
    type: 'single',
    options: [2, 3, 4, 5, 6].map((days) => ({
      value: String(days),
      icon: '📅',
      title: days + ' días',
      desc: days === 2 ? 'Poco tiempo, cuerpo completo.' : 'Sesiones repartidas en la semana.',
    })),
  },
  {
    key: 'preferredDays',
    title: '¿Qué días?',
    help: 'Tiene que coincidir con la cantidad que elegiste.',
    type: 'days',
  },
  {
    key: 'sessionMinutes',
    title: '¿Cuánto tiempo tienes por sesión?',
    help: 'De ahí sale cuántos ejercicios entran en el día.',
    type: 'single',
    options: [
      { value: '30-45', icon: '⏱️', title: '30–45 min', desc: 'Sesión corta.' },
      { value: '45-60', icon: '⏱️', title: '45–60 min', desc: 'Lo más habitual.' },
      { value: '60-75', icon: '⏱️', title: '60–75 min', desc: 'Da para accesorios.' },
      { value: '75-90', icon: '⏱️', title: '75–90 min', desc: 'Sesión larga.' },
    ],
  },
  {
    key: 'equipment',
    title: '¿Dónde entrenas?',
    help: 'Solo vamos a usar lo que tengas a mano.',
    type: 'single',
    options: [
      { value: 'full_gym', icon: '🏢', title: 'Gimnasio completo', desc: 'Máquinas, poleas, barras y mancuernas.' },
      { value: 'basic_gym', icon: '🏋️', title: 'Gimnasio básico', desc: 'Barras, mancuernas, poleas y pocas máquinas.' },
      { value: 'home_dumbbells', icon: '🏠', title: 'Casa con mancuernas y banco', desc: 'Sin máquinas ni poleas.' },
      { value: 'bodyweight', icon: '🤸', title: 'Casa sin equipo', desc: 'Peso corporal.' },
    ],
  },
  {
    key: 'priorities',
    title: '¿Qué zonas quieres priorizar?',
    help: 'Hasta 2. Si no marcas ninguna, la rutina queda equilibrada.',
    type: 'multi',
    max: 2,
    exclusive: 'balanced',
    options: [
      { value: 'chest', title: 'Pecho' },
      { value: 'upper_chest', title: 'Pecho superior' },
      { value: 'back', title: 'Espalda' },
      { value: 'shoulders', title: 'Hombros' },
      { value: 'arms', title: 'Brazos' },
      { value: 'legs', title: 'Piernas' },
      { value: 'glutes', title: 'Glúteos' },
      { value: 'core', title: 'Core' },
      { value: 'balanced', title: 'Ninguna, equilibrado' },
    ],
  },
  {
    key: 'limitations',
    title: '¿Tienes alguna molestia o lesión a cuidar?',
    help: 'Si tienes una lesión, consulta con un profesional. Vamos a evitar los ejercicios que más la cargan.',
    type: 'multi',
    exclusive: 'none',
    options: [
      { value: 'shoulder', title: 'Hombro' },
      { value: 'knee', title: 'Rodilla' },
      { value: 'lower_back', title: 'Zona lumbar' },
      { value: 'elbow', title: 'Codo' },
      { value: 'wrist', title: 'Muñeca' },
      { value: 'none', title: 'Ninguna' },
    ],
  },
  {
    key: 'cardio',
    title: '¿Quieres incluir cardio?',
    help: 'Se suma al final de algunos días, sin reemplazar la fuerza.',
    type: 'single',
    options: [
      { value: 'none', icon: '🚫', title: 'No', desc: 'Solo fuerza.' },
      { value: 'little', icon: '🚶', title: 'Poco', desc: '1 o 2 sesiones cortas.' },
      { value: 'regular', icon: '❤️', title: 'Sí, regular', desc: '3 o más por semana.' },
    ],
  },
  {
    key: 'profile',
    title: 'Datos básicos',
    help: 'Sirven para los cálculos de cuerpo. Puedes omitirlos.',
    type: 'profile',
  },
];

const wizard = {
  from: 'editor',
  phase: 'questions',
  stepKey: 'goal',
  answers: {},
  skipProfile: false,
  forceProfile: false,
  returnToSummary: false,
  timer: null,
};

function defaultPreferredDays(count) {
  const presets = {
    2: ['lun', 'jue'],
    3: ['lun', 'mie', 'vie'],
    4: ['lun', 'mar', 'jue', 'vie'],
    5: ['lun', 'mar', 'mie', 'jue', 'vie'],
    6: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
  };
  return (presets[count] || presets[3]).slice();
}

function wizardSteps() {
  return WIZARD_STEPS.filter((step) => step.key !== 'profile' || wizard.forceProfile || !wizard.skipProfile);
}

function wt(key, vars) {
  if (typeof I18n !== 'undefined' && I18n.t) return I18n.t(key, vars);
  return key;
}

function shownStep(step) {
  if (!step || typeof I18n === 'undefined' || !I18n.localizeStep) return step;
  return I18n.localizeStep(step);
}

function wizardStep() {
  const step = wizardSteps().find((item) => item.key === wizard.stepKey) || wizardSteps()[0];
  return shownStep(step);
}

function emptyProfile() {
  return { sex: '', birthDate: '', heightCm: '', weight: '' };
}

function knownBodyProfile(profile) {
  return !!(profile && profile.sex && profile.birthDate && profile.heightCm);
}

function latestBodyWeight(metrics) {
  const rows = (metrics || []).filter((item) => item.weight != null && item.weight !== '');
  rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return rows.length ? rows[0].weight : '';
}

function preloadWizardProfile(profile, metrics) {
  return {
    sex: profile && profile.sex ? profile.sex : '',
    birthDate: profile && profile.birthDate ? profile.birthDate : '',
    heightCm: profile && profile.heightCm ? profile.heightCm : '',
    weight: latestBodyWeight(metrics),
  };
}

function wizardAnswerList(key) {
  const value = wizard.answers[key];
  return Array.isArray(value) ? value : [];
}

function daysAreConsecutive(days) {
  const selected = new Set(days);
  return WIZARD_DAYS.some((day, index) => selected.has(day.value) && selected.has(WIZARD_DAYS[(index + 1) % 7].value));
}

function stepIsValid(step) {
  if (!step) return false;
  if (step.type === 'single') return wizard.answers[step.key] != null && wizard.answers[step.key] !== '';
  if (step.type === 'days') return wizardAnswerList('preferredDays').length === Number(wizard.answers.daysPerWeek);
  if (step.type === 'multi') return wizardAnswerList(step.key).length <= (step.max || 99);
  if (step.type === 'profile') {
    const height = wizard.answers.profile && wizard.answers.profile.heightCm;
    if (height === '' || height == null) return true;
    const cm = Number(height);
    return cm >= 120 && cm <= 230;
  }
  return true;
}

async function persistWizard() {
  await Storage.saveWizardDraft({
    phase: wizard.phase,
    stepKey: wizard.stepKey,
    answers: wizard.answers,
    skipProfile: wizard.skipProfile,
    updatedAt: new Date().toISOString(),
  });
}

function setWizardLocked(locked) {
  document.querySelectorAll('header, nav, [id^="page-"]').forEach((el) => {
    if (locked) el.setAttribute('inert', '');
    else if (typeof syncUser === 'undefined' || syncUser) el.removeAttribute('inert');
  });
}

function showWizardShell() {
  const root = document.getElementById('routineWizard');
  root.hidden = false;
  root.classList.add('show');
  setWizardLocked(true);
}

function hideWizardShell() {
  const root = document.getElementById('routineWizard');
  root.classList.remove('show');
  root.hidden = true;
  setWizardLocked(false);
  clearTimeout(wizard.timer);
}

async function openRoutineWizard(from) {
  if (typeof syncUser !== 'undefined' && !syncUser) {
    if (typeof showLoginGate === 'function') showLoginGate();
    return;
  }
  wizard.from = from || 'editor';
  if (typeof hideWelcome === 'function') hideWelcome();
  if (from === 'regenerate' && currentRoutine && currentRoutine.generatedFrom && currentRoutine.generatedFrom.answers) {
    const [profile, metrics] = await Promise.all([Storage.getProfile(), Storage.getBodyMetrics()]);
    wizard.storedProfile = profile;
    wizard.prefill = preloadWizardProfile(profile, metrics);
    wizard.answers = Object.assign({ profile: emptyProfile() }, currentRoutine.generatedFrom.answers);
    wizard.skipProfile = true;
    wizard.forceProfile = false;
    wizard.phase = 'summary';
    wizard.stepKey = 'goal';
    showWizardShell();
    renderWizard();
    return;
  }
  const [draft, profile, metrics] = await Promise.all([
    Storage.getWizardDraft(),
    Storage.getProfile(),
    Storage.getBodyMetrics(),
  ]);
  wizard.storedProfile = profile;
  wizard.prefill = preloadWizardProfile(profile, metrics);
  wizard.skipProfile = knownBodyProfile(profile);
  showWizardShell();
  if (draft && draft.answers) {
    wizard.phase = 'resume';
    wizard.pendingDraft = draft;
    renderWizard();
    return;
  }
  beginWizard(false);
}

function beginWizard(fromDraft) {
  wizard.forceProfile = false;
  wizard.returnToSummary = false;
  if (!fromDraft) wizard.skipProfile = knownBodyProfile(wizard.storedProfile);
  if (fromDraft && wizard.pendingDraft) {
    const draft = wizard.pendingDraft;
    wizard.answers = draft.answers || {};
    wizard.answers.profile = Object.assign(emptyProfile(), wizard.prefill, wizard.answers.profile || {});
    wizard.skipProfile = draft.skipProfile != null ? draft.skipProfile : wizard.skipProfile;
    wizard.phase = draft.phase === 'resume' ? 'questions' : draft.phase || 'questions';
    wizard.stepKey = draft.stepKey || 'goal';
    if (!wizardSteps().some((step) => step.key === wizard.stepKey)) wizard.stepKey = 'goal';
  } else {
    wizard.answers = { profile: Object.assign(emptyProfile(), wizard.prefill) };
    wizard.phase = 'questions';
    wizard.stepKey = 'goal';
  }
  wizard.pendingDraft = null;
  renderWizard();
  persistWizard();
}

async function closeRoutineWizard() {
  if (wizard.phase !== 'resume' && !confirm(wt('wiz.exit'))) return;
  clearTimeout(wizard.timer);
  if (wizard.phase !== 'resume') await Storage.clearWizardDraft();
  hideWizardShell();
  if (wizard.from === 'welcome' && typeof showWelcome === 'function' && !currentRoutine) showWelcome();
}

function wizardBack() {
  clearTimeout(wizard.timer);
  if (wizard.returnToSummary) {
    wizard.returnToSummary = false;
    wizard.phase = 'summary';
    renderWizard();
    persistWizard();
    return;
  }
  if (wizard.phase === 'preview' || wizard.phase === 'save-choice') {
    wizard.phase = 'summary';
    renderWizard();
    return;
  }
  if (wizard.phase === 'summary') {
    const steps = wizardSteps();
    wizard.phase = 'questions';
    wizard.stepKey = steps[steps.length - 1].key;
    renderWizard();
    persistWizard();
    return;
  }
  const steps = wizardSteps();
  const index = steps.findIndex((step) => step.key === wizard.stepKey);
  if (index <= 0) return;
  wizard.stepKey = steps[index - 1].key;
  renderWizard();
  persistWizard();
}

async function wizardNext() {
  clearTimeout(wizard.timer);
  if (wizard.phase === 'summary') {
    await buildWizardRoutine();
    return;
  }
  if (wizard.phase === 'preview') {
    await askSaveGenerated(false);
    return;
  }
  if (wizard.phase !== 'questions') return;
  const step = wizardStep();
  if (!stepIsValid(step)) return;
  if (step.type === 'profile') await commitWizardProfile();
  if (wizard.returnToSummary) {
    wizard.returnToSummary = false;
    wizard.phase = 'summary';
  } else {
    const steps = wizardSteps();
    const index = steps.findIndex((item) => item.key === step.key);
    if (index < steps.length - 1) wizard.stepKey = steps[index + 1].key;
    else wizard.phase = 'summary';
  }
  renderWizard();
  await persistWizard();
}

async function commitWizardProfile() {
  const profile = wizard.answers.profile || emptyProfile();
  const current = (await Storage.getProfile()) || {};
  const next = Object.assign({}, current);
  let changed = false;
  if (profile.sex) {
    next.sex = profile.sex;
    changed = true;
  }
  if (profile.birthDate) {
    next.birthDate = profile.birthDate;
    changed = true;
  }
  if (profile.heightCm) {
    next.heightCm = Number(profile.heightCm);
    changed = true;
  }
  if (changed) await Storage.saveProfile(next);
  if (profile.weight !== '' && profile.weight != null) {
    const metrics = await Storage.getBodyMetrics();
    const date = todayIso();
    const existing = metrics.find((item) => item.date === date);
    await Storage.addBodyMetric({
      id: existing ? existing.id : createId('bm'),
      date,
      weight: Number(profile.weight),
      waistCm: existing ? existing.waistCm : null,
      neckCm: existing ? existing.neckCm : null,
      hipCm: existing ? existing.hipCm : null,
      bodyFatManual: existing ? existing.bodyFatManual : null,
      note: existing ? existing.note || '' : '',
      ts: Date.now(),
    });
  }
}

function chooseWizardSingle(key, value) {
  clearTimeout(wizard.timer);
  wizard.answers[key] = key === 'daysPerWeek' ? Number(value) : value;
  if (key === 'daysPerWeek') wizard.answers.preferredDays = defaultPreferredDays(Number(value));
  renderWizard();
  persistWizard();
  wizard.timer = setTimeout(() => {
    wizardNext().catch((error) => console.error(error));
  }, 250);
}

function toggleWizardMulti(step, value) {
  let selected = wizardAnswerList(step.key).slice();
  if (step.exclusive && value === step.exclusive) {
    selected = selected.includes(value) ? [] : [value];
  } else {
    selected = selected.filter((item) => item !== step.exclusive);
    if (selected.includes(value)) selected = selected.filter((item) => item !== value);
    else if (!step.max || selected.length < step.max) selected.push(value);
  }
  wizard.answers[step.key] = selected;
  renderWizard();
  persistWizard();
}

function toggleWizardDay(value) {
  const selected = wizardAnswerList('preferredDays').slice();
  const next = selected.includes(value) ? selected.filter((item) => item !== value) : selected.concat(value);
  wizard.answers.preferredDays = next;
  renderWizard();
  persistWizard();
}

function skipWizardProfile() {
  const profile = wizard.answers.profile;
  if (profile && profile.heightCm !== '' && profile.heightCm != null && (Number(profile.heightCm) < 120 || Number(profile.heightCm) > 230)) {
    profile.heightCm = wizard.prefill && wizard.prefill.heightCm ? wizard.prefill.heightCm : '';
  }
  if (wizard.returnToSummary) {
    wizard.returnToSummary = false;
    wizard.phase = 'summary';
    renderWizard();
    persistWizard();
    return;
  }
  const steps = wizardSteps();
  const index = steps.findIndex((step) => step.key === 'profile');
  if (index >= 0 && index < steps.length - 1) wizard.stepKey = steps[index + 1].key;
  else wizard.phase = 'summary';
  renderWizard();
  persistWizard();
}

function editWizardStep(key) {
  if (key === 'profile') wizard.forceProfile = true;
  wizard.stepKey = key;
  wizard.phase = 'questions';
  wizard.returnToSummary = true;
  renderWizard();
}

function optionButton(step, option, selected) {
  const desc = option.desc ? `<em>${escapeHtml(option.desc)}</em>` : '';
  const icon = option.icon ? escapeHtml(option.icon) + ' ' : '';
  const role = step.type === 'single' ? 'radio' : 'checkbox';
  return `<button type="button" class="wizard-option${selected ? ' selected' : ''}" role="${role}" aria-checked="${selected ? 'true' : 'false'}" onclick="${step.type === 'single' ? `chooseWizardSingle('${step.key}', '${option.value}')` : `toggleWizardMulti(wizardStep(), '${option.value}')`}">${icon}<strong>${escapeHtml(option.title)}</strong>${desc}</button>`;
}

function renderQuestion(step) {
  if (step.type === 'days') {
    const selected = wizardAnswerList('preferredDays');
    const needed = Number(wizard.answers.daysPerWeek) || 0;
    const chips = WIZARD_DAYS.map((day) => {
      const on = selected.includes(day.value);
      return `<button type="button" class="wizard-option wizard-day${on ? ' selected' : ''}" role="checkbox" aria-checked="${on ? 'true' : 'false'}" onclick="toggleWizardDay('${day.value}')">${escapeHtml(wt('dow.' + day.value))}</button>`;
    }).join('');
    const count = `<p class="wizard-note">${escapeHtml(wt('wiz.days.count', { needed, count: selected.length }))}</p>`;
    const warn = daysAreConsecutive(selected) ? `<p class="wizard-note">${escapeHtml(wt('wiz.days.warn'))}</p>` : '';
    return `<div class="wizard-days" role="group" aria-label="${escapeHtml(wt('wiz.days.label'))}">${chips}</div>${count}${warn}`;
  }
  if (step.type === 'profile') {
    const profile = Object.assign(emptyProfile(), wizard.answers.profile);
    const heightInvalid = profile.heightCm !== '' && profile.heightCm != null && !stepIsValid(step);
    return `
      <form class="wizard-form" onsubmit="event.preventDefault(); wizardNext();">
        <label for="wizardSex">${escapeHtml(wt('wiz.sex'))}</label>
        <select id="wizardSex" onchange="setWizardProfileField('sex', this.value)">
          <option value=""${profile.sex ? '' : ' selected'}>${escapeHtml(wt('wiz.unspecified'))}</option>
          <option value="M"${profile.sex === 'M' ? ' selected' : ''}>${escapeHtml(wt('wiz.male'))}</option>
          <option value="F"${profile.sex === 'F' ? ' selected' : ''}>${escapeHtml(wt('wiz.female'))}</option>
        </select>
        <label for="wizardBirth">${escapeHtml(wt('wiz.birth'))}</label>
        <input id="wizardBirth" type="date" value="${escapeHtml(profile.birthDate || '')}" onchange="setWizardProfileField('birthDate', this.value)">
        <label for="wizardHeight">${escapeHtml(wt('wiz.height'))}</label>
        <input id="wizardHeight" type="number" inputmode="decimal" min="120" max="230" value="${escapeHtml(profile.heightCm)}" oninput="setWizardProfileField('heightCm', this.value)">
        <label for="wizardWeight">${escapeHtml(wt('wiz.weight'))}</label>
        <input id="wizardWeight" type="number" inputmode="decimal" min="30" max="250" step="0.1" value="${escapeHtml(profile.weight)}" oninput="setWizardProfileField('weight', this.value)">
        ${heightInvalid ? `<p class="wizard-note">${escapeHtml(wt('wiz.height.bad'))}</p>` : ''}
        <button type="button" class="btn-secondary wizard-skip" onclick="skipWizardProfile()">${escapeHtml(wt('wiz.skip'))}</button>
      </form>`;
  }
  const current = step.type === 'multi' ? wizardAnswerList(step.key) : [wizard.answers[step.key]];
  const role = step.type === 'single' ? 'radiogroup' : 'group';
  const extra = step.max && wizardAnswerList(step.key).length >= step.max ? `<p class="wizard-note">${escapeHtml(wt('wiz.max'))}</p>` : '';
  return `<div role="${role}" aria-label="${escapeHtml(step.title)}">${step.options.map((option) => optionButton(step, option, current.includes(option.value) || current.includes(Number(option.value)))).join('')}</div>${extra}`;
}

function setWizardProfileField(field, value) {
  wizard.answers.profile = Object.assign(emptyProfile(), wizard.answers.profile, { [field]: value });
  const note = document.querySelector('.wizard-form .wizard-note');
  const invalid = field === 'heightCm' && value !== '' && (Number(value) < 120 || Number(value) > 230);
  if (invalid && !note) {
    document.querySelector('.wizard-form').insertAdjacentHTML('beforeend', '<p class="wizard-note">' + escapeHtml(wt('wiz.height.bad')) + '</p>');
  }
  if (!invalid && note && field === 'heightCm') note.remove();
  const next = document.getElementById('wizardNext');
  if (next) next.disabled = !stepIsValid(wizardStep());
  persistWizard();
}

function labelFor(step, value) {
  if (step.type === 'days') {
    return wizardAnswerList('preferredDays')
      .map((day) => wt('dow.' + day))
      .join(', ');
  }
  if (step.type === 'profile') {
    const profile = wizard.answers.profile || {};
    const sex = profile.sex === 'M' ? wt('wiz.male') : profile.sex === 'F' ? wt('wiz.female') : '';
    const bits = [sex, profile.birthDate, profile.heightCm ? profile.heightCm + ' cm' : '', profile.weight ? profile.weight + ' kg' : ''].filter(Boolean);
    return bits.length ? bits.join(' · ') : wt('wiz.skipped');
  }
  const view = shownStep(step);
  if (view.type === 'multi') {
    const selected = wizardAnswerList(view.key);
    if (!selected.length) return wt('wiz.none');
    return selected.map((item) => (view.options.find((option) => option.value === item) || {}).title || item).join(', ');
  }
  const option = (view.options || []).find((item) => item.value === value || item.value === String(value));
  return option ? option.title : wt('wiz.unanswered');
}

function summaryValue(step) {
  if (step.key === 'daysPerWeek') return (wizard.answers.daysPerWeek || '—') + ' ' + wt('wiz.days.suffix');
  if (step.key === 'priorities' && (!wizardAnswerList('priorities').length || wizardAnswerList('priorities').includes('balanced'))) return wt('wiz.balanced');
  if (step.type === 'multi' && step.key === 'limitations' && !wizardAnswerList('limitations').length) return wt('wiz.none.limits');
  return labelFor(step, wizard.answers[step.key]);
}

function renderSummary() {
  const rows = WIZARD_STEPS.map((raw) => {
    const step = shownStep(raw);
    return `
    <div class="wizard-summary-row">
      <div><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(summaryValue(raw))}</span></div>
      <button type="button" class="btn-secondary" onclick="editWizardStep('${step.key}')" aria-label="${escapeHtml(wt('wiz.edit', { title: step.title }))}">✏️</button>
    </div>`;
  }).join('');
  return `<h2 class="wizard-title">${escapeHtml(wt('wiz.review.title'))}</h2><p class="wizard-help">${escapeHtml(wt('wiz.review.help'))}</p>${rows}`;
}

function publicAnswers() {
  const answers = {
    goal: wizard.answers.goal,
    level: wizard.answers.level,
    daysPerWeek: wizard.answers.daysPerWeek,
    preferredDays: wizard.answers.preferredDays || [],
    sessionMinutes: wizard.answers.sessionMinutes,
    equipment: wizard.answers.equipment,
    priorities: wizard.answers.priorities || [],
    limitations: wizard.answers.limitations || [],
    cardio: wizard.answers.cardio,
    profile: wizard.answers.profile || emptyProfile(),
  };
  return answers;
}

function renderWizard() {
  const body = document.getElementById('wizardBody');
  const label = document.getElementById('wizardStepLabel');
  const bar = document.getElementById('wizardProgressBar');
  const back = document.getElementById('wizardBack');
  const next = document.getElementById('wizardNext');
  const steps = wizardSteps();
  if (wizard.phase === 'resume') {
    label.textContent = '';
    bar.style.width = '0%';
    body.innerHTML = `
      <div class="wizard-pane">
        <h2 id="wizardTitle" class="wizard-title">${escapeHtml(wt('wiz.resume.title'))}</h2>
        <p class="wizard-help">${escapeHtml(wt('wiz.resume.help'))}</p>
        <button type="button" class="log-btn" onclick="beginWizard(true)">${escapeHtml(wt('wiz.resume.title'))}</button>
        <button type="button" class="btn-secondary modal-btn" onclick="beginWizard(false)">${escapeHtml(wt('wiz.resume.again'))}</button>
      </div>`;
    back.disabled = true;
    next.disabled = true;
    next.textContent = wt('wiz.next');
    return;
  }
  if (wizard.phase === 'summary') {
    label.textContent = wt('wiz.summary');
    bar.style.width = '100%';
    body.innerHTML = `<div class="wizard-pane"><div id="wizardTitle">${renderSummary()}</div></div>`;
    back.disabled = false;
    next.disabled = false;
    next.textContent = wt('wiz.generate');
    next.onclick = () => wizardNext();
    return;
  }
  if (wizard.phase === 'preview' || wizard.phase === 'save-choice' || wizard.phase === 'swap') {
    label.textContent = wt('wiz.yours');
    bar.style.width = '100%';
    body.innerHTML = `<div class="wizard-pane" id="wizardTitle">${renderPreview()}</div>`;
    back.disabled = false;
    next.disabled = wizard.phase !== 'preview';
    next.textContent = wt('wiz.save');
    next.onclick = () => wizardNext();
    return;
  }
  const step = wizardStep();
  const index = Math.max(0, steps.findIndex((item) => item.key === step.key));
  label.textContent = wt('wiz.step', { n: index + 1, total: steps.length });
  bar.style.width = Math.round(((index + 1) / steps.length) * 100) + '%';
  body.innerHTML = `<div class="wizard-pane"><h2 id="wizardTitle" class="wizard-title">${escapeHtml(step.title)}</h2><p class="wizard-help">${escapeHtml(step.help)}</p>${renderQuestion(step)}</div>`;
  back.disabled = index === 0 && !wizard.returnToSummary;
  next.disabled = !stepIsValid(step);
  next.textContent = wizard.returnToSummary ? wt('wiz.done') : wt('wiz.next');
  next.onclick = () => wizardNext();
}

function wizardResumeNew() {
  beginWizard(false);
}

function catalogExercise(key) {
  return (wizard.catalog || []).find((exercise) => exercise.key === key);
}

function cleanAnswers(answers) {
  const next = Object.assign({}, answers);
  next.priorities = (next.priorities || []).filter((item) => item !== 'balanced');
  next.limitations = (next.limitations || []).filter((item) => item !== 'none');
  return next;
}

async function buildWizardRoutine(seed) {
  try {
  const next = document.getElementById('wizardNext');
  if (next) {
    next.disabled = true;
    next.textContent = 'Armando…';
  }
  if (!wizard.catalog) {
    const response = await fetch('data/exercise-catalog.json');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    wizard.catalog = await response.json();
  }
  const generated = generateRoutine(cleanAnswers(publicAnswers()), wizard.catalog, seed == null ? {} : { seed: seed >>> 0 });
  generated.routine.generatedFrom.createdAt = new Date().toISOString();
  wizard.generated = generated;
  wizard.seed = generated.meta.seed;
  wizard.previewDay = 0;
  wizard.phase = 'preview';
  renderWizard();
  } catch (error) {
    if (typeof alert === 'function') alert(error.message || 'No se pudo armar la rutina');
    wizard.phase = 'summary';
    renderWizard();
  }
}

function previewVolume() {
  const totals = {};
  wizard.generated.routine.days.forEach((day) => {
    day.sections.forEach((section) => {
      section.exercises.forEach((slot) => {
        if (!slot.muscleGroup || slot.muscleGroup === 'Otro' || slot.pattern === 'cardio') return;
        totals[slot.muscleGroup] = (totals[slot.muscleGroup] || 0) + slot.sets.count;
      });
    });
  });
  return totals;
}

function formatSlot(slot) {
  if (slot.pattern === 'cardio') return slot.sets.note || '15–20 min';
  const sets = slot.sets;
  const reps = sets.repMin === sets.repMax ? String(sets.repMin) : sets.repMin + '–' + sets.repMax;
  const rest = sets.restSec ? ' · ' + sets.restSec + ' s' : '';
  return sets.count + ' × ' + reps + rest;
}

function renderPreview() {
  if (wizard.phase === 'save-choice') {
    return `<h2 class="wizard-title">${escapeHtml(wt('wiz.replace.title'))}</h2>
      <p class="wizard-help">${escapeHtml(wt('wiz.replace.help'))}</p>
      <button type="button" class="log-btn" onclick="saveGeneratedRoutine('replace')">${escapeHtml(wt('wiz.replace'))}</button>
      <button type="button" class="btn-secondary modal-btn" onclick="saveGeneratedRoutine('new')">${escapeHtml(wt('wiz.save.new'))}</button>`;
  }
  const generated = wizard.generated;
  const routine = generated.routine;
  const day = routine.days[wizard.previewDay] || routine.days[0];
  if (wizard.phase === 'swap' && wizard.swap) {
    const options = wizard.swap.options.map((exercise) => `<button type="button" class="wizard-option" onclick="applyWizardSwap('${exercise.key}')"><strong>${escapeHtml(exercise.name)}</strong><em>${escapeHtml(exercise.muscleGroup)}</em></button>`).join('');
    return `<h2 class="wizard-title">${escapeHtml(wt('wiz.swap.title'))}</h2><p class="wizard-help">${escapeHtml(wt('wiz.swap.help'))}</p>${options || `<p class="wizard-help">${escapeHtml(wt('wiz.swap.empty'))}</p>`}<button type="button" class="btn-secondary" onclick="cancelWizardSwap()">${escapeHtml(wt('wiz.swap.back'))}</button>`;
  }
  const tabs = routine.days.map((item, index) => `<button type="button" class="wizard-option wizard-day${index === wizard.previewDay ? ' selected' : ''}" onclick="selectPreviewDay(${index})">${escapeHtml(item.short || item.name)}</button>`).join('');
  const blocks = day.sections.map((section, sectionIndex) => {
    const rows = section.exercises.map((slot, slotIndex) => {
      const exercise = catalogExercise(slot.exerciseId);
      const name = exercise ? exercise.name : slot.exerciseId;
      return `<div class="wizard-summary-row">
        <div><strong>${escapeHtml(section.label)}</strong><span>${escapeHtml(name)}</span><em class="wizard-help">${escapeHtml(formatSlot(slot))}</em></div>
        <button type="button" class="btn-secondary" onclick="openWizardSwap(${wizard.previewDay}, ${sectionIndex}, ${slotIndex})" aria-label="Cambiar ${escapeHtml(name)}">🔄</button>
        <button type="button" class="btn-secondary" onclick="removeWizardExercise(${wizard.previewDay}, ${sectionIndex}, ${slotIndex})" aria-label="Quitar ${escapeHtml(name)}">🗑️</button>
      </div>`;
    }).join('');
    return rows;
  }).join('');
  const volume = previewVolume();
  const bars = Object.keys(volume).map((group) => {
    const width = Math.min(100, volume[group] * 4);
    return `<div class="muscle-bar"><div class="muscle-bar-label"><span>${escapeHtml(group)}</span><span>${volume[group]}</span></div><div class="muscle-track"><div class="muscle-fill ok" style="width:${width}%"></div></div></div>`;
  }).join('');
  const reasons = (generated.meta.reasons || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const warnings = (generated.meta.warnings || []).map((line) => `<p class="wizard-note">${escapeHtml(line)}</p>`).join('');
  return `<h2 class="wizard-title">${escapeHtml(routine.title)}</h2>
    <p class="wizard-help">${escapeHtml(routine.subtitle || '')}</p>
    <div class="wizard-days">${tabs}</div>
    <h3 class="wizard-title" style="font-size:18px;margin-top:16px">${escapeHtml(day.name)}</h3>
    <p class="wizard-help">${escapeHtml(day.focus || '')}</p>
    ${blocks}
    <h3 class="wizard-title" style="font-size:18px;margin-top:16px">${escapeHtml(wt('wiz.volume'))}</h3>
    ${bars}
    <h3 class="wizard-title" style="font-size:18px;margin-top:16px">${escapeHtml(wt('wiz.why'))}</h3>
    <ul class="wizard-reasons">${reasons}</ul>
    ${warnings}
    <button type="button" class="btn-secondary modal-btn" onclick="buildWizardRoutine(${(wizard.seed + 17) >>> 0})">${escapeHtml(wt('wiz.another'))}</button>
    <button type="button" class="btn-secondary modal-btn" onclick="wizard.phase='summary'; renderWizard()">${escapeHtml(wt('wiz.change.answers'))}</button>
    <button type="button" class="btn-secondary modal-btn" onclick="askSaveGenerated(true)">${escapeHtml(wt('wiz.save.edit'))}</button>`;
}

function selectPreviewDay(index) {
  wizard.previewDay = index;
  renderWizard();
}

function openWizardSwap(dayIndex, sectionIndex, slotIndex) {
  const slot = wizard.generated.routine.days[dayIndex].sections[sectionIndex].exercises[slotIndex];
  const answers = cleanAnswers(publicAnswers());
  const options = (wizard.catalog || []).filter((exercise) => {
    if (exercise.pattern !== slot.pattern || exercise.key === slot.exerciseId) return false;
    if (!exercise.equipment.includes(answers.equipment)) return false;
    if ((exercise.avoidIf || []).some((item) => (answers.limitations || []).includes(item))) return false;
    if (answers.level === 'beginner' && exercise.difficulty >= 3) return false;
    return true;
  }).slice(0, 5);
  wizard.swap = { dayIndex, sectionIndex, slotIndex, options };
  wizard.phase = 'swap';
  renderWizard();
}

function cancelWizardSwap() {
  wizard.phase = 'preview';
  wizard.swap = null;
  renderWizard();
}

function applyWizardSwap(key) {
  const exercise = catalogExercise(key);
  const slot = wizard.generated.routine.days[wizard.swap.dayIndex].sections[wizard.swap.sectionIndex].exercises[wizard.swap.slotIndex];
  slot.exerciseId = exercise.key;
  slot.catalogKey = exercise.key;
  slot.muscleGroup = exercise.muscleGroup;
  slot.type = exercise.type;
  slot.pattern = exercise.pattern;
  wizard.phase = 'preview';
  wizard.swap = null;
  renderWizard();
}

function removeWizardExercise(dayIndex, sectionIndex, slotIndex) {
  const day = wizard.generated.routine.days[dayIndex];
  const total = day.sections.reduce((sum, section) => sum + section.exercises.length, 0);
  if (total <= 3) {
    showToast('Dejá al menos 3 ejercicios en el día');
    return;
  }
  day.sections[sectionIndex].exercises.splice(slotIndex, 1);
  day.sections = day.sections.filter((section) => section.exercises.length);
  renderWizard();
}

async function askSaveGenerated(openEditor) {
  wizard.openEditorAfter = !!openEditor;
  const existing = typeof getCurrentRoutine === 'function' ? getCurrentRoutine() : null;
  if (existing && existing.days && existing.days.some((day) => (day.sections || []).some((section) => (section.exercises || []).length))) {
    wizard.phase = 'save-choice';
    renderWizard();
    return;
  }
  await saveGeneratedRoutine('replace');
}

async function saveGeneratedRoutine(mode) {
  const routine = JSON.parse(JSON.stringify(wizard.generated.routine));
  const library = await Storage.getExercises();
  const byKey = new Map(library.filter((exercise) => exercise.catalogKey).map((exercise) => [exercise.catalogKey, exercise]));
  const byName = new Map(library.map((exercise) => [normalizeName(exercise.name), exercise]));
  routine.days.forEach((day) => {
    day.sections.forEach((section) => {
      section.exercises.forEach((slot) => {
        const cat = catalogExercise(slot.catalogKey || slot.exerciseId);
        if (!cat) return;
        let stored = byKey.get(cat.key) || byName.get(normalizeName(cat.name));
        if (!stored) {
          stored = {
            id: createId('ex'),
            catalogKey: cat.key,
            name: cat.name,
            muscleGroup: cat.muscleGroup,
            muscles: cat.primary || [],
            tip: cat.tip || '',
            linkUrl: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cat.name + ' técnica'),
            linkLabel: cat.linkLabel || '▶ Buscar técnica en YouTube',
            archived: false,
          };
          library.push(stored);
          byKey.set(cat.key, stored);
          byName.set(normalizeName(cat.name), stored);
        } else if (!stored.catalogKey) {
          stored.catalogKey = cat.key;
        }
        slot.exerciseId = stored.id;
        delete slot.catalogKey;
        delete slot.muscleGroup;
        delete slot.type;
        delete slot.pattern;
      });
    });
  });
  await Storage.replaceExercises(library);
  const existing = typeof getCurrentRoutine === 'function' ? getCurrentRoutine() : null;
  if (mode === 'new' || !existing) routine.id = createId('rt');
  else routine.id = existing.id;
  routine.generatedFrom.createdAt = new Date().toISOString();
  const saved = await Storage.saveRoutine(routine);
  if (typeof setCurrentRoutine === 'function') await setCurrentRoutine(saved);
  await Storage.clearWizardDraft();
  hideWizardShell();
  if (typeof showToast === 'function') showToast('¡Rutina lista!');
  const page = wizard.openEditorAfter ? 'editor' : 'rutina';
  if (typeof showPage === 'function') showPage(page, document.querySelector('[data-page="' + page + '"]'));
}
