// getSdk(): the real Rollerz SDK when the page is opened with ?sdk=live (loads the script tag from the testing
// environment and inits), otherwise the local stand-in that runs the engine modules in the page.
export const LIVE_SDK_URL = 'https://rollerzsdk-develop.up.railway.app/sdk';
export async function getSdk(gameId = 'gnarone-sample') {
  const live = new URLSearchParams(location.search).get('sdk') === 'live';
  if (live) {
    if (!window.RollerzSDK) await new Promise((res, rej) => { const el = document.createElement('script'); el.src = LIVE_SDK_URL; el.onload = res; el.onerror = () => rej(new Error('could not load the Rollerz SDK')); document.head.appendChild(el); });
    await window.RollerzSDK.init(gameId); window.RollerzSDK.isLocal = false; return window.RollerzSDK;
  }
  const local = (await import('./local-sdk.js')).default; await local.init(gameId); return local;
}
export const fmtMoney = cents => (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
