const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const POSITIONS_9MAX = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

const MATRIX_LABELS = [];
for (let r = 0; r < 13; r++) {
  for (let c = 0; c < 13; c++) {
    if (r === c) {
      MATRIX_LABELS.push(RANKS[r] + RANKS[c]);
    } else if (r < c) {
      MATRIX_LABELS.push(RANKS[r] + RANKS[c] + 's');
    } else {
      MATRIX_LABELS.push(RANKS[c] + RANKS[r] + 'o');
    }
  }
}

function getCombos(label) {
  if (label.length === 2) return 6;
  if (label.endsWith('s')) return 4;
  return 12;
}

// Runtime State
let currentTab = 'counter';
let currentMatrixData = {};
let currentBrushColor = '#ef4444';
let currentBrushLabel = '3-Bet / 4-Bet';
let isMouseDown = false;
let matrixFilter = 'all';

let currentPosition = 'BTN';
let counterCounts = {};
let counterHistory = [];
let counterMode = 'add';
let stagedHands = [];
let isStagingMode = false;
let savedSessions = [];
let activeEditingLogId = null;

let quizCurrent = null;
let quizTotal = 0;
let quizCorrect = 0;
let isFogActive = false;

window.addEventListener('DOMContentLoaded', () => {
  loadStorageData();
  initMatrixDOM();
  setupMouseEvents();

  const lastTab = localStorage.getItem('poker_lab_last_tab') || 'counter';
  switchTab(lastTab);
  set9MaxPos(currentPosition || 'BTN');
  refreshSessionsUI();
  renderStagedPills();
  updateStagingModeUI();

  initBCScheme();
  setTimeout(checkNewVersionAvailable, 1200);

  const savedCfg = localStorage.getItem('poker_lab_fb_config');
  const savedRoom = localStorage.getItem('poker_lab_fb_room') || 'my_poker_lab';
  if (savedCfg) {
    try { initFirebase(JSON.parse(savedCfg), savedRoom); } catch(e){}
  }
});

function initMatrixDOM() {
  const container = document.getElementById('poker-matrix');
  container.innerHTML = '';
  
  MATRIX_LABELS.forEach(label => {
    const div = document.createElement('div');
    div.className = 'cell bg-slate-900 border border-slate-800 text-slate-300';
    div.id = 'cell-' + label;
    div.dataset.hand = label;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = label;
    textSpan.id = 'text-' + label;
    div.appendChild(textSpan);

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'badge-count hidden';
    badgeSpan.id = 'badge-' + label;
    div.appendChild(badgeSpan);
    
    div.addEventListener('click', () => handleCellClick(label));
    div.addEventListener('mouseenter', () => handleCellHover(label));
    container.appendChild(div);
  });
}

function setupMouseEvents() {
  window.addEventListener('mousedown', () => isMouseDown = true);
  window.addEventListener('mouseup', () => isMouseDown = false);
}

function set9MaxPos(pos) {
  currentPosition = pos;
  localStorage.setItem('poker_lab_current_pos', pos);

  POSITIONS_9MAX.forEach(p => {
    const btn = document.getElementById(`pos-btn-${p}`);
    if (!btn) return;
    if (p === pos) {
      btn.className = 'pos-btn py-1 rounded bg-amber-600 border border-amber-500 text-white font-bold';
    } else {
      btn.className = 'pos-btn py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800';
    }
  });

  const badge = document.getElementById('current-pos-badge');
  if (badge) badge.textContent = `${pos} 位`;
}

function filterMatrixView(filterType) {
  matrixFilter = filterType;
  ['all', 'pair', 'suited', 'broadway'].forEach(f => {
    const btn = document.getElementById(`btn-filter-${f}`);
    if (!btn) return;
    if (f === filterType) {
      btn.className = 'px-2 py-0.5 rounded bg-blue-600 text-white font-medium text-[11px]';
    } else {
      btn.className = 'px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px]';
    }
  });

  const broadwayRanks = ['A', 'K', 'Q', 'J', 'T'];
  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    if (!el) return;

    let visible = true;
    if (filterType === 'pair') {
      visible = (label.length === 2 && label[0] === label[1]);
    } else if (filterType === 'suited') {
      visible = label.endsWith('s');
    } else if (filterType === 'broadway') {
      visible = broadwayRanks.includes(label[0]) && broadwayRanks.includes(label[1]);
    }

    if (visible) {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    } else {
      el.style.opacity = '0.18';
      el.style.pointerEvents = 'none';
    }
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  localStorage.setItem('poker_lab_last_tab', tabId);

  const allTabs = ['counter', 'sessions', 'paint', 'presets', 'diff', 'trainer'];
  allTabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (!btn || !panel) return;

    if (t === tabId) {
      btn.className = 'px-2.5 py-1.5 rounded font-medium text-white bg-blue-600 transition whitespace-nowrap';
      panel.classList.remove('hidden');
    } else {
      btn.className = 'px-2.5 py-1.5 rounded font-medium text-slate-400 hover:text-white transition whitespace-nowrap';
      panel.classList.add('hidden');
    }
  });

  const posBar = document.getElementById('pos-bar-container');
  if (tabId === 'counter' || tabId === 'sessions') {
    posBar.classList.remove('hidden');
  } else {
    posBar.classList.add('hidden');
  }

  const fog = document.getElementById('trainer-fog');
  if (tabId === 'trainer') {
    fog.classList.remove('hidden');
    isFogActive = true;
    if (!quizCurrent) generateNextQuiz();
  } else {
    fog.classList.add('hidden');
    isFogActive = false;
  }

  const titleEl = document.getElementById('matrix-title');
  const footerTip = document.getElementById('matrix-footer-tip');
  
  if (tabId === 'counter') {
    renderCounterMatrix();
    updateStagingModeUI();
  } else if (tabId === 'sessions') {
    titleEl.textContent = '手牌矩陣 (13×13) - 牌局熱度總覽';
    footerTip.textContent = '顯示歷史所有牌局彙整之發牌次數與熱度分佈。';
    renderAggregateMatrix();
    refreshSessionsUI();
  } else if (tabId === 'paint') {
    titleEl.textContent = '手牌矩陣 (13×13) - 自由上色中';
    footerTip.textContent = '對角線: 對子 | 右上: 同花 (s) | 左下: 雜色 (o)';
    hideAllBadges();
    refreshPaintMatrix();
  } else if (tabId === 'presets') {
    titleEl.textContent = '手牌矩陣 (13×13) - GTO 範圍檢視';
    footerTip.textContent = '對角線: 對子 | 右上: 同花 (s) | 左下: 雜色 (o)';
    hideAllBadges();
    renderActivePreset();
  } else if (tabId === 'diff') {
    titleEl.textContent = '手牌矩陣 (13×13) - 雙範圍對比 (Diff)';
    footerTip.textContent = '綠色: 重疊 | 藍色: 僅A | 黃色: 僅B';
    hideAllBadges();
    runRangeDiff();
  } else if (tabId === 'trainer') {
    titleEl.textContent = '手牌矩陣 (13×13) - 決策測驗';
    footerTip.textContent = '完成右側測驗後解鎖理論建議範圍與該底牌高亮。';
    hideAllBadges();
  }

  filterMatrixView(matrixFilter);
}

