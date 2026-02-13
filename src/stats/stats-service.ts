import { getDb } from '../db/sqlite';
import { pluginState } from '../core/state';
import type { GroupSchedule } from '../types';
import { extractMentions, tokenize } from './tokenizer';
import { resolveTimeRange, StatsRepository, type TimeRangeInput } from './stats-repository';

const repo = new StatsRepository();

function recallSql(includeRecall: boolean): string {
    return includeRecall ? '' : 'AND is_recall = 0';
}

function activeRange(range?: TimeRangeInput): { start: number; end: number } {
    return resolveTimeRange(range ?? {}, pluginState.config.statPeriodDays);
}

function rows<T>(sql: string, params: Record<string, unknown>): T[] {
    return getDb().prepare(sql).all(params) as T[];
}

function row<T>(sql: string, params: Record<string, unknown>): T | undefined {
    return getDb().prepare(sql).get(params) as T | undefined;
}

function percentile(values: number[], q: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor((sorted.length - 1) * q);
    return sorted[idx] ?? 0;
}

export const statsService = {
    get_group_total_messages(groupId: string, range?: TimeRangeInput): number {
        const { start, end } = activeRange(range);
        return repo.countMessages(groupId, true, start, end);
    },
    get_group_total_messages_delete_recall(groupId: string, range?: TimeRangeInput): number {
        const { start, end } = activeRange(range);
        return repo.countMessages(groupId, false, start, end);
    },
    get_user_total_messages(groupId: string, userId: string, range?: TimeRangeInput): number {
        const { start, end } = activeRange(range);
        return repo.countUserMessages(groupId, userId, true, start, end);
    },
    get_user_total_messages_delete_recall(groupId: string, userId: string, range?: TimeRangeInput): number {
        const { start, end } = activeRange(range);
        return repo.countUserMessages(groupId, userId, false, start, end);
    },
    get_group_top_users(groupId: string, limit = 10, range?: TimeRangeInput): Array<{ user_id: string; count: number }> {
        const { start, end } = activeRange(range);
        return rows<{ user_id: string; count: number }>(
            `SELECT user_id, COUNT(1) AS count
             FROM messages
             WHERE group_id=@groupId AND event_time BETWEEN @start AND @end
             GROUP BY user_id
             ORDER BY count DESC
             LIMIT @limit`,
            { groupId, start, end, limit }
        );
    },
    get_group_top_users_delete_recall(groupId: string, limit = 10, range?: TimeRangeInput): Array<{ user_id: string; count: number }> {
        const { start, end } = activeRange(range);
        return rows<{ user_id: string; count: number }>(
            `SELECT user_id, COUNT(1) AS count
             FROM messages
             WHERE group_id=@groupId AND event_time BETWEEN @start AND @end AND is_recall = 0
             GROUP BY user_id
             ORDER BY count DESC
             LIMIT @limit`,
            { groupId, start, end, limit }
        );
    },
    get_group_heatmap(groupId: string, range?: TimeRangeInput): { hourly: number[]; weekly: number[] } {
        return this._build_heatmap(groupId, true, range);
    },
    get_group_heatmap_delete_recall(groupId: string, range?: TimeRangeInput): { hourly: number[]; weekly: number[] } {
        return this._build_heatmap(groupId, false, range);
    },
    _build_heatmap(groupId: string, includeRecall: boolean, range?: TimeRangeInput): { hourly: number[]; weekly: number[] } {
        const { start, end } = activeRange(range);
        const hourly = Array.from({ length: 24 }, () => 0);
        const weekly = Array.from({ length: 7 }, () => 0);
        const data = rows<{ event_time: number }>(
            `SELECT event_time FROM messages
             WHERE group_id=@groupId AND event_time BETWEEN @start AND @end ${recallSql(includeRecall)}`,
            { groupId, start, end }
        );
        const offset = pluginState.config.timezoneOffsetMinutes * 60;
        for (const item of data) {
            const date = new Date((item.event_time + offset) * 1000);
            hourly[date.getUTCHours()] += 1;
            weekly[(date.getUTCDay() + 6) % 7] += 1;
        }
        return { hourly, weekly };
    },
    get_group_keyword_stats(groupId: string, limit = 50, range?: TimeRangeInput): Array<{ keyword: string; count: number }> {
        return this._keyword_stats(groupId, undefined, true, limit, range);
    },
    get_group_keyword_stats_delete_recall(groupId: string, limit = 50, range?: TimeRangeInput): Array<{ keyword: string; count: number }> {
        return this._keyword_stats(groupId, undefined, false, limit, range);
    },
    get_group_message_types(groupId: string, range?: TimeRangeInput): Array<{ message_type: string; count: number }> {
        return this._message_types(groupId, undefined, true, range);
    },
    get_group_message_types_delete_recall(groupId: string, range?: TimeRangeInput): Array<{ message_type: string; count: number }> {
        return this._message_types(groupId, undefined, false, range);
    },
    get_user_message_types(groupId: string, userId: string, range?: TimeRangeInput): Array<{ message_type: string; count: number }> {
        return this._message_types(groupId, userId, true, range);
    },
    get_user_message_types_delete_recall(groupId: string, userId: string, range?: TimeRangeInput): Array<{ message_type: string; count: number }> {
        return this._message_types(groupId, userId, false, range);
    },
    _message_types(groupId: string, userId: string | undefined, includeRecall: boolean, range?: TimeRangeInput): Array<{ message_type: string; count: number }> {
        const { start, end } = activeRange(range);
        return rows<{ message_type: string; count: number }>(
            `SELECT message_type, COUNT(1) as count
             FROM messages
             WHERE group_id=@groupId
               ${userId ? 'AND user_id=@userId' : ''}
               AND event_time BETWEEN @start AND @end
               ${recallSql(includeRecall)}
             GROUP BY message_type
             ORDER BY count DESC`,
            { groupId, userId, start, end }
        );
    },
    get_group_daily_messages(groupId: string, range?: TimeRangeInput): Array<{ day: string; count: number }> {
        return this._group_daily(groupId, true, range);
    },
    get_group_daily_messages_delete_recall(groupId: string, range?: TimeRangeInput): Array<{ day: string; count: number }> {
        return this._group_daily(groupId, false, range);
    },
    _group_daily(groupId: string, includeRecall: boolean, range?: TimeRangeInput): Array<{ day: string; count: number }> {
        const { start, end } = activeRange(range);
        const offset = pluginState.config.timezoneOffsetMinutes * 60;
        return rows<{ day: string; count: number }>(
            `SELECT strftime('%Y-%m-%d', datetime(event_time + @offset, 'unixepoch')) as day, COUNT(1) as count
             FROM messages
             WHERE group_id=@groupId AND event_time BETWEEN @start AND @end ${recallSql(includeRecall)}
             GROUP BY day
             ORDER BY day ASC`,
            { groupId, start, end, offset }
        );
    },
    get_group_hourly_messages(groupId: string, range?: TimeRangeInput): Array<{ hour: number; count: number }> {
        return this._group_hourly(groupId, true, range);
    },
    get_group_hourly_messages_delete_recall(groupId: string, range?: TimeRangeInput): Array<{ hour: number; count: number }> {
        return this._group_hourly(groupId, false, range);
    },
    _group_hourly(groupId: string, includeRecall: boolean, range?: TimeRangeInput): Array<{ hour: number; count: number }> {
        const { start, end } = activeRange(range);
        const offset = pluginState.config.timezoneOffsetMinutes * 60;
        return rows<{ hour: number; count: number }>(
            `SELECT CAST(strftime('%H', datetime(event_time + @offset, 'unixepoch')) AS INTEGER) as hour, COUNT(1) as count
             FROM messages
             WHERE group_id=@groupId AND event_time BETWEEN @start AND @end ${recallSql(includeRecall)}
             GROUP BY hour
             ORDER BY hour ASC`,
            { groupId, start, end, offset }
        );
    },
    get_user_hourly_activity(groupId: string, userId: string, range?: TimeRangeInput): Array<{ hour: number; count: number }> {
        return this._user_hourly_activity(groupId, userId, true, range);
    },
    get_user_hourly_activity_delete_recall(groupId: string, userId: string, range?: TimeRangeInput): Array<{ hour: number; count: number }> {
        return this._user_hourly_activity(groupId, userId, false, range);
    },
    _user_hourly_activity(groupId: string, userId: string, includeRecall: boolean, range?: TimeRangeInput): Array<{ hour: number; count: number }> {
        const { start, end } = activeRange(range);
        const offset = pluginState.config.timezoneOffsetMinutes * 60;
        return rows<{ hour: number; count: number }>(
            `SELECT CAST(strftime('%H', datetime(event_time + @offset, 'unixepoch')) AS INTEGER) as hour, COUNT(1) as count
             FROM messages
             WHERE group_id=@groupId AND user_id=@userId
               AND event_time BETWEEN @start AND @end ${recallSql(includeRecall)}
             GROUP BY hour
             ORDER BY hour ASC`,
            { groupId, userId, start, end, offset }
        );
    },
    get_user_active_days(groupId: string, userId: string, range?: TimeRangeInput): number {
        const { start, end } = activeRange(range);
        const offset = pluginState.config.timezoneOffsetMinutes * 60;
        const item = row<{ c: number }>(
            `SELECT COUNT(DISTINCT strftime('%Y-%m-%d', datetime(event_time + @offset, 'unixepoch'))) as c
             FROM messages
             WHERE group_id=@groupId AND user_id=@userId AND event_time BETWEEN @start AND @end`,
            { groupId, userId, start, end, offset }
        );
        return Number(item?.c ?? 0);
    },
    get_group_burst_events(groupId: string, range?: TimeRangeInput): Array<{ window_start: number; count: number; participants: string[] }> {
        const { start, end } = activeRange(range);
        const burst = pluginState.config.burst;
        const windowSec = burst.windowMinutes * 60;
        const grouped = rows<{ bucket: number; count: number }>(
            `SELECT (event_time / @windowSec) * @windowSec as bucket, COUNT(1) as count
             FROM messages
             WHERE group_id=@groupId AND event_time BETWEEN @start AND @end AND is_recall = 0
             GROUP BY bucket`,
            { groupId, start, end, windowSec }
        );
        const counts = grouped.map((g) => g.count);
        if (counts.length === 0) return [];
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / counts.length;
        const threshold = Math.max(burst.minMessages, mean + burst.sigma * Math.sqrt(variance));
        const events: Array<{ window_start: number; count: number; participants: string[] }> = [];
        for (const g of grouped) {
            if (g.count < threshold) continue;
            const users = rows<{ user_id: string }>(
                `SELECT DISTINCT user_id FROM messages
                 WHERE group_id=@groupId AND event_time BETWEEN @start AND @end`,
                { groupId, start: g.bucket, end: g.bucket + windowSec - 1 }
            ).map((x) => x.user_id);
            events.push({ window_start: g.bucket, count: g.count, participants: users });
        }
        return events;
    },
    get_group_silent_events(groupId: string): Array<{ start: number; end: number; message_count: number; cold_users: string[] }> {
        const now = Math.floor(Date.now() / 1000);
        const cfg = pluginState.config.silent;
        const recentStart = now - cfg.recentHours * 3600;
        const baselineStart = now - cfg.baselineDays * 86400;
        const db = getDb();
        const currentCount = Number(
            db.prepare(`SELECT COUNT(1) as c FROM messages WHERE group_id=? AND event_time BETWEEN ? AND ? AND is_recall=0`)
                .get(groupId, recentStart, now)?.c ?? 0
        );
        const samples = rows<{ c: number }>(
            `SELECT COUNT(1) as c
             FROM messages
             WHERE group_id=@groupId
               AND event_time BETWEEN @baselineStart AND @now
               AND is_recall=0
             GROUP BY ((@now - event_time) / @slot)`,
            { groupId, baselineStart, now, slot: cfg.recentHours * 3600 }
        ).map((x) => x.c);
        const threshold = percentile(samples, cfg.quantile);
        if (currentCount > threshold) return [];
        const coldUsers = rows<{ user_id: string }>(
            `SELECT DISTINCT user_id FROM messages
             WHERE group_id=@groupId
               AND event_time BETWEEN @activeStart AND @now
               AND user_id NOT IN (
                 SELECT DISTINCT user_id FROM messages
                 WHERE group_id=@groupId AND event_time BETWEEN @recentStart AND @now
               )`,
            { groupId, activeStart: now - 30 * 86400, recentStart, now }
        ).map((x) => x.user_id);
        return [{
            start: recentStart,
            end: now,
            message_count: currentCount,
            cold_users: coldUsers,
        }];
    },
    get_group_active_users(groupId: string, days = 7): Array<{ user_id: string; count: number }> {
        return this.get_group_top_users_delete_recall(groupId, 200, { days });
    },
    get_group_inactive_users(groupId: string, days = 7): Array<{ user_id: string }> {
        const now = Math.floor(Date.now() / 1000);
        const start = now - days * 86400;
        return rows<{ user_id: string }>(
            `SELECT DISTINCT user_id FROM messages
             WHERE group_id=@groupId
               AND event_time BETWEEN @historyStart AND @start
               AND user_id NOT IN (
                 SELECT DISTINCT user_id FROM messages
                 WHERE group_id=@groupId AND event_time BETWEEN @start AND @now
               )`,
            { groupId, historyStart: start - 30 * 86400, start, now }
        );
    },
    get_user_keyword_stats(groupId: string, userId: string, limit = 50, range?: TimeRangeInput): Array<{ keyword: string; count: number }> {
        return this._keyword_stats(groupId, userId, true, limit, range);
    },
    get_user_at_stats(groupId: string, userId: string, range?: TimeRangeInput): Array<{ target_user_id: string; count: number }> {
        const { start, end } = activeRange(range);
        const list = rows<{ content_text: string }>(
            `SELECT content_text FROM messages
             WHERE group_id=@groupId AND user_id=@userId AND event_time BETWEEN @start AND @end`,
            { groupId, userId, start, end }
        );
        const map = new Map<string, number>();
        for (const item of list) {
            for (const target of extractMentions(item.content_text || '')) {
                map.set(target, (map.get(target) ?? 0) + 1);
            }
        }
        return Array.from(map.entries())
            .map(([target_user_id, count]) => ({ target_user_id, count }))
            .sort((a, b) => b.count - a.count);
    },
    _keyword_stats(groupId: string, userId: string | undefined, includeRecall: boolean, limit: number, range?: TimeRangeInput): Array<{ keyword: string; count: number }> {
        if (!pluginState.config.featureFlags.keyword) return [];
        const { start, end } = activeRange(range);
        const list = rows<{ content_text: string }>(
            `SELECT content_text FROM messages
             WHERE group_id=@groupId
               ${userId ? 'AND user_id=@userId' : ''}
               AND event_time BETWEEN @start AND @end
               ${recallSql(includeRecall)}
               AND message_type='text'`,
            { groupId, userId, start, end }
        );
        const map = new Map<string, number>();
        for (const item of list) {
            for (const word of tokenize(item.content_text || '')) {
                map.set(word, (map.get(word) ?? 0) + 1);
            }
        }
        return Array.from(map.entries())
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    },
    clean_data(days: number): number {
        const db = getDb();
        const threshold = Math.floor(Date.now() / 1000) - Math.max(1, days) * 86400;
        const result = db.prepare(`DELETE FROM messages WHERE event_time < ?`).run(threshold);
        db.prepare(`DELETE FROM group_member_events WHERE event_time < ?`).run(threshold);
        db.prepare(`DELETE FROM group_file_events WHERE event_time < ?`).run(threshold);
        return result.changes;
    },
    set_stat_period(days: number): void {
        const d = Math.max(1, days);
        pluginState.updateConfig({ statPeriodDays: d });
        getDb().prepare(`
          INSERT INTO stat_settings(key, value) VALUES ('stat_period_days', @value)
          ON CONFLICT(key) DO UPDATE SET value=@value
        `).run({ value: String(d) });
    },
    enable_feature(name: string): void {
        this._set_feature(name, true);
    },
    disable_feature(name: string): void {
        this._set_feature(name, false);
    },
    _set_feature(name: string, enabled: boolean): void {
        const db = getDb();
        db.prepare(`
          INSERT INTO feature_flags(name, enabled) VALUES (@name, @enabled)
          ON CONFLICT(name) DO UPDATE SET enabled=@enabled
        `).run({ name, enabled: enabled ? 1 : 0 });
        if (name in pluginState.config.featureFlags) {
            pluginState.updateConfig({
                featureFlags: {
                    ...pluginState.config.featureFlags,
                    [name]: enabled,
                },
            });
        }
    },
    list_group_schedules(groupId: string): GroupSchedule[] {
        return rows<GroupSchedule>(
            `SELECT id, group_id as groupId, hour, minute, feature, enabled, last_run_at as lastRunAt
             FROM group_schedules
             WHERE group_id=@groupId
             ORDER BY hour ASC, minute ASC`,
            { groupId }
        );
    },
    upsert_group_schedule(groupId: string, hour: number, minute: number, feature: string): GroupSchedule {
        const db = getDb();
        const existed = db.prepare(
            `SELECT id FROM group_schedules WHERE group_id=? AND hour=? AND minute=? AND feature=?`
        ).get(groupId, hour, minute, feature) as { id?: number } | undefined;
        if (existed?.id) {
            db.prepare(`UPDATE group_schedules SET enabled=1 WHERE id=?`).run(existed.id);
            return { id: existed.id, groupId, hour, minute, feature, enabled: true };
        }
        const result = db.prepare(
            `INSERT INTO group_schedules(group_id, hour, minute, feature, enabled) VALUES (?, ?, ?, ?, 1)`
        ).run(groupId, hour, minute, feature);
        return { id: Number(result.lastInsertRowid), groupId, hour, minute, feature, enabled: true };
    },
    remove_group_schedule(groupId: string, id: number): boolean {
        const changes = getDb().prepare(`DELETE FROM group_schedules WHERE id=? AND group_id=?`).run(id, groupId).changes;
        return changes > 0;
    },
};
