/* Camada visual: mantém o cliente, login, RPC save_order e sincronização do app atual. */
(function(){
 'use strict';
 if(!window.RitoOrderView||!document.querySelector('#orderForm'))return;
 document.body.classList.add('rito-v3');
 const section=$('#pedidos');let filter='active',query='',locked=false,undo=null,undoTimer;
 const originalOpen=openOrder,originalShow=showView;
 document.body.insertAdjacentHTML('afterbegin','<div class="v3-live-banner"><strong>V3 · DADOS REAIS</strong><span>Pedidos e estoque compartilhados com a versão atual.</span><a href="./">Voltar à versão atual</a></div>');
 section.insertAdjacentHTML('afterbegin','<div id="v3Event" class="v3-event"></div>');
 $('#kanban').insertAdjacentHTML('beforebegin','<div class="v3-toolbar"><label for="v3Search">Buscar pedido</label><input id="v3Search" type="search" placeholder="Número, cliente ou produto"><div id="v3Filters" class="v3-filters" role="group" aria-label="Etapa dos pedidos"></div><p id="v3Count" aria-live="polite"></p></div>');
 document.body.insertAdjacentHTML('beforeend','<div id="v3Undo" class="v3-undo" hidden><span id="v3UndoText" role="status"></span><button type="button" id="v3UndoAction">Desfazer</button><button type="button" id="v3UndoClose" aria-label="Fechar aviso">×</button></div>');
 $('#orderForm .dialog-head').insertAdjacentHTML('afterend','<div id="v3Return" hidden><button type="button" class="secondary" id="v3ReturnAction">← Voltar para A preparar e salvar</button><p>Salva as alterações do pedido e corrige sua etapa.</p></div>');
 function paymentLabel(o){return o.value===0?'Sem cobrança':o.paymentId?paymentName(o):'Pagamento a informar'}
 function card(o){return `<article class="v3-card ${o.status==='Em preparo'?'preparing':''}"><header><strong>#${esc(number(o))} · ${esc(o.client||'Balcão')}</strong><span class="v3-status">${esc(statusLabel(o.status))}</span></header><small>${esc(new Date(o.createdAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}${o.eventId?` · ${esc(eventName(o))}`:''}</small><div class="v3-items">${(o.items||[]).map(item=>`<p><b>${item.qty}×</b> ${esc(item.name||product(item.id)?.name||'Produto removido')}</p>`).join('')}</div>${o.purposeNote?`<p class="v3-note">${esc(o.purposeNote)}</p>`:''}${o.customerNote?`<p class="v3-note">Obs.: ${esc(o.customerNote)}</p>`:''}<div class="v3-payment"><span>${esc(paymentLabel(o))}</span><strong>${money(o.value)}</strong></div><footer><button type="button" class="secondary" data-v3-edit="${esc(o.id)}">Ver pedido</button>${o.status!=='Finalizado'?`<button type="button" class="primary" data-v3-advance="${esc(o.id)}" data-v3-from="${esc(o.status)}">${o.status==='A fazer'?'Iniciar preparo':'Finalizar pedido'} →</button>`:'<span class="v3-complete">✓ Finalizado</span>'}</footer></article>`}
 function clearUndo(){clearTimeout(undoTimer);undo=null;$('#v3Undo').hidden=true}
 function display(){
  $('.v3-live-banner strong').textContent=demoMode?'V3 · DEMONSTRAÇÃO LOCAL':'V3 · DADOS REAIS';
  const rows=orderFilteredOrders(),list=RitoOrderView.visible(rows,filter,query),active=activeOperationEvent();
  $('#v3Event').textContent=active?`Evento ativo: ${active.name}`:'Atendimento sem evento ativo';
  $('#todoCount').textContent=rows.filter(o=>o.status==='A fazer').length;$('#doingCount').textContent=rows.filter(o=>o.status==='Em preparo').length;
  $('#v3Filters').innerHTML=RitoOrderView.filters.map(([key,label])=>`<button type="button" data-v3-filter="${key}" aria-pressed="${key===filter}">${label}<b>${rows.filter(o=>RitoOrderView.matches(o,key)).length}</b></button>`).join('');
  $('#v3Count').textContent=`${list.length} pedido${list.length===1?'':'s'} no período · ${filter==='Finalizado'?'Mais recentes':'Mais antigos'} primeiro`;
  $('#kanban').className='v3-order-list';$('#kanban').innerHTML=list.length?list.map(card).join(''):'<div class="empty-state"><strong>Nenhum pedido nesta seleção</strong><small>Confira a etapa, a busca e o período.</small></div>';
  if(undo&&orders.find(o=>o.id===undo.id)?.status!=='Em preparo')clearUndo();
 }
 renderKanban=function(){display()};
 $('#v3Search').oninput=e=>{query=e.target.value;display()};
 $('#v3Filters').onclick=e=>{const b=e.target.closest('[data-v3-filter]');if(!b)return;filter=b.dataset.v3Filter;display();$('#v3Filters').querySelector(`[data-v3-filter="${filter}"]`)?.focus({preventScroll:true})};
 async function transition(id,from,to){
  if(demoMode){toast('Use /v3/demo/ para simular pedidos sem acesso ao banco.');return false}
  if(locked)return false;locked=true;section.setAttribute('aria-busy','true');
  try{
   // Atualiza antes de agir para não avançar um card já alterado na outra interface.
   await syncOrders();const current=orders.find(o=>o.id===id);
   if(!current||current.status!==from){toast('Este pedido mudou. Confira a fila atualizada.');display();return false}
   await setOrderStatus(id,to);return orders.find(o=>o.id===id)?.status===to;
  }catch(error){toast(message(error,'Não foi possível atualizar o pedido. Confira a conexão.'));return false}
  finally{locked=false;section.removeAttribute('aria-busy')}
 }
 $('#kanban').onclick=async e=>{
  const edit=e.target.closest('[data-v3-edit]');if(edit){openOrder(edit.dataset.v3Edit);return}
  const b=e.target.closest('[data-v3-advance]');if(!b)return;const id=b.dataset.v3Advance,from=b.dataset.v3From,to=from==='A fazer'?'Em preparo':'Finalizado';
  if(await transition(id,from,to)&&to==='Em preparo'){
   clearUndo();undo={id};$('#v3UndoText').textContent='Preparo iniciado.';$('#v3Undo').hidden=false;undoTimer=setTimeout(clearUndo,10000);
  }
 };
 $('#v3UndoAction').onclick=async()=>{const action=undo;clearUndo();if(action)await transition(action.id,'Em preparo','A fazer')};$('#v3UndoClose').onclick=clearUndo;
 openOrder=function(id=null){originalOpen(id);$('#v3Return').hidden=orders.find(o=>o.id===id)?.status!=='Em preparo'};
 $('#v3ReturnAction').onclick=()=>{const form=$('#orderForm');form.elements.status.value='A fazer';syncOrderChoices();form.requestSubmit()};
 showView=function(id){originalShow(id);document.body.classList.toggle('v3-orders-visible',$('#pedidos').classList.contains('active'))};
 const originalProducts=renderProducts;
 renderProducts=function(){originalProducts();$('#productGrid').querySelectorAll('.product-card').forEach(c=>{const add=c.querySelector('.product-add');if(!add)return;const id=add.dataset.product;const minus=document.createElement('button');minus.type='button';minus.className='v3-product-minus';minus.textContent='− Retirar 1';minus.disabled=!selected[id];minus.setAttribute('aria-label',`Retirar uma unidade de ${product(id)?.name||'produto'}`);minus.onclick=()=>{if(!selected[id])return;selected[id]--;if(!selected[id]){delete selected[id];delete selectedPrices[id]}renderProducts();updateTotal()};c.append(minus)})};
 // O formulário e todas as gravações continuam pertencendo ao app de produção.
 const form=$('#orderForm'),head=form.querySelector('.dialog-head'),actions=form.querySelector('.order-dialog-actions');
 const sharedSubmit=form.onsubmit;let saving=false;
 form.onsubmit=async function(event){
  if(demoMode){event.preventDefault();toast('Use /v3/demo/ para simular pedidos.');return}
  if(saving){event.preventDefault();return}
  saving=true;try{await sharedSubmit.call(this,event)}finally{saving=false}
 };
 const body=document.createElement('div');body.className='v3-order-form-body';
 [...form.children].filter(n=>n!==head&&n!==actions).forEach(n=>body.append(n));head.after(body);
 $('#mobileOrderFab').innerHTML='<span aria-hidden="true">＋</span> Novo pedido';
 $('.sidebar').classList.add('v3-sidebar');
 display();document.body.classList.toggle('v3-orders-visible',section.classList.contains('active'));
})();
