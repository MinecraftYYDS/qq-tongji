import { getDb } from './sqlite';

export function runMigrations(): void {
    const db = getDb();
    db.exec(`
      INSERT OR IGNORE INTO stat_settings(key, value) VALUES ('stat_period_days', '30');
      INSERT OR IGNORE INTO stat_settings(key, value) VALUES ('timezone_offset_minutes', '480');
    `);
}
