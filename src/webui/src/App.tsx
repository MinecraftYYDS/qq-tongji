import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { noAuthFetch } from './utils/api';
import type { GroupInfo, PluginConfig, StatusData } from './types';

type TabId = 'overview' | 'top' | 'heatmap' | 'events' | 'schedules' | 'settings';
export type PageId = TabId | 'status' | 'config' | 'groups';

const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: '总览' },
    { id: 'top', label: '排行榜/关键词' },
    { id: 'heatmap', label: '热力图' },
    { id: 'events', label: '事件检测' },
    { id: 'schedules', label: '定时任务' },
    { id: 'settings', label: '系统设置' },
];

function Card(props: { title: string; value: string | number }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{props.title}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-800">{props.value}</div>
        </div>
    );
}

function EChartBar(props: { data: Array<{ name: string; value: number }>; title: string }) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!ref.current) return;
        const chart = echarts.init(ref.current);
        chart.setOption({
            title: { text: props.title, textStyle: { fontSize: 14 } },
            tooltip: {},
            xAxis: { type: 'category', data: props.data.map((x) => x.name) },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: props.data.map((x) => x.value), itemStyle: { color: '#2563eb' } }],
        });
        const onResize = () => chart.resize();
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            chart.dispose();
        };
    }, [props.data, props.title]);
    return <div ref={ref} className="h-80 w-full" />;
}

function App() {
    const [tab, setTab] = useState<TabId>('overview');
    const [status, setStatus] = useState<StatusData | null>(null);
    const [groups, setGroups] = useState<GroupInfo[]>([]);
    const [groupId, setGroupId] = useState<string>('');
    const [topUsers, setTopUsers] = useState<Array<{ user_id: string; count: number }>>([]);
    const [keywords, setKeywords] = useState<Array<{ keyword: string; count: number }>>([]);
    const [heatmap, setHeatmap] = useState<{ hourly: number[]; weekly: number[] } | null>(null);
    const [events, setEvents] = useState<{ burst: unknown[]; silent: unknown[] }>({ burst: [], silent: [] });
    const [schedules, setSchedules] = useState<Array<{ id: number; hour: number; minute: number; feature: string }>>([]);
    const [config, setConfig] = useState<PluginConfig | null>(null);

    useEffect(() => {
        const load = async () => {
            const [statusRes, groupRes, configRes] = await Promise.all([
                noAuthFetch<StatusData>('/status'),
                noAuthFetch<GroupInfo[]>('/groups'),
                noAuthFetch<PluginConfig>('/config'),
            ]);
            if (statusRes.data) setStatus(statusRes.data);
            if (groupRes.data) {
                setGroups(groupRes.data);
                if (groupRes.data[0]) setGroupId(String(groupRes.data[0].group_id));
            }
            if (configRes.data) setConfig(configRes.data);
        };
        void load();
    }, []);

    useEffect(() => {
        if (!groupId) return;
        const load = async () => {
            const [top, words, map, burst, silent, sch] = await Promise.all([
                noAuthFetch<Array<{ user_id: string; count: number }>>(`/api/stats/group/${groupId}/top_users_without_recall?limit=10`),
                noAuthFetch<Array<{ keyword: string; count: number }>>(`/api/stats/group/${groupId}/keywords_without_recall?limit=20`),
                noAuthFetch<{ hourly: number[]; weekly: number[] }>(`/api/stats/group/${groupId}/heatmap_without_recall`),
                noAuthFetch<unknown[]>(`/api/stats/group/${groupId}/burst_events`),
                noAuthFetch<unknown[]>(`/api/stats/group/${groupId}/silent_events`),
                noAuthFetch<Array<{ id: number; hour: number; minute: number; feature: string }>>(`/api/stats/group/${groupId}/schedules`),
            ]);
            setTopUsers(top.data ?? []);
            setKeywords(words.data ?? []);
            setHeatmap(map.data ?? null);
            setEvents({ burst: burst.data ?? [], silent: silent.data ?? [] });
            setSchedules(sch.data ?? []);
        };
        void load();
    }, [groupId]);

    const topChart = useMemo(
        () => topUsers.map((x) => ({ name: x.user_id, value: x.count })),
        [topUsers]
    );
    const keywordChart = useMemo(
        () => keywords.map((x) => ({ name: x.keyword, value: x.count })),
        [keywords]
    );

    const renderTab = () => {
        if (tab === 'overview') {
            return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card title="采集消息数" value={status?.stats.collected ?? 0} />
                    <Card title="撤回标记数" value={status?.stats.recalled ?? 0} />
                    <Card title="命令调用数" value={status?.stats.commandCalls ?? 0} />
                    <Card title="覆盖群数量" value={status?.storage.totalGroups ?? 0} />
                </div>
            );
        }
        if (tab === 'top') {
            return (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4"><EChartBar title="群发言 Top10" data={topChart} /></div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4"><EChartBar title="关键词 Top20" data={keywordChart} /></div>
                </div>
            );
        }
        if (tab === 'heatmap') {
            return (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <EChartBar
                            title="24 小时活跃分布"
                            data={(heatmap?.hourly ?? []).map((x, i) => ({ name: String(i), value: x }))}
                        />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <EChartBar
                            title="7 天活跃分布"
                            data={(heatmap?.weekly ?? []).map((x, i) => ({ name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], value: x }))}
                        />
                    </div>
                </div>
            );
        }
        if (tab === 'events') {
            return (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold">爆发事件</div>
                        <pre className="mt-3 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(events.burst, null, 2)}</pre>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold">沉寂事件</div>
                        <pre className="mt-3 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(events.silent, null, 2)}</pre>
                    </div>
                </div>
            );
        }
        if (tab === 'schedules') {
            return (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold">本群定时任务</div>
                    <ul className="mt-3 space-y-2 text-sm">
                        {schedules.map((item) => (
                            <li key={item.id} className="rounded bg-slate-50 p-2">
                                #{item.id} {String(item.hour).padStart(2, '0')}:{String(item.minute).padStart(2, '0')} {item.feature}
                            </li>
                        ))}
                        {schedules.length === 0 ? <li className="text-slate-500">暂无任务</li> : null}
                    </ul>
                </div>
            );
        }
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">系统配置</div>
                <pre className="mt-3 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(config, null, 2)}</pre>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-6">
            <div className="mx-auto max-w-7xl space-y-4">
                <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-5 text-white">
                    <div className="text-2xl font-bold">NapCat 群聊统计插件</div>
                    <div className="mt-1 text-sm text-blue-100">全量统计 API + Web Dashboard</div>
                    <div className="mt-4">
                        <select
                            className="rounded bg-white px-3 py-2 text-sm text-slate-900"
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                        >
                            {groups.map((g) => (
                                <option key={g.group_id} value={g.group_id}>{g.group_name}({g.group_id})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id)}
                            className={`rounded-full px-4 py-2 text-sm ${tab === item.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {renderTab()}
            </div>
        </div>
    );
}

export default App;
