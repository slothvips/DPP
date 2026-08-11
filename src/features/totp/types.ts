export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';
export type TotpDigits = 6 | 8;

export interface TotpAccountItem {
  id: string;
  /** 列表显示名 */
  label: string;
  issuer?: string;
  /** 账号标识（邮箱 / 用户名） */
  account?: string;
  /** Base32 密钥（个人密钥域同步；勿用团队密钥加密） */
  secret: string;
  algorithm: TotpAlgorithm;
  digits: TotpDigits;
  /** 刷新周期（秒），默认 30 */
  period: number;
  /** 手动排序权重，越小越靠前 */
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  /** 软删除时间戳（参与个人密钥同步） */
  deletedAt?: number;
}

export interface TotpAccountFormData {
  label: string;
  issuer: string;
  account: string;
  secret: string;
  algorithm: TotpAlgorithm;
  digits: TotpDigits;
  period: number;
}