function hideAllBadges() {
  MATRIX_LABELS.forEach(label => {
    const badge = document.getElementById('badge-' + label);
    if (badge) badge.classList.add('hidden');
  });
}

function handleCellClick(label) {
  if (currentTab === 'counter') {
    if (isStagingMode) {
      addStagedHandDirect(label);
    } else {
      if (counterMode === 'add') {
        addHandCount(label);
      } else {
        subHandCount(label);
      }
    }
  } else if (currentTab === 'paint') {
    paintCell(label);
  }
}

function handleCellHover(label) {
  if (currentTab === 'paint' && isMouseDown) {
    paintCell(label);
  }
}

function setCounterMode(mode) {
  counterMode = mode;
  const addBtn = document.getElementById('counter-mode-add');
  const subBtn = document.getElementById('counter-mode-sub');
  if (mode === 'add') {
    addBtn.className = 'col-span-4 py-1.5 rounded-lg font-bold bg-blue-600 text-white border border-blue-500 transition flex items-center justify-center gap-1 text-[11px]';
    subBtn.className = 'col-span-4 py-1.5 rounded-lg font-bold bg-slate-950 text-slate-400 border border-slate-800 hover:text-white transition flex items-center justify-center gap-1 text-[11px]';
  } else {
    subBtn.className = 'col-span-4 py-1.5 rounded-lg font-bold bg-rose-600 text-white border border-rose-500 transition flex items-center justify-center gap-1 text-[11px]';
    addBtn.className = 'col-span-4 py-1.5 rounded-lg font-bold bg-slate-950 text-slate-400 border border-slate-800 hover:text-white transition flex items-center justify-center gap-1 text-[11px]';
  }
}

function getFormattedTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function normalizeHandNotation(raw) {
  let str = raw.trim();
  if (!str) return null;
  let r1 = str[0].toUpperCase();
  let r2 = str.length > 1 ? str[1].toUpperCase() : '';
  let suffix = str.length > 2 ? str[2].toLowerCase() : '';

  if (!RANKS.includes(r1)) return null;
  if (!r2) { r2 = r1; }
  if (!RANKS.includes(r2)) return null;

  let i1 = RANKS.indexOf(r1);
  let i2 = RANKS.indexOf(r2);

  if (i1 === i2) {
    return r1 + r2;
  } else if (i1 > i2) {
    let tmp = r1; r1 = r2; r2 = tmp;
  }

  if (suffix === 's' || suffix === 'o') {
    return r1 + r2 + suffix;
  }
  return r1 + r2 + 's';
}

function toggleStagingMode(enabled) {
  isStagingMode = enabled;
  localStorage.setItem('poker_lab_staging_mode', enabled ? '1' : '0');
  updateStagingModeUI();
}

function updateStagingModeUI() {
  const chk = document.getElementById('chk-staging-mode');
  if (chk) chk.checked = isStagingMode;

  const titleEl = document.getElementById('matrix-title');
  const footerTip = document.getElementById('matrix-footer-tip');
  if (currentTab === 'counter') {
    if (isStagingMode) {
      titleEl.innerHTML = '手牌矩陣 (13×13) - <span class="text-amber-400 font-bold animate-pulse">⏳ 暫存模式中</span>';
      footerTip.textContent = '【暫存模式已開啟】點選左側手牌將直接加入暫存區，不直接計入統計。';
    } else {
      titleEl.textContent = '手牌矩陣 (13×13) - 拿牌計數中';
      footerTip.textContent = '點選手牌單次增加拿牌數；點擊流水帳記錄可編輯/刪除。';
    }
  }
}

function addStagedHandDirect(label) {
  stagedHands.push({
    id: 'stg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    hand: label,
    pos: currentPosition,
    time: getFormattedTime()
  });
  saveStorageData();
  renderStagedPills();
  
  const el = document.getElementById('cell-' + label);
  if (el) {
    const origBorder = el.style.borderColor;
    el.style.borderColor = '#f59e0b';
    setTimeout(() => { el.style.borderColor = origBorder || '#1e293b'; }, 220);
  }
}

function addStagedHand() {
  const inputEl = document.getElementById('staging-input-hand');
  const val = inputEl.value.trim();
  if (!val) {
    inputEl.focus();
    return;
  }
  const hand = normalizeHandNotation(val);
  if (!hand) {
    alert('請輸入有效手牌代碼 (例如: AKs, 88, KJo, A5s)！');
    inputEl.focus();
    return;
  }

  stagedHands.push({
    id: 'stg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    hand: hand,
    pos: currentPosition,
    time: getFormattedTime()
  });
  inputEl.value = '';
  inputEl.focus();
  saveStorageData();
  renderStagedPills();
}

function removeStagedHand(id) {
  stagedHands = stagedHands.filter(x => x.id !== id);
  saveStorageData();
  renderStagedPills();
}

function commitSingleStagedHand(id) {
  const item = stagedHands.find(x => x.id === id);
  if (!item) return;
  
  counterCounts[item.hand] = (counterCounts[item.hand] || 0) + 1;
  counterHistory.push({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'hand',
    hand: item.hand,
    pos: item.pos || currentPosition,
    action: 'add',
    time: item.time || getFormattedTime(),
    timestamp: Date.now()
  });

  stagedHands = stagedHands.filter(x => x.id !== id);
  saveStorageData();
  renderStagedPills();
  renderCounterMatrix();
}

