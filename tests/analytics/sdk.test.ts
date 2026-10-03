import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
it('rejects a second app instead of returning the first app tracker',async()=>{
 const context:any={window:{pulse:{track(){}}},document:{querySelector:()=>({dataset:{site:'app_first'}})},URL,Promise,Error};
 runInNewContext(readFileSync('public/sdk/pulse-sdk.v1.js','utf8').replace('export function','function')+';globalThis.load=loadPulse;',context);
 await expect(context.load({siteId:'app_second'})).rejects.toThrow('different Pulse app');
});
