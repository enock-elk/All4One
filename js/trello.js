// ============================================================================
// ALL4ONE - TRELLO WATCHER (hardcoded app key + OAuth)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = '4a2f87929257d1557d800be137588c07';
    const MAX_BUCKETS = 10;
    const PREF_TOKEN = 'trelloToken';
    const PREF_BOARD = 'trelloBoardId';
    const PREF_BUCKETS = 'trelloBucketIds';

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
    const bucketGrid = document.getElementById('trello-bucket-grid');

    let worker = null;
    let audioCtx = null;
    let userToken = null;

    function addLog(msg, type = 'info') {
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
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
        if (logContainer.children.length > 100) logContainer.removeChild(logContainer.firstChild);
    }

    function playAlarmBeep() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const playTone = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        const now = audioCtx.currentTime;
        playTone(880, now, 0.2);
        playTone(880, now + 0.3, 0.2);
        playTone(880, now + 0.6, 0.4);
    }

    async function trelloFetch(url) {
        const response = await fetch(`${url}?key=${API_KEY}&token=${userToken}`);
        if (response.status === 401) throw new Error('Unauthorized');
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    }

    function showAuth() {
        authPanel.classList.remove('hidden');
        setupPanel.classList.add('hidden');
        btnStart.disabled = true;
    }

    function showSetup() {
        authPanel.classList.add('hidden');
        setupPanel.classList.remove('hidden');
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
        btnStart.disabled = selectedTargets().length === 0 || Boolean(worker);
    }

    function renderBucketGrid(buckets) {
        if (!buckets?.length) {
            bucketGrid.classList.add('hidden');
            bucketGrid.innerHTML = '';
            return;
        }
        bucketGrid.classList.remove('hidden');
        bucketGrid.innerHTML = buckets.map((b) => `
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
                <div class="text-lg font-bold text-blue-500">${escapeHtml(String(b.count))}</div>
                <div class="text-[10px] text-slate-500 truncate">${escapeHtml(b.name)}</div>
            </div>
        `).join('');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function fetchLists(boardId) {
        if (!boardId) {
            listBox.innerHTML = '<p class="text-xs text-slate-400 p-2">Select a board.</p>';
            btnStart.disabled = true;
            return;
        }
        localStorage.setItem(PREF_BOARD, boardId);
        const lists = await trelloFetch(`https://api.trello.com/1/boards/${boardId}/lists`);
        const saved = JSON.parse(localStorage.getItem(PREF_BUCKETS) || '[]');
        listBox.innerHTML = '';
        lists.forEach((list) => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-sm';
            const checked = saved.includes(list.id) ? 'checked' : '';
            label.innerHTML = `<input type="checkbox" name="trello-bucket" value="${list.id}" data-name="${escapeHtml(list.name)}" ${checked} class="rounded border-slate-300 text-blue-600"><span>${escapeHtml(list.name)}</span>`;
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
            userLabel.textContent = `Connected as ${me.fullName || me.username || 'Trello user'}`;
            await fetchBoards();
            addLog('Trello session ready. Select lists and start the worker.', 'success');
        } catch (err) {
            addLog(`Could not load Trello data: ${err.message}`, 'error');
            if (String(err.message).includes('Unauthorized')) disconnect();
        }
        if (window.lucide) lucide.createIcons();
    }

    function disconnect() {
        if (worker) {
            worker.postMessage({ cmd: 'stop' });
            worker.terminate();
            worker = null;
        }
        localStorage.removeItem(PREF_TOKEN);
        userToken = null;
        showAuth();
        btnStart.disabled = true;
        btnStop.disabled = true;
        renderBucketGrid([]);
        addLog('Disconnected from Trello.', 'error');
    }

    function handleWorkerMessage(e) {
        const data = e.data;
        switch (data.type) {
            case 'log':
                addLog(data.msg, data.isError ? 'error' : 'info');
                break;
            case 'alarm':
                addLog(`ALARM: New card [${data.cardName}] in [${data.listName}]`, 'alarm');
                playAlarmBeep();
                break;
            case 'stats':
                addLog(`Sync OK. Tracking ${data.total} total cards.`, 'success');
                if (data.buckets) renderBucketGrid(data.buckets);
                break;
            case 'auth_fail':
                addLog('CRITICAL: Trello authentication failed. Please authorize again.', 'error');
                btnStop.click();
                disconnect();
                break;
            default:
                break;
        }
    }

    btnAuthorize.addEventListener('click', authorizeTrello);
    btnDisconnect.addEventListener('click', disconnect);
    boardSelect.addEventListener('change', () => {
        fetchLists(boardSelect.value).catch((err) => addLog(err.message, 'error'));
    });

    btnStart.addEventListener('click', () => {
        const targets = selectedTargets();
        if (!userToken) return addLog('Authorize with Trello first.', 'error');
        if (!targets.length) return addLog('Select at least one list.', 'error');

        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        if (!worker) {
            try {
                worker = new Worker(new URL('workers/trello-worker.js', document.baseURI));
                worker.onmessage = handleWorkerMessage;
            } catch (err) {
                return addLog(`Worker initialization failed: ${err.message}`, 'error');
            }
        }

        worker.postMessage({
            cmd: 'start',
            payload: { apiKey: API_KEY, token: userToken, targets },
        });

        btnStart.disabled = true;
        btnStop.disabled = false;
        addLog(`Worker started. Monitoring ${targets.length} list(s).`, 'info');
    });

    btnStop.addEventListener('click', () => {
        if (worker) {
            worker.postMessage({ cmd: 'stop' });
            worker.terminate();
            worker = null;
        }
        btnStart.disabled = selectedTargets().length === 0;
        btnStop.disabled = true;
        addLog('Worker stopped by user.', 'error');
    });

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
