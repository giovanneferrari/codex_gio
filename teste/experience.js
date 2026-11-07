(function(){
function initRito(){
 if(document.documentElement.dataset.ritoInitialized)return;
 document.documentElement.dataset.ritoInitialized='true';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');

 const nativeRail=window.matchMedia('(max-width: 700px)');
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const drinks=document.querySelector('.drink-story'),track=document.querySelector('.drink-track'),products=[...document.querySelectorAll('.render-product')],drinkButtons=[...document.querySelectorAll('[data-drink-to]')];
 const names=['Espresso','Coado','Orange Coffee','Cappuccino','Latte gelado'];
 const occasions=document.querySelector('.occasion-story'),occasionPin=document.querySelector('.occasion-pin'),book=document.querySelector('.popup-book'),panels=[...document.querySelectorAll('.popup-scene')],occasionButtons=[...document.querySelectorAll('[data-occasion-to]')];
 const titles=['Celebre <em>um novo ciclo.</em>','O sim merece <em>um bom café.</em>','A sua marca. <em>Um novo encontro.</em>','Depois do treino, <em>um novo rito.</em>','Qual é o seu <em>próximo encontro?</em>'];
 const descriptions=['Aniversários, festas e encontros que viram boas lembranças.','Casamentos e celebrações, com o café fazendo parte desse dia.','Lançamentos, ativações e encontros corporativos com personalidade.','No box, no estúdio ou no pós-aula: café para conectar quem se movimenta.','Escolha uma ocasião. A Rito vai com você.'];
 let scheduled=false,drinkIndex=-1,sceneIndex=-1;
 const sceneLayers=panels.map(panel=>[...panel.querySelectorAll('[data-fold]')]);
 const sceneDetails=panels.map(panel=>[...panel.querySelectorAll('[data-detail]')]);
 sceneDetails.forEach(details=>details.forEach((detail,i)=>{detail.style.left=(i%2===0?5+(i*13%26):70+(i*11%26))+'%';detail.style.top=(18+i*17%46)+'%';}));
 const contexts=[...document.querySelectorAll('[data-context]')];
 const summary=document.querySelector('.occasion-summary');
 function progress(section){const range=section.offsetHeight-innerHeight;return range>0?clamp(-section.getBoundingClientRect().top/range):0;}
 function setDrink(index){if(index===drinkIndex)return;drinkIndex=index;drinkButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));document.querySelector('.drink-count').textContent=String(index+1).padStart(2,'0')+' / 05 — '+names[index];document.querySelector('.drink-prev').disabled=index===0;document.querySelector('.drink-next').disabled=index===4;}
 function setScene(index){if(index===sceneIndex)return;sceneIndex=index;summary.hidden=index!==4;occasionPin.dataset.summary=String(index===4);document.querySelector('.occasion-title').innerHTML=titles[index];document.querySelector('.occasion-description').textContent=descriptions[index];occasionButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));panels.forEach((p,i)=>p.dataset.current=String(i===index));contexts.forEach((context,i)=>{context.dataset.current=String(i===index);context.style.opacity=i===index?'1':'0';});}
 function resize(){if(nativeRail.matches)setScene(4);else sceneIndex=-1;document.querySelector('.drink-scroll-hint').textContent=nativeRail.matches?'DESLIZE PARA EXPLORAR AS BEBIDAS →':'ROLE PARA DESLIZAR PELA MESA ↓';queue();}
 function render(){scheduled=false;
  if(reduced.matches){track.style.transform='none';products.forEach(p=>p.style.transform='none');document.querySelector('.intro-cart').style.transform='none';panels.forEach((panel,i)=>panel.style.opacity=i===sceneIndex?'1':'0');return;}
  if(!nativeRail.matches){
   const d=progress(drinks),position=d*4;track.style.transform='translate3d('+(-d*80)+'%,0,0)';setDrink(Math.round(position));
   products.forEach((product,index)=>{const offset=clamp(position-index,-1,1);product.style.transform='translate3d(0,'+(-Math.sin(Math.abs(offset)*Math.PI)*9)+'px,0) rotate('+(-offset*9)+'deg)';});
  }else{track.style.transform='none';products.forEach(product=>product.style.transform='none');}
  const s=progress(occasions),sceneSpan=1/panels.length;if(!nativeRail.matches)setScene(clamp(Math.floor((s+sceneSpan*.05)/sceneSpan),0,panels.length-1));
  if(!nativeRail.matches)contexts.forEach((context,i)=>{const drift=(s-i*sceneSpan)*10;context.style.transform='translate3d('+drift+'px,0,0) scale(1.04)';});
  if(!nativeRail.matches)panels.forEach((panel,index)=>{
   const reveal=clamp((s-index*sceneSpan)/(sceneSpan*.48)),close=index<panels.length-1?clamp((s-(index*sceneSpan+sceneSpan*.76))/(sceneSpan*.3)):0;
   const presence=reveal*(1-close);panel.style.opacity=String(clamp(presence*4));
   sceneDetails[index].forEach((detail,i)=>{const amount=clamp(reveal*2.5)*(1-close),drift=Math.sin(reveal*5+i)*10,fall=reveal*(index===0?90:45)-20;detail.style.opacity=String(amount*(index===2?.35:.65));detail.style.transform='translate3d('+drift+'px,'+fall+'px,0) rotate('+(i*23+reveal*(index===2?0:95))+'deg)';});
   sceneLayers[index].forEach((layer,j)=>{const delay=Number(layer.dataset.delay)||0;const amount=clamp((reveal-delay)/(1-delay))*(1-close),ease=1-Math.pow(1-amount,3);let transform;
    if(layer.dataset.fold==='left')transform='rotateY('+(-83*(1-ease))+'deg)';
    else if(layer.dataset.fold==='right')transform='rotateY('+(83*(1-ease))+'deg)';
    else if(layer.dataset.fold==='side')transform='rotateZ('+(-19*(1-ease))+'deg) rotateX('+(-54*(1-ease))+'deg) translateY('+(32*(1-ease))+'px)';
    else transform='rotateX('+(-88*(1-ease))+'deg) translateY('+(40*(1-ease))+'px)';
    if(index===0&&j===0)transform+=' translate3d('+Math.sin(s*25)*6*ease+'px,'+Math.sin(s*32)*9*ease+'px,0)';
    layer.style.transform=transform;layer.style.opacity=String(clamp(amount*5));
   });
  });
  const finale=document.querySelector('.brand-finale');
  if(finale){const f=clamp((innerHeight-finale.getBoundingClientRect().top)/(innerHeight+finale.offsetHeight));document.querySelector('.finale-photo').style.transform='translateY('+(f*10-5)+'%)';document.querySelector('.finale-word').style.transform='translateY('+((1-f)*35)+'px)';}
  const p=progress(document.querySelector('.intro-scroll'));
  document.querySelector('.intro-cart').style.transform='translate3d(0,'+(-p*22)+'px,0) rotate('+(-1+p*2)+'deg) scale('+(1+p*.04)+')';
  document.querySelector('.brand-word').style.transform='translate3d('+(p*12)+'%,0,0) scale('+(1+p*.06)+')';
  document.querySelector('.cart-platform').style.transform='rotate('+(-8+p*9)+'deg) scale('+(1-p*.07)+')';
 }
 const finaleObserver=new IntersectionObserver(entries=>{document.querySelector('.back-to-top').hidden=!entries[0].isIntersecting},{threshold:.12});finaleObserver.observe(document.querySelector('.brand-finale'));
 function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(render)}}
 function goTo(section,index,count){if(reduced.matches)return;const top=window.scrollY+section.getBoundingClientRect().top;window.scrollTo({top:top+index/(count-1)*Math.max(0,section.offsetHeight-innerHeight),behavior:'smooth'});}
 function chooseDrink(index){index=clamp(index,0,4);if(nativeRail.matches){track.scrollTo({left:track.clientWidth*index,behavior:reduced.matches?'auto':'smooth'});setDrink(index);return;}if(reduced.matches){document.querySelector('[data-drink="'+index+'"]').scrollIntoView({block:'center',behavior:'auto'});setDrink(index);}else goTo(drinks,index,5);}
 drinkButtons.forEach(button=>button.addEventListener('click',()=>chooseDrink(Number(button.dataset.drinkTo))));
 document.querySelector('.drink-prev').addEventListener('click',()=>chooseDrink(drinkIndex-1));document.querySelector('.drink-next').addEventListener('click',()=>chooseDrink(drinkIndex+1));
 document.querySelector('.drink-options').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const index=clamp(drinkIndex+(event.key==='ArrowRight'?1:-1),0,4);chooseDrink(index);drinkButtons[index].focus();}});
 occasionButtons.forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.occasionTo);if(nativeRail.matches||reduced.matches)setScene(index);else {const top=window.scrollY+occasions.getBoundingClientRect().top;window.scrollTo({top:top+((index+.7)/panels.length)*Math.max(0,occasions.offsetHeight-innerHeight),behavior:'smooth'});}}));
 if('IntersectionObserver'in window&&!reduced.matches){document.documentElement.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));}
 // Real event photography: editorial captions open a navigable lightbox.
 const dialog=document.querySelector('.photo-dialog'),photoButtons=[...document.querySelectorAll('.event-open')],photoImages=[...document.querySelectorAll('.event-mosaic figure>img')];
 const photoTitles=[...document.querySelectorAll('.event-mosaic figure')].map(figure=>figure.dataset.location);let currentPhoto=0,photoTrigger=null;
 function showPhoto(index){currentPhoto=(index+photoImages.length)%photoImages.length;const source=photoImages[currentPhoto],full=document.querySelector('.photo-full');full.src=source.src;full.alt=source.alt;document.querySelector('.photo-caption').textContent=String(currentPhoto+1).padStart(2,'0')+' / '+String(photoImages.length).padStart(2,'0')+' — '+photoTitles[currentPhoto];}
 photoButtons.forEach((button,index)=>button.addEventListener('click',()=>{photoTrigger=button;showPhoto(index);dialog.showModal()}));
 document.querySelector('.photo-close').addEventListener('click',()=>dialog.close());document.querySelector('.photo-prev').addEventListener('click',()=>showPhoto(currentPhoto-1));document.querySelector('.photo-next').addEventListener('click',()=>showPhoto(currentPhoto+1));
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showPhoto(currentPhoto+(event.key==='ArrowRight'?1:-1));}});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});dialog.addEventListener('close',()=>photoTrigger?.focus());
 // Final occasion frame: a playful, accessible way to explore event types.
 const bubbles=[...document.querySelectorAll('[data-bubble]')];
 const bubbleCopy=['Um café para fazer parte de um dia inesquecível.','Mais um motivo para reunir, celebrar e compartilhar.','Café para receber, aproximar e conectar pessoas.','Uma experiência com café para dar presença à sua marca.','Do treino à boa conversa, um novo ritual de encontro.','Cuidado na recepção e em cada café servido.'];
 bubbles.forEach((button,index)=>button.addEventListener('click',()=>{if(button.getAttribute('aria-pressed')==='true')return;button.setAttribute('aria-pressed','true');button.parentElement.classList.add('is-popped');document.querySelector('.bubble-message').textContent=button.querySelector('strong').textContent+' — '+bubbleCopy[index];}));
 document.querySelector('.bubble-reset').addEventListener('click',()=>{bubbles.forEach(button=>{button.setAttribute('aria-pressed','false');button.parentElement.classList.remove('is-popped')});document.querySelector('.bubble-message').textContent='Estoure uma bolha. Imagine o seu próximo encontro.';});
 track.addEventListener('scroll',()=>{if(nativeRail.matches){setDrink(clamp(Math.round(track.scrollLeft/Math.max(1,track.clientWidth)),0,4));}},{passive:true});
 nativeRail.addEventListener?.('change',()=>{track.scrollLeft=0;setDrink(0);resize();});
 window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',resize,{passive:true});reduced.addEventListener?.('change',()=>{document.documentElement.classList.remove('motion-ready');document.querySelector('.intro-cart').style.transform='';queue()});setDrink(0);setScene(0);resize();
}
window.initRito=initRito;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initRito,{once:true});else initRito();
})();
