/* Alumnos y plantillas del entrenador. No escribe en la rutina personal. */
const trainer = {
  view: 'home',
  role: 'athlete',
  students: [],
  templates: [],
  student: null,
  tab: 'rutina',
  routine: null,
  exercises: [],
  sets: [],
  metrics: [],
  templateId: null,
};

function trainerMessage(error) {
  const text = (error && (error.message || error.details)) || '';
  if (error && error.code === '23505') return 'Ese email ya está asociado a un alumno.';
  if (/students|routine_templates|student_id|schema cache|claim_student|\brole\b/i.test(text)) {
    return 'Falta actualizar la base. Volvé a correr supabase/schema.sql en el editor SQL.';
  }
  return text || 'No se pudo completar.';
}

function trainerOwnerId(student) {
  return (student && student.user_id) || syncUser.id;
}

function emptyTrainerRoutine(title) {
  return {
    id: createId('rt'),
    version: 2,
    title: title || 'Rutina',
    subtitle: '',
    days: [
      {
        id: uid(),
        name: 'Día 1',
        short: 'D1',
        focus: '',
        tag: null,
        sections: [{ id: uid(), label: 'Ejercicios', exercises: [] }],
      },
    ],
  };
}

async function openTrainer() {
  if (!syncUser) return showLoginGate();
  closeAccount();
  const panel = document.getElementById('trainerPanel');
  panel.hidden = false;
  panel.classList.add('show');
  trainer.view = 'home';
  await renderTrainer();
}

function closeTrainer() {
  const panel = document.getElementById('trainerPanel');
  if (!panel) return;
  panel.classList.remove('show');
  panel.hidden = true;
}

async function renderTrainer() {
  const body = document.getElementById('trainerBody');
  const title = document.getElementById('trainerTitle');
  if (!body) return;
  try {
    if (trainer.view === 'home') {
      title.textContent = 'Alumnos';
      await renderTrainerHome(body);
      return;
    }
    if (trainer.view === 'templates') {
      title.textContent = 'Plantillas';
      await renderTemplateList(body);
      return;
    }
    if (trainer.view === 'template') {
      title.textContent = 'Plantilla';
      renderTemplateEditor(body);
      return;
    }
    title.textContent = trainer.student ? trainer.student.name : 'Alumno';
    renderStudent(body);
  } catch (error) {
    body.innerHTML = `<p class="wizard-note">${escapeHtml(trainerMessage(error))}</p>`;
  }
}

async function loadTrainerRole() {
  const client = await ensureClient();
  const { data, error } = await client.from('profiles').select('role').eq('user_id', syncUser.id).maybeSingle();
  if (error) throw error;
  const role = data && data.role;
  trainer.role = role === 'trainer' || role === 'admin' ? role : 'athlete';
}

function trainerCanCoach() {
  return typeof Subscription !== 'undefined' && Subscription.allowsCoach();
}

