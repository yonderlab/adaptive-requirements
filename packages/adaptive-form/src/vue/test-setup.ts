import { config } from '@vue/test-utils';

let failOnVueWarnings = true;

/** Temporarily allow Vue framework warnings for tests that assert warning behavior. */
export function allowVueWarnings(): void {
  failOnVueWarnings = false;
}

/** Restore the default policy of failing tests on Vue framework warnings. */
export function resetVueWarningPolicy(): void {
  failOnVueWarnings = true;
}

config.global.config.warnHandler = (msg, _instance, trace) => {
  if (!failOnVueWarnings) {
    return;
  }

  throw new Error(`Unexpected Vue warning: ${msg}${trace ?? ''}`);
};
