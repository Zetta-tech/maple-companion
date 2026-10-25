import {readFileSync} from 'node:fs';
import {loadConfig,type Config} from './config.js';
import {AppError} from './errors.js';
import type {Binding} from './am.js';

/** Same authorized Clerk user, separate fictional AM Context. Never falls back. */
export function loadDemoBindings(ordinary:Config,env:NodeJS.ProcessEnv=process.env,
  read:(path:string)=>string=path=>readFileSync(path,'utf8')):Map<string,Binding> {
  if(ordinary.amAccessMode!=='single-user-development'||!env.MAPLE_DEMO_AM_BINDINGS_FILE?.trim()) {
    throw new AppError(503,'DEMO_BINDING_REQUIRED','The isolated demonstration memory connection is not configured.');
  }
  const demo=loadConfig({...env,MAPLE_AM_BINDINGS_FILE:env.MAPLE_DEMO_AM_BINDINGS_FILE},read);
  if(demo.bindings.size!==1)throw new AppError(503,'DEMO_BINDING_INVALID','Use one isolated demonstration Context.');
  for(const binding of demo.bindings.values()) {
    if(!ordinary.bindings.has(binding.ownerId)||!binding.nativePrincipalId||binding.nativeScope!=='maple/conversation'
      ||[...ordinary.bindings.values()].some(primary=>primary.context===binding.context
        ||[primary.readKey,primary.writeKey].includes(binding.readKey)||[primary.readKey,primary.writeKey].includes(binding.writeKey))) {
      throw new AppError(503,'DEMO_BINDING_NOT_ISOLATED','The demo requires the existing authorized account and a separate Context and key. Ordinary memory was not used.');
    }
  }
  return demo.bindings;
}
