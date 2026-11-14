// --- 工具函式: HTML 特殊字元跳脫 (徹底防止 88<QQ 破壞 UI) ---
    function escapeHTML(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const FULL_10MAX_POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    const TABLE_POSITIONS_ACTIVE_MAP = {
      10: ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
      9:  ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
      8:  ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
      7:  ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
      6:  ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
      5:  ['UTG', 'CO', 'BTN', 'SB', 'BB'],
      4:  ['UTG', 'BTN', 'SB', 'BB'],
      3:  ['BTN', 'SB', 'BB'],
      2:  ['D/SB', 'BB']
    };

    const MATRIX_LABELS = [];
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        if (r === c) MATRIX_LABELS.push(RANKS[r] + RANKS[c]);
        else if (r < c) MATRIX_LABELS.push(RANKS[r] + RANKS[c] + 's');
        else MATRIX_LABELS.push(RANKS[c] + RANKS[r] + 'o');
      }
    }

    const DEFAULT_FB_CONFIG = {
      apiKey: "AIzaSyA87EmRdRvAXV0mQ9bfm_TWfzzpj8G3wW8",
      authDomain: "pokerrecorddata.firebaseapp.com",
      projectId: "pokerrecorddata",
      storageBucket: "pokerrecorddata.firebasestorage.app",
      messagingSenderId: "60475093864",
      appId: "1:60475093864:web:893fa6fc7144ce5fa71cdd",
      measurementId: "G-WDRHD3YH61"
    };

    const GTO_BENCHMARK_RFI = {
      'AA': 100, 'KK': 100, 'QQ': 100, 'JJ': 100, 'TT': 100, '99': 100, '88': 100, '77': 80, '66': 60, '55': 45, '44': 30, '33': 20, '22': 15,
      'AKs': 100, 'AQs': 100, 'AJs': 100, 'ATs': 100, 'A9s': 80, 'A8s': 60, 'A7s': 55, 'A6s': 50, 'A5s': 90, 'A4s': 85, 'A3s': 70, 'A2s': 60,
      'KQs': 100, 'KJs': 100, 'KTs': 90, 'K9s': 55, 'QJs': 100, 'QTs': 85, 'JTs': 95, 'T9s': 90, '98s': 75, '87s': 65, '76s': 55, '65s': 45,
      'AKo': 100, 'AQo': 95, 'AJo': 75, 'ATo': 50, 'KQo': 70, 'KJo': 45, 'QJo': 35
    };

    let activeTourney = null;
    let editingOriginTourneyId = null;
    let careerTournaments = [];
    let currentTableSize = 9;

    let currentStagedHand = null;
    let currentStagedTime = null;
    let currentStagedPos = 'BTN';
    let waitingHandQueue = [];
    let editingHistoryLogId = null;
    let activeDetailTourneyId = null;
    let selectedAnalyticsHand = null;

    let firestoreDB = null;
    let isCloudConfigured = false;
    let isAutoSyncEnabled = true;
    let durationTimer = null;
    let speechRecognitionInstance = null;

    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      let borderClass = 'border-blue-500/80 bg-blue-950/95 text-blue-200';
      let icon = 'ℹ️';
      if (type === 'success') { borderClass = 'border-emerald-500/80 bg-emerald-950/95 text-emerald-200'; icon = '✅'; }
      else if (type === 'warn') { borderClass = 'border-amber-500/80 bg-amber-950/95 text-amber-200'; icon = '⚠️'; }
      else if (type === 'error') { borderClass = 'border-rose-500/80 bg-rose-950/95 text-rose-200'; icon = '❌'; }

      toast.className = `pointer-events-auto p-3 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-medium animate-toast backdrop-blur-md ${borderClass}`;
      toast.innerHTML = `<span>${icon}</span><span class="flex-1 leading-snug">${escapeHTML(message)}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 320);
      }, 3500);
    }

    function sanitizeNonNegative(inputEl, minVal = 0) {
      if (!inputEl) return;
      let val = parseInt(inputEl.value);
      if (isNaN(val) || val < minVal) inputEl.value = minVal;
    }

    function clearAllLocalStorageData() {
      if (!confirm('⚠️ 確定要刪除此瀏覽器上的所有本機暫存資料嗎？\n\n這將清空所有進行中賽事、歷史牌局檔案與暫存佇列（不會刪除 Firebase 雲端資料庫）。')) {
        return;
      }
      localStorage.removeItem('poker_system_active');
      localStorage.removeItem('poker_system_history');
      localStorage.removeItem('poker_system_queue');
      localStorage.removeItem('poker_career_active');
      localStorage.removeItem('poker_career_history');
      localStorage.removeItem('poker_career_waiting_queue');

      activeTourney = null;
      editingOriginTourneyId = null;
      careerTournaments = [];
      waitingHandQueue = [];

      closeSettingsModal();
      renderUI();
      renderDashboard();
      renderCareerSummary();
      renderWaitingQueue();
      showToast('已成功清除所有本機暫存！', 'success');
    }

    window.addEventListener('DOMContentLoaded', () => {
      initMatrixDOM('poker-matrix', onMatrixCellClicked);
      initMatrixDOM('analytics-matrix', onAnalyticsCellClicked);
      loadStorageData();
      initDefaultDateTime();
      renderDynamicPositionButtons();
      renderDashboard();
      renderUI();
      renderWaitingQueue();
      initSpeechRecognition();

      initFirebaseAuto();

      window.addEventListener('beforeunload', (e) => {
        if (activeTourney && activeTourney.status === 'active') {
          e.preventDefault();
          e.returnValue = '賽事正在進行中，確定要離開此頁面嗎？';
          return '賽事正在進行中，確定要離開此頁面嗎？';
        }
      });
    });

    function initMatrixDOM(containerId, clickCallback) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      MATRIX_LABELS.forEach(label => {
        const div = document.createElement('div');
        div.className = 'cell bg-slate-900 border border-slate-800 text-slate-400';
        div.id = `${containerId}-cell-${label}`;
        div.dataset.hand = label;

        const textSpan = document.createElement('span');
        textSpan.textContent = label;
        div.appendChild(textSpan);

        if (containerId === 'analytics-matrix') {
          const bbSpan = document.createElement('span');
          bbSpan.className = 'cell-bb-val text-slate-500';
          bbSpan.id = `analytics-bb-${label}`;
          div.appendChild(bbSpan);
        }

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'badge-count hidden';
        badgeSpan.id = `${containerId}-badge-${label}`;
        div.appendChild(badgeSpan);

        if (clickCallback) {
          div.addEventListener('click', () => clickCallback(label));
        }
        container.appendChild(div);
      });
    }

    function initDefaultDateTime() {
      try {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const str = now.toISOString().slice(0, 16);
        const timeInput = document.getElementById('init-start-time');
        if (timeInput) timeInput.value = str;

        const dateOnly = str.slice(0, 10);
        const qDate = document.getElementById('qentry-date');
        if (qDate) qDate.value = dateOnly;
      } catch (e) {
        console.warn('initDefaultDateTime fallback', e);
      }
    }

    function toggleLiveViewModeManual() {
      const boxSetup = document.getElementById('box-start-tournament');
      const boxLive = document.getElementById('box-live-workspace');
      if (!boxSetup || !boxLive) return;

      const isLiveVisible = !boxLive.classList.contains('hidden');
      if (isLiveVisible) {
        boxLive.classList.add('hidden');
        boxSetup.classList.remove('hidden');
        const lbl = document.getElementById('current-view-mode-label');
        if (lbl) lbl.textContent = '建立新賽事表單';
        showToast('已切換至【建立新賽事表單】', 'info');
      } else {
        if (!activeTourney) {
          showToast('目前無進行中賽事，建議先填寫表單點擊開始！', 'warn');
        }
        boxSetup.classList.add('hidden');
        boxLive.classList.remove('hidden');
        const lbl = document.getElementById('current-view-mode-label');
        if (lbl) lbl.textContent = '實戰打點儀表板';
        renderDualAxisChart();
        showToast('已切換至【實戰打點儀表板】', 'info');
      }
    }

    function switchMainTab(tab) {
      const tabs = ['dashboard', 'live', 'review', 'analytics'];
      tabs.forEach(t => {
        const view = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (!view || !btn) return;

        if (t === tab) {
          view.classList.remove('hidden');
          btn.className = 'px-2.5 py-1 rounded font-bold text-white bg-blue-600 transition text-xs whitespace-nowrap';
        } else {
          view.classList.add('hidden');
          btn.className = 'px-2.5 py-1 rounded font-medium text-slate-400 hover:text-white transition text-xs whitespace-nowrap';
        }
      });

      if (tab === 'dashboard') renderDashboard();
      else if (tab === 'live') { renderHeatmap(); renderDualAxisChart(); }
      else if (tab === 'review') renderCareerSummary();
      else if (tab === 'analytics') renderAnalyticsHeatmap();
    }

    function renderDashboard() {
      const hour = new Date().getHours();
      let greeting = '你好，撲克手！';
      if (hour >= 23 || hour < 5) greeting = '夜深了，林林！';
      else if (hour < 11) greeting = '早安，今天也是專注的一天！';
      else if (hour < 17) greeting = '下午好，調整呼吸迎接每一局！';
      else greeting = '晚上好，祝今晚好運常伴！';
      const elGreet = document.getElementById('dash-greeting');
      if (elGreet) elGreet.textContent = greeting;

      const totalGames = careerTournaments.length;
      const elHint = document.getElementById('dash-session-hint');
      if (elHint) elHint.textContent = `你已累計記錄 ${totalGames} 場賽事，大數據正在幫你提煉行為特徵。`;

      const recent15 = careerTournaments.slice(0, 15);
      let rBuyin = 0, rCashout = 0, rMins = 0;
      recent15.forEach(t => {
        rBuyin += (t.buyin || 0);
        rCashout += (t.cashout || 0);
        rMins += (t.totalMinutes || 0);
      });

      const rProfit = rCashout - rBuyin;
      const profitEl = document.getElementById('kpi-recent-profit');
      if (profitEl) {
        profitEl.textContent = `${rProfit >= 0 ? '+' : '-'}${Math.abs(rProfit).toLocaleString()} NTD`;
        profitEl.className = `text-2xl sm:text-3xl font-black font-mono mt-1 ${rProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
      }

      const rHours = rMins > 0 ? (rMins / 60) : 1;
      const hourly = Math.round(rProfit / rHours);
      const elHourly = document.getElementById('kpi-hourly-rate');
      if (elHourly) elHourly.textContent = `${hourly >= 0 ? '+' : ''}${hourly.toLocaleString()} NTD`;
      
      const roi = rBuyin > 0 ? ((rProfit / rBuyin) * 100).toFixed(1) : 0;
      const elRoi = document.getElementById('kpi-roi');
      if (elRoi) elRoi.textContent = `${roi >= 0 ? '+' : ''}${roi}%`;

      const totalNet = careerTournaments.reduce((acc, t) => acc + (t.netProfit !== undefined ? t.netProfit : ((t.cashout || 0) - (t.buyin || 0))), 0);
      const target = 100000;
      const pct = Math.max(0, Math.min(100, Math.round((totalNet / target) * 100)));
      
      const elGoalPct = document.getElementById('goal-progress-percent');
      if (elGoalPct) elGoalPct.textContent = `${pct}%`;
      const elGoalDetail = document.getElementById('goal-progress-detail');
      if (elGoalDetail) elGoalDetail.textContent = `${totalNet.toLocaleString()} / 100,000 NTD`;
      const elGoalBar = document.getElementById('goal-progress-bar');
      if (elGoalBar) elGoalBar.style.width = `${pct}%`;

      computeBehaviorTags();

      const previewEl = document.getElementById('dash-recent-list');
      if (previewEl) {
        if (recent15.length === 0) {
          previewEl.innerHTML = '<div class="text-slate-600 py-4 text-center italic">尚未有已結算的錦標賽資料。</div>';
          return;
        }
        let html = '';
        recent15.slice(0, 4).forEach(t => {
          const net = t.netProfit !== undefined ? t.netProfit : ((t.cashout || 0) - (t.buyin || 0));
          const color = net >= 0 ? 'text-emerald-400' : 'text-rose-400';
          html += `<div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <span class="font-bold text-white">${escapeHTML(t.name)}</span>
              <span class="text-[10px] text-slate-500 ml-1.5">(${t.startTime ? t.startTime.slice(0, 10) : t.date || '--'})</span>
            </div>
            <span class="font-bold ${color}">${net >= 0 ? '+' : ''}${net.toLocaleString()} NTD</span>
          </div>`;
        });
        previewEl.innerHTML = html;
      }
    }

    function computeBehaviorTags() {
      let totalHands = 0, vpipHands = 0, threeBetHands = 0, totalRebuys = 0;
      careerTournaments.forEach(t => {
        totalRebuys += (t.rebuyCount || 0);
        if (t.hands) {
          t.hands.forEach(h => {
            if (!h.type || h.type === 'hand') {
              totalHands++;
              if (h.isVpip) vpipHands++;
              if (h.actionType && h.actionType.includes('3-Bet')) threeBetHands++;
            }
          });
        }
      });

      const vpipRate = totalHands > 0 ? (vpipHands / totalHands) * 100 : 25;
      const threeBetRate = totalHands > 0 ? (threeBetHands / totalHands) * 100 : 8;

      const vpipTag = document.getElementById('tag-vpip-val');
      if (vpipTag) {
        if (vpipRate > 32) { vpipTag.textContent = '偏高 (Loose)'; vpipTag.className = 'text-rose-400 font-bold text-xs'; }
        else if (vpipRate < 18) { vpipTag.textContent = '偏低 (Tight)'; vpipTag.className = 'text-cyan-400 font-bold text-xs'; }
        else { vpipTag.textContent = '健康 (20-30%)'; vpipTag.className = 'text-emerald-400 font-bold text-xs'; }
      }

      const tbTag = document.getElementById('tag-3b-val');
      if (tbTag) {
        if (threeBetRate > 12) { tbTag.textContent = '3bet 偏多 ↗'; tbTag.className = 'text-rose-400 font-bold text-xs'; }
        else if (threeBetRate < 5) { tbTag.textContent = '3bet 偏少 ↘'; tbTag.className = 'text-cyan-400 font-bold text-xs'; }
        else { tbTag.textContent = '標準 (7-10%)'; tbTag.className = 'text-emerald-400 font-bold text-xs'; }
      }

      const rebuyTag = document.getElementById('tag-rebuy-val');
      if (rebuyTag) {
        const avgRebuy = careerTournaments.length > 0 ? (totalRebuys / careerTournaments.length) : 0;
        if (avgRebuy > 1.2) { rebuyTag.textContent = '偏高 (多次補碼)'; rebuyTag.className = 'text-amber-400 font-bold text-xs'; }
        else { rebuyTag.textContent = '健康 (控制良好)'; rebuyTag.className = 'text-emerald-400 font-bold text-xs'; }
      }
    }

    function initSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      speechRecognitionInstance = new SpeechRecognition();
      speechRecognitionInstance.lang = 'zh-TW';
      speechRecognitionInstance.continuous = false;
      speechRecognitionInstance.interimResults = false;

      speechRecognitionInstance.onstart = () => {
        const txt = document.getElementById('speech-btn-text');
        if (txt) txt.textContent = '正在聆聽...';
        const dot = document.getElementById('speech-dot');
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-ping';
      };

      speechRecognitionInstance.onresult = (e) => {
        const text = e.results[0][0].transcript;
        parseSpeechAndFillForm(text);
      };

      speechRecognitionInstance.onerror = () => {
        showToast('語音識別未偵測到聲音或被中斷', 'warn');
        resetSpeechBtn();
      };

      speechRecognitionInstance.onend = () => {
        resetSpeechBtn();
      };
    }

    function resetSpeechBtn() {
      const txt = document.getElementById('speech-btn-text');
      if (txt) txt.textContent = '🎙️ 語音辨識輸入';
      const dot = document.getElementById('speech-dot');
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    }

    function startSpeechRecognition() {
      if (!activeTourney) {
        showToast('請先建立或載入一場錦標賽！', 'warn');
        return;
      }
      if (!speechRecognitionInstance) {
        showToast('您的瀏覽器不支援 Web Speech 語音輸入', 'warn');
        return;
      }
      try {
        speechRecognitionInstance.start();
      } catch (e) {
        speechRecognitionInstance.stop();
      }
    }

    function parseSpeechAndFillForm(text) {
      showToast(`聽到：「${text}」`, 'info');
      const notesEl = document.getElementById('staged-notes');
      if (notesEl) notesEl.value = text;

      const upper = text.toUpperCase();
      let matchedHand = null;
      for (let h of MATRIX_LABELS) {
        if (upper.includes(h)) { matchedHand = h; break; }
      }
      if (!matchedHand) {
        if (text.includes('AK') && (text.includes('同花') || text.includes('紅心') || text.includes('黑桃'))) matchedHand = 'AKs';
        else if (text.includes('AK')) matchedHand = 'AKo';
        else if (text.includes('對8') || text.includes('88') || text.includes('八八')) matchedHand = '88';
        else if (text.includes('AA') || text.includes('對A')) matchedHand = 'AA';
      }
      if (matchedHand) setStagedHand(matchedHand);

      for (let p of FULL_10MAX_POSITIONS) {
        if (upper.includes(p)) { setStagedPos(p); break; }
      }
      if (text.includes('按鈕') || text.includes('button')) setStagedPos('BTN');
      else if (text.includes('大盲')) setStagedPos('BB');
      else if (text.includes('小盲')) setStagedPos('SB');
      else if (text.includes('槍口')) setStagedPos('UTG');

      const numMatch = text.match(/\d+/);
      if (numMatch) {
        const stackVal = parseInt(numMatch[0]);
        if (stackVal >= 0) {
          const stkEl = document.getElementById('staged-resulting-stack');
          if (stkEl) stkEl.value = stackVal;
          onResultingStackInputChanged(stackVal);
        }
      }
    }

    function onTableSizeChanged(size) {
      currentTableSize = size;
      localStorage.setItem('poker_system_table_size', size);
      renderDynamicPositionButtons();
      calculateAutoBlindDeduction();
    }

    function adjustTableSize(delta) {
      const newSize = Math.min(10, Math.max(2, currentTableSize + delta));
      if (newSize === currentTableSize) return;
      const selectEl = document.getElementById('table-player-count');
      if (selectEl) selectEl.value = newSize;
      onTableSizeChanged(newSize);
    }

    function renderDynamicPositionButtons() {
      const container = document.getElementById('dynamic-pos-container');
      if (!container) return;

      const activePositions = TABLE_POSITIONS_ACTIVE_MAP[currentTableSize] || TABLE_POSITIONS_ACTIVE_MAP[9];
      const displayPositions = (currentTableSize === 2) ? ['D/SB', 'BB'] : FULL_10MAX_POSITIONS;

      container.innerHTML = '';
      container.style.gridTemplateColumns = `repeat(${displayPositions.length}, minmax(0, 1fr))`;

      if (!activePositions.includes(currentStagedPos)) {
        currentStagedPos = activePositions[activePositions.length - 1];
      }

      displayPositions.forEach(pos => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.pos = pos;
        let lbl = pos;
        if (pos === 'UTG+1') lbl = '+1';
        else if (pos === 'UTG+2') lbl = '+2';
        else if (pos === 'UTG+3') lbl = '+3';
        btn.textContent = lbl;

        const isAvail = activePositions.includes(pos);
        if (!isAvail) {
          btn.disabled = true;
          btn.className = 'py-1 rounded bg-slate-950/40 border border-slate-900 text-slate-700 cursor-not-allowed select-none';
        } else if (pos === currentStagedPos) {
          btn.className = 'py-1 rounded bg-amber-600 border border-amber-500 text-white font-bold shadow';
        } else {
          btn.className = 'py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-900';
        }

        if (isAvail) btn.addEventListener('click', () => setStagedPos(pos));
        container.appendChild(btn);
      });

      const lblPos = document.getElementById('staged-pos-label');
      if (lblPos) lblPos.textContent = currentStagedPos;
    }

    function setStagedPos(pos) {
      currentStagedPos = pos;
      document.querySelectorAll('#dynamic-pos-container button').forEach(btn => {
        if (!btn.disabled && btn.dataset.pos) {
          if (btn.dataset.pos === pos) btn.className = 'py-1 rounded bg-amber-600 border border-amber-500 text-white font-bold shadow';
          else btn.className = 'py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-900';
        }
      });
      const lblPos = document.getElementById('staged-pos-label');
      if (lblPos) lblPos.textContent = pos;
      calculateAutoBlindDeduction();
    }

    function advancePositionToNext() {
      const activePositions = TABLE_POSITIONS_ACTIVE_MAP[currentTableSize] || TABLE_POSITIONS_ACTIVE_MAP[9];
      const currentIndex = activePositions.indexOf(currentStagedPos);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex - 1 + activePositions.length) % activePositions.length;
        setStagedPos(activePositions[nextIndex]);
      }
    }

    function onStagedBBChanged(val) {
      const num = parseFloat(val);
      if (activeTourney && !isNaN(num) && num >= 0) {
        activeTourney.currentBB = num;
        const qbb = document.getElementById('quick-bb-input');
        if (qbb) qbb.value = num;
      }
      calculateAutoBlindDeduction();
    }

    function onStagedOutcomeChanged(val) {
      calculateAutoBlindDeduction();
    }

    function onResultingStackInputChanged(val) {
      if (!activeTourney) return;
      const num = parseFloat(val);
      if (isNaN(num)) return;

      const cur = activeTourney.currentStack;
      const outcomeSelect = document.getElementById('staged-outcome');
      const vpipChk = document.getElementById('staged-vpip');

      if (outcomeSelect && vpipChk) {
        if (num > cur) {
          outcomeSelect.value = 'win';
          vpipChk.checked = true;
        } else if (num < cur) {
          outcomeSelect.value = 'loss';
          vpipChk.checked = true;
        } else {
          if (!vpipChk.checked) outcomeSelect.value = 'fold';
        }
      }
    }

    function calculateAutoBlindDeduction() {
      if (!activeTourney) return;
      const outcomeEl = document.getElementById('staged-outcome');
      const outcome = outcomeEl ? outcomeEl.value : 'fold';
      const isVpip = document.getElementById('staged-vpip')?.checked || false;
      const curStack = activeTourney.currentStack;
      const curBB = activeTourney.currentBB || 0;
      const stkInput = document.getElementById('staged-resulting-stack');

      if (!isVpip && outcome === 'fold' && curBB > 0 && stkInput) {
        if (currentStagedPos === 'BB') {
          stkInput.value = Math.max(0, curStack - (curBB * 2.0));
          return;
        } else if (currentStagedPos === 'SB' || currentStagedPos === 'D/SB') {
          const sbInputVal = parseFloat(document.getElementById('staged-sb-value')?.value);
          const sbDeduct = (!isNaN(sbInputVal) && sbInputVal > 0) ? sbInputVal : (curBB * 0.5);
          stkInput.value = Math.max(0, curStack - sbDeduct);
          return;
        }
      }
      if (stkInput && stkInput.value === '') stkInput.value = curStack;
    }

    function toggleCustomActionInput(val) {
      const input = document.getElementById('staged-action-custom');
      if (!input) return;
      if (val === 'CUSTOM') {
        input.classList.remove('hidden');
        input.focus();
      } else {
        input.classList.add('hidden');
      }
    }

    function onMatrixCellClicked(label) {
      if (!activeTourney) {
        showToast('請先建立或載入一場錦標賽！', 'warn');
        return;
      }
      const captureTime = new Date().toLocaleTimeString();

      if (currentStagedHand !== null) {
        waitingHandQueue.push({
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          hand: label,
          time: captureTime,
          pos: currentStagedPos
        });
        saveStorageData();
        renderWaitingQueue();
        flashMatrixCell('poker-matrix', label, '#38bdf8');
      } else {
        loadIntoActiveStaging(label, captureTime, currentStagedPos);
        flashMatrixCell('poker-matrix', label, '#f59e0b');
      }
    }

    function loadIntoActiveStaging(hand, time, pos) {
      currentStagedHand = hand;
      currentStagedTime = time || new Date().toLocaleTimeString();
      if (pos) setStagedPos(pos);

      const dEl = document.getElementById('staged-hand-display');
      if (dEl) dEl.textContent = hand;
      const tEl = document.getElementById('staged-time-badge');
      if (tEl) tEl.textContent = `時間: ${currentStagedTime}`;
      calculateAutoBlindDeduction();
    }

    function flashMatrixCell(prefix, label, color) {
      const el = document.getElementById(`${prefix}-cell-${label}`);
      if (el) {
        el.style.transform = 'scale(1.18)';
        el.style.borderColor = color;
        setTimeout(() => { el.style.transform = ''; el.style.borderColor = ''; }, 180);
      }
    }

    function renderWaitingQueue() {
      const container = document.getElementById('waiting-queue-container');
      const countLabel = document.getElementById('waiting-queue-count');
      if (!container) return;

      if (countLabel) countLabel.textContent = waitingHandQueue.length;
      if (waitingHandQueue.length === 0) {
        container.innerHTML = '<span class="text-slate-600 text-[10px] italic">目前佇列中無其他暫存手牌。</span>';
        return;
      }

      let html = '';
      waitingHandQueue.forEach((item, idx) => {
        html += `<span class="inline-flex items-center gap-1.5 p-1 px-2 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 font-mono text-[11px] font-bold shadow-sm">
          <span>#${idx + 1} ${escapeHTML(item.hand)}</span>
          <span class="text-[9px] text-amber-500 font-normal">(${escapeHTML(item.time)})</span>
          <button onclick="popQueueItemToActive('${item.id}')" title="帶入編輯" class="ml-1 p-1 px-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 rounded text-xs font-bold active:scale-95 transition cursor-pointer">▲ 帶入</button>
          <button onclick="removeQueueItem('${item.id}')" title="刪除" class="p-1 px-2 bg-rose-950 hover:bg-rose-900 border border-rose-600/60 text-rose-300 rounded text-xs font-bold active:scale-95 transition cursor-pointer">✕</button>
        </span>`;
      });
      container.innerHTML = html;
    }

    function popQueueItemToActive(id) {
      const idx = waitingHandQueue.findIndex(x => x.id === id);
      if (idx === -1) return;
      if (currentStagedHand !== null) {
        if (!confirm('當前編輯區已有手牌正在輸入，是否清空並帶入此手牌？')) return;
      }
      const item = waitingHandQueue.splice(idx, 1)[0];
      loadIntoActiveStaging(item.hand, item.time, item.pos);
      saveStorageData();
      renderWaitingQueue();
    }

    function removeQueueItem(id) {
      waitingHandQueue = waitingHandQueue.filter(x => x.id !== id);
      saveStorageData();
      renderWaitingQueue();
    }

    function setManualStagedHand() {
      const input = document.getElementById('manual-hand-input');
      if (!input) return;
      const val = input.value.trim().toUpperCase();
      if (!val) return;
      const found = MATRIX_LABELS.find(x => x.toUpperCase() === val);
      if (found) { onMatrixCellClicked(found); input.value = ''; }
      else showToast('手牌格式錯誤！', 'warn');
    }

    function toggleVpipFields(isVpip) {
      const outcomeSelect = document.getElementById('staged-outcome');
      const actionSelect = document.getElementById('staged-action-type');
      if (!isVpip) {
        if (outcomeSelect) outcomeSelect.value = 'fold';
        if (actionSelect) actionSelect.value = '無人open';
      } else {
        if (outcomeSelect && outcomeSelect.value === 'fold') outcomeSelect.value = 'loss';
        if (actionSelect && actionSelect.value === '無人open') actionSelect.value = '前位open';
      }
      calculateAutoBlindDeduction();
    }

    function confirmClearCurrentStagingForm() {
      if (currentStagedHand !== null) {
        if (!confirm('確定要清空當前編輯手牌的輸入進度嗎？')) return;
      }
      clearCurrentStagingForm();
    }

    function clearCurrentStagingForm() {
      currentStagedHand = null;
      currentStagedTime = null;
      const dEl = document.getElementById('staged-hand-display');
      if (dEl) dEl.textContent = '--';
      const tEl = document.getElementById('staged-time-badge');
      if (tEl) tEl.textContent = '尚未選取手牌';
      const vEl = document.getElementById('staged-vpip');
      if (vEl) vEl.checked = false;
      const aEl = document.getElementById('staged-action-type');
      if (aEl) aEl.value = '無人open';
      const cEl = document.getElementById('staged-action-custom');
      if (cEl) { cEl.value = ''; cEl.classList.add('hidden'); }
      const oEl = document.getElementById('staged-outcome');
      if (oEl) oEl.value = 'fold';
      const nEl = document.getElementById('staged-notes');
      if (nEl) nEl.value = '';
      if (activeTourney) {
        const stkEl = document.getElementById('staged-resulting-stack');
        if (stkEl) stkEl.value = activeTourney.currentStack;
      }
    }

    function submitStagedHand() {
      if (!activeTourney) { showToast('請先建立賽事！', 'warn'); return; }
      if (!currentStagedHand) { showToast('請先從矩陣選取手牌！', 'warn'); return; }

      const isVpip = document.getElementById('staged-vpip')?.checked || false;
      
      let actionType = document.getElementById('staged-action-type')?.value || '無人open';
      if (actionType === 'CUSTOM') {
        const customVal = document.getElementById('staged-action-custom')?.value.trim();
        actionType = customVal ? customVal : '自訂動作';
      }

      const rawStack = document.getElementById('staged-resulting-stack')?.value;
      const parsedStack = parseFloat(rawStack);
      const resultingStack = (!isNaN(parsedStack) && parsedStack >= 0) ? parsedStack : activeTourney.currentStack;

      let outcome = document.getElementById('staged-outcome')?.value || 'fold';
      const notes = document.getElementById('staged-notes')?.value.trim() || '';

      const chipDiff = resultingStack - activeTourney.currentStack;
      const curBB = activeTourney.currentBB || 1;
      const bbDiff = parseFloat((chipDiff / curBB).toFixed(2));
      const bbStack = parseFloat((activeTourney.currentStack / curBB).toFixed(1));

      if (isVpip) {
        if (chipDiff > 0) outcome = 'win';
        else if (chipDiff < 0) outcome = 'loss';
      } else {
        outcome = 'fold';
      }

      const handRecord = {
        id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'hand',
        tourneyId: activeTourney.id,
        tourneyName: activeTourney.name,
        hand: currentStagedHand,
        time: currentStagedTime || new Date().toLocaleTimeString(),
        pos: currentStagedPos,
        isVpip: isVpip,
        actionType: actionType,
        prevStack: activeTourney.currentStack,
        resultingStack: resultingStack,
        chipDiff: chipDiff,
        bbDiff: bbDiff,
        bbStack: bbStack,
        currentBB: curBB,
        outcome: outcome,
        notes: notes
      };

      activeTourney.hands.push(handRecord);
      activeTourney.currentStack = resultingStack;

      clearCurrentStagingForm();
      advancePositionToNext();

      if (waitingHandQueue.length > 0) {
        const nextItem = waitingHandQueue.shift();
        loadIntoActiveStaging(nextItem.hand, nextItem.time, currentStagedPos);
        renderWaitingQueue();
      }

      recalculateHandStats();
      saveStorageData();
      renderUI();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
    }

    // --- REBUY, BLINDS, FIELD UPDATES ---
    function openRebuyModal() {
      if (!activeTourney) return;
      document.getElementById('modal-rebuy').classList.remove('hidden');
      const amtEl = document.getElementById('rebuy-amount-input');
      if (amtEl) amtEl.value = activeTourney.buyin || 10000;
      const nStkEl = document.getElementById('rebuy-new-stack-input');
      if (nStkEl) nStkEl.value = activeTourney.currentStack + (activeTourney.startStack || 30000);
      const bbEl = document.getElementById('rebuy-current-bb-input');
      if (bbEl) bbEl.value = activeTourney.currentBB || 1000;
    }

    function closeRebuyModal() {
      document.getElementById('modal-rebuy').classList.add('hidden');
    }

    function confirmSubmitRebuy() {
      if (!activeTourney) return;
      const amount = parseFloat(document.getElementById('rebuy-amount-input')?.value);
      const newStack = parseFloat(document.getElementById('rebuy-new-stack-input')?.value);
      const curBB = parseFloat(document.getElementById('rebuy-current-bb-input')?.value);

      if (isNaN(amount) || amount <= 0) return;
      if (!isNaN(curBB) && curBB > 0) activeTourney.currentBB = curBB;
      if (!isNaN(newStack) && newStack >= 0) activeTourney.currentStack = newStack;

      activeTourney.buyin = (activeTourney.buyin || 0) + amount;
      activeTourney.rebuyCount = (activeTourney.rebuyCount || 0) + 1;

      const timeStr = new Date().toLocaleTimeString();
      const bbCount = activeTourney.currentBB > 0 ? (activeTourney.currentStack / activeTourney.currentBB).toFixed(1) : 0;

      activeTourney.hands.push({
        id: 'log_' + Date.now(),
        type: 'rebuy',
        time: timeStr,
        rebuyAmount: amount,
        bb: activeTourney.currentBB,
        resultingStack: activeTourney.currentStack,
        notes: `💰 [Rebuy/Addon] +$${amount.toLocaleString()} | 碼量: ${activeTourney.currentStack.toLocaleString()} (${bbCount} BB)`
      });

      calculateAutoBlindDeduction();
      saveStorageData();
      renderUI();
      closeRebuyModal();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
      showToast(`已加買 Rebuy/Addon！總買入: $${activeTourney.buyin.toLocaleString()}`, 'success');
    }

    function openEditTourneyInfoModal() {
      if (!activeTourney) return;
      document.getElementById('modal-edit-tourney-info').classList.remove('hidden');
      const nEl = document.getElementById('editinfo-name');
      if (nEl) nEl.value = activeTourney.name || '';
      const bEl = document.getElementById('editinfo-buyin');
      if (bEl) bEl.value = activeTourney.buyin || 0;
      const rEl = document.getElementById('editinfo-rebuy-count');
      if (rEl) rEl.value = activeTourney.rebuyCount || 0;
      const pEl = document.getElementById('editinfo-prize-pool');
      if (pEl) pEl.value = activeTourney.prizePool || '';
    }

    function closeEditTourneyInfoModal() {
      document.getElementById('modal-edit-tourney-info').classList.add('hidden');
    }

    function saveTourneyInfoChanges() {
      if (!activeTourney) return;
      const name = document.getElementById('editinfo-name')?.value.trim();
      const buyin = parseFloat(document.getElementById('editinfo-buyin')?.value);
      const rebuyCount = parseInt(document.getElementById('editinfo-rebuy-count')?.value);
      const prizePool = parseFloat(document.getElementById('editinfo-prize-pool')?.value);

      if (name) activeTourney.name = name;
      if (!isNaN(buyin) && buyin >= 0) activeTourney.buyin = buyin;
      if (!isNaN(rebuyCount) && rebuyCount >= 0) activeTourney.rebuyCount = rebuyCount;
      activeTourney.prizePool = (!isNaN(prizePool) && prizePool > 0) ? prizePool : null;

      saveStorageData();
      renderUI();
      closeEditTourneyInfoModal();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
      showToast('賽事資訊已更新！', 'success');
    }

    function confirmAbandonTournament() {
      if (!activeTourney) return;
      if (!confirm('⚠️ 確定要放棄並重置目前的實戰賽事嗎？')) return;
      resetLiveWorkspaceToInit();
      showToast('已重設工作區，回到建立選單。', 'info');
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
    }

    function resetLiveWorkspaceToInit() {
      activeTourney = null;
      editingOriginTourneyId = null;
      waitingHandQueue = [];
      clearInterval(durationTimer);
      clearCurrentStagingForm();
      saveStorageData();
      renderUI();
      initDefaultDateTime();
    }

    function changeLogHeight(cls) {
      const el = document.getElementById('live-log-container');
      if (el) el.className = `${cls} overflow-y-auto space-y-1 text-xs font-mono pr-1 divide-y divide-slate-800/60`;
    }

    function submitQuickBlindStackUpdate() {
      if (!activeTourney) return;
      const bbVal = parseFloat(document.getElementById('quick-bb-input')?.value);
      const stackVal = parseFloat(document.getElementById('quick-stack-input')?.value);
      if (isNaN(bbVal) && isNaN(stackVal)) return;

      if (!isNaN(bbVal) && bbVal > 0) {
        activeTourney.currentBB = bbVal;
        const sbb = document.getElementById('staged-bb-value');
        if (sbb) sbb.value = bbVal;
      }
      if (!isNaN(stackVal) && stackVal >= 0) activeTourney.currentStack = stackVal;

      const timeStr = new Date().toLocaleTimeString();
      const bbCount = activeTourney.currentBB > 0 ? (activeTourney.currentStack / activeTourney.currentBB).toFixed(1) : 0;

      activeTourney.hands.push({
        id: 'log_' + Date.now(),
        type: 'state',
        time: timeStr,
        bb: activeTourney.currentBB,
        stack: activeTourney.currentStack,
        bbCount: `${bbCount} BB`,
        resultingStack: activeTourney.currentStack,
        notes: `盲注更新: ${activeTourney.currentBB} | 碼量: ${activeTourney.currentStack.toLocaleString()} (${bbCount} BB)`
      });

      calculateAutoBlindDeduction();
      saveStorageData();
      renderUI();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
      showToast(`已更新盲注 (${activeTourney.currentBB}) 與碼量！`, 'success');
    }

    function submitTournamentFieldUpdate() {
      if (!activeTourney) return;
      const rawLeft = document.getElementById('quick-players-left-input')?.value.trim();
      const rawTotal = document.getElementById('quick-total-entries-input')?.value.trim();

      if (!rawLeft && !rawTotal) {
        showToast('請輸入剩餘人數或總參賽人次！', 'warn');
        return;
      }

      if (rawLeft) {
        const leftVal = parseInt(rawLeft);
        if (isNaN(leftVal) || leftVal < 1) {
          showToast('剩餘人數必須至少為 1！', 'warn');
          return;
        }
        activeTourney.playersLeft = leftVal;
      }

      if (rawTotal) {
        const totalVal = parseInt(rawTotal);
        if (!isNaN(totalVal) && totalVal >= 1) {
          activeTourney.totalEntries = totalVal;
        }
      }

      calculateAndSetAverageStack();
      const timeStr = new Date().toLocaleTimeString();
      const avgStr = activeTourney.avgStack ? activeTourney.avgStack.toLocaleString() : '--';
      const avgBBStr = activeTourney.avgBB ? `${activeTourney.avgBB} BB` : '--';

      activeTourney.hands.push({
        id: 'log_' + Date.now(),
        type: 'field',
        time: timeStr,
        playersLeft: activeTourney.playersLeft || '--',
        totalEntries: activeTourney.totalEntries || '--',
        avgStack: activeTourney.avgStack || 0,
        avgBB: activeTourney.avgBB || 0,
        resultingStack: activeTourney.currentStack,
        notes: `賽事進度: 剩餘 ${activeTourney.playersLeft || '--'} / ${activeTourney.totalEntries || '--'} 人 | 均碼: ${avgStr} (${avgBBStr})`
      });

      saveStorageData();
      renderUI();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
      showToast(`已更新人數！均碼: ${avgStr} (${avgBBStr})`, 'success');
    }

    function submitQuickFreeNote() {
      if (!activeTourney) {
        showToast('請先建立賽事！', 'warn');
        return;
      }
      const input = document.getElementById('quick-free-note-input');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      const timeStr = new Date().toLocaleTimeString();
      activeTourney.hands.push({
        id: 'log_' + Date.now(),
        type: 'text',
        time: timeStr,
        text: text,
        resultingStack: activeTourney.currentStack,
        notes: text
      });

      input.value = '';
      saveStorageData();
      renderUI();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
      showToast('已記下文字備忘！', 'info');
    }

    function calculateAndSetAverageStack() {
      if (!activeTourney) return;
      const entries = activeTourney.totalEntries || activeTourney.playersLeft;
      const left = activeTourney.playersLeft;
      if (entries && left && left > 0) {
        const totalChipsInPlay = entries * activeTourney.startStack;
        activeTourney.avgStack = Math.round(totalChipsInPlay / left);
        if (activeTourney.currentBB > 0) {
          activeTourney.avgBB = (activeTourney.avgStack / activeTourney.currentBB).toFixed(1);
        }
      }
    }

    // --- 編輯彈窗 ---
    function openEditHandModal(logId) {
      if (!activeTourney) return;
      const log = activeTourney.hands.find(x => x.id === logId);
      if (!log) return;

      editingHistoryLogId = logId;
      document.getElementById('modal-edit-hand').classList.remove('hidden');

      const handGroup = document.getElementById('edit-row-hand-group');
      const stateGroup = document.getElementById('edit-row-state-group');
      const fieldGroup = document.getElementById('edit-row-field-group');
      const textGroup = document.getElementById('edit-row-text-group');
      const notesEl = document.getElementById('edit-hand-notes');

      handGroup.classList.add('hidden');
      stateGroup.classList.add('hidden');
      fieldGroup.classList.add('hidden');
      textGroup.classList.add('hidden');

      const posSelect = document.getElementById('edit-hand-pos');
      const activePositions = TABLE_POSITIONS_ACTIVE_MAP[currentTableSize] || TABLE_POSITIONS_ACTIVE_MAP[9];
      posSelect.innerHTML = '';
      activePositions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        posSelect.appendChild(opt);
      });

      if (!log.type || log.type === 'hand') {
        handGroup.classList.remove('hidden');
        document.getElementById('edit-hand-code').value = log.hand;
        posSelect.value = log.pos || 'BTN';
        document.getElementById('edit-hand-outcome').value = log.outcome || 'fold';
        notesEl.disabled = false;
        notesEl.value = log.notes || '';
      } else if (log.type === 'state') {
        stateGroup.classList.remove('hidden');
        document.getElementById('edit-state-bb').value = log.bb;
        document.getElementById('edit-state-stack').value = log.stack;
        notesEl.disabled = true;
        notesEl.value = log.notes || '';
      } else if (log.type === 'field') {
        fieldGroup.classList.remove('hidden');
        document.getElementById('edit-field-left').value = log.playersLeft;
        document.getElementById('edit-field-total').value = log.totalEntries;
        notesEl.disabled = true;
        notesEl.value = log.notes || '';
      } else if (log.type === 'text') {
        textGroup.classList.remove('hidden');
        document.getElementById('edit-text-content').value = log.text;
        notesEl.disabled = false;
        notesEl.value = log.notes || log.text;
      }

      document.getElementById('edit-hand-stack').value = log.resultingStack !== undefined ? log.resultingStack : activeTourney.currentStack;
      updateEditModalBBInfo();
    }

    function updateEditModalBBInfo() {
      if (!activeTourney || !editingHistoryLogId) return;
      const log = activeTourney.hands.find(x => x.id === editingHistoryLogId);
      const curBB = (log && (log.currentBB || log.bb)) ? (log.currentBB || log.bb) : (activeTourney.currentBB || 0);
      const stkVal = parseFloat(document.getElementById('edit-hand-stack')?.value) || 0;
      const bbVal = curBB > 0 ? (stkVal / curBB).toFixed(1) : '--';
      const infoEl = document.getElementById('edit-hand-bb-info');
      if (infoEl) infoEl.textContent = `當下大盲: ${curBB} | 約 ${bbVal} BB`;
    }

    function closeEditHandModal() {
      document.getElementById('modal-edit-hand').classList.add('hidden');
      editingHistoryLogId = null;
    }

    function saveActiveEditingHand() {
      if (!activeTourney || !editingHistoryLogId) return;
      const idx = activeTourney.hands.findIndex(x => x.id === editingHistoryLogId);
      if (idx === -1) return;
      const log = activeTourney.hands[idx];

      if (!log.type || log.type === 'hand') {
        const newCode = document.getElementById('edit-hand-code').value.trim().toUpperCase();
        if (MATRIX_LABELS.includes(newCode)) log.hand = newCode;
        log.pos = document.getElementById('edit-hand-pos').value;
        log.outcome = document.getElementById('edit-hand-outcome').value;
        log.isVpip = (log.outcome !== 'fold');
        log.notes = document.getElementById('edit-hand-notes').value.trim();
      } else if (log.type === 'state') {
        log.bb = parseFloat(document.getElementById('edit-state-bb').value) || log.bb;
        log.stack = parseFloat(document.getElementById('edit-state-stack').value) || log.stack;
        activeTourney.currentBB = log.bb;
      } else if (log.type === 'field') {
        log.playersLeft = parseInt(document.getElementById('edit-field-left').value) || log.playersLeft;
        log.totalEntries = parseInt(document.getElementById('edit-field-total').value) || log.totalEntries;
        activeTourney.playersLeft = log.playersLeft;
        activeTourney.totalEntries = log.totalEntries;
        calculateAndSetAverageStack();
      } else if (log.type === 'text') {
        log.text = document.getElementById('edit-text-content').value.trim();
        log.notes = log.text;
      }

      const oldStack = log.resultingStack !== undefined ? log.resultingStack : activeTourney.currentStack;
      const rawStk = document.getElementById('edit-hand-stack')?.value;
      const pStk = parseFloat(rawStk);
      const newStack = (!isNaN(pStk) && pStk >= 0) ? pStk : oldStack;
      const stackDelta = newStack - oldStack;

      log.resultingStack = newStack;
      if (log.prevStack !== undefined) {
        log.chipDiff = log.resultingStack - log.prevStack;
        const cBB = log.currentBB || activeTourney.currentBB || 1;
        log.bbDiff = parseFloat((log.chipDiff / cBB).toFixed(2));
      }

      // 若碼量有變動且此筆上方還有更新的流水帳紀錄，詢問是否向上連鎖修正未入池手牌碼量
      if (stackDelta !== 0 && idx < activeTourney.hands.length - 1) {
        if (confirm(`偵測到碼量變動 (${stackDelta > 0 ? '+' : ''}${stackDelta})！\n是否同步向上修正後續「未入池 (棄牌/被洗盲)」的手牌碼量？`)) {
          for (let i = idx + 1; i < activeTourney.hands.length; i++) {
            const nextLog = activeTourney.hands[i];
            const prevLogStack = activeTourney.hands[i - 1].resultingStack;

            if (nextLog.prevStack !== undefined) {
              nextLog.prevStack = prevLogStack;
            }

            if ((!nextLog.type || nextLog.type === 'hand') && (!nextLog.isVpip || nextLog.outcome === 'fold')) {
              const blindDeduct = nextLog.chipDiff < 0 ? nextLog.chipDiff : 0;
              nextLog.resultingStack = Math.max(0, prevLogStack + blindDeduct);
              nextLog.chipDiff = nextLog.resultingStack - nextLog.prevStack;
            } else {
              if (nextLog.resultingStack !== undefined && nextLog.prevStack !== undefined) {
                nextLog.chipDiff = nextLog.resultingStack - nextLog.prevStack;
                const cBB = nextLog.currentBB || activeTourney.currentBB || 1;
                nextLog.bbDiff = parseFloat((nextLog.chipDiff / cBB).toFixed(2));
              }
            }
          }
        }
      }

      // 同步最新一筆（流水帳最頂端第一筆）的碼量至比賽狀態、「此手後碼量」與「目前碼量 (Stack)」
      if (activeTourney.hands.length > 0) {
        const latestStack = activeTourney.hands[activeTourney.hands.length - 1].resultingStack;
        activeTourney.currentStack = latestStack;

        const stagedStkEl = document.getElementById('staged-resulting-stack');
        if (stagedStkEl) stagedStkEl.value = latestStack;

        const quickStkEl = document.getElementById('quick-stack-input');
        if (quickStkEl) quickStkEl.value = latestStack;
      }

      recalculateHandStats();
      saveStorageData();
      renderUI();
      closeEditHandModal();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
      showToast('紀錄已更新！', 'success');
    }

    function deleteActiveEditingHand() {
      if (!activeTourney || !editingHistoryLogId) return;
      if (!confirm('確定刪除此筆記錄？')) return;
      activeTourney.hands = activeTourney.hands.filter(x => x.id !== editingHistoryLogId);
      if (activeTourney.hands.length > 0) {
        activeTourney.currentStack = activeTourney.hands[activeTourney.hands.length - 1].resultingStack;
      } else {
        activeTourney.currentStack = activeTourney.startStack;
      }
      recalculateHandStats();
      saveStorageData();
      renderUI();
      closeEditHandModal();
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
    }

    function recalculateHandStats() {
      if (!activeTourney) return;
      const stats = {};
      activeTourney.hands.forEach(h => {
        if (!h.type || h.type === 'hand') {
          if (!stats[h.hand]) stats[h.hand] = { total: 0, fold: 0, loss: 0, win: 0 };
          stats[h.hand].total++;
          if (h.outcome === 'win') stats[h.hand].win++;
          else if (h.outcome === 'loss') stats[h.hand].loss++;
          else stats[h.hand].fold++;
        }
      });
      activeTourney.handStats = stats;
    }

    // --- TAB 3: 賽後覆盤與歷程回放 ---
    function openTourneyDetailModal(tourneyId) {
      const tourney = careerTournaments.find(t => t.id === tourneyId);
      if (!tourney) return;
      activeDetailTourneyId = tourneyId;
      document.getElementById('modal-tourney-detail').classList.remove('hidden');

      const sumEl = document.getElementById('tourney-detail-summary');
      const net = tourney.netProfit !== undefined ? tourney.netProfit : ((tourney.cashout || 0) - (tourney.buyin || 0));
      const netColor = net >= 0 ? 'text-emerald-400' : 'text-rose-400';

      if (sumEl) {
        sumEl.innerHTML = `
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-white">${escapeHTML(tourney.name)}</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-cyan-300 font-mono">${escapeHTML(tourney.type || 'MTT')}</span>
          </div>
          <div class="flex justify-between items-center text-[11px] text-slate-300 font-mono">
            <span>買入: $${(tourney.buyin || 0).toLocaleString()} ➔ 獲得: $${(tourney.cashout || 0).toLocaleString()}</span>
            <span class="font-bold ${netColor}">淨利: ${net >= 0 ? '+$' : '-$'}${Math.abs(net).toLocaleString()}</span>
          </div>
          <div class="text-[10px] text-slate-400">
            開始: ${tourney.startTime ? tourney.startTime.replace('T', ' ').slice(0, 16) : '--'} | 結束: ${tourney.endTime ? tourney.endTime.replace('T', ' ').slice(0, 16) : '--'} | 耗時: ${tourney.totalMinutes || 0} 分鐘 | 成績: ${escapeHTML(tourney.rank || '完賽')}
          </div>
        `;
      }

      const streamEl = document.getElementById('tourney-detail-log-stream');
      const hands = tourney.hands || [];
      if (streamEl) {
        if (hands.length === 0) {
          streamEl.innerHTML = '<div class="text-slate-600 py-10 text-center italic text-xs">此場為手動快速補登，無逐手詳細歷程。</div>';
          return;
        }

        let html = '';
        [...hands].reverse().forEach(h => {
          if (!h.type || h.type === 'hand') {
            const diff = (h.resultingStack !== undefined ? h.resultingStack : 0) - (h.prevStack || 0);
            let outcomeBadge = '';
            if (diff > 0) {
              outcomeBadge = `<span class="text-rose-400 font-bold">📈 收碼 (+${diff.toLocaleString()})</span>`;
            } else if (diff < 0) {
              outcomeBadge = `<span class="text-cyan-400 font-bold">📉 掉碼 (${diff.toLocaleString()})</span>`;
            } else {
              if (h.pos === 'BB') outcomeBadge = '<span class="text-slate-400 font-medium">⚪ 被洗盲 (-2.0 BB)</span>';
              else if (h.pos === 'SB' || h.pos === 'D/SB') outcomeBadge = '<span class="text-slate-400 font-medium">⚪ 被洗盲 (-0.5 BB)</span>';
              else outcomeBadge = '<span class="text-slate-500">⚪ 棄牌</span>';
            }

            html += `<div class="py-1 px-1 flex flex-col gap-0.5">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <span class="font-bold text-amber-300 font-mono">${escapeHTML(h.hand)}</span>
                  <span class="px-1 rounded bg-slate-800 text-[9px] text-amber-400 font-bold">${escapeHTML(h.pos)}</span>
                  <span class="text-slate-300 text-[11px]">${escapeHTML(h.actionType)}</span>
                </span>
                <span class="text-slate-500 text-[10px]">${escapeHTML(h.time)}</span>
              </div>
              <div class="flex justify-between items-center text-[10px] text-slate-400 pl-1">
                <span>碼量: <strong class="text-slate-200">${h.resultingStack !== undefined ? h.resultingStack.toLocaleString() : '--'}</strong><span class="text-cyan-400 font-mono">${(h.resultingStack !== undefined && (h.currentBB || h.bb)) ? ` (${(h.resultingStack / (h.currentBB || h.bb)).toFixed(1)} BB)` : ''}</span></span>
                <span>${outcomeBadge}</span>
              </div>
              ${h.notes ? `<div class="text-[10px] text-purple-300/80 italic pl-1">↳ ${escapeHTML(h.notes)}</div>` : ''}
            </div>`;
          } else if (h.type === 'text') {
            html += `<div class="py-1 px-2 bg-purple-950/30 rounded border border-purple-800/40 text-purple-300 text-[11px] flex justify-between">
              <span>💬 ${escapeHTML(h.text || h.notes)}</span>
              <span class="text-slate-500 font-mono text-[10px]">${escapeHTML(h.time)}</span>
            </div>`;
          } else {
            html += `<div class="py-1 px-1 text-slate-300 text-[11px]">${escapeHTML(h.notes || h.text || '')} <span class="text-slate-500 font-mono text-[10px]">(${escapeHTML(h.time)})</span></div>`;
          }
        });
        streamEl.innerHTML = html;
      }
    }

    function closeTourneyDetailModal() {
      document.getElementById('modal-tourney-detail').classList.add('hidden');
      activeDetailTourneyId = null;
    }

    function deleteTourneyFromDetail() {
      if (!activeDetailTourneyId) return;
      if (!confirm('確定要永久刪除此場賽事紀錄嗎？')) return;
      careerTournaments = careerTournaments.filter(t => t.id !== activeDetailTourneyId);
      saveStorageData();
      closeTourneyDetailModal();
      renderCareerSummary();
      showToast('已刪除該場賽事紀錄', 'info');
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
    }

    function loadTourneyToLiveWorkspaceById(tourneyId) {
      const tourney = careerTournaments.find(t => t.id === tourneyId);
      if (!tourney) return;

      if (activeTourney && activeTourney.status === 'active') {
        if (!confirm(`目前已有進行中的賽事「${activeTourney.name}」！\n\n載入「${tourney.name}」將會覆蓋當前工作區，確定要載入嗎？`)) return;
      }

      activeTourney = JSON.parse(JSON.stringify(tourney));
      activeTourney.status = 'active';
      editingOriginTourneyId = tourneyId;
      waitingHandQueue = [];
      saveStorageData();
      switchMainTab('live');
      renderUI();
      showToast(`已成功載回「${tourney.name}」！結算時可確認覆蓋或捨棄。`, 'success');
    }

    // 自動根據「開始時間」與「結束時間」換算打牌時長（支援跨午夜）
