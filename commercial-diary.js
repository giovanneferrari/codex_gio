/* Diário compartilhado pela interface atual e V3. Sem dados fictícios. */
(()=>{
 const host=document.querySelector('#comercial');if(!host)return;
 let enabled=false,saving=false,requestId=null;
 const histories=new Map();
 const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR'):'Sem data';
 const time=value=>new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
 const section=document.createElement('section');section.id='commercialDiary';section.hidden=true;section.innerHTML='<div class="diary-heading"><div><h2>Próximos passos por cliente</h2><p>Retornos em ordem de data. Expanda o cliente para ver todas as trocas.</p></div><button type="button" class="secondary" id="diaryRefresh">Atualizar</button></div><p id="diaryNotice" role="status"></p><div id="diaryRows"></div>';
 host.append(section);
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Diário';toggle.id='diaryToggle';document.querySelector('.crm-view-toggle').append(toggle);
 document.body.insertAdjacentHTML('beforeend',`<dialog id="diaryDialog" class="config-dialog"><form id="diaryForm"><div class="dialog-head"><div><span>COMERCIAL</span><h2>Registrar contato</h2><p id="diaryClient"></p></div><button type="button" data-diary-close aria-label="Fechar">×</button></div><div class="diary-fields"><label>Data e horário<input name="when" type="datetime-local" required></label><label>Canal<select name="channel"><option>WhatsApp</option><option>Ligação</option><option>Visita</option><option>Instagram</option><option>E-mail</option><option>Outro</option></select></label><label>Pessoa contatada<input name="person" maxlength="100" required></label><label>Conversa e combinados<textarea name="summary" maxlength="4000" rows="5" required></textarea></label><label class="diary-check"><input name="updateNext" type="checkbox"> Atualizar a próxima ação deste cliente</label><div id="diaryNext" hidden><label>Próxima ação<input name="next" maxlength="100"></label><label>Data do retorno<input name="due" type="date"></label></div><p>O registro será assinado pelo usuário conectado. As trocas anteriores serão preservadas.</p><p id="diaryError" role="alert"></p></div><div class="dialog-actions"><button type="button" class="secondary" data-diary-close>Cancelar</button><button type="submit" class="primary">Salvar contato</button></div></form></dialog>`);
 const dialog=document.querySelector('#diaryDialog'),form=document.querySelector('#diaryForm');
 function applyView(){section.hidden=!enabled;toggle.classList.toggle('active',enabled);toggle.setAttribute('aria-pressed',String(enabled));if(enabled){document.querySelector('#crmBoard').hidden=true;document.querySelector('#crmList').hidden=true;document.querySelectorAll('[data-crm-view]').forEach(b=>b.classList.remove('active'))}}
 const baseRender=renderCommercial;renderCommercial=function(){baseRender();if(profile?.role!=='admin'){enabled=false;histories.clear();section.hidden=true;document.querySelector("#diaryRows").replaceChildren();return}applyView();if(enabled)renderDiary()};
 toggle.onclick=()=>{if(profile?.role!=='admin')return;enabled=true;applyView();renderDiary()};
 document.querySelectorAll('[data-crm-view]').forEach(b=>b.addEventListener('click',()=>{enabled=false;applyView();syncCommercialView()}));
 function openContact(id){
  if(demoMode)return toast('O diário real não grava no modo demonstração.');
  const item=PROSPECTS.find(p=>p.id===id);if(!item||profile?.role!=='admin')return;
  form.reset();form.dataset.prospect=id;requestId=crypto.randomUUID();const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());form.elements.when.value=now.toISOString().slice(0,16);form.elements.person.value=item.contact_name||'';form.elements.next.value=item.next_action||'';form.elements.due.value=item.next_action_on||'';document.querySelector('#diaryNext').hidden=true;document.querySelector('#diaryClient').textContent=item.company_name;document.querySelector('#diaryError').textContent='';dialog.showModal();
 }
 form.elements.updateNext.onchange=()=>{document.querySelector('#diaryNext').hidden=!form.elements.updateNext.checked;form.elements.next.required=form.elements.updateNext.checked};
 function renderDiary(){
  const container=document.querySelector('#diaryRows');if(!container)return;
  const expanded=new Set([...container.querySelectorAll('details[open]')].map(d=>d.dataset.client));
  const rows=crmFilteredProspects().slice().sort((a,b)=>(a.next_action_on||'9999').localeCompare(b.next_action_on||'9999')||a.company_name.localeCompare(b.company_name,'pt-BR'));
  container.innerHTML=rows.length?rows.map(p=>`<details class="diary-client" data-client="${esc(p.id)}" ${expanded.has(p.id)?'open':''}><summary><span><strong>${date(p.next_action_on)}</strong><small>${p.next_action_on&&p.next_action_on<localDate(new Date())?'Retorno atrasado':p.next_action_on===localDate(new Date())?'Hoje':p.next_action_on?'Programado':'Definir retorno'}</small></span><span><strong>${esc(p.company_name)}</strong><small>${esc(p.contact_name||'Contato não informado')} · ${esc(CRM_STAGES[p.stage]||p.stage)}</small></span><span><strong>${esc(p.next_action||'Definir próxima ação')}</strong><small>Expandir histórico ⌄</small></span></summary><div class="diary-history"><div class="diary-heading"><h3>Histórico de trocas</h3><button type="button" class="secondary" data-record="${esc(p.id)}">＋ Registrar contato</button></div>${p.notes?`<div class="diary-context"><small>CONTEXTO DO CLIENTE · OBSERVAÇÕES EXISTENTES</small><p>${esc(p.notes)}</p></div>`:''}<div data-history="${esc(p.id)}"></div></div></details>`).join(''):'<p class="diary-empty">Nenhum cliente neste contexto e nestes filtros.</p>';
  container.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>openContact(b.dataset.record));
  container.querySelectorAll('details').forEach(d=>{d.ontoggle=()=>{if(d.open)loadHistory(d.dataset.client)};if(d.open)loadHistory(d.dataset.client)});
 }
 async function loadHistory(id){
  const target=document.querySelector(`[data-history="${id}"]`);if(!target)return;
  if(demoMode){target.textContent='Histórico real indisponível na demonstração.';return}
  if(histories.has(id)){paintHistory(target,histories.get(id));return}
  target.textContent='Carregando histórico…';
  try{const all=[];for(let offset=0;;offset+=500){const {data,error}=await db.from('commercial_interactions').select('*').eq('prospect_id',id).order('contacted_at',{ascending:false}).order('id').range(offset,offset+499);if(error)throw error;all.push(...data);if(data.length<500)break}histories.set(id,all);paintHistory(target,all)}catch(error){target.textContent='Não foi possível carregar o histórico. Confirme a atualização do banco e use Atualizar para tentar novamente.';console.warn('Diário comercial indisponível',error.code)}
 }
 function paintHistory(target,rows){target.innerHTML=rows.length?rows.map(r=>`<article class="diary-entry"><div><strong>${date(r.contacted_at)} · ${time(r.contacted_at)}</strong><small>${esc(r.channel)}</small></div><div><small>${esc(r.author_name)} com ${esc(r.contact_name)}</small><p>${esc(r.summary)}</p>${r.next_action?`<small>Combinado nesta troca: ${esc(r.next_action)} · ${date(r.next_action_on)}</small>`:''}</div></article>`).join(''):'<p class="diary-empty">Nenhuma troca registrada. As observações anteriores permanecem no contexto do cliente.</p>'}
 document.querySelectorAll('[data-diary-close]').forEach(b=>b.onclick=()=>{if(!saving)dialog.close()});dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault()});
 form.onsubmit=async e=>{
  e.preventDefault();if(saving||demoMode||profile?.role!=='admin')return;
  const data=new FormData(form),errorBox=document.querySelector('#diaryError'),update=data.has('updateNext');
  if(!String(data.get('person')).trim()||!String(data.get('summary')).trim()||(update&&!String(data.get('next')).trim())){errorBox.textContent='Preencha os campos obrigatórios.';return}
  saving=true;busy(form,true);errorBox.textContent='';
  try{const {error}=await db.rpc('record_commercial_interaction',{p_id:requestId,p_prospect_id:form.dataset.prospect,p_contacted_at:new Date(data.get('when')).toISOString(),p_channel:data.get('channel'),p_contact_name:data.get('person').trim(),p_summary:data.get('summary').trim(),p_update_next:update,p_next_action:update?data.get('next').trim():null,p_next_action_on:update?(data.get('due')||null):null});if(error)throw error;histories.delete(form.dataset.prospect);dialog.close();toast('Contato registrado.');try{await loadData()}catch{toast('Contato salvo. Atualize a página para recarregar os dados.')}if(enabled)renderDiary()}catch(error){errorBox.textContent=message(error,'Não foi possível salvar. Verifique a atualização do banco e tente novamente.')}finally{saving=false;busy(form,false)}
 };
 async function refresh(){if(!enabled||profile?.role!=='admin'||demoMode)return;histories.clear();try{await loadData();document.querySelector('#diaryNotice').textContent='Histórico atualizado.'}catch{document.querySelector('#diaryNotice').textContent='Falha ao atualizar. Tente novamente.'}}
 document.querySelector('#diaryRefresh').onclick=refresh;
 window.addEventListener('focus',refresh);
 const baseDetail=openProspectDetail;openProspectDetail=function(id){baseDetail(id);document.querySelector('#detailDiaryButton')?.remove();const b=document.createElement('button');b.id='detailDiaryButton';b.type='button';b.className='secondary';b.textContent='Ver histórico de trocas';b.onclick=()=>{document.querySelector('#prospectDetailDialog').close();showView('comercial');const p=PROSPECTS.find(p=>p.id===id);document.querySelector(`[data-crm-scope="${['paused','lost'].includes(p.stage)?'standby':'active'}"]`).click();document.querySelector('#crmSearch').value=p.company_name;document.querySelector('#crmStageFilter').value='';enabled=true;renderCommercial();const d=document.querySelector(`[data-client="${id}"]`);if(d)d.open=true};document.querySelector('#prospectDetailContent').before(b)};
})();
