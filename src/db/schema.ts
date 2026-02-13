export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  group_id TEXT,
  user_id TEXT,
  chat_type TEXT NOT NULL,
  message_type TEXT NOT NULL,
  event_time INTEGER NOT NULL,
  content_text TEXT DEFAULT '',
  raw_message TEXT DEFAULT '',
  is_recall INTEGER NOT NULL DEFAULT 0,
  recalled_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_member_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_time INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_file_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_id TEXT,
  file_name TEXT,
  file_size INTEGER DEFAULT 0,
  event_time INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stat_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  hour INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  feature TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_messages_group_time ON messages(group_id, event_time);
CREATE INDEX IF NOT EXISTS idx_messages_group_user_time ON messages(group_id, user_id, event_time);
CREATE INDEX IF NOT EXISTS idx_messages_group_recall_time ON messages(group_id, is_recall, event_time);
CREATE INDEX IF NOT EXISTS idx_messages_type_time ON messages(message_type, event_time);
CREATE INDEX IF NOT EXISTS idx_group_schedules_group_enabled ON group_schedules(group_id, enabled);
`;
