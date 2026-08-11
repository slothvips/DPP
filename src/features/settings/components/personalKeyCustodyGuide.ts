export interface PersonalKeyCustodyItem {
  title: string;
  detail: string;
}

/** 个人私钥填写/生成后向用户展示的保管要点 */
export const PERSONAL_KEY_CUSTODY_TITLE = '请妥善保管个人私钥';

export const PERSONAL_KEY_CUSTODY_SUMMARY =
  '找回你的个人私密数据必须依赖此私钥。请立即备份，不要分享，不要丢失。';

export const PERSONAL_KEY_CUSTODY_ITEMS: PersonalKeyCustodyItem[] = [
  {
    title: '找回个人数据需要此私钥',
    detail:
      '验证器等个人私密数据使用此私钥加密同步。换设备、重装扩展或清空本机数据后，必须导入同一把私钥才能解密恢复。',
  },
  {
    title: '不要分享',
    detail:
      '请勿将个人私钥发给任何人（包括团队同事）。它与上方「同步密钥」相互独立，也不会出现在配置导出中。',
  },
  {
    title: '不要丢失',
    detail:
      '私钥丢失后，云端已加密的个人数据将无法再解密，任何人也无法帮你找回。请视为与主密码同等重要。',
  },
  {
    title: '建议的保管方式',
    detail:
      '立即复制并存入密码管理器，或离线抄写/加密备份到你能长期取用的安全位置；不要只依赖本机浏览器存储。',
  },
];
