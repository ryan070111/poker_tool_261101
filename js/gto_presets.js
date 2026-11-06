// GTO 範圍解析輔助函式
function parseRangeNotation(inputStr) {
  const set = new Set();
  const parts = inputStr.split(',').map(s => s.trim()).filter(Boolean);
  parts.forEach(token => {
    if (token.endsWith('+')) {
      const base = token.slice(0, -1);
      if (base.length === 2 && base[0] === base[1]) {
        const idx = RANKS.indexOf(base[0]);
        for (let i = idx; i >= 0; i--) set.add(RANKS[i] + RANKS[i]);
      } else if (base.endsWith('s')) {
        const h1 = base[0], h2 = base[1];
        const i1 = RANKS.indexOf(h1), i2 = RANKS.indexOf(h2);
        for (let i = i2; i > i1; i--) set.add(h1 + RANKS[i] + 's');
      } else if (base.endsWith('o')) {
        const h1 = base[0], h2 = base[1];
        const i1 = RANKS.indexOf(h1), i2 = RANKS.indexOf(h2);
        for (let i = i2; i > i1; i--) set.add(h1 + RANKS[i] + 'o');
      }
    } else if (token.includes('-')) {
      const [p1, p2] = token.split('-').map(s => s.trim());
      if (p1.length === 3 && p1.endsWith('s') && p2.length === 3 && p2.endsWith('s') && p1[0] === p2[0]) {
        const h1 = p1[0];
        const idx1 = RANKS.indexOf(p1[1]);
        const idx2 = RANKS.indexOf(p2[1]);
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        for (let i = start; i <= end; i++) set.add(h1 + RANKS[i] + 's');
      } else if (p1.length === 2 && p1[0] === p1[1] && p2.length === 2 && p2[0] === p2[1]) {
        const idx1 = RANKS.indexOf(p1[0]);
        const idx2 = RANKS.indexOf(p2[0]);
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        for (let i = start; i <= end; i++) set.add(RANKS[i] + RANKS[i]);
      } else {
        set.add(token);
      }
    } else {
      set.add(token);
    }
  });
  return set;
}

