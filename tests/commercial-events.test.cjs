const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const js=fs.readFileSync('commercial-events.js','utf8');
const sql=fs.readFileSync('supabase/migrations/20261118120000_commercial_event_opportunities.sql','utf8');
test('eventos pontuais têm pipeline separado do cadastro de estabelecimentos',()=>{assert.match(js,/Eventos pontuais/);assert.match(js,/commercial_event_opportunities/);assert.match(js,/commercial_event_interactions/)});
test('confirmação cria compromisso na Agenda e mantém vínculo',()=>{assert.match(sql,/confirm_commercial_event_opportunity/);assert.match(sql,/insert into public\.schedule_events/);assert.match(sql,/schedule_event_id=schedule_id/)});
test('registro de ação atualiza etapa e próximo passo de forma transacional',()=>{assert.match(sql,/record_commercial_event_followup/);assert.match(sql,/for update/);assert.match(sql,/next_action_on=p_next_date/)});
