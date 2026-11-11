(function(root){
 const scopeStages=scope=>scope==='partners'?['confirmed','client']:scope==='standby'?['paused','lost']:['mapped','contacted','replied','visit','proposal'];
 const hasAction=p=>Boolean(String(p.next_action||'').trim());
 function priority(p,key,today,end){const due=p.next_action_on;return key==='all'||key==='none'&&!hasAction(p)||key==='late'&&hasAction(p)&&Boolean(due)&&due<today||key==='today'&&hasAction(p)&&due===today||key==='week'&&hasAction(p)&&Boolean(due)&&due>today&&due<=end}
 function compare(a,b){const due=p=>hasAction(p)?p.next_action_on||'9999':'9999';return due(a).localeCompare(due(b))||a.company_name.localeCompare(b.company_name,'pt-BR')}
 function urgency(p,today){if(!hasAction(p))return {type:'none',text:'Sem próxima ação'};if(!p.next_action_on)return {type:'none',text:'Ação sem data'};if(p.next_action_on<today){const days=Math.round((Date.parse(today+'T12:00Z')-Date.parse(p.next_action_on+'T12:00Z'))/86400000);return{type:'late',text:`Atrasado há ${days} dia${days===1?'':'s'}`}}return {type:p.next_action_on===today?'today':'future',text:p.next_action_on===today?'Retorno hoje':'Retorno em '+new Date(p.next_action_on+'T12:00').toLocaleDateString('pt-BR')}}
 const api={scopeStages,hasAction,priority,compare,urgency};if(typeof module==='object'&&module.exports)module.exports=api;else root.RitoCommercial=api;
})(typeof window==='undefined'?globalThis:window);
