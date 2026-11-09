const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../workflow-updates.js'),'utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
test('event sales keep their payment method and only the per-person contract becomes event closing',()=>{
  let result;
  const context={EVENTS:[{id:'e1',billing_model:'consumption'},{id:'e2',billing_model:'per_person'}],orders:[{eventId:'e1',status:'Finalizado',value:80,paymentId:'pix'},{eventId:'e2',status:'Finalizado',value:20,paymentId:'card'}],workflowRenderPayments:rows=>result=rows};
  vm.createContext(context);vm.runInContext(section('renderPayments=function(data){','// Filtro executivo'),context);
  context.renderPayments([{isEventSummary:true,eventId:'e1',value:80},{isEventSummary:true,eventId:'e2',value:220},{value:0,isEventOrderStatistic:true}]);
  assert.equal(result.reduce((sum,row)=>sum+row.value,0),300);
  assert.equal(result.filter(row=>row.isEventSummary).length,1);
  assert.equal(result.find(row=>row.isEventSummary).value,200);
  assert.equal(result.find(row=>row.paymentId==='pix').value,80);
});
test('finish without payment opens the chooser; other transitions and zero-value orders use the normal flow',async()=>{
  let opened=0,normal=0;
  const elements=new Map();
  const context={orders:[{id:'a',status:'Em preparo',value:15},{id:'b',status:'Em preparo',value:0},{id:'c',status:'Em preparo',value:15,paymentId:'pix'}],PAYMENT_METHODS:[{id:'pix',name:'Pix'}],number:()=>1,money:v=>String(v),esc:v=>v,workflowSetOrderStatus:()=>normal++,$:id=>{if(!elements.has(id))elements.set(id,{showModal:()=>opened++});return elements.get(id)}};
  vm.createContext(context);vm.runInContext(section('setOrderStatus=async function(id,next){',"$('#finishPaymentOptions').onclick"),context);
  await context.setOrderStatus('a','Finalizado');assert.equal(opened,1);assert.equal(normal,0);
  await context.setOrderStatus('b','Finalizado');await context.setOrderStatus('c','Finalizado');await context.setOrderStatus('a','A fazer');assert.equal(normal,3);
});
