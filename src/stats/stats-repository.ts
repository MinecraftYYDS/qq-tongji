import { getDb } from '../db/sqlite';

export interface TimeRangeInput {
    start?: number;
    end?: number;
    days?: number;
}

export function resolveTimeRange(range: TimeRangeInput, defaultDays: number): { start: number; end: number } {
    const now = Math.floor(Date.now() / 1000);
    const end = range.end ?? now;
    if (range.start !== undefined) return { start: range.start, end };
    const days = Math.max(1, range.days ?? defaultDays);
    return { start: end - days * 86400, end };
}

export class StatsRepository {
    countMessages(groupId: string, includeRecall: boolean, start: number, end: number): number {
        const db = getDb();
        const sql = `
          SELECT COUNT(1) as c FROM messages
          WHERE group_id = @groupId
            AND event_time BETWEEN @start AND @end
            ${includeRecall ? '' : 'AND is_recall = 0'}
        `;
        return Number(db.prepare(sql).get({ groupId, start, end })?.c ?? 0);
    }

    countUserMessages(groupId: string, userId: string, includeRecall: boolean, start: number, end: number): number {
        const db = getDb();
        const sql = `
          SELECT COUNT(1) as c FROM messages
          WHERE group_id = @groupId
            AND user_id = @userId
            AND event_time BETWEEN @start AND @end
            ${includeRecall ? '' : 'AND is_recall = 0'}
        `;
        return Number(db.prepare(sql).get({ groupId, userId, start, end })?.c ?? 0);
    }
}