// 完整 GTO 預設庫資料
const GTO_PRESETS = {
  // 40 BB
  '40_LJ': { name: '40BB LJ Open (約 16%)', desc: '前位注重手牌硬度與被 3B 後抗性，涵蓋全部 77+、ATs+、KJs+ 及微量 A5s/A4s 輪子詐唬。', hands: parseRangeNotation('77+, AJs+, KQs, QJs, JTs, T9s, 98s, AQo+, A5s, A4s, KJs, QTs, ATs') },
  '40_HJ': { name: '40BB HJ Open (約 20%)', desc: '增加同花高牌與中型連張 (87s, 76s)，開始加入 A9s, KTs, QTs 等具備翻後可玩性之邊緣牌。', hands: parseRangeNotation('66+, ATs+, A5s-A3s, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, AJo+, KQo') },
  '40_CO': { name: '40BB CO Open (約 28%)', desc: '位置優勢擴大，納入全部 22+、更多同花 Ax (A2s+)、K8s+、同花隔張及 ATo, KTo 寬開牌。', hands: parseRangeNotation('22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, ATo+, KTo+, QJo') },
  '40_BTN': { name: '40BB BTN Open (約 45%)', desc: '具有絕對後動權與盲注死錢，開出近 45% 的超寬範圍：幾乎所有同花牌、任意 Ax、K4o+、Q7o+ 及連張。', hands: parseRangeNotation('22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 98o, 87o') },
  '40_BTN_3B_CO': { name: '40BB BTN vs CO Open (3-Bet 約 11.2%)', desc: '在有利位置（IP）對抗 CO 開牌，採取高強度的線性偏緊範圍：JJ+、AK、AQs 純價值，混合 A2s-A5s 輪子阻擋牌與 KQs/QJs/JTs/T9s 連張施壓。', hands: parseRangeNotation('TT+, AJs+, KQs, QJs, JTs, T9s, A2s-A5s, AQo+, KJs') },
  '40_CO_3B_LJ': { name: '40BB CO vs LJ Open (3-Bet 約 6.8%)', desc: '面對前位緊實開牌，3-Bet 必須極度堅實：JJ+、AKs、AKo 為核心，輔以微量 A5s/A4s 與 KQs 作為平衡詐唬，其餘以 Flat Call 為主。', hands: parseRangeNotation('JJ+, AKs, A5s, A4s, KQs, AKo') },
  '40_SB_3B_BTN': { name: '40BB SB vs BTN Open (3-Bet 約 13.5%)', desc: '無位置優勢（OOP）面對寬開牌，以高頻率極化 3-Bet 主導：99+、AJs+、AQo+ 純價值，混合 A2s-A5s、KJs、QJs、KTs、JTs 與少量同花連張詐唬。', hands: parseRangeNotation('88+, ATs+, KTs+, QJs, JTs, AJo+, KQo, A2s-A5s, KJs') },
  '40_BB_3B_BTN': { name: '40BB BB vs BTN Open (3-Bet 約 13.0%)', desc: '守盲反擊：除平跟大量手牌外，用 TT+、AJs+、AQo+ 作為價值 3-Bet，並搭配優質阻擋牌 A2s-A5s、K9s/Q9s、JTs 等執行 3-Bet 奪回主動權。', hands: parseRangeNotation('99+, AJs+, KQs, AQo+, A2s-A5s, KJs, QJs, JTs, T9s, KTs') },
  '40_BB_3B_CO': { name: '40BB BB vs CO Open (3-Bet 約 9.2%)', desc: '面對 CO 開牌收緊 3-Bet 範圍：TT+、AQs+、AKo 價值端，輔以 A3s-A5s、KJs、QJs 阻擋詐唬，避免遭遇 4-Bet 陷入兩難。', hands: parseRangeNotation('TT+, AQs+, AKo, A3s-A5s, KJs, QJs, JTs') },
  '40_BB_3B_LJ': { name: '40BB BB vs LJ Open (3-Bet 約 5.5%)', desc: '面對前位極硬開牌，極化防守：僅用 JJ+、AK 作為純價值，微量搭配 A5s/A4s 輪子順阻擋牌，其餘邊緣牌一律平跟控池。', hands: parseRangeNotation('JJ+, AKs, AKo, A4s, A5s') },
  '40_BB_def_BTN': { name: '40BB BB 面對 BTN 2x Min-Raise 防守 (約 68%)', desc: '只需補 1BB 爭取 5.5BB，必須極寬防守以維持 MDF：除極端雜色垃圾牌外皆需 Call 或 3-Bet。', hands: parseRangeNotation('22+, A2s+, K2s+, Q2s+, J2s+, T4s+, 95s+, 84s+, 74s+, 63s+, 52s+, 42s+, 32s, A2o+, K5o+, Q7o+, J7o+, T7o+, 97o+, 86o+, 76o') },
  '40_BB_def_LJ': { name: '40BB BB 面對 LJ 開牌防守 (約 42%)', desc: '面對前位強範圍，大幅剃除容易被主導的弱雜色 Ax/Kx，專注於同花成牌與中低對子看翻牌。', hands: parseRangeNotation('22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, A8o+, KTo+, QTo+, JTo') },
  '40_SB_def': { name: '40BB SB 面對 Open (3B / Call 抵抗)', desc: '無位置優勢，以極化 3-Bet 為主 (QQ+, AK, A2s-A5s bluff)，並用 99-JJ, AQs, KQs 等高勝率牌平跟防守。', hands: parseRangeNotation('88+, ATs+, KTs+, QJs, JTs, AJo+, KQo, A5s, A4s, A3s') },
  '40_BTN_4B_BB': { name: '40BB BTN Open 面對 BB 3-Bet 之 4-Bet (約 6.5%)', desc: '在有利位置（IP）遭遇 BB 3-Bet：4-Bet 尺度約 20-22BB 或直接 Shove。純價值端為 QQ+、AK；詐唬端以最頂級阻擋牌 A5s、A4s 組成。', hands: parseRangeNotation('QQ+, AKs, A5s, A4s, AKo') },
  '40_CO_4B_BTN': { name: '40BB CO Open 面對 BTN 3-Bet 之 4-Bet (約 5.2%)', desc: '不利位置（OOP）遭遇 BTN 壓制：4-Bet 尺度放大或直接 40BB 4-Bet Shove。價值端嚴縮為 KK+、AK；微量 A5s 詐唬。', hands: parseRangeNotation('KK+, AKs, A5s, AKo') },
  '40_LJ_4B_BTN': { name: '40BB LJ Open 面對 BTN 3-Bet 之 4-Bet (約 4.0%)', desc: '槍口前位遭遇後方 3-Bet：範圍極硬，僅用 KK+、AKs 執行 4-Bet 價值推進，極少量 A4s 阻擋詐唬。', hands: parseRangeNotation('KK+, AKs, AKo, A4s') },
  '40_SB_4B_BB': { name: '40BB SB Open 面對 BB 3-Bet 之 4-Bet (約 7.8%)', desc: '盲注內戰（BvB）：JJ+、AK 價值推動，A2s-A5s、KJs 作為強力阻擋 4-Bet 半詐唬。', hands: parseRangeNotation('JJ+, AQs+, AKo, A2s-A5s') },
  '40_BB_5B_BTN': { name: '40BB BB 3-Bet 後面對 BTN 4-Bet 之 5-Bet Shove (約 3.2%)', desc: '深水區 5-Bet Jam：頂端價值 KK+、AKs（約 80%），搭配阻擋 AA/KK 的極致炸唬 A5s（約 20%）。', hands: parseRangeNotation('KK+, AKs, A5s, AKo') },
  '40_BTN_5B_SB': { name: '40BB BTN 3-Bet 後面對 SB 4-Bet 之 5-Bet Shove (約 3.8%)', desc: 'IP 5-Bet Shove：面對 SB 的冷酷 4-Bet 反擊，BTN 僅用 KK+、AKs、AKo 推全下。', hands: parseRangeNotation('KK+, AKs, AKo') },

  // 30 BB
  '30_LJ': { name: '30BB LJ Open (約 14%)', desc: '受 3-Bet Shove 威脅，開始收緊小對子 (22-55 剔除)，只保留高牌硬度強韌的手牌。', hands: parseRangeNotation('77+, ATs+, KTs+, QJs, JTs, AJo+, KQo') },
  '30_BTN': { name: '30BB BTN Open (約 40%)', desc: '仍維持強勢偷盲，但略微修剪邊緣弱雜色 (如 K5o, Q7o)，防範大盲短碼 Reshove。', hands: parseRangeNotation('22+, A2s+, K3s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, A2o+, K8o+, Q9o+, J9o+, T9o') },
  '30_BB_3B_BTN': { name: '30BB BB vs BTN Open (3-Bet 約 11.5%)', desc: '有效籌碼變淺，中型對子 (77-TT) 與高張同花連張價值提升，3-Bet 尺度偏小 (約 6.5-7.5BB)。', hands: parseRangeNotation('88+, ATs+, KTs+, QJs, JTs, A2s-A5s, AJo+, KQo') },
  '30_BTN_3B_CO': { name: '30BB BTN vs CO Open (3-Bet 約 9.8%)', desc: '位置優勢下的壓縮：TT+、AJs+、AKo 價值端，搭配 A3s-A5s 與 KQs。', hands: parseRangeNotation('99+, AJs+, KQs, QJs, A3s-A5s, AQo+') },

  // 25 BB
  '25_BTN': { name: '25BB BTN Open (約 36%)', desc: 'Min-Raise 後必須具備清晰的面對 Reshove 處置方案。投機性弱隔張開始剃除。', hands: parseRangeNotation('22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 87s, A3o+, K9o+, QTo+, JTo') },
  '25_BB_def_BTN': { name: '25BB BB 防守範圍 (約 58%)', desc: '翻後操作空間變窄，弱雜色高牌防守頻率降低，注重同花成牌與對子。', hands: parseRangeNotation('22+, A2s+, K2s+, Q4s+, J5s+, T6s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T8o+') },
  '25_BB_shove_BTN': { name: '25BB BB vs BTN (3-Bet Shove 約 13.8%)', desc: '利用強大 Fold Equity 直接全下收死錢！涵蓋 22-99 口袋對、A2s-A9s 同花 A、ATo-AJo、KTs+、QJs。', hands: parseRangeNotation('22-99, A2s-A9s, KTs+, QJs, ATo, AJo') },
  '25_BTN_shove_CO': { name: '25BB BTN vs CO (3-Bet Shove 約 10.5%)', desc: '在 CO Min-Raise 後直接 25BB Shove，鎖定 22-88、A8s-AJs、KJs+、ATo-AJo。', hands: parseRangeNotation('22-88, A8s-AJs, KJs+, ATo, AJo') },
  '25_BB_3B_BTN': { name: '25BB BB vs BTN (小尺度 3-Bet / 誘捕 約 6.5%)', desc: '頂端價值與誘捕：TT+、AQs+、AKo 用小尺度 (5.5BB) Min 3-Bet 引誘 BTN 輕推或犯錯跟注。', hands: parseRangeNotation('TT+, AQs+, AKo') },

  // 20 BB
  '20_BTN': { name: '20BB BTN Open (約 32%)', desc: '處於 Min-Raise / Fold 的危險臨界。小對子 (22-55) 部分轉為直接 Push 或棄牌。', hands: parseRangeNotation('55+, A2s+, K7s+, Q8s+, J8s+, T8s+, 98s, A7o+, KTo+, QTo+, JTo') },
  '20_BB_shove_BTN': { name: '20BB BB vs BTN (3-Bet Shove 約 16.5%)', desc: '極佳 SPR 全下深度：22-88、A2s-ATs、K9s+、QTs+、JTs、A8o-AJo 直接 Shove 奪取底池。', hands: parseRangeNotation('22-88, A2s-ATs, K9s+, QTs+, JTs, A8o-AJo') },
  '20_BB_shove_CO': { name: '20BB BB vs CO (3-Bet Shove 約 11.2%)', desc: '面對 CO 開牌的 20BB 反推：33-88、A2s-A8s、KTs+、ATo-AJo。', hands: parseRangeNotation('33-88, A2s-A8s, KTs+, QJs, ATo, AJo') },
  '20_BTN_shove_CO': { name: '20BB BTN vs CO (3-Bet Shove 約 12.0%)', desc: 'BTN 直接 Reshove：22-77、A2s-ATs、KJs+、ATo-AJo。', hands: parseRangeNotation('22-77, A2s-ATs, KJs+, ATo, AJo') },

  // 15 BB
  '15_BTN': { name: '15BB BTN Open / Shove (約 28%)', desc: 'Push/Fold 門檻深度。22-77, A2s-A9s, K9s+, QTs, KJo+ 傾向直接 Open Shove 收死錢；AA-QQ, AK 可 Min-Raise 引誘。', hands: parseRangeNotation('22+, A2s+, K8s+, Q9s+, J9s+, T9s, A8o+, KTo+, QJo') },
  '15_BB_shove_BTN': { name: '15BB BB vs BTN (3-Bet Reshove 約 19.5%)', desc: '短碼絕地反擊：22-77、任意同花 Ax、K8s+、Q9s+、J9s+、T9s、A5o-AJo、KTo+ 均可直接推入。', hands: parseRangeNotation('22-77, A2s-ATs, K8s+, Q9s+, J9s+, T9s, A5o-AJo, KTo, QTo') },
  '15_BB_shove_CO': { name: '15BB BB vs CO (3-Bet Reshove 約 13.0%)', desc: '面對 CO 偷盲直接推牌：22-77、A2s-ATs、K9s+、QJs、A7o-AJo。', hands: parseRangeNotation('22-77, A2s-ATs, K9s+, QJs, A7o-AJo') },

  // 特殊深碼與泡沫期 ICM 修正
  '100_BTN_5B_BB': { name: '100BB 深碼 5-Bet 體系 (約 2.5%)', desc: '100BB 典型 5-Bet：僅保留純堅果 AA、KK 及極端阻擋牌 A5s，其餘手牌面對 4-Bet 一律 Call 或 Fold。', hands: parseRangeNotation('KK+, AKs, A5s') },
  'BUBBLE_CL_BTN': { name: '泡沫期 CL 按鈕巨鯨偷盲 (約 68%)', desc: '【ICM 巨鯨壓制】利用中短碼保命進圈的極端風險溢價，在按鈕位開出近 70% 的極寬範圍奪取死錢。', hands: parseRangeNotation('22+, A2s+, K2s+, Q2s+, J4s+, T6s+, 95s+, 84s+, 74s+, 63s+, 52s+, 43s, A2o+, K4o+, Q7o+, J7o+, T7o+, 97o+, 87o') },
  'BUBBLE_MID_CO': { name: '泡沫期 中碼 (25BB) CO 開牌極端緊縮 (約 16%)', desc: '【ICM 中碼受限】距離進圈僅差數人，中碼一旦開牌遭遇 CL 3-Bet 將面臨致命淘汰風險，範圍必須緊縮至 16%。', hands: parseRangeNotation('77+, ATs+, KTs+, QJs, JTs, AJo+, KQo') },
  'BUBBLE_SHORT_PUSH': { name: '泡沫期 短碼 (12BB) 保命極限推牌 (約 11%)', desc: '【ICM 短碼生存】場上若有更短碼，12BB 短碼在泡沫期的 Push 範圍劇烈收緊至 11%！優先等待他人被淘汰進圈。', hands: parseRangeNotation('77+, AJs+, AQo+, KQs') },
  'BUBBLE_BB_vs_CL': { name: '泡沫期 中碼 BB 面對 CL 偷盲之防守 (約 25%)', desc: '【ICM 大盲收斂】正常 ChipEV 下 BB 抵抗 BTN 高達 68%，但泡沫期面對全桌 CL 的覆蓋施壓，防守線劇烈萎縮至 25%。', hands: parseRangeNotation('55+, A8s+, K9s+, QTs+, JTs, ATo+, KJo+, QJo') }
};
