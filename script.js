const STORAGE_KEY = 'zombie-api-inventory-v1';
const filters = document.querySelectorAll('.chip');
const tableBody = document.getElementById('apiTableBody');
const scanBtn = document.getElementById('scanBtn');
const simulateBtn = document.getElementById('simulateBtn');
const alertPanel = document.getElementById('alertPanel');
const analyzerForm = document.getElementById('analyzerForm');
const lastScan = document.getElementById('lastScan');

const statusBadgeClass = {
  active: 'status-active',
  deprecated: 'status-deprecated',
  orphan: 'status-orphan',
  zombie: 'status-zombie'
};

const riskBadgeClass = {
  high: 'risk-high',
  medium: 'risk-medium',
  low: 'risk-low'
};

const sourceLabel = {
  network: 'Network Scanner',
  gateway: 'API Gateway',
  repo: 'Code Repository',
  runtime: 'Runtime Monitor'
};

function getRows() {
  return Array.from(tableBody.querySelectorAll('tr'));
}

function pct(part, total) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function updateLastScanLabel() {
  const now = new Date();
  lastScan.textContent = `Last scan: ${now.toLocaleString()}`;
}

function pushAlert(level, message, prepend = true) {
  const alert = document.createElement('div');
  alert.className = `alert ${level}`;
  alert.innerHTML = message;
  if (prepend) {
    alertPanel.appendChild(alert);
  } else {
    alertPanel.prepend(alert);
  }
}

function refreshMetrics() {
  const rows = getRows();
  const total = rows.length;
  const statusCount = { active: 0, deprecated: 0, orphan: 0, zombie: 0 };
  const riskCount = { high: 0, medium: 0, low: 0 };
  const sourceCount = { network: 0, gateway: 0, repo: 0, runtime: 0 };

  rows.forEach((row) => {
    statusCount[row.dataset.status] += 1;
    riskCount[row.dataset.risk] += 1;
    sourceCount[row.dataset.source] += 1;
  });

  document.getElementById('totalApis').textContent = total;
  document.getElementById('activeApis').textContent = statusCount.active;
  document.getElementById('deprecatedApis').textContent = statusCount.deprecated;
  document.getElementById('orphanApis').textContent = statusCount.orphan;
  document.getElementById('zombieApis').textContent = statusCount.zombie;

  const highPct = pct(riskCount.high, total);
  const mediumPct = pct(riskCount.medium, total);
  const lowPct = pct(riskCount.low, total);

  document.getElementById('highRiskFill').style.width = `${highPct}%`;
  document.getElementById('mediumRiskFill').style.width = `${mediumPct}%`;
  document.getElementById('lowRiskFill').style.width = `${lowPct}%`;

  document.getElementById('highRiskPct').textContent = `${highPct}%`;
  document.getElementById('mediumRiskPct').textContent = `${mediumPct}%`;
  document.getElementById('lowRiskPct').textContent = `${lowPct}%`;

  document.getElementById('sourceNetwork').textContent = `${sourceCount.network} APIs`;
  document.getElementById('sourceGateway').textContent = `${sourceCount.gateway} APIs`;
  document.getElementById('sourceRepo').textContent = `${sourceCount.repo} APIs`;
  document.getElementById('sourceRuntime').textContent = `${sourceCount.runtime} APIs`;
}

function applyCurrentFilter() {
  const activeFilter = document.querySelector('.chip.active')?.dataset.filter || 'all';
  getRows().forEach((row) => {
    const status = row.dataset.status;
    const risk = row.dataset.risk;
    const showAll = activeFilter === 'all';
    const showZombie = activeFilter === 'zombie' && status === 'zombie';
    const showHigh = activeFilter === 'high' && risk === 'high';
    row.style.display = showAll || showZombie || showHigh ? '' : 'none';
  });
}

function persistInventory() {
  localStorage.setItem(STORAGE_KEY, tableBody.innerHTML);
}

