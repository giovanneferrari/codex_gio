(function(root){
 'use strict';
 const filters=[['active','Ativos'],['A fazer','A preparar'],['Em preparo','Em preparo'],['Finalizado','Finalizados']];
 function matches(order,filter){return filter==='active'?['A fazer','Em preparo'].includes(order.status):order.status===filter}
 function visible(rows,filter,query=''){
  const term=query.trim().toLocaleLowerCase('pt-BR');
  return rows.filter(o=>matches(o,filter)&&(!term||[o.number,o.client,...(o.items||[]).map(i=>i.name||'')].join(' ').toLocaleLowerCase('pt-BR').includes(term))).sort((a,b)=>filter==='Finalizado'?new Date(b.createdAt)-new Date(a.createdAt):new Date(a.createdAt)-new Date(b.createdAt));
 }
 const api={filters,matches,visible};if(typeof module!=='undefined')module.exports=api;else root.RitoOrderView=api;
})(typeof window==='undefined'?{}:window);
