/* Gestão administrativa das edições de workshop. */
let selectedWorkshopAdminId=null,editingWorkshopEventId=null,workshopCoverObjectUrl='';
const workshopView=$('#workshops');

if(workshopView){
  const heading=workshopView.querySelector('.section-heading'),publicLink=heading.querySelector('.workshop-public-link');
  publicLink.href='workshop/';
  publicLink.textContent='Ver edições ↗';
  const actions=document.createElement('div');actions.className='workshop-heading-actions';
  actions.innerHTML='<button type="button" class="primary" id="newWorkshopEventBtn">＋ Novo evento</button>';
  actions.appendChild(publicLink);heading.appendChild(actions);
  workshopView.querySelector('.workshop-metrics').insertAdjacentHTML('beforebegin','<div class="workshop-editions" id="workshopEditionCards"></div>');
  document.body.insertAdjacentHTML('beforeend',`<dialog id="workshopEventDialog" class="config-dialog workshop-event-dialog"><form id="workshopEventForm"><div class="dialog-head"><div><span>WORKSHOPS</span><h2 id="workshopEventDialogTitle">Novo evento</h2><p>Configure a edição que aparecerá na página pública.</p></div><button type="button" data-close-workshop-event aria-label="Fechar">×</button></div><label class="workshop-cover-upload"><img id="workshopCoverPreview" src="assets/workshop-sp.png" alt="Prévia da capa"><span><strong>Arte da capa</strong><small>JPG, PNG ou WebP · formato vertical recomendado · até 8 MB</small></span><input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="form-row"><label>Título<input name="title" required maxlength="90" placeholder="Ex.: Workshop de Café"></label><label>Identificação da edição<input name="editionLabel" maxlength="70" placeholder="Ex.: SÃO PAULO · EDIÇÃO 02"></label></div><label>Texto de apresentação<textarea name="description" maxlength="260" rows="3" placeholder="Uma descrição curta da experiência"></textarea></label><div class="form-row"><label>Data<input name="eventDate" type="date" required></label><label>Horário<input name="startsAt" type="time" required></label></div><div class="form-row"><label>Capacidade de participantes<input name="capacity" type="number" min="1" max="1000" step="1" required></label><label>Valor por pessoa (R$)<input name="price" type="number" min="0" step="0.01" required></label></div><p class="workshop-capacity-note" id="workshopCapacityIncreaseNote" hidden></p><div class="form-row"><label>Nome do local<input name="locationName" maxlength="100" placeholder="Ex.: Casa do Bosque"></label><label>Identificador do link<input name="slug" required maxlength="90" pattern="[a-z0-9-]+" placeholder="workshop-sp-02"></label></div><label>Endereço<input name="address" maxlength="180" placeholder="Rua, número, bairro e cidade"></label><label class="workshop-active-check"><input name="active" type="checkbox" checked> Publicar esta edição e aceitar inscrições</label><p class="form-error" id="workshopEventError"></p><div class="dialog-actions"><button type="button" class="secondary" data-close-workshop-event>Cancelar</button><button type="submit" class="primary">Salvar evento</button></div></form></dialog>`);
}

function workshopAdminCurrent(){return WORKSHOPS.find(item=>item.id===selectedWorkshopAdminId)||WORKSHOPS[0]}
activeWorkshop=function(){return workshopAdminCurrent()};

function workshopAdminCover(item){return item.cover_url||'assets/workshop-sp.png'}
function workshopAdminCount(item){return WORKSHOP_REGISTRATIONS.filter(registration=>registration.workshop_id===item.id&&registration.confirmed!==false).length}

function renderWorkshopEditionCards(){
  const container=$('#workshopEditionCards');if(!container)return;
  const sorted=[...WORKSHOPS].sort((a,b)=>new Date(b.event_date)-new Date(a.event_date));
  if(!selectedWorkshopAdminId&&sorted.length)selectedWorkshopAdminId=(sorted.find(item=>new Date(`${item.event_date}T23:59:59`)>=new Date())||sorted[0]).id;
  container.innerHTML=sorted.length?sorted.map(item=>{const count=workshopAdminCount(item),remaining=item.capacity==null?'—':Math.max(Number(item.capacity)-count,0),batch=item.capacity_increased_at?`<b class="new-batch">NOVO LOTE · ${item.previous_capacity} → ${item.capacity}</b>`:`<b>${item.active?'PUBLICADO':'RASCUNHO'}</b>`;return`<button type="button" class="workshop-edition-card ${item.id===selectedWorkshopAdminId?'active':''}" data-select-workshop="${item.id}"><img src="${esc(workshopAdminCover(item))}" alt=""><span><small>${esc(item.edition_label||'EDIÇÃO')}</small><strong>${esc(item.title)}</strong><em>${workshopDate(item.event_date)} · ${count} inscritos · ${remaining} vagas</em>${batch}<span class="workshop-edition-edit" data-edit-workshop-event="${item.id}">Editar edição</span></span></button>`}).join(''):'<div class="empty-state compact"><strong>Nenhuma edição criada</strong><small>Use “Novo evento” para publicar a primeira.</small></div>';
  container.querySelectorAll('[data-select-workshop]').forEach(button=>button.onclick=event=>{if(event.target.closest('[data-edit-workshop-event]'))return;selectedWorkshopAdminId=button.dataset.selectWorkshop;renderWorkshops()});
  container.querySelectorAll('[data-edit-workshop-event]').forEach(button=>button.onclick=event=>{event.stopPropagation();openWorkshopEvent(button.dataset.editWorkshopEvent)});
}