function commitAllStagedHands() {
  if (stagedHands.length === 0) {
    alert('暫存區目前沒有手牌！');
    return;
  }

  stagedHands.forEach(item => {
    counterCounts[item.hand] = (counterCounts[item.hand] || 0) + 1;
    counterHistory.push({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'hand',
      hand: item.hand,
      pos: item.pos || currentPosition,
      action: 'add',
      time: item.time || getFormattedTime(),
      timestamp: Date.now()
    });
  });

  const count = stagedHands.length;
  stagedHands = [];
  saveStorageData();
  renderStagedPills();
  renderCounterMatrix();
  alert(`已將暫存區的 ${count} 組手牌全數加入手牌矩陣與流水帳！`);
}

function renderStagedPills() {
  const container = document.getElementById('staging-pills-container');
  const statusLabel = document.getElementById('staging-status');
  statusLabel.textContent = `暫存: ${stagedHands.length} 組`;

  if (stagedHands.length === 0) {
    container.innerHTML = '<span class="text-slate-600 text-[10px] italic">還在記上一手但新牌發下時，先在此鍵入暫存！</span>';
    return;
  }

  let html = '';
  stagedHands.forEach(item => {
    html += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 font-mono text-[11px] font-bold shadow-sm">
      <span>${item.hand}</span>
      <span class="text-[9px] text-amber-500">(${item.pos})</span>
      <button onclick="commitSingleStagedHand('${item.id}')" title="加入手牌區" class="text-emerald-400 hover:text-emerald-300 ml-1 font-bold">✔</button>
      <button onclick="removeStagedHand('${item.id}')" title="刪除暫存" class="text-rose-400 hover:text-rose-300 font-bold">✕</button>
    </span>`;
  });
  container.innerHTML = html;
}

function addHandCount(label) {
  counterCounts[label] = (counterCounts[label] || 0) + 1;
  const timeStr = getFormattedTime();
  counterHistory.push({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'hand',
    hand: label,
    pos: currentPosition,
    action: 'add',
    time: timeStr,
    timestamp: Date.now()
  });
  saveStorageData();
  renderCounterMatrix();
}

function subHandCount(label) {
  if (!counterCounts[label] || counterCounts[label] <= 0) return;
  counterCounts[label]--;
  if (counterCounts[label] === 0) delete counterCounts[label];
  const timeStr = getFormattedTime();
  counterHistory.push({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'hand',
    hand: label,
    pos: currentPosition,
    action: 'sub',
    time: timeStr,
    timestamp: Date.now()
  });
  saveStorageData();
  renderCounterMatrix();
}

function submitCustomLogText() {
  const inputEl = document.getElementById('log-custom-text');
  const text = inputEl.value.trim();
  if (!text) {
    inputEl.focus();
    return;
  }
  const timeStr = getFormattedTime();
  counterHistory.push({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'text',
    text: text,
    time: timeStr,
    timestamp: Date.now()
  });
  inputEl.value = '';
  saveStorageData();
  renderCounterMatrix();
}

function submitTableStateLog() {
  const bbEl = document.getElementById('log-bb-size');
  const stackEl = document.getElementById('log-stack-size');
  const bbVal = bbEl.value.trim();
  const stackVal = stackEl.value.trim();

  if (!bbVal && !stackVal) {
    alert('請輸入大盲金額或籌碼量！');
    bbEl.focus();
    return;
  }

  let bbCountStr = '';
  const numBB = parseFloat(bbVal);
  const numStack = parseFloat(stackVal);
  if (!isNaN(numBB) && !isNaN(numStack) && numBB > 0) {
    bbCountStr = `${(numStack / numBB).toFixed(1)} BB`;
  }

  const timeStr = getFormattedTime();
  counterHistory.push({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'table_state',
    pos: currentPosition,
    bb: bbVal || '-',
    stack: stackVal || '-',
    bbCount: bbCountStr,
    time: timeStr,
    timestamp: Date.now()
  });

  saveStorageData();
  renderCounterMatrix();
}

function undoLastCounterLog() {
  if (counterHistory.length === 0) {
    alert('目前無可撤銷之操作紀錄！');
    return;
  }
  const last = counterHistory.pop();

  if (!last.type || last.type === 'hand') {
    if (last.action === 'add') {
      if (counterCounts[last.hand]) {
        counterCounts[last.hand]--;
        if (counterCounts[last.hand] <= 0) delete counterCounts[last.hand];
      }
    } else if (last.action === 'sub') {
      counterCounts[last.hand] = (counterCounts[last.hand] || 0) + 1;
    }
  } else if (last.type === 'text') {
    const inputEl = document.getElementById('log-custom-text');
    inputEl.value = last.text;
    inputEl.focus();
  } else if (last.type === 'table_state') {
    if (last.bb && last.bb !== '-') document.getElementById('log-bb-size').value = last.bb;
    if (last.stack && last.stack !== '-') document.getElementById('log-stack-size').value = last.stack;
    if (last.pos) set9MaxPos(last.pos);
  }

  saveStorageData();
  renderCounterMatrix();
}

function recalculateCountsFromHistory() {
  const newCounts = {};
  counterHistory.forEach(item => {
    if (!item.type || item.type === 'hand') {
      if (item.action === 'add') {
        newCounts[item.hand] = (newCounts[item.hand] || 0) + 1;
      } else if (item.action === 'sub') {
        if (newCounts[item.hand]) {
          newCounts[item.hand]--;
          if (newCounts[item.hand] <= 0) delete newCounts[item.hand];
        }
      }
    }
  });
  counterCounts = newCounts;
}

function openLogEditModal(logId) {
  activeEditingLogId = logId;
  const log = counterHistory.find(x => (x.id || x.timestamp) == logId);
  if (!log) return;

  document.getElementById('edit-log-modal').classList.remove('hidden');
  const handRow = document.getElementById('edit-row-hand');
  const textRow = document.getElementById('edit-row-text');
  const stateRow = document.getElementById('edit-row-state');

  handRow.classList.add('hidden');
  textRow.classList.add('hidden');
  stateRow.classList.add('hidden');

  document.getElementById('edit-log-pos').value = log.pos || 'BTN';

  if (!log.type || log.type === 'hand') {
    handRow.classList.remove('hidden');
    document.getElementById('edit-log-hand').value = log.hand;
  } else if (log.type === 'text') {
    textRow.classList.remove('hidden');
    document.getElementById('edit-log-text').value = log.text;
  } else if (log.type === 'table_state') {
    stateRow.classList.remove('hidden');
    document.getElementById('edit-log-bb').value = log.bb;
    document.getElementById('edit-log-stack').value = log.stack;
  }
}

function closeLogEditModal() {
  document.getElementById('edit-log-modal').classList.add('hidden');
  activeEditingLogId = null;
}

function saveEditedLog() {
  if (!activeEditingLogId) return;
  const logIndex = counterHistory.findIndex(x => (x.id || x.timestamp) == activeEditingLogId);
  if (logIndex === -1) return;

  const log = counterHistory[logIndex];
  const newPos = document.getElementById('edit-log-pos').value;
  log.pos = newPos;

  if (!log.type || log.type === 'hand') {
    const rawHand = document.getElementById('edit-log-hand').value;
    const normalized = normalizeHandNotation(rawHand);
    if (!normalized) {
      alert('請輸入有效手牌代碼 (如 AKs, 88)！');
      return;
    }
    log.hand = normalized;
  } else if (log.type === 'text') {
    log.text = document.getElementById('edit-log-text').value.trim();
  } else if (log.type === 'table_state') {
    const bbVal = document.getElementById('edit-log-bb').value.trim();
    const stackVal = document.getElementById('edit-log-stack').value.trim();
    log.bb = bbVal || '-';
    log.stack = stackVal || '-';
    const numBB = parseFloat(bbVal);
    const numStack = parseFloat(stackVal);
    if (!isNaN(numBB) && !isNaN(numStack) && numBB > 0) {
      log.bbCount = `${(numStack / numBB).toFixed(1)} BB`;
    }
  }

  recalculateCountsFromHistory();
  saveStorageData();
  renderCounterMatrix();
  closeLogEditModal();
}

function deleteEditedLog() {
  if (!activeEditingLogId) return;
  if (!confirm('確定要直接刪除此筆流水帳紀錄嗎？對應手牌計數將同步扣回！')) return;

  counterHistory = counterHistory.filter(x => (x.id || x.timestamp) != activeEditingLogId);
  recalculateCountsFromHistory();
  saveStorageData();
  renderCounterMatrix();
  closeLogEditModal();
}

function clearAllCounterData() {
  if (confirm('確定要清空當前牌局的手牌拿牌次數與動態流水帳嗎？')) {
    counterCounts = {};
    counterHistory = [];
    saveStorageData();
    renderCounterMatrix();
  }
}

function renderCounterMatrix() {
  if (currentTab !== 'counter') return;

  let totalHands = 0;
  let maxCount = 0;
  for (const count of Object.values(counterCounts)) {
    totalHands += count;
    if (count > maxCount) maxCount = count;
  }

  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    const badge = document.getElementById('badge-' + label);
    const count = counterCounts[label] || 0;

    if (count > 0) {
      const ratio = maxCount > 0 ? (count / maxCount) : 0;
      if (ratio > 0.75) {
        el.style.backgroundColor = '#b91c1c';
        el.style.borderColor = '#ef4444';
      } else if (ratio > 0.45) {
        el.style.backgroundColor = '#c2410c';
        el.style.borderColor = '#f97316';
      } else if (ratio > 0.2) {
        el.style.backgroundColor = '#1d4ed8';
        el.style.borderColor = '#3b82f6';
      } else {
        el.style.backgroundColor = '#1e293b';
        el.style.borderColor = '#334155';
      }
      el.style.color = '#ffffff';
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      resetCellDefault(el, label);
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  });

  document.getElementById('counter-total-badge').textContent = `目前牌局: ${totalHands} 手`;
  const distinctHands = Object.keys(counterCounts).length;
  document.getElementById('matrix-stat').textContent = `拿過手牌: ${distinctHands} / 169 (共 ${totalHands} 手)`;

  renderCounterLogs();
  renderCounterTopList(totalHands);
}

function changeLogHeight(heightClass) {
  const container = document.getElementById('counter-log-list');
  container.className = `${heightClass} overflow-y-auto space-y-1 text-[11px] font-mono pr-1 text-slate-300 divide-y divide-slate-900`;
  localStorage.setItem('poker_lab_log_height', heightClass);
}

function renderCounterLogs() {
  const container = document.getElementById('counter-log-list');
  const countIndicator = document.getElementById('log-count-indicator');
  countIndicator.textContent = `${counterHistory.length} 筆全部顯示`;

  if (counterHistory.length === 0) {
    container.innerHTML = '<div class="text-slate-600 py-3 text-center italic text-xs">點擊手牌或點按上方按鈕開始打點</div>';
    return;
  }

  let html = '';
  const reversed = [...counterHistory].reverse();
  reversed.forEach(item => {
    const logId = item.id || item.timestamp;
    if (!item.type || item.type === 'hand') {
      const isAdd = item.action === 'add';
      const colorClass = isAdd ? 'text-emerald-400' : 'text-rose-400';
      const symbol = isAdd ? '➕ 拿到' : '➖ 倒扣';
      const posBadge = item.pos ? `<span class="px-1 py-0.2 rounded text-[9px] bg-slate-800 text-amber-300 font-bold font-mono">${item.pos}</span>` : '';
      html += `<div onclick="openLogEditModal('${logId}')" class="flex items-center justify-between py-1.5 px-1.5 hover:bg-slate-800/80 cursor-pointer rounded transition group">
        <span class="flex items-center gap-1.5">
          ${posBadge}
          <span class="font-bold ${colorClass}">${item.hand}</span>
          <span class="text-[9px] text-slate-400">(${symbol})</span>
        </span>
        <span class="text-slate-500 font-mono text-[9px] flex items-center gap-1">
          <span>${item.time}</span>
          <span class="opacity-0 group-hover:opacity-100 text-cyan-400">✏️</span>
        </span>
      </div>`;
    } else if (item.type === 'text') {
      html += `<div onclick="openLogEditModal('${logId}')" class="flex items-start justify-between py-1.5 px-1.5 hover:bg-purple-950/40 cursor-pointer rounded bg-purple-950/20 transition group">
        <span class="flex items-start gap-1.5 pr-1">
          <span class="text-purple-400 font-bold">💬</span>
          <span class="text-purple-200 text-[11px] break-all">${item.text}</span>
        </span>
        <span class="text-slate-500 font-mono text-[9px] whitespace-nowrap flex items-center gap-1">
          <span>${item.time}</span>
          <span class="opacity-0 group-hover:opacity-100 text-cyan-400">✏️</span>
        </span>
      </div>`;
    } else if (item.type === 'table_state') {
      const posBadge = item.pos ? `<span class="px-1 py-0.2 rounded text-[9px] bg-slate-800 text-amber-300 font-bold font-mono">${item.pos}</span>` : '';
      const bbRatioBadge = item.bbCount ? `<span class="bg-emerald-900 text-emerald-200 px-1 rounded text-[9px] font-bold">${item.bbCount}</span>` : '';
      html += `<div onclick="openLogEditModal('${logId}')" class="flex items-center justify-between py-1.5 px-1.5 hover:bg-emerald-950/40 cursor-pointer rounded bg-emerald-950/20 transition group">
        <span class="flex items-center gap-1.5">
          <span class="text-emerald-400 font-bold">🪙</span>
          ${posBadge}
          <span class="text-slate-200 text-[11px] font-mono">BB: ${item.bb} | 碼: ${item.stack}</span>
          ${bbRatioBadge}
        </span>
        <span class="text-slate-500 font-mono text-[9px] flex items-center gap-1">
          <span>${item.time}</span>
          <span class="opacity-0 group-hover:opacity-100 text-cyan-400">✏️</span>
        </span>
      </div>`;
    }
  });
  container.innerHTML = html;
}

function renderCounterTopList(totalHands) {
  const container = document.getElementById('counter-top-list');
  const sorted = Object.entries(counterCounts).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    container.innerHTML = '尚無紀錄';
    return;
  }

  let html = '';
  sorted.slice(0, 5).forEach(([hand, count], idx) => {
    const pct = totalHands > 0 ? ((count / totalHands) * 100).toFixed(1) : 0;
    html += `<div class="flex justify-between items-center py-0.5">
      <span class="text-slate-200 font-bold">#${idx + 1} ${hand}</span>
      <span class="text-cyan-400 font-mono">${count} 次 (${pct}%)</span>
    </div>`;
  });
  container.innerHTML = html;
}

// Sessions
function saveCurrentAsNewSession() {
  let totalHands = 0;
  for (const count of Object.values(counterCounts)) totalHands += count;

  if (totalHands === 0 && counterHistory.length === 0) {
    alert('目前尚未記錄任何手牌或流水帳，無法存檔！');
    return;
  }

  const defaultName = `牌局 #${savedSessions.length + 1} (${new Date().toLocaleDateString()})`;
  const sessionName = prompt('請輸入此場牌局名稱或備註 (如: 台北實戰 200BB / 錦標賽 Day 1)：', defaultName);
  if (!sessionName) return;

  const newSession = {
    id: 'sess_' + Date.now(),
    name: sessionName.trim(),
    createdAt: new Date().toLocaleString(),
    totalHands: totalHands,
    counts: { ...counterCounts },
    history: [ ...counterHistory ]
  };

  savedSessions.unshift(newSession);
  saveStorageData();
  refreshSessionsUI();
  alert(`牌局「${newSession.name}」已成功儲存！共 ${totalHands} 手牌。`);
}

function clearCurrentWorkingSession() {
  if (confirm('確定要結束並清空當前牌局，開始全新的一局嗎？（建議先點擊「存為獨立牌局」或上傳雲端備份）')) {
    counterCounts = {};
    counterHistory = [];
    saveStorageData();
    renderCounterMatrix();
    refreshSessionsUI();
    switchTab('counter');
  }
}

function loadSessionToActive(sessionId) {
  const sess = savedSessions.find(s => s.id === sessionId);
  if (!sess) return;
  if (confirm(`確定要將「${sess.name}」載入回當前作業工作區嗎？這會覆蓋目前未存檔的打點數據。`)) {
    counterCounts = { ...sess.counts };
    counterHistory = [ ...sess.history ];
    saveStorageData();
    switchTab('counter');
  }
}

function deleteSession(sessionId) {
  const idx = savedSessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return;
  if (confirm(`確定要刪除「${savedSessions[idx].name}」這筆歷史牌局紀錄嗎？`)) {
    savedSessions.splice(idx, 1);
    saveStorageData();
    refreshSessionsUI();
    if (currentTab === 'sessions') renderAggregateMatrix();
  }
}

function calculateAggregateStats() {
  const aggCounts = {};
  let totalHands = 0;

  savedSessions.forEach(sess => {
    if (sess.counts) {
      for (const [hand, cnt] of Object.entries(sess.counts)) {
        aggCounts[hand] = (aggCounts[hand] || 0) + cnt;
        totalHands += cnt;
      }
    }
  });

  for (const [hand, cnt] of Object.entries(counterCounts)) {
    aggCounts[hand] = (aggCounts[hand] || 0) + cnt;
    totalHands += cnt;
  }

  return { aggCounts, totalHands, totalSessions: savedSessions.length };
}

function refreshSessionsUI() {
  const { aggCounts, totalHands, totalSessions } = calculateAggregateStats();

  document.getElementById('agg-total-sessions').textContent = `${totalSessions} 場`;
  document.getElementById('agg-total-hands').textContent = `${totalHands} 手`;
  const distinctCount = Object.keys(aggCounts).length;
  document.getElementById('agg-distinct-hands').textContent = `${distinctCount} / 169`;
  document.getElementById('session-count-label').textContent = `共 ${savedSessions.length} 筆`;

  const room = localStorage.getItem('poker_lab_fb_room') || 'my_poker_lab';
  const roomLabel = document.getElementById('sessions-cloud-room');
  if (roomLabel) roomLabel.textContent = `房間: ${room}`;

  const listContainer = document.getElementById('saved-sessions-list');
  if (savedSessions.length === 0) {
    listContainer.innerHTML = '<div class="text-slate-600 py-3 text-center italic text-xs">尚無歸檔牌局，請點擊上方「存為獨立牌局」</div>';
  } else {
    let html = '';
    savedSessions.forEach(sess => {
      html += `<div class="bg-slate-900 border border-slate-800 p-2 rounded flex items-center justify-between gap-2">
        <div class="flex-1 truncate">
          <div class="font-bold text-slate-200 truncate">${sess.name}</div>
          <div class="text-[10px] text-slate-500 font-mono">${sess.createdAt} | 發牌: <span class="text-cyan-400 font-bold">${sess.totalHands}</span> 手</div>
        </div>
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <button onclick="loadSessionToActive('${sess.id}')" class="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition">
            載入檢視
          </button>
          <button onclick="deleteSession('${sess.id}')" class="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-[11px] transition">
            刪除
          </button>
        </div>
      </div>`;
    });
    listContainer.innerHTML = html;
  }
}

function renderAggregateMatrix() {
  const { aggCounts, totalHands } = calculateAggregateStats();
  let maxCount = 0;
  for (const cnt of Object.values(aggCounts)) {
    if (cnt > maxCount) maxCount = cnt;
  }

  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    const badge = document.getElementById('badge-' + label);
    const count = aggCounts[label] || 0;

    if (count > 0) {
      const ratio = maxCount > 0 ? (count / maxCount) : 0;
      if (ratio > 0.75) {
        el.style.backgroundColor = '#b91c1c';
        el.style.borderColor = '#ef4444';
      } else if (ratio > 0.45) {
        el.style.backgroundColor = '#c2410c';
        el.style.borderColor = '#f97316';
      } else if (ratio > 0.2) {
        el.style.backgroundColor = '#1d4ed8';
        el.style.borderColor = '#3b82f6';
      } else {
        el.style.backgroundColor = '#1e293b';
        el.style.borderColor = '#334155';
      }
      el.style.color = '#ffffff';
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      resetCellDefault(el, label);
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  });

  const distinctCount = Object.keys(aggCounts).length;
  document.getElementById('matrix-stat').textContent = `跨場次覆蓋: ${distinctCount} / 169 (共 ${totalHands} 手)`;
}

function generateExportText() {
  const exportData = {
    version: '12.0',
    exportedAt: new Date().toISOString(),
    currentWorking: {
      counts: counterCounts,
      history: counterHistory
    },
    savedSessions: savedSessions,
    studyNotes: localStorage.getItem('poker_lab_study_notes') || ''
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const tb = document.getElementById('transfer-textbox');
  tb.value = jsonStr;
  tb.focus();
  tb.select();
  alert('已成功將全部牌局與統計數據生成於文字框！');
}

function copyTransferTextbox() {
  const tb = document.getElementById('transfer-textbox');
  if (!tb.value.trim()) generateExportText();
  navigator.clipboard.writeText(tb.value).then(() => {
    alert('✅ 已複製全部牌局文字代碼！');
  }).catch(() => {
    tb.select();
    document.execCommand('copy');
    alert('✅ 文字已選取複製！');
  });
}

function importFromTransferTextbox() {
  const tb = document.getElementById('transfer-textbox');
  const text = tb.value.trim();
  if (!text) {
    alert('請先將複製的牌局文字代碼貼入文字框中！');
    tb.focus();
    return;
  }

  try {
    const imported = JSON.parse(text);
    if (confirm('已確認文字格式正確！是否以這批牌局完整覆蓋本地資料？')) {
      if (Array.isArray(imported.savedSessions)) {
        savedSessions = imported.savedSessions;
      }
      if (imported.currentWorking) {
        counterHistory = [ ...(imported.currentWorking.history || []) ];
        counterCounts = { ...(imported.currentWorking.counts || {}) };
      }
      if (imported.studyNotes) {
        localStorage.setItem('poker_lab_study_notes', imported.studyNotes);
        if (document.getElementById('study-notes')) document.getElementById('study-notes').value = imported.studyNotes;
      }

      saveStorageData();
      refreshSessionsUI();
      renderCounterMatrix();
      alert('🎉 牌局文字代碼完整覆蓋載入成功！');
    }
  } catch (err) {
    alert('匯入失敗：格式無效！');
  }
}

// Free Painter
function setBrush(color, label) {
  currentBrushColor = color;
  currentBrushLabel = label;
}

function setCustomBrush(color) {
  currentBrushColor = color;
  const customName = document.getElementById('custom-color-label').value.trim() || '自訂色彩';
  currentBrushLabel = customName;
}

function paintCell(label) {
  const el = document.getElementById('cell-' + label);
  if (currentBrushColor === 'transparent') {
    delete currentMatrixData[label];
    resetCellDefault(el, label);
  } else {
    currentMatrixData[label] = {
      color: currentBrushColor,
      label: currentBrushLabel
    };
    el.style.backgroundColor = currentBrushColor;
    el.style.color = '#ffffff';
    el.style.borderColor = currentBrushColor;
  }
  saveStorageData();
  updatePaintStats();
}

function refreshPaintMatrix() {
  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    if (currentMatrixData[label]) {
      el.style.backgroundColor = currentMatrixData[label].color;
      el.style.color = '#ffffff';
      el.style.borderColor = currentMatrixData[label].color;
    } else {
      resetCellDefault(el, label);
    }
  });
  updatePaintStats();
}

