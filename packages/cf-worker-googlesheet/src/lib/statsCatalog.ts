/**
 * 运营看板的动作词典：中文名称、口径说明、累计值含义。
 * 与扩展 `src/lib/analytics/events.ts` 对齐；未接入上报的动作标 unwired，避免误读空数据。
 */

export interface StatsActionCatalogEntry {
  label: string;
  description: string;
  /** 累计值（SUM(value)）的含义；无则看板不强调该列 */
  valueHint?: string;
  /** 事件已登记但当前没有上报点 */
  unwired?: true;
}

export interface StatsModuleCatalogEntry {
  label: string;
  description: string;
  actions: Record<string, StatsActionCatalogEntry>;
}

/** 各功能 Tab 共用的停留埋点（module 是功能名，不是 frame） */
const PRESENCE_ACTIONS: Record<string, StatsActionCatalogEntry> = {
  feature_opened: {
    label: '打开功能',
    description: '进入该功能 Tab。切 Tab、重挂载都会记一次，次数偏会话数。',
  },
  feature_closed: {
    label: '离开功能',
    description: '切走该 Tab 或侧栏卸载。',
    valueHint: '累计停留秒数',
  },
  feature_heartbeat: {
    label: '功能心跳',
    description: '停留且页面可见时每 60 秒一次，约等于该功能前台分钟数。',
  },
};

function withPresence(
  label: string,
  description: string,
  actions: Record<string, StatsActionCatalogEntry>
): StatsModuleCatalogEntry {
  return { label, description, actions: { ...PRESENCE_ACTIONS, ...actions } };
}

