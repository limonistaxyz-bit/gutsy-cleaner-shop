import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../app/lib/security.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const {verifyHmac,verifyOwner}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
const enc=new TextEncoder();
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
const config={team:'example.cloudflareaccess.com',audience:'owner-app',email:'owner@example.com'};
const claims={iss:'https://example.cloudflareaccess.com',aud:['owner-app'],exp:Math.floor(Date.now()/1000)+60,email:config.email};
async function jwt(payload=claims,header={alg:'RS256',kid:jwk.kid}){
 const value=[header,payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
 return value+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,enc.encode(value))).toString('base64url');
}
test('accepts valid owner JWT; rejects wrong owner, audience, issuer, expiration and signature',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{assert.equal(url,'https://example.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 try{
  assert.equal(await verifyOwner(await jwt(),config),true);
  for(const patch of [{email:'someone@example.com'},{aud:['different']},{iss:'https://evil.example'},{exp:0},{exp:'99999999999'},{nbf:Date.now()/1000+1000}])assert.equal(await verifyOwner(await jwt({...claims,...patch}),config),false);
  assert.equal(await verifyOwner(await jwt(claims,{alg:'none',kid:jwk.kid}),config),false);
  const token=await jwt();assert.equal(await verifyOwner(token.slice(0,token.lastIndexOf('.')+1)+'AAAA',config),false);
  assert.equal(await verifyOwner(null,config),false);
  assert.equal(await verifyOwner(await jwt(),{...config,audience:''}),false);
 }finally{globalThis.fetch=original;}
});
test('Square webhook signature covers exact configured URL and raw body',async()=>{
 const secret='test-only-key';const msg='https://shop.example/api/square/webhook'+JSON.stringify({type:'payment.updated'});
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(msg))).toString('base64');
 assert.equal(await verifyHmac(secret,msg,signature),true);
 assert.equal(await verifyHmac(secret,msg+' ',signature),false);
 assert.equal(await verifyHmac('wrong',msg,signature),false);
 assert.equal(await verifyHmac(secret,msg,'invalid!'),false);
});
