/**
 * 数据验证配置 - 定义所有数据字段的长度限制
 */

export const VALIDATION_LIMITS = {
  // 链接相关
  LINK_NAME_MAX: 200,
  LINK_URL_MAX: 2000,
  LINK_NOTE_MAX: 1000,

  // 标签相关
  TAG_NAME_MAX: 50,

  // Jenkins 相关
  JENKINS_HOST_MAX: 500,
  JENKINS_USER_MAX: 100,
  JENKINS_TOKEN_MAX: 500,
  JENKINS_BUILD_PARAM_MAX: 10000, // 构建参数可能包含长文本/脚本

  // 同步配置相关
  SYNC_SERVER_URL_MAX: 500,
  SYNC_ACCESS_TOKEN_MAX: 500,
  SYNC_ENCRYPTION_KEY_MAX: 1000,

  // Job 相关
  JOB_URL_MAX: 2000,
  JOB_NAME_MAX: 500,
  JOB_FULL_NAME_MAX: 1000,
} as const;

/**
 * 验证字符串长度
 */
export function validateLength(
  value: string,
  maxLength: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: true };
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName}不能超过 ${maxLength} 个字符 (当前 ${trimmed.length} 个字符)`,
    };
  }

  return { valid: true };
}
