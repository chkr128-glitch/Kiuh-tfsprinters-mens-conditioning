// ==========================================
// 📌 AthleSense 管理者画面 メインロジック (admin.js)
// ==========================================

// ==========================================
// 📌 2. UIコントローラー (Toast, Modal)
// ==========================================
const UI = {
    showToast: function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bgColors = { info: 'var(--color-info)', success: 'var(--color-success)', warning: 'var(--color-warning)', error: 'var(--color-danger)' };
        
        toast.style.backgroundColor = bgColors[type];
        toast.style.color = 'white'; toast.style.padding = '16px 20px'; toast.style.borderRadius = '16px';
        toast.style.boxShadow = 'var(--shadow-md)'; toast.style.fontSize = '15px'; toast.style.fontWeight = '800';
        toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; toast.style.transition = 'all 0.4s var(--ease-out-expo)';
        toast.style.display = 'flex'; toast.style.alignItems = 'center'; toast.style.gap = '12px';
        
        let icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : 'ℹ️';
        toast.innerHTML = `<span style="font-size:20px;">${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => toast.remove(), 400); }, 3500);
    },
    showConfirm: function(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').innerHTML = message;
        modal.style.display = 'flex';
        
        const okBtn = document.getElementById('confirm-ok-btn'); const cancelBtn = document.getElementById('confirm-cancel-btn');
        const newOkBtn = okBtn.cloneNode(true); const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn); cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newOkBtn.onclick = () => { modal.style.display = 'none'; if(onConfirm) onConfirm(); };
        newCancelBtn.onclick = () => { modal.style.display = 'none'; };
    },
    showPrompt: function(title, desc, initialValue, onSave) {
        const modal = document.getElementById('prompt-modal');
        document.getElementById('prompt-title').textContent = title;
        document.getElementById('prompt-desc').textContent = desc;
        const input = document.getElementById('prompt-input'); input.value = initialValue;
        modal.style.display = 'flex'; input.focus();
        
        const okBtn = document.getElementById('prompt-ok-btn'); const cancelBtn = document.getElementById('prompt-cancel-btn');
        const newOkBtn = okBtn.cloneNode(true); const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn); cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newOkBtn.onclick = () => { modal.style.display = 'none'; if(onSave) onSave(input.value); };
        newCancelBtn.onclick = () => { modal.style.display = 'none'; };
    }
};

const targetDateLinePlugin = {
    id: 'targetDateLinePlugin',
    afterDraw: (chart) => {
        if (!STATE.settings || !STATE.settings.targetEventDate) return;
        const targetObj = new Date(STATE.settings.targetEventDate + 'T00:00:00');
        const targetLabel = String(targetObj.getMonth()+1).padStart(2,'0') + '/' + String(targetObj.getDate()).padStart(2,'0');
        const index = chart.data.labels.findIndex(l => l === targetLabel);
        
        if (index !== -1) {
            const ctx = chart.ctx, meta = chart.getDatasetMeta(0);
            if (!meta.data[index]) return;
            const x = meta.data[index].x, topY = chart.chartArea.top, bottomY = chart.chartArea.bottom;
            ctx.save(); ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, bottomY);
            ctx.lineWidth = 2; ctx.strokeStyle = '#f97316'; ctx.setLineDash([5, 5]); ctx.stroke();
            ctx.fillStyle = '#f97316'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.font = 'bold 12px -apple-system, sans-serif';
            ctx.fillText('🏆 ' + (STATE.settings.targetEventName || '大会日'), x, topY - 5);
            ctx.restore();
        }
    }
};

// ==========================================
// 📌 3. 初期化・Firebase Listeners
// ==========================================
async function initApp() {
    setDefaultDates();
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); document.getElementById('theme-toggle').innerHTML = '☀️';}
    
    try {
        firebase.initializeApp(CONSTANTS.FIREBASE_CONFIG);
        db = firebase.firestore();
        db.settings({ experimentalForceLongPolling: true });
        await firebase.auth().signInAnonymously();
        
        colRefs = {
            logs: db.collection('team_condition_logs'), players: db.collection('team_players'),
            goals: db.collection('team_goals'), settings: db.collection('team_settings'),
            edu: db.collection('team_education'), broadcasts: db.collection('team_broadcasts')
        };

        document.getElementById('connection-status').textContent = 'クラウド同期中';
        document.getElementById('connection-status').className = 'status-badge status-cloud';

        setupListeners();
    } catch (error) {
        console.warn("Firebase Error", error);
        document.getElementById('connection-status').textContent = 'ローカル';
        document.getElementById('connection-status').className = 'status-badge status-local';
        UI.showToast("通信エラーのため、ローカルデータで起動します", "warning");
        loadLocalData();
    }
}

function setupListeners() {
    colRefs.players.onSnapshot(snapshot => {
        STATE.players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        STATE.players.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        renderPlayersList(); updateAdminUI();
    });

    colRefs.logs.onSnapshot(snapshot => {
        STATE.logs = snapshot.docs.map(doc => doc.data());
        STATE.logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        updateAdminUI();
    });
    
    colRefs.broadcasts.onSnapshot(snapshot => {
        STATE.broadcasts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        STATE.broadcasts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const modal = document.getElementById('broadcast-list-modal');
        if (modal && modal.style.display === 'flex') renderBroadcastList();
    });
    
    colRefs.settings.doc('general').onSnapshot(doc => {
        if(doc.exists) {
            STATE.settings = doc.data();
            STATE.careOptions = STATE.settings.careOptions || CONSTANTS.DEFAULT_CARES;
            const viewCare = document.getElementById('view-careSettings');
            if (viewCare && viewCare.style.display === 'block') renderCareOptions();
            updateCountdownUI();
        } else STATE.careOptions = CONSTANTS.DEFAULT_CARES;
    });

    colRefs.goals.onSnapshot(snapshot => {
        STATE.goals = {}; snapshot.forEach(doc => { STATE.goals[doc.id] = doc.data(); });
        const viewGoals = document.getElementById('view-goals');
        if (viewGoals && viewGoals.style.display === 'block') renderGoalsTable();
    });
    
    colRefs.edu.onSnapshot(snapshot => {
        STATE.education = []; snapshot.forEach(doc => { STATE.education.push({ id: doc.id, ...doc.data() }); });
        STATE.education.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const viewEdu = document.getElementById('view-education');
        if (viewEdu && viewEdu.style.display === 'block') renderEducationTable();
    });
}

function loadLocalData() {
    STATE.players = JSON.parse(localStorage.getItem('team_players') || '[]');
    STATE.logs = JSON.parse(localStorage.getItem('team_condition_logs') || '[]');
    STATE.logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    STATE.settings = JSON.parse(localStorage.getItem('team_settings') || '{}');
    STATE.broadcasts = JSON.parse(localStorage.getItem('team_broadcasts') || '[]');
    STATE.goals = JSON.parse(localStorage.getItem('team_goals') || '{}');
    STATE.education = JSON.parse(localStorage.getItem('team_education') || '[]');
    renderPlayersList(); updateAdminUI(); updateCountdownUI();
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('target-date').value = today;
    const ym = today.substring(0, 7);
    if(document.getElementById('report-month-select')) document.getElementById('report-month-select').value = ym;
}

function updateCountdownUI() {
    const banner = document.getElementById('countdown-banner');
    if (!banner) return;
    if (!STATE.settings || !STATE.settings.targetEventDate) {
        banner.style.display = 'none'; return;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(STATE.settings.targetEventDate + 'T00:00:00'); target.setHours(0,0,0,0);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
        banner.style.display = 'flex'; banner.style.background = '';
        banner.innerHTML = `🏆 ${STATE.settings.targetEventName || '大会'}まで あと <span class="days">${diffDays}</span> 日！`;
    } else if (diffDays === 0) {
        banner.style.display = 'flex'; banner.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        banner.innerHTML = `🔥 本日は ${STATE.settings.targetEventName || '大会'} 当日です！健闘を祈ります！`;
    } else {
        banner.style.display = 'none'; 
    }
}

// ==========================================
// 📌 4. 計算ロジック (Monotony, Strain, ACWR, IRS)
// ==========================================
function calculateMonotony(logs) {
    const loads = logs.map(l => parseFloat(l.trainingLoad) || 0);
    const totalLoad = loads.reduce((a, b) => a + b, 0);
    const mean = loads.length > 0 ? totalLoad / loads.length : 0;
    const variance = loads.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (loads.length || 1);
    const sd = Math.sqrt(variance);
    const monotony = sd > 0 ? (mean / sd) : 0;
    return { totalLoad, monotony, strain: totalLoad * monotony };
}

function calculateACWR(playerName, targetDateObj) {
    const playerLogs = STATE.logs.filter(l => l.playerName === playerName && l.date);
    if (playerLogs.length === 0) return { ratio: 0, acute: 0, chronic: 0 };

    let acuteLoadSum = 0; let chronicLoadSum = 0;

    playerLogs.forEach(l => {
        const logDateObj = new Date(l.date + 'T00:00:00');
        const diffDays = (targetDateObj - logDateObj) / (1000 * 60 * 60 * 24);
        const load = parseFloat(l.trainingLoad) || 0;
        if (diffDays >= 0 && diffDays < 7) acuteLoadSum += load;
        if (diffDays >= 0 && diffDays < 28) chronicLoadSum += load;
    });

    const acuteAvg = acuteLoadSum / 7;
    const chronicAvg = chronicLoadSum / 28;
    const ratio = chronicAvg > 0 ? (acuteAvg / chronicAvg) : 0;
    
    return { ratio, acute: acuteAvg, chronic: chronicAvg };
}

function calcLogIrs(log, type) {
    let score = 5; 
    const W = CONSTANTS.THRESHOLDS.IRS_WEIGHTS;
    if (!W) return '-';

    if (type === 'pre') {
        if (!log.fatigue && !log.sleep) return '-';
        
        const fatigue = parseInt(log.fatigue) || 1;
        const stress = parseInt(log.stress) || 1;
        const sleep = parseFloat(log.sleep) || 0;
        const sleepQuality = parseInt(log.sleepQuality) || 5;

        if (fatigue >= W.FATIGUE_SEVERE.threshold) score += W.FATIGUE_SEVERE.score; 
        else if (fatigue >= W.FATIGUE_HIGH.threshold) score += W.FATIGUE_HIGH.score; 
        if (stress >= W.STRESS_HIGH.threshold) score += W.STRESS_HIGH.score; 
        if (sleep > 0 && sleep < W.SLEEP_SHORT.threshold) score += W.SLEEP_SHORT.score; 
        else if (sleep > 0 && sleep < W.SLEEP_MED.threshold) score += W.SLEEP_MED.score; 
        if (sleepQuality <= W.QUALITY_LOW.threshold) score += W.QUALITY_LOW.score;

        const sorenessArr = log.soreness ? log.soreness.split(',').map(s => s.trim()).filter(s => s) : [];
        sorenessArr.forEach(part => { 
            if (part === 'ハムストリングス') score += W.SORENESS_HAMSTRING; 
            else if (part === 'カーフ' || part === 'アキレス腱') score += W.SORENESS_CALF_ACHILLES; 
            else if (part === '腸腰筋' || part === '大腿四頭筋' || part === '腰') score += W.SORENESS_QUAD_HIP_LOWER; 
            else if (!W.CRITICAL_PARTS.includes(part)) score += W.SORENESS_OTHER; 
        });
        return `${Math.min(score, 95)}%`;
    } else if (type === 'post') {
        if (!log.rpe && !log.trainingLoad) return '-';

        const rpe = parseFloat(log.rpe) || 0;
        const load = parseFloat(log.trainingLoad) || 0;

        if (rpe >= W.RPE_HIGH.threshold) score += W.RPE_HIGH.score; 
        if (load > W.LOAD_HIGH.threshold) score += W.LOAD_HIGH.score;

        const sorenessPostArr = log.sorenessPost ? log.sorenessPost.split(',').map(s => s.trim()).filter(s => s) : [];
        sorenessPostArr.forEach(part => { 
            if (part === 'ハムストリングス') score += W.SORENESS_HAMSTRING; 
            else if (part === 'カーフ' || part === 'アキレス腱') score += W.SORENESS_CALF_ACHILLES + 5; 
            else if (part === '腸腰筋' || part === '大腿四頭筋' || part === '腰') score += W.SORENESS_QUAD_HIP_LOWER; 
            else if (!W.CRITICAL_PARTS.includes(part)) score += W.SORENESS_OTHER; 
        });
        return `${Math.min(score, 95)}%`;
    }
    return '-';
}

// ==========================================
// 📌 5. ダッシュボード更新・フィルタリング
// ==========================================
function updateAdminUI() {
    updatePeriodFilterOptions(STATE.logs); 
    updatePlayerSelect(); filterAndRenderTable(); updateTodayView();
}

function updatePeriodFilterOptions(logs) {
    const monthlyOptions = document.getElementById('monthly-options');
    if (!monthlyOptions) return;
    monthlyOptions.innerHTML = '';
    const months = new Set();
    logs.forEach(log => { if (log.date) { const ym = log.date.substring(0, 7); if(ym.length === 7) months.add(ym); } });
    const sortedMonths = Array.from(months).sort().reverse();
    sortedMonths.forEach(ym => {
        const parts = ym.split('-');
        const option = document.createElement('option');
        option.value = ym; option.textContent = `${parts[0]}年 ${parseInt(parts[1])}月`;
        monthlyOptions.appendChild(option);
    });
}

function filterAndRenderTable() {
    const periodFilter = document.getElementById('period-filter') ? document.getElementById('period-filter').value : 'all';
    const searchInput = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '';
    const now = new Date();
    
    const getMonday = (date) => {
        const d = new Date(date); const day = d.getDay() || 7; 
        d.setHours(0,0,0,0); d.setDate(d.getDate() - day + 1); return d;
    };

    STATE.filteredLogs = STATE.logs.filter(log => {
        const matchName = (log.playerName || '').toLowerCase().includes(searchInput);
        const matchSoreness = (log.soreness || '').toLowerCase().includes(searchInput) || (log.sorenessPost || '').toLowerCase().includes(searchInput);
        if (!matchName && !matchSoreness) return false;

        if (periodFilter === 'all') return true;
        if (!log.date) return false;
        const d = new Date(log.date + 'T00:00:00');
        
        if (periodFilter === 'this_week') {
            const monday = getMonday(now);
            const nextMonday = new Date(monday); nextMonday.setDate(nextMonday.getDate() + 7);
            return d >= monday && d < nextMonday;
        }
        if (periodFilter === 'last_week') {
            const thisMonday = getMonday(now);
            const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
            return d >= lastMonday && d < thisMonday;
        }
        if (periodFilter === 'this_month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        if (periodFilter === 'last_month') {
            let lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
        }
        if (periodFilter.match(/^\d{4}-\d{2}$/)) return log.date.startsWith(periodFilter);
        return true;
    });
    
    renderTableData(STATE.filteredLogs, 'history-table-body', true);
    
    const viewIndividual = document.getElementById('view-individual'); if (viewIndividual && viewIndividual.style.display === 'block') updateCharts();
    const viewTeamTrend = document.getElementById('view-teamTrend'); if (viewTeamTrend && viewTeamTrend.style.display === 'block') drawTeamTrendChart(STATE.filteredLogs);
    const viewHeatmap = document.getElementById('view-heatmap'); if (viewHeatmap && viewHeatmap.style.display === 'block') updateHeatmap(STATE.filteredLogs);
    const viewSprint = document.getElementById('view-sprint'); if (viewSprint && viewSprint.style.display === 'block') updateSprintRanking();
    const viewFv = document.getElementById('view-fv'); if (viewFv && viewFv.style.display === 'block') updateFvGrouping(STATE.filteredLogs);
}

function updateTodayView() {
    const targetDateStr = document.getElementById('target-date').value;
    const todayLogs = STATE.logs.filter(log => log.date === targetDateStr);
    const expectedPlayers = STATE.players.map(p => p.name);
    const targetPlayers = [...new Set(todayLogs.map(l => l.playerName))];
    const missingPlayers = expectedPlayers.filter(p => !targetPlayers.includes(p));
    
    document.getElementById('summary-missing-count').textContent = `${missingPlayers.length} 名`;
    document.getElementById('summary-missing-list').textContent = missingPlayers.length > 0 ? missingPlayers.join(', ') : '全員完了！✨';
    
    const highFatigue = todayLogs.filter(log => parseInt(log.fatigue) >= CONSTANTS.THRESHOLDS.HIGH_FATIGUE);
    document.getElementById('summary-fatigue').textContent = `${highFatigue.length} 名`;
    document.getElementById('summary-fatigue-list').textContent = highFatigue.map(l => l.playerName).join(', ');
    
    const badSleep = todayLogs.filter(log => {
        const h = parseFloat(log.sleep); const q = parseInt(log.sleepQuality);
        return (h > 0 && h < CONSTANTS.THRESHOLDS.LOW_SLEEP_HOURS) || (q > 0 && q <= CONSTANTS.THRESHOLDS.LOW_SLEEP_QUALITY);
    });
    document.getElementById('summary-sleep').textContent = `${badSleep.length} 名`;
    document.getElementById('summary-sleep-list').textContent = badSleep.map(l => l.playerName).join(', ');

    let highMonotonyPlayers = []; let dangerACWRPlayers = [];
    const targetDateObj = new Date(targetDateStr + 'T00:00:00');
    
    expectedPlayers.forEach(pName => {
        const pLogs = STATE.logs.filter(l => {
            if (l.playerName !== pName || !l.date) return false;
            const logDateObj = new Date(l.date + 'T00:00:00');
            const diffDays = (targetDateObj - logDateObj) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays < 7; 
        });
        const metrics = calculateMonotony(pLogs);
        if (metrics.monotony >= CONSTANTS.THRESHOLDS.MONOTONY_WARNING && metrics.totalLoad > 0) highMonotonyPlayers.push(pName);
        
        const acwr = calculateACWR(pName, targetDateObj);
        if (acwr.ratio >= CONSTANTS.THRESHOLDS.ACWR_DANGER) dangerACWRPlayers.push(pName);
    });
    
    document.getElementById('summary-monotony-count').textContent = `${highMonotonyPlayers.length} 名`;
    document.getElementById('summary-monotony-list').textContent = highMonotonyPlayers.length > 0 ? highMonotonyPlayers.join(', ') : '該当なし';
    
    document.getElementById('summary-acwr-count').textContent = `${dangerACWRPlayers.length} 名`;
    document.getElementById('summary-acwr-list').textContent = dangerACWRPlayers.length > 0 ? dangerACWRPlayers.join(', ') : '該当なし';

    renderTableData(todayLogs, 'today-table-body', false);
}

function updatePlayerSelect() {
    const select = document.getElementById('chart-player-select'); if (!select) return;
    const currentVal = select.value; 
    select.innerHTML = '<option value="">選手を選択</option>';
    STATE.players.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name; option.textContent = p.name;
        if(p.name === currentVal) option.selected = true;
        select.appendChild(option);
    });
    if (!select.value && STATE.players.length > 0) select.value = STATE.players[0].name;
}

// ==========================================
// 📌 6. テーブル描画処理
// ==========================================
function renderTableData(logsToRender, tbodyId, showDate) {
    const tableBody = document.getElementById(tbodyId);
    tableBody.innerHTML = '';
    if (!logsToRender || logsToRender.length === 0) {
         const colspan = showDate ? 18 : 17;
         tableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; font-weight:800; color:var(--text-muted); padding:30px;">記録が見つかりません。</td></tr>`; return;
    }
    
    const displayLogs = [...logsToRender];
    if (showDate) displayLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    displayLogs.forEach(function(log) {
        const tr = document.createElement('tr');
        const fatigueText = (parseInt(log.fatigue) >= CONSTANTS.THRESHOLDS.HIGH_FATIGUE) ? `<span style="color:var(--color-danger);font-weight:900; background:var(--color-danger-light); padding:2px 6px; border-radius:6px;">${log.fatigue} ⚠️</span>` : `<span style="font-weight:800;">${log.fatigue || '-'}</span>`;
        const stressText = (parseInt(log.stress) >= CONSTANTS.THRESHOLDS.HIGH_FATIGUE) ? `<span style="color:var(--color-danger);font-weight:900; background:var(--color-danger-light); padding:2px 6px; border-radius:6px;">${log.stress} ⚠️</span>` : `<span style="font-weight:800;">${log.stress || '-'}</span>`;
        
        let sorenessHtml = log.soreness ? log.soreness.split(',').map(p => p.trim() ? `<span class="tag-text">${p.trim()}</span><br>` : '').join('') : '-';
        let sorenessPostHtml = log.sorenessPost ? log.sorenessPost.split(',').map(p => p.trim() ? `<span class="tag-text-post">${p.trim()}</span><br>` : '').join('') : '-';

        let injuryPreHtml = log.injuryPre ? `<div style="color:var(--secondary); font-size:12px; margin-bottom:4px;"><b>[朝]</b> ${log.injuryPre}</div>` : '';
        let injuryPostHtml = log.injury ? `<div style="color:var(--color-danger); font-size:12px;"><b>[夜]</b> ${log.injury}</div>` : '';
        const injuryCombined = (injuryPreHtml || injuryPostHtml) ? (injuryPreHtml + injuryPostHtml) : '-';

        const sq = Number(log.sleepQuality) || 0;
        const sleepStars = sq > 0 ? '★'.repeat(sq) : '';
        const sleepText = log.sleep ? `<b>${log.sleep}h</b> <span style="color:var(--color-warning); font-size:12px;">(${sleepStars})</span>` : '-';

        let sprintHtml = '';
        let sLogs = log.sprintLogs ? [...log.sprintLogs] : [];
        if (log.sprintDistance && log.sprintDistance !== '未計測' && log.sprintTime) { sLogs.push({ distance: log.sprintDistance, time: log.sprintTime }); }
        if (sLogs.length > 0) {
            sLogs.forEach(s => { sprintHtml += `<span style="color:var(--accent); font-weight:900; display:block; margin-bottom: 2px;">${s.distance}m : ${s.time}s</span>`; });
        } else { sprintHtml = '-'; }

        const irsPreVal = log.irsPre || calcLogIrs(log, 'pre');
        const irsPostVal = log.irsPost || calcLogIrs(log, 'post');
        const irsPre = getIrsBadgeHtml(irsPreVal);
        const irsPost = getIrsBadgeHtml(irsPostVal);

        const catBadge = getCategoryBadge(getPlayerCategory(log.playerName));

        let safeCare = String(log.care || '').replace(/null/g, '').split('/').map(s => s.trim()).filter(s => s !== '').join(' / ');

        const commentBtnClass = log.coachComment ? 'btn-success' : 'btn-info';
        const commentBtnText = log.coachComment ? '💬 編集' : '💬 コメント';

        let html = showDate ? `<td style="font-size:13px; font-weight:800; color:var(--text-muted);">${log.date || ''}</td>` : '';
        html += `
            <td style="font-weight:900; font-size:15px; white-space:nowrap;">${catBadge}${log.playerName || ''}</td>
            <td>${irsPre}</td>
            <td>${irsPost}</td>
            <td>${fatigueText} / ${stressText}</td>
            <td style="font-weight:900; color:var(--primary); font-size:16px;">${log.trainingLoad || ''}</td>
            <td>${sprintHtml}</td>
            <td style="font-weight:800;">${log.rsi || ''}</td>
            <td style="font-weight:800;">${log.fvResult || ''}</td>
            <td>${sorenessHtml}</td>
            <td>${sorenessPostHtml}</td>
            <td style="max-width:200px; white-space:normal; line-height:1.4;">${injuryCombined}</td>
            <td style="font-weight:800;">${log.weight ? log.weight + 'kg' : '-'}</td>
            <td style="font-weight:800;">${log.heartRate || '-'}</td>
            <td style="font-weight:800;">${log.steps || '-'}</td>
            <td>${sleepText}</td>
            <td style="color:var(--accent); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700;" title="${safeCare}">${safeCare || '-'}</td>
            <td style="text-align:center; min-width:90px;">
                <button class="btn btn-info w-full mb-2" style="padding:6px; font-size:12px; background:var(--text-muted); box-shadow:none;" onclick="openDetailModal('${log.playerName}', '${log.date}')">📋 詳細</button>
                <button class="btn ${commentBtnClass} w-full mb-2" style="padding:6px; font-size:12px; box-shadow:none;" onclick="openCommentModal('${log.playerName}', '${log.date}')">${commentBtnText}</button>
                <button class="btn btn-danger w-full" style="padding:6px; font-size:12px; box-shadow:none;" onclick="deleteLog('${log.playerName}', '${log.date}')">削除</button>
            </td>
        `;
        tr.innerHTML = html;
        tableBody.appendChild(tr);
    });
}