function classifyStatus({ callsLast30, deprecatedFlag, documented }) {
  if (deprecatedFlag) {
    return 'deprecated';
  }
  if (callsLast30 > 20) {
    return 'active';
  }
  if (callsLast30 === 0 && !documented) {
    return 'zombie';
  }
  return 'orphan';
}

function classifyRisk({ status, auth, encryption, rateLimit, documented }) {
  let score = 0;

  if (auth === 'none') {
    score += 3;
  }
  if (encryption === 'http') {
    score += 3;
  }
  if (rateLimit === 'missing') {
    score += 2;
  } else if (rateLimit === 'partial') {
    score += 1;
  }
  if (!documented) {
    score += 1;
  }
  if (status === 'zombie') {
    score += 2;
  }

  if (score >= 7) {
    return 'high';
  }
  if (score >= 4) {
    return 'medium';
  }
  return 'low';
}

function recommendationFor(status, risk) {
  if (status === 'zombie' || (status === 'orphan' && risk === 'high')) {
    return 'Immediate block on gateway';
  }
  if (status === 'orphan') {
    return 'Validate owner and disable';
  }
  if (status === 'deprecated') {
    return 'Migrate clients and retire';
  }
  return 'Monitor';
}

function toTitle(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function authLabel(auth) {
  return auth === 'none' ? 'None' : auth.toUpperCase();
}

function encryptionLabel(encryption) {
  return encryption.toUpperCase();
}

function rateLimitLabel(rateLimit) {
  if (rateLimit === 'enabled') {
    return 'Enabled';
  }
  if (rateLimit === 'partial') {
    return 'Partial';
  }
  return 'Missing';
}

function createRow(data) {
  const status = classifyStatus(data);
  const risk = classifyRisk({ ...data, status });
  const recommendation = recommendationFor(status, risk);

  const row = document.createElement('tr');
  row.dataset.source = data.source;
  row.dataset.status = status;
  row.dataset.risk = risk;
  row.dataset.documentation = String(data.documented);
  row.dataset.calls = String(data.callsLast30);
  row.dataset.deprecated = String(data.deprecatedFlag);

  const opsButton = status === 'zombie' || status === 'orphan'
    ? '<button class="inline-btn warn" data-op="queue-disable">Queue Disable</button>'
    : '<button class="inline-btn" data-op="audit">Audit</button>';

  row.innerHTML = `
    <td>${data.endpoint}</td>
    <td>${sourceLabel[data.source]}</td>
    <td><span class="badge ${statusBadgeClass[status]}">${toTitle(status)}</span></td>
    <td><span class="badge ${riskBadgeClass[risk]}">${toTitle(risk)}</span></td>
    <td>${authLabel(data.auth)}</td>
    <td>${encryptionLabel(data.encryption)}</td>
    <td>${rateLimitLabel(data.rateLimit)}</td>
    <td>${recommendation}</td>
    <td>${opsButton}</td>
  `;

  return { row, status, risk };
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((chip) => chip.classList.remove('active'));
    button.classList.add('active');
    applyCurrentFilter();
  });
});

analyzerForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const endpoint = document.getElementById('endpointInput').value.trim();
  if (!endpoint.startsWith('/')) {
    pushAlert('warning', 'MEDIUM: Endpoint path should start with <strong>/</strong>.', false);
    return;
  }

  const payload = {
    endpoint,
    source: document.getElementById('sourceInput').value,
    callsLast30: Number(document.getElementById('callsInput').value),
    auth: document.getElementById('authInput').value,
    encryption: document.getElementById('encryptionInput').value,
    rateLimit: document.getElementById('rateLimitInput').value,
    documented: document.getElementById('documentedInput').checked,
    deprecatedFlag: document.getElementById('deprecatedInput').checked
  };

  const { row, status, risk } = createRow(payload);
  tableBody.prepend(row);
  analyzerForm.reset();
  document.getElementById('documentedInput').checked = true;

  const level = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'info';
  pushAlert(level, `${toTitle(risk)}: Endpoint <strong>${payload.endpoint}</strong> classified as <strong>${toTitle(status)}</strong>.`, false);

  refreshMetrics();
  applyCurrentFilter();
  persistInventory();
});

