import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { pluginState } from '../core/state';
import { getDb } from '../db/sqlite';
import { registerStatsApiRoutes } from './stats-api-service';

export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    router.getNoAuth('/status', (_req, res) => {
        const db = getDb();
        const totalGroups = Number(db.prepare(`SELECT COUNT(DISTINCT group_id) as c FROM messages WHERE group_id IS NOT NULL`).get()?.c ?? 0);
        const totalMessages = Number(db.prepare(`SELECT COUNT(1) as c FROM messages`).get()?.c ?? 0);
        const recalledMessages = Number(db.prepare(`SELECT COUNT(1) as c FROM messages WHERE is_recall=1`).get()?.c ?? 0);
        res.json({
            code: 0,
            data: {
                pluginName: ctx.pluginName,
                uptime: pluginState.getUptime(),
                config: pluginState.config,
                stats: pluginState.stats,
                storage: {
                    totalGroups,
                    totalMessages,
                    recalledMessages,
                },
            },
        });
    });

    router.getNoAuth('/config', (_req, res) => {
        res.json({ code: 0, data: pluginState.config });
    });

    router.postNoAuth('/config', (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            if (!body) return res.status(400).json({ code: -1, message: '请求体为空' });
            pluginState.updateConfig(body as Partial<import('../types').PluginConfig>);
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    router.getNoAuth('/groups', async (_req, res) => {
        try {
            const groups = await ctx.actions.call(
                'get_group_list',
                {},
                ctx.adapterName,
                ctx.pluginManager.config
            ) as Array<{ group_id: number; group_name: string; member_count: number; max_member_count: number }>;

            const groupsWithConfig = (groups || []).map((group) => {
                const groupId = String(group.group_id);
                return {
                    group_id: group.group_id,
                    group_name: group.group_name,
                    member_count: group.member_count,
                    max_member_count: group.max_member_count,
                    enabled: pluginState.isGroupEnabled(groupId),
                };
            });

            res.json({ code: 0, data: groupsWithConfig });
        } catch (e) {
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    router.postNoAuth('/groups/:id/config', (req, res) => {
        try {
            const groupId = req.params?.id;
            if (!groupId) return res.status(400).json({ code: -1, message: '缺少群 ID' });

            const body = req.body as Record<string, unknown> | undefined;
            const enabled = body?.enabled;
            pluginState.updateGroupConfig(groupId, { enabled: Boolean(enabled) });
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    router.postNoAuth('/groups/bulk-config', (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            const { enabled, groupIds } = body || {};

            if (typeof enabled !== 'boolean' || !Array.isArray(groupIds)) {
                return res.status(400).json({ code: -1, message: '参数错误' });
            }

            for (const groupId of groupIds) {
                pluginState.updateGroupConfig(String(groupId), { enabled });
            }
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    registerStatsApiRoutes(ctx);
}
