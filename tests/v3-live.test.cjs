const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {liveHtml}=require('../v3/build.cjs'),view=require('../v3/order-view.js');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('v3 mantém exatamente os scripts de produção e acrescenta só a camada visual',()=>{
 const source=read('index.html'),html=liveHtml(source);
 const scripts=s=>[...s.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(scripts(html).slice(0,-2),scripts(source));
 assert.deepEqual(scripts(html).slice(-2),['v3/order-view.js?v=1','v3/live.js?v=1']);
 assert.ok(html.includes('<base href="../">'));
 assert.ok(html.includes('id="orderForm"'));assert.ok(!html.includes('preview.js'));
 assert.ok(!source.includes('v3/live.js'));
});
test('camada visual não cria cliente, tabela, RPC ou movimentação de estoque paralela',()=>{
 const source=read('v3/live.js');
 assert.doesNotMatch(source,/createClient|db\.(from|rpc)|fetch\s*\(|localStorage|sessionStorage|inventory_movements/);
 assert.ok(source.includes('await setOrderStatus(id,to)'));
 assert.ok(source.includes('form.requestSubmit()'));
 assert.ok(source.includes('await syncOrders()'));
});
test('ativos reúne só as duas etapas abertas e ordena pela data real',()=>{
 const rows=[{id:'b',status:'Em preparo',createdAt:'2026-11-10T12:00:00Z'},{id:'a',status:'A fazer',createdAt:'2026-11-10T11:00:00Z'},{id:'c',status:'Finalizado',createdAt:'2026-11-10T10:00:00Z'}];
 assert.deepEqual(view.visible(rows,'active').map(o=>o.id),['a','b']);
 assert.deepEqual(view.visible(rows,'Finalizado').map(o=>o.id),['c']);
 assert.equal(view.visible(rows,'Em preparo').length,1);
});
test('busca usa os dados reais e não modifica pedidos',()=>{
 const rows=[{id:'a',number:42,client:'Ana',items:[{name:'Latte'}],status:'A fazer',createdAt:'2026-11-10T11:00:00Z'}],snapshot=JSON.stringify(rows);
 for(const q of ['42','ana','LATTE'])assert.equal(view.visible(rows,'active',q).length,1);
 assert.equal(view.visible(rows,'active','inexistente').length,0);assert.equal(JSON.stringify(rows),snapshot);
});
test('builder rejeita um HTML sem o formulário real',()=>{assert.throws(()=>liveHtml('<html></html>'))});
