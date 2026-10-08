/** Keep auth return intent inside Pulse, including the user's report filters. */
export function safePulseReturn(value: unknown): string {
  if(typeof value!=='string'||value.length>2000||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value))return '/dashboard';
  try {
    const embed=new URL(value,'https://pulse.axxes.app');
    if(/^\/embed\/(overview|realtime|audience|acquisition|events|funnels|performance|retention|pages)$/.test(embed.pathname)){
      const view=embed.pathname.split('/').at(-1);
      return safePulseReturn((view==='overview'?'/dashboard':'/dashboard/'+view)+embed.search);
    }
    const decoded=decodeURIComponent(value.split('?')[0]);
    if(/[\\\u0000-\u001f\u007f]/.test(decoded))return '/dashboard';
    const parsed=new URL(decoded,'https://pulse.axxes.app');
    if(parsed.origin!=='https://pulse.axxes.app'||!(parsed.pathname==='/dashboard'||parsed.pathname.startsWith('/dashboard/')))return '/dashboard';
    const url=new URL(value,'https://pulse.axxes.app');
    if(!(url.pathname==='/dashboard'||url.pathname.startsWith('/dashboard/')))return '/dashboard';
    const path=url.pathname+url.search;
    return encodeURIComponent(path).length<=2800?path:'/dashboard';
  } catch {return '/dashboard';}
}
export function pulseSignInPath(returnTo:unknown):string {
  const path=safePulseReturn(returnTo);
  return path==='/dashboard'?'/sign-in':'/sign-in?returnTo='+encodeURIComponent(path);
}
/** Valid embedded reports preserve their filters; other Pulse pages stay standalone. */
export function pulseEmbedPath(value:unknown):string {
  const url=new URL(safePulseReturn(value),'https://pulse.axxes.app');
  if(url.pathname==='/dashboard')url.pathname='/embed/overview';
  else if(/^\/dashboard\/(overview|realtime|audience|acquisition|events|funnels|performance|retention|pages)$/.test(url.pathname))url.pathname=url.pathname.replace('/dashboard/','/embed/');
  return url.pathname+url.search;
}
