const editionList=document.querySelector('.edition-list');
const availabilityDb=window.supabase?.createClient('https://wmsrwvlhivuycqmzjeea.supabase.co','sb_publishable_JCXBiV2IJJbQUsqLMVZcLg_oRpUrUuG');
const html=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const publicDate=value=>new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'long'});

function editionUrl(item){return item.slug==='cafe-sp-2026-11-29'?'edicaosp-1/':`edicao/?evento=${encodeURIComponent(item.slug)}`}
function editionCover(item){return item.cover_url||'../assets/workshop-sp.png'}

function editionMarkup(item){
  const confirmed=Number(item.confirmed||0),capacity=Number(item.capacity||0),remaining=Math.max(capacity-confirmed,0),percent=capacity?Math.min(Math.round(confirmed/capacity*100),100):0,urgent=capacity&&remaining<=5,isNewBatch=!!item.capacity_increased_at;
  return `<a class="edition-card" href="${editionUrl(item)}" data-event-date="${html(item.event_date)}" data-edition="${html(item.edition_label||'')}" data-workshop-slug="${html(item.slug)}"><div class="edition-image"><img src="${html(editionCover(item))}" alt="Arte de ${html(item.title)}"><span class="edition-status">${isNewBatch?'NOVO LOTE LIBERADO':'INSCRIÇÕES ABERTAS'}</span><div class="edition-finished"><strong>EVENTO FINALIZADO</strong><small>Confira as próximas edições</small></div></div><div class="edition-copy"><small>${html(item.edition_label||'EXPERIÊNCIA RITO')}</small><h2>${html(item.title)}</h2><p>${html(item.description||'Uma experiência sensorial conduzida pela RITO.')}</p>${urgent?`<div class="card-availability"><div><strong class="card-availability-title">${remaining===0?'Vagas esgotadas':`Últimas ${remaining} ${remaining===1?'vaga':'vagas'}`}</strong><span class="card-availability-percent">${percent}% preenchido</span></div><div class="card-availability-track"><i style="width:${percent}%"></i></div></div>`:''}<div><strong>${publicDate(item.event_date)} · ${String(item.starts_at||'').slice(0,5)}</strong><span class="edition-action">Ver edição →</span></div></div></a>`;
}

function prepareEditionCards(){
  const today=new Date();today.setHours(0,0,0,0);const editions=[...document.querySelectorAll('.edition-card')];
  editions.forEach(card=>{const finished=new Date(`${card.dataset.eventDate}T23:59:59`)<today;card.classList.toggle('is-finished',finished);card.dataset.finished=finished?'1':'0';if(finished){card.querySelector('.edition-action').textContent='Rever edição →'}});
  editions.sort((a,b)=>{const finishedDifference=Number(a.dataset.finished)-Number(b.dataset.finished);if(finishedDifference)return finishedDifference;const dateA=new Date(`${a.dataset.eventDate}T12:00:00`),dateB=new Date(`${b.dataset.eventDate}T12:00:00`);return a.dataset.finished==='1'?dateB-dateA:dateA-dateB}).forEach(card=>editionList.appendChild(card));
}

async function loadPublicEditions(){
  if(!availabilityDb){prepareEditionCards();return}
  const {data,error}=await availabilityDb.rpc('list_public_workshops');
  if(!error&&data?.length)editionList.innerHTML=data.map(editionMarkup).join('');
  prepareEditionCards();
}

loadPublicEditions();
