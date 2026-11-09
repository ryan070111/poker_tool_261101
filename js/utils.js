// HTML 安全跳脫（徹底防止 88<QQ 破壞 DOM 結構）
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 自動根據開始與結束時間換算時長（支援跨午夜防呆處理，如 22:30 ~ 02:00）
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

  // 跨午夜處理
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