function updatePaintStats() {
  const counts = {};
  let totalCombos = 0;

  for (const [hand, val] of Object.entries(currentMatrixData)) {
    const c = getCombos(hand);
    totalCombos += c;
    if (!counts[val.label]) {
      counts[val.label] = { combos: 0, color: val.color };
    }
    counts[val.label].combos += c;
  }

  const container = document.getElementById('paint-breakdown');
  if (totalCombos === 0) {
    container.innerHTML = '<span class="text-slate-500">尚無上色牌型</span>';
    document.getElementById('matrix-stat').textContent = `入池: 0 / 1326 (0.0%)`;
    return;
  }

  let html = '';
  for (const [lbl, data] of Object.entries(counts)) {
    const p = ((data.combos / 1326) * 100).toFixed(1);
    html += `<div class="flex items-center justify-between">
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${data.color}"></span>
        ${lbl}
      </span>
      <span>${data.combos} 組 (${p}%)</span>
    </div>`;
  }
  container.innerHTML = html;
  const totalPct = ((totalCombos / 1326) * 100).toFixed(1);
  document.getElementById('matrix-stat').textContent = `自訂標註: ${totalCombos} / 1326 (${totalPct}%)`;
}

// Presets & BC Scheme
function initBCScheme() {
  const depthSelect = document.getElementById('preset-depth');
  const posSelect = document.getElementById('preset-pos');
  if (!depthSelect || !posSelect) return;

  depthSelect.addEventListener('change', () => {
    applySchemeC_FilterOptions(depthSelect.value);
    renderActivePreset();
  });

  posSelect.addEventListener('change', () => {
    applySchemeB_AutoJumpDepth(posSelect.value);
    renderActivePreset();
  });

  applySchemeC_FilterOptions(depthSelect.value);
}

