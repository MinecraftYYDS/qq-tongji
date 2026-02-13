export interface ApiResponse<T = unknown> {
    code: number;
    data?: T;
    message?: string;
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
    featureFlags: Record<string, boolean>;
    cooldownSeconds?: number;
    groupConfigs?: Record<string, { enabled?: boolean }>;
}

export interface StatusData {
    pluginName: string;
    uptime: number;
    config: PluginConfig;
    stats: {
        collected: number;
        recalled: number;
        commandCalls: number;
        processed?: number;
        todayProcessed?: number;
        lastUpdateDay?: string;
    };
    storage: {
        totalGroups: number;
        totalMessages: number;
        recalledMessages: number;
    };
    uptimeFormatted?: string;
}

export type PluginStatus = StatusData;

export interface GroupInfo {
    group_id: number;
    group_name: string;
    member_count: number;
    max_member_count: number;
    enabled: boolean;
}
