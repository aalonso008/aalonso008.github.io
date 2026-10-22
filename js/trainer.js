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
  profile: null,
  chart: 'peso',
  templateId: null,
  manual: false,
  showAdd: false,
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
  syncTrainerWizardButton();
}

function syncTrainerWizardButton() {
  const button = document.getElementById('trainerWizard');
  if (!button) return;
  const show = trainer.view === 'student' && !!trainer.student;
  button.hidden = !show;
  if (!show) return;
  button.textContent = trainerRoutineHasExercises(trainer.routine)
    ? '✨ Cambiar con el asistente'
    : '✨ Armar con el asistente';
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
  } finally {
    syncTrainerWizardButton();
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
  const joined = trainer.students.filter((student) => student.user_id).length;
  const rows = trainer.students.map((student) => `
    <button type="button" class="trainer-card" onclick="openTrainerStudent('${student.id}')">
      <span class="coach-avatar" aria-hidden="true">${escapeHtml(coachInitial(student.name))}</span>
      <span>
        <strong>${escapeHtml(student.name)}</strong>
        <em>${escapeHtml(student.email)}</em>
      </span>
      <span class="trainer-pill${student.user_id ? ' is-on' : ''}">${student.user_id ? 'Activo' : 'Invitado'}</span>
    </button>`).join('');
  const addForm = trainer.showAdd ? `
    <form class="wizard-form coach-panel" onsubmit="createTrainerStudent(event)">
      <h3 class="wizard-title" style="font-size:18px">Nuevo alumno</h3>
      <p class="wizard-help">Usá el email con el que va a entrar. No le crea una contraseña.</p>
      <label for="studentName">Nombre</label>
      <input id="studentName" name="name" required placeholder="Nombre">
      <label for="studentEmail">Email</label>
      <input id="studentEmail" name="email" type="email" required placeholder="alumno@email.com">
      <button type="submit" class="log-btn">Crear alumno</button>
    </form>` : '';
  body.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><span>Alumnos</span><strong>${trainer.students.length}</strong></div>
      <div class="summary-card"><span>Ya ingresaron</span><strong>${joined}</strong></div>
    </div>
    <div class="trainer-actions">
      <button type="button" class="log-btn" onclick="trainer.showAdd=!trainer.showAdd; renderTrainer()">+ Alumno</button>
      <button type="button" class="btn-secondary" onclick="showTrainerTemplates()">Plantillas · ${trainer.templates.length}</button>
    </div>
    ${addForm}
    <p class="wizard-help">Abrí un alumno para armarle la rutina y ver su registro, progresión y medidas.</p>
    ${rows || '<p class="coach-empty">Todavía no tenés alumnos.</p>'}`;
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
  trainer.showAdd = false;
  await renderTrainer();
}

async function openTrainerStudent(id) {
  const client = await ensureClient();
  const { data, error } = await client.from('students').select('*').eq('id', id).maybeSingle();
  if (error) return alert(trainerMessage(error));
  trainer.student = data;
  trainer.tab = 'rutina';
  trainer.manual = false;
  trainer.view = 'student';
  await loadStudentBundle();
  await renderTrainer();
}

function coachInitial(name) {
  const letter = String(name || '?').trim().charAt(0);
  return letter ? letter.toUpperCase() : '?';
}

function scopeToStudent(query, student) {
  if (student.user_id) return query.or(`student_id.eq.${student.id},user_id.eq.${student.user_id}`);
  return query.eq('student_id', student.id);
}

async function loadScoped(client, table, student, orderColumn) {
  let query = scopeToStudent(client.from(table).select('*').eq('deleted', false), student);
  if (orderColumn) query = query.order(orderColumn, { ascending: false });
  let result = await query;
  if (result.error && student.user_id) {
    query = client.from(table).select('*').eq('student_id', student.id).eq('deleted', false);
    if (orderColumn) query = query.order(orderColumn, { ascending: false });
    result = await query;
  }
  return result;
}

async function loadStudentBundle() {
  const client = await ensureClient();
  const student = trainer.student;
  const [routines, exercises, sets, metrics, profile] = await Promise.all([
    client.from('routines').select('*').eq('student_id', student.id).eq('deleted', false),
    loadScoped(client, 'exercises', student),
    loadScoped(client, 'workout_sets', student, 'date'),
    loadScoped(client, 'body_metrics', student, 'date'),
    student.user_id
      ? client.from('profiles').select('*').eq('user_id', student.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (routines.error) throw routines.error;
  if (exercises.error) throw exercises.error;
  if (sets.error) throw sets.error;
  if (metrics.error) throw metrics.error;
  trainer.exercises = (exercises.data || []).map(exerciseFromRow);
  trainer.sets = (sets.data || []).map(setFromRow);
  trainer.metrics = (metrics.data || []).map(metricFromRow);
  trainer.profile = profile.error ? null : profile.data;
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
  const status = student.user_id
    ? 'Ya ingresó. Ve su rutina en la cuenta.'
    : 'Invitado. Cuando entre con este email, ve la rutina.';
  body.innerHTML = `
    <div class="coach-idline">
      <span class="coach-avatar" aria-hidden="true">${escapeHtml(coachInitial(student.name))}</span>
      <div>
        <strong>${escapeHtml(student.email)}</strong>
        <span class="trainer-pill${student.user_id ? ' is-on' : ''}">${escapeHtml(status)}</span>
      </div>
    </div>
    <div class="wizard-days trainer-tabs">${tabs}</div>
    ${content}
    <button type="button" class="coach-danger" onclick="deleteTrainerStudent()">Quitar alumno</button>`;
}

async function deleteTrainerStudent() {
  const student = trainer.student;
  if (!student) return;
  if (!confirm('¿Quitar a ' + student.name + '? Deja de figurar en tus alumnos. Su cuenta sigue.')) return;
  const client = await ensureClient();
  const { error } = await client.from('students').delete().eq('id', student.id).eq('trainer_id', syncUser.id);
  if (error) return alert(trainerMessage(error));
  trainer.student = null;
  trainer.view = 'home';
  showToast('Alumno quitado');
  await renderTrainer();
}

function trainerRoutineHasExercises(routine) {
  return !!(routine && (routine.days || []).some((day) => (day.sections || []).some((section) => (section.exercises || []).length)));
}

function formatTrainerSets(sets) {
  const data = sets || { count: 3, repMin: 8, repMax: 12, restSec: 90 };
  if (data.note && Number(data.count) === 1 && Number(data.repMin) === 1) return data.note;
  const reps = data.repMin === data.repMax ? String(data.repMin) : data.repMin + '–' + data.repMax;
  const rest = data.restSec ? ' · ' + data.restSec + ' s' : '';
  return (data.count || 0) + ' × ' + reps + rest;
}

function renderTrainerRoutinePreview(routine) {
  return (routine.days || []).map((day) => {
    const lines = (day.sections || []).flatMap((section) => (section.exercises || []).map((slot) => {
      const exercise = exerciseById(slot.exerciseId) || { name: slot.name || 'Ejercicio' };
      return `<li><strong>${escapeHtml(exercise.name || 'Ejercicio')}</strong><span>${escapeHtml(formatTrainerSets(slot.sets))}</span></li>`;
    })).join('');
    return `<article class="trainer-day">
      <h3>${escapeHtml(day.name || 'Día')}${day.focus ? `<small>${escapeHtml(day.focus)}</small>` : ''}</h3>
      ${lines ? `<ul>${lines}</ul>` : '<p class="wizard-help">Sin ejercicios.</p>'}
    </article>`;
  }).join('');
}

function renderTrainerTemplateTools() {
  if (!trainer.templates.length) {
    return `<div class="trainer-block">
      <h3 class="wizard-title" style="font-size:16px">Plantillas</h3>
      <p class="wizard-help">Si vas a repetir la misma rutina, armala una vez y aplicala a cada alumno.</p>
      <button type="button" class="btn-secondary" onclick="showTrainerTemplates()">Ver plantillas</button>
    </div>`;
  }
  const templateOptions = trainer.templates.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('');
  return `<div class="trainer-block">
    <h3 class="wizard-title" style="font-size:16px">Usar una plantilla</h3>
    <p class="wizard-help">Reemplaza la rutina que estás viendo de este alumno.</p>
    <div class="wizard-form">
      <label for="applyTemplate">Plantilla</label>
      <select id="applyTemplate">${templateOptions}</select>
      <button type="button" class="btn-secondary" onclick="applyTrainerTemplate()">Aplicar al alumno</button>
    </div>
  </div>`;
}

function showTrainerManual() {
  captureTrainerRoutine();
  trainer.manual = true;
  trainer.tab = 'rutina';
  renderTrainer();
}

function showTrainerSummary() {
  captureTrainerRoutine();
  trainer.manual = false;
  renderTrainer();
}

function openStudentWizard() {
  if (!trainer.student) return;
  captureTrainerRoutine();
  wizard.audience = 'student';
  wizard.studentName = trainer.student.name;
  wizard.from = 'student';
  wizard.storedProfile = null;
  wizard.prefill = typeof emptyProfile === 'function' ? emptyProfile() : {};
  wizard.skipProfile = true;
  wizard.pendingDraft = null;
  showWizardShell();
  beginWizard(false);
}

async function saveGeneratedStudentRoutine(routine, exercises) {
  trainer.routine = routine;
  trainer.exercises = exercises;
  trainer.manual = false;
  trainer.tab = 'rutina';
  await persistStudentRoutine(routine, exercises);
  await renderTrainer();
}

function exerciseById(id) {
  return trainer.exercises.find((exercise) => exercise.id === id);
}

function renderStudentRoutine(options) {
  const templateMode = options && options.mode === 'template';
  const routine = trainer.routine;
  if (!templateMode && !trainer.manual) {
    if (!trainerRoutineHasExercises(routine)) {
      return `
        <div class="trainer-hero">
          <h3 class="wizard-title" style="font-size:20px">Todavía no tiene rutina</h3>
          <p class="wizard-help">El asistente pregunta objetivo, días y equipo, y arma los ejercicios. Después podés cambiarlos.</p>
          <button type="button" class="log-btn" onclick="openStudentWizard()">Armar con el asistente</button>
          <button type="button" class="btn-secondary" onclick="showTrainerManual()">Armar a mano</button>
        </div>
        ${renderTrainerTemplateTools()}`;
    }
    return `
      <div class="trainer-hero">
        <h3 class="wizard-title" style="font-size:20px">${escapeHtml(routine.title || 'Rutina')}</h3>
        <p class="wizard-help">${escapeHtml(routine.subtitle || 'Esta es la rutina que ve el alumno.')}</p>
        <button type="button" class="log-btn" onclick="openStudentWizard()">Cambiar con el asistente</button>
        <button type="button" class="btn-secondary" onclick="showTrainerManual()">Editar a mano</button>
      </div>
      ${renderTrainerRoutinePreview(routine)}
      ${renderTrainerTemplateTools()}
      <button type="button" class="btn-secondary" onclick="saveRoutineAsTemplate()">Guardar como plantilla</button>`;
  }
  const days = (routine.days || []).map((day, dayIndex) => {
    const sections = (day.sections || []).map((section, sectionIndex) => {
      const exercises = (section.exercises || []).map((slot, slotIndex) => {
        const exercise = exerciseById(slot.exerciseId) || { name: '', muscleGroup: 'Otro' };
        const sets = slot.sets || { count: 3, repMin: 8, repMax: 12, restSec: 90 };
        const groups = (typeof MUSCLE_GROUPS !== 'undefined' ? MUSCLE_GROUPS : ['Otro']).map((group) => `<option value="${escapeHtml(group)}"${exercise.muscleGroup === group ? ' selected' : ''}>${escapeHtml(group)}</option>`).join('');
        return `
          <div class="trainer-ex">
            <input data-ex="${slot.exerciseId}" data-field="name" value="${escapeHtml(exercise.name)}" placeholder="Ejercicio">
            <select data-ex="${slot.exerciseId}" data-field="muscle">${groups}</select>
            <div class="trainer-sets">
              <label>Series<input data-slot="${slot.id}" data-field="count" type="number" min="1" max="10" value="${sets.count}"></label>
              <label>Reps mín<input data-slot="${slot.id}" data-field="repMin" type="number" min="1" max="50" value="${sets.repMin}"></label>
              <label>Reps máx<input data-slot="${slot.id}" data-field="repMax" type="number" min="1" max="50" value="${sets.repMax}"></label>
              <label>Descanso<input data-slot="${slot.id}" data-field="restSec" type="number" min="0" max="600" value="${sets.restSec}"></label>
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
  const back = templateMode ? '' : '<button type="button" class="btn-secondary" onclick="showTrainerSummary()">Ver resumen</button>';
  return `
    ${back}
    <form class="wizard-form" onsubmit="${templateMode ? 'saveTrainerTemplate(event)' : 'saveTrainerRoutine(event)'}">
      <label for="studentRoutineTitle">Nombre</label>
      <input id="studentRoutineTitle" data-bind="title" value="${escapeHtml(routine.title || '')}">
      <label for="studentRoutineSub">Descripción</label>
      <input id="studentRoutineSub" data-bind="subtitle" value="${escapeHtml(routine.subtitle || '')}">
      ${days}
      <button type="button" class="btn-secondary" onclick="addTrainerDay()">+ Día</button>
      <button type="submit" class="log-btn">${templateMode ? 'Guardar plantilla' : 'Guardar rutina'}</button>
    </form>`;
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

function trainerExerciseName(id) {
  const found = trainer.exercises.find((exercise) => exercise.id === id);
  return (found && found.name) || 'Ejercicio';
}

function renderStudentLog() {
  if (!trainer.sets.length) return '<p class="coach-empty">Todavía no hay series cargadas.</p>';
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
      .map((set) => `<li><strong>${escapeHtml(trainerExerciseName(set.exerciseId))}</strong><span>serie ${set.setNumber || '–'} · ${set.weight || 0} kg × ${set.reps || 0}</span></li>`)
      .join('');
    return `<article class="coach-session"><div class="coach-session-top"><strong>${escapeHtml(formatDisplayDate(date))}</strong><span>${sets.length} ${sets.length === 1 ? 'serie' : 'series'}</span></div><ul>${lines}</ul></article>`;
  }).join('');
}

