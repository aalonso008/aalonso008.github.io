let editorDayIndex = 0;
let currentRoutine = null;
let editorLibrary = [];
let searchSectionId = null;
let pendingUndo = null;

function getCurrentRoutine() {
  return currentRoutine;
}

async function setCurrentRoutine(routine) {
  currentRoutine = cloneRoutine(routine);
  if (!currentRoutine.id) currentRoutine.id = createId('rt');
  currentRoutine.version = 2;
  await Storage.saveRoutine(currentRoutine);
  await renderRoutineView(currentRoutine);
  await refreshLogExercises();
}

async function startBlankRoutine() {
  await setCurrentRoutine(createEmptyRoutine());
  hideWelcome();
  showPage('editor', document.querySelector('[data-page="editor"]'));
}

async function startTemplateRoutine() {
  const routine = await adoptTemplate(await loadDefaultRoutine());
  await setCurrentRoutine(routine);
  hideWelcome();
  showPage('rutina', document.querySelector('[data-page="rutina"]'));
}

async function resetToTemplate() {
  if (!confirm('¿Reemplazar la rutina activa con el ejemplo?')) return;
  const routine = await adoptTemplate(await loadDefaultRoutine());
  routine.id = currentRoutine ? currentRoutine.id : routine.id;
  await setCurrentRoutine(routine);
  renderEditor();
}

function hideWelcome() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.classList.remove('show');
}

function showWelcome() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.classList.add('show');
}

async function renderEditor() {
  const routine = getCurrentRoutine();
  const el = document.getElementById('page-editor');
  if (!routine || !el) return;
  editorLibrary = await Storage.getExercises();
  const routines = await Storage.getRoutines();
  if (!routine.days.length) {
    routine.days.push({ id: uid(), name: 'Día 1', short: 'D1', focus: '', tag: null, sections: [] });
  }
  if (editorDayIndex >= routine.days.length) editorDayIndex = 0;
  const day = routine.days[editorDayIndex];

  el.innerHTML = `
    <h2>Editar rutina</h2>
    <p class="sub">Los cambios se guardan en este dispositivo</p>
    <div class="editor-card">
      <label>Rutina activa</label>
      <select id="routineSelect" onchange="switchRoutine(this.value)">
        ${routines.map((item) => `<option value="${item.id}"${item.id === routine.id ? ' selected' : ''}>${escapeHtml(item.title || 'Sin nombre')}</option>`).join('')}
      </select>
      <div class="editor-actions-row">
        <button type="button" class="btn-secondary-sm" onclick="createRoutine()">Nueva</button>
        <button type="button" class="btn-secondary-sm" onclick="duplicateCurrentRoutine()">Duplicar</button>
        <button type="button" class="btn-danger-sm" onclick="deleteCurrentRoutine()">Borrar</button>
      </div>
      <div class="editor-actions-row">
        <button type="button" class="btn-secondary-sm" onclick="exportCurrentRoutine()">Exportar JSON</button>
        <button type="button" class="btn-secondary-sm" onclick="document.getElementById('importRoutineFile').click()">Importar JSON</button>
        <button type="button" class="btn-secondary-sm" onclick="shareCurrentRoutine()">Compartir</button>
        <input id="importRoutineFile" type="file" accept="application/json" hidden onchange="importRoutineFile(this)">
      </div>
    </div>
    <div class="editor-card">
      <label>Nombre de la rutina</label>
      <input type="text" id="edTitle" value="${escapeHtml(routine.title)}">
      <label>Descripción</label>
      <input type="text" id="edSubtitle" value="${escapeHtml(routine.subtitle)}">
    </div>
    <div class="editor-day-tabs" id="editorDayTabs">
      ${routine.days
        .map(
          (item, i) =>
            `<button type="button" class="tab tab-day${i === editorDayIndex ? ' active' : ''}" data-day-id="${item.id}" onclick="selectEditorDay(${i})"><span class="drag-handle" aria-label="Reordenar día">⋮⋮</span>${escapeHtml(item.short || item.name)}</button>`
        )
        .join('')}
      <button type="button" class="tab tab-add" onclick="addEditorDay()">+</button>
    </div>
    <div class="editor-card">
      <label>Día</label>
      <input type="text" id="edDayName" value="${escapeHtml(day.name)}">
      <div class="editor-row">
        <div>
          <label>Abreviatura</label>
          <input type="text" id="edDayShort" value="${escapeHtml(day.short)}" maxlength="4">
        </div>
        <div>
          <label>Enfoque</label>
          <input type="text" id="edDayFocus" value="${escapeHtml(day.focus)}">
        </div>
      </div>
      <label>Etiqueta</label>
      <input type="text" id="edDayTag" value="${escapeHtml(day.tag?.text || '')}">
      <div class="editor-actions-row">
        <button type="button" class="btn-secondary-sm" onclick="duplicateEditorDay()">Duplicar día</button>
        ${routine.days.length > 1 ? '<button type="button" class="btn-danger-sm" onclick="deleteEditorDay()">Eliminar día</button>' : ''}
      </div>
    </div>
    <div id="editorSections">${renderEditorSections(day)}</div>
    <button type="button" class="btn-secondary" onclick="addEditorSection()">+ Agregar sección</button>
    <div class="editor-footer">
      <button type="button" class="btn-secondary" onclick="openRoutineWizard('editor')">✨ Generar nueva rutina</button>
      <button type="button" class="btn-secondary" onclick="resetToTemplate()">Restaurar ejemplo</button>
      <button type="button" class="log-btn" onclick="showPage('rutina', document.querySelector('[data-page=rutina]'))">Ver rutina</button>
    </div>`;

  bindEditorInputs();
  mountSortables();
  if (searchSectionId) filterLibrarySearch(searchSectionId);
}