function getIrsBadgeHtml(irsStr) {
    if (!irsStr || irsStr === '-' || irsStr === '未計測') return '<span style="color:var(--text-muted); font-weight:800;">-</span>';
    const val = parseInt(irsStr.replace('%', ''));
    if (isNaN(val)) return irsStr;
    let bg = 'var(--color-success)';
    if (val > 75) bg = 'var(--color-danger)';
    else if (val > 50) bg = 'var(--secondary)';
    else if (val > 30) bg = 'var(--color-warning)';
    return `<span style="background-color: ${bg}; color: #fff; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: 900; box-shadow:var(--shadow-sm);">${val}%</span>`;
}

function getPlayerCategory(playerName) {
    const player = STATE.players.find(p => p.name === playerName); return player ? (player.category || 'BLUE') : 'BLUE';
}
function getCategoryBadge(category) {
    let color = 'var(--info)';
    if (category === 'RED') color = 'var(--color-danger)'; if (category === 'YELLOW') color = 'var(--color-warning)';
    return `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${color}; margin-right:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>`;
}

// ==========================================
// 📌 7. ブロードキャスト & 個別コメント
// ==========================================
function openBroadcastModal() { document.getElementById('broadcast-modal').style.display = 'flex'; }
function closeBroadcastModal() { document.getElementById('broadcast-modal').style.display = 'none'; }

