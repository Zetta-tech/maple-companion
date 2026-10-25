import {describe,it,expect} from 'vitest';
import {loadConfig,bindingFor} from '../server/config.js';
import {loadDemoBindings} from '../server/demo-config.js';
import {createDemoMemory} from '../server/demo-memory.js';
import {randomUUID} from 'node:crypto';

const base={ownerId:'user_fixture',endpoint:'https://ordinary.example.test',context:'ordinary',readKeyEnv:'AM_USER_READ_KEY',writeKeyEnv:'AM_USER_WRITE_KEY',nativePrincipalId:'ordinary-principal',nativeScope:'maple/conversation'};
const demo={...base,endpoint:'https://demo.example.test',context:'demo',readKeyEnv:'AM_DEMO_READ_KEY',writeKeyEnv:'AM_DEMO_WRITE_KEY',nativePrincipalId:'demo-principal'};
const env={NODE_ENV:'development',MAPLE_AM_ACCESS_MODE:'single-user-development',APP_ORIGIN:'http://localhost:3000',CLERK_PUBLISHABLE_KEY:'pk_test_fixture',CLERK_SECRET_KEY:'sk_test_fixture',MAPLE_AM_BINDINGS_FILE:'ordinary.json',MAPLE_DEMO_AM_BINDINGS_FILE:'demo.json',AM_USER_READ_KEY:'ordinary-key',AM_USER_WRITE_KEY:'ordinary-key',AM_DEMO_READ_KEY:'demo-key',AM_DEMO_WRITE_KEY:'demo-key'};
const ordinary=()=>loadConfig(env,()=>JSON.stringify([base]));
describe('dedicated fictional Guide Context configuration',()=>{
  it('reads only the demo binding file and leaves the ordinary client binding intact',async()=>{
    const original=ordinary();const bindings=loadDemoBindings(original,env,path=>{expect(path).toBe('demo.json');return JSON.stringify([demo]);});
    const primary=bindingFor(original,base.ownerId);expect(primary.context).toBe('ordinary');expect(primary.readKey).toBe('ordinary-key');
    const requests:string[]=[];
    const memory=createDemoMemory(owner=>bindingFor({bindings},owner),async(input,init)=>{
      const url=new URL(String(input));requests.push(url.href);expect(url.origin).toBe('https://demo.example.test');expect(url.pathname).toMatch(/^\/api\/v1\/demo\//);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer demo-key');
      return url.pathname.endsWith('/me')?Response.json({principalId:'demo-principal'}):Response.json({reply:'Explicit test transport',sessionId:'test-session',traceId:'test-trace'});
    });
    await memory.explain(base.ownerId,randomUUID(),'Synthetic test');expect(requests).toHaveLength(2);
    expect(bindingFor(original,base.ownerId)).toBe(primary);
  });
  it.each([undefined,''])('fails closed with missing demo configuration (%s)',value=>{
    expect(()=>loadDemoBindings(ordinary(),{...env,MAPLE_DEMO_AM_BINDINGS_FILE:value},()=>{throw Error('Must not read ordinary file');})).toThrow('not configured');
  });
  it.each([{context:base.context},{ownerId:'user_other'},{nativePrincipalId:undefined,nativeScope:undefined},{nativeScope:'some/other/scope'}])('rejects reused Context, foreign owner or incomplete principal/scope %#',override=>{
    expect(()=>loadDemoBindings(ordinary(),env,()=>JSON.stringify([{...demo,...override}]))).toThrow();
  });
  it('rejects reusing the ordinary full-access key even under a different Context ID',()=>{
    expect(()=>loadDemoBindings(ordinary(),{...env,AM_DEMO_READ_KEY:'ordinary-key',AM_DEMO_WRITE_KEY:'ordinary-key'},()=>JSON.stringify([demo]))).toThrow('separate Context and key');
  });
  it('does not enable the single-user demo in restricted/production mode',()=>{
    expect(()=>loadDemoBindings({...ordinary(),amAccessMode:'restricted'},env,()=>JSON.stringify([demo]))).toThrow('not configured');
  });
});
