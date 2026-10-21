(function () {
  const state = { cycle: 'month', plan: 'pro', compare: 'trial', screen: 'rutina' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const routine = { goal: 'hypertrophy', days: 4, place: 'full_gym' };
  const log = { weight: 60, reps: 10, sets: [] };
  const body = { weight: 74, height: 175, sex: 'M', activity: 'moderate' };
  let restTimer = null;
  let restLeft = 0;

  const GOALS = {
    hypertrophy: { label: 'Ganar músculo', reps: '8–12' },
    strength: { label: 'Ganar fuerza', reps: '4–6' },
    fat_loss: { label: 'Perder grasa', reps: '8–12' },
    general: { label: 'Estar en forma', reps: '8–15' },
  };
  const PLACES = {
    full_gym: ['Press en banca', 'Remo en polea', 'Prensa'],
    basic_gym: ['Press con barra', 'Remo con barra', 'Sentadilla'],
    home_dumbbells: ['Press con mancuernas', 'Remo a una mano', 'Sentadilla goblet'],
    bodyweight: ['Flexiones', 'Remo invertido', 'Sentadilla'],
  };
  const SPLITS = {
    2: ['Cuerpo completo A', 'Cuerpo completo B'],
    3: ['Empuje', 'Tirón', 'Piernas'],
    4: ['Torso', 'Piernas', 'Torso', 'Piernas'],
    5: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos'],
    6: ['Empuje', 'Tirón', 'Piernas', 'Empuje', 'Tirón', 'Piernas'],
  };
  const STUDENTS = [
    { id: 'lucia', name: 'Lucía', goal: 'Glúteos · 4 días', last: 'Ayer · hip thrust 70 kg' },
    { id: 'martin', name: 'Martín', goal: 'Fuerza · 3 días', last: 'Lunes · sentadilla 100 kg' },
    { id: 'sofia', name: 'Sofía', goal: 'Recomposición · 5 días', last: 'Todavía sin series' },
  ];
  let studentId = 'lucia';
  let applied = {};

  function $(id) {
    return document.getElementById(id);
  }

  function animateNumber(el, to) {
    const target = Math.round(to);
    const from = Number(el.dataset.value || target);
    el.dataset.value = String(target);
    if (reduced || from === target) {
      el.textContent = Subscription.money(target);
      return;
    }
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Subscription.money(from + (target - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = Subscription.money(target);
    }
    requestAnimationFrame(frame);
  }

  function ctaLabel() {
    const info = Subscription.status();
    if (info.state === 'trial') return 'Entrar · ' + info.daysLeft + (info.daysLeft === 1 ? ' día full' : ' días full');
    if (info.state === 'none') return 'Empezar mes gratis';
    return 'Entrar a la app';
  }

  function paintTrial() {
    const info = Subscription.status();
    const days = info.state === 'trial' ? info.daysLeft : 30;
    const ring = $('trialRing');
    if (ring) ring.style.setProperty('--p', String(Math.round((days / 30) * 100)));
    if ($('trialDays')) $('trialDays').textContent = String(days);
    if ($('trialCaption')) {
      $('trialCaption').textContent = info.state === 'trial'
        ? 'Tu prueba ya está corriendo, con Esencial, Pro y Entrenador juntos.'
        : info.state === 'none'
          ? 'Arranca hoy. Durante 30 días se desbloquean los tres planes, completos.'
          : 'El mes gratis ya se usó. Elegí con qué plan seguir: los datos quedan en el teléfono.';
    }
    const main = ctaLabel();
    document.querySelectorAll('[data-cta="main"]').forEach((el) => {
      el.textContent = main;
    });
    const planLabel = info.state === 'none' ? 'Probar 30 días full' : 'Elegir y entrar';
    document.querySelectorAll('[data-cta="plan"]').forEach((el) => {
      el.textContent = planLabel;
    });
    const note = $('heroNote');
    if (note) {
      note.textContent = info.state === 'trial'
        ? 'Te quedan ' + info.daysLeft + (info.daysLeft === 1 ? ' día' : ' días') + ' con todo full.'
        : 'Sin tarjeta. El mes incluye rutina, progresión, cuerpo y alumnos.';
    }
  }

  function paintPrices() {
    const year = state.cycle === 'year';
    document.querySelectorAll('[data-price]').forEach((el) => {
      const plan = Subscription.PLANS[el.dataset.price];
      if (!plan) return;
      animateNumber(el, year ? plan.yearly : plan.monthly);
    });
    document.querySelectorAll('[data-period]').forEach((el) => {
      el.textContent = year ? '/ año' : '/ mes';
    });
    document.querySelectorAll('[data-equiv]').forEach((el) => {
      if (!Subscription.PLANS[el.dataset.equiv]) return;
      el.textContent = year ? 'Pagás 10 meses, 2 quedan gratis' : 'En anual ahorrás 2 meses';
    });
    document.querySelectorAll('[data-cycle]').forEach((btn) => {
      const on = btn.dataset.cycle === state.cycle;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function selectPlan(id) {
    if (!Subscription.PLANS[id]) return;
    state.plan = id;
    document.querySelectorAll('.lp-plan').forEach((card) => {
      const on = card.dataset.plan === id;
      card.classList.toggle('is-selected', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const table = document.querySelector('.lp-table');
    if (table) table.dataset.hot = id;
    paintPrices();
  }

  function paintCompare() {
    const order = ['esencial', 'pro', 'entrenador'];
    const trial = state.compare === 'trial';
    document.querySelectorAll('.lp-table tbody tr').forEach((row) => {
      const allowed = (row.dataset.plans || '').split(/\s+/);
      [...row.children].slice(1).forEach((cell, index) => {
        const on = trial || allowed.includes(order[index]);
        cell.textContent = on ? 'Sí' : 'No';
        cell.classList.toggle('is-yes', on);
        cell.classList.toggle('is-no', !on);
      });
    });
    document.querySelectorAll('[data-compare]').forEach((btn) => {
      const on = btn.dataset.compare === state.compare;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const caption = $('compareCaption');
    if (caption) {
      caption.textContent = trial
        ? 'Durante los 30 días, los tres planes tienen todo.'
        : 'Así queda cada plan cuando termina el mes gratis.';
    }
  }

  function go(planId) {
    const plan = Subscription.PLANS[planId] ? planId : state.plan;
    try {
      Subscription.choose(plan, state.cycle);
    } catch (err) {
      /* si el almacenamiento falla, igual entra a la app */
    }
    window.location.href = new URL('./', window.location.href).href;
  }

  function showScreen(name) {
    state.screen = name;
    document.querySelectorAll('.lp-screen').forEach((el) => {
      const on = el.dataset.screen === name;
      el.classList.toggle('is-on', on);
      if (on) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
    document.querySelectorAll('[data-show]').forEach((btn) => {
      const on = btn.dataset.show === name;
      btn.classList.toggle('is-on', on);
      if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function showLab(name) {
    document.querySelectorAll('.lp-panel').forEach((panel) => {
      panel.hidden = panel.dataset.lab !== name;
    });
    document.querySelectorAll('[data-lab-tab]').forEach((btn) => {
      const on = btn.dataset.labTab === name;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
  }

  function renderRoutine() {
    const goal = GOALS[routine.goal];
    const days = SPLITS[routine.days] || SPLITS[4];
    const moves = PLACES[routine.place] || PLACES.full_gym;
    const box = $('routineOut');
    if (!box) return;
    box.replaceChildren();
    const title = document.createElement('p');
    title.className = 'lp-result-title';
    title.textContent = days.length + ' días · ' + goal.label;
    box.append(title);
    days.forEach((day, index) => {
      const row = document.createElement('div');
      row.className = 'lp-result-row';
      const name = document.createElement('strong');
      name.textContent = day;
      const detail = document.createElement('span');
      detail.textContent = moves[index % moves.length] + ' · ' + goal.reps + ' reps';
      row.append(name, detail);
      box.append(row);
    });
    document.querySelectorAll('[data-goal]').forEach((btn) => {
      const on = btn.dataset.goal === routine.goal;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-days]').forEach((btn) => {
      const on = Number(btn.dataset.days) === routine.days;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-place]').forEach((btn) => {
      const on = btn.dataset.place === routine.place;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderLog() {
    if ($('logWeight')) $('logWeight').textContent = String(log.weight).replace('.', ',');
    if ($('logReps')) $('logReps').textContent = String(log.reps);
    const list = $('logList');
    if (list) {
      list.replaceChildren();
      log.sets.forEach((set, index) => {
        const item = document.createElement('li');
        item.textContent = 'Serie ' + (index + 1) + ' · ' + String(set.weight).replace('.', ',') + ' kg × ' + set.reps;
        list.append(item);
      });
    }
    const suggest = $('logSuggest');
    const epley = $('logEpley');
    if (!log.sets.length) {
      if (suggest) suggest.textContent = 'Anotá una serie. Si llegás al tope de reps, la app te propone subir el peso.';
      if (epley) epley.textContent = '';
      return;
    }
    const tip = suggestProgression({
      prescription: { count: 3, repMin: 8, repMax: 12 },
      lastSession: log.sets,
      increment: 2.5,
    });
    if (suggest) suggest.textContent = tip ? tip.text : 'Seguí anotando.';
    const best = sessionBestEpley(log.sets);
    if (epley) {
      const value = Math.round(best.value * 10) / 10;
      epley.textContent = '1RM estimado ' + String(value).replace('.', ',') + ' kg' + (best.reliable ? '' : ' · más fino con 10 reps o menos');
    }
  }

  function phaseForWeek(week) {
    if (week >= 7) return { name: 'Deload', text: 'Semana de descarga: unas 40% menos de series, o bajá 10–20% el peso.' };
    if (week >= 5) return { name: 'Peso', text: 'Si llegaste al tope de reps, subí el peso y volvé al piso del rango.' };
    if (week >= 3) return { name: 'Reps', text: 'Mantené el peso y buscá una rep más.' };
    return { name: 'Base', text: 'Aprendé la técnica y dejá asentado desde dónde partís.' };
  }

  function paintCycle(week) {
    const info = phaseForWeek(week);
    const label = $('cycleLabel');
    if (label) label.textContent = 'Semana ' + week + ' · ' + info.name + '. ' + info.text;
    document.querySelectorAll('[data-bar]').forEach((bar) => {
      bar.classList.toggle('is-on', Number(bar.dataset.bar) === week);
    });
    const range = $('cycleWeek');
    if (range && Number(range.value) !== week) range.value = String(week);
  }

  function renderBody() {
    const value = bmi(body.weight, body.height);
    const category = bmiCategory(value);
    const maintenance = tdee(mifflin(body.weight, body.height, 30, body.sex), body.activity);
    const targets = calorieTargets(maintenance);
    const protein = proteinRange(body.weight);
    if ($('bodyWeightLabel')) $('bodyWeightLabel').textContent = body.weight + ' kg';
    if ($('bodyHeightLabel')) $('bodyHeightLabel').textContent = body.height + ' cm';
    if ($('bodyBmi')) $('bodyBmi').textContent = (Math.round(value * 10) / 10).toString().replace('.', ',') + ' · ' + category;
    if ($('bodyCalories') && targets) {
      $('bodyCalories').textContent = 'Definir ' + targets.cut + ' · mantener ' + targets.maintain + ' · subir ' + targets.bulk + ' kcal';
    }
    if ($('bodyProtein') && protein) {
      $('bodyProtein').textContent = 'Proteína aprox. ' + Math.round(protein.min) + '–' + Math.round(protein.max) + ' g';
    }
    document.querySelectorAll('[data-sex]').forEach((btn) => {
      const on = btn.dataset.sex === body.sex;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const activity = $('bodyActivity');
    if (activity && activity.value !== body.activity) activity.value = body.activity;
  }

  function renderStudents() {
    const list = $('studentList');
    if (!list) return;
    list.replaceChildren();
    STUDENTS.forEach((student) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lp-student' + (student.id === studentId ? ' is-on' : '');
      btn.setAttribute('aria-pressed', student.id === studentId ? 'true' : 'false');
      const name = document.createElement('strong');
      name.textContent = student.name;
      const goal = document.createElement('span');
      goal.textContent = student.goal;
      btn.append(name, goal);
      btn.addEventListener('click', () => {
        studentId = student.id;
        renderStudents();
      });
      list.append(btn);
    });
    const current = STUDENTS.find((item) => item.id === studentId) || STUDENTS[0];
    const detail = $('studentDetail');
    if (!detail) return;
    detail.replaceChildren();
    const last = document.createElement('p');
    last.textContent = applied[current.id] || current.last;
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'lp-btn';
    apply.textContent = applied[current.id] ? 'Plantilla aplicada' : 'Aplicar plantilla';
    apply.disabled = !!applied[current.id];
    apply.addEventListener('click', () => {
      applied[current.id] = 'Plantilla full body aplicada a ' + current.name + '. La rutina personal del profe no se mezcla.';
      renderStudents();
    });
    detail.append(last, apply);
  }

  function stopRest() {
    clearInterval(restTimer);
    restTimer = null;
  }

  function tickRest() {
    const label = $('restLabel');
    if (label) label.textContent = restLeft > 0 ? 'Descanso ' + restLeft + 's' : 'Listo para la próxima serie';
    if (restLeft <= 0) stopRest();
  }

  function startRest() {
    stopRest();
    restLeft = 15;
    tickRest();
    restTimer = setInterval(() => {
      restLeft -= 1;
      tickRest();
    }, 1000);
  }

  function bindPhone() {
    document.querySelectorAll('[data-show]').forEach((btn) => {
      btn.addEventListener('click', () => showScreen(btn.dataset.show));
    });
    document.querySelectorAll('.lp-ex').forEach((card) => {
      const head = card.querySelector('.lp-ex-head');
      if (!head) return;
      head.addEventListener('click', () => {
        const open = card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    const weight = { value: 60 };
    const out = $('phoneWeight');
    document.querySelectorAll('[data-phone-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        weight.value = Math.round((weight.value + Number(btn.dataset.phoneDelta)) * 10) / 10;
        if (weight.value < 0) weight.value = 0;
        if (out) out.textContent = String(weight.value).replace('.', ',');
      });
    });
    const save = $('phoneSave');
    if (save) {
      save.addEventListener('click', () => {
        const toast = $('phoneToast');
        if (!toast) return;
        toast.hidden = false;
        toast.textContent = 'Serie guardada · ' + String(weight.value).replace('.', ',') + ' kg';
      });
    }
  }

  function bindLab() {
    const tabs = [...document.querySelectorAll('[data-lab-tab]')];
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => showLab(btn.dataset.labTab));
    });
    const tablist = document.querySelector('.lp-lab-nav');
    if (tablist) {
      tablist.addEventListener('keydown', (event) => {
        const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
        if (!keys.includes(event.key)) return;
        const current = tabs.findIndex((btn) => btn.getAttribute('aria-selected') === 'true');
        const dir = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const next = tabs[(current + dir + tabs.length) % tabs.length];
        if (!next) return;
        event.preventDefault();
        showLab(next.dataset.labTab);
        next.focus();
      });
    }
    document.querySelectorAll('[data-goal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        routine.goal = btn.dataset.goal;
        renderRoutine();
      });
    });
    document.querySelectorAll('[data-days]').forEach((btn) => {
      btn.addEventListener('click', () => {
        routine.days = Number(btn.dataset.days);
        renderRoutine();
      });
    });
    document.querySelectorAll('[data-place]').forEach((btn) => {
      btn.addEventListener('click', () => {
        routine.place = btn.dataset.place;
        renderRoutine();
      });
    });
    document.querySelectorAll('[data-log-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        log.weight = Math.round((log.weight + Number(btn.dataset.logDelta)) * 10) / 10;
        if (log.weight < 0) log.weight = 0;
        renderLog();
      });
    });
    document.querySelectorAll('[data-log-reps]').forEach((btn) => {
      btn.addEventListener('click', () => {
        log.reps = Math.min(30, Math.max(1, log.reps + Number(btn.dataset.logReps)));
        renderLog();
      });
    });
    const save = $('logSave');
    if (save) {
      save.addEventListener('click', () => {
        log.sets.push({ weight: log.weight, reps: log.reps });
        renderLog();
        startRest();
      });
    }
    const reset = $('logReset');
    if (reset) {
      reset.addEventListener('click', () => {
        log.sets = [];
        log.weight = 60;
        log.reps = 10;
        stopRest();
        restLeft = 0;
        if ($('restLabel')) $('restLabel').textContent = 'El descanso arranca al anotar';
        renderLog();
      });
    }
    const range = $('cycleWeek');
    if (range) range.addEventListener('input', () => paintCycle(Number(range.value)));
    const weight = $('bodyWeight');
    const height = $('bodyHeight');
    if (weight) {
      weight.addEventListener('input', () => {
        body.weight = Number(weight.value);
        renderBody();
      });
    }
    if (height) {
      height.addEventListener('input', () => {
        body.height = Number(height.value);
        renderBody();
      });
    }
    document.querySelectorAll('[data-sex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        body.sex = btn.dataset.sex;
        renderBody();
      });
    });
    const activity = $('bodyActivity');
    if (activity) {
      activity.addEventListener('change', () => {
        body.activity = activity.value;
        renderBody();
      });
    }
  }

  function bindPricing() {
    document.querySelectorAll('[data-cycle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.cycle = btn.dataset.cycle === 'year' ? 'year' : 'month';
        paintPrices();
      });
    });
    document.querySelectorAll('[data-compare]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.compare = btn.dataset.compare === 'after' ? 'after' : 'trial';
        paintCompare();
      });
    });
    document.querySelectorAll('.lp-plan').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-start]')) return;
        selectPlan(card.dataset.plan);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('[data-start]')) return;
        event.preventDefault();
        selectPlan(card.dataset.plan);
      });
    });
    document.querySelectorAll('[data-start]').forEach((btn) => {
      btn.addEventListener('click', () => go(btn.dataset.plan || state.plan));
    });
  }

  function bindFaq() {
    document.querySelectorAll('.lp-faq details').forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        document.querySelectorAll('.lp-faq details').forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  function bindGlow() {
    const hero = document.querySelector('.lp-hero');
    if (!hero || !window.matchMedia('(pointer: fine)').matches || reduced) return;
    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--x', event.clientX - rect.left + 'px');
      hero.style.setProperty('--y', event.clientY - rect.top + 'px');
    });
  }

  function fillActivity() {
    const select = $('bodyActivity');
    if (!select || typeof ACTIVITY_LEVELS === 'undefined') return;
    ACTIVITY_LEVELS.forEach((level) => {
      const option = document.createElement('option');
      option.value = level.id;
      option.textContent = level.label;
      if (level.id === body.activity) option.selected = true;
      select.append(option);
    });
  }

  fillActivity();
  bindPhone();
  bindLab();
  bindPricing();
  bindFaq();
  bindGlow();
  showScreen('rutina');
  showLab('armar');
  renderRoutine();
  renderLog();
  paintCycle(4);
  renderBody();
  renderStudents();
  selectPlan('pro');
  paintCompare();
  paintTrial();
  if (typeof Subscription !== 'undefined' && Subscription.refreshPlans) {
    Subscription.refreshPlans().then(() => {
      paintPrices();
      paintTrial();
    });
  }
  if ($('restLabel')) $('restLabel').textContent = 'El descanso arranca al anotar';
})();