function renderEditorSections(day) {
  if (!day.sections.length) return '<p class="empty-day">Sin secciones. Agregá una para empezar.</p>';
  return day.sections
    .map((section) => {
      const exercises = (section.exercises || [])
        .map((slot) => {
          const lib = editorLibrary.find((ex) => ex.id === slot.exerciseId) || {
            id: slot.exerciseId,
            name: '',
            muscleGroup: 'Otro',
            muscles: [],
            tip: '',
            linkUrl: '',
          };
          const sets = slot.sets && typeof slot.sets === 'object' ? slot.sets : parseSetsText(slot.sets);
          return `
            <div class="editor-exercise" data-slot-id="${slot.id}" data-lib="${slot.exerciseId}">
              <div class="editor-section-head">
                <span class="drag-handle exercise-handle" aria-label="Reordenar ejercicio">⋮⋮</span>
                <strong>Ejercicio</strong>
                <button type="button" class="btn-secondary-sm" onclick="duplicateEditorExercise('${section.id}','${slot.id}')">Duplicar</button>
              </div>
              <input type="text" class="ed-ex-name" data-lib="${slot.exerciseId}" value="${escapeHtml(lib.name)}" placeholder="Nombre">
              <label>Grupo</label>
              <select class="ed-muscle" data-lib="${slot.exerciseId}">
                ${MUSCLE_GROUPS.map((group) => `<option${group === lib.muscleGroup ? ' selected' : ''}>${group}</option>`).join('')}
              </select>
              <div class="editor-row sets-edit">
                <div><label>Series</label><input type="number" class="ed-set-count" data-slot="${slot.id}" min="1" value="${sets.count}"></div>
                <div><label>Reps mín</label><input type="number" class="ed-set-min" data-slot="${slot.id}" min="1" value="${sets.repMin}"></div>
                <div><label>Reps máx</label><input type="number" class="ed-set-max" data-slot="${slot.id}" min="1" value="${sets.repMax}"></div>
                <div><label>Descanso (s)</label><input type="number" class="ed-set-rest" data-slot="${slot.id}" min="0" step="15" value="${sets.restSec}"></div>
              </div>
              <textarea class="ed-ex-tip" data-lib="${slot.exerciseId}" rows="2" placeholder="Tips">${escapeHtml(lib.tip || '')}</textarea>
              <input type="text" class="ed-ex-muscles" data-lib="${slot.exerciseId}" value="${escapeHtml((lib.muscles || []).join(', '))}" placeholder="Músculos, separados por coma">
              <input type="url" class="ed-ex-link" data-lib="${slot.exerciseId}" value="${escapeHtml(lib.linkUrl || '')}" placeholder="Link de técnica">
              <button type="button" class="btn-danger-sm" onclick="deleteEditorExercise('${section.id}','${slot.id}')">Eliminar ejercicio</button>
            </div>`;
        })
        .join('');
      const search =
        searchSectionId === section.id
          ? `<div class="ex-search"><input id="libSearch" type="search" placeholder="Buscar en la biblioteca" oninput="filterLibrarySearch('${section.id}')"><div id="libResults"></div><button type="button" class="btn-secondary-sm" onclick="createExerciseInSection('${section.id}')">Crear nuevo</button></div>`
          : '';
      return `
        <div class="editor-card editor-section" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="drag-handle section-handle" aria-label="Reordenar sección">⋮⋮</span>
            <input type="text" class="ed-section-label" data-section="${section.id}" value="${escapeHtml(section.label)}">
            <button type="button" class="btn-icon-danger" onclick="deleteEditorSection('${section.id}')" aria-label="Eliminar sección">×</button>
          </div>
          <div class="exercise-list" data-section-id="${section.id}">${exercises}</div>
          <button type="button" class="btn-secondary-sm" onclick="toggleExerciseSearch('${section.id}')">+ Ejercicio</button>
          ${search}
        </div>`;
    })
    .join('');
}

