'use strict';
const mobileStyle=document.createElement('link');mobileStyle.rel='stylesheet';mobileStyle.href='mobile.css';document.head.append(mobileStyle);
let mobileFilter='active';
const originalRenderProducts=renderProducts;renderProducts=function(){originalRenderProducts();const count=quantities.reduce((a,b)=>a+b,0);$('#quantityLabel').textContent=`${count} ${count===1?'item':'itens'}`};
$('.workspace').insertAdjacentHTML('beforeend','<div class="mobile-orders"><div class="mobile-tabs" role="group" aria-label="Filtrar pedidos por etapa"></div><p id="mobileResult" class="mobile-result" role="status"></p><div id="mobileList"></div></div>');
$('.page-heading').insertAdjacentHTML('afterbegin','<button type="button" id="mobileMenu" class="icon-button" aria-label="Abrir menu" aria-expanded="false">☰</button>');
document.body.insertAdjacentHTML('beforeend','<div class="mobile-create"><button type="button" class="primary" id="mobileNew">＋ Novo pedido</button></div><dialog id="mobileMenuDialog" class="small-dialog"><header class="dialog-heading"><div><p class="eyebrow">RITO · OPERAÇÃO</p><h2>Menu</h2></div><button type="button" class="icon-button" id="closeMobileMenu" aria-label="Fechar menu">×</button></header><div class="dialog-content"><button class="secondary" id="returnOrders">Pedidos</button><p class="help">Agenda e Estoque serão incluídos após a aprovação desta prévia.</p></div></dialog>');
$('#mobileNew').onclick=()=>openOrder();$('#mobileMenu').onclick=()=>{$('#mobileMenuDialog').showModal();$('#mobileMenu').setAttribute('aria-expanded','true')};$('#closeMobileMenu').onclick=$('#returnOrders').onclick=()=>$('#mobileMenuDialog').close();$('#mobileMenuDialog').addEventListener('close',()=>$('#mobileMenu').setAttribute('aria-expanded','false'));
function mobileMatches(o,filter){return filter==='active'?o.status<2:o.status===Number(filter)}
function renderMobile(){
  const filters=[['active','Ativos'],['0','A preparar'],['1','Em preparo'],['2','Finalizados']];
  $('.mobile-tabs').innerHTML=filters.map(([key,label])=>`<button type="button" data-filter="${key}" aria-pressed="${mobileFilter===key}"><span>${label}</span><b>${orders.filter(o=>mobileMatches(o,key)).length}</b></button>`).join('');
  const term=$('#search').value.trim().toLocaleLowerCase('pt-BR');
  const rows=orders.filter(o=>mobileMatches(o,mobileFilter)&&`${o.id} ${o.client} ${o.items.map((q,i)=>q?catalog[i].name:'').join(' ')}`.toLocaleLowerCase('pt-BR').includes(term)).sort((a,b)=>a.id-b.id);
  $('#mobileResult').textContent=`${rows.length} pedido${rows.length===1?'':'s'} · Mais antigos primeiro`;
  $('#mobileList').innerHTML=rows.length?rows.map(o=>`<article class="order-card mobile-card"><div class="card-head"><strong>#${o.id} · ${escape(o.client)}</strong><span class="mobile-status stage-${o.status}">${statuses[o.status]}</span></div><small class="mobile-time">Pedido às ${o.time}</small><div class="items">${o.items.map((q,i)=>q?`<span><b>${q}×</b> ${catalog[i].name}</span>`:'').join('')}</div><div class="payment-row"><span>${orderPaymentLabel(o)}</span><strong>${money(orderAmount(o))}</strong></div><div class="card-actions">${o.status<2?`<button class="secondary" data-edit="${o.id}">Ver pedido</button><button class="primary" data-advance="${o.id}">${o.status===0?'Iniciar preparo':'Finalizar pedido'} →</button>`:'<span class="complete">✓ Pedido finalizado</span>'}</div></article>`).join(''):'<div class="mobile-empty"><h3>Nenhum pedido por aqui</h3><p>Escolha outra etapa ou ajuste a busca.</p></div>';
}
$('.mobile-tabs').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;mobileFilter=b.dataset.filter;renderMobile();document.querySelector(`[data-filter="${mobileFilter}"]`).focus({preventScroll:true})};
$('#mobileList').onclick=e=>$('#board').onclick(e);
const desktopRender=render;render=function(){desktopRender();renderMobile()};$('#search').oninput=render;
$('#changesDialog .dialog-content ul').insertAdjacentHTML('afterbegin','<li><strong>Mobile primeiro:</strong> visão inicial Ativos, filtros com contadores, status dentro do card e pedidos mais antigos primeiro.</li><li>Botão Novo pedido fixo, menu recolhido e formulário em tela cheia no celular.</li>');
// Correções de etapa ficam restritas à simulação, sem alterar pagamentos.
document.body.insertAdjacentHTML('beforeend','<div id="prepUndo" class="prep-undo" hidden><span role="status" id="prepUndoText"></span><button type="button" id="undoPrep">Desfazer</button><button type="button" id="dismissPrepUndo" aria-label="Fechar aviso">×</button></div>');
$('#orderDialog .dialog-content').insertAdjacentHTML('afterbegin','<section id="returnPrepSection" hidden><button type="button" class="secondary" id="returnPrep">← Voltar para A preparar</button><p class="help">Corrige a etapa e salva as alterações deste pedido.</p></section>');
let undoPrepId=null,undoPrepTimer=null,returnPrepRequested=false;
function clearPrepUndo(){clearTimeout(undoPrepTimer);undoPrepId=null;$('#prepUndo').hidden=true}
function returnToQueue(id){const o=orders.find(row=>row.id===id);if(!o||o.status!==1)return false;o.status=0;if(undoPrepId===id)clearPrepUndo();render();return true}
const openBeforePrep=openOrder;openOrder=function(id=null){returnPrepRequested=false;openBeforePrep(id);$('#returnPrepSection').hidden=orders.find(o=>o.id===id)?.status!==1};
$('#returnPrep').onclick=()=>{returnPrepRequested=true;$('#orderForm').requestSubmit()};
const submitBeforePrep=$('#orderForm').onsubmit;
$('#orderForm').onsubmit=e=>{const shouldReturn=returnPrepRequested,id=editing;returnPrepRequested=false;submitBeforePrep(e);if(shouldReturn&&!$('#orderDialog').open&&returnToQueue(id))notify('Pedido voltou para A preparar.')};
$('#undoPrep').onclick=()=>{const id=undoPrepId;clearPrepUndo();if(returnToQueue(id))notify('Preparo desfeito. Pedido em A preparar.');else notify('O pedido mudou de etapa e não pode mais ser desfeito por este aviso.')};
$('#dismissPrepUndo').onclick=clearPrepUndo;
const advanceBeforePrep=$('#board').onclick;
$('#board').onclick=e=>{const id=Number(e.target.closest('[data-advance]')?.dataset.advance),before=orders.find(o=>o.id===id)?.status;advanceBeforePrep(e);const after=orders.find(o=>o.id===id)?.status;if(before===0&&after===1){clearPrepUndo();clearTimeout(toastTimer);$('#toast').hidden=true;undoPrepId=id;$('#prepUndoText').textContent=`Pedido #${id}: preparo iniciado.`;$('#prepUndo').hidden=false;undoPrepTimer=setTimeout(clearPrepUndo,10000)}else if(id===undoPrepId&&after!==1)clearPrepUndo()};
const renderBeforePrep=render;render=function(){renderBeforePrep();document.querySelectorAll('[data-advance]').forEach(button=>{const o=orders.find(row=>row.id===Number(button.dataset.advance));button.closest('.order-card')?.classList.toggle('preparing-card',o?.status===1)});if(undoPrepId&&orders.find(o=>o.id===undoPrepId)?.status!==1)clearPrepUndo()};
$('#search').oninput=render;
const filterBeforePrep=$('.mobile-tabs').onclick;$('.mobile-tabs').onclick=e=>{filterBeforePrep(e);document.querySelectorAll('#mobileList [data-advance]').forEach(button=>button.closest('.order-card')?.classList.toggle('preparing-card',orders.find(o=>o.id===Number(button.dataset.advance))?.status===1))};
$('#changesDialog .dialog-content ul').insertAdjacentHTML('afterbegin','<li>Cards em preparo com fundo creme e faixa âmbar. Correção por “Desfazer” durante 10 segundos ou por “Voltar para A preparar” em Ver pedido.</li>');
render();
