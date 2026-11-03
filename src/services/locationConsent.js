// Every use of the GPS is first approved in the app's own dialog (LocationConsentDialog), each time.
// The browser may add its own permission prompt the first time.

let host = null;

/** Called by the dialog mounted in App; returns the unregister function */
export function registerLocationConsentHost(ask) {
  host = ask;
  return () => {
    if (host === ask) host = null;
  };
}

/**
 * @param {'tracking' | 'locate' | 'borne' | 'form' | 'photo'} purpose  why the position is needed
 * @returns {Promise<boolean>} true when the user allows it
 */
export function askLocationConsent(purpose) {
  if (!host) return Promise.resolve(false);
  return host(purpose);
}
