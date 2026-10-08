import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),create:vi.fn(),set:vi.fn(),redirect:vi.fn((path:string)=>{throw Error('redirect:'+path)})}));
vi.mock('next/headers',()=>({headers:async()=>new Headers({'x-forwarded-proto':'https'}),cookies:async()=>({set:mocks.set})}));
vi.mock('next/navigation',()=>({redirect:mocks.redirect}));
vi.mock('@/lib/auth',()=>({requestAuth:async()=>({api:{getSession:mocks.session}})}));
vi.mock('@/lib/context',()=>({ORG_COOKIE:'axxes_org'}));
vi.mock('@/lib/workspace',()=>({ensurePulseWorkspace:mocks.create}));
import { createPulseWorkspace } from '../../src/lib/actions/workspace';
function form(name='My workspace'){const data=new FormData();data.set('name',name);data.set('userId','attacker-controlled');data.set('tenantId','attacker-controlled');data.set('redirect','https://members.axxes.club');return data;}
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({user:{id:'authenticated-user'}});mocks.create.mockResolvedValue({id:'owned-workspace',name:'My workspace'});});
it('rejects signed-out actions without writes or cookies',async()=>{mocks.session.mockResolvedValue(null);expect(await createPulseWorkspace({error:''},form())).toEqual({error:expect.stringContaining('sign in')});expect(mocks.create).not.toHaveBeenCalled();expect(mocks.set).not.toHaveBeenCalled();});
it('uses authenticated identity, sets a host-only preference, and returns exclusively to Pulse',async()=>{await expect(createPulseWorkspace({error:''},form())).rejects.toThrow('redirect:/dashboard');expect(mocks.create).toHaveBeenCalledWith({id:'authenticated-user'},'My workspace');expect(mocks.set).toHaveBeenCalledWith('axxes_org','owned-workspace',{httpOnly:true,sameSite:'lax',secure:true,path:'/',maxAge:31536000});expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');});
it('returns retryable failures without claiming success or setting a tenant cookie',async()=>{mocks.create.mockRejectedValue(Error('private database details'));expect(await createPulseWorkspace({error:''},form())).toEqual({error:'Your workspace could not be created. Please try again.'});expect(mocks.set).not.toHaveBeenCalled();expect(mocks.redirect).not.toHaveBeenCalled();});
it('rejects invalid names before service invocation',async()=>{for(const name of [' ','a'.repeat(101),'bad\u0000name'])expect(await createPulseWorkspace({error:''},form(name))).toEqual({error:expect.stringContaining('workspace name')});expect(mocks.create).not.toHaveBeenCalled();});