async function renderTrainerHome(body) {
  await loadTrainerRole();
  const tt = (key) => (typeof I18n !== 'undefined' ? I18n.t(key) : key);
  if (!trainerCanCoach()) {
    body.innerHTML = `
      <h2 class="wizard-title">${tt('trainer.locked.title')}</h2>
      <p class="wizard-help">${tt('trainer.locked')}</p>
      <a class="log-btn" href="index.html#planes">${tt('trainer.plans')}</a>`;
    return;
  }
  const client = await ensureClient();
  const [students, templates] = await Promise.all([
    client.from('students').select('*').eq('trainer_id', syncUser.id).order('name'),
    client.from('routine_templates').select('id, title, subtitle').eq('trainer_id', syncUser.id).eq('deleted', false).order('title'),
  ]);
  if (students.error) throw students.error;
  if (templates.error) throw templates.error;
  trainer.students = students.data || [];
  trainer.templates = templates.data || [];
  const rows = trainer.students.map((student) => `
    <button type="button" class="wizard-option" onclick="openTrainerStudent('${student.id}')">
      <strong>${escapeHtml(student.name)}</strong>
      <em>${escapeHtml(student.email)}${student.user_id ? '' : ' · Todavía no ingresó'}</em>
    </button>`).join('');
  body.innerHTML = `
    <div class="trainer-actions">
      <button type="button" class="btn-secondary" onclick="showTrainerTemplates()">Plantillas (${trainer.templates.length})</button>
    </div>
    <p class="wizard-help">${tt('trainer.own')}</p>
    <h2 class="wizard-title">Tus alumnos</h2>
    ${rows || '<p class="wizard-help">Todavía no tienes alumnos.</p>'}
    <form class="wizard-form" onsubmit="createTrainerStudent(event)">
      <h3 class="wizard-title" style="font-size:18px">Nuevo alumno</h3>
      <label for="studentName">Nombre</label>
      <input id="studentName" name="name" required placeholder="Nombre">
      <label for="studentEmail">Email</label>
      <input id="studentEmail" name="email" type="email" required placeholder="alumno@email.com">
      <button type="submit" class="log-btn">Crear alumno</button>
    </form>`;
}

async function createTrainerStudent(event) {
  event.preventDefault();
  if (!trainerCanCoach()) return alert(typeof I18n !== 'undefined' ? I18n.t('trainer.locked') : 'Crear alumnos es parte del plan Entrenador.');
  const form = new FormData(event.target);
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const client = await ensureClient();
  const { error } = await client.from('students').insert({
    id: createId('st'),
    trainer_id: syncUser.id,
    name,
    email,
  });
  if (error) return alert(trainerMessage(error));
  await renderTrainer();
}

async function openTrainerStudent(id) {
  const client = await ensureClient();
  const { data, error } = await client.from('students').select('*').eq('id', id).maybeSingle();
  if (error) return alert(trainerMessage(error));
  trainer.student = data;
  trainer.tab = 'rutina';
  trainer.view = 'student';
  await loadStudentBundle();
  await renderTrainer();
}

async function loadStudentBundle() {
  const client = await ensureClient();
  const student = trainer.student;
  const [routines, exercises, sets, metrics] = await Promise.all([
    client.from('routines').select('*').eq('student_id', student.id).eq('deleted', false),
    client.from('exercises').select('*').eq('student_id', student.id).eq('deleted', false),
    client.from('workout_sets').select('*').eq('student_id', student.id).eq('deleted', false).order('date', { ascending: false }),
    client.from('body_metrics').select('*').eq('student_id', student.id).eq('deleted', false).order('date', { ascending: false }),
  ]);
  if (routines.error) throw routines.error;
  if (exercises.error) throw exercises.error;
  trainer.exercises = (exercises.data || []).map(exerciseFromRow);
  trainer.sets = (sets.data || []).map(setFromRow);
  trainer.metrics = (metrics.data || []).map(metricFromRow);
  const active = (routines.data || []).find((row) => row.is_active) || (routines.data || [])[0];
  trainer.routine = active
    ? Object.assign({}, active.data, { id: active.id })
    : emptyTrainerRoutine('Rutina de ' + student.name);
}

function showStudentTab(tab) {
  captureTrainerRoutine();
  trainer.tab = tab;
  renderTrainer();
}

function renderStudent(body) {
  const student = trainer.student;
  const tabs = [
    ['rutina', 'Rutina'],
    ['registro', 'Registro'],
    ['progresion', 'Progresión'],
    ['cuerpo', 'Cuerpo'],
  ].map(([id, label]) => `<button type="button" class="wizard-option wizard-day${trainer.tab === id ? ' selected' : ''}" onclick="showStudentTab('${id}')">${label}</button>`).join('');
  let content = '';
  if (trainer.tab === 'rutina') content = renderStudentRoutine();
  else if (trainer.tab === 'registro') content = renderStudentLog();
  else if (trainer.tab === 'progresion') content = renderStudentProgress();
  else content = renderStudentBody();
  body.innerHTML = `
    <p class="wizard-help">${escapeHtml(student.email)}${student.user_id ? '' : ' · Cuando entre con este email, ve esta rutina.'}</p>
    <div class="wizard-days trainer-tabs">${tabs}</div>
    ${content}`;
}

