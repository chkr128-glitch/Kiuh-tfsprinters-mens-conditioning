// ==========================================
// 📌 AthleSense 選手画面 メインロジック (index.js)
// ==========================================

// 1. 状態管理 (STATE)
// ※ db, colRefs, CONSTANTS は config.js で定義済み
const STATE = {
    logs: [], players: [], goals: {}, settings: {}, education: [], broadcasts: [], kudos: [],
    sorenessPre: [], sorenessPost: [], chartInstance: null, currentEduCat: 'すべて',
    currentUser: null, currentUserCategory: 'BLUE', calYear: new Date().getFullYear(), calMonth: new Date().getMonth()
};

// ==========================================
// 📌 2. ユーティリティ (UI, Haptic)
// ==========================================
const HAPTIC = {
    light: () => { if (navigator.vibrate) navigator.vibrate(10); },
    medium: () => { if (navigator.vibrate) navigator.vibrate(30); },
    success: () => { if (navigator.vibrate) navigator.vibrate([20, 40, 20, 40, 50]); }
};

const UI = {
    toggleDisplay: (id, displayStyle) => { const el = document.getElementById(id); if (el) { el.classList.remove('hidden'); el.style.display = displayStyle; } },
    hideDisplay: (id) => { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.style.display = ''; } },
    showToast: (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        const bgColors = { info: 'var(--info)', success: 'var(--good-text)', warning: 'var(--secondary)', error: 'var(--warning-text)' };
        toast.style.backgroundColor = bgColors[type] || bgColors.info;
        toast.style.color = 'white'; toast.style.padding = '16px 22px'; toast.style.borderRadius = '16px'; 
        toast.style.boxShadow = 'var(--shadow-md)'; toast.style.fontSize = '15px'; toast.style.fontWeight = '800'; 
        toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; toast.style.transition = 'all 0.4s var(--ease-out-expo)'; 
        toast.style.display = 'flex'; toast.style.alignItems = 'center'; toast.style.gap = '12px';
        let icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : 'ℹ️';
        toast.innerHTML = `<span style="font-size:20px;">${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 400); }, 3500);
    },
    showConfirm: (message, onConfirm) => {
        HAPTIC.medium(); const modal = document.getElementById('confirm-modal');
        if (!modal) return;
        document.getElementById('confirm-message').innerHTML = message;
        modal.style.display = 'flex';
        const okBtn = document.getElementById('confirm-ok-btn'); const cancelBtn = document.getElementById('confirm-cancel-btn');
        const newOkBtn = okBtn.cloneNode(true); const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn); cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newOkBtn.onclick = () => { HAPTIC.light(); modal.style.display = 'none'; if(onConfirm) onConfirm(); };
        newCancelBtn.onclick = () => { HAPTIC.light(); modal.style.display = 'none'; };
    },
    showPrompt: (title, desc, initialValue, onSave) => {
        HAPTIC.medium(); const modal = document.getElementById('prompt-modal');
        if (!modal) return;
        document.getElementById('prompt-title').textContent = title;
        document.getElementById('prompt-desc').textContent = desc;
        const input = document.getElementById('prompt-input'); input.value = initialValue;
        modal.style.display = 'flex'; input.focus();
        const okBtn = document.getElementById('prompt-ok-btn'); const cancelBtn = document.getElementById('prompt-cancel-btn');
        const newOkBtn = okBtn.cloneNode(true); const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn); cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newOkBtn.onclick = () => { HAPTIC.light(); modal.style.display = 'none'; if(onSave) onSave(input.value); };
        newCancelBtn.onclick = () => { HAPTIC.light(); modal.style.display = 'none'; };
    }
};

// ==========================================
// 📌 3. 初期化 & Firebase連携
// ==========================================
async function initApp() {
    if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); document.getElementById('theme-toggle').innerHTML = '☀️'; } 
    else { document.getElementById('theme-toggle').innerHTML = '🌙'; }
    
    const today = new Date();
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    STATE.calYear = today.getFullYear(); STATE.calMonth = today.getMonth();
    
    setupEventListeners(); fetchWeather(); checkReminders();

    try {
        firebase.initializeApp(CONSTANTS.FIREBASE_CONFIG); 
        db = firebase.firestore(); 
        db.settings({ experimentalForceLongPolling: true }); 
        await firebase.auth().signInAnonymously();
        
        colRefs = { 
            logs: db.collection('team_condition_logs'), 
            players: db.collection('team_players'), 
            goals: db.collection('team_goals'), 
            settings: db.collection('team_settings'), 
            edu: db.collection('team_education'), 
            broadcasts: db.collection('team_broadcasts'), 
            kudos: db.collection('team_kudos') 
        };
        setupFirebaseListeners(); 
        checkLoginStatus(); 
    } catch (error) {
        console.error("Firebase Error", error); UI.showToast("ローカルモードで起動します。", "warning");
        loadLocalData(); 
        checkLoginStatus(); 
    }
}

function checkLoginStatus() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        STATE.currentUser = savedUser;
        UI.hideDisplay('login-screen'); UI.toggleDisplay('main-app', 'block');
        UI.toggleDisplay('logout-btn', 'flex'); UI.toggleDisplay('notification-btn', 'flex'); UI.toggleDisplay('header-streak-badge', 'flex');
        
        document.querySelectorAll('.display-player-name').forEach(el => el.textContent = STATE.currentUser);
        const me = STATE.players.find(p => p.name === STATE.currentUser); if (me) STATE.currentUserCategory = me.category || 'BLUE';
        
        renderPlayerGoal(); renderCalendar(); calcStreakAndRenderBadge();
        setTimeout(() => { const dInput = document.getElementById('date'); if (dInput) loadFormData(dInput.value); }, 100);
        
        const historyTab = document.getElementById('tab-history');
        if(historyTab && historyTab.classList.contains('active')) { renderPlayerHistory(); renderTeamActivities(); }
        updateBroadcastBanner(); updateNotificationBadge();
    } else {
        UI.toggleDisplay('login-screen', 'flex'); UI.hideDisplay('main-app');
        UI.hideDisplay('logout-btn'); UI.hideDisplay('notification-btn'); UI.hideDisplay('header-streak-badge'); UI.hideDisplay('streak-badge-container');
    }
}

function handleLogin() {
    HAPTIC.medium(); const selectEl = document.getElementById('login-player-select');
    const selectedPlayer = selectEl ? selectEl.value : null;
    if (!selectedPlayer) { UI.showToast("名前を選択してください。", "warning"); return; }
    localStorage.setItem('currentUser', selectedPlayer);
    UI.showToast(`${selectedPlayer} さん、こんにちは！`, "success"); checkLoginStatus();
}

function handleLogout() { UI.showConfirm("ログアウトしますか？", () => { localStorage.removeItem('currentUser'); location.reload(); }); }

function setupFirebaseListeners() {
    if(colRefs.players) { colRefs.players.onSnapshot(snapshot => { STATE.players = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})); updateLoginSelect(); if (STATE.currentUser) { const me = STATE.players.find(p => p.name === STATE.currentUser); if (me) STATE.currentUserCategory = me.category || 'BLUE'; } }); }
    if(colRefs.goals) { colRefs.goals.onSnapshot(snapshot => { STATE.goals = {}; snapshot.forEach(doc => { STATE.goals[doc.id] = doc.data(); }); if(STATE.currentUser) renderPlayerGoal(); }); }
    if(colRefs.settings) { colRefs.settings.doc('general').onSnapshot(doc => { if(doc.exists) { STATE.settings = doc.data(); renderCareTags(); updateCountdownUI(); } else { renderCareTags(); } }); }
    if(colRefs.edu) { colRefs.edu.onSnapshot(snapshot => { STATE.education = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); const eduTab = document.getElementById('tab-education'); if(eduTab && eduTab.classList.contains('active')) renderEducationList(); }); }
    if(colRefs.logs) { colRefs.logs.onSnapshot(snapshot => { STATE.logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)); if(STATE.currentUser) { renderCalendar(); const dInput = document.getElementById('date'); if(dInput) loadFormData(dInput.value); calcStreakAndRenderBadge(); const historyTab = document.getElementById('tab-history'); if(historyTab && historyTab.classList.contains('active')) { renderPlayerHistory(); renderTeamActivities(); } updateNotificationBadge(); } }); }
    if(colRefs.broadcasts) { colRefs.broadcasts.onSnapshot(snapshot => { STATE.broadcasts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); if (STATE.currentUser) { updateBroadcastBanner(); updateNotificationBadge(); } }); }
    if(colRefs.kudos) { colRefs.kudos.onSnapshot(snapshot => { STATE.kudos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); if (STATE.currentUser) { updateNotificationBadge(); renderTeamActivities(); const notiModal = document.getElementById('notification-modal'); if (notiModal && notiModal.style.display === 'flex') { renderNotifications(); } } }); }
}

function loadLocalData() {
    STATE.players = JSON.parse(localStorage.getItem('team_players') || '[]'); updateLoginSelect();
    STATE.logs = JSON.parse(localStorage.getItem('team_condition_logs') || '[]').sort((a, b) => new Date(b.date) - new Date(a.date));
    STATE.goals = JSON.parse(localStorage.getItem('team_goals') || '{}'); STATE.settings = JSON.parse(localStorage.getItem('team_settings') || '{}'); STATE.education = JSON.parse(localStorage.getItem('team_education') || '[]'); STATE.kudos = JSON.parse(localStorage.getItem('team_kudos') || '[]');
    renderCareTags(); updateCountdownUI(); if(STATE.currentUser) { renderPlayerGoal(); renderCalendar(); calcStreakAndRenderBadge(); }
}

// ==========================================
// 📌 4. ロジック・計算処理
// ==========================================
function calcStreakAndRenderBadge() {
    if (!STATE.currentUser) { UI.hideDisplay('header-streak-badge'); UI.hideDisplay('streak-badge-container'); return; }
    UI.toggleDisplay('header-streak-badge', 'flex'); UI.toggleDisplay('streak-badge-container', 'flex');
    const myLogs = STATE.logs.filter(l => l.playerName === STATE.currentUser);
    const iconEl = document.getElementById('header-streak-icon'); const countEl = document.getElementById('header-streak-count'); const textEl = document.getElementById('streak-text');
    if (myLogs.length === 0) { if(iconEl) iconEl.textContent = '🌱'; if(countEl) countEl.textContent = '0'; if(textEl) textEl.innerHTML = `🌱 <b>0</b> 日 (今日からスタート！)`; return; }

    const dates = myLogs.map(l => l.date).sort((a, b) => new Date(b) - new Date(a));
    let streak = 0; let checkDate = new Date(); checkDate.setHours(0,0,0,0);
    const todayStr = checkDate.toISOString().split('T')[0];
    const yesterdayDate = new Date(checkDate); yesterdayDate.setDate(yesterdayDate.getDate() - 1); const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    
    let hasToday = dates.includes(todayStr); let hasYesterday = dates.includes(yesterdayStr);
    if (!hasToday && !hasYesterday) { streak = 0; } else {
        let current = hasToday ? new Date(todayStr) : new Date(yesterdayStr);
        while (true) { const cStr = current.toISOString().split('T')[0]; if (dates.includes(cStr)) { streak++; current.setDate(current.getDate() - 1); } else break; }
    }
    let icon = streak >= 181 ? '🏵' : streak >= 91 ? '🎖' : streak >= 31 ? '💎' : streak >= 15 ? '❤️‍🔥' : streak >= 1 ? '🔥' : '🌱';
    if(iconEl) iconEl.textContent = icon; if(countEl) countEl.textContent = streak; if(textEl) textEl.innerHTML = `${icon} <b>${streak}</b> 日連続！`;
}

function checkSprintRank(el) {
    updateAIAdvicePost(); const row = el.closest('.sprint-row'); if (!row) return;
    const distInput = row.querySelector('.sprint-dist-input'); const timeInput = row.querySelector('.sprint-time-input'); const badgeEl = row.querySelector('.sprint-rank-badge');
    if(!distInput || !timeInput || !badgeEl) return;
    const dist = distInput.value; const time = parseFloat(timeInput.value);
    if (!dist || isNaN(time) || time <= 0 || !STATE.currentUser) { badgeEl.textContent = ''; return; }
    
    const myLogs = STATE.logs.filter(l => l.playerName === STATE.currentUser); let allTimes = [];
    myLogs.forEach(log => { if (log.sprintLogs) { log.sprintLogs.forEach(s => { if (s.distance === dist && s.time) { const t = parseFloat(s.time); if (t > 0) allTimes.push(t); } }); } });
    if (allTimes.length === 0) { badgeEl.textContent = '🥇'; badgeEl.title = '初記録！'; HAPTIC.success(); return; }
    allTimes.sort((a, b) => a - b);
    const pb = allTimes[0]; const sb = allTimes[1] !== undefined ? allTimes[1] : 999; const tb = allTimes[2] !== undefined ? allTimes[2] : 999;
    
    if (time <= pb) { badgeEl.textContent = '🥇'; badgeEl.title = '自己ベスト!'; HAPTIC.success(); } 
    else if (time <= sb) { badgeEl.textContent = '🥈'; badgeEl.title = 'セカンドベスト!'; } 
    else if (time <= tb) { badgeEl.textContent = '🥉'; badgeEl.title = 'サードベスト!'; } 
    else { badgeEl.textContent = ''; badgeEl.title = ''; }
}

// ==========================================
// 📌 5. イベントリスナー設定 & 保存処理
// ==========================================
function setupEventListeners() {
    const elFatigue = document.getElementById('fatigue'); const elStress = document.getElementById('stress'); const elRpe = document.getElementById('rpe'); const elDuration = document.getElementById('duration');
    if(elFatigue) elFatigue.addEventListener('input', () => { HAPTIC.light(); updateFaceMeter('fatigue-display', elFatigue.value, 'fatigue'); updateAIAdvicePre(); });
    if(elStress) elStress.addEventListener('input', () => { HAPTIC.light(); updateFaceMeter('stress-display', elStress.value, 'stress'); updateAIAdvicePre(); });
    if(elRpe) elRpe.addEventListener('input', () => { HAPTIC.light(); calcLoad(); });
    if(elDuration) elDuration.addEventListener('input', calcLoad);
    
    document.querySelectorAll('input[name="sleep-quality"], #sleep, #weight').forEach(el => { el.addEventListener('change', updateAIAdvicePre); });
    const preInj = document.getElementById('injury-pre'); if(preInj) preInj.addEventListener('input', updateAIAdvicePre); 
    const postInj = document.getElementById('injury'); if(postInj) postInj.addEventListener('input', updateAIAdvicePost); 
    const badInp = document.getElementById('bad'); if(badInp) badInp.addEventListener('input', updateAIAdvicePost);
    
    document.querySelectorAll('.tag-btn-pre').forEach(btn => {
        btn.addEventListener('click', function() { HAPTIC.light(); const part = this.getAttribute('data-part'); if (STATE.sorenessPre.includes(part)) { STATE.sorenessPre = STATE.sorenessPre.filter(p => p !== part); this.classList.remove('selected'); } else { STATE.sorenessPre.push(part); this.classList.add('selected'); } updateAIAdvicePre(); });
    });
    document.querySelectorAll('.tag-btn-post').forEach(btn => {
        btn.addEventListener('click', function() { HAPTIC.light(); const part = this.getAttribute('data-part'); if (STATE.sorenessPost.includes(part)) { STATE.sorenessPost = STATE.sorenessPost.filter(p => p !== part); this.classList.remove('selected'); } else { STATE.sorenessPost.push(part); this.classList.add('selected'); } updateAIAdvicePost(); });
    });
}

function validatePreData() {
    const sleepEl = document.getElementById('sleep'); if(!sleepEl) return true;
    const sleep = parseFloat(sleepEl.value);
    if (isNaN(sleep) || sleep < 0 || sleep > 24) { UI.showToast('睡眠時間は0〜24の範囲で入力してください', 'error'); return false; }
    if (!document.querySelector('input[name="sleep-quality"]:checked')) { UI.showToast('「睡眠の質」の星を選択してください', 'error'); return false; }
    const weightEl = document.getElementById('weight'); if(weightEl) { const weight = parseFloat(weightEl.value); if (!isNaN(weight) && (weight < 20 || weight > 200)) { UI.showToast('体重は正しい数値を入力してください', 'error'); return false; } }
    const hrEl = document.getElementById('heart-rate'); if(hrEl) { const hr = parseInt(hrEl.value); if (!isNaN(hr) && (hr < 30 || hr > 220)) { UI.showToast('心拍数は正しい数値を入力してください', 'error'); return false; } }
    return true;
}

function validatePostData() {
    const durEl = document.getElementById('duration'); if(!durEl) return true;
    const duration = parseFloat(durEl.value);
    if (isNaN(duration) || duration <= 0 || duration > 1440) { UI.showToast('Loadを計算するため、正しい「運動時間(分)」を入力してください', 'error'); return false; }
    return true;
}

async function saveData(type) {
    HAPTIC.medium(); const playerName = STATE.currentUser; const dateInput = document.getElementById('date');
    if(!playerName || !dateInput) { UI.showToast("ログイン状態か日付を確認してください", "error"); return; }
    const date = dateInput.value;
    if (type === 'pre' && !validatePreData()) return; if (type === 'post' && !validatePostData()) return;
    
    const btn = document.querySelector(`#form-${type} .btn-primary`); 
    if(btn) { btn.disabled = true; btn.textContent = '保存中...'; }

    const docId = `${playerName}_${date}`; let partialData = { playerName: playerName, date: date, updatedAt: new Date().toISOString() }; let isPB = false;
    try {
        if(type === 'pre') {
            const sqNode = document.querySelector('input[name="sleep-quality"]:checked'); partialData.sleep = document.getElementById('sleep').value; partialData.sleepQuality = sqNode ? sqNode.value : ''; partialData.weight = document.getElementById('weight').value; partialData.heartRate = document.getElementById('heart-rate').value; partialData.fatigue = document.getElementById('fatigue').value; partialData.stress = document.getElementById('stress').value; partialData.soreness = STATE.sorenessPre.join(', '); partialData.injuryPre = document.getElementById('injury-pre').value; 
        } else {
            partialData.duration = document.getElementById('duration').value; partialData.rpe = document.getElementById('rpe').value; partialData.trainingLoad = document.getElementById('load-result').textContent; partialData.sprintLogs = getSprintData(); partialData.rsi = document.getElementById('rsi').value; partialData.time30m = document.getElementById('time-30m').value; partialData.timeFly20m = document.getElementById('time-fly20m').value; partialData.fvResult = document.getElementById('fv-result').value; partialData.menu = document.getElementById('menu').value; partialData.steps = document.getElementById('steps').value; partialData.good = document.getElementById('good').value; partialData.bad = document.getElementById('bad').value; partialData.injury = document.getElementById('injury').value; partialData.sorenessPost = STATE.sorenessPost.join(', ');
            let selectedCares = []; document.querySelectorAll('.care-tag.selected').forEach(el => selectedCares.push(el.textContent)); const freeTextCare = document.getElementById('care').value; partialData.care = selectedCares.length > 0 ? selectedCares.join(' / ') + (freeTextCare ? ' / ' + freeTextCare : '') : freeTextCare;
            const myLogs = STATE.logs.filter(l => l.playerName === playerName && l.date !== date); 
            const pbResult = checkPersonalBestAll(partialData.sprintLogs, playerName, myLogs); isPB = pbResult.isBest; partialData.pbDistances = isPB ? pbResult.pbList : [];
        }
        if(colRefs.logs) { await colRefs.logs.doc(docId).set(partialData, { merge: true }); } 
        else {
            let savedLogs = JSON.parse(localStorage.getItem('team_condition_logs') || '[]'); let existingIndex = savedLogs.findIndex(log => log.playerName === playerName && log.date === date);
            if (existingIndex > -1) savedLogs[existingIndex] = { ...savedLogs[existingIndex], ...partialData }; else savedLogs.push(partialData);
            localStorage.setItem('team_condition_logs', JSON.stringify(savedLogs)); loadLocalData();
        }
        if(type === 'pre') { UI.showToast('🌅 朝のデータを保存しました！', 'success'); HAPTIC.success(); } 
        else { UI.showToast('🌙 夜のデータを保存しました！', 'success'); if (isPB) { confetti(); UI.showToast('🎉 自己ベスト更新おめでとうございます！！', 'success'); HAPTIC.success(); } else { HAPTIC.success(); } }
        renderCalendar(); calcStreakAndRenderBadge();
    } catch (error) { UI.showToast("保存に失敗しました", "error"); } 
    finally { if(btn) { btn.disabled = false; btn.textContent = type === 'pre' ? '選択した日の「朝」を保存' : '選択した日の「夜」を保存'; } }
}

