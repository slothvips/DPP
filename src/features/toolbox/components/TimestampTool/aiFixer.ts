// Simple AI helper for timestamp correction
import { createConfiguredProvider } from '@/lib/ai/config';
import { logger } from '@/utils/logger';

interface CorrectionResult {
  success: boolean;
  correctedInput?: string;
  timestamp?: number;
  error?: string;
  reasoning?: string;
}

// AI Prompt 模板常量
const TIMESTAMP_AI_PROMPT_TEMPLATE = `你是时间转换助手。

当前时间：{timeStr}
当前时区：{tzName}

用户输入了无法被 JavaScript new Date() 直接解析的时间格式。
你的任务是将用户输入转换为 JavaScript 可识别的日期时间字符串。

规则：
1. 输出必须是 JavaScript new Date() 能直接解析的格式
2. 尽量保持用户输入的原始格式风格
3. 如果用户输入的是"昨天"、"3天前"等相对时间，基于当前时间计算
4. 如果用户输入的是"2024年3月15日"，转为"2024-03-15"
5. 如果用户输入的是"下午3点"，基于今天加上时间
6. 如果用户输入的是毫秒/秒时间戳，直接返回对应的时间字符串

输出格式（必须包含 reasoning 说明推理过程）：
{"result": "转换后的日期字符串", "reasoning": "推理过程"}
{"error": "错误信息", "reasoning": "原因"}

只返回 JSON，不要其他文字。`;

function buildPrompt(timeStr: string, tzName: string): string {
  return TIMESTAMP_AI_PROMPT_TEMPLATE.replace('{timeStr}', timeStr).replace('{tzName}', tzName);
}

export async function correctTimestampWithAI(
  input: string,
  currentTime: Date,
  timezone: string
): Promise<CorrectionResult> {
  let timeStr: string;
  let tzName: string;
  try {
    if (timezone === 'local') {
      timeStr = currentTime.toLocaleString('zh-CN');
      tzName = '本地时区';
    } else {
      timeStr = currentTime.toLocaleString('zh-CN', { timeZone: timezone });
      tzName = timezone;
    }
  } catch {
    timeStr = currentTime.toISOString();
    tzName = timezone;
  }

  const prompt = buildPrompt(timeStr, tzName);

  try {
    const configured = await createConfiguredProvider({
      includeLegacyFallback: false,
      logPrefix: '[TimestampAI]',
    });
    const hasValidConfig = configured.baseUrl || configured.model;
    if (!hasValidConfig) {
      return { success: false, error: '请先在设置中配置 AI' };
    }

    const messages = [
      { role: 'system' as const, content: prompt },
      { role: 'user' as const, content: `用户输入：${input}` },
    ];

    const response = await configured.provider.chat(messages, { stream: false });

    const content = response.message.content.trim();

    // 解析 JSON
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.error) {
          return { success: false, error: result.error, reasoning: result.reasoning };
        }
        if (result.result) {
          // 验证结果是否能被 JavaScript 解析
          const testDate = new Date(result.result);
          if (isNaN(testDate.getTime())) {
            return {
              success: false,
              error: `AI 返回格式 JS 无法解析: ${result.result}`,
              reasoning: result.reasoning,
            };
          }
          return {
            success: true,
            correctedInput: result.result,
            timestamp: testDate.getTime(),
            reasoning: result.reasoning,
          };
        }
      }
    } catch {
      // JSON 解析失败，继续返回错误
    }

    return { success: false, error: 'AI 返回格式无法解析' };
  } catch (err) {
    logger.error('[TimestampAI] Correction failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `AI 调用失败: ${errorMessage}`,
    };
  }
}