function exerciseById(id) {
  return trainer.exercises.find((exercise) => exercise.id === id);
}

function renderStudentRoutine(options) {
  const templateMode = options && options.mode === 'template';
  const routine = trainer.routine;
  const days = (routine.days || []).map((day, dayIndex) => {
    const sections = (day.sections || []).map((section, sectionIndex) => {
      const exercises = (section.exercises || []).map((slot, slotIndex) => {
        const exercise = exerciseById(slot.exerciseId) || { name: '', muscleGroup: 'Otro' };
        const sets = slot.sets || { count: 3, repMin: 8, repMax: 12, restSec: 90 };
        const options = (typeof MUSCLE_GROUPS !== 'undefined' ? MUSCLE_GROUPS : ['Otro']).map((group) => `<option value="${escapeHtml(group)}"${exercise.muscleGroup === group ? ' selected' : ''}>${escapeHtml(group)}</option>`).join('');
        return `
          <div class="trainer-ex">
            <input data-ex="${slot.exerciseId}" data-field="name" value="${escapeHtml(exercise.name)}" placeholder="Ejercicio">
            <select data-ex="${slot.exerciseId}" data-field="muscle">${options}</select>
            <div class="trainer-sets">
              <input data-slot="${slot.id}" data-field="count" type="number" min="1" max="10" value="${sets.count}" aria-label="Series">
              <input data-slot="${slot.id}" data-field="repMin" type="number" min="1" max="50" value="${sets.repMin}" aria-label="Reps mín">
              <input data-slot="${slot.id}" data-field="repMax" type="number" min="1" max="50" value="${sets.repMax}" aria-label="Reps máx">
              <input data-slot="${slot.id}" data-field="restSec" type="number" min="0" max="600" value="${sets.restSec}" aria-label="Descanso">
            </div>
            <button type="button" class="btn-secondary" onclick="removeTrainerExercise(${dayIndex}, ${sectionIndex}, ${slotIndex})">Quitar</button>
          </div>`;
      }).join('');
      return `
        <div class="editor-card">
          <input data-section="${section.id}" value="${escapeHtml(section.label || '')}" placeholder="Sección" aria-label="Sección">
          ${exercises || '<p class="wizard-help">Sin ejercicios.</p>'}
          <button type="button" class="btn-secondary" onclick="addTrainerExercise(${dayIndex}, ${sectionIndex})">+ Ejercicio</button>
        </div>`;
    }).join('');
    return `
      <div class="editor-card">
        <input data-day="${day.id}" data-field="name" value="${escapeHtml(day.name || '')}" placeholder="Día" aria-label="Día">
        <input data-day="${day.id}" data-field="focus" value="${escapeHtml(day.focus || '')}" placeholder="Enfoque" aria-label="Enfoque">
        ${sections}
        <button type="button" class="btn-secondary" onclick="removeTrainerDay(${dayIndex})">Quitar día</button>
      </div>`;
  }).join('');
  const templateOptions = trainer.templates.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('');
  const tools = templateMode
    ? ''
    : `<div class="wizard-form">
      <label for="applyTemplate">Aplicar plantilla</label>
      <select id="applyTemplate">${templateOptions || '<option value="">No hay plantillas</option>'}</select>
      <button type="button" class="btn-secondary" onclick="applyTrainerTemplate()">Aplicar al alumno</button>
      <button type="button" class="btn-secondary" onclick="saveRoutineAsTemplate()">Guardar esta rutina como plantilla</button>
    </div>`;
  return `
    <form class="wizard-form" onsubmit="${templateMode ? 'saveTrainerTemplate(event)' : 'saveTrainerRoutine(event)'}">
      <label for="studentRoutineTitle">Nombre</label>
      <input id="studentRoutineTitle" data-bind="title" value="${escapeHtml(routine.title || '')}">
      <label for="studentRoutineSub">Descripción</label>
      <input id="studentRoutineSub" data-bind="subtitle" value="${escapeHtml(routine.subtitle || '')}">
      ${days}
      <button type="button" class="btn-secondary" onclick="addTrainerDay()">+ Día</button>
      <button type="submit" class="log-btn">${templateMode ? 'Guardar plantilla' : 'Guardar rutina'}</button>
    </form>
    ${tools}`;
}