function checkPersonalBestAll(newSprints, playerName, otherLogs) {
    let isBest = false; let pbList = []; const bestTimes = {};
    otherLogs.forEach(log => { let sLogs = log.sprintLogs || []; sLogs.forEach(s => { const t = parseFloat(s.time); if (t > 0 && (!bestTimes[s.distance] || t < bestTimes[s.distance])) bestTimes[s.distance] = t; }); });
    newSprints.forEach(ns => { const t = parseFloat(ns.time); if (t > 0) { if (!bestTimes[ns.distance] || t < bestTimes[ns.distance]) { isBest = true; if(!pbList.includes(ns.distance)) pbList.push(ns.distance); } } });
    return { isBest, pbList };
}

// ==========================================
// 📌 6. UI更新・表示ロジック
// ==========================================
function updateLoginSelect() { const select = document.getElementById('login-player-select'); if(!select) return; select.innerHTML = '<option value="" disabled selected>名前を選択してください ▼</option>'; STATE.players.forEach(p => { const opt = document.createElement('option'); opt.value = p.name; opt.textContent = p.name; select.appendChild(opt); }); }
function renderPlayerGoal() { const playerName = STATE.currentUser; const container = document.getElementById('goal-container'); if (!playerName || !container) { if(container) container.style.display = 'none'; return; } container.style.display = 'block'; const goalData = STATE.goals[playerName] || {}; const sText = document.getElementById('season-goal-text'); if(sText) sText.textContent = goalData.seasonGoal || "目標を設定しよう！"; const mText = document.getElementById('month-goal-text'); if(mText) mText.textContent = goalData.monthGoal || "今月のテーマを設定しよう！"; }
function toggleTheme() { HAPTIC.light(); document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('theme', isDark ? 'dark' : 'light'); const tToggle = document.getElementById('theme-toggle'); if(tToggle) tToggle.innerHTML = isDark ? '☀️' : '🌙'; }
function switchTab(tabId, btn) { HAPTIC.light(); document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active')); const targetTab = document.getElementById(`tab-${tabId}`); if(targetTab) targetTab.classList.add('active'); if(btn) btn.classList.add('active'); if(tabId === 'history') { renderPlayerHistory(); renderTeamActivities(); } }
function updateFaceMeter(id, value, type) { const el = document.getElementById(id); if(!el) return; let emoji = ""; const v = parseFloat(value); if (type === 'fatigue') emoji = v <= 2 ? "😆" : v <= 4 ? "🙂" : v <= 6 ? "😐" : v <= 8 ? "🥵" : "💀"; else if (type === 'stress') emoji = v <= 2 ? "😌" : v <= 4 ? "🙂" : v <= 6 ? "😐" : v <= 8 ? "😫" : "🤯"; else if (type === 'rpe') emoji = v <= 2 ? "🚶‍♂️" : v <= 4 ? "🏃‍♂️" : v <= 6 ? "💦" : v <= 8 ? "🥵" : "🤮"; el.textContent = `${emoji} ${type === 'rpe' ? v.toFixed(1) : v}`; }
function calcLoad() { const durEl = document.getElementById('duration'); const rpeEl = document.getElementById('rpe'); if(!durEl || !rpeEl) return; const d = parseFloat(durEl.value) || 0; const r = parseFloat(rpeEl.value) || 0; updateFaceMeter('rpe-display', r, 'rpe'); const loadRes = document.getElementById('load-result'); if(loadRes) loadRes.textContent = (d > 0 && r > 0) ? (d * r).toFixed(1) : '-'; updateAIAdvicePost(); }
function calcFv() { const t30El = document.getElementById('time-30m'); const t20El = document.getElementById('time-fly20m'); if(!t30El || !t20El) return; const t30 = parseFloat(t30El.value); const t20 = parseFloat(t20El.value); const display = document.getElementById('fv-display'); const hiddenInput = document.getElementById('fv-result'); if (t30 > 0 && t20 > 0) { const ratio = t30 / t20; let result = ratio >= CONSTANTS.THRESHOLDS.FV_FORCE_DEFICIT ? '力不足' : ratio <= CONSTANTS.THRESHOLDS.FV_VELOCITY_DEFICIT ? '速度不足' : 'バランス型'; if(display) display.textContent = `${result} (${ratio.toFixed(2)})`; if(hiddenInput) hiddenInput.value = result; } else { if(display) display.textContent = '-'; if(hiddenInput) hiddenInput.value = ''; } }
function addSprintRow(dist = '', time = '') { HAPTIC.light(); const container = document.getElementById('sprint-rows-container'); const template = document.getElementById('sprint-row-template'); if(!container || !template) return; const clone = template.content.cloneNode(true); if(dist) { const dInput = clone.querySelector('.sprint-dist-input'); const tInput = clone.querySelector('.sprint-time-input'); if(dInput) dInput.value = dist; if(tInput) tInput.value = time; if(tInput) setTimeout(() => checkSprintRank(tInput), 50); } container.appendChild(clone); }
function getSprintData() { const arr = []; document.querySelectorAll('.sprint-row').forEach(row => { const dist = row.querySelector('.sprint-dist-input').value; const time = row.querySelector('.sprint-time-input').value; if (dist && time) arr.push({ distance: dist, time: time }); }); return arr; }

function renderCalendar() {
    if(!STATE.currentUser) return;
    const gridEl = document.getElementById('calendar-grid'); if(!gridEl) return; gridEl.innerHTML = ''; 
    const calMY = document.getElementById('calendar-month-year'); if(calMY) calMY.textContent = `${STATE.calYear}年 ${STATE.calMonth + 1}月`;
    const firstDay = new Date(STATE.calYear, STATE.calMonth, 1).getDay(); const daysInMonth = new Date(STATE.calYear, STATE.calMonth + 1, 0).getDate(); const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`; 
    const dInput = document.getElementById('date'); const selectedDateStr = dInput ? dInput.value : '';

    for (let i = 0; i < firstDay; i++) { const emptyDiv = document.createElement('div'); emptyDiv.className = 'calendar-day empty'; gridEl.appendChild(emptyDiv); }
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div'); const currentDateStr = `${STATE.calYear}-${String(STATE.calMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`; dayDiv.className = 'calendar-day'; dayDiv.textContent = i;
        if (currentDateStr === todayStr) dayDiv.classList.add('today'); if (currentDateStr === selectedDateStr) dayDiv.classList.add('selected');
        const log = STATE.logs.find(l => l.playerName === STATE.currentUser && l.date === currentDateStr);
        if (log) {
            const fatigue = parseInt(log.fatigue) || 1; if (fatigue >= 7) dayDiv.classList.add('bg-red'); else if (fatigue >= 4) dayDiv.classList.add('bg-yellow'); else dayDiv.classList.add('bg-green');
            if (log.injuryPre || log.injury) { dayDiv.classList.add('has-injury'); const icon = document.createElement('div'); icon.className = 'injury-icon'; icon.textContent = '⚠️'; dayDiv.appendChild(icon); }
            if (log.coachComment) { const commentIcon = document.createElement('div'); commentIcon.className = 'comment-icon'; commentIcon.textContent = '💬'; dayDiv.appendChild(commentIcon); }
        }
        dayDiv.onclick = () => selectDate(currentDateStr); gridEl.appendChild(dayDiv);
    }
}

function selectDate(dateStr) { HAPTIC.light(); const dInput = document.getElementById('date'); if(dInput) dInput.value = dateStr; renderCalendar(); const parts = dateStr.split('-'); const displayStr = `${parts[1]}/${parts[2]}`; const dispPre = document.getElementById('display-date-pre'); const dispPost = document.getElementById('display-date-post'); if(dispPre) dispPre.textContent = `[ ${displayStr} ]`; if(dispPost) dispPost.textContent = `[ ${displayStr} ]`; const log = STATE.logs.find(l => l.playerName === STATE.currentUser && l.date === dateStr); showDailySummary(dateStr, log); }

function loadFormData(dateStr) {
    const log = STATE.logs.find(l => l.playerName === STATE.currentUser && l.date === dateStr); 
    const fPre = document.getElementById('form-pre'); if(fPre) fPre.reset(); 
    const fPost = document.getElementById('form-post'); if(fPost) fPost.reset(); 
    document.querySelectorAll('.tag-btn, .care-tag').forEach(el => el.classList.remove('selected')); 
    const srCont = document.getElementById('sprint-rows-container'); if(srCont) srCont.innerHTML = ''; 
    const fvDisp = document.getElementById('fv-display'); if(fvDisp) fvDisp.textContent = '-'; 
    const lRes = document.getElementById('load-result'); if(lRes) lRes.textContent = '-'; 
    
    const fat = document.getElementById('fatigue'); if(fat) fat.value = 1; 
    const str = document.getElementById('stress'); if(str) str.value = 1; 
    const rpe = document.getElementById('rpe'); if(rpe) rpe.value = 5; 
    STATE.sorenessPre = []; STATE.sorenessPost = [];

    if (log) {
        const slp = document.getElementById('sleep'); if (slp && log.sleep) slp.value = log.sleep; 
        if (log.sleepQuality) { const sq = document.getElementById(`star${log.sleepQuality}-pre`); if (sq) sq.checked = true; } 
        const wt = document.getElementById('weight'); if (wt && log.weight) wt.value = log.weight; 
        const hr = document.getElementById('heart-rate'); if (hr && log.heartRate) hr.value = log.heartRate; 
        if (fat && log.fatigue) fat.value = log.fatigue; 
        if (str && log.stress) str.value = log.stress; 
        const injPre = document.getElementById('injury-pre'); if (injPre && log.injuryPre) injPre.value = log.injuryPre;
        if (log.soreness) { STATE.sorenessPre = log.soreness.split(',').map(p => p.trim()); document.querySelectorAll('.tag-btn-pre').forEach(btn => { if (STATE.sorenessPre.includes(btn.getAttribute('data-part'))) btn.classList.add('selected'); }); }
        
        const dur = document.getElementById('duration'); if (dur && log.duration) dur.value = log.duration; 
        if (rpe && log.rpe) rpe.value = log.rpe; 
        const rsi = document.getElementById('rsi'); if (rsi && log.rsi) rsi.value = log.rsi; 
        const t30 = document.getElementById('time-30m'); if (t30 && log.time30m) t30.value = log.time30m; 
        const t20 = document.getElementById('time-fly20m'); if (t20 && log.timeFly20m) t20.value = log.timeFly20m; 
        const injPost = document.getElementById('injury'); if (injPost && log.injury) injPost.value = log.injury; 
        const menu = document.getElementById('menu'); if (menu && log.menu) menu.value = log.menu; 
        const steps = document.getElementById('steps'); if (steps && log.steps) steps.value = log.steps; 
        const good = document.getElementById('good'); if (good && log.good) good.value = log.good; 
        const bad = document.getElementById('bad'); if (bad && log.bad) bad.value = log.bad;
        
        if (log.sprintLogs) { log.sprintLogs.forEach(s => addSprintRow(s.distance, s.time)); }
        if (log.sorenessPost) { STATE.sorenessPost = log.sorenessPost.split(',').map(p => p.trim()); document.querySelectorAll('.tag-btn-post').forEach(btn => { if (STATE.sorenessPost.includes(btn.getAttribute('data-part'))) btn.classList.add('selected'); }); }
        if (log.care) { const cares = log.care.split(' / ').map(c => c.trim()).filter(c => c !== 'null' && c !== ''); document.querySelectorAll('.care-tag').forEach(btn => { if (cares.includes(btn.textContent)) { btn.classList.add('selected'); cares.splice(cares.indexOf(btn.textContent), 1); } }); if (cares.length > 0 && cares[0] !== "") { const careEl = document.getElementById('care'); if(careEl) careEl.value = cares.join(' / '); } }
    }
    if(fat) updateFaceMeter('fatigue-display', fat.value, 'fatigue'); 
    if(str) updateFaceMeter('stress-display', str.value, 'stress'); 
    if(rpe) updateFaceMeter('rpe-display', rpe.value, 'rpe'); 
    calcLoad(); calcFv(); updateAIAdvicePre(); updateAIAdvicePost();
}

function renderCareTags() { const container = document.getElementById('care-tags'); if (!container) return; container.innerHTML = ''; (STATE.settings.careOptions || CONSTANTS.DEFAULT_CARES).forEach(careText => { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tag-btn care-tag'; btn.textContent = careText; btn.onclick = () => { HAPTIC.light(); btn.classList.toggle('selected'); }; container.appendChild(btn); }); }

function renderPlayerHistory() {
    const playerName = STATE.currentUser; if(!playerName) return;
    const histSec = document.getElementById('history-section'); if(histSec) histSec.style.display = 'block'; const myLogs = STATE.logs.filter(log => log.playerName === playerName);
    const distEl = document.getElementById('my-sprint-distance'); if(!distEl) return; const dist = distEl.value; const bestTimes = {};
    STATE.logs.forEach(log => { let sLogs = log.sprintLogs || []; sLogs.forEach(s => { if(s.distance === dist && s.time) { const t = parseFloat(s.time); if(t > 0 && (!bestTimes[log.playerName] || t < bestTimes[log.playerName])) bestTimes[log.playerName] = t; } }); });
    const sorted = Object.entries(bestTimes).sort((a,b)=>a[1]-b[1]); const myBest = bestTimes[playerName];
    const mbTime = document.getElementById('my-best-time'); const mtRank = document.getElementById('my-team-rank');
    if(myBest) { if(mbTime) mbTime.textContent = myBest.toFixed(2) + ' 秒'; let rank = 1, prev = -1, dispRank = 1, myRank=1; sorted.forEach(i => { if(i[1] !== prev) dispRank = rank; if(i[0] === playerName) myRank = dispRank; prev = i[1]; rank++; }); if(mtRank) mtRank.textContent = myRank + ' 位'; } 
    else { if(mbTime) mbTime.textContent = '- 秒'; if(mtRank) mtRank.textContent = '- 位'; }

    if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById('player-chart');
        if (ctx) {
            const recentLogs = [...myLogs].slice(0, 7).reverse(); const labels = recentLogs.map(log => log.date ? log.date.split('-').slice(1).join('/') : '不明'); const loadData = recentLogs.map(log => parseFloat(log.trainingLoad) || 0); const fatigueData = recentLogs.map(log => parseInt(log.fatigue) || 0);
            const isDark = document.body.classList.contains('dark-mode'); const tickColor = isDark ? '#94a3b8' : '#6b7280'; const gridColor = isDark ? '#333333' : '#e5e7eb';
            if (STATE.chartInstance) { STATE.chartInstance.data.labels = labels; STATE.chartInstance.data.datasets[0].data = loadData; STATE.chartInstance.data.datasets[1].data = fatigueData; STATE.chartInstance.options.scales.x.ticks.color = tickColor; STATE.chartInstance.options.scales.x.grid.color = gridColor; STATE.chartInstance.options.scales.y.ticks.color = tickColor; STATE.chartInstance.options.scales.y.grid.color = gridColor; STATE.chartInstance.options.scales.y1.ticks.color = tickColor; STATE.chartInstance.options.plugins.title.color = tickColor; STATE.chartInstance.options.plugins.legend.labels.color = tickColor; STATE.chartInstance.update(); } 
            else {
                STATE.chartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'Training Load', data: loadData, borderColor: '#f97316', backgroundColor: '#f97316', yAxisID: 'y', tension: 0.4 }, { label: '疲労度', data: fatigueData, borderColor: '#ec4899', backgroundColor: '#ec4899', borderDash: [5, 5], yAxisID: 'y1', tension: 0.4 } ] }, options: { responsive: true, plugins: { title: { display: true, text: '最近のコンディション推移 (最大7日間)', color: tickColor }, legend: { labels: { color: tickColor } } }, scales: { x: { ticks: { color: tickColor }, grid: { color: gridColor } }, y: { beginAtZero: true, position: 'left', ticks: { color: tickColor }, grid: { color: gridColor } }, y1: { beginAtZero: true, min: 0, max: 10, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: tickColor } } } } });
            }
        }
    }
}

function renderTeamActivities() {
    const container = document.getElementById('team-activity-list'); if (!container) return; container.innerHTML = '';
    const otherLogs = STATE.logs.filter(l => l.playerName !== STATE.currentUser && l.trainingLoad).slice(0, 15);
    if (otherLogs.length === 0) { container.innerHTML = '<div class="text-center" style="color:var(--text-muted); padding:20px; font-size:14px; font-weight:bold;">まだチームメイトの活動がありません</div>'; return; }
    otherLogs.forEach(log => {
        const div = document.createElement('div'); div.className = 'glass-card'; div.style.padding = '18px'; div.style.marginBottom = '14px';
        let titleHtml = `<strong style="color:var(--primary);">${log.playerName}</strong> さんが練習を完了しました！`;
        if (log.pbDistances && log.pbDistances.length > 0) { titleHtml = `🎉 <strong style="color:var(--primary);">${log.playerName}</strong> さんが <b>${log.pbDistances.join(', ')}m</b> で自己ベストを更新しました！`; }
        const sentKudos = STATE.kudos.filter(k => k.logDate === log.date && k.target === log.playerName && k.sender === STATE.currentUser);
        const mySentStamp = sentKudos.length > 0 ? sentKudos[0].stamp : null;
        div.innerHTML = `
            <div style="font-size:13px; color:var(--text-muted); margin-bottom:6px; font-weight:bold;">${log.date.replace(/-/g, '/')}</div>
            <div style="font-size:15px; color:var(--text-main); margin-bottom:14px; line-height:1.5;">${titleHtml}</div>
            <div class="flex-row-gap">
                <span style="font-size:13px; color:var(--text-muted); font-weight:bold; margin-right:6px;">エールを送る:</span>
                <button class="kudos-btn ${mySentStamp === '👏' ? 'selected' : ''}" onclick="sendKudos('${log.playerName}', '👏', '${log.date}')">👏</button>
                <button class="kudos-btn ${mySentStamp === '🔥' ? 'selected' : ''}" onclick="sendKudos('${log.playerName}', '🔥', '${log.date}')">🔥</button>
                <button class="kudos-btn ${mySentStamp === '💪' ? 'selected' : ''}" onclick="sendKudos('${log.playerName}', '💪', '${log.date}')">💪</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function sendKudos(target, stamp, logDate) {
    HAPTIC.medium(); const sender = STATE.currentUser; if (!sender) return;
    const existingIndex = STATE.kudos.findIndex(k => k.logDate === logDate && k.target === target && k.sender === sender);
    const kudoData = { sender, target, stamp, logDate, isRead: false, createdAt: new Date().toISOString() };
    try {
        if (colRefs.kudos) {
            if (existingIndex > -1) { const docId = STATE.kudos[existingIndex].id; await colRefs.kudos.doc(docId).update({ stamp, isRead: false, createdAt: new Date().toISOString() }); } 
            else { await colRefs.kudos.add(kudoData); }
        } else {
            if (existingIndex > -1) { STATE.kudos[existingIndex].stamp = stamp; STATE.kudos[existingIndex].isRead = false; } 
            else { STATE.kudos.push({ id: Date.now().toString(), ...kudoData }); }
            localStorage.setItem('team_kudos', JSON.stringify(STATE.kudos));
        }
        UI.showToast(`${target}さんにエールを送りました！`, 'success'); renderTeamActivities();
    } catch(e) { UI.showToast('送信に失敗しました', 'error'); }
}

function getUnreadKudos() { return STATE.kudos.filter(k => k.target === STATE.currentUser && !k.isRead); }
async function markKudosAsRead() {
    const unread = getUnreadKudos();
    unread.forEach(async k => {
        if(colRefs.kudos) { try { await colRefs.kudos.doc(k.id).update({ isRead: true }); } catch(e){} } 
        else { k.isRead = true; localStorage.setItem('team_kudos', JSON.stringify(STATE.kudos)); }
    });
}

function fetchWeather() {
    const locText = document.getElementById('location-text'), tempText = document.getElementById('temp-text'), adviceBox = document.getElementById('weather-advice');
    if (!navigator.geolocation) { if(locText) locText.textContent = "GPS未対応"; if(adviceBox) adviceBox.innerHTML = "※天候アドバイスを利用できません。"; return; }
    if(locText) locText.textContent = "取得中...";
    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude, lon = position.coords.longitude;
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ja`).then(res => res.json()).then(geo => { if(locText) locText.textContent = `${geo.locality || geo.city || "現在地"} 付近の天候`; }).catch(() => { if(locText) locText.textContent = "現在地の天候"; });
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`).then(res => res.json()).then(data => {
            const temp = data.current_weather.temperature; const code = data.current_weather.weathercode;
            let weatherCategory = "晴れ"; let weatherIcon = "☀️";
            if (code <= 1) { weatherCategory = "晴れ"; weatherIcon = "☀️"; } else if (code <= 3 || code === 45 || code === 48) { weatherCategory = "くもり"; weatherIcon = "☁️"; } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95)) { weatherCategory = "雨"; weatherIcon = "🌧️"; } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) { weatherCategory = "雪"; weatherIcon = "❄️"; }
            let tempCategory = "あたたか";
            if (temp >= 35) tempCategory = "猛暑"; else if (temp >= 25) tempCategory = "夏日"; else if (temp >= 15) tempCategory = "あたたか"; else if (temp >= 5) tempCategory = "寒い"; else tempCategory = "激寒";
            const overlay = document.getElementById('weather-overlay'); 
            if(overlay) {
                overlay.className = 'weather-overlay';
                if (weatherCategory === '晴れ') overlay.classList.add('w-sunny'); else if (weatherCategory === 'くもり') overlay.classList.add('w-cloudy'); else if (weatherCategory === '雨') overlay.classList.add('w-rainy'); else if (weatherCategory === '雪') overlay.classList.add('w-snowy');
                if (tempCategory === '猛暑' || tempCategory === '夏日') overlay.classList.add('t-hot'); else if (tempCategory === '寒い' || tempCategory === '激寒') overlay.classList.add('t-cold');
            }
            if(tempText) tempText.innerHTML = `<span style="font-size:18px; margin-right:6px;">${weatherIcon}</span>${temp} ℃`;
            let advice = "";
            if(tempCategory === "猛暑") advice = "🥵 <b>【猛暑・熱中症警戒】</b>危険な暑さです。練習前・中・後の水分と塩分補給を徹底し、日陰での休憩を！"; else if(tempCategory === "夏日") advice = "💦 <b>【夏日・脱水注意】</b>発汗量が増え、水分を失うと出力が落ちます。喉が渇く前に水分補給を。"; else if(tempCategory === "あたたか") advice = "😊 <b>【あたたか・適温】</b>スプリントに適した良い気候です。質の高い出力にフォーカスしましょう。"; else if(tempCategory === "寒い") advice = "🧥 <b>【寒い・ウォーミングアップ】</b>体が温まるまで時間がかかります。動的ストレッチを長めに取りましょう。"; else if(tempCategory === "激寒") advice = "🥶 <b>【激寒・肉離れ警戒】</b>筋肉が硬直しやすいです。急激な出力は危険！アップを念入りに、保温を徹底！";
            if(adviceBox) adviceBox.innerHTML = advice;
        }).catch(() => { if(adviceBox) adviceBox.innerHTML = "※通信エラーのため天気情報が取得できませんでした。"; });
    }, () => { if(locText) locText.textContent = "GPS未許可"; if(adviceBox) adviceBox.innerHTML = "※位置情報を許可すると対策アドバイスが表示されます。"; });
}