function applySchemeC_FilterOptions(depth) {
  const posSelect = document.getElementById('preset-pos');
  if (!posSelect) return;
  const numD = parseInt(depth);
  const options = posSelect.querySelectorAll('option');

  options.forEach(opt => {
    const val = opt.value;
    let shouldDisable = false;
    if (numD >= 30) {
      if (val.includes('_shove_') || val.includes('SHORT_PUSH')) shouldDisable = true;
    } else if (numD <= 15) {
      if (val.includes('_4B_') || val.includes('_5B_') || val.includes('_3B_') || val.includes('MID_CO')) shouldDisable = true;
    }
    opt.disabled = shouldDisable;
    opt.style.color = shouldDisable ? '#475569' : '';
  });
}

function applySchemeB_AutoJumpDepth(pos) {
  const depthSelect = document.getElementById('preset-depth');
  if (!depthSelect) return;
  if (pos.includes('BUBBLE_SHORT') || pos.includes('15_')) {
    depthSelect.value = '15';
    applySchemeC_FilterOptions('15');
  } else if (pos.includes('BUBBLE_MID') || pos.includes('25_')) {
    depthSelect.value = '25';
    applySchemeC_FilterOptions('25');
  } else if (pos.includes('100_')) {
    depthSelect.value = '40';
    applySchemeC_FilterOptions('40');
  }
}

