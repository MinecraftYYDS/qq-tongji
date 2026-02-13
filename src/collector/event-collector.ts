import type { OB11Message } from 'napcat-types/napcat-onebot';
import { getDb } from '../db/sqlite';
import { pluginState } from '../core/state';
import type { MessageRecord, MessageType } from '../types';
import { markMessageRecalled } from './recall-handler';

function detectMessageType(event: OB11Message): MessageType {
    if (Array.isArray(event.message)) {
        const first = event.message[0]?.type;
        if (first === 'text') return 'text';
        if (first === 'image') return 'image';
        if (first === 'record') return 'voice';
        if (first === 'video') return 'video';
        if (first === 'file') return 'file';
        if (first === 'face') return 'face';
        return 'other';
    }
    return event.raw_message ? 'text' : 'other';
}

function toMessageRecord(event: OB11Message): MessageRecord {
    const chatType = event.message_type === 'private' ? 'private' : 'group';
    const messageType = detectMessageType(event);
    const eventTime = Number((event as { time?: number }).time ?? Math.floor(Date.now() / 1000));
    return {
        messageId: String(event.message_id ?? `${chatType}-${event.user_id}-${eventTime}`),
        groupId: event.group_id ? String(event.group_id) : null,
        userId: event.user_id ? String(event.user_id) : null,
        chatType,
        messageType,
        eventTime,
        contentText: pluginState.config.storeMessageContent ? (event.raw_message ?? '') : '',
        rawMessage: pluginState.config.storeMessageContent ? JSON.stringify(event.message ?? '') : '',
    };
}

export function collectMessage(event: OB11Message): void {
    const record = toMessageRecord(event);
    if (record.chatType === 'private' && !pluginState.config.collectPrivateMessages) return;
    if (record.chatType === 'group' && record.groupId && !pluginState.isGroupEnabled(record.groupId)) return;

    getDb().prepare(`
      INSERT OR IGNORE INTO messages(
        message_id, group_id, user_id, chat_type, message_type, event_time,
        content_text, raw_message, created_at
      ) VALUES (
        @messageId, @groupId, @userId, @chatType, @messageType, @eventTime,
        @contentText, @rawMessage, @createdAt
      )
    `).run({ ...record, createdAt: Math.floor(Date.now() / 1000) });
    pluginState.bumpStat('collected');
}

function readNested(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const p of path) {
        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[p];
    }
    return current;
}

export function collectEvent(event: Record<string, unknown>): void {
    const noticeType = String(event.notice_type ?? '');
    const eventTime = Number(event.time ?? Math.floor(Date.now() / 1000));

    if (noticeType === 'group_recall' || noticeType === 'friend_recall') {
        const messageId = String(event.message_id ?? '');
        markMessageRecalled(messageId, eventTime);
        return;
    }

    if (noticeType === 'group_increase' || noticeType === 'group_decrease') {
        const groupId = String(event.group_id ?? '');
        const userId = String(event.user_id ?? '');
        if (!groupId || !userId) return;
        getDb().prepare(`
          INSERT INTO group_member_events(group_id, user_id, event_type, event_time)
          VALUES (?, ?, ?, ?)
        `).run(groupId, userId, noticeType, eventTime);
        return;
    }

    if (!pluginState.config.collectGroupFiles) return;
    if (noticeType === 'group_upload') {
        const groupId = String(event.group_id ?? '');
        const userId = String(event.user_id ?? '');
        if (!groupId || !userId) return;
        const fileObj = readNested(event, ['file']) as Record<string, unknown> | undefined;
        const fileId = String(fileObj?.id ?? fileObj?.fid ?? '');
        const fileName = String(fileObj?.name ?? '');
        const fileSize = Number(fileObj?.size ?? 0);
        getDb().prepare(`
          INSERT INTO group_file_events(group_id, user_id, file_id, file_name, file_size, event_time)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(groupId, userId, fileId, fileName, fileSize, eventTime);
    }
}