function updateIRSUIDisplay(type, rawScore) {
    let score = Math.min(rawScore, 95); const fillEl = document.getElementById(`irs-bar-${type}`); const valEl = document.getElementById(`irs-value-${type}`); const statusEl = document.getElementById(`irs-status-${type}`);
    if(!fillEl || !valEl || !statusEl) return;
    valEl.textContent = `${score}%`; fillEl.style.width = `${score}%`;
    if (score <= 30) { fillEl.style.backgroundColor = "var(--good-text)"; statusEl.style.color = "var(--good-text)"; statusEl.textContent = "🟢 安全圏 (Normal)"; } 
    else if (score <= 50) { fillEl.style.backgroundColor = "#f59e0b"; statusEl.style.color = "#f59e0b"; statusEl.textContent = "🟡 注意 (Caution)"; } 
    else if (score <= 75) { fillEl.style.backgroundColor = "#ea580c"; statusEl.style.color = "#ea580c"; statusEl.textContent = "🟠 警戒 (Warning)"; } 
    else { fillEl.style.backgroundColor = "var(--warning-text)"; statusEl.style.color = "var(--warning-text)"; statusEl.textContent = "🔴 危険 (Danger)"; }
}

function calculateIRS(type) {
    let score = 5; const W = CONSTANTS.THRESHOLDS.IRS_WEIGHTS;
    if(type === 'pre') {
        const fatEl = document.getElementById('fatigue'); const strEl = document.getElementById('stress'); const slpEl = document.getElementById('sleep');
        const fatigue = fatEl ? parseInt(fatEl.value) || 1 : 1; const stress = strEl ? parseInt(strEl.value) || 1 : 1; const sleep = slpEl ? parseFloat(slpEl.value) || 0 : 0; const sqNode = document.querySelector('input[name="sleep-quality"]:checked'); const sleepQuality = sqNode ? parseInt(sqNode.value) : 5; 
        if (fatigue >= W.FATIGUE_SEVERE.threshold) score += W.FATIGUE_SEVERE.score; else if (fatigue >= W.FATIGUE_HIGH.threshold) score += W.FATIGUE_HIGH.score; if (stress >= W.STRESS_HIGH.threshold) score += W.STRESS_HIGH.score; if (sleep > 0 && sleep < W.SLEEP_SHORT.threshold) score += W.SLEEP_SHORT.score; else if (sleep > 0 && sleep < W.SLEEP_MED.threshold) score += W.SLEEP_MED.score; if (sleepQuality <= W.QUALITY_LOW.threshold) score += W.QUALITY_LOW.score;
        STATE.sorenessPre.forEach(part => { if (part === 'ハムストリングス') score += W.SORENESS_HAMSTRING; else if (part === 'カーフ' || part === 'アキレス腱') score += W.SORENESS_CALF_ACHILLES; else if (part === '腸腰筋' || part === '大腿四頭筋' || part === '腰') score += W.SORENESS_QUAD_HIP_LOWER; else if (!W.CRITICAL_PARTS.includes(part)) score += W.SORENESS_OTHER; });
        updateIRSUIDisplay('pre', score);
    } else if (type === 'post') {
        const rpeEl = document.getElementById('rpe'); const loadRes = document.getElementById('load-result');
        const rpe = rpeEl ? parseFloat(rpeEl.value) || 0 : 0; const loadText = loadRes ? loadRes.textContent : '-'; const load = loadText !== '-' ? parseFloat(loadText) : 0;
        if (rpe >= W.RPE_HIGH.threshold) score += W.RPE_HIGH.score; if (load > W.LOAD_HIGH.threshold) score += W.LOAD_HIGH.score;
        STATE.sorenessPost.forEach(part => { if (part === 'ハムストリングス') score += W.SORENESS_HAMSTRING; else if (part === 'カーフ' || part === 'アキレス腱') score += W.SORENESS_CALF_ACHILLES + 5; else if (part === '腸腰筋' || part === '大腿四頭筋' || part === '腰') score += W.SORENESS_QUAD_HIP_LOWER; else if (!W.CRITICAL_PARTS.includes(part)) score += W.SORENESS_OTHER; });
        updateIRSUIDisplay('post', score);
    }
}

