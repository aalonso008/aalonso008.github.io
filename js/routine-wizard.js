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
    title: '¿Cuánta experiencia tenés entrenando?',
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
    title: '¿Cuántos días por semana podés entrenar?',
    help: 'Incluí solo los días que de verdad podés sostener.',
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
    title: '¿Cuánto tiempo tenés por sesión?',
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
    title: '¿Dónde entrenás?',
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
    title: '¿Qué zonas querés priorizar?',
    help: 'Hasta 2. Si no marcás ninguna, la rutina queda equilibrada.',
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
    title: '¿Tenés alguna molestia o lesión a cuidar?',
    help: 'Si tenés una lesión, consultá con un profesional. Vamos a evitar los ejercicios que más la cargan.',
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
    title: '¿Querés incluir cardio?',
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
    help: 'Sirven para los cálculos de cuerpo. Podés saltearlos.',
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

function wizardStep() {
  return wizardSteps().find((step) => step.key === wizard.stepKey) || wizardSteps()[0];
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
  if (wizard.phase !== 'resume' && !confirm('¿Salir? Se pierden las respuestas')) return;
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
  if (wizard.phase === 'json') {
    wizard.phase = 'summary';
    renderWizard();
    persistWizard();
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
    wizard.phase = 'json';
    renderWizard();
    await persistWizard();
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
      return `<button type="button" class="wizard-option wizard-day${on ? ' selected' : ''}" role="checkbox" aria-checked="${on ? 'true' : 'false'}" onclick="toggleWizardDay('${day.value}')">${day.label}</button>`;
    }).join('');
    const count = `<p class="wizard-note">Elegí ${needed}. Vas ${selected.length}.</p>`;
    const warn = daysAreConsecutive(selected) ? '<p class="wizard-note">Hay días seguidos. Si podés, dejá un descanso entre sesiones que carguen el mismo grupo.</p>' : '';
    return `<div class="wizard-days" role="group" aria-label="Días de la semana">${chips}</div>${count}${warn}`;
  }
  if (step.type === 'profile') {
    const profile = Object.assign(emptyProfile(), wizard.answers.profile);
    const heightInvalid = profile.heightCm !== '' && profile.heightCm != null && !stepIsValid(step);
    return `
      <form class="wizard-form" onsubmit="event.preventDefault(); wizardNext();">
        <label for="wizardSex">Sexo</label>
        <select id="wizardSex" onchange="setWizardProfileField('sex', this.value)">
          <option value=""${profile.sex ? '' : ' selected'}>Sin especificar</option>
          <option value="M"${profile.sex === 'M' ? ' selected' : ''}>Masculino</option>
          <option value="F"${profile.sex === 'F' ? ' selected' : ''}>Femenino</option>
        </select>
        <label for="wizardBirth">Fecha de nacimiento</label>
        <input id="wizardBirth" type="date" value="${escapeHtml(profile.birthDate || '')}" onchange="setWizardProfileField('birthDate', this.value)">
        <label for="wizardHeight">Altura (cm)</label>
        <input id="wizardHeight" type="number" inputmode="decimal" min="120" max="230" value="${escapeHtml(profile.heightCm)}" oninput="setWizardProfileField('heightCm', this.value)">
        <label for="wizardWeight">Peso (kg)</label>
        <input id="wizardWeight" type="number" inputmode="decimal" min="30" max="250" step="0.1" value="${escapeHtml(profile.weight)}" oninput="setWizardProfileField('weight', this.value)">
        ${heightInvalid ? '<p class="wizard-note">La altura tiene que estar entre 120 y 230 cm.</p>' : ''}
        <button type="button" class="btn-secondary wizard-skip" onclick="skipWizardProfile()">Saltear</button>
      </form>`;
  }
  const current = step.type === 'multi' ? wizardAnswerList(step.key) : [wizard.answers[step.key]];
  const role = step.type === 'single' ? 'radiogroup' : 'group';
  const extra = step.max && wizardAnswerList(step.key).length >= step.max ? '<p class="wizard-note">Podés elegir hasta 2.</p>' : '';
  return `<div role="${role}" aria-label="${escapeHtml(step.title)}">${step.options.map((option) => optionButton(step, option, current.includes(option.value) || current.includes(Number(option.value)))).join('')}</div>${extra}`;
}

function setWizardProfileField(field, value) {
  wizard.answers.profile = Object.assign(emptyProfile(), wizard.answers.profile, { [field]: value });
  const note = document.querySelector('.wizard-form .wizard-note');
  const invalid = field === 'heightCm' && value !== '' && (Number(value) < 120 || Number(value) > 230);
  if (invalid && !note) {
    document.querySelector('.wizard-form').insertAdjacentHTML('beforeend', '<p class="wizard-note">La altura tiene que estar entre 120 y 230 cm.</p>');
  }
  if (!invalid && note && field === 'heightCm') note.remove();
  const next = document.getElementById('wizardNext');
  if (next) next.disabled = !stepIsValid(wizardStep());
  persistWizard();
}

