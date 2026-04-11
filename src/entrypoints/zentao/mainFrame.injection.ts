import { enhanceMainFrameAttachments } from './attachments';
import { bindUploadButton, createUploadButton } from './mainFrame.shared';
import {
  MAIN_FRAME_RETRY_DELAYS,
  logZentao,
  observeBodyMutations,
  scheduleRetries,
} from './shared';

function injectUploadButton(formGroup: HTMLElement, input: HTMLInputElement, doc: Document) {
  if (formGroup.dataset.dppInjected) {
    return;
  }
  formGroup.dataset.dppInjected = 'true';

  logZentao('Injecting button into form group');

  const button = createUploadButton(doc);
  bindUploadButton(button, doc, input);

  const uploaderArea = formGroup.querySelector('.uploader, .file-list, .form-control');
  if (uploaderArea) {
    uploaderArea.after(button);
  } else {
    formGroup.appendChild(button);
  }
}

export function injectIntoZentaoDocument(doc: Document) {
  function runInjection() {
    const actionBoxGroups = doc.querySelectorAll<HTMLElement>(
      '#actionbox .form-group:not([data-dpp-injected]), .action-box .form-group:not([data-dpp-injected])'
    );

    for (const group of actionBoxGroups) {
      const input = group.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) {
        injectUploadButton(group, input, doc);
      }
    }

    const fileGroup = doc.querySelector<HTMLElement>('.form-group[data-name="files"]');
    if (fileGroup && !fileGroup.dataset.dppInjected) {
      const input = fileGroup.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) {
        injectUploadButton(fileGroup, input, doc);
      }
    }

    const uploaders = doc.querySelectorAll<HTMLElement>(
      '.uploader:not([data-dpp-injected]), .file-list:not([data-dpp-injected])'
    );
    for (const uploader of uploaders) {
      const input = uploader.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) {
        const parent = uploader.closest<HTMLElement>('.form-group') || uploader;
        injectUploadButton(parent, input, doc);
      }
    }

    const fileInputs = doc.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-dpp-processed])'
    );
    for (const input of fileInputs) {
      input.dataset.dppProcessed = 'true';
      const parent = input.closest<HTMLElement>('.form-group') || input.parentElement;
      if (parent) {
        injectUploadButton(parent as HTMLElement, input, doc);
      }
    }
  }

  if (doc.body) {
    runInjection();
    enhanceMainFrameAttachments(doc);
    scheduleRetries(() => {
      runInjection();
      enhanceMainFrameAttachments(doc);
    }, MAIN_FRAME_RETRY_DELAYS);
    observeBodyMutations(doc.body, () => {
      runInjection();
      enhanceMainFrameAttachments(doc);
    });
  }
}