function updateAIAdvicePre() {
    calculateIRS('pre'); 
    const fatEl = document.getElementById('fatigue'); const slpEl = document.getElementById('sleep'); const injEl = document.getElementById('injury-pre');
    const fatigue = fatEl ? parseInt(fatEl.value) || 1 : 1; const sleep = slpEl ? parseFloat(slpEl.value) || 0 : 0; const sqNode = document.querySelector('input[name="sleep-quality"]:checked'); const sleepQuality = sqNode ? parseInt(sqNode.value) : 5; const injuryPreText = injEl ? injEl.value || '' : ''; let advices = [];
    if (sleep > 0 && sleep < 7) advices.push("💤 <b>【睡眠不足アラート】</b><br>睡眠が7時間未満の場合、<b>ケガのリスクが約1.7倍</b>に跳ね上がり、反応速度も低下します。今日の練習は集中力を高め、終了後は早めに寝るよう計画してください。"); else if (sleepQuality <= 2) advices.push("💤 <b>【睡眠の質低下】</b><br>長く寝ても質が悪いと神経系の疲労が抜けません。アップでは「リラックス」を意識してください。");
    if (STATE.sorenessPre.includes('ハムストリングス')) advices.push("💡 <b>【ハムの張り】</b><br>練習前に仰向けで足を上げ、無理のない範囲で静的な収縮を入れて痛みの度合いをチェックしてください。"); if (STATE.sorenessPre.includes('腸腰筋') || STATE.sorenessPre.includes('大腿四頭筋')) advices.push("💡 <b>【前ももの張り】</b><br>ブレーキ動作が多くなっているか、骨盤が後傾気味です。アップで大臀筋（お尻）にスイッチを入れるドリルを多めに行いましょう。"); if (STATE.sorenessPre.includes('カーフ') || STATE.sorenessPre.includes('アキレス腱') || STATE.sorenessPre.includes('足裏')) advices.push("💡 <b>【足部・下腿の疲労】</b><br>接地時のバネ組織が疲労しています。今日は過度な跳躍や反発ドリルは控えめにするのが無難です。"); if (STATE.sorenessPre.includes('腕')) advices.push("💡 <b>【腕の張り】</b><br>スプリント時の腕振りやウエイトの影響が考えられます。肩甲骨周りのストレッチを行い、上半身の連動性を保ちましょう。"); if (STATE.sorenessPre.includes('腰')) advices.push("💡 <b>【腰の張り】</b><br>体幹の疲労や衝撃吸収の低下が考えられます。アップでは股関節の可動域を広げ、腰に過度な負担をかけない動きを意識してください。");
    if (fatigue >= 8) advices.push("⚠️ <b>【過労警告】</b><br>起床時から強い疲労があります。高強度のスプリントは避け、回復走や技術確認に留める勇気を持つことも重要です。"); if (injuryPreText.length > 0) advices.push("🚑 <b>【痛み・ケガの報告あり】</b><br>具体的な痛みの報告があります。今日の練習は無理をせず、まずは監督やコーチに状態を相談してください。");
    const box = document.getElementById('ai-advice-pre'); if (!box) return;
    if (advices.length === 0) { box.innerHTML = "✨ <b>【Good!】</b> 起床時の状態は良好です。天候に合わせたウォームアップを行い、今日の目標にフォーカスしましょう！"; box.style.borderLeftColor = "#10b981"; } else { box.innerHTML = advices.join("<hr style='border-top:1px dashed var(--border-color); margin:12px 0;'>"); box.style.borderLeftColor = "#f59e0b"; }
}

