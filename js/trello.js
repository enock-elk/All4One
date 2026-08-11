// ============================================================================
// ALL4ONE - TRELLO WATCHER (MAIN THREAD CONTROLLER)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const btnStart = document.getElementById('btn-trello-start');
    const btnStop = document.getElementById('btn-trello-stop');
    const inputApiKey = document.getElementById('trello-api-key');
    const inputToken = document.getElementById('trello-token');
    const inputTargets = document.getElementById('trello-targets');
    const logContainer = document.getElementById('trello-log-container');

    let worker = null;
    let audioCtx = null;

    // --- Boot Sequence: Load Saved Config ---
    function loadSavedConfig() {
        const savedKey = localStorage.getItem('trelloApiKey');
        const savedToken = localStorage.getItem('trelloToken');
        const savedTargets = localStorage.getItem('trelloTargets');

        if (savedKey) inputApiKey.value = savedKey;
        if (savedToken) inputToken.value = savedToken;
        if (savedTargets) {
            inputTargets.value = savedTargets;
        } else {
            // Default template
            inputTargets.value = '[\n  {"id": "REPLACE_WITH_LIST_ID", "name": "Review Queue"}\n]';
        }
    }

    // --- Logging System ---
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
        
        // Auto-scroll to bottom, keeping only the last 100 logs in DOM
        logContainer.scrollTop = logContainer.scrollHeight;
        if (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    // --- Audio Alarm System (Synthesizer) ---
    function playAlarmBeep() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // High pitch beep
        const playTone = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, startTime);
            
            gain.gain.setValueAtTime(0.1, startTime); // Volume
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = audioCtx.currentTime;
        playTone(880, now, 0.2);       // Beep 1
        playTone(880, now + 0.3, 0.2); // Beep 2
        playTone(880, now + 0.6, 0.4); // Beep 3 (Longer)
    }

    // --- Web Worker Message Handler ---
    function handleWorkerMessage(e) {
        const data = e.data;
        
        switch(data.type) {
            case 'log':
                addLog(data.msg, data.isError ? 'error' : 'info');
                break;
            case 'alarm':
                addLog(`🚨 ALARM: New card detected! [${data.cardName}] in list [${data.listName}]`, 'alarm');
                playAlarmBeep();
                break;
            case 'stats':
                addLog(`Sync OK. Tracking ${data.total} total cards.`, 'success');
                break;
            case 'auth_fail':
                addLog('CRITICAL: Authentication failed. Check API Key and Token.', 'error');
                btnStop.click(); // Auto-stop
                break;
            default:
                console.log("Unknown worker message:", data);
        }
    }

    // --- Event Listeners ---
    btnStart.addEventListener('click', () => {
        const apiKey = inputApiKey.value.trim();
        const token = inputToken.value.trim();
        const targetsStr = inputTargets.value.trim();

        // 1. Validation
        if (!apiKey || !token) {
            return addLog("Cannot start: API Key and Token are required.", "error");
        }

        let targets = [];
        try {
            targets = JSON.parse(targetsStr);
            if (!Array.isArray(targets) || targets.length === 0) throw new Error("Not an array");
        } catch (e) {
            return addLog("Cannot start: Target Lists JSON is invalid.", "error");
        }

        // 2. Save Config
        localStorage.setItem('trelloApiKey', apiKey);
        localStorage.setItem('trelloToken', token);
        localStorage.setItem('trelloTargets', targetsStr);

        // 3. Initialize Audio Context (Requires user interaction)
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // 4. Boot Worker
        if (!worker) {
            // Note: worker.js must exist in the 'workers/' folder as per instructions
            try {
                worker = new Worker('/workers/trello-worker.js');
                worker.onmessage = handleWorkerMessage;
            } catch (err) {
                return addLog(`Worker initialization failed: ${err.message}`, "error");
            }
        }

        worker.postMessage({ 
            cmd: 'start', 
            payload: { apiKey, token, targets } 
        });

        // 5. Update UI
        btnStart.disabled = true;
        btnStart.classList.add('opacity-50');
        btnStop.disabled = false;
        btnStop.classList.remove('opacity-50');
        
        addLog("Worker sequence initiated. Audio alarms unlocked.", "info");
    });

    btnStop.addEventListener('click', () => {
        if (worker) {
            worker.postMessage({ cmd: 'stop' });
        }
        
        btnStart.disabled = false;
        btnStart.classList.remove('opacity-50');
        btnStop.disabled = true;
        btnStop.classList.add('opacity-50');
        
        addLog("Worker sequence stopped by user.", "error");
    });

    // --- Init ---
    loadSavedConfig();
});