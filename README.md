# NapCat 群聊统计插件（qq-tongji）

基于 NapCat 的群聊统计插件，提供：
- 事件采集（群消息、可选私聊、群成员变动、可选群文件）
- SQLite 持久化
- 完整统计函数与 REST API（供 Python 或其他服务调用）
- Web Dashboard 可视化
- `#stats` 管理命令与按群定时推送

## 功能清单

### 必实现能力
- 消息采集与撤回标记
- SQLite 存储：`group_id/user_id/message_type/event_time/content/is_recall`
- 统计函数：
  - 群总量、用户总量
  - Top 排行
  - 热力图（24h/7d）
  - 关键词统计
  - 消息类型、每日/每小时、用户活跃分布、活跃天数
  - 爆发/沉寂检测
  - 活跃/潜水用户
  - 用户关键词、@ 统计
- 数据管理：
  - `clean_data(days)`
  - `set_stat_period(days)`
  - `enable_feature(name)` / `disable_feature(name)`

### 默认策略
- 私聊采集：默认关闭（可开）
- 群文件采集：默认关闭（可开）
- 消息内容存储：默认开启
- 关键词统计：默认只统计文本消息
- “without_recall”接口：过滤 `is_recall=1`，不物理删除原消息

## 安装与构建

```bash
pnpm install
pnpm run build
```

开发模式：

```bash
pnpm run dev
```

仅前端：

```bash
pnpm run dev:webui
```

## 项目结构（核心）

```text
src/
  collector/
    event-collector.ts
    recall-handler.ts
  db/
    sqlite.ts
    schema.ts
    migrations.ts
  handlers/
    message-handler.ts
    stats-command-handler.ts
  scheduler/
    scheduler-service.ts
  services/
    api-service.ts
    stats-api-service.ts
  stats/
    stats-repository.ts
    stats-service.ts
    tokenizer.ts
  index.ts
  config.ts
  core/state.ts
  types.ts
```

## 数据库设计（SQLite）

数据库文件：`<plugin-data>/stats.db`

### 表
- `messages`
- `group_member_events`
- `group_file_events`
- `feature_flags`
- `stat_settings`
- `group_schedules`

### 关键索引
- `messages(group_id, event_time)`
- `messages(group_id, user_id, event_time)`
- `messages(group_id, is_recall, event_time)`
- `messages(message_type, event_time)`
- `group_schedules(group_id, enabled)`

## 命令手册

### 1. 清理数据
```text
#stats clean 7d
```

### 2. 设置群定时推送
```text
#stats 8 30 group_total
```

### 3. 查看本群任务
```text
#stats schedule list
```

### 4. 删除任务
```text
#stats schedule remove 12
```

## API（前缀 `/api/stats`）

以下路径已实现，均为 NoAuth（插件内访问）：

### 群消息总量
- `GET /api/stats/group/{group_id}/total_messages`
- `GET /api/stats/group/{group_id}/total_messages_without_recall`

### 用户消息总量
- `GET /api/stats/group/{group_id}/user/{user_id}/total_messages`
- `GET /api/stats/group/{group_id}/user/{user_id}/total_messages_without_recall`

### Top 排行
- `GET /api/stats/group/{group_id}/top_users?limit=10`
- `GET /api/stats/group/{group_id}/top_users_without_recall?limit=10`

### 热力图
- `GET /api/stats/group/{group_id}/heatmap`
- `GET /api/stats/group/{group_id}/heatmap_without_recall`

### 关键词
- `GET /api/stats/group/{group_id}/keywords?limit=50`
- `GET /api/stats/group/{group_id}/keywords_without_recall?limit=50`

### 消息类型
- `GET /api/stats/group/{group_id}/message_types`
- `GET /api/stats/group/{group_id}/message_types_without_recall`
- `GET /api/stats/group/{group_id}/user/{user_id}/message_types`
- `GET /api/stats/group/{group_id}/user/{user_id}/message_types_without_recall`

### 时间维度
- `GET /api/stats/group/{group_id}/daily_messages`
- `GET /api/stats/group/{group_id}/daily_messages_without_recall`
- `GET /api/stats/group/{group_id}/hourly_messages`
- `GET /api/stats/group/{group_id}/hourly_messages_without_recall`

### 用户活跃度
- `GET /api/stats/group/{group_id}/user/{user_id}/hourly_activity`
- `GET /api/stats/group/{group_id}/user/{user_id}/hourly_activity_without_recall`
- `GET /api/stats/group/{group_id}/user/{user_id}/active_days`

### 事件检测
- `GET /api/stats/group/{group_id}/burst_events`
- `GET /api/stats/group/{group_id}/silent_events`

### 成员行为
- `GET /api/stats/group/{group_id}/active_users`
- `GET /api/stats/group/{group_id}/inactive_users`

### 用户内容分析
- `GET /api/stats/group/{group_id}/user/{user_id}/keywords?limit=50`
- `GET /api/stats/group/{group_id}/user/{user_id}/at_stats`

### 数据管理
- `POST /api/stats/clean?days=7`
- `POST /api/stats/set_period?days=30`
- `POST /api/stats/enable?feature=heatmap`
- `POST /api/stats/disable?feature=keyword`

### 定时任务
- `GET /api/stats/group/{group_id}/schedules`
- `POST /api/stats/group/{group_id}/schedules`
- `POST /api/stats/group/{group_id}/schedules/remove`

### 响应格式

```json
{ "code": 0, "data": {} }
```

```json
{ "code": -1, "message": "error" }
```

## Web Dashboard

当前前端页面：
- 总览
- 排行榜/关键词
- 热力图
- 事件检测
- 定时任务
- 系统设置

图表库：`echarts`

## 配置项

核心配置见 `src/types.ts` 中 `PluginConfig`：
- `enabled`, `debug`, `commandPrefix`
- `timezoneOffsetMinutes`
- `collectPrivateMessages`, `collectGroupFiles`
- `storeMessageContent`
- `statPeriodDays`
- `featureFlags`
- `keyword`
- `scheduler`
- `burst`, `silent`
- `groupConfigs`

## 检测算法

### 爆发检测
- 窗口：默认 5 分钟
- 阈值：`max(minMessages, mean + sigma * stddev)`（默认 sigma=3）
- 返回：窗口消息数 + 参与者列表

### 沉寂检测
- 最近窗口：默认 24 小时
- 对比基线：默认最近 7 天
- 阈值：历史分位数（默认 0.2）
- 返回：冷窗口消息数 + 冷群用户列表

## 开发测试建议

建议覆盖：
- 撤回过滤正确性（含/不含撤回）
- 热力图维度（24h/7d）
- 关键词与消息类型统计
- 爆发/沉寂阈值边界
- 定时任务触发与失败重试

> 当前仓库的 `napcat-types` 上游类型文件存在编译问题（依赖内 TS 语法错误），`pnpm run typecheck` 可能失败，不影响本插件逻辑实现。
