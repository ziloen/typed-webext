// https://github.com/wxt-dev/wxt/blob/main/packages/is-background/src/getter.ts

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
declare class ServiceWorkerGlobalScope {}

/**
 * Check if the current page is the background page
 */
/* #__NO_SIDE_EFFECTS__ */
export function getIsBackground(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-imports
  const browser: import('webextension-polyfill').Browser | undefined =
    // @ts-expect-error just ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome

  if (!browser?.runtime.id) {
    return false
  }

  // Chromium
  if (
    // eslint-disable-next-line unicorn/no-typeof-undefined
    typeof ServiceWorkerGlobalScope !== 'undefined' &&
    globalThis instanceof ServiceWorkerGlobalScope
  ) {
    return true
  }

  // Firefox
  return (
    typeof window !== 'undefined' &&
    typeof browser.extension?.getBackgroundPage === 'function' &&
    browser.extension.getBackgroundPage() === window
  )
}
