import type { OB11Message } from 'napcat-types/napcat-onebot';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { statsService } from '../stats/stats-service';
import { sendReply } from './message-handler';

function parseDays(input: string): number | null {
    const m = input.match(/^(\d+)d$/i);
    if (!m) return null;
    return Number(m[1]);
}

function formatFeatureOutput(groupId: string, feature: string): string {
    switch (feature) {
        case 'group_total':
            return `群总消息数: ${statsService.get_group_total_messages(groupId)}`;
        case 'group_total_delre':
            return `群总消息数(不含撤回): ${statsService.get_group_total_messages_delete_recall(groupId)}`;
        case 'top_users': {
            const top = statsService.get_group_top_users_delete_recall(groupId, 10);
            return ['群活跃 Top10:']
                .concat(top.map((x, i) => `${i + 1}. ${x.user_id}: ${x.count}`))
                .join('\n');
        }
        default:
            return `不支持的功能: ${feature}`;
    }
}

export async function handleStatsCommand(ctx: NapCatPluginContext, event: OB11Message, commandText: string): Promise<void> {
    const groupId = String(event.group_id ?? '');
    const args = commandText.split(/\s+/).filter(Boolean);
    if (args.length === 0) {
        await sendReply(ctx, event, [
            '#stats clean 7d',
            '#stats <HH> <MM> <feature>',
            '#stats schedule list',
            '#stats schedule remove <job_id>',
        ].join('\n'));
        return;
    }

    if (args[0] === 'clean' && args[1]) {
        const days = parseDays(args[1]);
        if (!days) {
            await sendReply(ctx, event, '参数格式错误，示例: #stats clean 7d');
            return;
        }
        const deleted = statsService.clean_data(days);
        await sendReply(ctx, event, `已清理 ${days} 天前数据，删除消息 ${deleted} 条`);
        return;
    }

    if (args[0] === 'schedule' && args[1] === 'list') {
        const jobs = statsService.list_group_schedules(groupId);
        if (jobs.length === 0) {
            await sendReply(ctx, event, '本群暂无定时任务');
            return;
        }
        await sendReply(
            ctx,
            event,
            jobs.map((j) => `#${j.id} ${String(j.hour).padStart(2, '0')}:${String(j.minute).padStart(2, '0')} ${j.feature}`).join('\n')
        );
        return;
    }

    if (args[0] === 'schedule' && args[1] === 'remove' && args[2]) {
        const id = Number(args[2]);
        const ok = statsService.remove_group_schedule(groupId, id);
        await sendReply(ctx, event, ok ? `任务 ${id} 已删除` : `任务 ${id} 不存在`);
        return;
    }

    if (args.length >= 3 && /^\d{1,2}$/.test(args[0]) && /^\d{1,2}$/.test(args[1])) {
        const hour = Number(args[0]);
        const minute = Number(args[1]);
        const feature = args[2];
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            await sendReply(ctx, event, '时间范围错误，小时 0-23，分钟 0-59');
            return;
        }
        const job = statsService.upsert_group_schedule(groupId, hour, minute, feature);
        await sendReply(
            ctx,
            event,
            `任务已设置: #${job.id} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${feature}`
        );
        return;
    }

    if (args[0] === 'run' && args[1]) {
        await sendReply(ctx, event, formatFeatureOutput(groupId, args[1]));
        return;
    }

    await sendReply(ctx, event, '未知命令，输入 #stats 查看帮助');
}

export function buildFeaturePayload(groupId: string, feature: string): string {
    return formatFeatureOutput(groupId, feature);
}
