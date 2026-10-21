/* Mes de prueba y plan elegido. No cobra: guarda la elección en este dispositivo. */
const Subscription = (function () {
  const KEY = 'tu_rutina_subscription';
  const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;
  const PLANS = {
    esencial: { id: 'esencial', name: 'Esencial', monthly: 3900, yearly: 39000 },
    pro: { id: 'pro', name: 'Pro', monthly: 6900, yearly: 69000 },
    entrenador: { id: 'entrenador', name: 'Entrenador', monthly: 14900, yearly: 149000 },
  };

  function money(amount) {
    const value = Math.round(Number(amount) || 0);
    return '$' + String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function planById(id) {
    return PLANS[id] || PLANS.pro;
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function choose(planId, billing) {
    const current = read();
    const now = Date.now();
    const known = PLANS[planId] ? planId : 'pro';
    const cycle = billing === 'year' ? 'year' : 'month';
    if (!current || !current.startedAt) {
      write({
        status: 'trial',
        plan: 'full',
        intendedPlan: known,
        billing: cycle,
        startedAt: new Date(now).toISOString(),
        trialEndsAt: new Date(now + TRIAL_MS).toISOString(),
      });
    } else {
      const ends = new Date(current.trialEndsAt).getTime();
      const active = current.status === 'trial' && ends > now;
      write({
        status: active ? 'trial' : (current.status === 'active' ? 'active' : 'chosen'),
        plan: active ? 'full' : known,
        intendedPlan: known,
        billing: cycle,
        startedAt: current.startedAt,
        trialEndsAt: current.trialEndsAt,
      });
    }
    void pushCurrent();
    return read();
  }

  function status() {
    const sub = read();
    if (!sub || !sub.startedAt) return { state: 'none', daysLeft: 30, sub: null };
    const ends = new Date(sub.trialEndsAt).getTime();
    const daysLeft = Math.max(0, Math.ceil((ends - Date.now()) / 86400000));
    if (sub.status === 'trial' && ends > Date.now()) return { state: 'trial', daysLeft, sub };
    if (sub.status === 'active') return { state: 'active', daysLeft: 0, sub };
    if (sub.status === 'chosen') return { state: 'chosen', daysLeft: 0, sub };
    return { state: 'expired', daysLeft: 0, sub };
  }

  function summaryHtml() {
    const info = status();
    if (info.state === 'none') {
      return '<p class="trial-account">Tenés 30 días gratis con todo full. <a href="landing.html">Ver funciones y planes</a></p>';
    }
    if (info.state === 'trial') {
      const plan = planById(info.sub.intendedPlan);
      const cycle = info.sub.billing === 'year' ? 'anual' : 'mensual';
      const n = info.daysLeft;
      return `<p class="trial-account">Prueba full: te quedan <strong>${n}</strong> ${n === 1 ? 'día' : 'días'} con todo desbloqueado. Después, ${plan.name} ${cycle}. <a href="landing.html#planes">Cambiar plan</a></p>`;
    }
    if (info.state === 'chosen' || info.state === 'active') {
      const plan = planById(info.sub.plan || info.sub.intendedPlan);
      const cycle = info.sub.billing === 'year' ? 'anual' : 'mensual';
      const verb = info.state === 'active' ? 'Tenés' : 'Elegiste';
      return `<p class="trial-account">${verb} <strong>${plan.name}</strong> ${cycle}. <a href="landing.html#planes">Ver planes</a></p>`;
    }
    return '<p class="trial-account">Tu mes gratis terminó. Los datos siguen en este dispositivo. <a href="landing.html#planes">Elegí un plan</a></p>';
  }

  function loginCopy(info) {
    if (info.state === 'trial') {
      const n = info.daysLeft;
      return `Prueba full activa: te quedan ${n} ${n === 1 ? 'día' : 'días'} con todo desbloqueado.`;
    }
    if (info.state === 'chosen' || info.state === 'active') {
      return `Plan ${planById(info.sub.plan || info.sub.intendedPlan).name}. Entrá para seguir entrenando.`;
    }
    if (info.state === 'expired') return 'Tu mes gratis terminó. Entrá: los datos siguen en este teléfono.';
    return '30 días gratis con todo desbloqueado.';
  }

  function fillStrip(strip, info) {
    strip.replaceChildren();
    const span = document.createElement('span');
    const link = document.createElement('a');
    link.href = 'landing.html#planes';
    if (info.state === 'trial') {
      const n = info.daysLeft;
      span.textContent = `Prueba full activa · ${n} ${n === 1 ? 'día' : 'días'} con todo desbloqueado.`;
      link.textContent = 'Ver planes';
    } else if (info.state === 'chosen' || info.state === 'active') {
      const plan = planById(info.sub.plan || info.sub.intendedPlan);
      span.textContent = info.state === 'active'
        ? `Plan ${plan.name} activo.`
        : `Plan ${plan.name} elegido. El mes de prueba ya se usó y tus datos siguen acá.`;
      link.textContent = 'Ver planes';
    } else {
      span.textContent = 'Tu mes gratis terminó. Tus datos siguen en este dispositivo.';
      link.textContent = 'Elegir plan';
    }
    strip.append(span, link);
  }

  function refreshUi() {
    const info = status();
    const strip = document.getElementById('trialStrip');
    const gate = document.getElementById('loginGate');
    const gateOpen = !!(gate && gate.classList.contains('show'));
    if (strip) {
      if (!gateOpen && info.state !== 'none') {
        strip.hidden = false;
        fillStrip(strip, info);
      } else {
        strip.hidden = true;
        strip.replaceChildren();
      }
    }
    const loginTrial = document.getElementById('loginTrial');
    if (loginTrial) loginTrial.textContent = loginCopy(info);
  }

  function configReady() {
    return typeof APP_CONFIG === 'object'
      && APP_CONFIG.SUPABASE_URL
      && APP_CONFIG.SUPABASE_ANON_KEY
      && APP_CONFIG.SUPABASE_URL.indexOf('TU_PROYECTO') === -1
      && APP_CONFIG.SUPABASE_ANON_KEY.indexOf('TU_ANON_KEY') === -1;
  }

  function applyPlanRows(rows) {
    (rows || []).forEach((row) => {
      if (!row || !row.id) return;
      PLANS[row.id] = {
        id: row.id,
        name: row.name || row.id,
        monthly: Number(row.monthly) || 0,
        yearly: Number(row.yearly) || 0,
      };
    });
    return PLANS;
  }

  async function refreshPlans() {
    if (!configReady()) return PLANS;
    try {
      const root = APP_CONFIG.SUPABASE_URL.replace(/\/$/, '');
      const res = await fetch(root + '/rest/v1/subscription_plans?active=eq.true&select=id,name,monthly,yearly,sort&order=sort.asc', {
        headers: {
          apikey: APP_CONFIG.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + APP_CONFIG.SUPABASE_ANON_KEY,
        },
      });
      if (!res.ok) return PLANS;
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length) applyPlanRows(rows);
    } catch (err) {
      /* Sin red quedan los precios de respaldo. */
    }
    return PLANS;
  }

  function planIdOf(sub) {
    const id = sub && (sub.intendedPlan || sub.plan);
    return PLANS[id] ? id : 'pro';
  }

  function fromRow(row) {
    const planId = PLANS[row.plan_id] ? row.plan_id : 'pro';
    return {
      status: row.status || 'trial',
      plan: row.status === 'trial' ? 'full' : planId,
      intendedPlan: planId,
      billing: row.billing === 'year' ? 'year' : 'month',
      startedAt: row.started_at,
      trialEndsAt: row.trial_ends_at,
    };
  }

  async function pushCurrent() {
    if (!configReady() || typeof syncUser === 'undefined' || !syncUser || typeof ensureClient !== 'function') return;
    const sub = read();
    if (!sub || !sub.startedAt) return;
    try {
      const client = await ensureClient();
      if (!client) return;
      const { error } = await client.from('subscriptions').upsert({
        user_id: syncUser.id,
        status: sub.status || 'trial',
        plan_id: planIdOf(sub),
        billing: sub.billing === 'year' ? 'year' : 'month',
        started_at: sub.startedAt,
        trial_ends_at: sub.trialEndsAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) console.error(error);
    } catch (err) {
      console.error(err);
    }
  }

  async function syncSubscription() {
    if (!configReady() || typeof syncUser === 'undefined' || !syncUser || typeof ensureClient !== 'function') return read();
    try {
      await refreshPlans();
      const client = await ensureClient();
      if (!client) return read();
      const { data, error } = await client.from('subscriptions').select('*').eq('user_id', syncUser.id).maybeSingle();
      if (error) return read();
      if (data) {
        write(fromRow(data));
        refreshUi();
        return read();
      }
      if (read()) await pushCurrent();
    } catch (err) {
      console.error(err);
    }
    refreshUi();
    return read();
  }

  return {
    PLANS,
    money,
    planById,
    read,
    choose,
    status,
    summaryHtml,
    refreshUi,
    refreshPlans,
    pushCurrent,
    syncSubscription,
    configReady,
  };
})();
