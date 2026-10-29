const eventDb=window.supabase.createClient('https://wmsrwvlhivuycqmzjeea.supabase.co','sb_publishable_JCXBiV2IJJbQUsqLMVZcLg_oRpUrUuG');
const eventSlug=window.RITO_EVENT_SLUG||new URLSearchParams(location.search).get('evento');
const brl=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0});
const fullDate=value=>new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});

async function loadEvent(){
  if(!eventSlug)return failEvent();const {data,error}=await eventDb.rpc('get_public_workshop',{p_workshop_slug:eventSlug}),item=Array.isArray(data)?data[0]:data;if(error||!item)return failEvent();
  document.title=`${item.title} | RITO`;document.querySelector('#eventCover').src=item.cover_url||'../../assets/workshop-sp.png';document.querySelector('#eventCover').alt=`Arte de ${item.title}`;document.querySelector('#eventEditionLabel').textContent=item.edition_label||'EXPERIÊNCIA RITO';document.querySelector('#eventDescription').textContent=item.description||'Uma experiência sensorial conduzida pela RITO.';document.querySelector('#eventDateTime').textContent=`${fullDate(item.event_date)} · ${String(item.starts_at).slice(0,5)}`;document.querySelector('#eventPrice').textContent=brl(item.price);document.querySelector('#workshopForm').dataset.workshopSlug=item.slug;document.querySelector('#successEventText').innerHTML=`Nos vemos no dia <strong>${fullDate(item.event_date)}, às ${String(item.starts_at).slice(0,5)}</strong>. O pagamento de <strong>${brl(item.price)}</strong> será realizado no dia do workshop.`;document.querySelector('#successLocation').textContent=item.location_name||'Local a confirmar';document.querySelector('#successAddress').textContent=item.address||'';
  if(item.capacity_increased_at&&item.previous_capacity){document.querySelector('#newBatchAlert').hidden=false;document.querySelector('#newBatchText').textContent=`Ampliamos a experiência de ${item.previous_capacity} para ${item.capacity} participantes.`}
  document.querySelector('#workshopNotFound').hidden=true;document.querySelector('#dynamicWorkshop').hidden=false;const script=document.createElement('script');script.src='../../workshop.js?v=4';document.body.appendChild(script);
}
function failEvent(){const box=document.querySelector('#workshopNotFound');box.querySelector('h1').textContent='Edição não encontrada.';box.querySelector('p').innerHTML='<a href="../">Ver todas as edições disponíveis</a>'}
loadEvent();
