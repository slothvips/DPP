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
    parameters?: Record<string, string | boolean | number>;
    envId?: string;
  };
}

export interface GetJobDetailsMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_JOB_DETAILS';
  payload: {
    jobUrl: string;
    envId?: string;
  };
}

export type JenkinsMessage =
  | FetchJobsMessage
  | FetchMyBuildsMessage
  | TriggerBuildMessage
  | GetJobDetailsMessage;

export interface JenkinsResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