function updateAIAdvicePost() {
    calculateIRS('post'); 
    const lRes = document.getElementById('load-result'); const rpeEl = document.getElementById('rpe');
    const loadText = lRes ? lRes.textContent : '-'; const rpe = rpeEl ? parseFloat(rpeEl.value) || 0 : 0; let advices = [];
    if (loadText !== '-' && parseFloat(loadText) > 600) advices.push("🔥 <b>【ハイロード警告】</b><br>今日の負荷は非常に高いです。筋肉のグリコーゲンが枯渇しているため、練習後30分以内に炭水化物とタンパク質を必ず摂取してください。"); if (rpe >= 8) advices.push("🥵 <b>【高RPEへの対応】</b><br>かなりキツイ練習でした。神経系が興奮しているため、今夜はぬるめのお湯に浸かり、副交感神経を優位にしてリラックスしましょう。"); if (getSprintData().length >= 3) advices.push("🏃‍♂️ <b>【スプリント過多注意】</b><br>複数回のスプリント計測を行いました。脳へのダメージが大きいため、明日は爆発的なメニューを避けるのが理想的です。");
    if (STATE.sorenessPost.includes('ハムストリングス')) advices.push("💡 <b>【ハムのケア】</b><br>スプリントで最も酷使される部位です。強い張りがある場合は無理にストレッチせず、アイシング等で熱を抜き、その後交代浴やお風呂で血流を促しましょう。"); if (STATE.sorenessPost.includes('腸腰筋') || STATE.sorenessPost.includes('大腿四頭筋')) advices.push("💡 <b>【前もも・股関節のケア】</b><br>ブレーキ動作で疲労しています。お風呂上がりに股関節の前側をゆっくり伸ばす静的ストレッチや、フォームローラーが有効です。"); if (STATE.sorenessPost.includes('カーフ') || STATE.sorenessPost.includes('アキレス腱') || STATE.sorenessPost.includes('足裏')) advices.push("💡 <b>【足部・下腿のケア】</b><br>衝撃でふくらはぎや足底が硬くなっています。テニスボール等で足裏をほぐし、ふくらはぎは下から上へ優しくマッサージしてください。"); if (STATE.sorenessPost.includes('臀部')) advices.push("💡 <b>【お尻のケア】</b><br>推進力を生む大きな筋肉が疲労しています。ボールをお尻の下に置いて自重でリリースしたり、仰向けで膝を抱えるストレッチで張りをとりましょう。"); if (STATE.sorenessPost.includes('背中') || STATE.sorenessPost.includes('肩') || STATE.sorenessPost.includes('腕')) advices.push("💡 <b>【上半身のケア】</b><br>腕振りや体幹の固定による疲労です。胸椎の伸展や、肩甲骨周りのストレッチを行い、上半身の力みをリセットしましょう。"); if (STATE.sorenessPost.includes('腰')) advices.push("💡 <b>【腰のケア】</b><br>着地衝撃やウエイトで腰背部に負担がかかっています。両膝を抱えるストレッチや、湯船でしっかり温めて血流を良くしましょう。");
    const injEl = document.getElementById('injury'); const badEl = document.getElementById('bad');
    const injuryText = injEl ? injEl.value || '' : ''; const badText = badEl ? badEl.value || '' : ''; if(injuryText.length > 0 || badText.includes('痛') || badText.includes('違和感')) advices.push("🚑 <b>【痛みへの対処】</b><br>痛みを伴う違和感がある場合、無理なストレッチはかえって炎症を悪化させます。様子を見て安静にしてください。");
    const box = document.getElementById('ai-advice-post'); if (!box) return;
    if (advices.length === 0) { box.innerHTML = "✨ <b>【お疲れ様でした】</b><br>適度な負荷の練習でした。入力した「実施するケア」を必ず実行し、明日に備えてしっかり睡眠を取りましょう！"; box.style.borderLeftColor = "#10b981"; } else { box.innerHTML = advices.join("<hr style='border-top:1px dashed var(--border-color); margin:12px 0;'>"); box.style.borderLeftColor = "#3b82f6"; }
}