function bindEditorInputs() {
  const save = () => persistEditor();
  document
    .querySelectorAll('#edTitle,#edSubtitle,#edDayName,#edDayShort,#edDayFocus,#edDayTag,.ed-section-label,.ed-ex-name,.ed-muscle,.ed-set-count,.ed-set-min,.ed-set-max,.ed-set-rest,.ed-ex-tip,.ed-ex-muscles,.ed-ex-link')
    .forEach((input) => input.addEventListener('input', save));
  document.querySelectorAll('.ed-muscle').forEach((input) => input.addEventListener('change', save));
}

function mountSortables() {
  if (!window.Sortable) return;
  const days = document.getElementById('editorDayTabs');
  if (days) {
    Sortable.create(days, {
      handle: '.drag-handle',
      draggable: '.tab-day',
      animation: 150,
      onEnd: reorderDays,
    });
  }
  const sections = document.getElementById('editorSections');
  if (sections) {
    Sortable.create(sections, { handle: '.section-handle', draggable: '.editor-section', animation: 150, onEnd: reorderSections });
  }
  document.querySelectorAll('.exercise-list').forEach((list) => {
    Sortable.create(list, { handle: '.exercise-handle', animation: 150, onEnd: () => reorderExercises(list) });
  });
}

async function persistEditor() {
  const routine = getCurrentRoutine();
  if (!routine) return;
  routine.title = document.getElementById('edTitle')?.value.trim() || 'Mi Rutina';
  routine.subtitle = document.getElementById('edSubtitle')?.value.trim() || '';
  const day = routine.days[editorDayIndex];
  if (!day) return;
  day.name = document.getElementById('edDayName')?.value.trim() || 'Día';
  day.short = document.getElementById('edDayShort')?.value.trim() || day.name.slice(0, 3);
  day.focus = document.getElementById('edDayFocus')?.value.trim() || '';
  const tagText = document.getElementById('edDayTag')?.value.trim();
  day.tag = tagText ? { text: tagText, bg: day.tag?.bg || '#1a2540', color: day.tag?.color || '#57c8ff' } : null;

  document.querySelectorAll('.ed-section-label').forEach((input) => {
    const section = day.sections.find((item) => item.id === input.dataset.section);
    if (section) section.label = input.value.trim() || 'Sección';
  });

  const library = editorLibrary.slice();
  document.querySelectorAll('[data-lib].ed-ex-name, [data-lib].ed-muscle, [data-lib].ed-ex-tip, [data-lib].ed-ex-muscles, [data-lib].ed-ex-link').forEach((input) => {
    const lib = library.find((item) => item.id === input.dataset.lib);
    if (!lib) return;
    if (input.classList.contains('ed-ex-name')) lib.name = input.value.trim();
    if (input.classList.contains('ed-muscle')) lib.muscleGroup = input.value;
    if (input.classList.contains('ed-ex-tip')) lib.tip = input.value.trim();
    if (input.classList.contains('ed-ex-muscles')) lib.muscles = input.value.split(',').map((part) => part.trim()).filter(Boolean);
    if (input.classList.contains('ed-ex-link')) {
      lib.linkUrl = input.value.trim();
      lib.linkLabel = lib.linkUrl.includes('youtube') ? '▶ Buscar técnica en YouTube' : '▶ Ver técnica';
    }
  });

  day.sections.forEach((section) => {
    (section.exercises || []).forEach((slot) => {
      const count = document.querySelector(`.ed-set-count[data-slot="${slot.id}"]`);
      if (!count) return;
      slot.sets = {
        count: Math.max(1, parseInt(count.value, 10) || 1),
        repMin: Math.max(1, parseInt(document.querySelector(`.ed-set-min[data-slot="${slot.id}"]`).value, 10) || 8),
        repMax: Math.max(1, parseInt(document.querySelector(`.ed-set-max[data-slot="${slot.id}"]`).value, 10) || 12),
        restSec: Math.max(0, parseInt(document.querySelector(`.ed-set-rest[data-slot="${slot.id}"]`).value, 10) || 90),
        note: '',
      };
    });
  });

  editorLibrary = library;
  await Storage.replaceExercises(library);
  await Storage.saveRoutine(routine);
  await renderRoutineView(routine);
  await refreshLogExercises();
}

