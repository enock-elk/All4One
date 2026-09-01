// ============================================================================
// ALL4ONE - TRELLO WATCHER (lockscreen + MP3 alerts + worker/main poller)
// ============================================================================

import { createTrelloWatcher } from './trello-poller.js';
import { showActionToast, showAppToast } from './ui-prefs.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = '4a2f87929257d1557d800be137588c07';
    const MAX_BUCKETS = 10;
    const PREF_TOKEN = 'trelloToken';
    const PREF_BOARD = 'trelloBoardId';
    const PREF_BUCKETS = 'trelloBucketIds';
    const PREF_MODE = 'watcher_mode';
    const PREF_TONE_WAKE = 'watcher_tone_wake';
    const PREF_TONE_NOTIFY = 'watcher_tone_notify';
    const PREF_STEALTH = 'watcher_stealth';
    const PREF_CUSTOM_SOUND = 'watcher_custom_sound';
    const PREF_BG = 'watcher_bg';
    const PREF_FLOAT_POPUP = 'trello_float_popup_enabled';

    const TONES = [
        { value: 'default', label: 'Default Siren' },
        { value: 'sounds/message_tone.mp3', label: 'Message Tone' },
        { value: 'sounds/message_messaaaaaage.mp3', label: 'Message... Message!' },
        { value: 'sounds/message_my_lord.mp3', label: 'Message My Lord' },
        { value: 'sounds/email_notification.mp3', label: 'Email Notification' },
        { value: 'sounds/bottle_opener.mp3', label: 'Bottle Opener' },
        { value: 'sounds/carlock.mp3', label: 'Car Lock' },
        { value: 'sounds/doorbell.mp3', label: 'Doorbell' },
        { value: 'sounds/zap.mp3', label: 'Zap' },
        { value: 'sounds/just_calledf__k_u.mp3', label: 'Just Called...' },
        { value: 'sounds/ping.mp3', label: 'Ping' },
        { value: 'sounds/notification.mp3', label: 'Simple Notification' },
        { value: 'sounds/sneeze.mp3', label: 'Sneeze' },
        { value: 'sounds/wahwahwahwahhh.mp3', label: 'Wah Wah Wah' },
        { value: 'custom', label: 'Custom Upload...' },
    ];

    const btnStart = document.getElementById('btn-trello-start');
    const btnStop = document.getElementById('btn-trello-stop');
    const btnAuthorize = document.getElementById('btn-trello-authorize');
    const btnDisconnect = document.getElementById('btn-trello-disconnect');
    const authPanel = document.getElementById('trello-auth-panel');
    const setupPanel = document.getElementById('trello-setup-panel');
    const boardSelect = document.getElementById('trello-board-select');
    const listBox = document.getElementById('trello-list-checkboxes');
    const userLabel = document.getElementById('trello-user-label');
    const logContainer = document.getElementById('trello-log-container');
    const logHome = document.getElementById('trello-log-home');
    const logFs = document.getElementById('trello-log-fs');
    const consoleCard = document.getElementById('trello-console-card');
    const btnFullscreen = document.getElementById('btn-trello-fullscreen');
    const btnExitFs = document.getElementById('btn-trello-exit-fs');
    const bucketGrid = document.getElementById('trello-bucket-grid');
    const lockscreen = document.getElementById('trello-lockscreen');
    const clockTime = document.getElementById('trello-clock-time');
    const clockDate = document.getElementById('trello-clock-date');
    const monitorSection = document.getElementById('trello-monitor');
    const setupCard = document.getElementById('trello-setup-card');
    const totalCards = document.getElementById('trello-total-cards');
    const toneSelect = document.getElementById('trello-tone-select');
    const soundToggle = document.getElementById('trello-sound-toggle');
    const soundToggleActive = document.getElementById('trello-sound-toggle-active');
    const stealthToggle = document.getElementById('trello-stealth-toggle');
    const testBtn = document.getElementById('trello-test-sound');
    const customSoundStatus = document.getElementById('trello-custom-sound-status');
    const soundInput = document.getElementById('trello-sound-input');
    const bgInput = document.getElementById('trello-bg-input');
    const alarmOverlay = document.getElementById('trello-alarm-overlay');
    const alarmCardName = document.getElementById('trello-alarm-card');
    const alarmListName = document.getElementById('trello-alarm-list');
    const volumeHud = document.getElementById('trello-volume-hud');
    const modeWake = document.getElementById('trello-mode-wake');
    const modeNotify = document.getElementById('trello-mode-notify');
    const floatPanel = document.getElementById('trello-float-panel');
    const floatGrid = document.getElementById('trello-float-grid');
    const floatTotal = document.getElementById('trello-float-total');
    const floatDragHandle = document.getElementById('trello-float-drag-handle');
    const floatGotoBtn = document.getElementById('trello-float-goto');
    const floatMinimizeBtn = document.getElementById('trello-float-minimize');
    const btnFloatOpen = document.getElementById('btn-trello-float-open');

    let latestBuckets = [];

    let worker = null;
    let mainWatcher = null;
    let audioCtx = null;
    let userToken = null;
    let alertMode = 'wake';
    let isAlarmPlaying = false;
    let isTesting = false;
    let oscillator = null;
    let customAudioSource = null;
    let customAudio = null;
    let silentOscillator = null;
    let silentGain = null;
    let wakeLock = null;
    let alarmTimeout1 = null;
    let alarmTimeout2 = null;
    let alarmTimeout3 = null;

    function assetUrl(rel) {
        return new URL(rel, document.baseURI).href;
    }

    function addLog(msg, type = 'info') {
        if (!logContainer) return;
        const div = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        let colorClass = 'text-slate-300';
        if (type === 'error') colorClass = 'text-rose-400 font-bold';
        if (type === 'success') colorClass = 'text-emerald-400';
        if (type === 'alarm') colorClass = 'text-amber-400 font-bold bg-amber-500/10 p-1 rounded';
        div.className = `mb-1 ${colorClass}`;
        const timeSpan = document.createElement('span');
        timeSpan.className = 'opacity-50 text-slate-500';
        timeSpan.textContent = `[${time}] `;
        const msgSpan = document.createElement('span');
        msgSpan.textContent = msg;
        div.appendChild(timeSpan);
        div.appendChild(msgSpan);
        logContainer.prepend(div);
        if (logContainer.children.length > 100) logContainer.removeChild(logContainer.lastChild);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function startSilentNoise() {
        if (!stealthToggle?.checked) {
            addLog('Stealth keep-alive is off.');
            return;
        }
        try {
            stopSilentNoise(true);
            ensureAudio();
            silentOscillator = audioCtx.createOscillator();
            silentOscillator.type = 'sine';
            silentOscillator.frequency.value = 30;
            silentGain = audioCtx.createGain();
            silentGain.gain.value = 0.01;
            silentOscillator.connect(silentGain);
            silentGain.connect(audioCtx.destination);
            silentOscillator.start();
            addLog('Silent keep-alive active (Stealth Mode: 30Hz).');
        } catch (err) {
            console.error('Silent noise failed:', err);
        }
    }

    function stopSilentNoise(quiet = false) {
        try {
            if (silentOscillator) {
                silentOscillator.stop();
                silentOscillator.disconnect();
                silentOscillator = null;
            }
            if (silentGain) {
                silentGain.disconnect();
                silentGain = null;
            }
            if (!quiet) addLog('Silent keep-alive stopped.');
        } catch (err) {
            console.error('Error stopping silent noise:', err);
        }
    }

    function stopSoundOnly() {
        if (customAudio) {
            try { customAudio.pause(); customAudio.currentTime = 0; } catch (_) { /* ignore */ }
            customAudio = null;
        }
        if (oscillator) {
            try { oscillator.stop(); oscillator.disconnect(); } catch (_) { /* ignore */ }
            oscillator = null;
        }
    }

    function playSynth(loop) {
        try {
            ensureAudio();
            oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            if (loop) {
                gainNode.gain.value = 0.15;
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                oscillator.start();
                oscillator.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.5);
                const lfo = audioCtx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.value = 2;
                const lfoGain = audioCtx.createGain();
                lfoGain.gain.value = 300;
                lfo.connect(lfoGain);
                lfoGain.connect(oscillator.frequency);
                lfo.start();
            } else {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 1);
                oscillator.onended = () => { oscillator = null; };
            }
        } catch (err) {
            addLog(`Synth error: ${err.message}`, 'error');
        }
    }

    function playAudio(loop) {
        stopSoundOnly();
        ensureAudio();
        if (customAudioSource) {
            customAudio = new Audio(customAudioSource);
            customAudio.loop = loop;
            const playPromise = customAudio.play();
            if (playPromise) {
                playPromise.catch((err) => {
                    if (err.name === 'AbortError') return;
                    addLog(`Audio failed: ${err.message}`, 'error');
                    playSynth(loop);
                });
            }
            return;
        }
        playSynth(loop);
    }

    function showVolumeCheck() {
        if (!volumeHud) return;
        volumeHud.classList.remove('hidden');
        setTimeout(() => volumeHud.classList.add('hidden'), 3000);
    }

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
        } catch (_) { /* ignore */ }
    }

    function stopAlarm() {
        isAlarmPlaying = false;
        isTesting = false;
        clearTimeout(alarmTimeout1);
        clearTimeout(alarmTimeout2);
        clearTimeout(alarmTimeout3);
        alarmOverlay?.classList.add('hidden');
        volumeHud?.classList.add('hidden');
        if (testBtn) {
            testBtn.textContent = '▶';
            testBtn.classList.remove('bg-rose-600');
            testBtn.classList.add('bg-sky-500');
        }
        if (navigator.vibrate) navigator.vibrate(0);
        stopSoundOnly();
    }

    function triggerAlarm(cardName, listName) {
        isAlarmPlaying = true;
        alarmOverlay?.classList.remove('hidden');
        if (alarmCardName) alarmCardName.textContent = cardName;
        if (alarmListName) alarmListName.textContent = listName;
        addLog(`ALARM: New card [${cardName}] in [${listName}]`, 'alarm');

        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
            try {
                new Notification('Trello Alert!', {
                    body: `New card in ${listName}: ${cardName}`,
                    icon: assetUrl('icons/icon-192.png'),
                    tag: 'trello-alert',
                    renotify: true,
                });
            } catch (_) { /* ignore */ }
        }

        if (navigator.vibrate) {
            if (alertMode === 'wake') navigator.vibrate([500, 200, 500, 200, 1000]);
            else navigator.vibrate(200);
        }

        const shouldLoop = alertMode === 'wake';
        playAudio(shouldLoop);

        if (alertMode === 'wake') {
            alarmTimeout1 = setTimeout(() => {
                addLog('Alarm paused (safety 1)');
                stopSoundOnly();
                alarmTimeout2 = setTimeout(() => {
                    addLog('Alarm resuming');
                    playAudio(true);
                    alarmTimeout3 = setTimeout(() => {
                        addLog('Alarm stopped (safety cutoff)');
                        stopAlarm();
                    }, 180000);
                }, 30000);
            }, 180000);
        } else {
            setTimeout(() => { if (isAlarmPlaying) stopAlarm(); }, 5000);
        }
    }

    function updateToneUI(value) {
        if (value === 'default') {
            customAudioSource = null;
            if (customSoundStatus) customSoundStatus.classList.add('hidden');
        } else if (value === 'custom') {
            const saved = localStorage.getItem(PREF_CUSTOM_SOUND);
            if (saved) {
                customAudioSource = saved;
                if (customSoundStatus) customSoundStatus.classList.remove('hidden');
            } else {
                soundInput?.click();
            }
        } else {
            customAudioSource = assetUrl(value);
            if (customSoundStatus) customSoundStatus.classList.add('hidden');
        }
    }

    function setAlertMode(mode, fromUser = false) {
        alertMode = mode;
        modeWake?.classList.toggle('trello-mode-active', mode === 'wake');
        modeNotify?.classList.toggle('trello-mode-active', mode === 'notify');
        if (!fromUser) return;
        localStorage.setItem(PREF_MODE, mode);
        const newTone = mode === 'wake'
            ? (localStorage.getItem(PREF_TONE_WAKE) || 'default')
            : (localStorage.getItem(PREF_TONE_NOTIFY) || 'sounds/message_my_lord.mp3');
        if (toneSelect) toneSelect.value = newTone;
        updateToneUI(newTone);
    }

    function populateTones() {
        if (!toneSelect) return;
        toneSelect.innerHTML = TONES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('');
    }

    function initVisuals() {
        const savedBg = localStorage.getItem(PREF_BG);
        if (savedBg && lockscreen) lockscreen.style.backgroundImage = `url(${savedBg})`;
        if (localStorage.getItem(PREF_STEALTH) === 'false' && stealthToggle) stealthToggle.checked = false;
        populateTones();
        const savedMode = localStorage.getItem(PREF_MODE) || 'wake';
        setAlertMode(savedMode, false);
        const savedTone = savedMode === 'wake'
            ? (localStorage.getItem(PREF_TONE_WAKE) || 'default')
            : (localStorage.getItem(PREF_TONE_NOTIFY) || 'sounds/message_my_lord.mp3');
        if (toneSelect) toneSelect.value = savedTone;
        updateToneUI(savedTone);
    }

    function updateClock() {
        if (!clockTime || !clockDate) return;
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        clockTime.textContent = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
        clockDate.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    async function trelloFetch(url) {
        const response = await fetch(`${url}?key=${API_KEY}&token=${userToken}`);
        if (response.status === 401) throw new Error('Unauthorized');
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    }

    function showAuth() {
        authPanel?.classList.remove('hidden');
        setupPanel?.classList.add('hidden');
        if (btnStart) btnStart.disabled = true;
    }

    function showSetup() {
        authPanel?.classList.add('hidden');
        setupPanel?.classList.remove('hidden');
    }

    function captureTokenFromHash() {
        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        if (!params.has('token')) return false;
        userToken = params.get('token');
        localStorage.setItem(PREF_TOKEN, userToken);
        const clean = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState({}, document.title, clean);
        return true;
    }

    function authorizeTrello() {
        const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
        const authUrl = `https://trello.com/1/authorize?expiration=never&name=${encodeURIComponent('All4One Trello Watcher')}&scope=read&response_type=token&key=${API_KEY}&return_url=${encodeURIComponent(returnUrl)}`;
        window.location.href = authUrl;
    }

    function selectedTargets() {
        return Array.from(listBox.querySelectorAll('input[name="trello-bucket"]:checked')).map((cb) => ({
            id: cb.value,
            name: cb.getAttribute('data-name'),
        }));
    }

    function persistBuckets() {
        localStorage.setItem(PREF_BUCKETS, JSON.stringify(selectedTargets().map((t) => t.id)));
        if (btnStart) btnStart.disabled = selectedTargets().length === 0 || Boolean(worker || mainWatcher);
    }

    function renderBucketGrid(buckets) {
        if (!bucketGrid) return;
        if (!buckets?.length) {
            bucketGrid.innerHTML = '';
            return;
        }
        bucketGrid.innerHTML = buckets.map((b) => `
            <div class="trello-bucket-card">
                <div class="trello-bucket-count">${escapeHtml(String(b.count))}</div>
                <div class="trello-bucket-name">${escapeHtml(b.name)}</div>
            </div>
        `).join('');
        renderFloatGrid(buckets);
    }

    function renderFloatGrid(buckets) {
        latestBuckets = buckets || [];
        if (!floatGrid) return;
        if (!latestBuckets.length) {
            floatGrid.innerHTML = '<div class="trello-float-empty">No lists selected yet.</div>';
            if (floatTotal) floatTotal.textContent = '0';
            return;
        }
        const total = latestBuckets.reduce((sum, b) => sum + (Number(b.count) || 0), 0);
        if (floatTotal) floatTotal.textContent = String(total);
        floatGrid.innerHTML = latestBuckets.map((bucket) => {
            const cards = Array.isArray(bucket.cards) ? bucket.cards : [];
            const cardItems = cards.length
                ? cards.map((name) => `<li class="trello-float-card" title="${escapeHtml(name)}">${escapeHtml(name)}</li>`).join('')
                : '<li class="trello-float-empty">No active cases</li>';
            return `
                <div class="trello-float-column">
                    <div class="trello-float-column-header">
                        ${escapeHtml(bucket.name)}
                        <span class="trello-float-column-count">${escapeHtml(String(bucket.count ?? cards.length))}</span>
                    </div>
                    <ul class="trello-float-cards custom-scroll">${cardItems}</ul>
                </div>
            `;
        }).join('');
    }

    function showFloatPanel() {
        if (!floatPanel) return;
        floatPanel.classList.remove('is-hidden');
        localStorage.setItem(PREF_FLOAT_POPUP, 'true');
        renderFloatGrid(latestBuckets);
    }

    function hideFloatPanel() {
        floatPanel?.classList.add('is-hidden');
        localStorage.setItem(PREF_FLOAT_POPUP, 'false');
    }

    function promptFloatPopup() {
        showActionToast({
            message: 'Trello Watcher is running. Open the live board popup to see buckets and cases while you work in other tools?',
            primaryLabel: 'Open popup',
            secondaryLabel: 'Not now',
            onPrimary: () => showFloatPanel(),
            onSecondary: () => {
                localStorage.setItem(PREF_FLOAT_POPUP, 'false');
                showAppToast('You can open the board popup from Trello Watcher anytime.');
            },
        });
    }

    function initFloatPanelDrag() {
        if (!floatPanel || !floatDragHandle) return;
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        floatDragHandle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            dragging = true;
            const rect = floatPanel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            floatPanel.style.right = 'auto';
            floatPanel.style.bottom = 'auto';
            floatPanel.style.left = `${rect.left}px`;
            floatPanel.style.top = `${rect.top}px`;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const maxX = window.innerWidth - floatPanel.offsetWidth - 8;
            const maxY = window.innerHeight - floatPanel.offsetHeight - 8;
            const nextX = Math.max(8, Math.min(e.clientX - offsetX, maxX));
            const nextY = Math.max(8, Math.min(e.clientY - offsetY, maxY));
            floatPanel.style.left = `${nextX}px`;
            floatPanel.style.top = `${nextY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.userSelect = '';
        });
    }

    floatGotoBtn?.addEventListener('click', () => {
        if (typeof window.activateWorkspaceTab === 'function') {
            window.activateWorkspaceTab('dashboard');
        }
    });
    floatMinimizeBtn?.addEventListener('click', hideFloatPanel);
    btnFloatOpen?.addEventListener('click', showFloatPanel);
    initFloatPanelDrag();

    async function fetchLists(boardId) {
        if (!boardId) {
            listBox.innerHTML = '<p class="text-xs text-slate-400 p-2">Select a board.</p>';
            if (btnStart) btnStart.disabled = true;
            return;
        }
        localStorage.setItem(PREF_BOARD, boardId);
        const lists = await trelloFetch(`https://api.trello.com/1/boards/${boardId}/lists`);
        const saved = JSON.parse(localStorage.getItem(PREF_BUCKETS) || '[]');
        listBox.innerHTML = '';
        lists.forEach((list) => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-sm';
            const checked = saved.includes(list.id) ? 'checked' : '';
            label.innerHTML = `<input type="checkbox" name="trello-bucket" value="${list.id}" data-name="${escapeHtml(list.name)}" ${checked} class="rounded border-slate-300 text-sky-500"><span>${escapeHtml(list.name)}</span>`;
            listBox.appendChild(label);
        });
        listBox.querySelectorAll('input[name="trello-bucket"]').forEach((cb) => {
            cb.addEventListener('change', (e) => {
                const checked = listBox.querySelectorAll('input[name="trello-bucket"]:checked');
                if (checked.length > MAX_BUCKETS) {
                    e.target.checked = false;
                    addLog(`Max ${MAX_BUCKETS} lists.`, 'error');
                    return;
                }
                persistBuckets();
            });
        });
        persistBuckets();
    }

    async function fetchBoards() {
        const boards = await trelloFetch('https://api.trello.com/1/members/me/boards');
        boardSelect.innerHTML = '<option value="">-- Choose a board --</option>';
        let targetId = localStorage.getItem(PREF_BOARD);
        boards.forEach((board) => {
            const opt = document.createElement('option');
            opt.value = board.id;
            opt.textContent = board.name;
            boardSelect.appendChild(opt);
            if (!targetId && board.name.toLowerCase().includes('actuarial reports')) {
                targetId = board.id;
            }
        });
        if (targetId && boards.some((b) => b.id === targetId)) {
            boardSelect.value = targetId;
            await fetchLists(targetId);
        }
    }

    async function initWithToken() {
        showSetup();
        try {
            const me = await trelloFetch('https://api.trello.com/1/members/me');
            if (userLabel) userLabel.textContent = `Connected as ${me.fullName || me.username || 'Trello user'}`;
            await fetchBoards();
            addLog('Trello session ready. Select lists and start watching.', 'success');
        } catch (err) {
            addLog(`Could not load Trello data: ${err.message}`, 'error');
            if (String(err.message).includes('Unauthorized')) disconnect();
        }
        if (window.lucide) lucide.createIcons();
    }

    function stopPoller() {
        if (worker) {
            try { worker.postMessage({ cmd: 'stop' }); } catch (_) { /* ignore */ }
            try { worker.terminate(); } catch (_) { /* ignore */ }
            worker = null;
        }
        if (mainWatcher) {
            mainWatcher.stop();
            mainWatcher = null;
        }
    }

    function disconnect() {
        exitTrelloFullscreen();
        stopPoller();
        stopSilentNoise();
        stopAlarm();
        localStorage.removeItem(PREF_TOKEN);
        userToken = null;
        showAuth();
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = true;
        setupCard?.classList.remove('hidden');
        consoleCard?.classList.remove('hidden');
        monitorSection?.classList.add('hidden');
        parkLog(logHome);
        renderBucketGrid([]);
        hideFloatPanel();
        addLog('Disconnected from Trello.', 'error');
    }

    function onWatcherEvent(data) {
        switch (data.type) {
            case 'log':
                if (!data.isError && /Sync OK\. Tracking/i.test(data.msg || '')) break;
                addLog(data.msg, data.isError ? 'error' : 'info');
                break;
            case 'alarm':
                if (soundToggleActive?.checked && !isAlarmPlaying) {
                    triggerAlarm(data.cardName, data.listName);
                } else {
                    addLog(`ALARM: New card [${data.cardName}] in [${data.listName}]`, 'alarm');
                }
                break;
            case 'stats':
                if (totalCards) totalCards.textContent = String(data.total ?? 0);
                if (data.buckets) renderBucketGrid(data.buckets);
                break;
            case 'auth_fail':
                addLog('CRITICAL: Trello authentication failed. Please authorize again.', 'error');
                disconnect();
                break;
            default:
                break;
        }
    }

    function parkLog(target) {
        if (logContainer && target && logContainer.parentElement !== target) {
            target.appendChild(logContainer);
        }
    }

    function enterTrelloFullscreen() {
        if (!worker && !mainWatcher) return;
        document.body.classList.add('trello-fullscreen');
        btnFullscreen?.classList.add('hidden');
        btnExitFs?.classList.remove('hidden');
        parkLog(logFs);
        const pane = document.getElementById('tab-dashboard') || lockscreen;
        const req = pane?.requestFullscreen || pane?.webkitRequestFullscreen;
        if (req) {
            Promise.resolve(req.call(pane)).catch(() => {});
        }
    }

    function exitTrelloFullscreen() {
        document.body.classList.remove('trello-fullscreen');
        if (worker || mainWatcher) btnFullscreen?.classList.remove('hidden');
        btnExitFs?.classList.add('hidden');
        if (worker || mainWatcher) parkLog(logFs);
        else parkLog(logHome);
        if (document.fullscreenElement) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) Promise.resolve(exit.call(document)).catch(() => {});
        }
    }

    window.exitTrelloWatcherFullscreen = exitTrelloFullscreen;

    function startWorkerFallback(payload) {
        mainWatcher = createTrelloWatcher(onWatcherEvent);
        mainWatcher.start(payload);
        addLog('Polling on the main thread (worker unavailable).', 'info');
    }

    function startPoller(payload) {
        const candidates = [
            { url: new URL('js/trello-worker.js', document.baseURI), module: true },
            { url: new URL('workers/trello-worker.js', document.baseURI), module: false },
            { url: new URL('public/workers/trello-worker.js', document.baseURI), module: false },
        ];

        const tryNext = (index) => {
            if (index >= candidates.length) {
                startWorkerFallback(payload);
                return;
            }
            const { url, module } = candidates[index];
            try {
                const instance = module ? new Worker(url, { type: 'module' }) : new Worker(url);
                let gotMessage = false;
                instance.onmessage = (e) => {
                    gotMessage = true;
                    onWatcherEvent(e.data);
                };
                instance.onerror = () => {
                    if (gotMessage) return;
                    try { instance.terminate(); } catch (_) { /* ignore */ }
                    worker = null;
                    tryNext(index + 1);
                };
                instance.postMessage({ cmd: 'start', payload });
                worker = instance;
            } catch (_) {
                worker = null;
                tryNext(index + 1);
            }
        };

        tryNext(0);
    }

    btnAuthorize?.addEventListener('click', authorizeTrello);
    btnDisconnect?.addEventListener('click', disconnect);
    boardSelect?.addEventListener('change', () => {
        fetchLists(boardSelect.value).catch((err) => addLog(err.message, 'error'));
    });

    modeWake?.addEventListener('click', () => setAlertMode('wake', true));
    modeNotify?.addEventListener('click', () => setAlertMode('notify', true));

    toneSelect?.addEventListener('change', () => {
        const value = toneSelect.value;
        if (alertMode === 'wake') localStorage.setItem(PREF_TONE_WAKE, value);
        else localStorage.setItem(PREF_TONE_NOTIFY, value);
        updateToneUI(value);
        if (value !== 'default' && value !== 'custom') {
            const preload = new Audio(assetUrl(value));
            preload.load();
        }
    });

    soundInput?.addEventListener('change', function () {
        const file = this.files?.[0];
        this.value = '';
        if (!file) {
            toneSelect.value = 'default';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            addLog('Custom sound max 2MB.', 'error');
            toneSelect.value = 'default';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                localStorage.setItem(PREF_CUSTOM_SOUND, e.target.result);
                customAudioSource = e.target.result;
                customSoundStatus?.classList.remove('hidden');
                if (customSoundStatus) customSoundStatus.textContent = 'Uploaded';
            } catch (_) {
                addLog('Could not save custom sound.', 'error');
                toneSelect.value = 'default';
            }
        };
        reader.readAsDataURL(file);
    });

    testBtn?.addEventListener('click', () => {
        ensureAudio();
        if (isTesting || isAlarmPlaying) {
            stopAlarm();
            return;
        }
        isTesting = true;
        testBtn.textContent = '⏹';
        testBtn.classList.remove('bg-sky-500');
        testBtn.classList.add('bg-rose-600');
        const shouldLoop = alertMode === 'wake';
        playAudio(shouldLoop);
        if (!shouldLoop) {
            setTimeout(() => {
                if (isTesting) {
                    isTesting = false;
                    testBtn.textContent = '▶';
                    testBtn.classList.remove('bg-rose-600');
                    testBtn.classList.add('bg-sky-500');
                }
            }, 4000);
        }
    });

    stealthToggle?.addEventListener('change', () => {
        localStorage.setItem(PREF_STEALTH, stealthToggle.checked ? 'true' : 'false');
        if (!stealthToggle.checked) stopSilentNoise();
        else if (worker || mainWatcher) startSilentNoise();
    });

    soundToggle?.addEventListener('change', () => {
        if (soundToggleActive) soundToggleActive.checked = soundToggle.checked;
    });
    soundToggleActive?.addEventListener('change', () => {
        if (soundToggle) soundToggle.checked = soundToggleActive.checked;
    });

    document.getElementById('trello-wallpaper-btn')?.addEventListener('click', () => bgInput?.click());
    document.getElementById('trello-reset-bg')?.addEventListener('click', () => {
        localStorage.removeItem(PREF_BG);
        if (lockscreen) lockscreen.style.backgroundImage = '';
    });
    bgInput?.addEventListener('change', function () {
        const file = this.files?.[0];
        this.value = '';
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            addLog('Background max 4MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                localStorage.setItem(PREF_BG, e.target.result);
                if (lockscreen) lockscreen.style.backgroundImage = `url(${e.target.result})`;
            } catch (_) {
                addLog('Could not save background.', 'error');
            }
        };
        reader.readAsDataURL(file);
    });

    btnFullscreen?.addEventListener('click', enterTrelloFullscreen);
    btnExitFs?.addEventListener('click', exitTrelloFullscreen);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('trello-fullscreen')) {
            exitTrelloFullscreen();
        }
    });
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && document.body.classList.contains('trello-fullscreen')) {
            document.body.classList.remove('trello-fullscreen');
            if (worker || mainWatcher) btnFullscreen?.classList.remove('hidden');
            btnExitFs?.classList.add('hidden');
        }
    });

    document.getElementById('trello-ack-alarm')?.addEventListener('click', stopAlarm);

    btnStart?.addEventListener('click', async () => {
        const targets = selectedTargets();
        if (!userToken) return addLog('Authorize with Trello first.', 'error');
        if (!targets.length) return addLog('Select at least one list.', 'error');

        ensureAudio();
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
        showVolumeCheck();
        requestWakeLock();
        startSilentNoise();

        startPoller({ apiKey: API_KEY, token: userToken, targets });

        setupCard?.classList.add('hidden');
        consoleCard?.classList.add('hidden');
        monitorSection?.classList.remove('hidden');
        parkLog(logFs);
        renderBucketGrid(targets.map((t) => ({ ...t, count: '-', cards: [] })));
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = false;
        addLog(`Watching ${targets.length} list(s).`, 'info');
        promptFloatPopup();
    });

    btnStop?.addEventListener('click', () => {
        exitTrelloFullscreen();
        stopPoller();
        stopSilentNoise();
        stopAlarm();
        if (wakeLock) {
            wakeLock.release().then(() => { wakeLock = null; }).catch(() => {});
        }
        setupCard?.classList.remove('hidden');
        consoleCard?.classList.remove('hidden');
        monitorSection?.classList.add('hidden');
        parkLog(logHome);
        hideFloatPanel();
        if (btnStart) btnStart.disabled = selectedTargets().length === 0;
        if (btnStop) btnStop.disabled = true;
        addLog('Watcher stopped by user.', 'error');
    });

    document.addEventListener('visibilitychange', async () => {
        if (wakeLock && document.visibilityState === 'visible') requestWakeLock();
    });

    initVisuals();
    updateClock();
    setInterval(updateClock, 1000);

    captureTokenFromHash();
    userToken = userToken || localStorage.getItem(PREF_TOKEN) || localStorage.getItem('watcher_trello_token');
    if (userToken) {
        localStorage.setItem(PREF_TOKEN, userToken);
        initWithToken();
    } else {
        showAuth();
        addLog('Authorize with Trello to load boards. The API key is already set.', 'info');
    }
});
