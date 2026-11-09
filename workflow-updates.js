document.querySelectorAll('option[value="proposal"]').forEach(option=>option.textContent='Evento pendente');
// Agenda operacional: exibe somente os dados necessários para a equipe.
document.body.insertAdjacentHTML('beforeend', `<dialog id="operationScheduleDialog" class="config-dialog"><form method="dialog"><div class="dialog-head"><div><span>AGENDA DA EQUIPE</span><h2 id="operationScheduleTitle"></h2></div><button aria-label="Fechar">×</button></div><div id="operationScheduleDetails"></div><div class="dialog-actions"><button class="secondary">Fechar</button></div></form></dialog>`);
const workflowOpenSchedule = openSchedule;
openSchedule = function(id=null,date=null) {
  if(currentMode!=='operation') { workflowOpenSchedule(id,date); setupProspectSearch(); return; }
  const item=SCHEDULE.find(event=>event.id===id);
  if(!item)return toast('O cadastro de compromissos fica no administrativo.');
  $('#operationScheduleTitle').textContent=item.title;
  const rows=[['Situação',item.confirmation_status==='confirmed'?'Confirmado':'Previsto'],['Data',new Date(`${item.event_date}T12:00:00`).toLocaleDateString('pt-BR')],['Horário',[item.starts_at?.slice(0,5),item.ends_at?.slice(0,5)].filter(Boolean).join(' às ')||'A definir'],['Local',item.location||'A definir'],['Equipe',scheduleOperators(item).join(', ')||'A definir']];
  $('#operationScheduleDetails').innerHTML=rows.map(([label,value])=>`<p><strong>${label}</strong><br>${esc(value)}</p>`).join('');
  $('#operationScheduleDialog').showModal();
};

function setupProspectSearch() {
  const select=$('#scheduleProspectSelect');
  if(!select)return;
  let container=$('#scheduleClientPicker');
  if(!container){
    const label=select.closest('label');
    container=document.createElement('div');container.id='scheduleClientPicker';
    container.innerHTML='<span>Cliente ou parceiro</span><button type="button" class="secondary client-picker-trigger" aria-expanded="false"></button><div class="client-picker-panel" hidden><input type="search" aria-label="Pesquisar cliente ou parceiro" placeholder="Pesquisar pelo nome…"><div class="client-picker-results"></div></div>';
    label.before(container);label.hidden=true;
    container.querySelector('button').onclick=()=>{const panel=container.querySelector('.client-picker-panel');panel.hidden=!panel.hidden;container.querySelector('button').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){container.querySelector('input').value='';renderProspectResults();container.querySelector('input').focus()}};
    container.querySelector('input').oninput=renderProspectResults;
    container.querySelector('input').onkeydown=event=>{if(event.key==='Enter')event.preventDefault()};
    container.querySelector('.client-picker-results').onclick=event=>{
      const button=event.target.closest('[data-client-id]');if(!button)return;
      const form=$('#scheduleForm'),old=PROSPECTS.find(item=>item.id===select.value),item=PROSPECTS.find(item=>item.id===button.dataset.clientId);
      select.value=button.dataset.clientId;
      const address=p=>[p?.address,p?.city].filter(Boolean).join(' · ');
      if(!form.elements.location.value||form.elements.location.value===address(old))form.elements.location.value=address(item);
      if(!form.elements.title.value||form.elements.title.value===old?.company_name)form.elements.title.value=item?.company_name||'';
      setupProspectSearch();
    };
  }
  container.querySelector('.client-picker-trigger').textContent=PROSPECTS.find(item=>item.id===select.value)?.company_name||'Selecionar cliente ou parceiro';
  container.querySelector('.client-picker-trigger').setAttribute('aria-expanded','false');
  container.querySelector('.client-picker-panel').hidden=true;
}
function renderProspectResults(){
  const container=$('#scheduleClientPicker'),query=container.querySelector('input').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const items=PROSPECTS.filter(item=>item.stage!=='lost'||item.id===$('#scheduleProspectSelect').value).filter(item=>item.company_name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)).sort((a,b)=>a.company_name.localeCompare(b.company_name,'pt-BR'));
  container.querySelector('.client-picker-results').innerHTML='<button type="button" data-client-id="">Sem vínculo comercial</button>'+items.map(item=>`<button type="button" data-client-id="${esc(item.id)}">${esc(item.company_name)}</button>`).join('')+(!items.length?'<p>Nenhum cliente encontrado.</p>':'');
}

