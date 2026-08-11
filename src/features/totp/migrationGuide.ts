export interface TotpMigrationSection {
  title: string;
  items: string[];
}

export const TOTP_MIGRATION_SUMMARY =
  '用「导出」复制 otpauth:// 文本，再到另一台设备「导入」粘贴即可完成迁移。数据仅保存在本机、不会同步。';

export const TOTP_MIGRATION_SECTIONS: TotpMigrationSection[] = [
  {
    title: '双向迁移（推荐）',
    items: [
      '旧环境：点「导出」→「复制全部」或下载 .txt（按当前列表顺序）。',
      '新环境：点「导入」，把整段文本粘贴进去，可一次导入多条。',
      '导出内容含全部密钥，等同于密码，请勿发到聊天或未加密网盘。',
    ],
  },
  {
    title: '粘贴导入',
    items: [
      '支持 otpauth://totp/... 链接，或纯 Base32 密钥。',
      '一次可粘贴多条链接（换行或混在文本中均可）。',
      '不要粘贴 6 位动态验证码——那不是密钥，无法导入。',
    ],
  },
  {
    title: '密钥从哪来',
    items: [
      '本应用导出文本，或网站绑定页的「手动输入密钥」。',
      'Aegis、2FAS、Bitwarden、1Password 等可导出 / 查看的 secret / otpauth URI。',
      'Google / Microsoft Authenticator 通常不能导出明文密钥，需重新绑定或先导入本应用再导出。',
    ],
  },
  {
    title: '常见问题',
    items: [
      '验证码对不上：核对算法/位数/周期，并确认系统时间已自动同步。',
      '删除扩展或清除站点数据会丢失本地账户；重要密钥请先导出备份。',
    ],
  },
];
