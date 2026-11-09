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

// Filtro executivo: anos e meses selecionados formam as combinações incluídas.
$('#periodTabs [data-period="7d"]')?.remove();
$('#periodTabs [data-period="custom"]').textContent='Personalizado';
let executiveSelection=null, draftYears=new Set(), draftMonths=new Set();
function matchesExecutiveSelection(row,selection) {
  if(!selection)return true;
  const date=new Date(row.createdAt);
  return selection.years.includes(date.getFullYear())&&selection.months.includes(date.getMonth());
}
const multiFilteredOrders=filteredOrders;
filteredOrders=function(){return multiFilteredOrders().filter(row=>activePeriod!=='custom'||matchesExecutiveSelection(row,executiveSelection))};
document.body.insertAdjacentHTML('beforeend', '<dialog id="executivePeriodDialog" class="config-dialog"><form id="executivePeriodForm"><div class="dialog-head"><div><span>PERÍODO PERSONALIZADO</span><h2>Filtrar desempenho</h2><p>Selecione um ou mais anos e meses, ou informe datas específicas.</p></div><button type="button" data-close-executive aria-label="Fechar">×</button></div><fieldset><legend>Anos</legend><div id="executiveYears" class="executive-period-options"></div></fieldset><fieldset><legend>Meses <button type="button" class="period-all-months">Todos os meses</button></legend><div id="executiveMonths" class="executive-period-options months"></div></fieldset><fieldset><legend>Ou use datas específicas</legend><div class="form-row"><label>Início<input type="date" name="start"></label><label>Fim<input type="date" name="end"></label></div></fieldset><p id="executivePeriodError" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-close-executive>Cancelar</button><button type="submit" class="primary">Aplicar filtro</button></div></form></dialog>');
function renderExecutivePeriodOptions(){
  const now=new Date().getFullYear();
  const years=new Set([now-2,now-1,now,now+1,...draftYears,...orders.map(row=>new Date(row.createdAt).getFullYear()),...EVENTS.filter(row=>row.ends_at).map(row=>new Date(row.ends_at).getFullYear())]);
  $('#executiveYears').innerHTML=[...years].filter(Number.isFinite).sort((a,b)=>b-a).map(year=>`<button type="button" data-year="${year}" aria-pressed="${draftYears.has(year)}" class="${draftYears.has(year)?'active':''}">${year}</button>`).join('');
  $('#executiveMonths').innerHTML=Array.from({length:12},(_,month)=>`<button type="button" data-month="${month}" aria-pressed="${draftMonths.has(month)}" class="${draftMonths.has(month)?'active':''}">${new Date(2026,month,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</button>`).join('');
}
function clearExecutiveDates(){const form=$('#executivePeriodForm');form.elements.start.value='';form.elements.end.value=''}
$('#executiveYears').onclick=event=>{const button=event.target.closest('[data-year]');if(!button)return;const value=Number(button.dataset.year);draftYears.has(value)?draftYears.delete(value):draftYears.add(value);clearExecutiveDates();renderExecutivePeriodOptions()};
$('#executiveMonths').onclick=event=>{const button=event.target.closest('[data-month]');if(!button)return;const value=Number(button.dataset.month);draftMonths.has(value)?draftMonths.delete(value):draftMonths.add(value);clearExecutiveDates();renderExecutivePeriodOptions()};
$('.period-all-months').onclick=()=>{draftMonths=new Set(Array.from({length:12},(_,i)=>i));clearExecutiveDates();renderExecutivePeriodOptions()};
const workflowPeriodClick=$('#periodTabs').onclick;
$('#periodTabs').onclick=event=>{
  if(event.target.dataset.period!=='custom')return workflowPeriodClick(event);
  const now=new Date(),form=$('#executivePeriodForm');form.reset();
  draftYears=new Set(executiveSelection?.years||[now.getFullYear()]);draftMonths=new Set(executiveSelection?.months||[now.getMonth()]);
  if(activePeriod==='custom'&&!executiveSelection&&customStart){form.elements.start.value=localDate(customStart);form.elements.end.value=localDate(customEnd)}
  renderExecutivePeriodOptions();$('#executivePeriodError').textContent='';$('#executivePeriodDialog').showModal();
};
document.querySelectorAll('[data-close-executive]').forEach(button=>button.onclick=()=>$('#executivePeriodDialog').close());
$('#executivePeriodForm').onsubmit=event=>{
  event.preventDefault();const data=new FormData(event.currentTarget),start=data.get('start'),end=data.get('end');
  if(end&&!start)return $('#executivePeriodError').textContent='Informe a data inicial.';
  if(!start&&(!draftYears.size||!draftMonths.size))return $('#executivePeriodError').textContent='Selecione pelo menos um ano e um mês.';
  const years=[...draftYears].sort((a,b)=>a-b),months=[...draftMonths].sort((a,b)=>a-b);
  const a=start?new Date(`${start}T00:00:00`):new Date(years[0],months[0],1);
  const b=start?new Date(`${end||start}T23:59:59.999`):new Date(years.at(-1),months.at(-1)+1,0,23,59,59,999);
  if(b<a)return $('#executivePeriodError').textContent='O fim deve ser igual ou posterior ao início.';
  executiveSelection=start?null:{years,months};customStart=a;customEnd=b;activePeriod='custom';
  chartGranularity=(b-a)>62*86400000?'month':'day';
  document.querySelectorAll('#periodTabs button').forEach(button=>button.classList.toggle('active',button.dataset.period==='custom'));
  document.querySelectorAll('#chartGranularity button').forEach(button=>button.classList.toggle('active',button.dataset.granularity===chartGranularity));
  renderDashboard();$('#executivePeriodDialog').close();
};