async function selectEditorDay(index) {
  await persistEditor();
  editorDayIndex = index;
  searchSectionId = null;
  renderEditor();
}

async function addEditorDay() {
  await persistEditor();
  const routine = getCurrentRoutine();
  const n = routine.days.length + 1;
  routine.days.push({ id: uid(), name: `Día ${n}`, short: `D${n}`, focus: '', tag: null, sections: [] });
  editorDayIndex = routine.days.length - 1;
  await Storage.saveRoutine(routine);
  renderEditor();
  await renderRoutineView(routine);
}

async function duplicateEditorDay() {
  await persistEditor();
  const routine = getCurrentRoutine();
  const copy = cloneRoutine(routine.days[editorDayIndex]);
  copy.id = uid();
  copy.name = `${copy.name} copia`;
  copy.short = (copy.short || 'D').slice(0, 3);
  copy.sections.forEach((section) => {
    section.id = uid();
    section.exercises.forEach((slot) => {
      slot.id = uid();
    });
  });
  routine.days.splice(editorDayIndex + 1, 0, copy);
  editorDayIndex += 1;
  await Storage.saveRoutine(routine);
  renderEditor();
  await renderRoutineView(routine);
}

async function deleteEditorDay() {
  const routine = getCurrentRoutine();
  if (!routine || routine.days.length <= 1) return;
  if (!confirm('¿Eliminar este día?')) return;
  routine.days.splice(editorDayIndex, 1);
  editorDayIndex = Math.max(0, editorDayIndex - 1);
  await Storage.saveRoutine(routine);
  renderEditor();
  await renderRoutineView(routine);
}

async function addEditorSection() {
  await persistEditor();
  const routine = getCurrentRoutine();
  routine.days[editorDayIndex].sections.push({ id: uid(), label: 'Nueva sección', exercises: [] });
  await Storage.saveRoutine(routine);
  renderEditor();
}

async function deleteEditorSection(sectionId) {
  if (!confirm('¿Eliminar esta sección y sus ejercicios?')) return;
  await persistEditor();
  const day = getCurrentRoutine().days[editorDayIndex];
  day.sections = day.sections.filter((section) => section.id !== sectionId);
  await Storage.saveRoutine(getCurrentRoutine());
  renderEditor();
  await renderRoutineView(getCurrentRoutine());
}

