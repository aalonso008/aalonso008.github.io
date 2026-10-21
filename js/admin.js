/* Panel de admin: precios, usuarios y suscripción. No borra cuentas. */
const adminState = {
  view: 'home',
  plans: [],
  users: [],
  query: '',
  userId: null,
};

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
  if (role === 'admin') return 'Admin';
  if (role === 'trainer') return 'Entrenador';
  return 'Atleta';
}

function adminStatusLabel(status) {
  if (status === 'trial') return 'Prueba';
  if (status === 'active') return 'Activo';
  if (status === 'chosen') return 'Elegido';
  if (status === 'expired') return 'Vencido';
  return 'Sin plan';
}

async function openAdmin() {
  if (!syncUser) return showLoginGate();
  closeAccount();
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
}

function adminBack() {
  if (adminState.view === 'user') {
    adminState.view = 'home';
    adminState.userId = null;
    renderAdmin();
    return;
  }
  closeAdmin();
}

async function renderAdmin() {
  const body = document.getElementById('adminBody');
  const title = document.getElementById('adminTitle');
  if (!body) return;
  if (!syncConfigured()) {
    if (title) title.textContent = 'Administrar';
    body.innerHTML = '<p class="wizard-help">Para administrar precios y usuarios hace falta Supabase. Completá <code>js/config.js</code> y corré <code>supabase/schema.sql</code>.</p>';
    return;
  }
  try {
    if (adminState.view === 'user') await renderAdminUser(body, title);
    else await renderAdminHome(body, title);
  } catch (err) {
    body.innerHTML = '<p class="wizard-help">' + escapeHtml(adminMessage(err)) + '</p>';
  }
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
  if (!id) return 'Sin plan';
  if (typeof Subscription !== 'undefined' && Subscription.PLANS[id]) return Subscription.PLANS[id].name;
  return id;
}

function adminUserLine(user) {
  const plan = adminPlanName(user.plan_id);
  const days = user.sub_status === 'trial' ? adminDays(user.trial_ends_at) : null;
  const extra = days == null ? '' : ' · ' + days + (days === 1 ? ' día' : ' días');
  return adminRoleLabel(user.role) + ' · ' + plan + ' · ' + adminStatusLabel(user.sub_status) + extra;
}

function adminUserButtons() {
  const query = adminState.query.trim().toLowerCase();
  const visible = adminState.users.filter((user) => !query || String(user.email || '').toLowerCase().includes(query));
  if (!visible.length) return '<p class="wizard-help">No hay usuarios con ese email.</p>';
  return visible.map((user) => `
    <button type="button" class="wizard-option" onclick="openAdminUser('${escapeHtml(user.user_id)}')">
      <strong>${escapeHtml(user.email || 'Sin email')}</strong>
      <em>${escapeHtml(adminUserLine(user))}</em>
    </button>`).join('');
}

async function renderAdminHome(body, title) {
  if (title) title.textContent = 'Administrar';
  const plans = await loadAdminPlans();
  const users = await loadAdminUsers();
  if (!plans.length) {
    body.innerHTML = '<p class="wizard-help">' + (typeof I18n !== 'undefined' ? I18n.t('admin.noplans') : 'No hay planes. Ejecuta supabase/schema.sql en el editor SQL.') + '</p>';
    return;
  }
  const priceFields = plans.map((plan) => `
    <fieldset class="editor-card">
      <legend>${escapeHtml(plan.name)}</legend>
      <label for="plan-${escapeHtml(plan.id)}-name">Nombre</label>
      <input id="plan-${escapeHtml(plan.id)}-name" name="${escapeHtml(plan.id)}-name" value="${escapeHtml(plan.name)}" required>
      <label for="plan-${escapeHtml(plan.id)}-monthly">Mensual</label>
      <input id="plan-${escapeHtml(plan.id)}-monthly" name="${escapeHtml(plan.id)}-monthly" type="number" min="0" step="1" value="${Number(plan.monthly)}" required>
      <label for="plan-${escapeHtml(plan.id)}-yearly">Anual</label>
      <input id="plan-${escapeHtml(plan.id)}-yearly" name="${escapeHtml(plan.id)}-yearly" type="number" min="0" step="1" value="${Number(plan.yearly)}" required>
    </fieldset>`).join('');
  body.innerHTML = `
    <h2 class="wizard-title">Precios</h2>
    <p class="wizard-help">Estos números son los que ve la landing. No se cobra la tarjeta desde acá.</p>
    <form class="wizard-form" onsubmit="saveAdminPlans(event)">${priceFields}
      <button type="submit" class="log-btn">Guardar precios</button>
    </form>
    <h2 class="wizard-title" style="margin-top:22px">Usuarios</h2>
    <form class="wizard-form" onsubmit="return false">
      <label for="adminSearch">Buscar por email</label>
      <input id="adminSearch" value="${escapeHtml(adminState.query)}" placeholder="email" oninput="filterAdminUsers(this.value)">
    </form>
    <div id="adminUserList">${users.length ? adminUserButtons() : '<p class="wizard-help">' + (typeof I18n !== 'undefined' ? I18n.t('admin.nousers') : 'Todavía no hay cuentas.') + '</p>'}</div>`;
}

function filterAdminUsers(value) {
  adminState.query = value || '';
  const list = document.getElementById('adminUserList');
  if (list) list.innerHTML = adminUserButtons();
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
  if (title) title.textContent = user.email || 'Usuario';
  const roles = ['athlete', 'trainer', 'admin'].map((role) =>
    `<option value="${role}"${user.role === role ? ' selected' : ''}>${adminRoleLabel(role)}</option>`
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
    <h2 class="wizard-title">${escapeHtml(user.email || 'Sin email')}</h2>
    <p class="wizard-help">Alta ${escapeHtml(adminDateInput(user.created_at) || '—')}. ${escapeHtml(adminUserLine(user))}.</p>
    <form class="wizard-form" onsubmit="saveAdminUser(event)">
      <label for="adminRole">Rol</label>
      <select id="adminRole" name="role">${roles}</select>
      <label for="adminPlan">Plan</label>
      <select id="adminPlan" name="plan">${plans}</select>
      <label for="adminBilling">Ciclo</label>
      <select id="adminBilling" name="billing">
        <option value="month"${billing === 'month' ? ' selected' : ''}>Mensual</option>
        <option value="year"${billing === 'year' ? ' selected' : ''}>Anual</option>
      </select>
      <label for="adminStatus">Estado</label>
      <select id="adminStatus" name="status">${statusOptions}</select>
      <label for="adminTrialEnd">Fin de la prueba</label>
      <input id="adminTrialEnd" name="trialEnd" type="date" value="${escapeHtml(adminDateInput(user.trial_ends_at))}">
      <button type="submit" class="log-btn">Guardar usuario</button>
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
    if (typeof showToast === 'function') showToast('Precios guardados');
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
    if (typeof showToast === 'function') showToast('Usuario guardado');
    adminState.users = [];
    await renderAdmin();
  } catch (err) {
    button.disabled = false;
    alert(adminMessage(err));
  }
}
