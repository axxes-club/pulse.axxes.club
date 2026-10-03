/** AXXES Pulse local SDK v1. Download with its .d.ts; no npm install required. */
export function loadPulse(options) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const installed = document.querySelector('script[data-pulse-sdk], script[data-site]');
  if (installed && installed.dataset.site !== options.siteId) return Promise.reject(new Error('A different Pulse app is already installed'));
  if (window.pulse && !installed) return Promise.reject(new Error('An existing Pulse tracker has no matching app configuration'));
  if (window.pulse) return Promise.resolve(window.pulse);
  const endpoint = new URL(options.endpoint || 'https://pulse.axxes.app');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(options.siteId)) return Promise.reject(new Error('Invalid Pulse app identifier'));
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pulse-sdk]');
    const script = existing || document.createElement('script');
    if (existing && script.dataset.site !== options.siteId) return reject(new Error('A different Pulse app is already installed'));
    const loaded = () => window.pulse ? resolve(window.pulse) : reject(new Error('Pulse could not initialize'));
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Pulse script could not load')), { once: true });
    if (!existing) {
      script.async = true;
      script.src = new URL('/pulse.v1.js',endpoint).href;
      script.dataset.pulseSdk = 'v1';
      script.dataset.site = options.siteId;
      script.dataset.endpoint = new URL('/api/pulse/collect',endpoint).href;
      script.dataset.environment = options.environment || 'production';
      script.dataset.performance = options.performance === false ? 'false' : 'true';
      if(options.consentRequired || options.identity === 'persistent') script.dataset.consent = 'required';
      if(options.identity === 'persistent') script.dataset.identity = 'persistent';
      document.head.appendChild(script);
    }
  });
}