function captureTrainerRoutine() {
  const root = document.getElementById('trainerBody');
  if (!root || !trainer.routine || trainer.tab !== 'rutina' && trainer.view !== 'template') return;
  const title = root.querySelector('[data-bind="title"]');
  const subtitle = root.querySelector('[data-bind="subtitle"]');
  if (title) trainer.routine.title = title.value;
  if (subtitle) trainer.routine.subtitle = subtitle.value;
  root.querySelectorAll('[data-day]').forEach((input) => {
    const day = trainer.routine.days.find((item) => item.id === input.dataset.day);
    if (day) day[input.dataset.field] = input.value;
  });
  root.querySelectorAll('[data-section]').forEach((input) => {
    trainer.routine.days.forEach((day) => {
      const section = (day.sections || []).find((item) => item.id === input.dataset.section);
      if (section) section.label = input.value;
    });
  });
  root.querySelectorAll('[data-ex]').forEach((input) => {
    const exercise = exerciseById(input.dataset.ex);
    if (!exercise) return;
    if (input.dataset.field === 'name') exercise.name = input.value;
    if (input.dataset.field === 'muscle') exercise.muscleGroup = input.value;
  });
  root.querySelectorAll('[data-slot]').forEach((input) => {
    trainer.routine.days.forEach((day) => {
      (day.sections || []).forEach((section) => {
        const slot = (section.exercises || []).find((item) => item.id === input.dataset.slot);
        if (!slot) return;
        slot.sets = slot.sets || { count: 3, repMin: 8, repMax: 12, restSec: 90, note: '' };
        slot.sets[input.dataset.field] = Number(input.value) || 0;
      });
    });
  });
}

function addTrainerDay() {
  captureTrainerRoutine();
  const number = trainer.routine.days.length + 1;
  trainer.routine.days.push({
    id: uid(),
    name: 'Día ' + number,
    short: 'D' + number,
    focus: '',
    tag: null,
    sections: [{ id: uid(), label: 'Ejercicios', exercises: [] }],
  });
  renderTrainer();
}

function removeTrainerDay(index) {
  captureTrainerRoutine();
  if (trainer.routine.days.length <= 1) return alert('Tiene que quedar al menos un día.');
  trainer.routine.days.splice(index, 1);
  renderTrainer();
}

function addTrainerExercise(dayIndex, sectionIndex) {
  captureTrainerRoutine();
  const id = createId('ex');
  trainer.exercises.push({
    id,
    name: '',
    muscleGroup: 'Otro',
    muscles: [],
    tip: '',
    linkUrl: '',
    linkLabel: '',
    archived: false,
  });
  trainer.routine.days[dayIndex].sections[sectionIndex].exercises.push({
    id: uid(),
    exerciseId: id,
    sets: { count: 3, repMin: 8, repMax: 12, restSec: 90, note: '' },
  });
  renderTrainer();
}

function removeTrainerExercise(dayIndex, sectionIndex, slotIndex) {
  captureTrainerRoutine();
  trainer.routine.days[dayIndex].sections[sectionIndex].exercises.splice(slotIndex, 1);
  renderTrainer();
}

