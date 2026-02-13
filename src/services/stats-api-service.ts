import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { statsService } from '../stats/stats-service';

function toNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function queryRange(req: { query?: Record<string, unknown> }): { start?: number; end?: number; days?: number } {
    return {
        start: toNumber(req.query?.start),
        end: toNumber(req.query?.end),
        days: toNumber(req.query?.days),
    };
}

function queryLimit(req: { query?: Record<string, unknown> }, fallback: number): number {
    const n = toNumber(req.query?.limit);
    return n ? Math.max(1, Math.floor(n)) : fallback;
}

function safeRoute(handler: () => unknown): { code: number; data?: unknown; message?: string } {
    try {
        return { code: 0, data: handler() };
    } catch (error) {
        return { code: -1, message: String(error) };
    }
}

export function registerStatsApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    const base = '/api/stats';

    router.getNoAuth(`${base}/group/:group_id/total_messages`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_total_messages(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/total_messages_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_total_messages_delete_recall(req.params.group_id, queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/user/:user_id/total_messages`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_total_messages(req.params.group_id, req.params.user_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/user/:user_id/total_messages_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_total_messages_delete_recall(req.params.group_id, req.params.user_id, queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/top_users`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_top_users(req.params.group_id, queryLimit(req, 10), queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/top_users_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_top_users_delete_recall(req.params.group_id, queryLimit(req, 10), queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/heatmap`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_heatmap(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/heatmap_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_heatmap_delete_recall(req.params.group_id, queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/keywords`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_keyword_stats(req.params.group_id, queryLimit(req, 50), queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/keywords_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_keyword_stats_delete_recall(req.params.group_id, queryLimit(req, 50), queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/message_types`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_message_types(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/message_types_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_message_types_delete_recall(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/user/:user_id/message_types`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_message_types(req.params.group_id, req.params.user_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/user/:user_id/message_types_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_message_types_delete_recall(req.params.group_id, req.params.user_id, queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/daily_messages`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_daily_messages(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/daily_messages_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_daily_messages_delete_recall(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/hourly_messages`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_hourly_messages(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/hourly_messages_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_hourly_messages_delete_recall(req.params.group_id, queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/user/:user_id/hourly_activity`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_hourly_activity(req.params.group_id, req.params.user_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/user/:user_id/hourly_activity_without_recall`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_hourly_activity_delete_recall(req.params.group_id, req.params.user_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/user/:user_id/active_days`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_active_days(req.params.group_id, req.params.user_id, queryRange(req))));
    });

    router.getNoAuth(`${base}/group/:group_id/burst_events`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_burst_events(req.params.group_id, queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/silent_events`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_silent_events(req.params.group_id)));
    });
    router.getNoAuth(`${base}/group/:group_id/active_users`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_active_users(req.params.group_id, toNumber(req.query?.days) ?? 7)));
    });
    router.getNoAuth(`${base}/group/:group_id/inactive_users`, (req, res) => {
        res.json(safeRoute(() => statsService.get_group_inactive_users(req.params.group_id, toNumber(req.query?.days) ?? 7)));
    });

    router.getNoAuth(`${base}/group/:group_id/user/:user_id/keywords`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_keyword_stats(req.params.group_id, req.params.user_id, queryLimit(req, 50), queryRange(req))));
    });
    router.getNoAuth(`${base}/group/:group_id/user/:user_id/at_stats`, (req, res) => {
        res.json(safeRoute(() => statsService.get_user_at_stats(req.params.group_id, req.params.user_id, queryRange(req))));
    });

    router.postNoAuth(`${base}/clean`, (req, res) => {
        const days = toNumber(req.query?.days) ?? 7;
        res.json(safeRoute(() => ({ deleted: statsService.clean_data(days) })));
    });
    router.postNoAuth(`${base}/set_period`, (req, res) => {
        const days = toNumber(req.query?.days) ?? 30;
        res.json(safeRoute(() => {
            statsService.set_stat_period(days);
            return { days };
        }));
    });
    router.postNoAuth(`${base}/enable`, (req, res) => {
        const feature = String(req.query?.feature ?? '');
        res.json(safeRoute(() => {
            statsService.enable_feature(feature);
            return { feature, enabled: true };
        }));
    });
    router.postNoAuth(`${base}/disable`, (req, res) => {
        const feature = String(req.query?.feature ?? '');
        res.json(safeRoute(() => {
            statsService.disable_feature(feature);
            return { feature, enabled: false };
        }));
    });

    router.getNoAuth(`${base}/group/:group_id/schedules`, (req, res) => {
        res.json(safeRoute(() => statsService.list_group_schedules(req.params.group_id)));
    });
    router.postNoAuth(`${base}/group/:group_id/schedules`, (req, res) => {
        const body = req.body as Record<string, unknown> | undefined;
        const hour = toNumber(body?.hour) ?? 0;
        const minute = toNumber(body?.minute) ?? 0;
        const feature = String(body?.feature ?? '');
        res.json(safeRoute(() => statsService.upsert_group_schedule(req.params.group_id, hour, minute, feature)));
    });
    router.postNoAuth(`${base}/group/:group_id/schedules/remove`, (req, res) => {
        const body = req.body as Record<string, unknown> | undefined;
        const id = toNumber(body?.id) ?? 0;
        res.json(safeRoute(() => ({ removed: statsService.remove_group_schedule(req.params.group_id, id) })));
    });

    ctx.logger.info('统计 API 路由注册完成');
}
