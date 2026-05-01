export interface JenkinsMessageBase {
  type: string;
  payload?: unknown;
}

export interface FetchJobsMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_JOBS';
  payload?: undefined;
}

export interface FetchMyBuildsMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_MY_BUILDS';
  payload?: undefined;
}

export interface TriggerBuildMessage extends JenkinsMessageBase {
  type: 'JENKINS_TRIGGER_BUILD';
  payload: {
    jobUrl: string;
    jobName?: string;
    parameters?: Record<string, string | boolean | number>;
    envId?: string;
    notifyTelegram?: boolean;
  };
}

export interface TriggerBuildResult {
  buildTriggered: boolean;
  telegramNotification?: {
    attempted: boolean;
    sent: boolean;
    error?: string;
  };
}

export interface GetJobDetailsMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_JOB_DETAILS';
  payload: {
    jobUrl: string;
    envId?: string;
  };
}

export interface CancelBuildMessage extends JenkinsMessageBase {
  type: 'JENKINS_CANCEL_BUILD';
  payload: {
    jobUrl: string;
    buildNumber: number;
    envId?: string;
  };
}

export interface TestTelegramNotificationMessage extends JenkinsMessageBase {
  type: 'JENKINS_TEST_TELEGRAM_NOTIFICATION';
  payload: {
    botToken: string;
    chatId: string;
  };
}

export type JenkinsMessage =
  | FetchJobsMessage
  | FetchMyBuildsMessage
  | TriggerBuildMessage
  | GetJobDetailsMessage
  | CancelBuildMessage
  | TestTelegramNotificationMessage;

export interface JenkinsResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
