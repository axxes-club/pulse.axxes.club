import {it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {create,act} from 'react-test-renderer';
import {PulseProvider,usePulse} from '../../public/sdk/pulse-react.v1';
import {loadPulse} from '../../public/sdk/pulse-sdk.v1.js';
vi.mock('../../public/sdk/pulse-sdk.v1.js',()=>({loadPulse:vi.fn()}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('never exposes an earlier organization client after a config change fails',async()=>{
 const first={track:vi.fn(),page(){},flush(){},consent(){},destroy(){}};
 vi.mocked(loadPulse).mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('A different Pulse app is already installed'));
 const seen:any[]=[];function Consumer(){seen.push(usePulse());return null}let root:any;
 await act(async()=>{root=create(createElement(PulseProvider,{siteId:'app_first',children:createElement(Consumer)}))});expect(seen.at(-1)).toBe(first);
 seen.length=0;const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{await act(async()=>{root.update(createElement(PulseProvider,{siteId:'app_second',children:createElement(Consumer)}))});expect(seen).not.toContain(first);expect(seen.at(-1)).toBeNull();expect(warn).toHaveBeenCalled();}finally{await act(async()=>root.unmount());warn.mockRestore()}
});