async function saveTrainerRoutine(event) {
  event.preventDefault();
  captureTrainerRoutine();
  try {
    await persistStudentRoutine(trainer.routine, trainer.exercises);
    showToast('Rutina guardada');
  } catch (error) {
    alert(trainerMessage(error));
  }
}

async function persistStudentRoutine(routine, exercises) {
  const client = await ensureClient();
  const owner = trainerOwnerId(trainer.student);
  for (const exercise of exercises) {
    if (!usedInRoutine(routine, exercise.id)) continue;
    const row = Object.assign(exerciseRow(exercise, owner), { student_id: trainer.student.id });
    const { error } = await client.from('exercises').upsert(row);
    if (error) throw error;
  }
  const { error } = await client.from('routines').upsert({
    id: routine.id,
    user_id: owner,
    student_id: trainer.student.id,
    data: routine,
    is_active: true,
    deleted: false,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await client.from('routines').update({ is_active: false }).eq('student_id', trainer.student.id).neq('id', routine.id);
}

function usedInRoutine(routine, exerciseId) {
  return (routine.days || []).some((day) => (day.sections || []).some((section) => (section.exercises || []).some((slot) => slot.exerciseId === exerciseId)));
}

function renderStudentLog() {
  if (!trainer.sets.length) return '<p class="wizard-help">Todavía no hay series cargadas.</p>';
  const names = new Map(trainer.exercises.map((exercise) => [exercise.id, exercise.name]));
  const groups = new Map();
  trainer.sets.forEach((set) => {
    const list = groups.get(set.date) || [];
    list.push(set);
    groups.set(set.date, list);
  });
  return [...groups.entries()].map(([date, sets]) => {
    const lines = sets
      .slice()
      .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0))
      .map((set) => `<li>${escapeHtml(names.get(set.exerciseId) || 'Ejercicio')} · serie ${set.setNumber || ''} · ${set.weight || 0} kg × ${set.reps || 0}</li>`)
      .join('');
    return `<h3 class="wizard-title" style="font-size:16px">${escapeHtml(formatDisplayDate(date))}</h3><ul class="wizard-reasons">${lines}</ul>`;
  }).join('');
}

function renderStudentProgress() {
  if (!trainer.sets.length) return '<p class="wizard-help">Cuando el alumno registre series, vas a ver el volumen acá.</p>';
  const bounds = weekBounds();
  const prev = previousWeekBounds();
  const now = Math.round(sessionVolume(setsInRange(trainer.sets, bounds.start, bounds.end)));
  const before = Math.round(sessionVolume(setsInRange(trainer.sets, prev.start, prev.end)));
  return `
    <div class="summary-card"><span>Volumen de esta semana</span><strong>${now} kg</strong><small>${before ? (now - before >= 0 ? '+' : '') + (now - before) + ' vs sem. anterior' : 'Sin semana anterior'}</small></div>
    <p class="wizard-help">${trainer.sets.length === 1 ? '1 serie cargada en total.' : trainer.sets.length + ' series cargadas en total.'}</p>`;
}

function renderStudentBody() {
  if (!trainer.metrics.length) return '<p class="wizard-help">Todavía no hay medidas.</p>';
  return trainer.metrics.map((metric) => `
    <div class="wizard-summary-row">
      <div><strong>${escapeHtml(formatDisplayDate(metric.date))}</strong><span>${metric.weight != null ? metric.weight + ' kg' : 'Sin peso'}${metric.waistCm ? ' · cintura ' + metric.waistCm + ' cm' : ''}</span></div>
    </div>`).join('');
}

async function showTrainerTemplates() {
  captureTrainerRoutine();
  trainer.view = 'templates';
  await renderTrainer();
}

