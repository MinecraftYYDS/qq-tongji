import type {
    PluginModule,
    PluginConfigSchema,
    NapCatPluginContext,
} from 'napcat-types/napcat-onebot/network/plugin/types';
import { EventType } from 'napcat-types/napcat-onebot/event/index';

import { buildConfigSchema } from './config';
import { pluginState } from './core/state';
import { handleMessage } from './handlers/message-handler';
import { registerApiRoutes } from './services/api-service';
import { collectEvent } from './collector/event-collector';
import { closeDb, initDb } from './db/sqlite';
import { runMigrations } from './db/migrations';
import { startScheduler, stopScheduler } from './scheduler/scheduler-service';
import type { PluginConfig } from './types';
export let plugin_config_ui: PluginConfigSchema = [];

export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
    try {
        pluginState.init(ctx);
        initDb();
        runMigrations();
        plugin_config_ui = buildConfigSchema(ctx);
        registerWebUI(ctx);
        registerApiRoutes(ctx);
        startScheduler();
        ctx.logger.info('群聊统计插件初始化完成');
    } catch (error) {
        ctx.logger.error('插件初始化失败', error);
    }
};

export const plugin_onmessage: PluginModule['plugin_onmessage'] = async (ctx, event) => {
    if (event.post_type !== EventType.MESSAGE) return;
    if (!pluginState.config.enabled) return;
    await handleMessage(ctx, event);
};

export const plugin_onevent: PluginModule['plugin_onevent'] = async (ctx, event) => {
    try {
        if (event.post_type === EventType.NOTICE) {
            collectEvent(event as unknown as Record<string, unknown>);
        }
    } catch (error) {
        ctx.logger.error('处理 onevent 失败', error);
    }
};

export const plugin_cleanup: PluginModule['plugin_cleanup'] = async (ctx) => {
    try {
        stopScheduler();
        closeDb();
        pluginState.cleanup();
        ctx.logger.info('群聊统计插件已卸载');
    } catch (e) {
        ctx.logger.warn('插件卸载时出错', e);
    }
};

export const plugin_get_config: PluginModule['plugin_get_config'] = async (ctx) => {
    return pluginState.config;
};

export const plugin_set_config: PluginModule['plugin_set_config'] = async (ctx, config) => {
    pluginState.replaceConfig(config as PluginConfig);
};

export const plugin_on_config_change: PluginModule['plugin_on_config_change'] = async (
    ctx, ui, key, value, currentConfig
) => {
    try {
        pluginState.updateConfigByPath(key, value);
    } catch (err) {
        ctx.logger.error(`更新配置项 ${key} 失败`, err);
    }
};
function registerWebUI(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    router.static('/static', 'webui');
    router.page({
        path: 'dashboard',
        title: '群聊统计',
        htmlFile: 'webui/index.html',
        description: '群聊统计看板',
    });
}
