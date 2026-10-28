const workshopDb=window.supabase.createClient('https://wmsrwvlhivuycqmzjeea.supabase.co','sb_publishable_JCXBiV2IJJbQUsqLMVZcLg_oRpUrUuG');
const workshopForm=document.querySelector('#workshopForm');
const whatsappInput=workshopForm.elements.whatsapp;
const workshopSlug=workshopForm.dataset.workshopSlug;
const availabilityAlert=document.querySelector('#availabilityAlert');
const workshopParams=new URLSearchParams(location.search);
const workshopDemoMode=workshopParams.get('demo')==='1';

function showWorkshopAvailability(capacity,confirmed,remaining){
  if(!availabilityAlert||remaining>5)return;
  const percent=Math.min(Math.round(confirmed/capacity*100),100),soldOut=remaining===0;
  availabilityAlert.hidden=false;
  availabilityAlert.classList.toggle('is-sold-out',soldOut);
  document.querySelector('#availabilityTitle').textContent=soldOut?'Vagas esgotadas':`Últimas ${remaining} ${remaining===1?'vaga':'vagas'}`;
  document.querySelector('#availabilityPercent').textContent=`${percent}% preenchido`;
  document.querySelector('#availabilityHelp').textContent=soldOut?'Esta edição atingiu a capacidade máxima.':`O workshop comporta somente ${capacity} participantes.`;
  const track=availabilityAlert.querySelector('[role="progressbar"]');
  track.setAttribute('aria-valuenow',String(percent));
  document.querySelector('#availabilityBar').style.width=`${percent}%`;
  if(soldOut){const button=workshopForm.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Lista de participantes completa';}
}

function enableWorkshopDemo(){
  const remaining=Math.max(0,Math.min(Number(workshopParams.get('vagas')??3),15)),confirmed=15-remaining;
  const banner=document.createElement('div');
  banner.className='workshop-demo-banner';
  banner.textContent=`MODO TESTE · ${remaining} ${remaining===1?'vaga simulada':'vagas simuladas'} · nenhum dado será salvo`;
  document.body.prepend(banner);
  document.body.classList.add('workshop-demo');
  showWorkshopAvailability(15,confirmed,remaining);
}

async function loadWorkshopAvailability(){
  if(!availabilityAlert||!workshopSlug)return;
  if(workshopDemoMode){enableWorkshopDemo();return}
  const {data,error}=await workshopDb.rpc('get_workshop_availability',{p_workshop_slug:workshopSlug});
  const availability=Array.isArray(data)?data[0]:data;
  if(error||!availability||availability.capacity==null)return;
  const capacity=Number(availability.capacity),confirmed=Number(availability.confirmed||0),remaining=Math.max(Number(availability.remaining||0),0);
  showWorkshopAvailability(capacity,confirmed,remaining);
}

loadWorkshopAvailability();

function formatWhatsapp(value){
  const digits=value.replace(/\D/g,'').slice(0,11);
  if(digits.length<=2)return digits?`(${digits}`:'';
  if(digits.length<=6)return`(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if(digits.length<=10)return`(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

whatsappInput.addEventListener('input',()=>{whatsappInput.value=formatWhatsapp(whatsappInput.value)});

workshopForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const error=document.querySelector('#workshopError'),button=workshopForm.querySelector('button[type="submit"]');
  error.textContent='';
  if(!workshopForm.reportValidity())return;
  const data=new FormData(workshopForm);
  if(data.get('company'))return;
  const phone=String(data.get('whatsapp')).replace(/\D/g,'');
  if(phone.length<10){error.textContent='Informe um WhatsApp válido, incluindo o DDD.';whatsappInput.focus();return}
  if(workshopDemoMode){
    document.querySelector('#registrationPanel').hidden=true;
    document.querySelector('#successPanel').hidden=false;
    document.querySelector('#successPanel').scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML='Confirmando…';
  const {error:requestError}=await workshopDb.rpc('register_workshop_participant',{
    p_workshop_slug:workshopSlug,
    p_full_name:String(data.get('fullName')).trim(),
    p_whatsapp:phone,
    p_dietary_restriction:String(data.get('dietaryRestriction')).trim()||null
  });
  if(requestError){
    const known=requestError.message?.match(/(Este WhatsApp já está inscrito[^.]*\.|As vagas deste workshop foram preenchidas\.|Workshop indisponível para inscrições\.)/i);
    error.textContent=known?.[1]||'Não foi possível confirmar agora. Tente novamente em alguns instantes.';
    button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML='Confirmar participação <span>→</span>';return;
  }
  document.querySelector('#registrationPanel').hidden=true;
  document.querySelector('#successPanel').hidden=false;
  document.querySelector('#successPanel').scrollIntoView({behavior:'smooth',block:'center'});
  history.replaceState({},'',`${location.pathname}?confirmado=1`);
});