function sendBroadcast() {
    const title = document.getElementById('bc-title').value.trim();
    const message = document.getElementById('bc-message').value.trim();
    const level = document.getElementById('bc-level').value;
    const target = document.getElementById('bc-target').value;
    
    if(!title || !message) { UI.showToast('タイトルとメッセージを入力してください', 'warning'); return; }
    
    UI.showConfirm(`この内容で【${target === 'ALL' ? '全員' : target}】へ送信しますか？`, async () => {
        const data = { title, message, level, target, readBy: [], createdAt: new Date().toISOString() };
        try {
            if(colRefs.broadcasts) { await colRefs.broadcasts.add(data); } 
            else {
                STATE.broadcasts.push({id: Date.now().toString(), ...data});
                localStorage.setItem('team_broadcasts', JSON.stringify(STATE.broadcasts));
            }
            UI.showToast('🚀 お知らせを送信しました！', 'success');
            document.getElementById('bc-title').value = ''; document.getElementById('bc-message').value = '';
            closeBroadcastModal();
        } catch(e) { UI.showToast('送信失敗: ' + e.message, 'error'); }
    });
}

function openBroadcastListModal() { renderBroadcastList(); document.getElementById('broadcast-list-modal').style.display = 'flex'; }
function closeBroadcastListModal() { document.getElementById('broadcast-list-modal').style.display = 'none'; }