function toggleExerciseSearch(sectionId) {
  searchSectionId = searchSectionId === sectionId ? null : sectionId;
  renderEditor();
}

function filterLibrarySearch(sectionId) {
  const input = document.getElementById('libSearch');
  const box = document.getElementById('libResults');
  if (!input || !box) return;
  const query = normalizeName(input.value);
  const matches = editorLibrary
    .filter((ex) => !ex.archived && (!query || normalizeName(ex.name).includes(query)))
    .slice(0, 8);
  box.innerHTML = matches
    .map(
      (ex) =>
        `<button type="button" class="ex-option" onclick="addLibraryExercise('${sectionId}','${ex.id}')">${escapeHtml(ex.name)} · ${escapeHtml(ex.muscleGroup)}</button>`
    )
    .join('') || '<p class="empty-log">Sin coincidencias. Podés crear uno nuevo.</p>';
}

async function addLibraryExercise(sectionId, exerciseId) {
  await persistEditor();
  const settings = await Storage.getSettings();
  const day = getCurrentRoutine().days[editorDayIndex];
  const section = day.sections.find((item) => item.id === sectionId);
  section.exercises.push({
    id: uid(),
    exerciseId,
    sets: { count: 3, repMin: 8, repMax: 12, restSec: settings.defaultRestSec || 90, note: '' },
  });
  searchSectionId = null;
  await Storage.saveRoutine(getCurrentRoutine());
  renderEditor();
  await renderRoutineView(getCurrentRoutine());
}

async function createExerciseInSection(sectionId) {
  const settings = await Storage.getSettings();
  const lib = await Storage.saveExercise({
    id: createId('ex'),
    name: 'Nuevo ejercicio',
    muscleGroup: 'Otro',
    muscles: [],
    tip: '',
    linkUrl: '',
    linkLabel: '',
    archived: false,
  });
  editorLibrary.push(lib);
  await addLibraryExercise(sectionId, lib.id);
}

async function duplicateEditorExercise(sectionId, slotId) {
  await persistEditor();
  const section = getCurrentRoutine().days[editorDayIndex].sections.find((item) => item.id === sectionId);
  const index = section.exercises.findIndex((slot) => slot.id === slotId);
  const copy = cloneRoutine(section.exercises[index]);
  copy.id = uid();
  section.exercises.splice(index + 1, 0, copy);
  await Storage.saveRoutine(getCurrentRoutine());
  renderEditor();
  await renderRoutineView(getCurrentRoutine());
}

async function deleteEditorExercise(sectionId, slotId) {
  await persistEditor();
  const routine = getCurrentRoutine();
  const section = routine.days[editorDayIndex].sections.find((item) => item.id === sectionId);
  const index = section.exercises.findIndex((slot) => slot.id === slotId);
  if (index < 0) return;
  const removed = section.exercises[index];
  const lib = editorLibrary.find((ex) => ex.id === removed.exerciseId);
  section.exercises.splice(index, 1);
  await Storage.saveRoutine(routine);
  pendingUndo = async () => {
    section.exercises.splice(index, 0, removed);
    await Storage.saveRoutine(routine);
    renderEditor();
    await renderRoutineView(routine);
  };
  showToast(`${(lib && lib.name) || 'Ejercicio'} borrado`, {
    label: 'Deshacer',
    ms: 5000,
    onClick: async () => {
      const restore = pendingUndo;
      pendingUndo = null;
      if (restore) await restore();
    },
  });
  renderEditor();
  await renderRoutineView(routine);
}

async function reorderDays() {
  const routine = getCurrentRoutine();
  const ids = [...document.querySelectorAll('#editorDayTabs .tab-day')].map((el) => el.dataset.dayId);
  routine.days.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const active = document.querySelector('#editorDayTabs .tab.active');
  editorDayIndex = Math.max(0, routine.days.findIndex((day) => day.id === (active && active.dataset.dayId)));
  await Storage.saveRoutine(routine);
  await renderRoutineView(routine);
}

async function reorderSections() {
  const day = getCurrentRoutine().days[editorDayIndex];
  const ids = [...document.querySelectorAll('#editorSections .editor-section')].map((el) => el.dataset.sectionId);
  day.sections.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  await Storage.saveRoutine(getCurrentRoutine());
  await renderRoutineView(getCurrentRoutine());
}

