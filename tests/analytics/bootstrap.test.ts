import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
it('ignores older AXXES organization configuration responses',async()=>{
 const pending:Array<(v:any)=>void>=[];const installed:any[]=[];let tenant='tenant_a';const context:any={window:{},document:{currentScript:{getAttribute:(key:string)=>key==='data-app'?'relay':tenant},createElement:()=>({setAttribute(this:any,key:string,value:string){this[key]=value}}),head:{appendChild:(s:any)=>installed.push(s)}},fetch:()=>new Promise(resolve=>pending.push(resolve)),encodeURIComponent,Error};
 const code=readFileSync('public/axxes.v1.js','utf8');runInNewContext(code,context);tenant='tenant_b';runInNewContext(code,context);
 pending[1]({ok:true,json:async()=>({siteId:'app_b',environment:'production'})});await new Promise(r=>setTimeout(r,0));pending[0]({ok:true,json:async()=>({siteId:'app_a',environment:'production'})});await new Promise(r=>setTimeout(r,0));expect(installed.map(s=>s['data-site'])).toEqual(['app_b']);
});