function renderActivePreset() {
  if (currentTab !== 'presets') return;
  const depth = document.getElementById('preset-depth').value;
  const pos = document.getElementById('preset-pos').value;
  
  let preset = GTO_PRESETS[pos] || GTO_PRESETS[`${depth}_${pos}`];
  if (!preset) {
    preset = GTO_PRESETS[`40_${pos}`] 
      || GTO_PRESETS[`25_${pos}`] 
      || GTO_PRESETS[`20_${pos}`] 
      || GTO_PRESETS[`15_${pos}`] 
      || GTO_PRESETS['40_BTN'];
  }
  let isFallback = (preset.key !== `${depth}_${pos}` && preset.name && !preset.name.includes(`${depth}BB`));
  let displayTitle = preset.name;
  if (isFallback && !preset.name.includes('泡沫期')) {
    displayTitle += ' [使用基準 GTO 資料]';
  }
  document.getElementById('preset-desc-title').textContent = displayTitle;
  document.getElementById('preset-desc-body').textContent = preset.desc;

  let inCombos = 0;
  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    if (preset.hands.has(label)) {
      inCombos += getCombos(label);
      el.style.backgroundColor = '#2563eb';
      el.style.color = '#ffffff';
      el.style.borderColor = '#3b82f6';
    } else {
      resetCellDefault(el, label);
    }
  });

  const pct = ((inCombos / 1326) * 100).toFixed(1);
  document.getElementById('matrix-stat').textContent = `入池: ${inCombos} / 1326 (${pct}%)`;
}

