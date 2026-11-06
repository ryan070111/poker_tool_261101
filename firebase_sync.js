let firebaseAppInstance = null;
let firestoreDB = null;
let isCloudConfigured = false;
let isAutoSyncEnabled = false;

function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
  loadCloudSettingsToUI();
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function generateRandomRoomCode() {
  document.getElementById('cfg-room-code').value = 'room_' + Math.random().toString(36).substring(2, 8);
}

function loadCloudSettingsToUI() {
  document.getElementById('cfg-firebase-json').value = localStorage.getItem('poker_lab_fb_config') || '';
  document.getElementById('cfg-room-code').value = localStorage.getItem('poker_lab_fb_room') || 'my_poker_lab';
  document.getElementById('cfg-auto-sync').checked = localStorage.getItem('poker_lab_fb_autosync') === '1';
}

function saveAndInitFirebase() {
  const rawCfg = document.getElementById('cfg-firebase-json').value.trim();
  const room = document.getElementById('cfg-room-code').value.trim() || 'my_poker_lab';
  const autoSync = document.getElementById('cfg-auto-sync').checked;

  if (!rawCfg) {
    alert('請填入 Firebase Config！');
    return;
  }

  let parsedCfg;
  try {
    parsedCfg = JSON.parse(rawCfg);
  } catch (e) {
    try {
      parsedCfg = eval('(' + rawCfg + ')');
    } catch (e2) {
      alert('Firebase Config 格式錯誤，請確保為標準 JSON 格式！');
      return;
    }
  }

  localStorage.setItem('poker_lab_fb_config', JSON.stringify(parsedCfg, null, 2));
  localStorage.setItem('poker_lab_fb_room', room);
  localStorage.setItem('poker_lab_fb_autosync', autoSync ? '1' : '0');
  isAutoSyncEnabled = autoSync;

  initFirebase(parsedCfg, room);
}

function initFirebase(cfg, room) {
  try {
    if (!firebase.apps.length) {
      firebaseAppInstance = firebase.initializeApp(cfg);
    } else {
      firebaseAppInstance = firebase.app();
    }
    firestoreDB = firebase.firestore();
    isCloudConfigured = true;

    updateCloudStatusUI(true, `已連線 (房間: ${room})`);
    closeSettingsModal();
    setupRealtimeListener(room);
  } catch (err) {
    console.error(err);
    isCloudConfigured = false;
    updateCloudStatusUI(false, '連線失敗：請檢查 Config');
  }
}

function setupRealtimeListener(room) {
  if (!firestoreDB || !room) return;
  try {
    firestoreDB.collection('poker_sessions').doc(room)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const remoteTime = data.updatedAt || '剛剛';
          document.getElementById('cloud-status-text').textContent = `雲端有最新數據 (${remoteTime})`;
        }
      });
  } catch (e) {
    console.warn('Realtime listener failed:', e);
  }
}

function testFirebaseConnection() {
  saveAndInitFirebase();
}

function updateCloudStatusUI(connected, text) {
  const dot = document.getElementById('cloud-status-dot');
  const label = document.getElementById('cloud-status-text');
  if (!dot || !label) return;

  if (connected) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    label.textContent = `雲端：${text}`;
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-slate-600';
    label.textContent = text;
  }
}

async function uploadToCloud() {
  const room = localStorage.getItem('poker_lab_fb_room') || 'my_poker_lab';
  if (!firestoreDB) {
    const savedCfg = localStorage.getItem('poker_lab_fb_config');
    if (savedCfg) {
      initFirebase(JSON.parse(savedCfg), room);
    } else {
      openSettingsModal();
      alert('請先在設定視窗輸入 Firebase Config！');
      return;
    }
  }

  const payload = {
    room: room,
    updatedAt: new Date().toLocaleTimeString(),
    timestamp: Date.now(),
    currentWorking: {
      counts: counterCounts,
      history: counterHistory
    },
    savedSessions: savedSessions,
    studyNotes: localStorage.getItem('poker_lab_study_notes') || '',
    currentPosition: currentPosition
  };

  try {
    updateCloudStatusUI(true, '正在上傳...');
    await firestoreDB.collection('poker_sessions').doc(room).set(payload);
    updateCloudStatusUI(true, `已完全上傳 (${payload.updatedAt})`);
    alert('☁️ 已成功將所有手牌矩陣、流水帳及已歸檔牌局完整備份至雲端！');
  } catch (err) {
    console.error(err);
    alert('上傳失敗：' + err.message);
    updateCloudStatusUI(false, '上傳失敗');
  }
}

// 雲端資料直接覆蓋本地端資料
async function downloadFromCloud() {
  const room = localStorage.getItem('poker_lab_fb_room') || 'my_poker_lab';
  if (!firestoreDB) {
    const savedCfg = localStorage.getItem('poker_lab_fb_config');
    if (savedCfg) {
      initFirebase(JSON.parse(savedCfg), room);
    } else {
      openSettingsModal();
      return;
    }
  }

  try {
    updateCloudStatusUI(true, '正在下載...');
    const doc = await firestoreDB.collection('poker_sessions').doc(room).get();
    if (!doc.exists) {
      alert(`雲端房間「${room}」目前尚無資料，請先在發送端點擊「上傳」！`);
      updateCloudStatusUI(true, `房間無資料`);
      return;
    }

    const data = doc.data();
    if (confirm(`偵測到雲端資料 (最後更新: ${data.updatedAt || '未知'})！\n\n是否以雲端資料【直接覆蓋】本地的所有手牌記數、流水帳與歸檔牌局？`)) {
      if (Array.isArray(data.savedSessions)) {
        savedSessions = data.savedSessions;
      }
      if (data.currentWorking) {
        counterHistory = [ ...(data.currentWorking.history || []) ];
        counterCounts = { ...(data.currentWorking.counts || {}) };
      }
      if (data.studyNotes) {
        localStorage.setItem('poker_lab_study_notes', data.studyNotes);
        if (document.getElementById('study-notes')) document.getElementById('study-notes').value = data.studyNotes;
      }

      saveStorageData();
      refreshSessionsUI();
      renderCounterMatrix();
      updateCloudStatusUI(true, `已完全覆蓋 (${data.updatedAt})`);
      alert('🎉 雲端牌局資料已完整覆蓋載入成功！');
    }
  } catch (err) {
    console.error(err);
    alert('下載失敗：' + err.message);
    updateCloudStatusUI(false, '同步失敗');
  }
}

function triggerAutoSyncIfEnabled() {
  if (isAutoSyncEnabled && firestoreDB) {
    const room = localStorage.getItem('poker_lab_fb_room') || 'my_poker_lab';
    firestoreDB.collection('poker_sessions').doc(room).set({
      updatedAt: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
      currentWorking: {
        counts: counterCounts,
        history: counterHistory
      },
      savedSessions: savedSessions
    }, { merge: true }).catch(err => console.warn('AutoSync warning:', err));
  }
}