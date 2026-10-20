CREATE TABLE labels (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX labels_owner ON labels(owner);
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE login_limits (owner TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
