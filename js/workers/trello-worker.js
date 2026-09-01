// TRELLO WATCHER - WEB WORKER (classic fallback)
// Handles polling, filtering, and state management off the main thread.

let intervalId = null;
let listStates = {};
let apiKey = '';
let token = '';
let pollInFlight = false;

const POLL_INTERVAL = 15000;

const IGNORED_KEYWORDS = [
    'Out of Office',
    'Training',
    'Innovation',
    'Divider',
    'Analyst',
];

self.onmessage = async function (e) {
    const { cmd, payload } = e.data;

    if (cmd === 'start') {
        apiKey = payload.apiKey;
        token = payload.token;
        if (intervalId) clearInterval(intervalId);
        listStates = {};
        pollInFlight = false;
        startLoop(payload.targets);
    } else if (cmd === 'stop') {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        listStates = {};
        pollInFlight = false;
        postMessage({ type: 'log', msg: 'Worker stopped.' });
    }
};

function shouldIgnore(cardName) {
    if (!cardName) return true;
    const cleanName = cardName.trim().toLowerCase();
    const hasBasicKeyword = IGNORED_KEYWORDS.some((keyword) =>
        cleanName.includes(keyword.toLowerCase()),
    );
    if (hasBasicKeyword) return true;
    if (/\btests?\b/i.test(cardName)) return true;
    if (/\bignores?\b/i.test(cardName)) return true;
    if (/\bdemo\b/i.test(cardName)) return true;
    return false;
}

async function trelloFetch(url) {
    const response = await fetch(`${url}?key=${apiKey}&token=${token}`);
    if (response.status === 401) throw new Error('Unauthorized');
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
}

async function startLoop(targets) {
    postMessage({ type: 'log', msg: `Worker started. Monitoring ${targets.length} lists...` });

    const checkLists = async (isFirstRun = false) => {
        if (pollInFlight) {
            postMessage({ type: 'log', msg: 'Skipping poll — previous cycle still in flight.' });
            return;
        }
        pollInFlight = true;

        try {
            let globalTotal = 0;
            const bucketStats = [];
            let alarmTriggered = false;

            const fetchPromises = targets.map(async (target) => {
                try {
                    const rawCards = await trelloFetch(`https://api.trello.com/1/lists/${target.id}/cards`);
                    return { success: true, target, rawCards };
                } catch (error) {
                    return { success: false, target, error };
                }
            });

            const results = await Promise.all(fetchPromises);

            for (const result of results) {
                if (!result.success) {
                    if (result.error.message === 'Unauthorized') {
                        if (intervalId) clearInterval(intervalId);
                        intervalId = null;
                        postMessage({ type: 'auth_fail' });
                        return;
                    }
                    postMessage({ type: 'log', msg: `Sync error on ${result.target.name}: ${result.error.message}`, isError: true });
                    continue;
                }

                const { target, rawCards } = result;
                const activeCards = rawCards.filter((c) => !shouldIgnore(c.name));
                const currentSet = new Set(activeCards.map((c) => c.id));
                const previousSet = listStates[target.id] || new Set();

                if (!isFirstRun && !alarmTriggered) {
                    const newCard = activeCards.find((c) => !previousSet.has(c.id));
                    if (newCard) {
                        postMessage({
                            type: 'alarm',
                            cardName: newCard.name,
                            listName: target.name,
                        });
                        alarmTriggered = true;
                    }
                }

                listStates[target.id] = currentSet;
                const count = currentSet.size;
                globalTotal += count;
                bucketStats.push({
                    id: target.id,
                    name: target.name,
                    count,
                });
            }

            postMessage({
                type: 'stats',
                total: globalTotal,
                buckets: bucketStats,
            });
        } finally {
            pollInFlight = false;
        }
    };

    await checkLists(true);
    intervalId = setInterval(() => {
        checkLists(false);
    }, POLL_INTERVAL);
}