function handleEditGoal(type) {
    const playerName = STATE.currentUser; if (!playerName) { UI.showToast("ログインし直してください！", "error"); return; }
    const goalData = STATE.goals[playerName] || {}; const currentGoal = type === 'season' ? (goalData.seasonGoal || "") : (goalData.monthGoal || ""); const title = type === 'season' ? "今シーズンの目標" : "今月の目標・テーマ"; const desc = "目標を設定してモチベーションを高めよう！";
    UI.showPrompt(title, desc, currentGoal, async (newGoal) => {
        const updateData = { updatedAt: new Date().toISOString() }; if (type === 'season') updateData.seasonGoal = newGoal; else updateData.monthGoal = newGoal;
        try { if (colRefs.goals) { await colRefs.goals.doc(playerName).set(updateData, { merge: true }); } else { STATE.goals[playerName] = { ...goalData, ...updateData }; localStorage.setItem('team_goals', JSON.stringify(STATE.goals)); renderPlayerGoal(); } UI.showToast("目標を更新しました！", "success"); } catch (e) { UI.showToast("目標の保存に失敗しました。", "error"); }
    });
}

function handleSyncDeviceData(itemName) { UI.showToast(`Webブラウザの制限により「${itemName}」の自動取得は開発準備中です。お手持ちのデバイスの数値を確認して入力してください！`, "warning"); }

function toggleNotifications(checkbox) {
    const statusText = document.getElementById('notification-status'); if(!statusText) return;
    if(checkbox.checked) {
        statusText.style.display = 'block'; if (!("Notification" in window)) { UI.showToast("ブラウザが通知非対応です。", "error"); checkbox.checked = false; return; }
        Notification.requestPermission().then(permission => {
            if (permission === "granted") { statusText.textContent = "✅ 通知が許可されました！"; localStorage.setItem('reminder_enabled', 'true'); new Notification("AthleSense", { body: "通知設定が完了しました！", icon: "icon.png" }); } else { statusText.textContent = "❌ 通知がブロックされました。"; checkbox.checked = false; }
        });
    } else { statusText.style.display = 'none'; localStorage.setItem('reminder_enabled', 'false'); }
}

function checkReminders() {
    const isEnabled = localStorage.getItem('reminder_enabled') === 'true'; const toggle = document.getElementById('notification-toggle'); if(toggle) toggle.checked = isEnabled;
    const check = () => {
        if(localStorage.getItem('reminder_enabled') === 'true' && window.Notification && Notification.permission === "granted") {
            const now = new Date(); const hour = now.getHours(); const today = now.getDate().toString(); const lastRemindedPre = localStorage.getItem('last_reminder_pre');
            if(hour >= 7 && hour < 12 && lastRemindedPre !== today) { new Notification("AthleSense", { body: "🌅 おはようございます！朝のコンディションを入力しましょう！", icon: "icon.png" }); localStorage.setItem('last_reminder_pre', today); }
            const lastRemindedPost = localStorage.getItem('last_reminder_post');
            if(hour >= 20 && lastRemindedPost !== today) { new Notification("AthleSense", { body: "🌙 夜になりました。今日の記録とケアを入力しましょう！", icon: "icon.png" }); localStorage.setItem('last_reminder_post', today); }
        }
    };
    check(); if(!window.reminderInterval) { window.reminderInterval = setInterval(check, 60000); }
}

function getMyBroadcasts() { return STATE.broadcasts.filter(b => b.target === 'ALL' || b.target === STATE.currentUserCategory); }
function getUnreadBroadcasts() { const myBroadcasts = getMyBroadcasts(); return myBroadcasts.filter(b => !(b.readBy && b.readBy.includes(STATE.currentUser))); }
function getUnreadComments() { return STATE.logs.filter(log => log.playerName === STATE.currentUser && log.coachComment && !log.playerReadComment); }