function renderBroadcastList() {
    const container = document.getElementById('broadcast-list-container');
    container.innerHTML = '';
    if(STATE.broadcasts.length === 0) {
        container.innerHTML = '<p class="text-center" style="color:var(--text-muted); margin-top:40px; font-weight:800;">送信履歴がありません</p>'; return;
    }
    
    STATE.broadcasts.forEach(b => {
        let targetPlayers = [];
        if(b.target === 'ALL') targetPlayers = STATE.players.map(p => p.name);
        else targetPlayers = STATE.players.filter(p => p.category === b.target).map(p => p.name);
        
        const readCount = (b.readBy || []).filter(name => targetPlayers.includes(name)).length;
        const totalCount = targetPlayers.length;
        const unreadPlayers = targetPlayers.filter(name => !(b.readBy || []).includes(name));
        
        const div = document.createElement('div');
        div.style.cssText = "background:var(--input-bg); padding:20px; border-radius:16px; margin-bottom:16px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);";
        div.innerHTML = `
            <div class="flex-between mb-3" style="align-items:flex-start;">
                <div>
                    <span class="status-badge" style="margin-left:0; margin-right:8px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); box-shadow:none;">${b.target}宛</span>
                    <span style="font-weight:900; color:var(--primary); font-size:16px;">${b.title}</span>
                </div>
                <span style="font-size:12px; color:var(--text-muted); font-weight:800;">${new Date(b.createdAt).toLocaleString()}</span>
            </div>
            <div style="font-size:14px; margin-bottom:16px; color:var(--text-main); white-space:pre-wrap; background:var(--card-bg); padding:14px; border-radius:12px; font-weight:600; box-shadow:var(--shadow-sm);">${b.message}</div>
            <div class="flex-between" style="align-items:flex-end;">
                <div>
                    <div style="font-size:15px; font-weight:900; color:var(--accent);">👀 既読: ${readCount} / ${totalCount} 人</div>
                    ${unreadPlayers.length > 0 ? `<div style="font-size:12px; color:var(--color-danger); margin-top:6px; font-weight:700;"><b>未読:</b> ${unreadPlayers.join(', ')}</div>` : `<div style="font-size:12px; color:var(--color-success); margin-top:6px; font-weight:900;">✅ 全員が確認しました！</div>`}
                </div>
                <button class="btn btn-danger" style="padding:6px 12px; font-size:12px; box-shadow:none;" onclick="deleteBroadcast('${b.id}')">削除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function deleteBroadcast(id) {
    UI.showConfirm("このお知らせを削除しますか？<br><span style='font-size:13px; font-weight:600;'>（選手の画面からも消えます）</span>", async () => {
        if(colRefs.broadcasts) await colRefs.broadcasts.doc(id).delete();
        else {
            STATE.broadcasts = STATE.broadcasts.filter(b => b.id !== id);
            localStorage.setItem('team_broadcasts', JSON.stringify(STATE.broadcasts));
            renderBroadcastList();
        }
        UI.showToast("削除しました", "success");
    });
}

let currentCommentTarget = null;
function openCommentModal(playerName, date) {
    currentCommentTarget = { playerName, date };
    const log = STATE.logs.find(l => l.playerName === playerName && l.date === date);
    
    document.getElementById('cm-player').textContent = playerName;
    document.getElementById('cm-date').textContent = `(${date.split('-').slice(1).join('/')})`;
    document.getElementById('cm-good').textContent = log.good || '未入力';
    document.getElementById('cm-bad').textContent = log.bad || '未入力';
    
    document.querySelectorAll('.stamp-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('cm-text').value = '';
    
    if(log.coachComment) {
        document.getElementById('cm-text').value = log.coachComment.text || '';
        if(log.coachComment.stamp) {
            const stampBtn = Array.from(document.querySelectorAll('.stamp-btn')).find(b => b.textContent === log.coachComment.stamp);
            if(stampBtn) stampBtn.classList.add('selected');
        }
    }
    document.getElementById('comment-modal').style.display = 'flex';
}

function closeCommentModal() {
    document.getElementById('comment-modal').style.display = 'none'; currentCommentTarget = null;
}

function openDetailModal(playerName, date) {
    const log = STATE.logs.find(l => l.playerName === playerName && l.date === date);
    if (!log) return;
    document.getElementById('detail-menu').textContent = log.menu || '未入力';
    document.getElementById('detail-good').textContent = log.good || '未入力';
    document.getElementById('detail-bad').textContent = log.bad || '未入力';
    document.getElementById('detail-modal').style.display = 'flex';
}
function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

function selectStamp(btn) {
    document.querySelectorAll('.stamp-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

async function saveCoachComment() {
    if(!currentCommentTarget) return;
    const { playerName, date } = currentCommentTarget;
    const selectedStampBtn = document.querySelector('.stamp-btn.selected');
    const stamp = selectedStampBtn ? selectedStampBtn.textContent : '';
    const text = document.getElementById('cm-text').value.trim();
    
    if(!stamp && !text) { UI.showToast('スタンプかメッセージのどちらかを入力してください', 'warning'); return; }
    
    const docId = `${playerName}_${date}`;
    const coachComment = { stamp, text, updatedAt: new Date().toISOString() };
    
    try {
        if(colRefs.logs) {
            await colRefs.logs.doc(docId).set({ coachComment, playerReadComment: false }, { merge: true });
        } else {
            const idx = STATE.logs.findIndex(l => l.playerName === playerName && l.date === date);
            if(idx > -1) {
                STATE.logs[idx].coachComment = coachComment; STATE.logs[idx].playerReadComment = false;
                localStorage.setItem('team_condition_logs', JSON.stringify(STATE.logs)); updateAdminUI();
            }
        }
        UI.showToast("フィードバックを送信しました！", "success"); closeCommentModal();
    } catch(e) { UI.showToast('保存失敗: ' + e.message, 'error'); }
}

// ==========================================
// 📌 8. 各種分析ビュー描画 (Chart.js 等)
// ==========================================
function drawTeamTrendChart(logs) {
    const ascLogs = [...logs].reverse();
    const dailyData = {};
    ascLogs.forEach(log => {
        if(!dailyData[log.date]) dailyData[log.date] = { loads: [], fatigues: [] };
        if(log.trainingLoad && log.trainingLoad !== '-') dailyData[log.date].loads.push(parseFloat(log.trainingLoad));
        if(log.fatigue) dailyData[log.date].fatigues.push(parseInt(log.fatigue));
    });
    const labels = []; const avgLoads = []; const avgFatigues = [];
    const sortedDates = Object.keys(dailyData).sort();
    sortedDates.forEach(date => {
        labels.push(`${date.split('-')[1]}/${date.split('-')[2]}`);
        const loads = dailyData[date].loads; const fatigues = dailyData[date].fatigues;
        avgLoads.push(loads.length ? loads.reduce((a,b)=>a+b,0)/loads.length : 0);
        avgFatigues.push(fatigues.length ? fatigues.reduce((a,b)=>a+b,0)/fatigues.length : 0);
    });

    const ctx = document.getElementById('teamTrendChart').getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const tickColor = isDark ? '#94a3b8' : '#6b7280'; const gridColor = isDark ? '#333333' : '#e5e7eb';

    if (STATE.charts.teamTrend) {
        STATE.charts.teamTrend.data.labels = labels;
        STATE.charts.teamTrend.data.datasets[0].data = avgLoads;
        STATE.charts.teamTrend.data.datasets[1].data = avgFatigues;
        STATE.charts.teamTrend.options.scales.x.ticks.color = tickColor; STATE.charts.teamTrend.options.scales.x.grid.color = gridColor;
        STATE.charts.teamTrend.options.scales.y.ticks.color = tickColor; STATE.charts.teamTrend.options.scales.y.grid.color = gridColor;
        STATE.charts.teamTrend.options.scales.y1.ticks.color = tickColor;
        STATE.charts.teamTrend.update();
    } else {
        STATE.charts.teamTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '平均 Load', data: avgLoads, backgroundColor: CONSTANTS.COLORS.CHART_LOAD, yAxisID: 'y', type: 'bar', borderRadius:4 },
                    { label: '平均 疲労度', data: avgFatigues, borderColor: CONSTANTS.COLORS.CHART_FATIGUE, type: 'line', borderDash: [5, 5], yAxisID: 'y1', tension: 0.2, borderWidth: 3 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { 
                    x: { ticks: { color: tickColor }, grid: { color: gridColor } },
                    y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } }, 
                    y1: { position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false }, ticks: { color: tickColor } } 
                },
                plugins: { legend: { labels: { color: tickColor } } }
            }
        });
    }
}

function updateCharts() {
    const playerName = document.getElementById('chart-player-select').value;
    if (!playerName) return;
    const baseLogs = STATE.filteredLogs; const playerLogs = baseLogs.filter(log => log.playerName === playerName);
    const recent7Logs = playerLogs.slice(0, 7); const metrics = calculateMonotony([...recent7Logs].reverse());
    
    document.getElementById('stat-total-load').textContent = Math.round(metrics.totalLoad);
    const monEl = document.getElementById('stat-monotony');
    monEl.textContent = metrics.monotony.toFixed(2);
    monEl.style.color = metrics.monotony >= CONSTANTS.THRESHOLDS.MONOTONY_WARNING ? 'var(--color-danger)' : 'var(--text-main)';
    document.getElementById('stat-strain').textContent = Math.round(metrics.strain);

    const todayObj = new Date(); todayObj.setHours(0,0,0,0);
    const acwrMetrics = calculateACWR(playerName, todayObj);
    const acwrEl = document.getElementById('stat-acwr');
    acwrEl.textContent = acwrMetrics.ratio.toFixed(2);
    
    if (acwrMetrics.ratio >= CONSTANTS.THRESHOLDS.ACWR_DANGER) acwrEl.style.color = 'var(--color-danger)';
    else if (acwrMetrics.ratio >= CONSTANTS.THRESHOLDS.ACWR_SWEET_SPOT_MIN && acwrMetrics.ratio <= CONSTANTS.THRESHOLDS.ACWR_SWEET_SPOT_MAX) acwrEl.style.color = 'var(--color-success)';
    else acwrEl.style.color = 'var(--text-main)';

    const recentInjuryList = document.getElementById('player-injury-list');
    recentInjuryList.innerHTML = ''; let hasInjury = false;
    recent7Logs.forEach(log => {
        if(log.injuryPre || log.injury) {
            hasInjury = true;
            let text = `<li style="margin-bottom:8px;"><span style="font-weight:900; color:var(--text-muted); margin-right:8px;">${log.date.split('-').slice(1).join('/')}</span>`;
            if(log.injuryPre) text += `<span style="color:var(--secondary); font-size:12px;"><b>[朝]</b> ${log.injuryPre}</span><br>`;
            if(log.injury) text += `<span style="color:var(--color-danger); font-size:12px;"><b>[夜]</b> ${log.injury}</span>`;
            text += `</li>`;
            recentInjuryList.innerHTML += text;
        }
    });
    if(!hasInjury) recentInjuryList.innerHTML = '<li style="list-style:none; color:var(--text-muted); text-align:center;">ケガ・痛みの報告なし</li>';

    const pSorenessCounts = {};
    recent7Logs.forEach(log => {
        const combinedSoreness = new Set();
        if(log.soreness) log.soreness.split(',').forEach(p => { if(p.trim()) combinedSoreness.add(p.trim()); });
        if(log.sorenessPost) log.sorenessPost.split(',').forEach(p => { if(p.trim()) combinedSoreness.add(p.trim()); });
        combinedSoreness.forEach(part => { pSorenessCounts[part] = (pSorenessCounts[part] || 0) + 1; });
    });
    const pRankingBody = document.getElementById('player-soreness-list'); pRankingBody.innerHTML = '';
    const pSorted = Object.entries(pSorenessCounts).sort((a, b) => b[1] - a[1]);
    if(pSorted.length === 0) pRankingBody.innerHTML = '<li style="list-style:none; color:var(--text-muted); margin-left:-20px; text-align:center;">直近の訴えなし</li>';
    else pSorted.forEach(item => { pRankingBody.innerHTML += `<li style="margin-bottom:4px;"><span style="font-weight:900; color:var(--text-main); margin-right:8px;">${item[0]}</span> <span style="color:var(--primary);">(${item[1]}回)</span></li>`; });

    const chartLogs = playerLogs.slice(0, 30).reverse();
    drawLoadChart(chartLogs); drawRsiChart(chartLogs);
}

function drawLoadChart(logs) {
    const ctx = document.getElementById('loadChart').getContext('2d');
    const labels = logs.map(l => l.date.substring(5)); 
    const loadData = logs.map(l => parseFloat(l.trainingLoad) || 0);
    const fatigueData = logs.map(l => parseInt(l.fatigue) || 0);
    
    const isDark = document.body.classList.contains('dark-mode');
    const tickColor = isDark ? '#94a3b8' : '#6b7280'; const gridColor = isDark ? '#333333' : '#e5e7eb';

    if (STATE.charts.load) {
        STATE.charts.load.data.labels = labels; STATE.charts.load.data.datasets[0].data = loadData; STATE.charts.load.data.datasets[1].data = fatigueData;
        STATE.charts.load.options.scales.x.ticks.color = tickColor; STATE.charts.load.options.scales.x.grid.color = gridColor;
        STATE.charts.load.options.scales.y.ticks.color = tickColor; STATE.charts.load.options.scales.y.grid.color = gridColor;
        STATE.charts.load.options.scales.y1.ticks.color = tickColor;
        STATE.charts.load.options.plugins.title.color = tickColor; STATE.charts.load.options.plugins.legend.labels.color = tickColor;
        STATE.charts.load.update();
    } else {
        STATE.charts.load = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Training Load', data: loadData, backgroundColor: CONSTANTS.COLORS.CHART_LOAD, yAxisID: 'y', order: 2, borderRadius:4 },
                    { label: '疲労度', data: fatigueData, borderColor: CONSTANTS.COLORS.CHART_FATIGUE, backgroundColor: CONSTANTS.COLORS.CHART_FATIGUE, type: 'line', borderDash: [5, 5], yAxisID: 'y1', tension: 0.1, order: 1, borderWidth:3 }
                ]
            },
            plugins: [targetDateLinePlugin],
            options: {
                responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } },
                plugins: { title: { display: true, text: 'Training Load と 疲労度の推移 (直近30回)', color: tickColor, font:{weight:'bold'} }, legend: { labels: { color: tickColor } } },
                scales: {
                    x: { ticks: { color: tickColor }, grid: { color: gridColor } },
                    y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
                    y1: { position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false }, ticks: { color: tickColor } }
                }
            }
        });
    }
}

function drawRsiChart(logs) {
    const ctx = document.getElementById('rsiChart').getContext('2d');
    const labels = logs.map(l => l.date.substring(5));
    const rsiRawData = logs.map(l => parseFloat(l.rsi));
    const validRsiData = rsiRawData.filter(v => !isNaN(v) && v > 0);
    const rsiAvg = validRsiData.length > 0 ? validRsiData.reduce((a,b)=>a+b,0) / validRsiData.length : 0;
    const rsiData = rsiRawData.map(v => (isNaN(v) || v <= 0) ? null : v);
    const rsiAvgLine = labels.map(() => rsiAvg);

    const isDark = document.body.classList.contains('dark-mode');
    const tickColor = isDark ? '#94a3b8' : '#6b7280'; const gridColor = isDark ? '#333333' : '#e5e7eb';

    if (STATE.charts.rsi) {
        STATE.charts.rsi.data.labels = labels; STATE.charts.rsi.data.datasets[0].data = rsiData; STATE.charts.rsi.data.datasets[1].data = rsiAvgLine;
        STATE.charts.rsi.options.scales.x.ticks.color = tickColor; STATE.charts.rsi.options.scales.x.grid.color = gridColor;
        STATE.charts.rsi.options.scales.y.ticks.color = tickColor; STATE.charts.rsi.options.scales.y.grid.color = gridColor;
        STATE.charts.rsi.options.plugins.title.color = tickColor; STATE.charts.rsi.options.plugins.legend.labels.color = tickColor;
        STATE.charts.rsi.update();
    } else {
        STATE.charts.rsi = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'RSI', data: rsiData, borderColor: CONSTANTS.COLORS.CHART_FATIGUE, backgroundColor: CONSTANTS.COLORS.CHART_FATIGUE, tension: 0.2, spanGaps: true, borderWidth:3 },
                    { label: 'RSI 平均', data: rsiAvgLine, borderColor: '#d1d5db', borderDash: [5, 5], pointRadius: 0, borderWidth: 2 }
                ]
            },
            plugins: [targetDateLinePlugin],
            options: {
                responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } },
                plugins: { title: { display: true, text: '神経筋疲労: RSI の推移と平均', color: tickColor, font:{weight:'bold'} }, legend: { labels: { color: tickColor } } },
                scales: { x: { ticks: { color: tickColor }, grid: { color: gridColor } }, y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } } }
            }
        });
    }
}

function updateHeatmap(logs) {
    const sorenessCounts = { "頭部":0, "肩":0, "背中":0, "腰":0, "腹筋":0, "胸部":0, "腕":0, "腸腰筋":0, "臀部":0, "大腿四頭筋":0, "ハムストリングス":0, "カーフ":0, "アキレス腱":0, "足裏":0, "首":0, "胸筋":0, "臀部(お尻)":0, "ふくらはぎ":0 };
    logs.forEach(log => {
        const combinedSoreness = new Set();
        if(log.soreness) log.soreness.split(',').forEach(p => { if(p.trim()) combinedSoreness.add(p.trim()); });
        if(log.sorenessPost) log.sorenessPost.split(',').forEach(p => { if(p.trim()) combinedSoreness.add(p.trim()); });
        combinedSoreness.forEach(part => { if(sorenessCounts[part] !== undefined) sorenessCounts[part]++; });
    });

    if(sorenessCounts["首"] > 0) sorenessCounts["頭部"] += sorenessCounts["首"];
    if(sorenessCounts["胸筋"] > 0) sorenessCounts["胸部"] += sorenessCounts["胸筋"];
    if(sorenessCounts["臀部(お尻)"] > 0) sorenessCounts["臀部"] += sorenessCounts["臀部(お尻)"];
    if(sorenessCounts["ふくらはぎ"] > 0) sorenessCounts["カーフ"] += sorenessCounts["ふくらはぎ"];

    const displayKeys = ["頭部", "肩", "背中", "腰", "腹筋", "胸部", "腕", "腸腰筋", "臀部", "大腿四頭筋", "ハムストリングス", "カーフ", "アキレス腱", "足裏"];
    const maxCount = Math.max(...displayKeys.map(k => sorenessCounts[k]), 0);

    const updateHeatSpot = (id, count) => {
        const el = document.getElementById(id);
        if(el) el.setAttribute('opacity', maxCount > 0 ? (count / maxCount) * 0.85 : 0);
    };

    updateHeatSpot('heat-head-f', sorenessCounts['頭部']); updateHeatSpot('heat-chest', sorenessCounts['胸部']);
    updateHeatSpot('heat-abs', sorenessCounts['腹筋']); updateHeatSpot('heat-arm-l-f', sorenessCounts['腕']); updateHeatSpot('heat-arm-r-f', sorenessCounts['腕']);
    updateHeatSpot('heat-hip-l', sorenessCounts['腸腰筋']); updateHeatSpot('heat-hip-r', sorenessCounts['腸腰筋']);
    updateHeatSpot('heat-quads-l', sorenessCounts['大腿四頭筋']); updateHeatSpot('heat-quads-r', sorenessCounts['大腿四頭筋']);
    updateHeatSpot('heat-head-b', sorenessCounts['頭部']); updateHeatSpot('heat-shoulder-l', sorenessCounts['肩']); updateHeatSpot('heat-shoulder-r', sorenessCounts['肩']);
    updateHeatSpot('heat-back', sorenessCounts['背中']); updateHeatSpot('heat-lower-back', sorenessCounts['腰']); 
    updateHeatSpot('heat-arm-l-b', sorenessCounts['腕']); updateHeatSpot('heat-arm-r-b', sorenessCounts['腕']);
    updateHeatSpot('heat-glutes-l', sorenessCounts['臀部']); updateHeatSpot('heat-glutes-r', sorenessCounts['臀部']);
    updateHeatSpot('heat-hams-l', sorenessCounts['ハムストリングス']); updateHeatSpot('heat-hams-r', sorenessCounts['ハムストリングス']);
    updateHeatSpot('heat-calves-l', sorenessCounts['カーフ']); updateHeatSpot('heat-calves-r', sorenessCounts['カーフ']);
    updateHeatSpot('heat-achilles-l', sorenessCounts['アキレス腱']); updateHeatSpot('heat-achilles-r', sorenessCounts['アキレス腱']);
    updateHeatSpot('heat-sole-l', sorenessCounts['足裏']); updateHeatSpot('heat-sole-r', sorenessCounts['足裏']);

    const rankingBody = document.getElementById('soreness-ranking-body'); rankingBody.innerHTML = '';
    const sortedSoreness = Object.entries(sorenessCounts).filter(item => item[1] > 0 && displayKeys.includes(item[0])).sort((a, b) => b[1] - a[1]); 
    
    if(sortedSoreness.length === 0) {
        rankingBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding: 20px; font-weight:800;">期間中に訴えのある部位はありません</td></tr>';
    } else {
        sortedSoreness.forEach((item, index) => {
            let badge = (index === 0 && item[1] >= 3) ? '<br><span style="color:var(--color-danger); font-size:10px; font-weight:900;">⚠️多発</span>' : '';
            rankingBody.innerHTML += `<tr><td style="font-weight:900; color:var(--text-muted);">${index + 1}</td><td style="font-weight:900; font-size:13px;">${item[0]}${badge}</td><td style="font-weight:900; color:var(--primary); font-size:16px;">${item[1]}</td></tr>`;
        });
    }
}

function updateSprintRanking() {
    const distance = document.getElementById('sprint-ranking-distance').value;
    const rankingBody = document.getElementById('sprint-ranking-body');
    rankingBody.innerHTML = ''; const bestTimes = {};

    STATE.filteredLogs.forEach(log => {
        let sLogs = log.sprintLogs ? [...log.sprintLogs] : [];
        if (log.sprintDistance && log.sprintDistance !== '未計測' && log.sprintTime) sLogs.push({ distance: log.sprintDistance, time: log.sprintTime });
        sLogs.forEach(s => {
            if (s.distance === distance && s.time) {
                const time = parseFloat(s.time);
                if (!isNaN(time) && time > 0) {
                    if (!bestTimes[log.playerName] || time < bestTimes[log.playerName]) bestTimes[log.playerName] = time;
                }
            }
        });
    });

    const sortedPlayers = Object.entries(bestTimes).sort((a, b) => a[1] - b[1]);
    if (sortedPlayers.length === 0) { rankingBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding: 20px; font-weight:800;">この距離の記録はありません</td></tr>'; return; }

    let currentRank = 1, displayRank = 1, previousTime = -1;
    sortedPlayers.forEach((item) => {
        const playerName = item[0], time = item[1];
        if (time !== previousTime) displayRank = currentRank;
        const catBadge = getCategoryBadge(getPlayerCategory(playerName));
        rankingBody.innerHTML += `<tr><td style="font-weight:900; color:var(--text-muted);">${displayRank}</td><td style="font-weight:900; font-size:14px; text-align:left; padding-left:24px; display:flex; align-items:center;">${catBadge}${playerName}</td><td style="font-weight:900; color:var(--secondary); font-size:16px;">${time.toFixed(2)}</td></tr>`;
        previousTime = time; currentRank++;
    });
}

function updateFvGrouping(logs) {
    const latestFvData = {};
    logs.forEach(log => {
        if(log.time30m && log.timeFly20m && parseFloat(log.time30m) > 0 && parseFloat(log.timeFly20m) > 0) {
            if (!latestFvData[log.playerName]) latestFvData[log.playerName] = { t20: parseFloat(log.timeFly20m), t30: parseFloat(log.time30m) };
        }
    });

    const lists = { force: document.getElementById('fv-list-force'), balanced: document.getElementById('fv-list-balanced'), velocity: document.getElementById('fv-list-velocity') };
    Object.values(lists).forEach(el => el.innerHTML = '');
    let counts = { f: 0, b: 0, v: 0 };

    Object.entries(latestFvData).forEach(([playerName, times]) => {
        const ratio = times.t30 / times.t20;
        const tagHtml = `<div class="fv-player-tag">${playerName} <span class="fv-player-ratio">${ratio.toFixed(2)}</span></div>`;
        if (ratio >= CONSTANTS.THRESHOLDS.FV_FORCE_DEFICIT) { lists.force.innerHTML += tagHtml; counts.f++; } 
        else if (ratio <= CONSTANTS.THRESHOLDS.FV_VELOCITY_DEFICIT) { lists.velocity.innerHTML += tagHtml; counts.v++; } 
        else { lists.balanced.innerHTML += tagHtml; counts.b++; }
    });
    const emptyMsg = '<div style="color:var(--text-muted); font-size:13px; font-weight:800; padding: 10px;">該当なし</div>';
    if (counts.f === 0) lists.force.innerHTML = emptyMsg; if (counts.b === 0) lists.balanced.innerHTML = emptyMsg; if (counts.v === 0) lists.velocity.innerHTML = emptyMsg;
}

// ==========================================
// 📌 9. UI 操作（設定・名簿・エクスポート等）
// ==========================================
function toggleTheme() {
    const body = document.body; body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').innerHTML = isDark ? '☀️' : '🌙';
    
    if(STATE.charts.teamTrend) STATE.charts.teamTrend.update();
    if(STATE.charts.load) STATE.charts.load.update();
    if(STATE.charts.rsi) STATE.charts.rsi.update();
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (btn) btn.classList.add('active');
    if(tabId === 'history') backToHistoryMenu();
}

function openHistoryView(viewId) {
    document.getElementById('history-menu').style.display = 'none';
    document.querySelectorAll('.history-view').forEach(el => el.style.display = 'none');
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.style.display = 'block';
    
    if(viewId === 'individual') updateCharts();
    if(viewId === 'goals') renderGoalsTable();
    if(viewId === 'education') renderEducationTable();
    if(viewId === 'teamTrend') drawTeamTrendChart(STATE.filteredLogs);
    if(viewId === 'careSettings') renderCareOptions();
    if(viewId === 'heatmap') updateHeatmap(STATE.filteredLogs);
    if(viewId === 'sprint') updateSprintRanking();
    if(viewId === 'fv') updateFvGrouping(STATE.filteredLogs);
}

function backToHistoryMenu() {
    document.querySelectorAll('.history-view').forEach(el => el.style.display = 'none');
    document.getElementById('history-menu').style.display = 'grid';
}

async function addCareOption() {
    const val = document.getElementById('new-care-input').value.trim();
    if(!val) return;
    const newOptions = [...STATE.careOptions, val];
    if(colRefs.settings) await colRefs.settings.doc('general').set({ careOptions: newOptions }, { merge: true });
    document.getElementById('new-care-input').value = '';
}
function deleteCareOption(index) {
    UI.showConfirm("削除しますか？", async () => {
        const newOptions = [...STATE.careOptions]; newOptions.splice(index, 1);
        if(colRefs.settings) await colRefs.settings.doc('general').set({ careOptions: newOptions }, { merge: true });
        UI.showToast("削除しました", "success");
    });
}
function renderCareOptions() {
    const container = document.getElementById('care-options-container'); container.innerHTML = '';
    STATE.careOptions.forEach((opt, idx) => {
        container.innerHTML += `<div class="tag-text" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:14px; background:var(--card-bg);"><span>${opt}</span><span style="color:var(--color-danger);cursor:pointer;font-weight:900;font-size:20px;line-height:1;" onclick="deleteCareOption(${idx})">×</span></div>`;
    });
}

