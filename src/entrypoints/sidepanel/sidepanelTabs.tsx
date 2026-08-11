import { Box, Flame, Link, MessageSquare, Shield, Sparkles, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { JenkinsIcon } from '@/components/ui/JenkinsIcon';
import { TOTP_MIGRATION_SECTIONS, TOTP_MIGRATION_SUMMARY } from '@/features/totp/migrationGuide';
import type { FeatureToggles, TabId } from './sidepanelTypes';

interface TabConfig {
  description: string;
  label: string;
  testid: string;
  icon: ReactNode;
  usageGuide: {
    summary: string;
    sections: Array<{
      title: string;
      items: string[];
    }>;
  };
  getVisible: (props: { featureToggles: FeatureToggles; showJenkinsTab: boolean }) => boolean;
}

export const DEFAULT_TAB_ORDER: TabId[] = [
  'blackboard',
  'jenkins',
  'links',
  'totp',
  'recorder',
  'hotNews',
  'aiAssistant',
  'playground',
];

export const TAB_CONFIG: Record<TabId, TabConfig> = {
  blackboard: {
    description: '快速记录碎片信息与待办',
    label: '黑板',
    testid: 'tab-blackboard',
    icon: <MessageSquare className="h-4 w-4" />,
    usageGuide: {
      summary: '快速记录想法、待办和排查笔记。',
      sections: [
        {
          title: '记录',
          items: ['新增便签，点击正文编辑。', '支持 Markdown，失焦自动保存。'],
        },
        {
          title: '整理',
          items: ['置顶重要内容，锁定避免误改。', '悬停便签可删除或切换状态。'],
        },
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.blackboard,
  },
  jenkins: {
    description: 'Jenkins快速构建',
    label: 'Jenkins',
    testid: 'tab-jenkins',
    icon: <JenkinsIcon className="h-4 w-4" />,
    usageGuide: {
      summary: '查看 Job、触发构建、跟踪结果。',
      sections: [
        {
          title: '配置',
          items: ['先在设置中配置 Jenkins 环境。', '按环境浏览任务树或查找 Job。'],
        },
        {
          title: '构建',
          items: ['填写参数后触发构建。', '在构建历史中查看状态并跳转 Jenkins。'],
        },
      ],
    },
    getVisible: ({ showJenkinsTab }) => showJenkinsTab,
  },
  links: {
    description: '整理常用地址与标签',
    label: '链接',
    testid: 'tab-links',
    icon: <Link className="h-4 w-4" />,
    usageGuide: {
      summary: '收藏常用地址，按标签快速查找。',
      sections: [
        {
          title: '添加',
          items: ['填写名称、URL、标签和备注。', '搜索匹配名称、地址、标签和备注。'],
        },
        {
          title: '整理',
          items: ['置顶高频链接。', '用标签区分项目、环境和个人链接。'],
        },
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.links,
  },
  recorder: {
    description: '赋能禅道,亲临web现场',
    label: '录制',
    testid: 'tab-recorder',
    icon: <Video className="h-4 w-4" />,
    usageGuide: {
      summary: '在目标页面录制现场，回到禅道上传和播放。',
      sections: [
        {
          title: '录制',
          items: ['切到出问题的页面后开始录制。', '复现问题，保存操作、请求和控制台。'],
        },
        {
          title: '禅道增强',
          items: ['用“上传录像”把录制挂到禅道。', '.rrweb.json 附件可直接播放。'],
        },
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.recorder,
  },
  hotNews: {
    description: '聚合每日热榜与历史归档',
    label: '资讯',
    testid: 'tab-hotnews',
    icon: <Flame className="h-4 w-4" />,
    usageGuide: {
      summary: '浏览每日热点和历史归档。',
      sections: [
        {
          title: '浏览',
          items: ['按日期查看热点。', '展开来源，点击条目打开原文。'],
        },
        {
          title: '归档',
          items: ['历史入口回看旧日期。', '内容以来源页面为准。'],
        },
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.hotNews,
  },
  aiAssistant: {
    description: '协助你处理本地数据与页面任务',
    label: 'D仔',
    testid: 'tab-ai-assistant',
    icon: <Sparkles className="h-4 w-4" />,
    usageGuide: {
      summary: '让 D仔 协助处理数据、页面和常见操作。',
      sections: [
        {
          title: '对话',
          items: ['描述目标，D仔 给出回答或操作建议。', '用新会话隔离不同任务。'],
        },
        {
          title: '操作',
          items: ['选择标签页后处理页面任务。', '高影响操作会先请求确认。'],
        },
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.aiAssistant,
  },
  playground: {
    description: '大概是一些小工具吧~',
    label: '游乐园',
    testid: 'tab-playground',
    icon: <Box className="h-4 w-4" />,
    usageGuide: {
      summary: '临时处理文本、时间、JSON 和对比任务。',
      sections: [
        {
          title: '使用',
          items: ['选择工具后输入内容。', '左上角返回工具列表。'],
        },
        {
          title: '场景',
          items: ['JSON 格式化，正则验证。', '时间转换，数据差异对比。'],
        },
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.playground,
  },
  totp: {
    description: '本地 TOTP 动态验证码',
    label: '验证器',
    testid: 'tab-totp',
    icon: <Shield className="h-4 w-4" />,
    usageGuide: {
      summary: TOTP_MIGRATION_SUMMARY,
      sections: [
        {
          title: '使用',
          items: [
            '验证码默认隐藏，可用工具栏眼睛图标切换显示。',
            '点击卡片即可复制验证码；拖动手柄可调整顺序。',
            '密钥、算法、位数、周期导入后不可修改；数据仅保存在本机。',
          ],
        },
        {
          title: '导入 / 导出',
          items: [
            '导入：粘贴 otpauth:// 链接或 Base32 密钥，支持批量。',
            '导出：复制或下载 otpauth:// 文本，默认不展示明文。',
          ],
        },
        ...TOTP_MIGRATION_SECTIONS,
      ],
    },
    getVisible: ({ featureToggles }) => featureToggles.totp,
  },
};