export const STATS_CATALOG: Record<string, StatsModuleCatalogEntry> = {
  links: withPresence('链接', '团队链接的打开、增删。', {
    link_opened: {
      label: '打开链接',
      description: '经 openLink 或中键/组合键打开一条链接。',
    },
    link_created: {
      label: '新增链接',
      description: '创建链接；批量导入时 value 为条数。',
      valueHint: '批量新增条数累计',
    },
    link_deleted: {
      label: '删除链接',
      description: '删除一条链接（软删除）。',
    },
    category_created: {
      label: '新建分类',
      description: '已登记，当前没有上报点。',
      unwired: true,
    },
    import_finished: {
      label: '导入完成',
      description: '已登记，当前没有上报点。',
      unwired: true,
    },
    export_finished: {
      label: '导出完成',
      description: '已登记，当前没有上报点。',
      unwired: true,
    },
  }),
  jenkins: withPresence('Jenkins', '环境、触发构建、查看详情。', {
    server_added: {
      label: '添加环境',
      description: '在设置里新增一台 Jenkins 环境。',
    },
    server_tested: {
      label: '测试连接',
      description: '自动检测环境连通性。meta.ok 表示是否成功。',
    },
    job_triggered: {
      label: '触发构建',
      description: 'Jenkins 已接受构建请求（含对话框确认与 AI 触发后确认）。',
    },
    job_cancelled: {
      label: '取消构建',
      description: '取消队列、停止构建或取消进行中的构建。meta.kind 为 queue / stop / build。',
    },
    build_viewed: {
      label: '查看构建详情',
      description: '成功拉取构建详情（详情弹窗、刷新、AI 查询都会记）。',
    },
    param_form_opened: {
      label: '打开参数表单',
      description: '构建对话框加载到带参数的 Job。',
    },
  }),
  aiAssistant: withPresence('AI 助手', '会话、回复、工具与配置。', {
    session_created: {
      label: '新建会话',
      description: '创建一条 AI 对话。',
    },
    message_sent: {
      label: '助手回复成功',
      description:
        '助手成功产出回复后上报，不是用户点击发送。meta.hasTools 表示该轮是否含工具调用。',
    },
    message_failed: {
      label: '回复失败',
      description: '本轮助手请求失败。',
    },
    tool_call: {
      label: '调用工具',
      description: '执行一次 AI 工具。meta.tool 为工具名。',
    },
    model_changed: {
      label: '切换模型/服务',
      description: '在配置弹窗中激活另一个 AI 服务或配置。',
    },
    config_saved: {
      label: '保存 AI 配置',
      description: '创建或更新 profile、保存 OpenCode 等配置。',
    },
    dialog_opened: {
      label: '打开配置弹窗',
      description: '打开 AI 服务配置对话框。',
    },
  }),
  recorder: withPresence('录制回放', '开始/停止录制、打开回放、导出。', {
    recording_started: {
      label: '开始录制',
      description: '后台开始一次页面录制。',
    },
    recording_stopped: {
      label: '停止录制',
      description: '结束后台录制。',
    },
    replay_opened: {
      label: '打开回放',
      description: '播放器成功加载录制。meta.source 为 list / remote / external。',
    },
    export_finished: {
      label: '导出录制',
      description: '导出录制文件。meta.via 为导出途径。',
    },
  }),
  blackboard: withPresence('黑板', '便笺的打开与增删改。', {
    board_opened: {
      label: '打开黑板',
      description: '进入黑板页（与 Tab 打开功能互补，偏页面级）。',
    },
    note_created: {
      label: '新建便笺',
      description: '创建一条黑板便笺。',
    },
    note_updated: {
      label: '更新便笺',
      description: '修改内容、置顶或锁定。meta.field 标明字段。',
    },
    note_deleted: {
      label: '删除便笺',
      description: '删除一条便笺。',
    },
  }),
  hotnews: withPresence('资讯热榜', '刷新、打开条目、筛选。', {
    feed_refreshed: {
      label: '刷新热榜',
      description: '实际请求并写入热榜。meta.trigger 为 manual / retry / empty / auto / preview。',
    },
    article_opened: {
      label: '打开热榜条目',
      description: '从热榜页或快捷预览打开一条资讯。meta.source 为来源名或 quickPreview。',
    },
    filter_changed: {
      label: '更改筛选',
      description: '热榜筛选条件变化。',
    },
  }),
  totp: withPresence('验证器', '账户、展示与复制验证码。', {
    account_added: {
      label: '添加账户',
      description: '新增验证器账户；批量时 value 为条数。',
      valueHint: '批量新增条数累计',
    },
    code_copied: {
      label: '复制验证码',
      description: '成功复制到剪贴板。',
    },
    code_revealed: {
      label: '展示验证码',
      description: '验证器页点开明文，或快捷预览首次展开明文。',
    },
  }),
  playground: withPresence('游乐园', '工具箱各工具的打开。', {
    tool_opened: {
      label: '打开工具',
      description: '进入某个工具。meta.tool 为工具 id。',
    },
    tool_used: {
      label: '使用工具',
      description: '已登记，当前没有上报点。',
      unwired: true,
    },
  }),
  settings: {
    label: '设置',
    description: 'Options 页、同步开关、功能开关、导入导出与清数据。',
    actions: {
      page_opened: {
        label: '打开设置页',
        description: '打开扩展 Options 页面。',
      },
      sync_enabled: {
        label: '开启同步',
        description: 'auto_sync_enabled 被写成 true（保存后，不是拖动开关瞬间）。',
      },
      sync_disabled: {
        label: '关闭同步',
        description: 'auto_sync_enabled 被写成 false。',
      },
      data_exported: {
        label: '导出数据',
        description: '从 Options 导出配置/数据。',
      },
      data_cleared: {
        label: '清空数据',
        description: '清空所有本地数据并重置。',
      },
      feature_flag_changed: {
        label: '功能开关变化',
        description: '功能开关或 Jenkins 能力开关变更。meta.flag 为设置键名。',
      },
    },
  },
  sync: {
    label: '数据同步',
    description: '推送、拉取与冲突处理结果。',
    actions: {
      push_finished: {
        label: '推送结束',
        description: '一次 push 完成。meta.ok 表示是否成功。',
      },
      pull_finished: {
        label: '拉取结束',
        description: '一次 pull 完成。meta.ok 表示是否成功。',
      },
      conflict_resolved: {
        label: '冲突已处理',
        description: '同步冲突按策略落地。meta.strategy 为 lww / merge / chunk / constraint。',
      },
    },
  },
  error: {
    label: '错误',
    description: '未捕获的界面错误。不含错误正文。',
    actions: {
      unexpected_error: {
        label: '未捕获错误',
        description: 'ErrorBoundary 捕获。meta.isolated 表示是否为模块隔离边界。',
      },
    },
  },
};

export function lookupModule(module: string): StatsModuleCatalogEntry | undefined {
  return STATS_CATALOG[module];
}

export function lookupAction(module: string, action: string): StatsActionCatalogEntry | undefined {
  return STATS_CATALOG[module]?.actions[action];
}
