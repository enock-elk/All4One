# Trello Watcher run logs

When a Trello Watcher run stops, All4One downloads a plain-text log file named like `trello-watch-2026-10-26T08-15-00-000Z.txt`.

Each file includes:

- run id
- start and stop timestamps
- board and watched lists
- alert mode
- alarm / error counts
- the console lines from that run

Browser apps cannot write into this git folder directly. Keep downloaded logs here if you want them in the repo.