function renderPlayersList() {
    const list = document.getElementById('registered-players-list'); if(!list) return;
    list.innerHTML = `
        <div class="mb-4"><span style="font-size: 13px; font-weight: 900; color: var(--info); display: block; margin-bottom: 8px;">🟦 BLUE</span><div class="roster-container" id="roster-blue"></div></div>
        <div class="mb-4"><span style="font-size: 13px; font-weight: 900; color: var(--color-danger); display: block; margin-bottom: 8px;">🟥 RED</span><div class="roster-container" id="roster-red"></div></div>
        <div class="mb-2"><span style="font-size: 13px; font-weight: 900; color: var(--color-warning); display: block; margin-bottom: 8px;">🟨 YELLOW</span><div class="roster-container" id="roster-yellow"></div></div>
    `;
    if (STATE.players.length === 0) return;
    STATE.players.forEach(p => {
        const tag = document.createElement('div');
        let targetContainer = document.getElementById('roster-blue');
        if (p.category === 'RED') targetContainer = document.getElementById('roster-red');
        else if (p.category === 'YELLOW') targetContainer = document.getElementById('roster-yellow');
        tag.className = `player-tag`;
        tag.innerHTML = `${p.name} <button class="delete-player-btn" onclick="deletePlayer('${p.id}')">×</button>`;
        targetContainer.appendChild(tag);
    });
}
function addPlayer() {
    const input = document.getElementById('new-player-name'); const catInput = document.getElementById('new-player-category');
    const name = input.value.trim(); if (!name) return;
    if (STATE.players.some(p => p.name === name)) { UI.showToast('登録済みです', 'warning'); return; }
    const data = { name: name, category: catInput.value, createdAt: new Date().toISOString() };
    if (colRefs.players) colRefs.players.add(data);
    input.value = ''; UI.showToast("選手を追加しました", "success");
}
function deletePlayer(id) { UI.showConfirm("削除しますか？", () => { if (colRefs.players) colRefs.players.doc(id).delete(); UI.showToast("削除しました", "success"); }); }