function setTrainerChart(metric) {
  trainer.chart = metric;
  trainer.tab = 'progresion';
  renderTrainer();
}

function renderStudentProgress() {
  if (!trainer.sets.length) return '<p class="coach-empty">Cuando el alumno registre series, vas a ver el volumen, la racha y los récords.</p>';
  const bounds = weekBounds();
  const prev = previousWeekBounds();
  const thisWeek = setsInRange(trainer.sets, bounds.start, bounds.end);
  const lastWeek = setsInRange(trainer.sets, prev.start, prev.end);
  const now = Math.round(sessionVolume(thisWeek));
  const before = Math.round(sessionVolume(lastWeek));
  const sessions = monthSessions(trainer.sets);
  const streak = streakDays(trainer.sets);
  const muscleCounts = (typeof MUSCLE_GROUPS !== 'undefined' ? MUSCLE_GROUPS : []).map((group) => {
    const ids = new Set(trainer.exercises.filter((exercise) => exercise.muscleGroup === group).map((exercise) => exercise.id));
    return { group, count: thisWeek.filter((set) => ids.has(set.exerciseId)).length };
  }).filter((item) => item.count > 0);
  const bars = muscleCounts.map((item) => {
    const width = Math.min(100, Math.round((item.count / 20) * 100));
    const tone = item.count < 10 ? 'low' : item.count <= 20 ? 'ok' : 'high';
    return `<div class="muscle-bar"><div class="muscle-bar-label"><span>${escapeHtml(item.group)}</span><span>${item.count}</span></div><div class="muscle-track"><div class="muscle-fill ${tone}" style="width:${width}%"></div></div></div>`;
  }).join('');
  const metrics = ['peso', '1rm', 'volumen', 'reps'];
  const switcher = metrics.map((metric) => `<button type="button" class="mf-btn${trainer.chart === metric ? ' active' : ''}" onclick="setTrainerChart('${metric}')">${metric === '1rm' ? '1RM' : metric}</button>`).join('');
  const byExercise = new Map();
  trainer.sets.forEach((set) => {
    const list = byExercise.get(set.exerciseId) || [];
    list.push(set);
    byExercise.set(set.exerciseId, list);
  });
  const cards = [...byExercise.entries()].map(([id, sets]) => {
    const sessionsOf = groupSessions(sets);
    if (!sessionsOf.length) return '';
    const recent = sessionsOf.slice(-12);
    const points = recent.map((session) => ({
      value: sessionMetric(session, trainer.chart),
      label: formatDisplayDate(session[0].date),
    }));
    const bestWeight = Math.max(...sessionsOf.flat().map((set) => Number(set.weight) || 0));
    const bestEpley = Math.max(...sessionsOf.map((session) => sessionBestEpley(session).value));
    return `<article class="coach-session"><div class="coach-session-top"><strong>${escapeHtml(trainerExerciseName(id))}</strong><span>PR ${trimNum(bestWeight)} kg · 1RM ${trimNum(bestEpley)}</span></div>${renderLineChart(points)}</article>`;
  }).filter(Boolean).join('');
  return `
    <div class="summary-grid">
      <div class="summary-card"><span>Volumen semanal</span><strong>${now} kg</strong><small>${before ? (now - before >= 0 ? '+' : '') + (now - before) + ' vs sem. anterior' : 'Sin semana anterior'}</small></div>
      <div class="summary-card"><span>Sesiones del mes</span><strong>${sessions}</strong><small>Racha ${streak} ${streak === 1 ? 'día' : 'días'}</small></div>
    </div>
    <h3 class="block-title">Días entrenados</h3>
    ${renderHeatmap(trainer.sets)}
    <h3 class="block-title">Series de esta semana</h3>
    ${bars || '<p class="coach-empty">Esta semana todavía no hay series.</p>'}
    <div class="metric-switch">${switcher}</div>
    ${cards}`;
}

