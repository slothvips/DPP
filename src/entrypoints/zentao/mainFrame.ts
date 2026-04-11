import { startZentaoIframeMonitoring } from './mainFrame.iframes';
import { logZentao } from './shared';

export function runZentaoMainFrameFlow() {
  logZentao('Running in main frame - will monitor iframes');
  startZentaoIframeMonitoring();
}