function updateNotificationBadge() {
    const unreadBroadcastCount = getUnreadBroadcasts().length; const unreadCommentCount = getUnreadComments().length; const unreadKudosCount = getUnreadKudos().length; const totalUnread = unreadBroadcastCount + unreadCommentCount + unreadKudosCount;
    const badge = document.getElementById('notification-badge'); if(!badge) return;
    if (totalUnread > 0) { badge.textContent = totalUnread > 9 ? '9+' : totalUnread; UI.toggleDisplay('notification-badge', 'flex'); } else { UI.hideDisplay('notification-badge'); }
}

function updateBroadcastBanner() {
    const unreadBroadcasts = getUnreadBroadcasts(); const banner = document.getElementById('broadcast-banner'); if(!banner) return;
    if (unreadBroadcasts.length === 0) { banner.style.display = 'none'; return; }
    unreadBroadcasts.sort((a, b) => { const lScore = { 'danger': 3, 'warning': 2, 'info': 1 }; const scoreA = lScore[a.level || 'info'] || 1; const scoreB = lScore[b.level || 'info'] || 1; if (scoreA !== scoreB) return scoreB - scoreA; return new Date(b.createdAt) - new Date(a.createdAt); });
    const topMsg = unreadBroadcasts[0]; const levelDef = CONSTANTS.LEVELS[topMsg.level || 'info'];
    banner.className = `broadcast-banner ${levelDef.bgClass}`; 
    const bBadge = document.getElementById('broadcast-level-badge'); if(bBadge) { bBadge.className = `b-badge ${levelDef.bgClass}`; bBadge.textContent = levelDef.label; }
    const bTitle = document.getElementById('broadcast-title'); if(bTitle) bTitle.textContent = topMsg.title; 
    const bMsg = document.getElementById('broadcast-message'); if(bMsg) bMsg.textContent = topMsg.message;
    const btn = document.getElementById('broadcast-confirm-btn'); if(btn) btn.onclick = () => markBroadcastAsRead(topMsg.id);
    banner.style.display = 'block';
}

async function markBroadcastAsRead(broadcastId) { const banner = document.getElementById('broadcast-banner'); if(banner) banner.style.display = 'none'; if (!colRefs.broadcasts) return; try { await colRefs.broadcasts.doc(broadcastId).update({ readBy: firebase.firestore.FieldValue.arrayUnion(STATE.currentUser) }); } catch (e) { console.error(e); } }
async function markCommentAsRead(dateStr) { if (!colRefs.logs) return; const docId = `${STATE.currentUser}_${dateStr}`; try { await colRefs.logs.doc(docId).update({ playerReadComment: true }); } catch (e) { console.error(e); } }

function openNotificationModal() { const mod = document.getElementById('notification-modal'); if(mod) mod.style.display = 'flex'; renderNotifications(); const unreadComments = getUnreadComments(); unreadComments.forEach(log => markCommentAsRead(log.date)); markKudosAsRead(); const badge = document.getElementById('notification-badge'); if(badge) badge.style.display = 'none'; }
function closeNotificationModal() { const mod = document.getElementById('notification-modal'); if(mod) mod.style.display = 'none'; updateNotificationBadge(); updateBroadcastBanner(); }

function renderNotifications() {
    const broadcastContainer = document.getElementById('notification-broadcast-list'); const commentContainer = document.getElementById('notification-comment-list'); const kudosContainer = document.getElementById('notification-kudos-list');
    if(broadcastContainer) {
        broadcastContainer.innerHTML = ''; const myBroadcasts = getMyBroadcasts();
        if (myBroadcasts.length === 0) { broadcastContainer.innerHTML = '<div style="font-size:14px; color:var(--text-muted); text-align:center; font-weight:bold;">お知らせはありません</div>'; } 
        else { myBroadcasts.forEach(b => { const isRead = b.readBy && b.readBy.includes(STATE.currentUser); const div = document.createElement('div'); div.className = `noti-item ${isRead ? '' : 'unread'}`; const d = new Date(b.createdAt); const timeStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; const levelDef = CONSTANTS.LEVELS[b.level || 'info']; div.innerHTML = `<div class="flex-between mb-2"><span class="b-badge ${levelDef.bgClass}" style="margin:0; font-size:11px; padding:3px 8px;">${levelDef.label}</span><span style="font-size:12px; font-weight:bold; color:var(--text-muted);">${timeStr}</span></div><h4 style="margin:0 0 6px 0; font-size:16px; color:var(--text-main); font-weight:900;">${b.title}</h4><p style="margin:0; font-size:14px; color:var(--text-main); white-space:pre-wrap; font-weight:500;">${b.message}</p>${!isRead ? `<button class="btn-sync mt-3 w-full justify-center" onclick="markBroadcastAsRead('${b.id}'); setTimeout(()=>renderNotifications(), 500);">確認済みにする</button>` : ''}`; broadcastContainer.appendChild(div); }); }
    }
    if(commentContainer) {
        commentContainer.innerHTML = ''; const myLogsWithComments = STATE.logs.filter(log => log.playerName === STATE.currentUser && log.coachComment);
        if (myLogsWithComments.length === 0) { commentContainer.innerHTML = '<div style="font-size:14px; color:var(--text-muted); text-align:center; font-weight:bold;">フィードバックはまだありません</div>'; } 
        else { myLogsWithComments.sort((a, b) => { const dateA = a.coachComment.updatedAt ? new Date(a.coachComment.updatedAt) : new Date(a.date); const dateB = b.coachComment.updatedAt ? new Date(b.coachComment.updatedAt) : new Date(b.date); return dateB - dateA; }); myLogsWithComments.forEach(log => { const div = document.createElement('div'); div.className = `noti-item`; const parts = log.date.split('-'); const dateStr = `${parts[1]}/${parts[2]}`; div.innerHTML = `<div class="flex-between" style="border-bottom:1px dashed var(--border-color); padding-bottom:8px; margin-bottom:12px;"><span style="font-size:13px; font-weight:900; color:var(--primary);">${dateStr} の記録について</span><button style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:6px; font-size:12px; padding:4px 8px; cursor:pointer; color:var(--text-muted); font-weight:bold;" onclick="closeNotificationModal(); selectDate('${log.date}');">詳細を見る</button></div><div style="display:flex; gap:14px; align-items:flex-start;"><div style="font-size:36px; line-height:1; text-shadow:0 2px 4px rgba(0,0,0,0.1);">${log.coachComment.stamp || ''}</div><div style="font-size:14px; color:var(--text-main); font-weight:600; white-space:pre-wrap; padding-top:6px;">${log.coachComment.text || ''}</div></div>`; commentContainer.appendChild(div); }); }
    }
    if(kudosContainer) { 
        kudosContainer.innerHTML = ''; const myKudos = STATE.kudos.filter(k => k.target === STATE.currentUser); 
        if (myKudos.length === 0) { kudosContainer.innerHTML = '<div style="font-size:14px; color:var(--text-muted); text-align:center; font-weight:bold;">もらったKudosはまだありません</div>'; } 
        else { myKudos.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(k => { const div = document.createElement('div'); div.className = `noti-item ${k.isRead ? '' : 'unread'}`; const d = new Date(k.createdAt); const timeStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; div.innerHTML = `<div class="flex-between mb-2"><span style="font-size:14px; font-weight:900; color:var(--primary);">👏 Kudos!</span><span style="font-size:12px; font-weight:bold; color:var(--text-muted);">${timeStr}</span></div><div style="font-size:15px; color:var(--text-main); font-weight:800; display:flex; align-items:center; gap:8px;"><span style="font-size:24px;">${k.stamp}</span> <span>${k.sender} さんからエールが届きました！</span></div>`; kudosContainer.appendChild(div); }); } 
    }
}

function updateCountdownUI() {
    const banner = document.getElementById('countdown-banner'); if (!banner) return;
    if (!STATE.settings || !STATE.settings.targetEventDate) { banner.style.display = 'none'; return; }
    const today = new Date(); today.setHours(0,0,0,0); const target = new Date(STATE.settings.targetEventDate + 'T00:00:00'); target.setHours(0,0,0,0); const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) { banner.style.display = 'flex'; banner.innerHTML = `🏆 ${STATE.settings.targetEventName || '大会'}まで あと <span class="days">${diffDays}</span> 日！`; } 
    else if (diffDays === 0) { banner.style.display = 'flex'; banner.style.background = 'linear-gradient(135deg, #10b981, #059669)'; banner.innerHTML = `🔥 本日は ${STATE.settings.targetEventName || '大会'} 当日です！健闘を祈ります！`; } 
    else { banner.style.display = 'none'; }
}

function changeMonth(step) { STATE.calMonth += step; if (STATE.calMonth < 0) { STATE.calMonth = 11; STATE.calYear--; } else if (STATE.calMonth > 11) { STATE.calMonth = 0; STATE.calYear++; } renderCalendar(); }

