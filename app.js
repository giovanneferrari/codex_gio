const defaultOrders=[
 {id:'#0486',client:'Camila Nunes',items:'2× Cappuccino · 1× Croissant',value:42.5,time:'10:42',status:'Preparando'},
 {id:'#0485',client:'Rafael Lima',items:'1× Cold brew · 1× Cookie',value:31,time:'10:35',status:'Pronto'},
 {id:'#0484',client:'Bruna Alves',items:'2× Espresso tônica',value:36,time:'10:18',status:'Entregue'},
 {id:'#0483',client:'João Martins',items:'1× Latte · 1× Pão de queijo',value:27.5,time:'09:54',status:'Entregue'},
 {id:'#0482',client:'Larissa Reis',items:'2× Coado V60',value:32,time:'09:40',status:'Entregue'}
];
const defaultStock=[
 {name:'Leite integral',qty:4,unit:'litros',max:20,level:'Crítico'},
 {name:'Café especial · Catuaí',qty:1.8,unit:'kg',max:8,level:'Baixo'},
 {name:'Copo 300 ml',qty:28,unit:'unidades',max:100,level:'Baixo'},
 {name:'Leite vegetal',qty:9,unit:'litros',max:15,level:'Normal'},
 {name:'Chocolate 50%',qty:3.2,unit:'kg',max:5,level:'Normal'},
 {name:'Croissant',qty:18,unit:'unidades',max:30,level:'Normal'}
];
let orders=JSON.parse(localStorage.getItem('rito-orders'))||defaultOrders;
let stock=JSON.parse(localStorage.getItem('rito-stock'))||defaultStock;
const money=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const $=s=>document.querySelector(s);
const toast=message=>{const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};

function renderOrders(){
 $('#recentOrders').innerHTML=orders.slice(0,3).map(o=>`<div class="order-row"><span class="order-icon">♨</span><div><strong>${o.id} · ${o.client}</strong><small>${o.items}</small></div><div class="order-price"><strong>${money(o.value)}</strong><small class="status ${o.status}">${o.status}</small></div></div>`).join('');
 $('#ordersTable').innerHTML=orders.map((o,i)=>`<tr><td><strong>${o.id}</strong></td><td>${o.client}</td><td>${o.items}</td><td><strong>${money(o.value)}</strong></td><td>${o.time}</td><td><select data-order="${i}">${['Preparando','Pronto','Entregue'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('');
 $('#orderBadge').textContent=orders.filter(o=>o.status!=='Entregue').length;
 document.querySelectorAll('[data-order]').forEach(el=>el.onchange=()=>{orders[el.dataset.order].status=el.value;save();renderOrders();toast('Status do pedido atualizado.')});
}
function renderStock(){
 const attention=stock.filter(s=>s.qty/s.max<.4);
 $('#stockAlerts').innerHTML=attention.slice(0,3).map(s=>`<div class="stock-row"><div><strong>${s.name}</strong><div class="stock-bar"><span style="width:${s.qty/s.max*100}%"></span></div><small>${s.qty} ${s.unit} restantes</small></div><b>${s.level}</b></div>`).join('');
 $('#inventoryGrid').innerHTML=stock.map((s,i)=>`<article class="panel inventory-card"><div class="inventory-top"><strong>${s.name}</strong><span>${s.level}</span></div><div class="stock-bar"><span style="width:${s.qty/s.max*100}%;background:${s.qty/s.max<.4?'#b56b51':'#788263'}"></span></div><small>${s.qty} ${s.unit} de ${s.max}</small><br><button data-restock="${i}">＋ Repor estoque</button></article>`).join('');
 document.querySelectorAll('[data-restock]').forEach(btn=>btn.onclick=()=>{const s=stock[btn.dataset.restock];const value=prompt(`Nova quantidade de ${s.name}:`,s.qty);if(value!==null&&!isNaN(value)){s.qty=Number(value);s.level=s.qty/s.max<.2?'Crítico':s.qty/s.max<.4?'Baixo':'Normal';save();renderStock();toast('Estoque atualizado.')}});
}
function save(){localStorage.setItem('rito-orders',JSON.stringify(orders));localStorage.setItem('rito-stock',JSON.stringify(stock))}
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));const names={visao:'Bom dia, Marina.',pedidos:'Pedidos',estoque:'Estoque',financeiro:'Financeiro',custos:'Custos'};$('#pageTitle').textContent=names[id];$('.subtitle').textContent=id==='visao'?'Aqui está o pulso do seu negócio hoje.':'Gestão simples, decisões mais claras.';$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
const dialog=$('#orderDialog');
$('#newOrderBtn').onclick=()=>dialog.showModal();document.querySelectorAll('.open-order').forEach(b=>b.onclick=()=>dialog.showModal());
$('#orderForm').onsubmit=e=>{if(e.submitter.value==='cancel')return;e.preventDefault();const data=new FormData(e.currentTarget);const number=486+orders.length;orders.unshift({id:`#${String(number).padStart(4,'0')}`,client:data.get('client'),items:data.get('items'),value:Number(data.get('value')),time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),status:data.get('status')});save();renderOrders();e.currentTarget.reset();dialog.close();toast('Novo pedido adicionado.');showView('pedidos')};
$('#stockAdd').onclick=()=>toast('Cadastro de insumo disponível na próxima etapa.');$('#costAdd').onclick=()=>toast('Registro de custo disponível na próxima etapa.');
const now=new Date();$('#dateLabel').textContent=now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
renderOrders();renderStock();
