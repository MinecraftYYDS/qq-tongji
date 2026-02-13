import type { NapCatPluginContext, PluginConfigSchema } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { PluginConfig } from './types';

export const DEFAULT_CONFIG: PluginConfig = {
    enabled: true,
    debug: false,
    commandPrefix: '#stats',
    timezoneOffsetMinutes: 480,
    collectPrivateMessages: false,
    collectGroupFiles: false,
    storeMessageContent: true,
    statPeriodDays: 30,
    featureFlags: {
        keyword: true,
        heatmap: true,
        burst: true,
        silent: true,
        typeStats: true,
        userContent: true,
    },
    keyword: {
        minWordLength: 2,
        defaultLimit: 50,
        stopWords: ['的', '了', '和', '是', '就', '都', '而', '及', '与', '着', '在'],
    },
    scheduler: {
        enabled: true,
        retryOnce: true,
        scanIntervalSeconds: 60,
    },
    burst: {
        windowMinutes: 5,
        lookbackDays: 7,
        sigma: 3,
        minMessages: 20,
    },
    silent: {
        recentHours: 24,
        baselineDays: 7,
        quantile: 0.2,
    },
    groupConfigs: {},
};

export function buildConfigSchema(ctx: NapCatPluginContext): PluginConfigSchema {
    return ctx.NapCatConfig.combine(
        ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: #1f6feb; border-radius: 12px; margin-bottom: 20px; color: white;">
                <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">NapCat 群聊统计插件</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.9;">采集群聊事件并提供完整统计 API 与可视化面板</p>
            </div>
        `),
        ctx.NapCatConfig.boolean('enabled', '启用插件', true, '是否启用此插件的功能'),
        ctx.NapCatConfig.boolean('debug', '调试模式', false, '启用后将输出详细的调试日志'),
        ctx.NapCatConfig.text('commandPrefix', '命令前缀', '#stats', '触发管理命令的前缀'),
        ctx.NapCatConfig.number('timezoneOffsetMinutes', '时区偏移分钟', 480, '例如中国时区为 480'),
        ctx.NapCatConfig.boolean('collectPrivateMessages', '采集私聊消息', false, '默认关闭'),
        ctx.NapCatConfig.boolean('collectGroupFiles', '采集群文件上传', false, '默认关闭'),
        ctx.NapCatConfig.boolean('storeMessageContent', '存储消息内容', true, '关闭后关键词功能会受限'),
        ctx.NapCatConfig.number('statPeriodDays', '默认统计周期(天)', 30, '接口未指定 days 时使用'),
        ctx.NapCatConfig.boolean('scheduler.enabled', '启用定时推送', true, '按群推送统计'),
        ctx.NapCatConfig.number('scheduler.scanIntervalSeconds', '任务扫描间隔(秒)', 60, '建议 60 秒'),
        ctx.NapCatConfig.boolean('featureFlags.keyword', '启用关键词统计', true),
        ctx.NapCatConfig.boolean('featureFlags.heatmap', '启用热力图统计', true),
        ctx.NapCatConfig.boolean('featureFlags.burst', '启用爆发检测', true),
        ctx.NapCatConfig.boolean('featureFlags.silent', '启用沉寂检测', true),
        ctx.NapCatConfig.number('burst.minMessages', '爆发检测最小消息阈值', 20),
        ctx.NapCatConfig.number('silent.recentHours', '沉寂检测窗口(小时)', 24)
    );
}