function coachMeasure(label, value, unit) {
  if (value == null || value === '') return '';
  return `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))} ${escapeHtml(unit)}</strong></div>`;
}

function renderStudentBody() {
  const profile = trainer.profile || {};
  const latest = trainer.metrics[0];
  const profileBits = [
    profile.sex === 'male' ? 'Masculino' : profile.sex === 'female' ? 'Femenino' : '',
    profile.height_cm ? profile.height_cm + ' cm' : '',
    profile.birth_date ? 'Nac. ' + profile.birth_date : '',
  ].filter(Boolean);
  const latestCards = latest ? [
    coachMeasure('Peso', latest.weight, 'kg'),
    coachMeasure('Cintura', latest.waistCm, 'cm'),
    coachMeasure('Cuello', latest.neckCm, 'cm'),
    coachMeasure('Cadera', latest.hipCm, 'cm'),
    coachMeasure('Grasa', latest.bodyFatManual, '%'),
  ].join('') : '';
  const history = trainer.metrics.map((metric) => {
    const bits = [
      metric.weight != null ? metric.weight + ' kg' : '',
      metric.waistCm ? 'cintura ' + metric.waistCm + ' cm' : '',
      metric.neckCm ? 'cuello ' + metric.neckCm + ' cm' : '',
      metric.hipCm ? 'cadera ' + metric.hipCm + ' cm' : '',
      metric.bodyFatManual != null ? 'grasa ' + metric.bodyFatManual + '%' : '',
    ].filter(Boolean);
    return `<article class="coach-session"><div class="coach-session-top"><strong>${escapeHtml(formatDisplayDate(metric.date))}</strong></div><p>${escapeHtml(bits.join(' · ') || 'Sin medidas')}${metric.note ? ' · ' + escapeHtml(metric.note) : ''}</p></article>`;
  }).join('');
  if (!latestCards && !profileBits.length && !history) return '<p class="coach-empty">Todavía no hay medidas. Cuando el alumno cargue peso o perímetros, aparecen acá.</p>';
  return `
    ${profileBits.length ? `<p class="wizard-help">${escapeHtml(profileBits.join(' · '))}</p>` : ''}
    ${latest ? `<p class="hint">Último registro · ${escapeHtml(formatDisplayDate(latest.date))}</p>` : ''}
    ${latestCards ? `<div class="summary-grid">${latestCards}</div>` : ''}
    ${history}`;
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
