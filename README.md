# Kanban Studio

Kanban Studio can run in two modes:

- Open `index.html` directly: data is stored in the browser with `localStorage`.
- Run `server.py`: data is stored in `kanban.sqlite3` and the browser keeps a localStorage backup.

## SQLite Mode

From this folder, run:

```sh
python3 server.py
```

Then open:

```text
http://127.0.0.1:4173/
```

The default database file is:

```text
kanban.sqlite3
```

To keep the app and database in iCloud, move this whole folder into iCloud Drive and run `python3 server.py` from that synced folder on whichever Mac you are using.

## Important Sync Note

SQLite works best when only one Mac is actively writing to the database at a time. Let iCloud finish syncing before opening the app on the other Mac. If both Macs edit the same synced database at once, the most recent save can overwrite older changes.

## Custom Database Path

You can choose another database path:

```sh
python3 server.py --db "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Kanban/kanban.sqlite3"
```