function renderGoalsTable() {
    const tbody = document.getElementById('goals-table-body'); if (!tbody) return; tbody.innerHTML = '';
    if (STATE.players.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; font-weight:800; color:var(--text-muted); padding:30px;">選手が登録されていません。</td></tr>'; return; }

    STATE.players.forEach(player => {
        const tr = document.createElement('tr');
        const catBadge = getCategoryBadge(player.category || 'BLUE');
        const goalData = STATE.goals[player.name] || {};
        const seasonGoal = goalData.seasonGoal || '<span style="color:var(--text-muted);">未設定</span>';
        const monthGoal = goalData.monthGoal || '<span style="color:var(--text-muted);">未設定</span>';

        tr.innerHTML = `
            <td style="font-weight:900; font-size:15px; display:flex; align-items:center;">${catBadge}${player.name}</td>
            <td><div class="flex-between"><div style="white-space:pre-wrap; font-size:14px; font-weight:800; color:var(--secondary);">${seasonGoal}</div><button onclick="editGoalAdmin('${player.name}', 'season')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:18px; padding:0; transition:transform 0.2s;">✎</button></div></td>
            <td><div class="flex-between"><div style="white-space:pre-wrap; font-size:14px; font-weight:800; color:var(--primary);">${monthGoal}</div><button onclick="editGoalAdmin('${player.name}', 'month')" style="background:none; border:none; color:var(--secondary); cursor:pointer; font-size:18px; padding:0; transition:transform 0.2s;">✎</button></div></td>
        `;
        tbody.appendChild(tr);
    });
}

function editGoalAdmin(playerName, type) {
    const goalData = STATE.goals[playerName] || {};
    const currentGoal = type === 'season' ? (goalData.seasonGoal || "") : (goalData.monthGoal || "");
    const title = type === 'season' ? "今シーズンの目標" : "今月の目標・テーマ";
    
    UI.showPrompt(`【${playerName}】選手の ${title} を設定：`, "", currentGoal, async (newGoal) => {
        const updateData = { updatedAt: new Date().toISOString() };
        if (type === 'season') updateData.seasonGoal = newGoal; else updateData.monthGoal = newGoal;
        try {
            if (colRefs.goals) await colRefs.goals.doc(playerName).set(updateData, { merge: true });
            UI.showToast("目標を更新しました", "success");
        } catch (e) { UI.showToast("保存に失敗しました。", "error"); }
    });
}

async function saveTeamSettings() {
    const name = document.getElementById('target-event-name').value.trim();
    const dateStr = document.getElementById('target-event-date').value;
    const updateData = { targetEventName: name, targetEventDate: dateStr, updatedAt: new Date().toISOString() };
    try {
        if (colRefs.settings) await colRefs.settings.doc('general').set(updateData, { merge: true });
        UI.showToast('チームの目標大会を設定しました！', "success");
    } catch(e) { UI.showToast('保存に失敗しました。', "error"); }
}

async function addEducation() {
    const title = document.getElementById('edu-title').value.trim(); const category = document.getElementById('edu-category').value;
    const url = document.getElementById('edu-url').value.trim(); const desc = document.getElementById('edu-desc').value.trim();
    if (!title) { UI.showToast('タイトルを入力してください。', "warning"); return; }
    const data = { title: title, category: category, url: url, description: desc, createdAt: new Date().toISOString() };
    try {
        if (colRefs.edu) await colRefs.edu.add(data);
        document.getElementById('edu-title').value = ''; document.getElementById('edu-url').value = ''; document.getElementById('edu-desc').value = '';
        UI.showToast('コンテンツを追加しました！', "success");
    } catch (e) { UI.showToast('追加に失敗しました。', "error"); }
}

function deleteEducation(id) {
    UI.showConfirm("このコンテンツを削除しますか？", async () => {
        try { if (colRefs.edu) await colRefs.edu.doc(id).delete(); UI.showToast('削除しました', 'success'); } catch (e) { UI.showToast('削除に失敗しました。', "error"); }
    });
}

function renderEducationTable() {
    const tbody = document.getElementById('education-table-body'); if(!tbody) return; tbody.innerHTML = '';
    if (STATE.education.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; font-weight:800; color:var(--text-muted); padding:30px;">コンテンツがありません。</td></tr>'; return; }
    STATE.education.forEach(item => {
        const tr = document.createElement('tr');
        const ytLink = item.url ? `<a href="${item.url}" target="_blank" style="color:var(--primary); font-size:13px; display:inline-block; margin-top:8px; font-weight:900;">🔗 リンクを開く</a>` : '';
        tr.innerHTML = `
            <td><span class="status-badge" style="background:var(--secondary-alpha); color:var(--secondary); margin:0;">${item.category}</span></td>
            <td><strong style="color:var(--secondary); font-size:15px;">${item.title}</strong><br><span style="font-size:13px; color:var(--text-main); white-space:pre-wrap; font-weight:600; display:block; margin-top:4px;">${item.description}</span>${ytLink}</td>
            <td style="text-align:center;"><button class="btn btn-danger" style="padding: 8px 12px; font-size:12px; box-shadow:none;" onclick="deleteEducation('${item.id}')">削除</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteLog(playerName, date) {
    UI.showConfirm(`本当に削除しますか？`, async () => {
        const docId = `${playerName}_${date}`;
        if (colRefs.logs) { await colRefs.logs.doc(docId).delete(); UI.showToast('削除しました', 'success'); }
    });
}

function clearAllData() {
    UI.showConfirm("全データを削除しますか？<br><span style='font-size:13px; color:var(--color-danger);'>※この操作は取り消せません。</span>", async () => {
        if (colRefs.logs) {
            const snapshot = await colRefs.logs.get(); snapshot.docs.forEach(doc => doc.ref.delete()); 
            UI.showToast('全データを削除しました', 'success');
        }
    });
}

function downloadCSV() {
    const logs = STATE.filteredLogs || [];
    if (logs.length === 0) { UI.showToast("ダウンロードするデータがありません。", "warning"); return; }
    let csvContent = '\uFEFF'; 
    const headers = ['日付', '選手名', 'IRS(朝)', 'IRS(夜)', '疲労度', 'ストレス', 'TrainingLoad', 'スプリント1_距離', 'スプリント1_タイム', 'スプリント2_距離', 'スプリント2_タイム', 'スプリント3_距離', 'スプリント3_タイム', 'RSI', 'F-v診断', '朝の筋肉痛・張り', '夜の筋肉痛・張り', '体重(kg)', '心拍数', '歩数', '睡眠時間', '睡眠の質', '朝のケガ詳細', '夜のケガ詳細', 'メニュー', 'できたこと', '課題', '実施したケア', 'コーチコメント'];
    csvContent += headers.join(',') + '\n';

    const exportLogs = [...logs].reverse();
    exportLogs.forEach(log => {
        let sLogs = log.sprintLogs ? [...log.sprintLogs] : [];
        if (log.sprintDistance && log.sprintDistance !== '未計測' && log.sprintTime) sLogs.push({ distance: log.sprintDistance, time: log.sprintTime });
        const s1 = sLogs[0] || { distance: '', time: '' }; const s2 = sLogs[1] || { distance: '', time: '' }; const s3 = sLogs[2] || { distance: '', time: '' };
        const coachCommentText = log.coachComment ? `${log.coachComment.stamp} ${log.coachComment.text}` : '';

        const irsPreVal = log.irsPre || calcLogIrs(log, 'pre');
        const irsPostVal = log.irsPost || calcLogIrs(log, 'post');

        let safeCare = String(log.care || '').replace(/null/g, '').split('/').map(s => s.trim()).filter(s => s !== '').join(' / ');

        const row = [
            log.date, log.playerName, irsPreVal, irsPostVal, log.fatigue, log.stress, log.trainingLoad, 
            s1.distance, s1.time, s2.distance, s2.time, s3.distance, s3.time,
            log.rsi, log.fvResult, log.soreness, log.sorenessPost, log.weight, log.heartRate, log.steps, log.sleep, log.sleepQuality, 
            log.injuryPre || '', log.injury || '', log.menu, log.good, log.bad, safeCare, coachCommentText
        ].map(item => {
            let text = String(item || '').replace(/"/g, '""').replace(/\n/g, ' '); text = text.replace(/<[^>]*>?/gm, ''); return `"${text}"`;
        });
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `AthleSense_Logs.csv`;
    link.style.display = "none"; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function generateMonthlyReport() {
    UI.showToast("PDFレポート作成機能は現在準備中です。今後のアップデートをお待ちください！", "info");
}

document.addEventListener('DOMContentLoaded', initApp);