function runRangeDiff() {
  if (currentTab !== 'diff') return;
  const keyA = document.getElementById('diff-range-a').value;
  const keyB = document.getElementById('diff-range-b').value;

  const setA = (GTO_PRESETS[keyA] || GTO_PRESETS['40_BTN']).hands;
  const setB = (GTO_PRESETS[keyB] || GTO_PRESETS['15_BTN']).hands;

  let overlap = 0, onlyA = 0, onlyB = 0;

  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    const inA = setA.has(label);
    const inB = setB.has(label);
    const combos = getCombos(label);

    if (inA && inB) {
      overlap += combos;
      el.style.backgroundColor = '#10b981';
      el.style.color = '#ffffff';
      el.style.borderColor = '#059669';
    } else if (inA && !inB) {
      onlyA += combos;
      el.style.backgroundColor = '#2563eb';
      el.style.color = '#ffffff';
      el.style.borderColor = '#1d4ed8';
    } else if (!inA && inB) {
      onlyB += combos;
      el.style.backgroundColor = '#f59e0b';
      el.style.color = '#ffffff';
      el.style.borderColor = '#d97706';
    } else {
      resetCellDefault(el, label);
    }
  });

  document.getElementById('diff-stats').textContent = `重疊: ${overlap} 組 | 僅A: ${onlyA} 組 | 僅B: ${onlyB} 組`;
  document.getElementById('matrix-stat').textContent = `雙範圍對比分析中`;
}

// Trainer
function generateNextQuiz() {
  const q = QUIZ_BANK[Math.floor(Math.random() * QUIZ_BANK.length)];
  quizCurrent = q;

  const fog = document.getElementById('trainer-fog');
  fog.classList.remove('hidden');
  isFogActive = true;

  MATRIX_LABELS.forEach(label => resetCellDefault(document.getElementById('cell-' + label), label));

  document.getElementById('quiz-meta').textContent = `${q.depth} 錦標賽 | 玩家位置: ${q.pos}`;
  document.getElementById('quiz-hero-hand').textContent = q.hand;
  document.getElementById('quiz-question').textContent = `桌況：${q.actionContext}。手持 [${q.hand}]，你的最佳行動是？`;

  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-actions').classList.remove('hidden');
}

function handleQuizAnswer(action) {
  if (!quizCurrent) return;
  quizTotal++;
  const isCorrect = (action === quizCurrent.correct);
  if (isCorrect) quizCorrect++;

  document.getElementById('trainer-score').textContent = `得分: ${quizCorrect} / ${quizTotal}`;
  document.getElementById('trainer-fog').classList.add('hidden');
  isFogActive = false;

  const rangeSet = (GTO_PRESETS[quizCurrent.gtoRangeKey] || GTO_PRESETS['40_BTN']).hands;
  MATRIX_LABELS.forEach(label => {
    const el = document.getElementById('cell-' + label);
    if (label === quizCurrent.hand) {
      el.style.backgroundColor = '#ec4899';
      el.style.color = '#ffffff';
      el.style.borderColor = '#f43f5e';
    } else if (rangeSet.has(label)) {
      el.style.backgroundColor = '#2563eb';
      el.style.color = '#ffffff';
      el.style.borderColor = '#3b82f6';
    } else {
      resetCellDefault(el, label);
    }
  });

  const fbBox = document.getElementById('quiz-feedback');
  const fbTitle = document.getElementById('quiz-feedback-title');
  const fbDesc = document.getElementById('quiz-feedback-desc');

  fbBox.classList.remove('hidden');
  document.getElementById('quiz-actions').classList.add('hidden');

  if (isCorrect) {
    fbTitle.textContent = '✅ 決策正確！';
    fbTitle.className = 'font-bold text-emerald-400';
  } else {
    fbTitle.textContent = `❌ 判斷失誤 (建議行動: ${quizCurrent.correct})`;
    fbTitle.className = 'font-bold text-rose-400';
  }
  fbDesc.textContent = quizCurrent.exp;
}

