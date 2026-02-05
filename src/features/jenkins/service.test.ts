import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JenkinsService } from './service';

const mockSendMessage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof browser !== 'undefined') {
    browser.runtime.sendMessage = mockSendMessage;
  } else {
    // @ts-expect-error - defining global
    global.browser = {
      runtime: {
        sendMessage: mockSendMessage,
      },
    };
  }
});

describe('JenkinsService', () => {
  it('fetchAllJobs sends JENKINS_FETCH_JOBS message', async () => {
    mockSendMessage.mockResolvedValue({ success: true, data: 42 });

    const result = await JenkinsService.fetchAllJobs();

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'JENKINS_FETCH_JOBS' });
    expect(result).toBe(42);
  });

  it('fetchMyBuilds sends JENKINS_FETCH_MY_BUILDS message', async () => {
    mockSendMessage.mockResolvedValue({ success: true, data: 5 });

    const result = await JenkinsService.fetchMyBuilds();

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'JENKINS_FETCH_MY_BUILDS' });
    expect(result).toBe(5);
  });

  it('triggerBuild sends JENKINS_TRIGGER_BUILD message', async () => {
    mockSendMessage.mockResolvedValue({ success: true, data: true });

    const success = await JenkinsService.triggerBuild('http://job/url', { param: 'value' });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'JENKINS_TRIGGER_BUILD',
      payload: {
        jobUrl: 'http://job/url',
        parameters: { param: 'value' },
      },
    });
    expect(success).toBe(true);
  });

  it('getJobDetails sends JENKINS_GET_JOB_DETAILS message', async () => {
    const mockData = { name: 'job1' };
    mockSendMessage.mockResolvedValue({ success: true, data: mockData });

    const result = await JenkinsService.getJobDetails('http://job/url');

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'JENKINS_GET_JOB_DETAILS',
      payload: { jobUrl: 'http://job/url' },
    });
    expect(result).toEqual(mockData);
  });

  it('handles errors from background', async () => {
    mockSendMessage.mockResolvedValue({ success: false, error: 'Auth failed' });

    await expect(JenkinsService.fetchAllJobs()).rejects.toThrow('Auth failed');
  });

  it('handles undefined response (communication failure)', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    await expect(JenkinsService.fetchAllJobs()).rejects.toThrow(
      'Failed to communicate with background service'
    );
  });
});
