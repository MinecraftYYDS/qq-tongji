import fs from 'fs';
import path from 'path';
import type { NapCatPluginContext, PluginLogger } from 'napcat-types/napcat-onebot/network/plugin/types';
import { DEFAULT_CONFIG } from '../config';
import type { GroupConfig, PluginConfig } from '../types';

function isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeConfig(raw: unknown): PluginConfig {
    if (!isObject(raw)) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    const out: PluginConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
    if (typeof raw.debug === 'boolean') out.debug = raw.debug;
    if (typeof raw.commandPrefix === 'string') out.commandPrefix = raw.commandPrefix;
    if (typeof raw.timezoneOffsetMinutes === 'number') out.timezoneOffsetMinutes = raw.timezoneOffsetMinutes;
    if (typeof raw.collectPrivateMessages === 'boolean') out.collectPrivateMessages = raw.collectPrivateMessages;
    if (typeof raw.collectGroupFiles === 'boolean') out.collectGroupFiles = raw.collectGroupFiles;
    if (typeof raw.storeMessageContent === 'boolean') out.storeMessageContent = raw.storeMessageContent;
    if (typeof raw.statPeriodDays === 'number') out.statPeriodDays = Math.max(1, raw.statPeriodDays);

    if (isObject(raw.featureFlags)) {
        for (const key of Object.keys(out.featureFlags) as Array<keyof PluginConfig['featureFlags']>) {
            if (typeof raw.featureFlags[key] === 'boolean') out.featureFlags[key] = raw.featureFlags[key] as boolean;
        }
    }
    if (isObject(raw.keyword)) {
        if (typeof raw.keyword.minWordLength === 'number') out.keyword.minWordLength = raw.keyword.minWordLength;
        if (typeof raw.keyword.defaultLimit === 'number') out.keyword.defaultLimit = raw.keyword.defaultLimit;
        if (Array.isArray(raw.keyword.stopWords)) {
            out.keyword.stopWords = raw.keyword.stopWords.filter((x): x is string => typeof x === 'string');
        }
    }
    if (isObject(raw.scheduler)) {
        if (typeof raw.scheduler.enabled === 'boolean') out.scheduler.enabled = raw.scheduler.enabled;
        if (typeof raw.scheduler.retryOnce === 'boolean') out.scheduler.retryOnce = raw.scheduler.retryOnce;
        if (typeof raw.scheduler.scanIntervalSeconds === 'number') {
            out.scheduler.scanIntervalSeconds = Math.max(10, raw.scheduler.scanIntervalSeconds);
        }
    }
    if (isObject(raw.burst)) {
        if (typeof raw.burst.windowMinutes === 'number') out.burst.windowMinutes = raw.burst.windowMinutes;
        if (typeof raw.burst.lookbackDays === 'number') out.burst.lookbackDays = raw.burst.lookbackDays;
        if (typeof raw.burst.sigma === 'number') out.burst.sigma = raw.burst.sigma;
        if (typeof raw.burst.minMessages === 'number') out.burst.minMessages = raw.burst.minMessages;
    }
    if (isObject(raw.silent)) {
        if (typeof raw.silent.recentHours === 'number') out.silent.recentHours = raw.silent.recentHours;
        if (typeof raw.silent.baselineDays === 'number') out.silent.baselineDays = raw.silent.baselineDays;
        if (typeof raw.silent.quantile === 'number') out.silent.quantile = raw.silent.quantile;
    }
    if (isObject(raw.groupConfigs)) {
        const groupConfigs: Record<string, GroupConfig> = {};
        for (const [gid, cfg] of Object.entries(raw.groupConfigs)) {
            if (!isObject(cfg)) continue;
            groupConfigs[gid] = {};
            if (typeof cfg.enabled === 'boolean') groupConfigs[gid].enabled = cfg.enabled;
        }
        out.groupConfigs = groupConfigs;
    }
    return out;
}

class PluginState {
    private _ctx: NapCatPluginContext | null = null;
    config: PluginConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    startTime = 0;
    selfId = '';
    timers: Map<string, ReturnType<typeof setInterval>> = new Map();
    stats = {
        collected: 0,
        recalled: 0,
        commandCalls: 0,
    };

    get ctx(): NapCatPluginContext {
        if (!this._ctx) throw new Error('PluginState 尚未初始化');
        return this._ctx;
    }
    get logger(): PluginLogger {
        return this.ctx.logger;
    }

    init(ctx: NapCatPluginContext): void {
        this._ctx = ctx;
        this.startTime = Date.now();
        this.ensureDataDir();
        this.loadConfig();
        void this.fetchSelfId();
    }

    cleanup(): void {
        for (const timer of this.timers.values()) clearInterval(timer);
        this.timers.clear();
        this.saveConfig();
        this._ctx = null;
    }

    private ensureDataDir(): void {
        if (!fs.existsSync(this.ctx.dataPath)) fs.mkdirSync(this.ctx.dataPath, { recursive: true });
    }

    getDataFilePath(filename: string): string {
        return path.join(this.ctx.dataPath, filename);
    }

    private async fetchSelfId(): Promise<void> {
        try {
            const res = await this.ctx.actions.call(
                'get_login_info',
                {},
                this.ctx.adapterName,
                this.ctx.pluginManager.config
            ) as { user_id?: number | string };
            if (res.user_id !== undefined) this.selfId = String(res.user_id);
        } catch (error) {
            this.logger.warn('获取机器人账号失败', error);
        }
    }

    loadConfig(): void {
        const configPath = this.ctx.configPath;
        try {
            if (configPath && fs.existsSync(configPath)) {
                const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                this.config = sanitizeConfig(raw);
            } else {
                this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                this.saveConfig();
            }
        } catch (error) {
            this.ctx.logger.error('加载配置失败，回退默认配置', error);
            this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    saveConfig(): void {
        if (!this._ctx) return;
        const configPath = this._ctx.configPath;
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    }

    updateConfig(partial: Partial<PluginConfig>): void {
        this.config = sanitizeConfig({
            ...this.config,
            ...partial,
        });
        this.saveConfig();
    }

    updateConfigByPath(pathKey: string, value: unknown): void {
        const keys = pathKey.split('.');
        const raw = JSON.parse(JSON.stringify(this.config)) as Record<string, unknown>;
        let current: Record<string, unknown> = raw;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            const child = current[key];
            if (!isObject(child)) current[key] = {};
            current = current[key] as Record<string, unknown>;
        }
        current[keys[keys.length - 1]] = value;
        this.config = sanitizeConfig(raw);
        this.saveConfig();
    }

    replaceConfig(config: PluginConfig): void {
        this.config = sanitizeConfig(config);
        this.saveConfig();
    }

    updateGroupConfig(groupId: string, config: Partial<GroupConfig>): void {
        this.config.groupConfigs[groupId] = {
            ...this.config.groupConfigs[groupId],
            ...config,
        };
        this.saveConfig();
    }

    isGroupEnabled(groupId: string): boolean {
        return this.config.groupConfigs[groupId]?.enabled !== false;
    }

    getUptime(): number {
        return Date.now() - this.startTime;
    }

    bumpStat(key: keyof PluginState['stats']): void {
        this.stats[key] += 1;
    }
}

export const pluginState = new PluginState();
