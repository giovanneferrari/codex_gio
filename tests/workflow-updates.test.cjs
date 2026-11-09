const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../workflow-updates.js'),'utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
test('lead status shortcut stays in the detail card without an external board button',()=>{
  assert.ok(!source.includes('card.after(button)'));
  assert.ok(!source.includes('crm-quick-stage'));
  assert.ok(source.includes("button.id='leadDetailStage'"));
  assert.ok(source.includes('button.onclick=()=>openLeadStage(id)'));
});
test('executive multiselection excludes unselected months and years',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(section('function matchesExecutiveSelection(', 'const multiFilteredOrders='),context);
  const selection={years:[2024,2026],months:[0,2]};
  for(const date of ['2024-01-10T12:00:00','2026-03-10T12:00:00'])assert.equal(context.matchesExecutiveSelection({createdAt:date},selection),true);
  for(const date of ['2025-01-10T12:00:00','2026-02-10T12:00:00'])assert.equal(context.matchesExecutiveSelection({createdAt:date},selection),false);
  assert.equal(context.matchesExecutiveSelection({createdAt:'2025-02-10T12:00:00'},null),true);
});
test('deployment includes every root script and stylesheet referenced by the application',()=>{
  const root=require('node:path').join(__dirname,'..');
  const html=fs.readFileSync(require('node:path').join(root,'index.html'),'utf8');
  const workflow=fs.readFileSync(require('node:path').join(root,'.github/workflows/deploy-pages.yml'),'utf8');
  const copied=workflow.match(/cp (.+) _site\//)[1].split(/\s+/);
  for(const match of html.matchAll(/(?:src|href)="([^"/?]+\.(?:js|css))(?:\?[^\"]*)?"/g)){
    if(match[1]==='google-maps-config.js')continue;
    assert.ok(copied.includes(match[1]),`Missing published asset: ${match[1]}`);
  }
});
test('deferred form reset does not overwrite the saved schedule type',()=>{
  const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
  const init=app.split('\n').find(line=>line.startsWith('function initScheduleTypeChoices()'));
  let reset,queued;
  const input={value:'Evento'},controls={dataset:{}};
  const context={$:selector=>selector.includes('[name=')?input:selector.includes('schedule-type')?controls:{addEventListener:(name,fn)=>reset=fn},syncFinanceChoice:()=>{},syncScheduleBilling:()=>{},requestAnimationFrame:fn=>queued=fn,document:{querySelectorAll:()=>[]}};
  vm.createContext(context);vm.runInContext(init,context);context.initScheduleTypeChoices();
  reset();input.value='Outro';queued();assert.equal(input.value,'Outro');
});
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
