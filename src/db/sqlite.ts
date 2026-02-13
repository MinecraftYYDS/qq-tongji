import Database from 'better-sqlite3';
import { pluginState } from '../core/state';
import { SCHEMA_SQL } from './schema';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) throw new Error('数据库尚未初始化');
    return db;
}

export function initDb(): Database.Database {
    if (db) return db;
    const dbPath = pluginState.getDataFilePath('stats.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(SCHEMA_SQL);
    return db;
}

export function closeDb(): void {
    if (db) {
        db.close();
        db = null;
    }
}