function toggleFogManual() {
  const fog = document.getElementById('trainer-fog');
  isFogActive = !isFogActive;
  fog.classList.toggle('hidden', !isFogActive);
}

// Storage
function resetCellDefault(el, label) {
  el.style.backgroundColor = '#020617';
  el.style.color = '#64748b';
  el.style.borderColor = '#1e293b';
  if (label.length === 2) el.style.color = '#94a3b8';
}

function clearCurrentMatrix() {
  if (currentTab === 'paint') {
    currentMatrixData = {};
    saveStorageData();
    refreshPaintMatrix();
  } else if (currentTab === 'counter') {
    clearAllCounterData();
  } else {
    MATRIX_LABELS.forEach(label => resetCellDefault(document.getElementById('cell-' + label), label));
    document.getElementById('matrix-stat').textContent = `入池: 0 / 1326 (0.0%)`;
  }
}

function saveNotes() {
  localStorage.setItem('poker_lab_study_notes', document.getElementById('study-notes').value);
}

function saveStorageData() {
  localStorage.setItem('poker_lab_matrix_paint', JSON.stringify(currentMatrixData));
  localStorage.setItem('poker_lab_counter_counts', JSON.stringify(counterCounts));
  localStorage.setItem('poker_lab_counter_history', JSON.stringify(counterHistory));
  localStorage.setItem('poker_lab_saved_sessions', JSON.stringify(savedSessions));
  localStorage.setItem('poker_lab_staged_hands', JSON.stringify(stagedHands));
  triggerAutoSyncIfEnabled();
}

function loadStorageData() {
  const savedNotes = localStorage.getItem('poker_lab_study_notes');
  if (savedNotes && document.getElementById('study-notes')) {
    document.getElementById('study-notes').value = savedNotes;
  }
  const savedPaint = localStorage.getItem('poker_lab_matrix_paint');
  if (savedPaint) {
    try { currentMatrixData = JSON.parse(savedPaint); } catch (e) {}
  }
  const savedHist = localStorage.getItem('poker_lab_counter_history');
  if (savedHist) {
    try { counterHistory = JSON.parse(savedHist); } catch (e) {}
  }
  const savedCounts = localStorage.getItem('poker_lab_counter_counts');
  if (savedCounts) {
    try { counterCounts = JSON.parse(savedCounts); } catch (e) {}
  } else {
    recalculateCountsFromHistory();
  }
  const savedSess = localStorage.getItem('poker_lab_saved_sessions');
  if (savedSess) {
    try { savedSessions = JSON.parse(savedSess); } catch (e) {}
  }
  const savedPos = localStorage.getItem('poker_lab_current_pos');
  if (savedPos) currentPosition = savedPos;
  
  const savedStaged = localStorage.getItem('poker_lab_staged_hands');
  if (savedStaged) {
    try { stagedHands = JSON.parse(savedStaged); } catch (e) {}
  }
  const savedStagingMode = localStorage.getItem('poker_lab_staging_mode');
  if (savedStagingMode === '1') isStagingMode = true;

  const savedH = localStorage.getItem('poker_lab_log_height');
  if (savedH && document.getElementById('log-height-select')) {
    document.getElementById('log-height-select').value = savedH;
    changeLogHeight(savedH);
  }
}

function copyCurrentMatrixHands() {
  const depth = document.getElementById('preset-depth').value;
  const pos = document.getElementById('preset-pos').value;
  const key = `${depth}_${pos}`;
  const preset = GTO_PRESETS[key] || GTO_PRESETS[`40_${pos}`] || GTO_PRESETS['40_BTN'];
  navigator.clipboard.writeText(Array.from(preset.hands).join(', ')).then(() => {
    alert('已複製手牌範圍代碼至剪貼簿！');
  });
}

// Auto Version Check
async function checkNewVersionAvailable() {
  const currentUrl = window.location.href;
  const match = currentUrl.match(/_v(\d+)\.html/i) || currentUrl.match(/v(\d+)\.html/i);
  if (!match) return;

  const currentVerNum = parseInt(match[1]);
  const prefix = currentUrl.substring(0, match.index);
  const isUnderscore = currentUrl.charAt(match.index) === '_';
  
  let highestFoundVer = currentVerNum;
  let highestFoundUrl = '';

  const maxProbe = Math.min(100, currentVerNum + 15);
  const probePromises = [];

  for (let v = currentVerNum + 1; v <= maxProbe; v++) {
    const testUrl = `${prefix}${isUnderscore ? '_v' : 'v'}${v}.html`;
    probePromises.push(
      fetch(testUrl, { method: 'HEAD' })
        .then(res => res.ok ? { ver: v, url: testUrl } : null)
        .catch(() => null)
    );
  }

  const results = await Promise.all(probePromises);
  results.forEach(r => {
    if (r && r.ver > highestFoundVer) {
      highestFoundVer = r.ver;
      highestFoundUrl = r.url;
    }
  });

  if (highestFoundVer > currentVerNum) {
    const banner = document.getElementById('version-update-banner');
    document.getElementById('version-banner-title').textContent = `🎉 發現最新版本 v${highestFoundVer}！`;
    document.getElementById('version-redirect-link').href = highestFoundUrl;
    banner.classList.remove('hidden');
  }
}

function closeVersionBanner() {
  document.getElementById('version-update-banner').classList.add('hidden');
}

function manualCheckNewVersion() {
  checkNewVersionAvailable().then(() => {
    alert('版本檢查完成！若有最新版本將於右下方彈出跳轉提示。');
  });
}