function showDailySummary(dateStr, log) {
    const parts = dateStr.split('-'); 
    const sumModalDate = document.getElementById('summary-modal-date'); if(sumModalDate) sumModalDate.textContent = `${parts[1]}/${parts[2]} の記録`; 
    const content = document.getElementById('summary-modal-content'); const editBtn = document.getElementById('edit-daily-btn');
    if(!content || !editBtn) return;
    
    if (!log) { content.innerHTML = '<p class="text-center" style="color:var(--text-muted); margin: 40px 0; font-weight:800; font-size:16px;">この日の記録はまだありません。</p>'; editBtn.textContent = '新規入力する'; } 
    else {
        editBtn.textContent = 'この日のデータを編集する'; let sprintHtml = ''; if(log.sprintLogs && log.sprintLogs.length > 0) { sprintHtml = log.sprintLogs.map(s => `<span style="background:var(--primary); color:white; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:bold; display:inline-block; margin-right:6px; box-shadow:var(--shadow-sm);">🏃‍♂️ ${s.distance}m: ${s.time}s</span>`).join(' '); }
        const sorenessPre = log.soreness ? `<div style="font-size:14px; color:var(--secondary); font-weight:800; margin-bottom:6px;">[朝の張り] ${log.soreness}</div>` : ''; const sorenessPost = log.sorenessPost ? `<div style="font-size:14px; color:var(--primary); font-weight:800;">[夜の張り] ${log.sorenessPost}</div>` : ''; const injuryPre = log.injuryPre ? `<div style="margin-top:12px; background:var(--input-bg); border:1px solid var(--warning-text); padding:14px; border-radius:12px;"><b style="color:var(--warning-text); font-size:13px;">⚠️ 朝のケガ詳細:</b><div style="font-size:14px; color:var(--text-main); white-space:pre-wrap; margin-top:6px; font-weight:600;">${log.injuryPre}</div></div>` : ''; const injuryPost = log.injury ? `<div style="margin-top:12px; background:var(--input-bg); border:1px solid var(--warning-text); padding:14px; border-radius:12px;"><b style="color:var(--warning-text); font-size:13px;">⚠️ 夜のケガ詳細:</b><div style="font-size:14px; color:var(--text-main); white-space:pre-wrap; margin-top:6px; font-weight:600;">${log.injury}</div></div>` : '';
        let coachFeedbackHtml = '';
        if (log.coachComment) { coachFeedbackHtml = `<div style="margin-bottom:24px; background:linear-gradient(135deg, var(--secondary-light), var(--primary-light)); border:1px solid var(--primary-alpha); padding:18px; border-radius:16px; box-shadow: var(--shadow-sm);"><div style="font-size:14px; color:var(--primary-dark); font-weight:900; margin-bottom:10px; display:flex; align-items:center; gap:6px;">💬 コーチからのフィードバック</div><div style="display:flex; gap:12px; align-items:flex-start;"><div style="font-size:36px; line-height:1; text-shadow:0 2px 4px rgba(0,0,0,0.2);">${log.coachComment.stamp || ''}</div><div style="font-size:15px; color:var(--text-main); font-weight:700; white-space:pre-wrap; padding-top:6px;">${log.coachComment.text || ''}</div></div></div>`; if (!log.playerReadComment) markCommentAsRead(log.date); }
        content.innerHTML = `${coachFeedbackHtml}<div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:24px;"><div style="background:var(--input-bg); border:1px solid var(--border-color); padding:16px; border-radius:14px; text-align:center; box-shadow:var(--shadow-sm);"><div style="font-size:13px; color:var(--text-muted); font-weight:800; margin-bottom:4px;">疲労度 (朝)</div><div style="font-size:26px; font-weight:900; color:var(--text-main);">${log.fatigue || '-'} <span style="font-size:14px; font-weight:bold; color:var(--text-muted);">/10</span></div></div><div style="background:var(--input-bg); border:1px solid var(--border-color); padding:16px; border-radius:14px; text-align:center; box-shadow:var(--shadow-sm);"><div style="font-size:13px; color:var(--text-muted); font-weight:800; margin-bottom:4px;">Training Load</div><div style="font-size:26px; font-weight:900; color:var(--secondary);">${log.trainingLoad || '-'}</div></div></div><div style="margin-bottom:24px; background:var(--input-bg); border:1px solid var(--border-color); padding:18px; border-radius:16px;"><div style="font-size:14px; color:var(--primary); font-weight:900; margin-bottom:10px;">🏃‍♂️ スプリント・特殊計測</div><div style="margin-bottom:10px;">${sprintHtml || '<span style="font-size:14px; color:var(--text-muted); font-weight:600;">データなし</span>'}</div><div style="font-size:14px; font-weight:700; color:var(--text-main);">RSI: <b style="font-size:16px;">${log.rsi || '-'}</b> <span style="color:var(--border-color); margin:0 8px;">|</span> F-v: <b style="font-size:16px;">${log.fvResult || '-'}</b></div></div><div style="margin-bottom:24px; border-top:2px dashed var(--border-color); padding-top:24px;"><div style="font-size:15px; color:var(--text-main); font-weight:900; margin-bottom:10px;">⚡ 筋肉痛・張り</div>${sorenessPre}${sorenessPost}${!sorenessPre && !sorenessPost ? '<span style="font-size:14px; color:var(--text-muted); font-weight:600;">なし</span>' : ''}${injuryPre}${injuryPost}</div><div style="margin-bottom:24px; border-top:2px dashed var(--border-color); padding-top:24px;"><div style="font-size:15px; color:var(--text-main); font-weight:900; margin-bottom:10px;">💤 睡眠・体調</div><div style="font-size:15px; font-weight:600; margin-bottom:6px; color:var(--text-main);">時間: <b>${log.sleep || '-'}h</b> / 質: <b style="color:var(--secondary);">${log.sleepQuality ? '★'.repeat(log.sleepQuality) : '-'}</b></div><div style="font-size:15px; font-weight:600; color:var(--text-main);">体重: <b>${log.weight ? log.weight+'kg' : '-'}</b> /心拍: <b>${log.heartRate || '-'}</b></div></div><div style="border-top:2px dashed var(--border-color); padding-top:24px; padding-bottom:10px;"><div style="font-size:15px; color:var(--text-main); font-weight:900; margin-bottom:12px;">📝 練習振り返り・ケア</div><div style="font-size:15px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); padding:14px; border-radius:12px; margin-bottom:12px; white-space:pre-wrap; font-weight:600; box-shadow:var(--shadow-sm);"><b style="color:var(--primary); font-size:13px; display:block; margin-bottom:4px;">メニュー:</b>${log.menu || '-'}</div><div style="font-size:15px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); padding:14px; border-radius:12px; margin-bottom:12px; white-space:pre-wrap; font-weight:600; box-shadow:var(--shadow-sm);"><b style="color:var(--good-text); font-size:13px; display:block; margin-bottom:4px;">👍 できたこと:</b>${log.good || '-'}</div><div style="font-size:15px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); padding:14px; border-radius:12px; margin-bottom:12px; white-space:pre-wrap; font-weight:600; box-shadow:var(--shadow-sm);"><b style="color:var(--warning-text); font-size:13px; display:block; margin-bottom:4px;">👎 課題・できなかったこと:</b>${log.bad || '-'}</div><div style="font-size:15px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); padding:14px; border-radius:12px; white-space:pre-wrap; font-weight:600; box-shadow:var(--shadow-sm);"><b style="color:var(--primary); font-size:13px; display:block; margin-bottom:4px;">🛁 ケア:</b>${log.care || '-'}</div></div>`;
    }
    editBtn.setAttribute('data-date', dateStr); const dModal = document.getElementById('daily-summary-modal'); if(dModal) dModal.style.display = 'flex';
}

function closeDailySummary() { const dModal = document.getElementById('daily-summary-modal'); if(dModal) dModal.style.display = 'none'; }

function editDailyData() {
    const btn = document.getElementById('edit-daily-btn'); if(!btn) return;
    const dateStr = btn.getAttribute('data-date'); 
    const dInput = document.getElementById('date'); if(dInput) dInput.value = dateStr; 
    renderCalendar(); const parts = dateStr.split('-'); const displayStr = `${parts[1]}/${parts[2]}`; 
    const preDisp = document.getElementById('display-date-pre'); if(preDisp) preDisp.textContent = `[ ${displayStr} ]`; 
    const postDisp = document.getElementById('display-date-post'); if(postDisp) postDisp.textContent = `[ ${displayStr} ]`; 
    loadFormData(dateStr); closeDailySummary(); 
    const preTab = document.querySelector('.tab-btn[onclick="switchTab(\'pre\', this)"]');
    switchTab('pre', preTab); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterEducation(cat, btn) { document.querySelectorAll('.edu-cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); STATE.currentEduCat = cat; renderEducationList(); }
function getYouTubeEmbedUrl(url) { if(!url) return null; const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/); return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null; }

function renderEducationList() {
    const container = document.getElementById('education-list-container'); if(!container) return; container.innerHTML = '';
    const filtered = STATE.currentEduCat === 'すべて' ? STATE.education : STATE.education.filter(item => item.category === STATE.currentEduCat || (STATE.currentEduCat === 'ケア' && item.category === 'ケア・リカバリー') || (STATE.currentEduCat === '理論' && item.category === 'トレーニング理論') || (STATE.currentEduCat === '栄養' && item.category === '栄養・食事') || (STATE.currentEduCat === 'メンタル' && item.category === 'メンタル'));
    if (filtered.length === 0) { container.innerHTML = '<div class="text-center" style="padding: 40px; color: var(--text-muted); font-size: 15px; font-weight:bold;">このカテゴリのコンテンツはまだありません。</div>'; return; }
    filtered.forEach(item => { const card = document.createElement('div'); card.className = 'edu-card'; const embedUrl = getYouTubeEmbedUrl(item.url); const ytHtml = embedUrl ? `<div class="yt-container" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin-top:14px; border-radius:12px; box-shadow:var(--shadow-sm);"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" src="${embedUrl}" allowfullscreen></iframe></div>` : (item.url ? `<a href="${item.url}" target="_blank" style="display:inline-block; margin-top:14px; color:var(--primary); font-weight:800; font-size:14px; background:var(--primary-light); padding:8px 16px; border-radius:12px; transition:transform 0.2s;">🔗 リンクを開く</a>` : ''); const isDark = document.body.classList.contains('dark-mode'); const bg = isDark ? '#3a1523' : '#ffedd5'; const col = isDark ? '#fbcfe8' : '#c2410c'; card.innerHTML = `<span style="background:${bg}; color:${col}; font-size:12px; padding:4px 12px; border-radius:14px; font-weight:900; display:inline-block; margin-bottom:12px; letter-spacing:0.5px;">${item.category}</span><h3 style="font-size: 18px; font-weight: 900; color: var(--primary); margin: 0 0 12px 0;">${item.title}</h3><div style="font-size: 14px; color: var(--text-main); white-space: pre-wrap; line-height: 1.6; font-weight:500;">${item.description}</div>${ytHtml}`; container.appendChild(card); });
}

// 7. イベントリスナー登録
document.addEventListener('DOMContentLoaded', initApp);
