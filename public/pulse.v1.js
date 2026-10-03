/* AXXES Pulse v1. Public identifiers only. */
(function () {
  'use strict';
  if (window.pulse) return;
  var script = document.currentScript;
  if (!script) return;
  var site = script.getAttribute('data-site');
  if (!site || !/^[a-zA-Z0-9_-]{1,100}$/.test(site)) return;
  var endpoint = new URL(script.src).origin + '/api/pulse/collect';
  var environment = script.getAttribute('data-environment') === 'development' ? 'development' : 'production';
  var persistent = script.getAttribute('data-identity') === 'persistent';
  var permitted = !persistent && script.getAttribute('data-consent') !== 'required';
  var persistentId;
  function identity() { if(!persistent)return undefined; if(!persistentId){try{persistentId=localStorage.getItem('pulse-visitor-'+site);if(!persistentId){persistentId=uid();localStorage.setItem('pulse-visitor-'+site,persistentId);}}catch(_){persistentId=uid();}} return persistentId; }
  var queue = [], timer, lastPage = '', session = uid(), lastActivity = Date.now(), destroyed = false;
  var originalPush = window.history.pushState, originalReplace = window.history.replaceState;
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function cleanUrl(value) { try { var u = new URL(value); var clean = new URL(u.origin + u.pathname); ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){var v=u.searchParams.get(k);if(v)clean.searchParams.set(k,v.slice(0,256));});return clean.toString(); } catch (_) { return ''; } }
  function track(name, properties, eventId, eventUrl) {
    if (destroyed || !permitted || navigator.globalPrivacyControl || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
    if (Date.now() - lastActivity > 1800000) session = uid();
    lastActivity = Date.now();
    var safe = {}; Object.keys(properties || {}).slice(0,20).forEach(function(k){var v=properties[k];if(k.length<=64&&(typeof v==='boolean'||(typeof v==='number'&&isFinite(v))||typeof v==='string'))safe[k]=typeof v==='string'?v.slice(0,256):v;});
    queue.push({id:eventId||uid(),visitorId:identity(),name:name,timestamp:new Date().toISOString(),url:eventUrl||cleanUrl(location.href),referrer:cleanUrl(document.referrer),sessionId:session,properties:safe});
    if (queue.length > 100) queue.shift();
    if (queue.length >= 20) flush(); else if (!timer) timer = setTimeout(flush, 1500);
  }
  function page() { var path=cleanUrl(location.href); if (lastPage===path) return; if (!permitted||navigator.globalPrivacyControl) return; lastPage=path; track('pageview'); }
  function send(batch, attempt) { var body=JSON.stringify({schemaVersion:1,siteId:site,environment:environment,events:batch});if(body.length>32000){if(batch.length>1){send(batch.slice(0,Math.floor(batch.length/2)),0);send(batch.slice(Math.floor(batch.length/2)),0);}return;}try{if(navigator.sendBeacon&&navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain'})))return;}catch(_){}try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:body,keepalive:true,credentials:'omit'}).then(function(r){if(!r.ok&&r.status>=500)throw new Error('Unavailable');}).catch(function(){if(attempt<2&&!destroyed)setTimeout(function(){send(batch,attempt+1);},1000*(attempt+1));});}catch(_){} }
  function flush() { clearTimeout(timer); timer=undefined; if(!permitted||navigator.globalPrivacyControl){queue=[];return;}while(queue.length)send(queue.splice(0,20),0); }
  function navPush() { var result=originalPush.apply(this,arguments);page();return result; }
  function navReplace() { var result=originalReplace.apply(this,arguments);page();return result; }
  function visibility() { if(document.visibilityState==='hidden')flush(); }
  window.history.pushState=navPush;window.history.replaceState=navReplace;
  window.addEventListener('popstate',page);window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);
  window.pulse={track:track,page:page,flush:flush,consent:function(value){permitted=value===true;if(permitted)page();else{queue=[];lastPage='';}},destroy:function(){destroyed=true;clearTimeout(timer);queue=[];if(window.history.pushState===navPush)window.history.pushState=originalPush;if(window.history.replaceState===navReplace)window.history.replaceState=originalReplace;window.removeEventListener('popstate',page);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);delete window.pulse;}};
  if (typeof PerformanceObserver === 'function' && script.getAttribute('data-performance') === 'true') {
    var performanceUrl=cleanUrl(location.href);
    import(new URL('/vendor/web-vitals.v6.2.2.js',script.src).href).then(function(vitals){
      function metric(m){track('web_vital',{metric:m.name,value:m.value,rating:m.rating},'vital_'+m.id,performanceUrl);flush();}
      vitals.onLCP(metric);vitals.onINP(metric);vitals.onCLS(metric);
    }).catch(function(){});
  }
  page();
})();