async function reorderExercises(list) {
  const section = getCurrentRoutine().days[editorDayIndex].sections.find((item) => item.id === list.dataset.sectionId);
  const ids = [...list.querySelectorAll('.editor-exercise')].map((el) => el.dataset.slotId);
  section.exercises.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  await Storage.saveRoutine(getCurrentRoutine());
  await renderRoutineView(getCurrentRoutine());
}

async function createRoutine() {
  await persistEditor();
  const routine = createEmptyRoutine();
  routine.title = 'Nueva rutina';
  await setCurrentRoutine(routine);
  editorDayIndex = 0;
  renderEditor();
}

async function duplicateCurrentRoutine() {
  await persistEditor();
  const copy = cloneRoutine(getCurrentRoutine());
  copy.id = createId('rt');
  copy.title = `Copia de ${copy.title || 'rutina'}`;
  copy.days.forEach((day) => {
    day.id = uid();
    day.sections.forEach((section) => {
      section.id = uid();
      section.exercises.forEach((slot) => {
        slot.id = uid();
      });
    });
  });
  await setCurrentRoutine(copy);
  editorDayIndex = 0;
  renderEditor();
}

async function deleteCurrentRoutine() {
  const routine = getCurrentRoutine();
  const routines = await Storage.getRoutines();
  if (routines.length <= 1) return alert('Tiene que quedar al menos una rutina.');
  if (!confirm('¿Borrar esta rutina?')) return;
  await Storage.deleteRoutine(routine.id);
  currentRoutine = await Storage.getRoutine();
  editorDayIndex = 0;
  renderEditor();
  await renderRoutineView(currentRoutine);
}

async function switchRoutine(id) {
  await persistEditor();
  currentRoutine = await Storage.setActiveRoutine(id);
  editorDayIndex = 0;
  searchSectionId = null;
  renderEditor();
  await renderRoutineView(currentRoutine);
  await refreshLogExercises();
}

async function exportCurrentRoutine() {
  await persistEditor();
  const routine = getCurrentRoutine();
  const ids = new Set();
  routine.days.forEach((day) => day.sections.forEach((section) => section.exercises.forEach((slot) => ids.add(slot.exerciseId))));
  const payload = { routine, exercises: editorLibrary.filter((ex) => ids.has(ex.id)) };
  downloadJson(`rutina-${normalizeName(routine.title) || 'tu-rutina'}.json`, payload);
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function shareCurrentRoutine() {
  await persistEditor();
  const routine = getCurrentRoutine();
  const text = `${routine.title}\n${routine.days.map((day) => day.name).join(', ')}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: routine.title, text });
      return;
    } catch {
      /* el usuario canceló */
    }
  }
  await exportCurrentRoutine();
}

async function importRoutineFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const routine = data.routine || data;
    if (!routine || !Array.isArray(routine.days)) throw new Error('El archivo no tiene una lista de días.');
    routine.days.forEach((day, index) => {
      if (!day || !day.name) throw new Error(`El día ${index + 1} no tiene nombre.`);
      if (!Array.isArray(day.sections)) throw new Error(`"${day.name}" no tiene secciones.`);
      day.sections.forEach((section) => {
        if (!Array.isArray(section.exercises)) throw new Error(`Una sección de "${day.name}" no tiene ejercicios.`);
      });
    });
    const adopted = await adoptTemplate({
      title: routine.title || 'Rutina importada',
      subtitle: routine.subtitle || '',
      days: routine.days,
      exercises: data.exercises || [],
    });
    await setCurrentRoutine(adopted);
    editorDayIndex = 0;
    renderEditor();
    showToast('Rutina importada');
  } catch (error) {
    alert(error.message || 'No se pudo importar el archivo.');
  }
}

async function openEditorPage() {
  const routine = await Storage.getRoutine();
  if (!routine) {
    showWelcome();
    return;
  }
  currentRoutine = routine;
  searchSectionId = null;
  renderEditor();
}