function calculateQuickEntryDuration() {
  const tStart = document.getElementById('qentry-time-start')?.value;
  const tEnd = document.getElementById('qentry-time-end')?.value;
  const durInput = document.getElementById('qentry-duration-hours');
  const durHint = document.getElementById('qentry-duration-hint');
  if (!tStart || !tEnd || !durInput) return;

  const [h1, m1] = tStart.split(':').map(Number);
  const [h2, m2] = tEnd.split(':').map(Number);

  let startMinutes = h1 * 60 + m1;
  let endMinutes = h2 * 60 + m2;

  // 跨午夜防呆處理 (例如 22:00 ~ 02:30)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const diffMinutes = endMinutes - startMinutes;
  const diffHours = parseFloat((diffMinutes / 60).toFixed(1));

  durInput.value = diffHours;
  if (durHint) {
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    durHint.textContent = `約 ${hrs}小時${mins > 0 ? mins + '分' : ''}`;
  }
}

function openQuickManualEntryModal() {
  document.getElementById('modal-quick-entry').classList.remove('hidden');
  initDefaultDateTime();
  const pEl = document.getElementById('qentry-profit');
  if (pEl) pEl.value = '';
  const bEl = document.getElementById('qentry-buyin');
  if (bEl) bEl.value = '';
  const sEl = document.getElementById('qentry-time-start');
  if (sEl) sEl.value = '';
  const eEl = document.getElementById('qentry-time-end');
  if (eEl) eEl.value = '';
  const dEl = document.getElementById('qentry-duration-hours');
  if (dEl) dEl.value = '';
  const hintEl = document.getElementById('qentry-duration-hint');
  if (hintEl) hintEl.textContent = '自動換算';
}