scanBtn.addEventListener('click', () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';

  setTimeout(() => {
    const candidates = [
      {
        endpoint: '/api/reports/legacy',
        source: 'network',
        callsLast30: 0,
        auth: 'none',
        encryption: 'http',
        rateLimit: 'missing',
        documented: false,
        deprecatedFlag: false
      },
      {
        endpoint: '/api/v2/customer-profile',
        source: 'gateway',
        callsLast30: 940,
        auth: 'jwt',
        encryption: 'https',
        rateLimit: 'enabled',
        documented: true,
        deprecatedFlag: false
      },
      {
        endpoint: '/api/dev/metrics',
        source: 'repo',
        callsLast30: 0,
        auth: 'none',
        encryption: 'https',
        rateLimit: 'partial',
        documented: false,
        deprecatedFlag: false
      }
    ];

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    const { row, status, risk } = createRow(selected);
    tableBody.prepend(row);

    const level = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'info';
    pushAlert(level, `${toTitle(risk)}: Scan discovered <strong>${selected.endpoint}</strong> from ${sourceLabel[selected.source]}. Status: <strong>${toTitle(status)}</strong>.`, false);

    refreshMetrics();
    applyCurrentFilter();
    persistInventory();
    updateLastScanLabel();

    scanBtn.textContent = 'Run Discovery Scan';
    scanBtn.disabled = false;
  }, 1000);
});

simulateBtn.addEventListener('click', () => {
  pushAlert('danger', 'HIGH: Undocumented endpoint <strong>/api/test/internal-stats</strong> detected from network telemetry.', false);
});

tableBody.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.dataset.op !== 'queue-disable') {
    return;
  }

  const row = target.closest('tr');
  if (!row) {
    return;
  }

  const endpoint = row.children[0]?.textContent || 'endpoint';
  target.textContent = 'Queued';
  target.disabled = true;
  pushAlert('warning', `MEDIUM: Decommission workflow queued for <strong>${endpoint}</strong>.`, false);
});

function hydrateFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    tableBody.innerHTML = saved;
  }
}

hydrateFromStorage();
refreshMetrics();
applyCurrentFilter();
updateLastScanLabel();

filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((chip) => chip.classList.remove('active'));
    button.classList.add('active');

    const filter = button.dataset.filter;
    rows.forEach((row) => {
      const status = row.dataset.status;
      const risk = row.dataset.risk;

      const showAll = filter === 'all';
      const showZombie = filter === 'zombie' && status === 'zombie';
      const showHigh = filter === 'high' && risk === 'high';

      row.style.display = showAll || showZombie || showHigh ? '' : 'none';
    });
  });
});

scanBtn.addEventListener('click', () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';

  setTimeout(() => {
    const totalApis = document.getElementById('totalApis');
    totalApis.textContent = Number(totalApis.textContent) + 1;

    const orphanApis = document.getElementById('orphanApis');
    orphanApis.textContent = Number(orphanApis.textContent) + 1;

    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert info';
    infoAlert.innerHTML = 'INFO: New endpoint found <strong>/api/reports/legacy</strong> and classified as orphan';
    alertPanel.appendChild(infoAlert);

    scanBtn.textContent = 'Run Discovery Scan';
    scanBtn.disabled = false;
  }, 1200);
});

simulateBtn.addEventListener('click', () => {
  const highAlert = document.createElement('div');
  highAlert.className = 'alert danger';
  highAlert.innerHTML = 'HIGH: Undocumented endpoint <strong>/api/test/internal-stats</strong> detected from network scan';
  alertPanel.prepend(highAlert);
});