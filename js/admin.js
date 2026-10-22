/* Módulo de admin: altas, planes y precios. No muestra rutinas ni borra cuentas. */
const adminState = {
  view: 'home',
  plans: [],
  users: [],
  query: '',
  filter: 'all',
  userId: null,
};

function adminT(key, vars) {
  return typeof I18n !== 'undefined' ? I18n.t(key, vars) : key;
}

function adminMessage(error) {
  const text = (error && (error.message || error.details)) || '';
  if (/subscription_plans|subscriptions|admin_users|is_admin|schema cache/i.test(text)) {
    return typeof I18n !== 'undefined' ? I18n.t('admin.schema') : 'Falta actualizar la base. Vuelve a ejecutar supabase/schema.sql en el editor SQL.';
  }
  if (/Solo un admin/i.test(text)) return 'Solo un admin puede dar ese rol.';
  return text || 'No se pudo completar.';
}

function adminDays(iso) {
  if (!iso) return null;
  const ends = new Date(iso).getTime();
  if (Number.isNaN(ends)) return null;
  return Math.max(0, Math.ceil((ends - Date.now()) / 86400000));
}

function adminDateInput(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function adminDateIso(value) {
  if (!value) return null;
  return value + 'T23:59:59.000Z';
}

function adminRoleLabel(role) {
  if (role === 'admin') return adminT('admin.role.admin');
  return adminT('admin.role.athlete');
}

function adminStatusLabel(status) {
  if (status === 'trial') return adminT('admin.status.trial');
  if (status === 'active') return adminT('admin.status.active');
  if (status === 'chosen') return adminT('admin.status.chosen');
  if (status === 'expired') return adminT('admin.status.expired');
  return adminT('admin.noplan');
}

async function loadOwnRole() {
  if (!syncUser || typeof ensureClient !== 'function') return null;
  try {
    const client = await ensureClient();
    const { data, error } = await client.from('profiles').select('role').eq('user_id', syncUser.id).maybeSingle();
    if (error) return null;
    return data && data.role;
  } catch (err) {
    return null;
  }
}

async function openAdmin() {
  if (!syncUser) return showLoginGate();
  if (typeof closeAccount === 'function') closeAccount();
  if (typeof hideLoginGate === 'function') hideLoginGate();
  if (typeof setAppLocked === 'function') setAppLocked(true);
  const panel = document.getElementById('adminPanel');
  panel.hidden = false;
  panel.classList.add('show');
  adminState.view = 'home';
  adminState.userId = null;
  await renderAdmin();
}

function closeAdmin() {
  const panel = document.getElementById('adminPanel');
  if (!panel) return;
  panel.classList.remove('show');
  panel.hidden = true;
  if (typeof setAppLocked === 'function') setAppLocked(false);
}

function adminBack() {
  if (adminState.view !== 'user') return;
  adminState.view = 'home';
  adminState.userId = null;
  renderAdmin();
}

function syncAdminChrome() {
  const back = document.getElementById('adminBack');
  if (back) back.hidden = adminState.view !== 'user';
}

async function renderAdmin() {
  const body = document.getElementById('adminBody');
  const title = document.getElementById('adminTitle');
  if (!body) return;
  if (!syncConfigured()) {
    if (title) title.textContent = adminT('admin.title');
    body.innerHTML = '<p class="wizard-help">Para administrar precios y usuarios hace falta Supabase. Completá <code>js/config.js</code> y corré <code>supabase/schema.sql</code>.</p>';
    return;
  }
  try {
    if (adminState.view === 'user') await renderAdminUser(body, title);
    else await renderAdminHome(body, title);
  } catch (err) {
    body.innerHTML = '<p class="wizard-help">' + escapeHtml(adminMessage(err)) + '</p>';
  }
  syncAdminChrome();
}

async function loadAdminPlans() {
  const client = await ensureClient();
  const { data, error } = await client.from('subscription_plans').select('id,name,monthly,yearly,sort').order('sort');
  if (error) throw error;
  adminState.plans = data || [];
  if (typeof Subscription !== 'undefined') Subscription.refreshPlans();
  return adminState.plans;
}

async function loadAdminUsers() {
  const client = await ensureClient();
  const { data, error } = await client.rpc('admin_users');
  if (error) throw error;
  adminState.users = data || [];
  return adminState.users;
}

function adminPlanName(id) {
  if (!id) return adminT('admin.noplan');
  if (typeof Subscription !== 'undefined' && Subscription.PLANS[id]) return Subscription.PLANS[id].name;
  const plan = adminState.plans.find((item) => item.id === id);
  return (plan && plan.name) || id;
}

function adminCreatedMs(user) {
  const time = new Date(user.created_at).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function adminStats(users) {
  const now = Date.now();
  const week = now - 7 * 86400000;
  const month = now - 30 * 86400000;
  const count = (pred) => users.filter(pred).length;
  return {
    total: users.length,
    week: count((user) => adminCreatedMs(user) >= week),
    month: count((user) => adminCreatedMs(user) >= month),
    trial: count((user) => user.sub_status === 'trial'),
    active: count((user) => user.sub_status === 'active'),
    expired: count((user) => user.sub_status === 'expired'),
  };
}

function adminStatCard(value, key) {
  return `<div class="admin-stat"><strong>${value}</strong><span>${escapeHtml(adminT(key))}</span></div>`;
}

function adminPlanBreakdown(users) {
  const counts = {};
  users.forEach((user) => {
    const id = user.plan_id || '';
    counts[id] = (counts[id] || 0) + 1;
  });
  return Object.keys(counts).map((id) => `<span>${escapeHtml(adminPlanName(id))}: <strong>${counts[id]}</strong></span>`).join('');
}

function adminUserLine(user) {
  const plan = adminPlanName(user.plan_id);
  const days = user.sub_status === 'trial' ? adminDays(user.trial_ends_at) : null;
  const extra = days == null ? '' : ' · ' + days + ' ' + adminT(days === 1 ? 'day.one' : 'day.many');
  return adminRoleLabel(user.role) + ' · ' + plan + ' · ' + adminStatusLabel(user.sub_status) + extra;
}

function adminVisibleUsers() {
  const query = adminState.query.trim().toLowerCase();
  const week = Date.now() - 7 * 86400000;
  return adminState.users.filter((user) => {
    if (query && !String(user.email || '').toLowerCase().includes(query)) return false;
    if (adminState.filter === 'week') return adminCreatedMs(user) >= week;
    if (adminState.filter === 'trial' || adminState.filter === 'active' || adminState.filter === 'expired') {
      return user.sub_status === adminState.filter;
    }
    return true;
  });
}

function adminUserButtons() {
  const visible = adminVisibleUsers();
  if (!visible.length) return '<p class="wizard-help">' + escapeHtml(adminT('admin.empty')) + '</p>';
  return visible.map((user) => `
    <button type="button" class="wizard-option" onclick="openAdminUser('${escapeHtml(user.user_id)}')">
      <strong>${escapeHtml(user.email || adminT('admin.nomail'))}</strong>
      <em>${escapeHtml(adminDateInput(user.created_at) || '—')} · ${escapeHtml(adminUserLine(user))}</em>
    </button>`).join('');
}

function adminFilterButtons() {
  const filters = ['all', 'week', 'trial', 'active', 'expired'];
  return filters.map((name) => {
    const on = adminState.filter === name ? ' is-on' : '';
    return `<button type="button" class="${on.trim()}" data-admin-filter="${name}" onclick="setAdminFilter('${name}')">${escapeHtml(adminT('admin.filter.' + name))}</button>`;
  }).join('');
}

async function renderAdminHome(body, title) {
  if (title) title.textContent = adminT('admin.title');
  const plans = await loadAdminPlans();
  const users = await loadAdminUsers();
  const stats = adminStats(users);
  const priceFields = plans.map((plan) => `
    <fieldset class="editor-card">
      <legend>${escapeHtml(plan.name)}</legend>
      <label for="plan-${escapeHtml(plan.id)}-name">${escapeHtml(adminT('admin.field.name'))}</label>
      <input id="plan-${escapeHtml(plan.id)}-name" name="${escapeHtml(plan.id)}-name" value="${escapeHtml(plan.name)}" required>
      <label for="plan-${escapeHtml(plan.id)}-monthly">${escapeHtml(adminT('admin.monthBill'))}</label>
      <input id="plan-${escapeHtml(plan.id)}-monthly" name="${escapeHtml(plan.id)}-monthly" type="number" min="0" step="1" value="${Number(plan.monthly)}" required>
      <label for="plan-${escapeHtml(plan.id)}-yearly">${escapeHtml(adminT('admin.yearBill'))}</label>
      <input id="plan-${escapeHtml(plan.id)}-yearly" name="${escapeHtml(plan.id)}-yearly" type="number" min="0" step="1" value="${Number(plan.yearly)}" required>
    </fieldset>`).join('');
  const prices = plans.length
    ? `<form class="wizard-form" onsubmit="saveAdminPlans(event)">${priceFields}
      <button type="submit" class="log-btn">${escapeHtml(adminT('admin.save.prices'))}</button>
    </form>`
    : '<p class="wizard-help">' + escapeHtml(adminT('admin.noplans')) + '</p>';
  const list = users.length
    ? adminUserButtons()
    : '<p class="wizard-help">' + escapeHtml(adminT('admin.nousers')) + '</p>';
  body.innerHTML = `
    <div class="admin-stats">
      ${adminStatCard(stats.total, 'admin.total')}
      ${adminStatCard(stats.week, 'admin.week')}
      ${adminStatCard(stats.month, 'admin.month')}
      ${adminStatCard(stats.trial, 'admin.trial')}
      ${adminStatCard(stats.active, 'admin.active')}
      ${adminStatCard(stats.expired, 'admin.expired')}
    </div>
    <h2 class="wizard-title">${escapeHtml(adminT('admin.byplan'))}</h2>
    <div class="admin-plan-row">${adminPlanBreakdown(users) || '<span>' + escapeHtml(adminT('admin.nousers')) + '</span>'}</div>
    <h2 class="wizard-title">${escapeHtml(adminT('admin.signups'))}</h2>
    <div class="admin-filters">${adminFilterButtons()}</div>
    <form class="wizard-form" onsubmit="return false">
      <label for="adminSearch">${escapeHtml(adminT('admin.search'))}</label>
      <input id="adminSearch" value="${escapeHtml(adminState.query)}" placeholder="email" oninput="filterAdminUsers(this.value)">
    </form>
    <div id="adminUserList">${list}</div>
    <h2 class="wizard-title" style="margin-top:22px">${escapeHtml(adminT('admin.prices.title'))}</h2>
    <p class="wizard-help">${escapeHtml(adminT('admin.prices.help'))}</p>
    ${prices}`;
}

function filterAdminUsers(value) {
  adminState.query = value || '';
  const list = document.getElementById('adminUserList');
  if (list) list.innerHTML = adminState.users.length ? adminUserButtons() : '<p class="wizard-help">' + escapeHtml(adminT('admin.nousers')) + '</p>';
}

function setAdminFilter(name) {
  adminState.filter = name || 'all';
  document.querySelectorAll('[data-admin-filter]').forEach((btn) => {
    btn.classList.toggle('is-on', btn.getAttribute('data-admin-filter') === adminState.filter);
  });
  filterAdminUsers(adminState.query);
}

async function openAdminUser(userId) {
  adminState.view = 'user';
  adminState.userId = userId;
  await renderAdmin();
}

async function renderAdminUser(body, title) {
  if (!adminState.users.length) await loadAdminUsers();
  if (!adminState.plans.length) await loadAdminPlans();
  const user = adminState.users.find((item) => item.user_id === adminState.userId);
  if (!user) {
    adminState.view = 'home';
    await renderAdminHome(body, title);
    return;
  }
  if (title) title.textContent = user.email || adminT('admin.nomail');
  const currentRole = user.role === 'admin' ? 'admin' : 'athlete';
  const roles = ['athlete', 'admin'].map((role) =>
    `<option value="${role}"${currentRole === role ? ' selected' : ''}>${adminRoleLabel(role)}</option>`
  ).join('');
  const statuses = ['trial', 'active', 'expired', 'chosen'];
  const currentStatus = user.sub_status || 'trial';
  const statusOptions = statuses.map((status) =>
    `<option value="${status}"${currentStatus === status ? ' selected' : ''}>${adminStatusLabel(status)}</option>`
  ).join('');
  const planId = user.plan_id && adminState.plans.some((plan) => plan.id === user.plan_id) ? user.plan_id : 'pro';
  const plans = adminState.plans.map((plan) =>
    `<option value="${escapeHtml(plan.id)}"${plan.id === planId ? ' selected' : ''}>${escapeHtml(plan.name)}</option>`
  ).join('');
  const billing = user.billing === 'year' ? 'year' : 'month';
  body.innerHTML = `
    <h2 class="wizard-title">${escapeHtml(user.email || adminT('admin.nomail'))}</h2>
    <p class="wizard-help">${escapeHtml(adminT('admin.joined', { date: adminDateInput(user.created_at) || '—' }))} ${escapeHtml(adminUserLine(user))}.</p>
    <form class="wizard-form" onsubmit="saveAdminUser(event)">
      <label for="adminRole">${escapeHtml(adminT('admin.role'))}</label>
      <select id="adminRole" name="role">${roles}</select>
      <label for="adminPlan">${escapeHtml(adminT('admin.plan'))}</label>
      <select id="adminPlan" name="plan">${plans}</select>
      <label for="adminBilling">${escapeHtml(adminT('admin.billing'))}</label>
      <select id="adminBilling" name="billing">
        <option value="month"${billing === 'month' ? ' selected' : ''}>${escapeHtml(adminT('admin.monthBill'))}</option>
        <option value="year"${billing === 'year' ? ' selected' : ''}>${escapeHtml(adminT('admin.yearBill'))}</option>
      </select>
      <label for="adminStatus">${escapeHtml(adminT('admin.status'))}</label>
      <select id="adminStatus" name="status">${statusOptions}</select>
      <label for="adminTrialEnd">${escapeHtml(adminT('admin.trialEnd'))}</label>
      <input id="adminTrialEnd" name="trialEnd" type="date" value="${escapeHtml(adminDateInput(user.trial_ends_at))}">
      <button type="submit" class="log-btn">${escapeHtml(adminT('admin.save.user'))}</button>
    </form>`;
}

async function saveAdminPlans(event) {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  try {
    const form = new FormData(event.target);
    const client = await ensureClient();
    for (const plan of adminState.plans) {
      const name = String(form.get(plan.id + '-name') || '').trim();
      const monthly = Math.round(Number(form.get(plan.id + '-monthly')));
      const yearly = Math.round(Number(form.get(plan.id + '-yearly')));
      if (!name || monthly < 0 || yearly < 0 || Number.isNaN(monthly) || Number.isNaN(yearly)) {
        button.disabled = false;
        return alert(typeof I18n !== 'undefined' ? I18n.t('admin.prices') : 'Revisa nombre y precios.');
      }
      const { data, error } = await client.from('subscription_plans').update({
        name,
        monthly,
        yearly,
      }).eq('id', plan.id).select('id');
      if (error) throw error;
      if (!data || !data.length) throw new Error('subscription_plans');
    }
    if (typeof Subscription !== 'undefined') await Subscription.refreshPlans();
    if (typeof showToast === 'function') showToast(adminT('admin.saved.prices'));
    await renderAdmin();
  } catch (err) {
    button.disabled = false;
    alert(adminMessage(err));
  }
}

async function saveAdminUser(event) {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  const user = adminState.users.find((item) => item.user_id === adminState.userId);
  if (!user) return;
  try {
    const form = new FormData(event.target);
    const role = String(form.get('role') || 'athlete');
    const planId = String(form.get('plan') || 'pro');
    const billing = form.get('billing') === 'year' ? 'year' : 'month';
    const status = String(form.get('status') || 'trial');
    const trialEnd = adminDateIso(form.get('trialEnd'));
    const client = await ensureClient();
    const profile = await client.from('profiles').upsert({
      user_id: user.user_id,
      role,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (profile.error) throw profile.error;
    const started = user.started_at || new Date().toISOString();
    const sub = await client.from('subscriptions').upsert({
      user_id: user.user_id,
      status,
      plan_id: planId,
      billing,
      started_at: started,
      trial_ends_at: trialEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (sub.error) throw sub.error;
    if (typeof showToast === 'function') showToast(adminT('admin.saved.user'));
    adminState.users = [];
    await renderAdmin();
  } catch (err) {
    button.disabled = false;
    alert(adminMessage(err));
  }
}
