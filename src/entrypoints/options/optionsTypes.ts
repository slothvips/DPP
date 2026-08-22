export interface CustomConfigState {
  serverUrl: string;
}

export interface AutoSyncState {
  enabled: boolean;
  interval: number;
}

export interface FeatureTogglesState {
  hotNews: boolean;
  links: boolean;
  blackboard: boolean;
  jenkins: boolean;
  recorder: boolean;
  testing: boolean;
  aiAssistant: boolean;
  playground: boolean;
  totp: boolean;
}
