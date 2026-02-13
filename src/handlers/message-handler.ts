import type { OB11Message, OB11PostSendMsg } from 'napcat-types/napcat-onebot';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { pluginState } from '../core/state';
import { collectMessage } from '../collector/event-collector';
import { handleStatsCommand } from './stats-command-handler';

export async function sendGroupMessage(
    ctx: NapCatPluginContext,
    groupId: number | string,
    message: OB11PostSendMsg['message']
): Promise<boolean> {
    try {
        const params: OB11PostSendMsg = {
            message,
            message_type: 'group',
            group_id: String(groupId),
        };
        await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
        return true;
    } catch (error) {
        pluginState.logger.error('发送群消息失败', error);
        return false;
    }
}

export async function sendReply(
    ctx: NapCatPluginContext,
    event: OB11Message,
    message: OB11PostSendMsg['message']
): Promise<boolean> {
    try {
        const params: OB11PostSendMsg = {
            message,
            message_type: event.message_type,
            ...(event.message_type === 'group' && event.group_id ? { group_id: String(event.group_id) } : {}),
            ...(event.user_id ? { user_id: String(event.user_id) } : {}),
        };
        await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
        return true;
    } catch (error) {
        pluginState.logger.error('发送回复消息失败', error);
        return false;
    }
}

export async function handleMessage(ctx: NapCatPluginContext, event: OB11Message): Promise<void> {
    try {
        if (!pluginState.config.enabled) return;
        collectMessage(event);

        const raw = event.raw_message || '';
        const prefix = pluginState.config.commandPrefix || '#stats';
        if (!raw.startsWith(prefix)) return;
        if (event.message_type !== 'group' || !event.group_id) return;
        if (!pluginState.isGroupEnabled(String(event.group_id))) return;

        pluginState.bumpStat('commandCalls');
        await handleStatsCommand(ctx, event, raw.slice(prefix.length).trim());
    } catch (error) {
        pluginState.logger.error('处理消息失败', error);
    }
}
