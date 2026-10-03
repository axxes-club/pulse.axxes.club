/** AXXES Pulse local SDK v1. One explicit app/configuration per page. */
export function loadPulse(options) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(options.siteId)) return Promise.reject(new Error('Invalid Pulse app identifier'));
  let endpoint;
  try { endpoint = new URL(options.endpoint || 'https://pulse.axxes.app'); } catch { return Promise.reject(new Error('Invalid Pulse endpoint')); }
  const expected = {
    site: options.siteId,
    endpoint: new URL('/api/pulse/collect', endpoint).href,
    environment: options.environment || 'production',
    performance: options.performance === false ? 'false' : 'true',
    consent: options.consentRequired || options.identity === 'persistent' ? 'required' : '',
    identity: options.identity === 'persistent' ? 'persistent' : '',
  };
  let existing = document.querySelector('script[data-pulse-sdk], script[data-site]');
  if (existing && !window.pulse && existing.dataset.pulseReady === 'true') { existing.remove(); existing = null; }
  if (existing) {
    if (existing.dataset.site !== expected.site) return Promise.reject(new Error('A different Pulse app is already installed'));
    const actual = {
      site: existing.dataset.site,
      endpoint: existing.dataset.endpoint || new URL('/api/pulse/collect', existing.src).href,
      environment: existing.dataset.environment || 'production',
      performance: existing.dataset.performance === 'true' ? 'true' : 'false',
      consent: existing.dataset.consent || '', identity: existing.dataset.identity || '',
    };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) return Promise.reject(new Error('Pulse configuration changed; destroy and remove the previous tracker before installing another configuration'));
  }
  if (window.pulse) return existing ? Promise.resolve(window.pulse) : Promise.reject(new Error('An existing Pulse tracker has no matching app configuration'));
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    const loaded = () => { script.dataset.pulseReady = 'true'; window.pulse ? resolve(window.pulse) : reject(new Error('Pulse could not initialize')); };
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', () => { script.remove(); reject(new Error('Pulse script could not load')); }, { once: true });
    if (!existing) {
      script.async = true;
      script.src = new URL('/pulse.v1.js', endpoint).href;
      script.dataset.pulseSdk = 'v1';
      Object.assign(script.dataset, expected);
      document.head.appendChild(script);
    }
  });
}