function labelFor(step, value) {
  if (step.type === 'days') {
    return wizardAnswerList('preferredDays')
      .map((day) => (WIZARD_DAYS.find((item) => item.value === day) || {}).label || day)
      .join(', ');
  }
  if (step.type === 'profile') {
    const profile = wizard.answers.profile || {};
    const sex = profile.sex === 'M' ? 'Masculino' : profile.sex === 'F' ? 'Femenino' : '';
    const bits = [sex, profile.birthDate, profile.heightCm ? profile.heightCm + ' cm' : '', profile.weight ? profile.weight + ' kg' : ''].filter(Boolean);
    return bits.length ? bits.join(' · ') : 'Salteado';
  }
  if (step.type === 'multi') {
    const selected = wizardAnswerList(step.key);
    if (!selected.length) return 'Sin prioridad';
    return selected.map((item) => (step.options.find((option) => option.value === item) || {}).title || item).join(', ');
  }
  const option = (step.options || []).find((item) => item.value === value || item.value === String(value));
  return option ? option.title : 'Sin responder';
}

function summaryValue(step) {
  if (step.key === 'daysPerWeek') return (wizard.answers.daysPerWeek || '—') + ' días';
  if (step.key === 'priorities' && (!wizardAnswerList('priorities').length || wizardAnswerList('priorities').includes('balanced'))) return 'Ninguna, equilibrado';
  if (step.type === 'multi' && step.key === 'limitations' && !wizardAnswerList('limitations').length) return 'Ninguna';
  return labelFor(step, wizard.answers[step.key]);
}

function renderSummary() {
  const rows = WIZARD_STEPS.map((step) => `
    <div class="wizard-summary-row">
      <div><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(summaryValue(step))}</span></div>
      <button type="button" class="btn-secondary" onclick="editWizardStep('${step.key}')" aria-label="Editar ${escapeHtml(step.title)}">✏️</button>
    </div>`).join('');
  return `<h2 class="wizard-title">Revisá tus respuestas</h2><p class="wizard-help">Si algo no cierra, editalo antes de generar.</p>${rows}`;
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
        <h2 id="wizardTitle" class="wizard-title">Retomar donde quedaste</h2>
        <p class="wizard-help">Hay un cuestionario sin terminar en este dispositivo.</p>
        <button type="button" class="log-btn" onclick="beginWizard(true)">Retomar donde quedaste</button>
        <button type="button" class="btn-secondary modal-btn" onclick="beginWizard(false)">Empezar de nuevo</button>
      </div>`;
    back.disabled = true;
    next.disabled = true;
    next.textContent = 'Siguiente';
    return;
  }
  if (wizard.phase === 'summary' || wizard.phase === 'json') {
    label.textContent = wizard.phase === 'json' ? 'Listo' : 'Resumen';
    bar.style.width = '100%';
    body.innerHTML = `<div class="wizard-pane">${wizard.phase === 'json'
      ? `<h2 id="wizardTitle" class="wizard-title">Tus respuestas</h2><p class="wizard-help">En el próximo paso esto arma la rutina. Por ahora podés revisar el resultado.</p><pre class="wizard-json"></pre>`
      : `<div id="wizardTitle">${renderSummary()}</div>`}</div>`;
    if (wizard.phase === 'json') body.querySelector('.wizard-json').textContent = JSON.stringify(publicAnswers(), null, 2);
    back.disabled = false;
    next.disabled = wizard.phase === 'json';
    next.textContent = 'Generar mi rutina';
    next.onclick = () => wizardNext();
    return;
  }
  const step = wizardStep();
  const index = Math.max(0, steps.findIndex((item) => item.key === step.key));
  label.textContent = `Paso ${index + 1} de ${steps.length}`;
  bar.style.width = Math.round(((index + 1) / steps.length) * 100) + '%';
  body.innerHTML = `<div class="wizard-pane"><h2 id="wizardTitle" class="wizard-title">${escapeHtml(step.title)}</h2><p class="wizard-help">${escapeHtml(step.help)}</p>${renderQuestion(step)}</div>`;
  back.disabled = index === 0 && !wizard.returnToSummary;
  next.disabled = !stepIsValid(step);
  next.textContent = wizard.returnToSummary ? 'Listo' : 'Siguiente';
  next.onclick = () => wizardNext();
}

function wizardResumeNew() {
  beginWizard(false);
}
