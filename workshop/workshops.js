const editionList=document.querySelector('.edition-list');
const today=new Date();
today.setHours(0,0,0,0);

const editions=[...document.querySelectorAll('.edition-card')];
const availabilityDb=window.supabase?.createClient('https://wmsrwvlhivuycqmzjeea.supabase.co','sb_publishable_JCXBiV2IJJbQUsqLMVZcLg_oRpUrUuG');

editions.forEach(card=>{
  const eventDate=new Date(`${card.dataset.eventDate}T23:59:59`);
  const finished=eventDate<today;
  card.classList.toggle('is-finished',finished);
  card.dataset.finished=finished?'1':'0';
  if(finished){
    card.querySelector('.edition-status').textContent='EDIÇÃO ENCERRADA';
    card.querySelector('.edition-action').textContent='Rever edição →';
  }
});

editions.sort((a,b)=>{
  const finishedDifference=Number(a.dataset.finished)-Number(b.dataset.finished);
  if(finishedDifference)return finishedDifference;
  const dateA=new Date(`${a.dataset.eventDate}T12:00:00`);
  const dateB=new Date(`${b.dataset.eventDate}T12:00:00`);
  return a.dataset.finished==='1'?dateB-dateA:dateA-dateB;
}).forEach(card=>editionList.appendChild(card));

async function loadCardAvailability(card){
  if(!availabilityDb||card.dataset.finished==='1'||!card.dataset.workshopSlug)return;
  const {data,error}=await availabilityDb.rpc('get_workshop_availability',{p_workshop_slug:card.dataset.workshopSlug});
  const availability=Array.isArray(data)?data[0]:data;
  if(error||!availability||availability.capacity==null||Number(availability.remaining)>5)return;
  const capacity=Number(availability.capacity),confirmed=Number(availability.confirmed||0),remaining=Math.max(Number(availability.remaining||0),0),percent=Math.min(Math.round(confirmed/capacity*100),100),marker=card.querySelector('.card-availability');
  marker.hidden=false;
  marker.querySelector('.card-availability-title').textContent=remaining===0?'Vagas esgotadas':`Últimas ${remaining} ${remaining===1?'vaga':'vagas'}`;
  marker.querySelector('.card-availability-percent').textContent=`${percent}% preenchido`;
  marker.querySelector('i').style.width=`${percent}%`;
}

editions.forEach(loadCardAvailability);
