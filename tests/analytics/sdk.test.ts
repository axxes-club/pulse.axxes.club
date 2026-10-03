import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
it('rejects a second app instead of returning the first app tracker',async()=>{
 const context:any={window:{pulse:{track(){}}},document:{querySelector:()=>({dataset:{site:'app_first'}})},URL,Promise,Error};
 runInNewContext(readFileSync('public/sdk/pulse-sdk.v1.js','utf8').replace('export function','function')+';globalThis.load=loadPulse;',context);
 await expect(context.load({siteId:'app_second'})).rejects.toThrow('different Pulse app');
});
it('rejects changed consent settings for a running tracker',async()=>{
 const context:any={window:{pulse:{track(){}}},document:{querySelector:()=>({src:'https://pulse.axxes.app/pulse.v1.js',dataset:{site:'app_first',environment:'production',performance:'true',endpoint:'https://pulse.axxes.app/api/pulse/collect'}})},URL,Promise,Error};
 runInNewContext(readFileSync('public/sdk/pulse-sdk.v1.js','utf8').replace('export function','function')+';globalThis.load=loadPulse;',context);
 await expect(context.load({siteId:'app_first',consentRequired:true})).rejects.toThrow('configuration');
});
it('reloads a destroyed SDK instead of waiting on a completed script',async()=>{
 const old={dataset:{site:'app_first',pulseReady:'true'},remove(){removed=true}};let removed=false;let appended=false;
 const context:any={window:{},document:{querySelector:()=>old,createElement:()=>({dataset:{},addEventListener(this:any,name:string,fn:Function){this[name]=fn}}),head:{appendChild(s:any){appended=true;context.window.pulse={track(){}};s.load()}}},URL,Promise,Error};
 runInNewContext(readFileSync('public/sdk/pulse-sdk.v1.js','utf8').replace('export function','function')+';globalThis.load=loadPulse;',context);
 const pending=context.load({siteId:'app_first'});expect(appended).toBe(true);await pending;expect(removed).toBe(true);
});
