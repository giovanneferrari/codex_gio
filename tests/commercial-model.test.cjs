const test=require('node:test'),assert=require('node:assert/strict'),m=require('../commercial-model.js');
const today='2026-11-10',end='2026-11-17',p=(name,action,due)=>({company_name:name,next_action:action,next_action_on:due});
test('prioridades excluem ações concluídas e distinguem hoje de próximos dias',()=>{
 const rows=[p('A','Retornar','2026-11-09'),p('B','Visitar',today),p('C','Ligar',end),p('D','Depois','2026-11-18'),p('E',null,'2026-11-01'),p('F','Sem data',null)];
 const names=key=>rows.filter(p=>m.priority(p,key,today,end)).map(p=>p.company_name);
 assert.deepEqual(names('late'),['A']);assert.deepEqual(names('today'),['B']);assert.deepEqual(names('week'),['C']);assert.deepEqual(names('none'),['E']);
 assert.equal(m.urgency(rows[5],today).text,'Ação sem data');assert.equal(m.urgency(rows[4],today).text,'Sem próxima ação');
});
test('ordenação coloca atrasados primeiro e sem ação ou data ao final sem mutação',()=>{
 const rows=[p('Sem ação',null,'2020-01-01'),p('Hoje','Retornar',today),p('Atrasado','Ligar','2026-11-08'),p('Sem data','Ligar',null)];
 const copy=JSON.stringify(rows);assert.deepEqual(rows.slice().sort(m.compare).map(p=>p.company_name),['Atrasado','Hoje','Sem ação','Sem data']);assert.equal(JSON.stringify(rows),copy);assert.equal(m.urgency(rows[2],today).text,'Atrasado há 2 dias');
});
