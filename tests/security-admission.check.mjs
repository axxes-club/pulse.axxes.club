import test from 'node:test';import assert from 'node:assert/strict';
let policy;try{policy=await import('../src/lib/security/admission-core.mjs')}catch{policy={}}
test('trusted Google appended pair ignores caller prefixes',()=>{assert.equal(typeof policy.clientIp,'function','trusted client resolver absent');assert.equal(policy.clientIp(new Headers({'x-forwarded-for':'1.2.3.4, 8.8.8.8, 34.120.1.2'}),['34.120.1.2']),'8.8.8.8')});
test('untrusted forwarding chain uses shared bucket',()=>{assert.equal(typeof policy.clientIp,'function');assert.equal(policy.clientIp(new Headers({'x-forwarded-for':'1.2.3.4','x-real-ip':'5.6.7.8'}),[]),'untrusted')});
test('distributed admission rejects exhausted buckets',async()=>{assert.equal(typeof policy.consume,'function');await assert.rejects(()=>policy.consume(async()=>({rows:[]}), 'tenant',120),/limit/i)});
test('database failure never silently disables admission',async()=>{assert.equal(typeof policy.consume,'function');await assert.rejects(()=>policy.consume(async()=>{throw Error('offline')},'tenant',120),/offline/)});
