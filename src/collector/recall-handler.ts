import { getDb } from '../db/sqlite';
import { pluginState } from '../core/state';

export function markMessageRecalled(messageId: string, recalledAt: number): boolean {
    if (!messageId) return false;
    const result = getDb().prepare(
        `UPDATE messages SET is_recall=1, recalled_at=@recalledAt WHERE message_id=@messageId`
    ).run({ messageId, recalledAt });
    if (result.changes > 0) {
        pluginState.bumpStat('recalled');
        return true;
    }
    pluginState.logger.warn(`收到未匹配到消息的撤回事件 message_id=${messageId}`);
    return false;
}
