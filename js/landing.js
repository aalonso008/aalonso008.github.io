(function () {
  const state = { cycle: 'month', plan: 'pro', compare: 'trial', screen: 'rutina' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const routine = { goal: 'hypertrophy', days: 4, place: 'full_gym' };
  const log = { weight: 60, reps: 10, sets: [] };
  const body = { weight: 74, height: 175, sex: 'M', activity: 'moderate' };
  let restTimer = null;
  let restLeft = 0;

  const GOAL_REPS = { hypertrophy: '8–12', strength: '4–6', fat_loss: '8–12', general: '8–15' };
  const STUDENTS = [
    { id: 'lucia', name: 'Lucía' },
    { id: 'martin', name: 'Martín' },
    { id: 'sofia', name: 'Sofía' },
  ];
  const BMI_KEY = { 'bajo peso': 'low', normal: 'normal', sobrepeso: 'over', obesidad: 'obese' };
  let studentId = 'lucia';
  let applied = {};

  function num(value) {
    const text = String(value);
    return I18n.get() === 'en' ? text : text.replace('.', ',');
  }

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
    if (info.state === 'trial') {
      return info.daysLeft === 1 ? I18n.t('cta.enter.one') : I18n.t('cta.enter', { n: info.daysLeft });
    }
    if (info.state === 'none') return I18n.t('cta.free');
    return I18n.t('cta.app');
  }

  function paintTrial() {
    const info = Subscription.status();
    const days = info.state === 'trial' ? info.daysLeft : 30;
    const ring = $('trialRing');
    if (ring) ring.style.setProperty('--p', String(Math.round((days / 30) * 100)));
    if ($('trialDays')) $('trialDays').textContent = String(days);
    if ($('trialCaption')) {
      $('trialCaption').textContent = info.state === 'trial'
        ? I18n.t('trial.running')
        : info.state === 'none'
          ? I18n.t('trial.start')
          : I18n.t('trial.used');
    }
    const main = ctaLabel();
    document.querySelectorAll('[data-cta="main"]').forEach((el) => {
      el.textContent = main;
    });
    const planLabel = info.state === 'none' ? I18n.t('cta.try') : I18n.t('cta.choose');
    document.querySelectorAll('[data-cta="plan"]').forEach((el) => {
      el.textContent = planLabel;
    });
    const note = $('heroNote');
    if (note) {
      note.textContent = info.state === 'trial'
        ? I18n.t('hero.left', { n: info.daysLeft, days: info.daysLeft === 1 ? I18n.t('day.one') : I18n.t('day.many') })
        : I18n.t('hero.note');
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
      el.textContent = year ? I18n.t('price.year') : I18n.t('price.month');
    });
    document.querySelectorAll('[data-equiv]').forEach((el) => {
      if (!Subscription.PLANS[el.dataset.equiv]) return;
      el.textContent = year ? I18n.t('price.pay10') : I18n.t('price.save2');
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
        const coachOnly = (row.dataset.plans || '').trim() === 'entrenador';
        const on = (!coachOnly && trial) || allowed.includes(order[index]);
        cell.textContent = on ? I18n.t('yes') : I18n.t('no');
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
      caption.textContent = trial ? I18n.t('compare.trial.caption') : I18n.t('compare.after.caption');
    }
  }

  function go(planId) {
    const plan = Subscription.PLANS[planId] ? planId : state.plan;
    try {
      Subscription.choose(plan, state.cycle);
    } catch (err) {
      /* si el almacenamiento falla, igual entra a la app */
    }
    window.location.href = new URL('app.html', window.location.href).href;
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
    const reps = GOAL_REPS[routine.goal] || GOAL_REPS.hypertrophy;
    const days = I18n.t('split.' + routine.days).split('|');
    const moves = I18n.t('move.' + routine.place).split('|');
    const box = $('routineOut');
    if (!box) return;
    box.replaceChildren();
    const title = document.createElement('p');
    title.className = 'lp-result-title';
    title.textContent = I18n.t('routine.line', { days: days.length, goal: I18n.t('goal.' + routine.goal) });
    box.append(title);
    days.forEach((day, index) => {
      const row = document.createElement('div');
      row.className = 'lp-result-row';
      const name = document.createElement('strong');
      name.textContent = day;
      const detail = document.createElement('span');
      detail.textContent = moves[index % moves.length] + ' · ' + reps + ' ' + I18n.t('reps.word');
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
    if ($('logWeight')) $('logWeight').textContent = num(log.weight);
    if ($('logReps')) $('logReps').textContent = String(log.reps);
    const list = $('logList');
    if (list) {
      list.replaceChildren();
      log.sets.forEach((set, index) => {
        const item = document.createElement('li');
        item.textContent = I18n.t('set.line', { n: index + 1, kg: num(set.weight), reps: set.reps });
        list.append(item);
      });
    }
    const suggest = $('logSuggest');
    const epley = $('logEpley');
    if (!log.sets.length) {
      if (suggest) suggest.textContent = I18n.t('tip.empty');
      if (epley) epley.textContent = '';
      return;
    }
    const tip = suggestProgression({
      prescription: { count: 3, repMin: 8, repMax: 12 },
      lastSession: log.sets,
      increment: 2.5,
    });
    if (suggest) suggest.textContent = tip ? tip.text : I18n.t('tip.more');
    const best = sessionBestEpley(log.sets);
    if (epley) {
      const value = Math.round(best.value * 10) / 10;
      epley.textContent = I18n.t('epley.line', { value: num(value) }) + (best.reliable ? '' : I18n.t('epley.soft'));
    }
  }

  function phaseForWeek(week) {
    if (week >= 7) return { name: I18n.t('phase.Deload'), text: I18n.t('phase.deload.text') };
    if (week >= 5) return { name: I18n.t('phase.Peso'), text: I18n.t('phase.weight.text') };
    if (week >= 3) return { name: I18n.t('phase.Reps'), text: I18n.t('phase.reps.text') };
    return { name: I18n.t('phase.Base'), text: I18n.t('phase.base.text') };
  }

  function paintCycle(week) {
    const info = phaseForWeek(week);
    const label = $('cycleLabel');
    if (label) label.textContent = I18n.t('cycle.line', { week, name: info.name, text: info.text });
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
    if ($('bodyBmi')) {
      const shown = num(Math.round(value * 10) / 10);
      $('bodyBmi').textContent = I18n.t('bmi.line', { value: shown, cat: I18n.t('bmi.' + (BMI_KEY[category] || 'normal')) });
    }
    if ($('bodyCalories') && targets) {
      $('bodyCalories').textContent = I18n.t('cal.line', targets);
    }
    if ($('bodyProtein') && protein) {
      $('bodyProtein').textContent = I18n.t('protein.line', { min: Math.round(protein.min), max: Math.round(protein.max) });
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
      goal.textContent = I18n.t('student.' + student.id + '.goal');
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
    last.textContent = applied[current.id]
      ? I18n.t('student.done', { name: current.name })
      : I18n.t('student.' + current.id + '.last');
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'lp-btn';
    apply.textContent = applied[current.id] ? I18n.t('student.applied') : I18n.t('student.apply');
    apply.disabled = !!applied[current.id];
    apply.addEventListener('click', () => {
      applied[current.id] = true;
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
    if (label) label.textContent = restLeft > 0 ? I18n.t('rest.sec', { n: restLeft }) : I18n.t('rest.ready');
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
        if (out) out.textContent = num(weight.value);
      });
    });
    const save = $('phoneSave');
    if (save) {
      save.addEventListener('click', () => {
        const toast = $('phoneToast');
        if (!toast) return;
        toast.hidden = false;
        toast.textContent = I18n.t('phone.saved', { kg: num(weight.value) });
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
        if ($('restLabel') && !restTimer) $('restLabel').textContent = I18n.t('rest.idle');
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
    if (!select.options.length) {
      ACTIVITY_LEVELS.forEach((level) => {
        const option = document.createElement('option');
        option.value = level.id;
        if (level.id === body.activity) option.selected = true;
        select.append(option);
      });
    }
    [...select.options].forEach((option) => {
      option.textContent = I18n.t('activity.' + option.value);
    });
  }

  function refreshLang() {
    fillActivity();
    renderRoutine();
    renderLog();
    paintCycle(Number(($('cycleWeek') && $('cycleWeek').value) || 4));
    renderBody();
    renderStudents();
    paintPrices();
    paintCompare();
    paintTrial();
    if (!restTimer && $('restLabel')) $('restLabel').textContent = I18n.t('rest.idle');
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
  if ($('restLabel')) $('restLabel').textContent = I18n.t('rest.idle');
  document.addEventListener('lang:change', refreshLang);
})();
