const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('supabase/functions/event-lead/index.ts','utf8');
function setup(providerOK = true) {
  let handler, email;
  vm.runInNewContext(source, {Deno:{serve:fn=>handler=fn,env:{get:key=>({RESEND_API_KEY:'test',LEAD_FROM_EMAIL:'test@example.com'})[key]}}, Request,Response,Intl,AbortSignal,fetch:async(_url,opts)=>{email=JSON.parse(opts.body);return Response.json(providerOK?{id:'accepted-test-id'}:{error:'failed'},{status:providerOK?200:500})}});
  const send = data => handler(new Request('https://example.com', {method:'POST',headers:{origin:'https://ritocafe.shop'},body:JSON.stringify(data)}));
  return {send,email:()=>email,handler};
}
function lead(people=40,drinks=3,cookies=true) {return {name:'Teste',email:'test@example.com',phone:'11999999999',city:'Campinas',eventType:'Evento corporativo',people,source:'/eventos-proposta/',quote:{people,drinks,cookies},requestId:'4d452bf0-95c2-47af-8223-89c807a77b14',startedAt:Date.now()-5000};}
test('recalculates quote, ignoring forged client totals, at all pricing boundaries',async()=>{
 const {calculate} = require('../eventos-proposta/pricing.js');
 for(const people of [10,19,20,39,40,100]) for(const drinks of [1,2,3]) for(const cookies of [false,true]) {
  const api=setup(),data=lead(people,drinks,cookies);data.quote.total=1;
  assert.equal((await api.send(data)).status,200);
  const total=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(calculate(people,drinks,cookies).total);
  assert.ok(api.email().text.includes('Total estimado: '+total));
  assert.deepEqual(api.email().to,['giovanne@ritocafe.shop']);assert.equal(api.email().reply_to,'test@example.com');
 }
});
test('failed provider does not confirm success',async()=>{const res=await setup(false).send(lead());assert.equal(res.status,502);assert.equal((await res.json()).ok,false)});
test('rejects spam, invalid contacts and inconsistent quote',async()=>{
 for(const changes of [{website:'spam'},{email:'bad'},{people:500},{quote:{people:40,drinks:7,cookies:true}},{source:'/other/'}]) assert.equal((await setup().send({...lead(),...changes})).status,400);
});
test('open quote works without simulator',async()=>{const data={...lead(150),source:'/eventos/',quote:null};assert.equal((await setup().send(data)).status,200)});
test('disallows foreign origins',async()=>{assert.equal((await setup().handler(new Request('https://example.com',{method:'OPTIONS',headers:{origin:'https://other.example'}}))).status,403)});