// Solicita pagamento antes da transição, salvando pagamento e status juntos.
document.body.insertAdjacentHTML('beforeend', `<dialog id="finishPaymentDialog" class="config-dialog"><form id="finishPaymentForm"><div class="dialog-head"><div><span>ENTREGA DO PEDIDO</span><h2>Como foi o pagamento?</h2><p id="finishPaymentDescription"></p></div><button type="button" data-cancel-payment aria-label="Fechar">×</button></div><div id="finishPaymentOptions" class="order-choice-buttons"></div><p id="finishPaymentError" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-cancel-payment>Cancelar</button><button class="primary" type="submit">Confirmar e finalizar</button></div></form></dialog>`);
let pendingFinishOrder=null, finishPaymentId=null, finishingOrder=false;
const workflowSetOrderStatus=setOrderStatus;
setOrderStatus=async function(id,next){
  const order=orders.find(item=>item.id===id);
  if(next!=='Finalizado'||!order||order.status===next||order.value===0||order.paymentId)return workflowSetOrderStatus(id,next);
  pendingFinishOrder=id;finishPaymentId=null;
  $('#finishPaymentDescription').textContent=`Pedido #${number(order)} · ${money(order.value)}`;
  $('#finishPaymentError').textContent='';
  $('#finishPaymentOptions').innerHTML=PAYMENT_METHODS.map(item=>`<button type="button" data-finish-payment="${esc(item.id)}">${esc(item.name)}</button>`).join('')||'<p>Cadastre uma forma de pagamento nas configurações.</p>';
  $('#finishPaymentDialog').showModal();
};
$('#finishPaymentOptions').onclick=event=>{const button=event.target.closest('[data-finish-payment]');if(!button)return;finishPaymentId=button.dataset.finishPayment;$('#finishPaymentOptions').querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button))};
document.querySelectorAll('[data-cancel-payment]').forEach(button=>button.onclick=()=>{if(!finishingOrder)$('#finishPaymentDialog').close()});
$('#finishPaymentDialog').addEventListener('cancel',event=>{if(finishingOrder)event.preventDefault()});
$('#finishPaymentForm').onsubmit=async event=>{
  event.preventDefault();if(finishingOrder)return;const form=event.currentTarget;
  const payment=PAYMENT_METHODS.find(item=>item.id===finishPaymentId);if(!payment)return $('#finishPaymentError').textContent='Selecione uma forma de pagamento.';
  finishingOrder=true;busy(form,true);
  try{
    const {data,error}=await db.from('orders').update({status:'Finalizado',payment_method_id:payment.id,payment_method_name:payment.name}).eq('id',pendingFinishOrder).neq('status','Finalizado').select('id');
    if(error)throw error;
    $('#finishPaymentDialog').close();expandedOrderCard=null;await loadData();toast(data?.length?'Pedido finalizado e estoque atualizado.':'Este pedido já foi finalizado.');
  }catch(error){$('#finishPaymentError').textContent=message(error,'Não foi possível finalizar o pedido.')}finally{finishingOrder=false;busy(form,false)}
};

// Os totais do executivo continuam apurados por fechamento; a composição
// apresenta as formas efetivamente usadas nos pedidos daquele evento.
const workflowRenderPayments=renderPayments;
renderPayments=function(data){
  const expanded=[];let fixedTotal=0;
  for(const row of data){
    if(!row.isEventSummary){expanded.push(row);continue}
    const event=EVENTS.find(item=>item.id===row.eventId);
    const eventOrders=orders.filter(item=>item.eventId===row.eventId&&item.status==='Finalizado');
    expanded.push(...eventOrders);
    const contract=Math.max(0,row.value-eventOrders.reduce((sum,item)=>sum+item.value,0));
    if(event?.billing_model==='per_person')expanded.push({...row,value:contract});
    else if(contract)fixedTotal+=contract;
  }
  if(fixedTotal)expanded.push({value:fixedTotal,isEventSummary:false});
  workflowRenderPayments(expanded);
  if(fixedTotal){const row=document.createElement('div');row.className='payment-row';row.innerHTML=`<span>Contratos de valor fechado</span><b>${money(fixedTotal)}</b>`;$('#paymentBreakdown').append(row)}
};

// Filtro executivo por ano, mês ou datas, independente do financeiro.
$('#periodTabs [data-period="7d"]')?.remove();
$('#periodTabs [data-period="custom"]').textContent='Ano / mês / data';
document.body.insertAdjacentHTML('beforeend', `<dialog id="executivePeriodDialog" class="config-dialog"><form id="executivePeriodForm"><div class="dialog-head"><div><span>DESEMPENHO</span><h2>Filtrar período</h2></div><button type="button" data-close-executive aria-label="Fechar">×</button></div><div class="form-row"><label>Ano<input name="year" type="number" min="2000" max="2100" required></label><label>Mês<select name="month"><option value="">Todos os meses</option>${Array.from({length:12},(_,index)=>`<option value="${index}">${new Date(2026,index,1).toLocaleDateString('pt-BR',{month:'long'})}</option>`).join('')}</select></label></div><fieldset><legend>Ou selecione datas específicas</legend><div class="form-row"><label>Início<input type="date" name="start"></label><label>Fim<input type="date" name="end"></label></div></fieldset><p id="executivePeriodError" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-close-executive>Cancelar</button><button type="submit" class="primary">Aplicar filtro</button></div></form></dialog>`);
const workflowPeriodClick=$('#periodTabs').onclick;
$('#periodTabs').onclick=event=>{
  if(event.target.dataset.period!=='custom')return workflowPeriodClick(event);
  const form=$('#executivePeriodForm'),base=customStart||new Date();form.reset();form.elements.year.value=base.getFullYear();form.elements.month.value=base.getMonth();$('#executivePeriodError').textContent='';$('#executivePeriodDialog').showModal();
};
document.querySelectorAll('[data-close-executive]').forEach(button=>button.onclick=()=>$('#executivePeriodDialog').close());
$('#executivePeriodForm').onsubmit=event=>{
  event.preventDefault();const data=new FormData(event.currentTarget),year=Number(data.get('year')),month=data.get('month'),start=data.get('start'),end=data.get('end');
  if(end&&!start)return $('#executivePeriodError').textContent='Informe a data inicial.';
  const a=start?new Date(`${start}T00:00:00`):new Date(year,month===''?0:Number(month),1),b=start?new Date(`${end||start}T23:59:59.999`):new Date(year,month===''?12:Number(month)+1,0,23,59,59,999);
  if(b<a)return $('#executivePeriodError').textContent='O fim deve ser igual ou posterior ao início.';
  customStart=a;customEnd=b;activePeriod='custom';chartGranularity=(b-a)>62*86400000?'month':'day';
  document.querySelectorAll('#periodTabs button').forEach(button=>button.classList.toggle('active',button.dataset.period==='custom'));
  document.querySelectorAll('#chartGranularity button').forEach(button=>button.classList.toggle('active',button.dataset.granularity===chartGranularity));
  renderDashboard();$('#executivePeriodDialog').close();
};
