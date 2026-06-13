#!/usr/bin/env python3
import argparse
import json
import sqlite3
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
WORKSPACE_KEY = "workspace"


class KanbanHandler(SimpleHTTPRequestHandler):
    db_path = APP_DIR / "kanban.sqlite3"

    def do_GET(self):
        if self.path == "/api/workspace":
            self.handle_get_workspace()
            return
        super().do_GET()

    def do_PUT(self):
        if self.path == "/api/workspace":
            self.handle_put_workspace()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def handle_get_workspace(self):
        ensure_db(self.db_path)
        with sqlite3.connect(self.db_path) as connection:
            row = connection.execute(
                "select value from app_state where key = ?",
                (WORKSPACE_KEY,),
            ).fetchone()

        if not row:
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return

        self.send_json(json.loads(row[0]))

    def handle_put_workspace(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 10_000_000:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid request body")
            return

        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        if not isinstance(payload, dict) or "boards" not in payload:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid workspace")
            return

        ensure_db(self.db_path)
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                insert into app_state(key, value, updated_at)
                values(?, ?, datetime('now'))
                on conflict(key) do update set
                  value = excluded.value,
                  updated_at = excluded.updated_at
                """,
                (WORKSPACE_KEY, json.dumps(payload, separators=(",", ":"))),
            )
            connection.commit()

        self.send_json({"ok": True})

    def send_json(self, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def ensure_db(db_path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.execute("pragma busy_timeout = 5000")
        connection.execute("pragma journal_mode = delete")
        connection.execute(
            """
            create table if not exists app_state (
              key text primary key,
              value text not null,
              updated_at text not null default (datetime('now'))
            )
            """
        )
        connection.commit()


def main():
    parser = argparse.ArgumentParser(description="Serve Kanban Studio with a SQLite-backed workspace.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=4173, type=int)
    parser.add_argument("--db", default=str(APP_DIR / "kanban.sqlite3"))
    args = parser.parse_args()

    KanbanHandler.db_path = Path(args.db).expanduser().resolve()
    ensure_db(KanbanHandler.db_path)

    server = ThreadingHTTPServer((args.host, args.port), KanbanHandler)
    print(f"Kanban Studio: http://{args.host}:{args.port}/")
    print(f"SQLite database: {KanbanHandler.db_path}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