// Atalho de status no card e na ficha comercial, sem abrir a edição.
document.body.insertAdjacentHTML('beforeend','<dialog id="leadStageDialog" class="config-dialog"><form id="leadStageForm"><div class="dialog-head"><div><span>COMERCIAL</span><h2>Alterar status</h2><p id="leadStageName"></p></div><button type="button" data-close-lead-stage aria-label="Fechar">×</button></div><div id="leadStageOptions" class="executive-period-options"></div><p id="leadStageError" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-close-lead-stage>Cancelar</button><button type="submit" class="primary">Salvar status</button></div></form></dialog>');
let quickLeadId=null,quickLeadStage=null,quickLeadSaving=false;
function openLeadStage(id){
  const item=PROSPECTS.find(row=>row.id===id);if(!item)return;
  quickLeadId=id;quickLeadStage=item.stage;$('#leadStageName').textContent=item.company_name;$('#leadStageError').textContent='';
  $('#leadStageOptions').innerHTML=Object.entries(CRM_STAGES).map(([value,label])=>`<button type="button" data-stage="${value}" aria-pressed="${value===item.stage}" class="${value===item.stage?'active':''}">${esc(label)}</button>`).join('');
  $('#leadStageDialog').showModal();
}
$('#leadStageOptions').onclick=event=>{const button=event.target.closest('[data-stage]');if(!button)return;quickLeadStage=button.dataset.stage;$('#leadStageOptions').querySelectorAll('button').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button))})};
document.querySelectorAll('[data-close-lead-stage]').forEach(button=>button.onclick=()=>{if(!quickLeadSaving)$('#leadStageDialog').close()});
$('#leadStageDialog').addEventListener('cancel',event=>{if(quickLeadSaving)event.preventDefault()});
$('#leadStageForm').onsubmit=async event=>{
  event.preventDefault();if(quickLeadSaving)return;const form=event.currentTarget,item=PROSPECTS.find(row=>row.id===quickLeadId);
  if(!item||!CRM_STAGES[quickLeadStage])return;
  quickLeadSaving=true;busy(form,true);
  try{
    if(!demoMode){const {error}=await db.from('commercial_prospects').update({stage:quickLeadStage}).eq('id',item.id);if(error)throw error}
    item.stage=quickLeadStage;renderCommercial();
    if($('#prospectDetailDialog').open&&selectedProspectDetailId===item.id){$('#prospectDetailDialog').close();openProspectDetail(item.id)}
    $('#leadStageDialog').close();toast('Status atualizado.');
  }catch(error){$('#leadStageError').textContent=message(error,'Não foi possível alterar o status.')}finally{quickLeadSaving=false;busy(form,false)}
};
const quickStageDetail=openProspectDetail;
openProspectDetail=function(id){
  quickStageDetail(id);$('#leadDetailStage')?.remove();
  const item=PROSPECTS.find(row=>row.id===id);if(!item)return;
  const button=document.createElement('button');button.type='button';button.id='leadDetailStage';button.className='secondary';button.textContent=`Status: ${CRM_STAGES[item.stage]} · Alterar`;button.onclick=()=>openLeadStage(id);
  $('#prospectDetailContent').before(button);
};
