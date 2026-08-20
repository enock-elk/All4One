import { createTrelloWatcher } from './trello-poller.js';

const watcher = createTrelloWatcher((msg) => self.postMessage(msg));

self.onmessage = (e) => {
    const { cmd, payload } = e.data || {};
    if (cmd === 'start') watcher.start(payload);
    else if (cmd === 'stop') watcher.stop();
};
