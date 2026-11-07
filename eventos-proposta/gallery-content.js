(function(){
 const rail=document.querySelector('.framed-gallery');if(!rail)return;
 (window.RITO_GALLERY||[]).forEach((photo,index)=>{
  const figure=document.createElement('figure');figure.className='event-tile gallery-shape-'+index%3;figure.dataset.location=photo.event;
  const img=document.createElement('img');img.src=photo.src;img.alt=photo.alt;img.loading='lazy';img.decoding='async';
  const caption=document.createElement('figcaption'),title=document.createElement('strong');title.textContent=photo.event;caption.appendChild(title);
  const button=document.createElement('button');button.className='event-open';button.dataset.photo=index;button.setAttribute('aria-label','Ampliar foto: '+photo.event+', '+photo.alt);
  figure.append(img,caption,button);rail.appendChild(figure);
 });
})();