async function renderTemplateList(body) {
  const client = await ensureClient();
  const { data, error } = await client.from('routine_templates').select('*').eq('trainer_id', syncUser.id).eq('deleted', false).order('title');
  if (error) throw error;
  trainer.templates = data || [];
  const rows = trainer.templates.map((item) => `
    <div class="trainer-template">
      <button type="button" class="wizard-option" onclick="editTrainerTemplate('${item.id}')"><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.subtitle || 'Sin descripción')}</em></button>
      <div class="trainer-actions">
        <button type="button" class="btn-secondary" onclick="duplicateTrainerTemplate('${item.id}')">Duplicar</button>
        <button type="button" class="btn-secondary" onclick="deleteTrainerTemplate('${item.id}')">Borrar</button>
      </div>
    </div>`).join('');
  body.innerHTML = `
    <button type="button" class="btn-secondary" onclick="trainer.view='home'; renderTrainer()">Volver a alumnos</button>
    <h2 class="wizard-title">Plantillas</h2>
    <p class="wizard-help">Armalas una vez y aplicalas a cada alumno.</p>
    ${rows || '<p class="wizard-help">No hay plantillas todavía.</p>'}
    <button type="button" class="log-btn" onclick="newTrainerTemplate()">Nueva plantilla</button>`;
}

function newTrainerTemplate() {
  trainer.templateId = null;
  trainer.routine = emptyTrainerRoutine('Plantilla nueva');
  trainer.exercises = [];
  trainer.view = 'template';
  trainer.tab = 'rutina';
  renderTrainer();
}

async function editTrainerTemplate(id) {
  const client = await ensureClient();
  const { data, error } = await client.from('routine_templates').select('*').eq('id', id).maybeSingle();
  if (error) return alert(trainerMessage(error));
  trainer.templateId = data.id;
  trainer.routine = Object.assign(emptyTrainerRoutine(data.title), data.data || {}, { id: data.id, title: data.title, subtitle: data.subtitle || '' });
  trainer.exercises = collectTemplateExercises(trainer.routine);
  trainer.view = 'template';
  trainer.tab = 'rutina';
  renderTrainer();
}

function collectTemplateExercises(routine) {
  const list = [];
  (routine.days || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        if (slot.library) {
          list.push(slot.library);
          return;
        }
        if (!list.some((item) => item.id === slot.exerciseId)) {
          list.push({
            id: slot.exerciseId,
            name: slot.name || 'Ejercicio',
            muscleGroup: slot.muscleGroup || 'Otro',
            muscles: [],
            tip: '',
            linkUrl: '',
            linkLabel: '',
            archived: false,
          });
        }
      });
    });
  });
  return list;
}

function renderTemplateEditor(body) {
  body.innerHTML = `
    <button type="button" class="btn-secondary" onclick="showTrainerTemplates()">Volver a plantillas</button>
    ${renderStudentRoutine({ mode: 'template' })}`;
}

async function saveTrainerTemplate(event) {
  event.preventDefault();
  captureTrainerRoutine();
  const routine = trainer.routine;
  (routine.days || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        const exercise = exerciseById(slot.exerciseId);
        if (exercise) {
          slot.name = exercise.name;
          slot.muscleGroup = exercise.muscleGroup;
          slot.library = exercise;
        }
      });
    });
  });
  const client = await ensureClient();
  const id = trainer.templateId || createId('tp');
  const { error } = await client.from('routine_templates').upsert({
    id,
    trainer_id: syncUser.id,
    title: routine.title || 'Plantilla',
    subtitle: routine.subtitle || '',
    data: routine,
    deleted: false,
    updated_at: new Date().toISOString(),
  });
  if (error) return alert(trainerMessage(error));
  trainer.templateId = id;
  showToast('Plantilla guardada');
  await showTrainerTemplates();
}

async function duplicateTrainerTemplate(id) {
  const client = await ensureClient();
  const { data, error } = await client.from('routine_templates').select('*').eq('id', id).maybeSingle();
  if (error || !data) return alert(trainerMessage(error || { message: 'No está la plantilla' }));
  const { error: insertError } = await client.from('routine_templates').insert({
    id: createId('tp'),
    trainer_id: syncUser.id,
    title: data.title + ' copia',
    subtitle: data.subtitle || '',
    data: data.data,
    deleted: false,
  });
  if (insertError) return alert(trainerMessage(insertError));
  await renderTrainer();
}

