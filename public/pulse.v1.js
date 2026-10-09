/* AXXES Pulse v1. Public identifiers only. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) return;
  var nativeGeneration = script.getAttribute("data-native-generation");
  if(nativeGeneration && Number(nativeGeneration)!==window.__axxesPulseGeneration)return;
  if(window.pulse)return;
  var site = script.getAttribute('data-site');
  if (!site || !/^[a-zA-Z0-9_-]{1,100}$/.test(site)) return;
  var endpoint;try{var destination=new URL(script.getAttribute('data-endpoint') || '/api/pulse/collect',script.src);if(destination.protocol!=='https:' && !(destination.protocol==='http:' && ['localhost','127.0.0.1'].includes(destination.hostname)))return;endpoint=destination.href;}catch(_){return;}
  var environment = script.getAttribute('data-environment') === 'development' ? 'development' : 'production';
  var persistent = script.getAttribute('data-identity') === 'persistent';
  var permitted = !persistent && script.getAttribute('data-consent') !== 'required';
  var verification = script.getAttribute("data-verify"), verificationSent = false;
  var persistentId;
  function identity() { if(!persistent)return undefined; if(!persistentId){try{persistentId=localStorage.getItem('pulse-visitor-'+site);if(!persistentId){persistentId=uid();localStorage.setItem('pulse-visitor-'+site,persistentId);}}catch(_){persistentId=uid();}} return persistentId; }
  var queue = [], timer, lastPage = '', session, lastActivity = 0, destroyed = false;
  var sessionStorageKey = 'pulse-session-' + site + '-' + environment;
  function clearSession() {
    session = undefined; lastActivity = 0;
    try { sessionStorage.removeItem(sessionStorageKey); } catch (_) {}
  }
  function activity() {
    var now = Date.now();
    if (!session) {
      try {
        var saved = JSON.parse(sessionStorage.getItem(sessionStorageKey) || 'null');
        if (saved && /^[a-zA-Z0-9_-]{1,100}$/.test(saved.id) &&
            typeof saved.lastActivity === 'number' && isFinite(saved.lastActivity) &&
            saved.lastActivity <= now && now - saved.lastActivity <= 1800000) {
          session = saved.id; lastActivity = saved.lastActivity;
        }
      } catch (_) {}
    }
    if (!session || now - lastActivity > 1800000 || now < lastActivity) session = uid();
    lastActivity = now;
    try { sessionStorage.setItem(sessionStorageKey, JSON.stringify({id:session,lastActivity:lastActivity})); } catch (_) {}
  }
  // Opt-in automatic interactions: data-auto="all" or a list of contact,outbound,downloads,forms,scroll,engagement.
  // Sends kinds, hosts and file names only: never addresses, numbers, link text or form contents.
  var autoAttr=(script.getAttribute('data-auto')||'').toLowerCase().split(/[\s,]+/).filter(Boolean);
  function auto(kind){return autoAttr.indexOf('all')>=0||autoAttr.indexOf(kind)>=0;}
  var autoCleanup=[], depthSent={}, engagedMs=0, visibleSince=document.visibilityState==='visible'?Date.now():0, engagementUrl='';
  var downloadExt=/\.(pdf|zip|rar|7z|docx?|xlsx?|pptx?|csv|txt|rtf|epub|mp3|wav|mp4|mov|dmg|exe|apk)$/i;
  function listen(target,type,fn,opts){target.addEventListener(type,fn,opts);autoCleanup.push(function(){target.removeEventListener(type,fn,opts);});}
  function short(v){return String(v||'').replace(/[^\w.\- ]/g,'').trim().slice(0,64);}
  if(auto('contact')||auto('outbound')||auto('downloads'))listen(document,'click',function(e){
    var el=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!el)return;
    var href=el.getAttribute('href')||'',scheme=(href.match(/^([a-z][a-z0-9+.-]*):/i)||[])[1];scheme=scheme?scheme.toLowerCase():'';
    if(scheme==='mailto'||scheme==='tel'||scheme==='sms'){if(auto('contact'))track('contact_click',{method:scheme==='mailto'?'email':scheme==='tel'?'phone':'sms'});return;}
    var u;try{u=new URL(el.href,location.href);}catch(_){return;}
    if(u.protocol!=='https:'&&u.protocol!=='http:')return;
    var wa=/(^|\.)(wa\.me|whatsapp\.com)$/i.test(u.hostname);
    if(wa&&auto('contact')){track('contact_click',{method:'whatsapp'});return;}
    var file=u.pathname.split('/').pop()||'';
    if(auto('downloads')&&(el.hasAttribute('download')||downloadExt.test(u.pathname))){track('file_download',{file:short(decodeURIComponent(file))||'file',type:(file.split('.').pop()||'').toLowerCase().slice(0,8),host:u.host===location.host?'':u.hostname});return;}
    if(auto('outbound')&&u.host!==location.host)track('outbound_click',{host:u.hostname.replace(/^www\./,'')});
  },true);
  if(auto('contact')||auto('forms'))listen(document,'submit',function(e){
    var f=e.target;if(!f||f.tagName!=='FORM')return;
    var search=f.getAttribute('role')==='search'||!!f.querySelector('input[type="search"],input[name="s"]');
    track('form_submit',{form:short(f.getAttribute('id')||f.getAttribute('name')||f.getAttribute('aria-label'))||'form',kind:search?'search':'form'});flush();
  },true);
  function resetPageMeasures(){depthSent={};engagedMs=0;visibleSince=document.visibilityState==='visible'?Date.now():0;engagementUrl=cleanUrl(location.href);}
  function scrolled(){
    var doc=document.documentElement,height=Math.max(doc.scrollHeight,document.body?document.body.scrollHeight:0),view=window.innerHeight||doc.clientHeight;
    var pct=height<=view?100:Math.min(100,Math.round(((window.scrollY||doc.scrollTop)+view)/height*100));
    [25,50,75,100].forEach(function(d){if(pct>=d&&!depthSent[d]){depthSent[d]=true;track('scroll_depth',{depth:d});}});
  }
  var scrollTimer;if(auto('scroll'))listen(window,'scroll',function(){if(!scrollTimer)scrollTimer=setTimeout(function(){scrollTimer=undefined;scrolled();},250);},{passive:true});
  function reportEngagement(){
    if(!auto('engagement')||!engagementUrl)return;
    if(visibleSince){engagedMs+=Date.now()-visibleSince;visibleSince=document.visibilityState==='visible'?Date.now():0;}
    var seconds=Math.min(1800,Math.round(engagedMs/1000));engagedMs=0;
    if(seconds>=1)track('engagement',{seconds:seconds},undefined,engagementUrl);
  }
  var originalPush = window.history.pushState, originalReplace = window.history.replaceState;
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function cleanUrl(value) { try { var u = new URL(value); var clean = new URL(u.origin + u.pathname); ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){var v=u.searchParams.get(k);if(v)clean.searchParams.set(k,v.slice(0,256));});return clean.toString(); } catch (_) { return ''; } }
  function track(name, properties, eventId, eventUrl) {
    if (destroyed || !permitted || navigator.globalPrivacyControl || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
    activity();
    var safe = {}; Object.keys(properties || {}).slice(0,20).forEach(function(k){var v=properties[k];if(k.length<=64&&(typeof v==='boolean'||(typeof v==='number'&&isFinite(v))||typeof v==='string'))safe[k]=typeof v==='string'?v.slice(0,256):v;});
    queue.push({id:eventId||uid(),visitorId:identity(),name:name,timestamp:new Date().toISOString(),url:eventUrl||cleanUrl(location.href),referrer:cleanUrl(document.referrer),sessionId:session,properties:safe});
    if (queue.length > 100) queue.shift();
    if (queue.length >= 20) flush(); else if (!timer) timer = setTimeout(flush, 1500);
  }
  function page() { var path=cleanUrl(location.href); if (lastPage===path) return; if (!permitted||navigator.globalPrivacyControl) return; if(lastPage)reportEngagement(); lastPage=path; track('pageview'); resetPageMeasures(); if(auto('scroll'))setTimeout(scrolled,1000); if(verification && !verificationSent){verificationSent=true;track('pulse.verify',{verification_token:verification});} }
  function send(batch, attempt) { var body=JSON.stringify({schemaVersion:1,siteId:site,environment:environment,events:batch});if(body.length>32000){if(batch.length>1){send(batch.slice(0,Math.floor(batch.length/2)),0);send(batch.slice(Math.floor(batch.length/2)),0);}return;}try{if(navigator.sendBeacon&&navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain'})))return;}catch(_){}try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:body,keepalive:true,credentials:'omit'}).then(function(r){if(!r.ok&&r.status>=500)throw new Error('Unavailable');}).catch(function(){if(attempt<2&&!destroyed)setTimeout(function(){send(batch,attempt+1);},1000*(attempt+1));});}catch(_){} }
  function flush() { clearTimeout(timer); timer=undefined; if(!permitted||navigator.globalPrivacyControl){queue=[];return;}while(queue.length)send(queue.splice(0,20),0); }
  function onPagehide(){reportEngagement();flush();}
  function navPush() { var result=originalPush.apply(this,arguments);page();return result; }
  function navReplace() { var result=originalReplace.apply(this,arguments);page();return result; }
  function visibility() { if(document.visibilityState==='hidden'){reportEngagement();flush();}else if(!visibleSince)visibleSince=Date.now(); }
  window.history.pushState=navPush;window.history.replaceState=navReplace;
  window.addEventListener('popstate',page);window.addEventListener('pagehide',onPagehide);document.addEventListener('visibilitychange',visibility);
  window.pulse={track:track,page:page,flush:flush,consent:function(value){permitted=value===true;if(permitted)page();else{queue=[];lastPage='';clearSession();}},destroy:function(){destroyed=true;clearTimeout(timer);queue=[];if(window.history.pushState===navPush)window.history.pushState=originalPush;if(window.history.replaceState===navReplace)window.history.replaceState=originalReplace;window.removeEventListener('popstate',page);window.removeEventListener('pagehide',onPagehide);autoCleanup.forEach(function(f){f();});document.removeEventListener('visibilitychange',visibility);delete window.pulse;}};
  if (typeof PerformanceObserver === 'function' && script.getAttribute('data-performance') === 'true') {
    var performanceUrl=cleanUrl(location.href);
    import(new URL('/vendor/web-vitals.v6.2.2.js',script.src).href).then(function(vitals){
      function metric(m){track('web_vital',{metric:m.name,value:m.value,rating:m.rating},'vital_'+m.id,performanceUrl);flush();}
      vitals.onLCP(metric);vitals.onINP(metric);vitals.onCLS(metric);
    }).catch(function(){});
  }
  page();
})();
