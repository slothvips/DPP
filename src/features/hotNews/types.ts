// 热讯数据类型已迁移至 db 层,避免 db 反向依赖 features
// 此处 re-export 以保持现有 import 路径兼容
export type { DailyNews, NewsItem, NewsSection } from '@/db/typesDomain';
