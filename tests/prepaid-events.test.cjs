const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
const publicOrder=fs.readFileSync('pedir/order.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20261116233000_prepaid_events.sql','utf8');

test('agenda oferece evento pré-pago somente com valor fechado',()=>{
  assert.match(app,/event-prepaid-option/);
  assert.match(app,/prepaid\.hidden=model!=='fixed'/);
  assert.match(app,/prepaid:data\.get\('prepaid'\)==='on'/);
});

test('pedido interno pré-pago zera valor sem exigir pagamento ou justificativa',()=>{
  assert.match(app,/prepaid\?'0\.00':''/);
  assert.match(app,/readOnly=prepaid/);
  assert.match(app,/confirmedTotal=prepaid\?0:/);
  assert.match(app,/purpose=prepaid\?'sale'/);
  assert.match(app,/p_payment_method_id:prepaid\?null/);
  assert.match(app,/zero&&!prepaid&&!purposeNote/);
});

test('autoatendimento mostra itens inclusos e não exige forma de pagamento',()=>{
  assert.match(publicOrder,/catalog\?\.prepaid\?'Incluso'/);
  assert.match(publicOrder,/fieldset\.hidden=!!catalog\?\.prepaid/);
  assert.match(publicOrder,/!catalog\?\.prepaid&&!payment/);
});

test('banco garante total e preços unitários zerados no QR pré-pago',()=>{
  assert.match(migration,/if selected_event\.prepaid then calculated_total:=0/);
  assert.match(migration,/case when selected_event\.prepaid then 0 else selected_product\.price end/);
  assert.match(migration,/case when selected_event\.prepaid then null else selected_payment\.id end/);
  assert.match(migration,/agenda\.prepaid/);
});
