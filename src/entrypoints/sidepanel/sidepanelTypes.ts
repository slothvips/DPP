export type TabId =
  | 'links'
  | 'jenkins'
  | 'hotNews'
  | 'recorder'
  | 'blackboard'
  | 'aiAssistant'
  | 'playground'
  | 'totp';

export type ModuleTabId = Exclude<TabId, 'aiAssistant'>;

export interface FeatureToggles {
  hotNews: boolean;
  links: boolean;
  blackboard: boolean;
  jenkins: boolean;
  recorder: boolean;
  aiAssistant: boolean;
  playground: boolean;
  totp: boolean;
}

export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  hotNews: true,
  links: true,
  blackboard: true,
  jenkins: true,
  recorder: true,
  aiAssistant: true,
  playground: true,
  totp: true,
};
