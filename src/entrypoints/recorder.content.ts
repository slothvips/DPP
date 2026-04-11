import { createRecorderContentController } from './recorder/controller';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    createRecorderContentController().init();
  },
});
