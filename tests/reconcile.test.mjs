import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const input=await readFile(new URL('../app/lib/reconcile.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const factory=new Function('db','squareRequest','settings','squareConfig',outputText.replace(/^import .*;\s*$/gm,'').replace(/export /g,'')+'\nreturn {reconcileCheckout,createLink};');
function fixture(api,patch={}){
 const changes=[];
 const row={id:'local',batch_id:'batch',status:'pending_payment',amount_cents:2500,reservation_expires_at:0,square_order_id:'remote',square_link_id:'link',square_link_url:'https://square.link/test',square_request_json:'{"idempotency_key":"local"}',payment_environment:'sandbox',...patch};
 const db=()=>({prepare:sql=>({bind:(...args)=>({run:async()=>{changes.push({sql,args});}})})});
 return {row,changes,...factory(db,api,()=>({SQUARE_ENVIRONMENT:'sandbox'}),()=>({location:'loc'}))};
}
const unpaid={id:'remote',location_id:'loc',state:'OPEN',tenders:[]};
test('paid checkout is confirmed and never cancelled',async()=>{
 const calls=[];const f=fixture(async(path,method)=>{calls.push([path,method]);return path.startsWith('/orders')?{order:{...unpaid,tenders:[{payment_id:'payment'}]}}:{payment:{id:'payment',order_id:'remote',location_id:'loc',status:'COMPLETED',amount_money:{amount:2500,currency:'USD'}}};});
 await f.reconcileCheckout(f.row,true);
 assert.equal(f.changes.length,1);assert.match(f.changes[0].sql,/status='paid'/);assert.ok(calls.every(x=>x[1]!=='DELETE'));
});
test('expiry cancels in Square before releasing stock; network errors retain stock',async()=>{
 let cancelled=false;const f=fixture(async(path,method)=>{if(method==='DELETE'){cancelled=true;return {};}return {order:{...unpaid,state:cancelled?'CANCELED':'OPEN'}};});
 await f.reconcileCheckout(f.row,true);assert.equal(cancelled,true);assert.match(f.changes[0].sql,/status='expired'/);
 const fail=fixture(async()=>{throw new Error('network timeout');});await assert.rejects(fail.reconcileCheckout(fail.row,true));assert.equal(fail.changes.length,0);
});
test('payment that wins the expiry race keeps the reservation',async()=>{
 let cancelled=false;const f=fixture(async(path,method)=>{if(method==='DELETE'){cancelled=true;return {};}if(path.startsWith('/payments'))return {payment:{id:'payment',order_id:'remote',location_id:'loc',status:'COMPLETED',amount_money:{amount:2500,currency:'USD'}}};return {order:{...unpaid,tenders:cancelled?[{payment_id:'payment'}]:[]}};});
 await f.reconcileCheckout(f.row,true);assert.equal(f.changes.length,1);assert.match(f.changes[0].sql,/status='paid'/);
});
test('pending or partial payment is not released',async()=>{
 for(const payment of [{status:'APPROVED',amount_money:{amount:2500,currency:'USD'}},{status:'COMPLETED',amount_money:{amount:1000,currency:'USD'}}]){
  const f=fixture(async(path,method)=>{assert.notEqual(method,'DELETE');return path.startsWith('/orders')?{order:{...unpaid,tenders:[{payment_id:'payment'}]}}:{payment:{id:'payment',order_id:'remote',location_id:'loc',...payment}};});
  await f.reconcileCheckout(f.row,true);assert.equal(f.changes.length,0);
 }
});
test('crash recovery reuses the stored request and idempotency key',async()=>{
 const f=fixture(async(path,method,body)=>{assert.equal(method,'POST');assert.deepEqual(body,{idempotency_key:'local'});return {payment_link:{id:'link',order_id:'remote',url:'https://square.link/test'},related_resources:{orders:[{...unpaid,total_money:{amount:2500,currency:'USD'}}]}};},{square_link_id:null,square_order_id:null,square_link_url:null,status:'creating_checkout'});
 await f.createLink(f.row);assert.match(f.changes[0].sql,/square_order_id/);
});
test('sandbox and production never reconcile each other’s orders',async()=>{
 const f=fixture(async()=>{throw new Error('must not request');},{payment_environment:'production'});await f.reconcileCheckout(f.row,true);assert.equal(f.changes.length,0);
});
