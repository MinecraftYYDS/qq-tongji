import { getDb } from '../db/sqlite';
import { pluginState } from '../core/state';
import { buildFeaturePayload } from '../handlers/stats-command-handler';
import { sendGroupMessage } from '../handlers/message-handler';

interface DueJob {
    id: number;
    group_id: string;
    hour: number;
    minute: number;
    feature: string;
}

function nowWithOffsetSeconds(): number {
    return Math.floor(Date.now() / 1000) + pluginState.config.timezoneOffsetMinutes * 60;
}

function currentHourMinute(): { hour: number; minute: number } {
    const date = new Date(nowWithOffsetSeconds() * 1000);
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}

async function runDueJobs(): Promise<void> {
    const { hour, minute } = currentHourMinute();
    const jobs = getDb().prepare(
        `SELECT id, group_id, hour, minute, feature
         FROM group_schedules
         WHERE enabled = 1 AND hour = ? AND minute = ?`
    ).all(hour, minute) as DueJob[];

    for (const job of jobs) {
        if (!pluginState.isGroupEnabled(job.group_id)) continue;
        const content = buildFeaturePayload(job.group_id, job.feature);
        const success = await sendGroupMessage(pluginState.ctx, job.group_id, content);
        if (!success && pluginState.config.scheduler.retryOnce) {
            await sendGroupMessage(pluginState.ctx, job.group_id, content);
        }
        getDb().prepare(`UPDATE group_schedules SET last_run_at=? WHERE id=?`)
            .run(Math.floor(Date.now() / 1000), job.id);
    }
}

export function startScheduler(): void {
    if (!pluginState.config.scheduler.enabled) return;
    stopScheduler();
    const intervalMs = Math.max(10, pluginState.config.scheduler.scanIntervalSeconds) * 1000;
    const timer = setInterval(() => {
        void runDueJobs();
    }, intervalMs);
    pluginState.timers.set('scheduler', timer);
}

export function stopScheduler(): void {
    const timer = pluginState.timers.get('scheduler');
    if (timer) {
        clearInterval(timer);
        pluginState.timers.delete('scheduler');
    }
}
