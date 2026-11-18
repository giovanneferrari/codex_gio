(function(){
 const rail=document.querySelector('#clientes .clients-grid');if(!rail)return;
 let drag=null;
 rail.addEventListener('pointerdown',event=>{
  // Touch keeps native momentum scrolling and vertical page gestures.
  if(event.pointerType==='touch'||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,scroll:rail.scrollLeft};
  rail.setPointerCapture(event.pointerId);rail.classList.add('is-dragging');
  rail.focus({preventScroll:true});event.preventDefault();
 });
 rail.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  rail.scrollLeft=drag.scroll-(event.clientX-drag.x);
 });
 function release(event){
  if(!drag||event.pointerId!==drag.id)return;
  drag=null;rail.classList.remove('is-dragging');
  if(rail.hasPointerCapture(event.pointerId))rail.releasePointerCapture(event.pointerId);
 }
 ['pointerup','pointercancel','lostpointercapture'].forEach(type=>rail.addEventListener(type,release));
 rail.addEventListener('dragstart',event=>event.preventDefault());
 rail.addEventListener('keydown',event=>{
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  event.preventDefault();rail.scrollBy({left:(event.key==='ArrowRight'?1:-1)*rail.querySelector('.client-item').offsetWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 });
})();
