export type MessageType = 'text' | 'image' | 'voice' | 'video' | 'file' | 'face' | 'other';
export type ChatType = 'group' | 'private';

export interface FeatureFlags {
    keyword: boolean;
    heatmap: boolean;
    burst: boolean;
    silent: boolean;
    typeStats: boolean;
    userContent: boolean;
}

export interface KeywordConfig {
    minWordLength: number;
    defaultLimit: number;
    stopWords: string[];
}

export interface SchedulerConfig {
    enabled: boolean;
    retryOnce: boolean;
    scanIntervalSeconds: number;
}

export interface BurstConfig {
    windowMinutes: number;
    lookbackDays: number;
    sigma: number;
    minMessages: number;
}

export interface SilentConfig {
    recentHours: number;
    baselineDays: number;
    quantile: number;
}

export interface GroupConfig {
    enabled?: boolean;
}

export interface PluginConfig {
    enabled: boolean;
    debug: boolean;
    commandPrefix: string;
    timezoneOffsetMinutes: number;
    collectPrivateMessages: boolean;
    collectGroupFiles: boolean;
    storeMessageContent: boolean;
    statPeriodDays: number;
    featureFlags: FeatureFlags;
    keyword: KeywordConfig;
    scheduler: SchedulerConfig;
    burst: BurstConfig;
    silent: SilentConfig;
    groupConfigs: Record<string, GroupConfig>;
}

export interface ApiResponse<T = unknown> {
    code: number;
    message?: string;
    data?: T;
}

export interface MessageRecord {
    messageId: string;
    groupId: string | null;
    userId: string | null;
    chatType: ChatType;
    messageType: MessageType;
    eventTime: number;
    contentText: string;
    rawMessage: string;
}

export interface GroupSchedule {
    id?: number;
    groupId: string;
    hour: number;
    minute: number;
    feature: string;
    enabled: boolean;
    lastRunAt?: number | null;
}
