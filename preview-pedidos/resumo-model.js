'use strict';
// Valores em centavos. Fichas de custo fictícias e congeladas para este evento.
const eventProducts=[
  {name:'Espresso',price:800,cost:200,sold:40,team:2,gift:2},
  {name:'Cappuccino',price:1400,cost:400,sold:30,team:2,gift:2},
  {name:'Latte',price:1500,cost:450,sold:20,team:0,gift:0},
  {name:'Chocolate quente',price:1400,cost:400,sold:10,team:0,gift:2}
];
function eventSummary(scenario,closed){
  const partnership=scenario==='partnership';
  const products=eventProducts.map(p=>({...p,quantity:p.sold+p.team+p.gift}));
  const served=products.reduce((n,p)=>n+p.quantity,0);
  const ingredients=products.reduce((n,p)=>n+p.quantity*p.cost,0);
  const revenue=partnership?0:products.reduce((n,p)=>n+p.sold*p.price,0);
  const expenses=[{name:'Gelo',amount:3500},{name:'Transporte',amount:6000},{name:'Equipe adicional',amount:12000}];
  const recordedExpenses=closed?expenses:[];
  const loss=closed?1800:0;
  const expenseTotal=recordedExpenses.reduce((n,e)=>n+e.amount,0);
  const totalCost=ingredients+loss+expenseTotal;
  return {partnership,closed,products,served,ingredients,revenue,expenses:recordedExpenses,expenseTotal,loss,totalCost,result:revenue-totalCost,perDrink:served?Math.round(totalCost/served):null,margin:revenue?(revenue-totalCost)/revenue:null,destinations:partnership?[['Vendidas',0],['Consumo da equipe',4],['Parceria / cortesia',served-4]]:[['Vendidas',100],['Consumo da equipe',4],['Parceria / cortesia',6]]};
}
if(typeof module!=='undefined')module.exports={eventSummary};
