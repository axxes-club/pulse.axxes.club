import {afterEach,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {act,create} from 'react-test-renderer';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
import {SiteSettings} from '@/components/pulse/site-settings';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:any;
afterEach(async()=>{if(root)await act(async()=>root.unmount());root=null;vi.unstubAllGlobals();});
it('offers a working retry after settings fail instead of leaving a loading message',async()=>{
 const data={site:{name:'Example',timezone:'UTC',enabled:true,allowedOrigins:[],environment:'development',collection:'server',identityMode:'ephemeral'},credentials:[]};
 const fetch=vi.fn().mockRejectedValueOnce(Error('Connection interrupted')).mockResolvedValue({ok:true,json:async()=>data});vi.stubGlobal('fetch',fetch);
 await act(async()=>{root=create(createElement(SiteSettings,{siteId:'app-a',canManage:true,demo:false}));});
 expect(root.root.findByProps({role:'alert'}).children).toContain('Connection interrupted');
 expect(JSON.stringify(root.toJSON())).not.toContain('Loading app settings');
 await act(async()=>root.root.findAllByType('button').find((button:any)=>button.children.includes('Retry settings')).props.onClick());
 expect(root.root.findByProps({value:'Example'})).toBeTruthy();
 expect(root.root.findAllByType('select').some((select:any)=>select.props.value==='ephemeral')).toBe(true);
 expect(fetch).toHaveBeenCalledTimes(2);
});
