let wakeLock = null;
let workoutClock = null;

function workoutState() {
  try {
    return JSON.parse(sessionStorage.getItem('tu_rutina_workout') || 'null');
  } catch {
    return null;
  }
}

function saveWorkoutState(state) {
  sessionStorage.setItem('tu_rutina_workout', JSON.stringify(state));
}

function workoutIsOpen() {
  const el = document.getElementById('workout');
  return !!(el && el.classList.contains('show'));
}

async function requestWake() {
  try {
    if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    wakeLock = null;
  }
}

function releaseWake() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && workoutIsOpen()) requestWake();
});

async function startWorkout(dayIndex) {
  const routine = await getActiveRoutine();
  if (!routine || !routine.days[dayIndex]) return;
  saveWorkoutState({ dayId: routine.days[dayIndex].id, index: 0, startedAt: Date.now(), prs: [] });
  document.getElementById('workout').classList.add('show');
  await requestWake();
  await renderWorkout();
}

async function resumeWorkout() {
  if (!workoutState()) return;
  document.getElementById('workout').classList.add('show');
  const banner = document.getElementById('resumeBanner');
  if (banner) banner.hidden = true;
  await requestWake();
  await renderWorkout();
}

function noteWorkoutPr(exerciseId) {
  const state = workoutState();
  if (!state) return;
  if (!state.prs.includes(exerciseId)) state.prs.push(exerciseId);
  saveWorkoutState(state);
}

async function renderWorkout() {
  const state = workoutState();
  const root = document.getElementById('workout');
  if (!state || !root) return;
  const routine = await getActiveRoutine();
  const library = await Storage.getExercises();
  const settings = await Storage.getSettings();
  const sets = await Storage.getSets();
  currentSettings = settings;
  const day = (routine && routine.days.find((item) => item.id === state.dayId)) || (routine && routine.days[0]);
  if (!day) return;
  const exercises = [];
  (day.sections || []).forEach((section) => {
    (section.exercises || []).forEach((slot) => exercises.push(resolveSlot(slot, library)));
  });
  if (!exercises.length) {
    root.innerHTML = `<div class="workout-card"><p>Este día no tiene ejercicios.</p><button type="button" class="btn-secondary" onclick="closeWorkout()">Cerrar</button></div>`;
    return;
  }
  if (state.index >= exercises.length) state.index = exercises.length - 1;
  if (state.index < 0) state.index = 0;
  saveWorkoutState(state);
  const exercise = exercises[state.index];
  root.innerHTML = `
    <div class="workout-top">
      <button type="button" class="ghost-btn" onclick="closeWorkout()">Cerrar</button>
      <strong id="workoutClock">00:00</strong>
      <span>${state.index + 1}/${exercises.length}</span>
    </div>
    <div class="workout-card">
      <h2>${escapeHtml(exercise.name)}</h2>
      <p class="sub">${escapeHtml(formatSets(exercise.sets))}</p>
      ${exercise.tip ? `<details class="workout-tip"><summary>Técnica</summary><p>${escapeHtml(exercise.tip)}</p></details>` : ''}
      ${renderSetEditor(exercise, sets, settings)}
      <div class="workout-nav">
        <button type="button" class="btn-secondary" onclick="shiftWorkout(-1)" ${state.index === 0 ? 'disabled' : ''}>Anterior</button>
        ${
          state.index === exercises.length - 1
            ? '<button type="button" class="log-btn" onclick="finishWorkout()">Finalizar</button>'
            : '<button type="button" class="log-btn" onclick="shiftWorkout(1)">Siguiente</button>'
        }
      </div>
    </div>`;
  tickWorkoutClock();
}

function tickWorkoutClock() {
  clearInterval(workoutClock);
  const paint = () => {
    const state = workoutState();
    const el = document.getElementById('workoutClock');
    if (!state || !el) return;
    const seconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
  };
  paint();
  workoutClock = setInterval(paint, 1000);
}

async function shiftWorkout(delta) {
  const state = workoutState();
  if (!state) return;
  captureSetDrafts();
  state.index += delta;
  saveWorkoutState(state);
  await renderWorkout();
}

function closeWorkout() {
  clearInterval(workoutClock);
  releaseWake();
  document.getElementById('workout').classList.remove('show');
  document.getElementById('workout').innerHTML = '';
  const banner = document.getElementById('resumeBanner');
  if (banner && workoutState()) banner.hidden = false;
}

async function finishWorkout() {
  const state = workoutState();
  const routine = await getActiveRoutine();
  const library = await Storage.getExercises();
  const sets = await Storage.getSets();
  const started = state ? state.startedAt : Date.now();
  const day = routine && routine.days.find((item) => item.id === state.dayId);
  const ids = new Set();
  if (day) {
    day.sections.forEach((section) => section.exercises.forEach((slot) => ids.add(slot.exerciseId)));
  }
  const done = sets.filter((set) => ids.has(set.exerciseId) && set.ts >= started);
  const volume = Math.round(sessionVolume(done));
  const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
  sessionStorage.removeItem('tu_rutina_workout');
  clearInterval(workoutClock);
  releaseWake();
  const root = document.getElementById('workout');
  root.classList.add('show');
  root.innerHTML = `
    <div class="workout-card">
      <h2>Listo</h2>
      <p class="sub">${minutes} min · ${done.length} series · ${volume} kg de volumen</p>
      <p>${state && state.prs.length ? `PRs nuevos: ${state.prs.length}` : 'Sin PRs nuevos en esta sesión.'}</p>
      <button type="button" class="log-btn" onclick="dismissWorkout()">Cerrar</button>
    </div>`;
  const names = (state && state.prs) || [];
  if (names.length) {
    const labels = names.map((id) => (library.find((ex) => ex.id === id) || {}).name).filter(Boolean);
    if (labels.length) root.querySelector('p:last-of-type').textContent = `PRs: ${labels.join(', ')}`;
  }
  const banner = document.getElementById('resumeBanner');
  if (banner) banner.hidden = true;
}

function dismissWorkout() {
  document.getElementById('workout').classList.remove('show');
  document.getElementById('workout').innerHTML = '';
}

function offerResumeWorkout() {
  const banner = document.getElementById('resumeBanner');
  if (banner) banner.hidden = !workoutState();
}
