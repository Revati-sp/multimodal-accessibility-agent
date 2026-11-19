import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom may not implement the modal dialog API; provide the minimal behaviour the app relies on.
const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
if (typeof proto.showModal !== 'function') {
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (typeof proto.close !== 'function') {
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});