const renderWorkshopsAdminBase=renderWorkshops;
renderWorkshops=function(){renderWorkshopEditionCards();renderWorkshopsAdminBase();renderWorkshopEditionCards()};

function workshopSlugify(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)}
function closeWorkshopEvent(){if(workshopCoverObjectUrl){URL.revokeObjectURL(workshopCoverObjectUrl);workshopCoverObjectUrl=''}$('#workshopEventDialog').close()}

function openWorkshopEvent(id=null){
  editingWorkshopEventId=id;const item=WORKSHOPS.find(event=>event.id===id),form=$('#workshopEventForm');form.reset();
  $('#workshopEventDialogTitle').textContent=item?'Editar evento':'Novo evento';
  form.elements.title.value=item?.title||'';form.elements.editionLabel.value=item?.edition_label||'';form.elements.description.value=item?.description||'';form.elements.eventDate.value=item?.event_date||'';form.elements.startsAt.value=String(item?.starts_at||'10:00').slice(0,5);form.elements.capacity.value=item?.capacity||15;form.elements.price.value=item?.price||130;form.elements.locationName.value=item?.location_name||'';form.elements.address.value=item?.address||'';form.elements.slug.value=item?.slug||'';form.elements.active.checked=item?.active??true;
  $('#workshopCoverPreview').src=workshopAdminCover(item||{});$('#workshopEventError').textContent='';$('#workshopCapacityIncreaseNote').hidden=true;$('#workshopEventDialog').showModal();
}

$('#newWorkshopEventBtn').onclick=()=>openWorkshopEvent();
document.querySelectorAll('[data-close-workshop-event]').forEach(button=>button.onclick=closeWorkshopEvent);
$('#workshopEventForm').elements.title.addEventListener('input',event=>{if(!editingWorkshopEventId)$('#workshopEventForm').elements.slug.value=workshopSlugify(event.target.value)});
$('#workshopEventForm').elements.slug.addEventListener('input',event=>event.target.value=workshopSlugify(event.target.value));
$('#workshopEventForm').elements.capacity.addEventListener('input',event=>{const item=WORKSHOPS.find(workshop=>workshop.id===editingWorkshopEventId),note=$('#workshopCapacityIncreaseNote'),next=Number(event.target.value);note.hidden=!(item?.capacity&&next>Number(item.capacity));if(!note.hidden)note.textContent=`Novo lote: ao salvar, a capacidade passará de ${item.capacity} para ${next} pessoas. A ampliação será destacada na página pública.`});
$('#workshopEventForm').elements.cover.addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>8*1024*1024){event.target.value='';return $('#workshopEventError').textContent='Escolha uma imagem JPG, PNG ou WebP de até 8 MB.'}if(workshopCoverObjectUrl)URL.revokeObjectURL(workshopCoverObjectUrl);workshopCoverObjectUrl=URL.createObjectURL(file);$('#workshopCoverPreview').src=workshopCoverObjectUrl;$('#workshopEventError').textContent=''});

$('#workshopEventForm').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),slug=workshopSlugify(data.get('slug')),payload={slug,title:String(data.get('title')).trim(),edition_label:String(data.get('editionLabel')).trim()||null,description:String(data.get('description')).trim()||null,event_date:data.get('eventDate'),starts_at:data.get('startsAt'),capacity:Number(data.get('capacity')),price:Number(data.get('price')),location_name:String(data.get('locationName')).trim()||null,address:String(data.get('address')).trim()||null,active:data.get('active')==='on'},cover=data.get('cover');
  if(WORKSHOPS.some(item=>item.id!==editingWorkshopEventId&&item.slug===slug))return $('#workshopEventError').textContent='Já existe uma edição com esse identificador de link.';
  if(demoMode){const existing=WORKSHOPS.find(item=>item.id===editingWorkshopEventId),increased=existing&&payload.capacity>Number(existing.capacity);if(existing)Object.assign(existing,payload,increased?{previous_capacity:existing.capacity,capacity_increased_at:new Date().toISOString()}:{});else WORKSHOPS.unshift({id:`demo-workshop-${Date.now()}`,created_at:new Date().toISOString(),...payload,cover_url:workshopCoverObjectUrl||'assets/workshop-sp.png'});selectedWorkshopAdminId=editingWorkshopEventId||WORKSHOPS[0].id;closeWorkshopEvent();renderWorkshops();toast('Evento salvo apenas nesta sessão.');return}
  busy(form,true);let result=editingWorkshopEventId?await db.from('workshops').update(payload).eq('id',editingWorkshopEventId).select('*').single():await db.from('workshops').insert(payload).select('*').single();
  if(result.error){busy(form,false);return $('#workshopEventError').textContent=message(result.error,'Não foi possível salvar o evento.')}
  const saved=result.data;
  if(cover?.size){const extension=cover.name.split('.').pop().toLowerCase(),path=`${saved.id}/${Date.now()}.${extension}`,uploaded=await db.storage.from('workshop-covers').upload(path,cover,{contentType:cover.type,upsert:false});if(uploaded.error){busy(form,false);return $('#workshopEventError').textContent='Evento salvo, mas não foi possível enviar a capa.'}const coverUrl=db.storage.from('workshop-covers').getPublicUrl(path).data.publicUrl;const updated=await db.from('workshops').update({cover_url:coverUrl}).eq('id',saved.id);if(updated.error){busy(form,false);return $('#workshopEventError').textContent='Capa enviada, mas não foi possível vinculá-la ao evento.'}}
  busy(form,false);selectedWorkshopAdminId=saved.id;closeWorkshopEvent();await loadData();showView('workshops');toast(editingWorkshopEventId?'Evento atualizado.':'Evento criado e publicado.');
};

renderWorkshopEditionCards();
