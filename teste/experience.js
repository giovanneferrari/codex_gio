(function(){
function initRito(){
 if(document.documentElement.dataset.ritoInitialized)return;
 document.documentElement.dataset.ritoInitialized='true';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const hero=document.querySelector('.hero-scroll'),cart=document.querySelector('.cart-object'),core=document.querySelector('.core-story'),track=document.querySelector('.core-track');
 const products=[...document.querySelectorAll('.core-product')],dots=[...document.querySelectorAll('[data-core-to]')],layer=document.querySelector('.sweat-layer');
 const names=['ESPRESSO','COADO','ORANGE COFFEE'];
 const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
 let scheduled=false,active=-1;
 const droplets=[];
 // Each droplet travels only with scroll. Scrolling back restores its previous position.
 for(let i=0;i<25;i++){
  const drop=document.createElement('i');drop.className='waterdrop';
  const x=12+(i*29%77),y=8+(i*17%53),size=4+(i%4)*1.6;
  drop.style.left=x+'%';drop.style.top=y+'%';drop.style.width=size+'px';drop.style.height=size*1.6+'px';layer.appendChild(drop);
  let trail=null;if(i%4===0){trail=document.createElement('i');trail.className='watertrail';trail.style.left=x+'%';trail.style.top=y+'%';layer.appendChild(trail);}
  droplets.push({drop,trail,phase:(i%7)*.065,travel:45+(i%5)*27});
 }
 function progress(section){const rect=section.getBoundingClientRect(),range=section.offsetHeight-innerHeight;return range>0?clamp(-rect.top/range):0;}
 function updateActive(index){if(index===active)return;active=index;dots.forEach((d,i)=>d.setAttribute('aria-pressed',String(i===index)));document.querySelector('.core-progress').textContent=String(index+1).padStart(2,'0')+' / '+names[index];}
 function render(){scheduled=false;
  if(reduced.matches){track.style.transform='none';cart.style.transform='none';products.forEach(p=>p.style.transform='none');return;}
  const hp=progress(hero);cart.style.transform='translate3d('+(-hp*5)+'%,'+(-hp*3)+'%,0) rotate('+(-3+hp*6)+'deg) scale('+(1+hp*.13)+')';
  const cp=progress(core),position=cp*2;
  track.style.transform='translate3d('+(-cp*200/3)+'%,0,0)';
  products.forEach((product,i)=>{const offset=clamp(position-i,-1,1);const rotation=-offset*11;const rise=Math.sin(Math.abs(offset)*Math.PI)*-9;product.style.transform='translate3d(0,'+rise+'px,0) rotate('+rotation+'deg)';});
  updateActive(Math.round(position));
  const orangeProgress=clamp((cp-.55)/.45);
  droplets.forEach(({drop,trail,phase,travel})=>{const flow=clamp((orangeProgress-phase)/(1-phase));const y=flow*travel;drop.style.transform='translate3d(0,'+y+'px,0) scaleY('+(1+flow*.28)+')';drop.style.opacity=String(.45+Math.sin(flow*Math.PI)*.5);if(trail){trail.style.height=Math.max(0,y)+'px';trail.style.opacity=String(.12+flow*.2);}});
 }
 function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(render)}}
 function go(index){index=clamp(index,0,2);if(reduced.matches){document.querySelector('[data-core="'+index+'"]').scrollIntoView({behavior:'auto',block:'center'});updateActive(index);return;}
  const range=core.offsetHeight-innerHeight,top=window.scrollY+core.getBoundingClientRect().top;window.scrollTo({top:top+(index/2)*Math.max(0,range),behavior:'smooth'});
 }
 dots.forEach(d=>d.addEventListener('click',()=>go(Number(d.dataset.coreTo))));
 document.querySelector('.core-dots').addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const target=clamp(active+(event.key==='ArrowRight'?1:-1),0,2);go(target);dots[target].focus();}});
 if('IntersectionObserver'in window&&!reduced.matches){document.documentElement.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.07});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));}
 window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue,{passive:true});reduced.addEventListener?.('change',()=>{document.documentElement.classList.remove('motion-ready');queue()});
 updateActive(0);render();
}
window.initRito=initRito;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initRito,{once:true});else initRito();
})();