function confirmQuickManualEntry() {
  const dateVal = document.getElementById('qentry-date')?.value;
  const profitVal = parseFloat(document.getElementById('qentry-profit')?.value);
  const buyinVal = parseFloat(document.getElementById('qentry-buyin')?.value) || 0;
  const buyinCount = parseInt(document.getElementById('qentry-buyin-count')?.value) || 1;
  const timeStart = document.getElementById('qentry-time-start')?.value;
  const timeEnd = document.getElementById('qentry-time-end')?.value;
  let durationHours = parseFloat(document.getElementById('qentry-duration-hours')?.value);
  const typeVal = document.getElementById('qentry-type')?.value || '錦標賽';
  const nameVal = document.getElementById('qentry-name')?.value.trim() || '快速補登賽事';

  if (!dateVal || isNaN(profitVal)) {
    showToast('請完整填寫日期與損益金額！', 'warn');
    return;
  }

  // 若使用者沒手動填時長但有填起訖時間，自動補算
  if (isNaN(durationHours) && timeStart && timeEnd) {
    const [h1, m1] = timeStart.split(':').map(Number);
    let [h2, m2] = timeEnd.split(':').map(Number);
    let startM = h1 * 60 + m1;
    let endM = h2 * 60 + m2;
    if (endM < startM) endM += 24 * 60;
    durationHours = parseFloat(((endM - startM) / 60).toFixed(1));
  }
  if (isNaN(durationHours) || durationHours < 0) durationHours = 0;

  const totalBuyin = buyinVal * buyinCount;
  const finalCashout = Math.max(0, totalBuyin + profitVal);
  const totalMins = Math.round(durationHours * 60);

  // 格式化完整的 ISO 時間字串
  const startISO = timeStart ? `${dateVal}T${timeStart}:00` : `${dateVal}T12:00:00`;
  const endISO = timeEnd ? `${dateVal}T${timeEnd}:00` : '';

  careerTournaments.unshift({
    id: 'qt_' + Date.now(),
    name: nameVal,
    type: typeVal,
    date: dateVal,
    startTime: startISO,
    endTime: endISO,
    buyin: totalBuyin,
    rebuyCount: Math.max(0, buyinCount - 1),
    cashout: finalCashout,
    netProfit: profitVal,
    roi: totalBuyin > 0 ? ((profitVal / totalBuyin) * 100).toFixed(1) : 0,
    totalMinutes: totalMins,
    rank: profitVal >= 0 ? '獲利完賽' : '出局/虧損',
    hands: [],
    handStats: {},
    status: 'completed'
  });

  saveStorageData();
  renderCareerSummary();
  closeQuickManualEntryModal();
  showToast(`已成功補登「${nameVal}」！時長: ${durationHours}小時`, 'success');
}

    // --- TAB 4: 深度手牌與 GTO 庫 ---
    function calculateGlobalHandAnalytics() {
      const allHands = [];
      careerTournaments.forEach(t => {
        if (t.hands) {
          t.hands.forEach(h => {
            if (!h.type || h.type === 'hand') allHands.push({ ...h, tourneyName: t.name });
          });
        }
      });
      if (activeTourney && activeTourney.hands) {
        activeTourney.hands.forEach(h => {
          if (!h.type || h.type === 'hand') allHands.push({ ...h, tourneyName: activeTourney.name });
        });
      }

      const map = {};
      MATRIX_LABELS.forEach(lbl => {
        map[lbl] = { hand: lbl, total: 0, vpipCount: 0, netBB: 0, records: [] };
      });

      allHands.forEach(h => {
        if (map[h.hand]) {
          map[h.hand].total++;
          if (h.isVpip) map[h.hand].vpipCount++;
          const bbNet = h.bbDiff || (h.currentBB > 0 ? (h.chipDiff / h.currentBB) : 0);
          map[h.hand].netBB += bbNet;
          map[h.hand].records.push(h);
        }
      });

      return { map, totalHands: allHands.length };
    }

    function renderAnalyticsHeatmap() {
      const { map, totalHands } = calculateGlobalHandAnalytics();
      const badge = document.getElementById('analytics-total-hands-badge');
      if (badge) badge.textContent = `分析樣本: ${totalHands} 手`;

      MATRIX_LABELS.forEach(label => {
        const el = document.getElementById(`analytics-matrix-cell-${label}`);
        const cBadge = document.getElementById(`analytics-matrix-badge-${label}`);
        const bbSpan = document.getElementById(`analytics-bb-${label}`);
        if (!el) return;

        const data = map[label];
        if (!data || data.total === 0) {
          el.style.backgroundColor = '#020617';
          el.style.borderColor = '#1e293b';
          el.style.color = label.length === 2 ? '#94a3b8' : '#64748b';
          if (cBadge) cBadge.classList.add('hidden');
          if (bbSpan) bbSpan.textContent = '';
        } else {
          if (cBadge) {
            cBadge.textContent = data.total;
            cBadge.classList.remove('hidden');
          }

          const net = parseFloat(data.netBB.toFixed(1));
          if (bbSpan) bbSpan.textContent = (net >= 0 ? '+' : '') + net;

          if (net > 0) {
            el.style.backgroundColor = net >= 10 ? '#be123c' : (net >= 3 ? '#9f1239' : '#881337');
            el.style.borderColor = '#f43f5e';
            el.style.color = '#ffffff';
            if (cBadge) cBadge.style.color = '#fecdd3';
          } else if (net < 0) {
            el.style.backgroundColor = net <= -10 ? '#1d4ed8' : (net <= -3 ? '#1e40af' : '#1e3a8a');
            el.style.borderColor = '#38bdf8';
            el.style.color = '#ffffff';
            if (cBadge) cBadge.style.color = '#bae6fd';
          } else {
            el.style.backgroundColor = '#334155';
            el.style.borderColor = '#64748b';
            el.style.color = '#e2e8f0';
            if (cBadge) cBadge.style.color = '#cbd5e1';
          }
        }
      });

      if (selectedAnalyticsHand) showHandDetailInDrawer(selectedAnalyticsHand);
    }

    function onAnalyticsCellClicked(label) {
      selectedAnalyticsHand = label;
      showHandDetailInDrawer(label);
      flashMatrixCell('analytics-matrix', label, '#10b981');
    }

    function showHandDetailInDrawer(handLabel) {
      const { map } = calculateGlobalHandAnalytics();
      const data = map[handLabel];
      if (!data) return;

      const tTitle = document.getElementById('selected-hand-title');
      if (tTitle) tTitle.textContent = handLabel;

      const vpipPct = data.total > 0 ? Math.round((data.vpipCount / data.total) * 100) : 0;
      const netBB = parseFloat(data.netBB.toFixed(1));
      const bb100 = data.total > 0 ? ((data.netBB / data.total) * 100).toFixed(1) : 0;

      const mCount = document.getElementById('metric-hand-count');
      if (mCount) mCount.textContent = `${data.total} 次`;
      const mVpip = document.getElementById('metric-hand-vpip');
      if (mVpip) mVpip.textContent = `${vpipPct}%`;
      const bb100El = document.getElementById('metric-hand-bb100');
      if (bb100El) {
        bb100El.textContent = `${netBB >= 0 ? '+' : ''}${netBB} BB`;
        bb100El.className = `text-sm font-bold font-mono ${netBB >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
      }
      const kpiEl = document.getElementById('selected-hand-kpi');
      if (kpiEl) kpiEl.textContent = `${bb100 >= 0 ? '+' : ''}${bb100} BB/100`;

      const gtoRFI = GTO_BENCHMARK_RFI[handLabel] || 0;
      const devEl = document.getElementById('gto-deviation-text');
      if (devEl) {
        if (data.total < 3) {
          devEl.textContent = `樣本偏少 (${data.total} 次)。GTO 理論建議進場頻率約 ${gtoRFI}%，建議累計更多對局再校準。`;
        } else if (vpipPct > gtoRFI + 25) {
          devEl.innerHTML = `<span class="text-rose-400 font-bold">⚠️ 進場偏鬆 (過度遊戲)：</span>實際入池率 ${vpipPct}% 大幅超越 GTO 基準 (${gtoRFI}%)，容易陷入邊緣牌被主導損碼。`;
        } else if (vpipPct < gtoRFI - 25) {
          devEl.innerHTML = `<span class="text-cyan-400 font-bold">💡 進場偏緊 (放過價值)：</span>實際入池率 ${vpipPct}% 低於理論基準 (${gtoRFI}%)，可多在後位利用位置優勢施壓。`;
        } else {
          devEl.innerHTML = `<span class="text-emerald-400 font-bold">✅ 決策高度契合 GTO：</span>實際入池率 ${vpipPct}% 與理論頻率 (${gtoRFI}%) 吻合。`;
        }
      }

      const listContainer = document.getElementById('selected-hand-records-list');
      if (listContainer) {
        if (data.records.length === 0) {
          listContainer.innerHTML = '<div class="text-slate-600 py-6 text-center italic">生涯中尚未記錄過此手牌。</div>';
          return;
        }

        let html = '';
        [...data.records].reverse().forEach(r => {
          const net = r.bbDiff !== undefined ? r.bbDiff : (r.currentBB > 0 ? (r.chipDiff / r.currentBB).toFixed(1) : 0);
          html += `<div class="py-1.5 px-1 hover:bg-slate-800/60 rounded flex flex-col gap-0.5">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-bold">${escapeHTML(r.pos || '未知')}</span>
                <span class="text-slate-300">${escapeHTML(r.actionType || '未入池')}</span>
              </span>
              <span class="font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${net >= 0 ? '+' : ''}${net} BB</span>
            </div>
            <div class="text-[10px] text-slate-500 flex justify-between pl-1">
              <span>深度: ${r.bbStack || '--'} BB</span>
              <span>${escapeHTML(r.tourneyName || '賽事')} | ${escapeHTML(r.time || '')}</span>
            </div>
            ${r.notes ? `<div class="text-[10px] text-purple-300/80 italic pl-1">↳ 筆記: ${escapeHTML(r.notes)}</div>` : ''}
          </div>`;
        });
        listContainer.innerHTML = html;
      }
    }

    // --- 需求 2: 結算彈窗開啟與確認 (包含開始時間與結束時間，不自動上傳雲端) ---
    function openFinishModal() {
      if (!activeTourney) return;
      document.getElementById('modal-finish').classList.remove('hidden');

      // 預填開始時間
      const startTimeInput = document.getElementById('finish-start-time');
      if (startTimeInput) {
        startTimeInput.value = activeTourney.startTime ? activeTourney.startTime.slice(0, 16) : '';
      }

      // 預填結束時間 (若有歷史結束時間則顯示，否則預設帶入當下本地時間)
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const nowStr = now.toISOString().slice(0, 16);

      const endTimeInput = document.getElementById('finish-end-time');
      if (endTimeInput) {
        endTimeInput.value = activeTourney.endTime ? activeTourney.endTime.slice(0, 16) : nowStr;
      }

      const cashoutInput = document.getElementById('finish-cashout');
      if (cashoutInput) {
        cashoutInput.value = activeTourney.cashout !== undefined ? activeTourney.cashout : '';
      }

      const rankInput = document.getElementById('finish-rank');
      if (rankInput) {
        rankInput.value = activeTourney.rank || '';
      }

      const titleEl = document.getElementById('finish-modal-title');
      const descEl = document.getElementById('finish-modal-desc');
      const actionsEl = document.getElementById('finish-modal-actions');

      if (editingOriginTourneyId) {
        if (titleEl) titleEl.textContent = '賽事編輯確認與儲存';
        if (descEl) descEl.textContent = '此賽事為過去歷史檔案載回編輯。您可以修改開始/結束時間、獎金與名次，確認後將直接覆蓋原檔案（僅存於本地端）。';
        if (actionsEl) {
          actionsEl.innerHTML = `
            <button onclick="abandonEditAndRevert()" class="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-xs font-bold transition">
              ❌ 捨棄所有編輯
            </button>
            <div class="flex gap-1.5">
              <button onclick="closeFinishModal()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs">繼續編輯</button>
              <button onclick="confirmFinishTournament()" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition">
                💾 確認存入並覆蓋原資料
              </button>
            </div>
          `;
        }
      } else {
        if (titleEl) titleEl.textContent = '賽事結算退場';
        if (descEl) descEl.textContent = '輸入開始/結束時間、最終獎金與名次，系統自動結算淨利與 ROI（僅存於本地，需手動備份雲端）。';
        if (actionsEl) {
          actionsEl.innerHTML = `
            <button onclick="closeFinishModal()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs">取消</button>
            <button onclick="confirmFinishTournament()" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition">
              確認結算並存檔
            </button>
          `;
        }
      }
    }

    function closeFinishModal() {
      document.getElementById('modal-finish').classList.add('hidden');
    }

    function abandonEditAndRevert() {
      if (!confirm('確定要捨棄此次載入的所有修改嗎？原賽事紀錄將維持不變。')) return;
      closeFinishModal();
      resetLiveWorkspaceToInit();
      switchMainTab('review');
      showToast('已捨棄本次所有編輯內容。', 'info');
    }

    function confirmFinishTournament() {
      if (!activeTourney) return;
      const cashout = parseFloat(document.getElementById('finish-cashout')?.value) || 0;
      const rank = document.getElementById('finish-rank')?.value.trim() || '完賽';
      
      const customStartTimeStr = document.getElementById('finish-start-time')?.value;
      const customEndTimeStr = document.getElementById('finish-end-time')?.value;

      const startDate = customStartTimeStr ? new Date(customStartTimeStr) : new Date(activeTourney.startTime || Date.now());
      const endDate = customEndTimeStr ? new Date(customEndTimeStr) : new Date();
      const totalMinutes = Math.max(1, Math.round((endDate - startDate) / 60000));

      activeTourney.startTime = startDate.toISOString();
      activeTourney.endTime = endDate.toISOString();
      activeTourney.totalMinutes = totalMinutes;
      activeTourney.cashout = cashout;
      activeTourney.netProfit = cashout - activeTourney.buyin;
      activeTourney.roi = activeTourney.buyin > 0 ? ((activeTourney.netProfit / activeTourney.buyin) * 100).toFixed(1) : 0;
      activeTourney.rank = rank;
      activeTourney.status = 'completed';

      if (editingOriginTourneyId) {
        const idx = careerTournaments.findIndex(t => t.id === editingOriginTourneyId);
        if (idx !== -1) {
          careerTournaments[idx] = JSON.parse(JSON.stringify(activeTourney));
        } else {
          careerTournaments.unshift(JSON.parse(JSON.stringify(activeTourney)));
        }
        showToast('已確認存入並覆蓋原歷史紀錄！如需同步請手動點擊備份至雲端。', 'success');
      } else {
        careerTournaments.unshift(JSON.parse(JSON.stringify(activeTourney)));
        showToast('🏆 賽事已存入本機！如需同步請至覆盤頁面點擊備份至雲端。', 'success');
      }

      closeFinishModal();
      resetLiveWorkspaceToInit();
      switchMainTab('review');
      saveStorageData(); // 僅儲存於本地，不主動呼叫 uploadToCloud()
    }

    // --- 需求 3: 覆盤回放「備份至雲端」點擊二次確認 ---
    function confirmReviewUploadToCloud() {
      if (!confirm('確定要將目前的本機生涯紀錄與賽事完整備份上傳至雲端資料庫嗎？')) {
        return;
      }
      uploadToCloud();
    }

    // --- STORAGE & FIREBASE ---
    function saveStorageData() {
      localStorage.setItem('poker_system_active', JSON.stringify(activeTourney));
      localStorage.setItem('poker_system_history', JSON.stringify(careerTournaments));
      localStorage.setItem('poker_system_queue', JSON.stringify(waitingHandQueue));
    }

    function loadStorageData() {
      try {
        const a = localStorage.getItem('poker_system_active');
        if (a) activeTourney = JSON.parse(a);
        const h = localStorage.getItem('poker_system_history');
        if (h) careerTournaments = JSON.parse(h);
        const q = localStorage.getItem('poker_system_queue');
        if (q) waitingHandQueue = JSON.parse(q);
        const t = localStorage.getItem('poker_system_table_size');
        if (t) {
          currentTableSize = parseInt(t);
          const sel = document.getElementById('table-player-count');
          if (sel) sel.value = t;
        }
      } catch (e) {}
    }

    function openSettingsModal() {
      document.getElementById('modal-settings').classList.remove('hidden');
      const cfgEl = document.getElementById('cfg-firebase-json');
      if (cfgEl) cfgEl.value = localStorage.getItem('poker_system_fb_cfg') || JSON.stringify(DEFAULT_FB_CONFIG, null, 2);
      const rmEl = document.getElementById('cfg-room-code');
      if (rmEl) rmEl.value = localStorage.getItem('poker_system_fb_room') || 'my_tourney_career';
      const syncEl = document.getElementById('cfg-auto-sync');
      if (syncEl) syncEl.checked = localStorage.getItem('poker_system_fb_autosync') !== '0';
      const autoDlEl = document.getElementById('cfg-auto-download-on-load');
      if (autoDlEl) autoDlEl.checked = localStorage.getItem('poker_system_auto_download_load') === '1';
    }

    function closeSettingsModal() {
      document.getElementById('modal-settings').classList.add('hidden');
    }

    function saveAndInitFirebase() {
      const rawCfg = document.getElementById('cfg-firebase-json')?.value.trim();
      const room = document.getElementById('cfg-room-code')?.value.trim() || 'my_tourney_career';
      const autoSync = document.getElementById('cfg-auto-sync')?.checked;
      const autoDl = document.getElementById('cfg-auto-download-on-load')?.checked;

      let parsed;
      try { parsed = JSON.parse(rawCfg); } catch (e) { showToast('JSON 格式錯誤！', 'error'); return; }

      localStorage.setItem('poker_system_fb_cfg', JSON.stringify(parsed, null, 2));
      localStorage.setItem('poker_system_fb_room', room);
      localStorage.setItem('poker_system_fb_autosync', autoSync ? '1' : '0');
      localStorage.setItem('poker_system_auto_download_load', autoDl ? '1' : '0');

      isAutoSyncEnabled = autoSync;
      initFirebase(parsed, room, false);
      closeSettingsModal();
      showToast('設定已儲存！', 'success');
    }

    function initFirebaseAuto() {
      const savedCfg = localStorage.getItem('poker_system_fb_cfg');
      const room = localStorage.getItem('poker_system_fb_room') || 'my_tourney_career';
      const cfg = savedCfg ? JSON.parse(savedCfg) : DEFAULT_FB_CONFIG;
      const autoDl = localStorage.getItem('poker_system_auto_download_load') === '1';

      initFirebase(cfg, room, autoDl);
    }

    function initFirebase(cfg, room, shouldAutoDownload) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        firestoreDB = firebase.firestore();
        isCloudConfigured = true;
        const led = document.getElementById('cloud-led');
        if (led) led.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        const txt = document.getElementById('cloud-status-text');
        if (txt) txt.textContent = `已連通 (${room})`;

        firestoreDB.collection('tournament_careers').doc(room).onSnapshot(doc => {
          if (doc.exists) {
            const statusTxt = document.getElementById('cloud-status-text');
            if (statusTxt) statusTxt.textContent = `雲端最新 (${doc.data().updatedAt || '已同步'})`;
          }
        });

        if (shouldAutoDownload) {
          silentDownloadFromCloud(room);
        } else {
          setTimeout(() => {
            showToast('💡 目前未開啟「自動讀取雲端」，本地顯示為離線暫存。如需拉取最新進度請至設定開啟或點擊覆蓋同步。', 'info');
          }, 1200);
        }
      } catch (err) {
        const led = document.getElementById('cloud-led');
        if (led) led.className = 'w-2 h-2 rounded-full bg-slate-500';
        const txt = document.getElementById('cloud-status-text');
        if (txt) txt.textContent = '未連線';
      }
    }

    async function silentDownloadFromCloud(room) {
      if (!firestoreDB) return;
      try {
        const doc = await firestoreDB.collection('tournament_careers').doc(room).get();
        if (doc.exists) {
          const data = doc.data();
          activeTourney = data.activeTourney || null;
          careerTournaments = data.careerTournaments || [];
          waitingHandQueue = data.waitingHandQueue || [];
          saveStorageData();
          renderUI();
          renderDashboard();
          showToast(`☁️ 已自動同步最新雲端進度 (${data.updatedAt || '最新'})`, 'success');
        }
      } catch (e) {
        console.warn('Silent download failed', e);
      }
    }

    async function uploadToCloud() {
      const room = localStorage.getItem('poker_system_fb_room') || 'my_tourney_career';
      if (!firestoreDB) { openSettingsModal(); return; }
      try {
        await firestoreDB.collection('tournament_careers').doc(room).set({
          room: room,
          updatedAt: new Date().toLocaleTimeString(),
          timestamp: Date.now(),
          activeTourney: activeTourney,
          careerTournaments: careerTournaments,
          waitingHandQueue: waitingHandQueue
        });
        showToast('☁️ 數據已成功同步至 Firebase 雲端！', 'success');
      } catch (e) {
        showToast('上傳失敗: ' + e.message, 'error');
      }
    }

    async function downloadFromCloud() {
      const room = localStorage.getItem('poker_system_fb_room') || 'my_tourney_career';
      if (!firestoreDB) { openSettingsModal(); return; }
      try {
        const doc = await firestoreDB.collection('tournament_careers').doc(room).get();
        if (!doc.exists) { showToast('雲端無此房間資料！', 'warn'); return; }
        const data = doc.data();
        if (confirm(`偵測到雲端資料 (${data.updatedAt})！是否直接覆蓋本地端？`)) {
          activeTourney = data.activeTourney || null;
          careerTournaments = data.careerTournaments || [];
          waitingHandQueue = data.waitingHandQueue || [];
          saveStorageData();
          renderUI();
          renderDashboard();
          showToast('🎉 雲端數據已覆蓋載入！', 'success');
        }
      } catch (e) {
        showToast('下載失敗: ' + e.message, 'error');
      }
    }

    function triggerAutoSyncIfEnabled() {
      if (isAutoSyncEnabled && firestoreDB) {
        const room = localStorage.getItem('poker_system_fb_room') || 'my_tourney_career';
        firestoreDB.collection('tournament_careers').doc(room).set({
          room: room,
          updatedAt: new Date().toLocaleTimeString(),
          timestamp: Date.now(),
          activeTourney: activeTourney,
          careerTournaments: careerTournaments,
          waitingHandQueue: waitingHandQueue
        }).catch(() => {});
      }
    }

    function closeQuickManualEntryModal() {
      document.getElementById('modal-quick-entry').classList.add('hidden');
    }

    function setStagedHand(hand) {
      loadIntoActiveStaging(hand, new Date().toLocaleTimeString(), currentStagedPos);
    }

    function startNewTournamentSession() {
      const name = document.getElementById('init-tourney-name')?.value.trim() || '錦標賽挑戰';
      const type = document.getElementById('init-tourney-type')?.value || '錦標賽 (MTT)';
      const buyin = parseFloat(document.getElementById('init-buyin')?.value) || 0;
      const startTimeVal = document.getElementById('init-start-time')?.value;
      const startStack = parseFloat(document.getElementById('init-start-stack')?.value) || 30000;
      const startBB = parseFloat(document.getElementById('init-start-bb')?.value) || 200;
      const totalEntries = parseInt(document.getElementById('init-total-entries')?.value) || 100;
      const prizePool = parseFloat(document.getElementById('init-prize-pool')?.value) || null;

      const startTime = startTimeVal ? new Date(startTimeVal).toISOString() : new Date().toISOString();

      activeTourney = {
        id: 'tourney_' + Date.now(),
        name: name,
        type: type,
        buyin: buyin,
        rebuyCount: 0,
        startStack: startStack,
        currentStack: startStack,
        startBB: startBB,
        currentBB: startBB,
        totalEntries: totalEntries,
        playersLeft: totalEntries,
        prizePool: prizePool,
        startTime: startTime,
        status: 'active',
        hands: [],
        handStats: {}
      };

      editingOriginTourneyId = null;
      waitingHandQueue = [];
      saveStorageData();
      renderUI();
      renderDualAxisChart();
      showToast(`賽事「${name}」已成功建立並開始！`, 'success');
      if (isAutoSyncEnabled) triggerAutoSyncIfEnabled();
    }

    function renderUI() {
      const boxSetup = document.getElementById('box-start-tournament');
      const boxLive = document.getElementById('box-live-workspace');
      const modeLabel = document.getElementById('current-view-mode-label');

      if (!activeTourney || activeTourney.status !== 'active') {
        if (boxSetup) boxSetup.classList.remove('hidden');
        if (boxLive) boxLive.classList.add('hidden');
        if (modeLabel) modeLabel.textContent = '建立新賽事';
        return;
      }

      if (boxSetup) boxSetup.classList.add('hidden');
      if (boxLive) boxLive.classList.remove('hidden');
      if (modeLabel) modeLabel.textContent = '實戰打點進行中';

      const hudType = document.getElementById('hud-type-badge');
      if (hudType) hudType.textContent = activeTourney.type || 'MTT';
      const hudName = document.getElementById('hud-tourney-name');
      if (hudName) hudName.textContent = activeTourney.name || '賽事名稱';

      const origTag = document.getElementById('hud-edit-origin-tag');
      if (origTag) {
        if (editingOriginTourneyId) origTag.classList.remove('hidden');
        else origTag.classList.add('hidden');
      }

      const hudBuyin = document.getElementById('hud-buyin');
      if (hudBuyin) hudBuyin.textContent = `$${(activeTourney.buyin || 0).toLocaleString()}`;

      const rebuyTag = document.getElementById('hud-rebuy-tag');
      if (rebuyTag) {
        rebuyTag.textContent = activeTourney.rebuyCount > 0 ? `(${activeTourney.rebuyCount}R)` : '';
      }

      const poolWrap = document.getElementById('hud-pool-wrap');
      const hudPool = document.getElementById('hud-prizepool');
      if (poolWrap && hudPool) {
        if (activeTourney.prizePool) {
          poolWrap.classList.remove('hidden');
          hudPool.textContent = `$${activeTourney.prizePool.toLocaleString()}`;
        } else {
          poolWrap.classList.add('hidden');
        }
      }

      const hudLeft = document.getElementById('hud-players-left');
      if (hudLeft) hudLeft.textContent = activeTourney.playersLeft || '--';
      const hudTotal = document.getElementById('hud-total-entries');
      if (hudTotal) hudTotal.textContent = activeTourney.totalEntries || '--';

      const hudAvgStk = document.getElementById('hud-avg-stack');
      if (hudAvgStk) hudAvgStk.textContent = activeTourney.avgStack ? activeTourney.avgStack.toLocaleString() : '--';
      const hudAvgBB = document.getElementById('hud-avg-bb');
      if (hudAvgBB) hudAvgBB.textContent = activeTourney.avgBB ? `${activeTourney.avgBB} BB` : '-- BB';

      const curStkEl = document.getElementById('hud-current-stack');
      if (curStkEl) curStkEl.textContent = (activeTourney.currentStack || 0).toLocaleString();
      const curBBEl = document.getElementById('hud-current-bb');
      if (curBBEl) {
        const bbCount = activeTourney.currentBB > 0 ? (activeTourney.currentStack / activeTourney.currentBB).toFixed(1) : 0;
        curBBEl.textContent = `${bbCount} BB`;
      }

      const sbb = document.getElementById('staged-bb-value');
      if (sbb && activeTourney.currentBB) sbb.value = activeTourney.currentBB;
      const sstk = document.getElementById('staged-resulting-stack');
      if (sstk && currentStagedHand === null) sstk.value = activeTourney.currentStack;

      const qstk = document.getElementById('quick-stack-input');
      if (qstk) qstk.value = activeTourney.currentStack;
      const qbb = document.getElementById('quick-bb-input');
      if (qbb && activeTourney.currentBB) qbb.value = activeTourney.currentBB;

      renderHeatmap();
      renderLiveLogs();
      renderDualAxisChart();
      startDurationClock();
    }

    function startDurationClock() {
      clearInterval(durationTimer);
      if (!activeTourney || !activeTourney.startTime) return;

      const updateClock = () => {
        const start = new Date(activeTourney.startTime);
        const now = new Date();
        const diff = Math.max(0, Math.floor((now - start) / 1000));
        const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        const dEl = document.getElementById('hud-duration');
        if (dEl) dEl.textContent = `${hrs}:${mins}:${secs}`;
      };

      updateClock();
      durationTimer = setInterval(updateClock, 1000);
    }

    function renderHeatmap() {
      if (!activeTourney) return;
      const stats = activeTourney.handStats || {};
      let totalCount = 0;

      MATRIX_LABELS.forEach(label => {
        const cell = document.getElementById(`poker-matrix-cell-${label}`);
        const badge = document.getElementById(`poker-matrix-badge-${label}`);
        if (!cell) return;

        const data = stats[label];
        if (!data || data.total === 0) {
          cell.style.backgroundColor = '#020617';
          cell.style.borderColor = '#1e293b';
          cell.style.color = label.length === 2 ? '#94a3b8' : '#64748b';
          if (badge) badge.classList.add('hidden');
        } else {
          totalCount += data.total;
          if (badge) {
            badge.textContent = data.total;
            badge.classList.remove('hidden');
          }

          if (data.win > 0) {
            cell.style.backgroundColor = '#be123c';
            cell.style.borderColor = '#f43f5e';
            cell.style.color = '#ffffff';
          } else if (data.loss > 0) {
            cell.style.backgroundColor = '#1d4ed8';
            cell.style.borderColor = '#38bdf8';
            cell.style.color = '#ffffff';
          } else {
            cell.style.backgroundColor = '#334155';
            cell.style.borderColor = '#64748b';
            cell.style.color = '#cbd5e1';
          }
        }
      });

      const badgeStat = document.getElementById('matrix-stat-badge');
      if (badgeStat) badgeStat.textContent = `${totalCount} 手`;
    }

    function renderLiveLogs() {
      const container = document.getElementById('live-log-container');
      const countLabel = document.getElementById('live-log-count');
      if (!container || !activeTourney) return;

      const hands = activeTourney.hands || [];
      if (countLabel) countLabel.textContent = hands.length;

      if (hands.length === 0) {
        container.innerHTML = '<div class="text-slate-600 py-12 text-center italic text-xs">點選左側矩陣或開口語音開始打點</div>';
        return;
      }

      let html = '';
      [...hands].reverse().forEach(h => {
        if (!h.type || h.type === 'hand') {
          const diff = (h.resultingStack !== undefined ? h.resultingStack : 0) - (h.prevStack || 0);
          const handBBVal = h.currentBB || h.bb || activeTourney.currentBB || 0;
          const stackBBStr = (h.resultingStack !== undefined && handBBVal > 0)
            ? ` (${(h.resultingStack / handBBVal).toFixed(1)} BB)`
            : '';

          let outcomeBadge = '';
          if (diff > 0) outcomeBadge = `<span class="text-rose-400 font-bold">📈 收碼 (+${diff.toLocaleString()})</span>`;
          else if (diff < 0) outcomeBadge = `<span class="text-cyan-400 font-bold">📉 掉碼 (${diff.toLocaleString()})</span>`;
          else {
            if (h.pos === 'BB') outcomeBadge = '<span class="text-slate-400 font-medium">⚪ 被洗盲 (-2.0 BB)</span>';
            else if (h.pos === 'SB' || h.pos === 'D/SB') outcomeBadge = '<span class="text-slate-400 font-medium">⚪ 被洗盲 (-0.5 BB)</span>';
            else outcomeBadge = '<span class="text-slate-500">⚪ 棄牌</span>';
          }

          html += `<div onclick="openEditHandModal('${h.id}')" class="py-1 px-1 hover:bg-slate-800/60 rounded cursor-pointer transition flex flex-col gap-0.5">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="font-bold text-amber-300 font-mono">${escapeHTML(h.hand)}</span>
                <span class="px-1 rounded bg-slate-800 text-[9px] text-amber-400 font-bold">${escapeHTML(h.pos)}</span>
                <span class="text-slate-300 text-[11px]">${escapeHTML(h.actionType)}</span>
              </span>
              <span class="text-slate-500 text-[10px]">${escapeHTML(h.time)}</span>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 pl-1">
              <span>碼量: <strong class="text-slate-200">${h.resultingStack !== undefined ? h.resultingStack.toLocaleString() : '--'}</strong><span class="text-cyan-400 font-mono">${stackBBStr}</span> <span class="text-slate-600">| 盲注:${handBBVal}</span></span>
              <span>${outcomeBadge}</span>
            </div>
            ${h.notes ? `<div class="text-[10px] text-purple-300/80 italic pl-1">↳ ${escapeHTML(h.notes)}</div>` : ''}
          </div>`;
        } else if (h.type === 'text') {
          html += `<div onclick="openEditHandModal('${h.id}')" class="py-1 px-2 bg-purple-950/30 hover:bg-purple-900/40 rounded border border-purple-800/40 text-purple-300 text-[11px] flex justify-between cursor-pointer transition">
            <span>💬 ${escapeHTML(h.text || h.notes)}</span>
            <span class="text-slate-500 font-mono text-[10px]">${escapeHTML(h.time)}</span>
          </div>`;
        } else {
          html += `<div onclick="openEditHandModal('${h.id}')" class="py-1 px-1 hover:bg-slate-800/60 rounded cursor-pointer transition text-slate-300 text-[11px]">
            ${escapeHTML(h.notes || h.text || '')} <span class="text-slate-500 font-mono text-[10px]">(${escapeHTML(h.time)})</span>
          </div>`;
        }
      });
      container.innerHTML = html;
    }

    function renderDualAxisChart() {
      const svg = document.getElementById('live-dual-chart');
      const emptyHint = document.getElementById('chart-empty-placeholder');
      if (!svg || !activeTourney) return;

      const hands = activeTourney.hands || [];
      const dataPoints = [];
      dataPoints.push({
        idx: 0,
        time: activeTourney.startTime ? activeTourney.startTime.slice(11, 16) : '00:00',
        stack: activeTourney.startStack || 30000,
        bb: activeTourney.startBB || 200,
        desc: '賽事開始'
      });

      hands.forEach((h, i) => {
        if (h.resultingStack !== undefined || h.bb) {
          const curStack = h.resultingStack !== undefined ? h.resultingStack : (dataPoints[dataPoints.length - 1].stack);
          const curBB = h.currentBB || h.bb || (dataPoints[dataPoints.length - 1].bb);
          dataPoints.push({
            idx: i + 1,
            time: h.time || '',
            stack: curStack,
            bb: curBB,
            desc: h.hand ? `${h.hand} (${h.pos || ''})` : (h.notes || '盲碼打點')
          });
        }
      });

      if (dataPoints.length <= 1) {
        svg.innerHTML = '';
        if (emptyHint) emptyHint.classList.remove('hidden');
        return;
      }
      if (emptyHint) emptyHint.classList.add('hidden');

      const width = 800;
      const height = 200;
      const padding = { top: 20, right: 30, bottom: 25, left: 35 };

      const minStack = 0;
      const maxStack = Math.max(...dataPoints.map(d => d.stack), (activeTourney.startStack || 30000) * 1.5);
      const minBB = 0;
      const maxBB = Math.max(...dataPoints.map(d => d.bb), (activeTourney.startBB || 200) * 2);

      const getX = (i) => padding.left + (i / (dataPoints.length - 1)) * (width - padding.left - padding.right);
      const getYStack = (val) => height - padding.bottom - ((val - minStack) / (maxStack - minStack || 1)) * (height - padding.top - padding.bottom);
      const getYBB = (val) => height - padding.bottom - ((val - minBB) / (maxBB - minBB || 1)) * (height - padding.top - padding.bottom);

      const buildSmoothPath = (pts, getYFn) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${getX(0)},${getYFn(pts[0])}`;
        let d = `M ${getX(0)},${getYFn(pts[0])}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const x0 = getX(i);
          const y0 = getYFn(pts[i]);
          const x1 = getX(i + 1);
          const y1 = getYFn(pts[i + 1]);
          const mx = (x0 + x1) / 2;
          d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
        }
        return d;
      };

      const pathStackD = buildSmoothPath(dataPoints.map(d => d.stack), (v) => getYStack(v));
      const pathBBD = buildSmoothPath(dataPoints.map(d => d.bb), (v) => getYBB(v));

      let svgHTML = `
        <defs>
          <linearGradient id="gradStack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34d399" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#34d399" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1"/>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1"/>
        
        <path d="${pathStackD} L ${getX(dataPoints.length - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z" fill="url(#gradStack)"/>
        <path d="${pathStackD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
        <path d="${pathBBD}" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="4,3" stroke-linecap="round"/>
      `;

      dataPoints.forEach((pt, i) => {
        const cx = getX(i);
        const cyStack = getYStack(pt.stack);
        svgHTML += `
          <circle cx="${cx}" cy="${cyStack}" r="3.5" fill="#10b981" stroke="#0f172a" stroke-width="1.5" class="chart-point" data-info="[${escapeHTML(pt.time)}] ${escapeHTML(pt.desc)} | 碼量: ${pt.stack.toLocaleString()} (${pt.bb > 0 ? (pt.stack/pt.bb).toFixed(1) : 0} BB)" onmouseover="showChartTooltip(evt, this)" onmouseout="hideChartTooltip()"/>
        `;
      });

      svg.innerHTML = svgHTML;
    }

    function showChartTooltip(evt, el) {
      const tooltip = document.getElementById('chart-tooltip');
      const body = document.getElementById('tooltip-body');
      if (!tooltip || !body) return;
      body.textContent = el.getAttribute('data-info');
      tooltip.classList.remove('hidden');

      const rect = el.ownerSVGElement.getBoundingClientRect();
      const x = evt.clientX - rect.left + 10;
      const y = evt.clientY - rect.top - 30;
      tooltip.style.left = `${Math.min(x, rect.width - 200)}px`;
      tooltip.style.top = `${Math.max(10, y)}px`;
    }

    function hideChartTooltip() {
      const tooltip = document.getElementById('chart-tooltip');
      if (tooltip) tooltip.classList.add('hidden');
    }

    function renderCareerSummary() {
      const countEl = document.getElementById('career-tourney-count');
      const listContainer = document.getElementById('career-list-container');
      if (!listContainer) return;

      if (countEl) countEl.textContent = `共 ${careerTournaments.length} 筆`;
      if (careerTournaments.length === 0) {
        listContainer.innerHTML = '<div class="text-slate-600 py-8 text-center italic">尚未有已結算的賽事，完成一場後將在此完整呈現。</div>';
        return;
      }

      let html = '';
      careerTournaments.forEach(t => {
        const net = t.netProfit !== undefined ? t.netProfit : ((t.cashout || 0) - (t.buyin || 0));
        const color = net >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const roi = t.roi !== undefined ? t.roi : (t.buyin > 0 ? ((net / t.buyin) * 100).toFixed(1) : 0);
        const durationText = t.totalMinutes ? `${Math.floor(t.totalMinutes / 60)}小時${t.totalMinutes % 60}分` : '--';

        html += `<div class="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-white text-sm">${escapeHTML(t.name)}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-cyan-300 font-mono">${escapeHTML(t.type || 'MTT')}</span>
              <span class="text-[10px] text-slate-500">${t.startTime ? t.startTime.slice(0, 10) : t.date || '--'}</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
              <span>買入: $${(t.buyin || 0).toLocaleString()}</span>
              <span>獲利: $${(t.cashout || 0).toLocaleString()}</span>
              <span>時長: ${durationText}</span>
              <span>名次: ${escapeHTML(t.rank || '完賽')}</span>
            </div>
          </div>

          <div class="flex items-center gap-3 self-end sm:self-center font-mono">
            <div class="text-right">
              <div class="text-xs sm:text-sm font-bold ${color}">${net >= 0 ? '+' : ''}${net.toLocaleString()} NTD</div>
              <div class="text-[10px] ${roi >= 0 ? 'text-cyan-400' : 'text-rose-400'}">ROI: ${roi >= 0 ? '+' : ''}${roi}%</div>
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="openTourneyDetailModal('${t.id}')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 rounded-lg text-xs font-semibold transition">
                詳情
              </button>
              <button onclick="loadTourneyToLiveWorkspaceById('${t.id}')" class="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-700/60 text-amber-300 rounded-lg text-xs font-semibold transition">
                載回
              </button>
            </div>
          </div>
        </div>`;
      });
      listContainer.innerHTML = html;
    }
