const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('obrigado/conversion.js', 'utf8');
const id = '4d452bf0-95c2-47af-8223-89c807a77b14';
const valid = () => ({id, at:Date.now(), source:'/eventos/'});
function browser(marker, options = {}) {
  const items = new Map(marker === undefined ? [] : [['rito-lead-success', JSON.stringify(marker)]]);
  const calls = [], nodes = {};
  const context = {
    sessionStorage: {
      getItem:key => { if (options.readFails) throw Error('blocked'); return items.get(key) ?? null; },
      setItem:(key,value) => { if (options.writeFails) throw Error('blocked'); items.set(key,value); },
      removeItem:key => items.delete(key)
    },
    document:{querySelector:selector => nodes[selector] ||= {}},
    window:{gtag:options.noTag ? undefined : (...args) => calls.push(args)}
  };
  return {items,calls,nodes,context,run:()=>vm.runInNewContext(code,context)};
}
test('confirmed lead queues the specified conversion with unique ID and no personal data',()=>{
  const b=browser(valid());b.run();assert.equal(b.calls.length,1);
  const [type,name,params]=b.calls[0];assert.equal(type,'event');assert.equal(name,'conversion');
  assert.equal(params.send_to,'AW-18586754751/LkwMCKCCq7wdEL-97Z5F');assert.equal(params.transaction_id,id);
  assert.deepEqual(Object.keys(params).sort(),['send_to','transaction_id']);
  assert.equal(b.nodes['#return-link'].href,'/eventos/');
});
test('reload/reexecution does not queue again; acknowledgement stays visible',()=>{
  const b=browser(valid());b.run();b.run();assert.equal(b.calls.length,1);assert.equal(b.nodes['#success-label'].textContent,'PEDIDO ENVIADO');
});
test('a different confirmed submission can convert',()=>{
  const b=browser(valid());b.run();b.items.set('rito-lead-success',JSON.stringify({...valid(),id:'5d452bf0-95c2-47af-8223-89c807a77b14'}));b.run();assert.equal(b.calls.length,2);
});
test('direct access and invalid, expired, future or wrong-origin markers never convert',()=>{
  for(const marker of [undefined,null,{}, {...valid(),id:'email@example.com'},{...valid(),at:Date.now()-1800001},{...valid(),at:Date.now()+60000},{...valid(),at:String(Date.now())},{...valid(),source:'/other/'}]) {
    const b=browser(marker);b.run();assert.equal(b.calls.length,0);
  }
  const b=browser();b.items.set('rito-lead-success','invalid json');b.run();assert.equal(b.calls.length,0);
});
test('unavailable storage fails closed without crashing',()=>{
  for(const option of [{readFails:true},{writeFails:true}]) {const b=browser(valid(),option);b.run();assert.equal(b.calls.length,0);}
});
test('missing tag does not consume conversion; a later execution can queue',()=>{
  const b=browser(valid(),{noTag:true});b.run();assert.equal(b.calls.length,0);
  b.context.window.gtag=(...args)=>b.calls.push(args);b.run();assert.equal(b.calls.length,1);
});
test('synchronous tag failure releases reservation for retry',()=>{
  const b=browser(valid());b.context.window.gtag=()=>{throw Error('tag failure')};b.run();
  assert.equal(b.items.has('rito-ads-conversion:'+id),false);
  b.context.window.gtag=(...args)=>b.calls.push(args);b.run();assert.equal(b.calls.length,1);
});
test('proposal source shares the same guarded conversion',()=>{
  const b=browser({...valid(),source:'/eventos-proposta/'});b.run();assert.equal(b.calls.length,1);assert.equal(b.nodes['#return-link'].href,'/eventos-proposta/');
});