async function deleteTrainerTemplate(id) {
  if (!confirm('¿Borrar esta plantilla?')) return;
  const client = await ensureClient();
  const { error } = await client.from('routine_templates').update({ deleted: true }).eq('id', id).eq('trainer_id', syncUser.id);
  if (error) return alert(trainerMessage(error));
  await renderTrainer();
}

async function saveRoutineAsTemplate() {
  captureTrainerRoutine();
  const title = trainer.routine.title || 'Plantilla';
  const client = await ensureClient();
  const copy = JSON.parse(JSON.stringify(trainer.routine));
  (copy.days || []).forEach((day) => {
    (day.sections || []).forEach((section) => {
      (section.exercises || []).forEach((slot) => {
        const exercise = exerciseById(slot.exerciseId);
        if (exercise) slot.library = exercise;
      });
    });
  });
  const { error } = await client.from('routine_templates').insert({
    id: createId('tp'),
    trainer_id: syncUser.id,
    title,
    subtitle: trainer.routine.subtitle || '',
    data: copy,
    deleted: false,
  });
  if (error) return alert(trainerMessage(error));
  showToast('Plantilla guardada');
  const { data } = await client.from('routine_templates').select('id, title, subtitle').eq('trainer_id', syncUser.id).eq('deleted', false).order('title');
  trainer.templates = data || [];
  await renderTrainer();
}

function cloneTemplateData(data) {
  const copy = JSON.parse(JSON.stringify(data || emptyTrainerRoutine('Rutina')));
  const idMap = {};
  const exercises = [];
  copy.id = createId('rt');
  (copy.days || []).forEach((day) => {
    day.id = uid();
    (day.sections || []).forEach((section) => {
      section.id = uid();
      (section.exercises || []).forEach((slot) => {
        const source = slot.library || {
          id: slot.exerciseId,
          name: slot.name || 'Ejercicio',
          muscleGroup: slot.muscleGroup || 'Otro',
          muscles: [],
          tip: '',
          linkUrl: '',
          linkLabel: '',
          archived: false,
        };
        const nextId = idMap[source.id] || createId('ex');
        idMap[source.id] = nextId;
        if (!exercises.some((item) => item.id === nextId)) {
          exercises.push(Object.assign({}, source, { id: nextId }));
        }
        slot.id = uid();
        slot.exerciseId = nextId;
        delete slot.library;
        delete slot.name;
        delete slot.muscleGroup;
      });
    });
  });
  return { routine: copy, exercises };
}

async function applyTrainerTemplate() {
  const select = document.getElementById('applyTemplate');
  const id = select && select.value;
  if (!id) return alert('Elegí una plantilla.');
  if (!confirm('Esto reemplaza la rutina activa del alumno.')) return;
  const client = await ensureClient();
  const { data, error } = await client.from('routine_templates').select('*').eq('id', id).maybeSingle();
  if (error || !data) return alert(trainerMessage(error || { message: 'No está la plantilla' }));
  const cloned = cloneTemplateData(data.data);
  cloned.routine.title = data.title;
  cloned.routine.subtitle = data.subtitle || '';
  trainer.routine = cloned.routine;
  trainer.exercises = cloned.exercises;
  try {
    await persistStudentRoutine(cloned.routine, cloned.exercises);
    showToast('Plantilla aplicada');
    await renderTrainer();
  } catch (applyError) {
    alert(trainerMessage(applyError));
  }
}

function trainerBack() {
  captureTrainerRoutine();
  if (trainer.view === 'template') {
    showTrainerTemplates();
    return;
  }
  if (trainer.view === 'student' || trainer.view === 'templates') {
    trainer.view = 'home';
    trainer.student = null;
    renderTrainer();
    return;
  }
  closeTrainer();
}
