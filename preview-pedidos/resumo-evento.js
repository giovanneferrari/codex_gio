'use strict';
let scenario='sale';
const el=id=>document.getElementById(id),currency=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function renderEvent(){const s=eventSummary(scenario,el('closed').checked);
  el('eventName').textContent=s.partnership?'Café no Jardim · Parceria':'Café no Jardim · Venda por consumo';
  el('eventState').textContent=s.closed?'Fechamento conferido (simulado)':'Fechamento pendente';
  el('notice').textContent=s.closed?'Exemplo conferido: consumo, perdas e gastos adicionais incluídos.':'Resultado parcial: gelo, transporte, equipe adicional e perdas ainda não foram lançados. Não trate os valores pendentes como custo zero.';
  el('notice').classList.toggle('pending',!s.closed);
  for(const [id,value] of Object.entries({revenue:s.revenue,cost:s.totalCost,result:s.result,calcRevenue:s.revenue,calcIngredients:s.ingredients,calcLoss:s.loss,calcExpenses:s.expenseTotal,calcResult:s.result,cycleConsumption:s.ingredients,cycleClosing:s.expenseTotal+s.loss}))el(id).textContent=currency(value);
  if(!s.closed){el('calcLoss').textContent='Pendente';el('calcExpenses').textContent='Pendente';el('cycleClosing').textContent='A conferir';}
  el('costTitle').textContent=s.partnership?'Investimento na parceria':'Custo direto total';
  el('revenueHelp').textContent=s.partnership?'Sem cobrança aos participantes':'Somente bebidas comercializadas';
  el('resultHelp').textContent=s.partnership?'Custo assumido pela empresa':`${(s.margin*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% de margem direta${s.closed?'':' · Parcial'}`;
  el('result').classList.toggle('negative',s.result<0);el('calcResult').classList.toggle('negative',s.result<0);
  el('served').textContent=s.served;el('perDrink').textContent=s.perDrink===null?'—':currency(s.perDrink)+(s.closed?'':' · parcial');
  el('productCosts').innerHTML=s.products.map(p=>`<div class="product-cost"><span>${p.name}<small>${p.quantity} bebidas × ${currency(p.cost)}</small></span><strong>${currency(p.quantity*p.cost)}</strong></div>`).join('');
  el('expenseList').innerHTML=s.closed?s.expenses.map(e=>`<div><span>${e.name}</span><strong>${currency(e.amount)}</strong></div>`).join(''):'<p>Gelo · Transporte · Equipe adicional<br>Aguardando os lançamentos do fechamento.</p>';
  el('destinations').innerHTML=s.destinations.map(([label,n])=>`<div class="destination"><span>${label}</span><strong>${n}</strong><div class="track"><i style="width:${n/s.served*100}%"></i></div></div>`).join('');
  document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario)));
}
document.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=()=>{scenario=b.dataset.scenario;renderEvent()});el('closed').onchange=renderEvent;renderEvent();
