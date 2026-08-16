// Tracks in-flight API calls so a single global indicator can reflect "something is
// loading" across the whole app, without every page having to wire up its own request
// state. Same window-event pub/sub shape as lib/userDetail.ts's onUserDetailChange, for
// consistency with the one other place this codebase bridges non-React state into React.
const EVENT = "yoton:api-loading-changed";

let activeRequests = 0;

export function startApiRequest() {
  activeRequests += 1;
  if (activeRequests === 1) window.dispatchEvent(new Event(EVENT));
}

export function endApiRequest() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) window.dispatchEvent(new Event(EVENT));
}

export function isApiLoading() {
  return activeRequests > 0;
}

export function onApiLoadingChange(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
