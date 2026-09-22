import { readFileSync,existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";
import { generateKeyPair,exportPKCS8,exportJWK } from "jose";
const vars=existsSync('.env.local')?parseEnv(readFileSync('.env.local','utf8')):{};
const prod=process.argv.includes('--prod');
const run=(args)=>execFileSync(process.execPath,['node_modules/convex/bin/main.js',...args,...(prod?['--prod']:[])],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
function set(name,value){try{execFileSync(process.execPath,['node_modules/convex/bin/main.js','env','set',...(prod?['--prod']:[]),name,'--',value],{encoding:'utf8',stdio:['ignore','pipe','pipe']});console.log(`${name}: configured`);}catch{throw new Error(`Could not configure ${name}; no credential values logged.`);}}
for(const name of ['OPENAI_API_KEY','FIRECRAWL_API_KEY','AGENTMAIL_API_KEY','AGENTMAIL_WEBHOOK_SECRET','OPENAI_MODEL']){
 let value=vars[name]||process.env[name];
 if(!value&&prod){try{value=execFileSync(process.execPath,['node_modules/convex/bin/main.js','env','get',name],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{}}
 if(value)set(name,value);else console.log(`${name}: absent`);
}
const existing=run(['env','list']);
if(!existing.includes('JWT_PRIVATE_KEY=')){
 const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});const publicJwk=await exportJWK(publicKey);publicJwk.use='sig';
 set('JWT_PRIVATE_KEY',await exportPKCS8(privateKey));set('JWKS',JSON.stringify({keys:[publicJwk]}));
}else console.log('Auth signing keys: already configured');
if(vars.VITE_CONVEX_SITE_URL&&!prod)set('SITE_URL',vars.VITE_CONVEX_SITE_URL);
