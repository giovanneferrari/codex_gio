(function(){
 'use strict';
 const pricing={minimumPeople:10,maximumPeople:100,baseAtTen:40,baseAtTwenty:35,baseAtForty:30,discountPerDrinkRemoved:5,cookieStandard:15,cookieVolume:12};
 const round=n=>Math.round(n*100)/100;
 function calculate(people,drinks,cookies){
  people=Math.round(Math.max(10,Math.min(100,Number(people)||10)));
  drinks=Math.round(Math.max(1,Math.min(3,Number(drinks)||3)));
  const base=people<20?40-(people-10)*.5:people<40?35-(people-20)*.25:30;
  const beverages=base-(3-drinks)*5,cookieUnit=people>=20?12:15;
  const beverageTotal=round(beverages*people),cookieQuantity=cookies?people:0,cookieTotal=cookieQuantity*cookieUnit;
  return {people,drinks,cookies:!!cookies,beverages,cookieUnit,cookieQuantity,beverageTotal,cookieTotal,perPerson:round(beverages+(cookies?cookieUnit:0)),total:round(beverageTotal+cookieTotal),totalDrinks:people*drinks,tier:people>=40?2:people>=20?1:0};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={calculate,pricing};return;}
 const range=document.getElementById('people-range'),number=document.getElementById('people-number'),cookies=document.getElementById('include-cookies');if(!range)return;
 const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),unit=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
 const card=document.querySelector('.experience-card'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let previousTier=null,previousCookies=false,glowTimer;
 const text=(id,value)=>{document.getElementById(id).textContent=value;};
 function render(source){
  const selected=document.querySelector('input[name="drinks"]:checked'),r=calculate(source==='number'?number.value:range.value,selected.value,cookies.checked);
  range.value=r.people;if(source!=='number')number.value=r.people;range.setAttribute('aria-valuetext',r.people+' pessoas');range.style.setProperty('--range-fill',(r.people-10)/90*100+'%');
  text('people-display',r.people+' pessoas');text('price-person',unit.format(r.perPerson));text('price-total',money.format(r.total));
  text('summary-people',r.people);text('summary-drinks',r.totalDrinks);text('summary-cookies',r.cookieQuantity);
  text('beverage-label',r.totalDrinks+' bebidas incluídas');text('beverage-detail',r.people+' pessoas × '+r.drinks+' bebida'+(r.drinks>1?'s':'')+' · '+money.format(r.beverages)+' por pessoa');text('beverage-subtotal',money.format(r.beverageTotal));
  text('cookie-label',r.cookies?r.cookieQuantity+' cookies incluídos':'Sem cookies');text('cookie-detail',r.cookies?r.cookieQuantity+' unidades × '+money.format(r.cookieUnit):'Adicione 1 cookie por pessoa');text('cookie-subtotal',money.format(r.cookieTotal));
  card.dataset.tier=r.tier;card.dataset.cookies=String(r.cookies);text('card-name',['Seu primeiro rito.','Um bom encontro.','Um grande rito.'][r.tier]);text('card-level','NÍVEL 0'+(r.tier+1));text('card-edition',['01 / ESSENCIAL','02 / ENCONTRO','03 / EXPERIÊNCIA'][r.tier]);text('card-bonus',r.cookies?'COMBO COMPLETO / CAFÉ + COOKIES':'CAFÉ ESPECIAL + PREPARO NA HORA');
  const progress=Math.min(100,Math.round((r.people-10)/30*100)),bar=document.querySelector('.card-progress');bar.setAttribute('aria-valuenow',progress);bar.style.setProperty('--progress',progress+'%');text('card-progress-value',progress+'%');text('card-progress-copy',r.people>=40?'Melhor tarifa desbloqueada.':r.people>=20?'Próxima tarifa: 40 convidados.':'Próxima tarifa: 20 convidados.');
  if(previousTier!==null&&(r.tier>previousTier||r.cookies&&!previousCookies)&&!reduced.matches){card.classList.remove('is-upgrading');requestAnimationFrame(()=>card.classList.add('is-upgrading'));clearTimeout(glowTimer);glowTimer=setTimeout(()=>card.classList.remove('is-upgrading'),850)}previousTier=r.tier;previousCookies=r.cookies;
  const message='Olá, Rito! Quero uma proposta para '+r.people+' pessoas, '+r.drinks+' bebida(s) por pessoa ('+r.totalDrinks+' bebidas no total), '+r.cookieQuantity+' cookies e 2 horas de serviço. Bebidas: '+money.format(r.beverageTotal)+'. Cookies: '+money.format(r.cookieTotal)+'. Total estimado: '+money.format(r.total)+' ('+money.format(r.perPerson)+' por pessoa). Podemos confirmar local, data e condições?';document.getElementById('quote-link').href='https://wa.me/5511939231018?text='+encodeURIComponent(message);
 }
 range.addEventListener('input',()=>render('range'));number.addEventListener('input',()=>{if(number.validity.valid&&number.value)render('number')});number.addEventListener('change',()=>{number.value=calculate(number.value,3,false).people;render('number')});document.querySelectorAll('input[name="drinks"]').forEach(input=>input.addEventListener('change',()=>render('range')));cookies.addEventListener('change',()=>render('range'));render('range');
})();
