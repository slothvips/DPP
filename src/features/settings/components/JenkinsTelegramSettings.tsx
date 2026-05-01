import { Bot, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { JenkinsService } from '@/features/jenkins/service';
import {
  type JenkinsTelegramConfig,
  loadJenkinsTelegramConfig,
  saveJenkinsTelegramConfig,
} from '@/features/jenkins/telegram';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';

const EMPTY_CONFIG: JenkinsTelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  releaseKeywords: '',
};

export function JenkinsTelegramSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<JenkinsTelegramConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextConfig = await loadJenkinsTelegramConfig();
        if (!cancelled) {
          setConfig(nextConfig);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('[JenkinsTelegramSettings] Failed to load config:', error);
          toast('加载 TG 通知配置失败', 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const updateConfig = <K extends keyof JenkinsTelegramConfig>(
    key: K,
    value: JenkinsTelegramConfig[K]
  ) => {
    setConfig((previous) => (previous[key] === value ? previous : { ...previous, [key]: value }));
  };

  const validateConfig = () => {
    const validations = [
      validateLength(config.botToken, VALIDATION_LIMITS.JENKINS_TG_BOT_TOKEN_MAX, 'Bot Token'),
      validateLength(config.chatId, VALIDATION_LIMITS.JENKINS_TG_CHAT_ID_MAX, 'Chat ID'),
      validateLength(
        config.releaseKeywords,
        VALIDATION_LIMITS.JENKINS_TG_RELEASE_KEYWORDS_MAX,
        '发布关键词'
      ),
    ];

    const failed = validations.find((result) => !result.valid);
    if (failed) {
      toast(failed.error ?? '配置长度超出限制', 'error');
      return false;
    }

    if (config.enabled && (!config.botToken.trim() || !config.chatId.trim())) {
      toast('启用 TG 通知前需要填写 Bot Token 和 Chat ID', 'error');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateConfig()) {
      return;
    }

    setSaving(true);
    try {
      await saveJenkinsTelegramConfig(config);
      toast('TG 通知配置已保存', 'success');
    } catch (error) {
      logger.error('[JenkinsTelegramSettings] Failed to save config:', error);
      toast('保存 TG 通知配置失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateConfig()) {
      return;
    }

    setTesting(true);
    try {
      await JenkinsService.testTelegramNotification(config.botToken, config.chatId);
      toast('TG 测试通知已发送', 'success');
    } catch (error) {
      logger.error('[JenkinsTelegramSettings] Failed to test config:', error);
      toast('TG 测试通知发送失败', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">TG 发布通知</h3>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="jenkins-tg-enabled"
          data-testid="jenkins-tg-enabled-checkbox"
          checked={config.enabled}
          disabled={loading}
          onCheckedChange={(checked) => updateConfig('enabled', checked === true)}
        />
        <Label htmlFor="jenkins-tg-enabled">启用发布构建 TG 群通知</Label>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="jenkins-tg-token">Bot Token</Label>
          <Input
            id="jenkins-tg-token"
            data-testid="jenkins-tg-token-input"
            type="password"
            value={config.botToken}
            disabled={loading}
            onChange={(event) => updateConfig('botToken', event.target.value)}
            placeholder="123456789:AA..."
            maxLength={VALIDATION_LIMITS.JENKINS_TG_BOT_TOKEN_MAX}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jenkins-tg-chat-id">群 Chat ID</Label>
          <Input
            id="jenkins-tg-chat-id"
            data-testid="jenkins-tg-chat-id-input"
            value={config.chatId}
            disabled={loading}
            onChange={(event) => updateConfig('chatId', event.target.value)}
            placeholder="-1001234567890"
            maxLength={VALIDATION_LIMITS.JENKINS_TG_CHAT_ID_MAX}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jenkins-tg-keywords">发布构建关键词</Label>
          <Textarea
            id="jenkins-tg-keywords"
            data-testid="jenkins-tg-release-keywords-textarea"
            value={config.releaseKeywords}
            disabled={loading}
            onChange={(event) => updateConfig('releaseKeywords', event.target.value)}
            className="font-mono text-xs"
            rows={3}
            maxLength={VALIDATION_LIMITS.JENKINS_TG_RELEASE_KEYWORDS_MAX}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          data-testid="jenkins-tg-save-button"
          onClick={handleSave}
          disabled={loading || saving}
        >
          {saving ? '保存中...' : '保存 TG 配置'}
        </Button>
        <Button
          data-testid="jenkins-tg-test-button"
          variant="outline"
          onClick={handleTest}
          disabled={loading || testing || !config.botToken.trim() || !config.chatId.trim()}
        >
          <Send className="mr-2 h-4 w-4" />
          {testing ? '发送中...' : '发送测试'}
        </Button>
      </div>
    </div>
  );
}
