let CURRENT_PERIOD = 1;

/* =========================
   LOAD DATA
========================= */
async function loadDashboard(days = 1) {
  CURRENT_PERIOD = days;
  setLoading(true);

  try {
    const response = await fetch(`/dashboard/alerts?days=${days}`);
    const data = await response.json();

    console.log('Dashboard data:', data);

    if (!response.ok || !data.success) {
      throw new Error(data?.message || 'Réponse API invalide');
    }

    /* =========================
       STATS
    ========================= */
    setText('total', data.stats?.total_today ?? 0);
    setText('speed_count', data.stats?.speed ?? 0);
    setText('power_count', data.stats?.power ?? 0);
    setText('io_count', data.stats?.io ?? 0);
    setText('time_count', data.stats?.time ?? 0);

    /* =========================
       TOP 10 DERNIÈRES ALERTES
    ========================= */
    renderTable('latest_table', data.latest || [], 5, (row) => `
      <tr>
        <td>${formatDate(row.alert_time)}</td>
        <td>${escapeHtml(row.device_name)}</td>
        <td>${escapeHtml(formatAlertType(row.alert_type))}</td>
        <td>${escapeHtml(row.value || '-')}</td>
        <td>${escapeHtml(row.observation || '-')}</td>
      </tr>
    `);

    /* =========================
       SURVITESSE
    ========================= */
    renderTable('speed_table', data.sections?.survitesse || [], 4, (row) => `
      <tr>
        <td>${formatDate(row.alert_time)}</td>
        <td>${escapeHtml(row.device_name)}</td>
        <td>${escapeHtml(row.value || '-')}</td>
        <td>${escapeHtml(row.observation || '-')}</td>
      </tr>
    `);

    /* =========================
       ALIMENTATION
    ========================= */
    renderTable('power_table', data.sections?.alimentation || [], 4, (row) => `
      <tr>
        <td>${formatDate(row.alert_time)}</td>
        <td>${escapeHtml(row.device_name)}</td>
        <td>${escapeHtml(row.value || '-')}</td>
        <td>${escapeHtml(row.observation || '-')}</td>
      </tr>
    `);

    /* =========================
       INJECTION
    ========================= */
    renderTable('io_table', data.sections?.injection || [], 4, (row) => `
      <tr>
        <td>${formatDate(row.alert_time)}</td>
        <td>${escapeHtml(row.device_name)}</td>
        <td>${escapeHtml(row.value || row.alert_type || '-')}</td>
        <td>${escapeHtml(row.observation || '-')}</td>
      </tr>
    `);

    /* =========================
       INCOHÉRENCE DATE
    ========================= */
    renderTable('time_table', data.sections?.incoherenceDate || [], 5, (row) => `
      <tr>
        <td>${formatDate(row.alert_time)}</td>
        <td>${escapeHtml(row.device_name)}</td>
        <td>${formatDate(row.start_time)}</td>
        <td>${formatDate(row.end_time)}</td>
        <td>${escapeHtml(row.observation || '-')}</td>
      </tr>
    `);
  } catch (error) {
    console.error('Erreur chargement dashboard:', error);

    setText('total', '0');
    setText('speed_count', '0');
    setText('power_count', '0');
    setText('io_count', '0');
    setText('time_count', '0');

    renderError('latest_table', 5);
    renderError('speed_table', 4);
    renderError('power_table', 4);
    renderError('io_table', 4);
    renderError('time_table', 5);
  } finally {
    setLoading(false);
  }
}

/* =========================
   HELPERS
========================= */

function renderTable(id, rows, colspan, template) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!rows || rows.length === 0) {
    el.innerHTML = `<tr><td colspan="${colspan}">Aucune donnée</td></tr>`;
    return;
  }

  el.innerHTML = rows.map(template).join('');
}

function renderError(id, colspan) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = `<tr><td colspan="${colspan}">Erreur de chargement</td></tr>`;
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (isNaN(date.getTime())) return value;

  return date.toLocaleString('fr-FR');
}

function formatAlertType(value) {
  if (!value) return '-';

  const map = {
    SURVITESSE: 'Survitesse',
    ALIMENTATION_CASE_1: 'Alimentation Cas 1',
    ALIMENTATION_CASE_2: 'Alimentation Cas 2',
    INJECTION_DONNEES: 'Injection Données',
    INCOHERENCE_DATE: 'Incohérence Date',
  };

  return map[value] || value;
}

function changePeriod(days) {
  CURRENT_PERIOD = days;
  loadDashboard(days);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerText = value;
}

function setLoading(isLoading) {
  const bar = document.getElementById('loading-bar');
  const container = document.getElementById('loading-bar-container');

  if (!bar || !container) return;

  if (isLoading) {
    container.style.opacity = '1';
    bar.style.width = '70%';
  } else {
    bar.style.width = '100%';
    setTimeout(() => {
      bar.style.width = '0%';
      container.style.opacity = '0.35';
    }, 250);
  }
}

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard(1);
});