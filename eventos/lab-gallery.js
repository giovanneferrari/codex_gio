(function(){
 const rail=document.querySelector('.framed-gallery'),pause=document.querySelector('.gallery-pause'),dialog=document.querySelector('.photo-dialog');if(!rail)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let manualPause=false,keyboardFocus=false,visible=true,until=0,raf=0,last=0,cycle=0,position=0;
 const originals=[...rail.querySelectorAll('figure')];if(!originals.length){pause.disabled=true;return;}
 const copies=[];
 for(let set=0;set<2;set++)originals.forEach((figure,i)=>{const clone=figure.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.dataset.galleryClone='true';clone.querySelectorAll('button').forEach(button=>{button.tabIndex=-1;button.addEventListener('click',()=>originals[i].querySelector('.event-open').click())});rail.appendChild(clone);copies.push(clone)});
 function measure(){const old=cycle;cycle=copies[0].offsetLeft-originals[0].offsetLeft;if(cycle>0)rail.scrollLeft=old?cycle+(rail.scrollLeft%old):cycle;position=rail.scrollLeft}
 function paint(){pause.textContent=manualPause?'Retomar movimento':'Pausar movimento';pause.setAttribute('aria-pressed',String(manualPause))}
 function wrap(){if(cycle>0){if(rail.scrollLeft>=cycle*2)rail.scrollLeft-=cycle;else if(rail.scrollLeft<cycle*.25)rail.scrollLeft+=cycle}}
 function frame(time){if(last&&visible&&!manualPause&&!keyboardFocus&&!dialog.open&&!document.hidden&&time>until){position+=Math.min(time-last,50)*.034;rail.scrollLeft=position;wrap();if(Math.abs(rail.scrollLeft-position)>2)position=rail.scrollLeft}if(time<=until)position=rail.scrollLeft;last=time;raf=visible?requestAnimationFrame(frame):0}
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&!raf){last=0;raf=requestAnimationFrame(frame)}},{threshold:0}).observe(rail);
 rail.addEventListener('focusin',event=>{keyboardFocus=event.target.matches(':focus-visible')});rail.addEventListener('focusout',()=>keyboardFocus=false);
 ['pointerdown','wheel','touchstart'].forEach(event=>rail.addEventListener(event,()=>{keyboardFocus=false;until=performance.now()+1800},{passive:true}));
 rail.addEventListener('scroll',()=>{if(performance.now()<until)wrap()},{passive:true});
 pause.addEventListener('click',()=>{manualPause=!manualPause;paint()});
 function move(direction){until=performance.now()+2000;rail.scrollBy({left:direction*310,behavior:reduced.matches?'auto':'smooth'})}
 document.querySelector('.gallery-prev').addEventListener('click',()=>move(-1));document.querySelector('.gallery-next').addEventListener('click',()=>move(1));rail.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();keyboardFocus=true;move(e.key==='ArrowRight'?1:-1)}});
 dialog.addEventListener('close',()=>{keyboardFocus=false;until=performance.now()+600});window.addEventListener('resize',measure,{passive:true});
 measure();position=rail.scrollLeft;paint();raf=requestAnimationFrame(frame);
})();
