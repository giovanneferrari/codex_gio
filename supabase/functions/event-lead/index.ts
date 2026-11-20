const allowed = new Set(['https://ritocafe.shop', 'https://www.ritocafe.shop']);
const recent = new Map();
const money = (n) => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(n);
const clean = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const headers = {'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://ritocafe.shop', 'Access-Control-Allow-Headers':'content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Vary':'Origin', 'Content-Type':'application/json'};
  const reply = (status, data) => new Response(JSON.stringify(data), {status, headers});
  if (!allowed.has(origin)) return reply(403, {ok:false});
  if (req.method === 'OPTIONS') return new Response(null, {status:204, headers});
  if (req.method !== 'POST') return reply(405, {ok:false});
  // Best-effort burst protection within each worker; provider quotas remain necessary.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now-t < 60000);
  if (hits.length >= 5) return reply(429, {ok:false});
  if (recent.size > 2000) recent.clear();
  recent.set(ip, [...hits, now]);
  try {
    const raw = await req.text();
    if (raw.length > 12000) return reply(413, {ok:false});
    const d = JSON.parse(raw);
    const name = clean(d.name), email = clean(d.email,180), phone = clean(d.phone,25), city = clean(d.city), eventType = clean(d.eventType), date = clean(d.date,10), people = Number(d.people);
    if (d.website || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email) || phone.replace(/\D/g,'').length < 10 || !city || !eventType || !Number.isInteger(people) || people < 1 || people > 10000 || !['/eventos/','/eventos-proposta/'].includes(d.source) || !/^[0-9a-f-]{36}$/i.test(d.requestId) || !Number.isFinite(d.startedAt) || now-d.startedAt < 1500 || now-d.startedAt > 86400000) return reply(400, {ok:false});
    const lines = ['NOVO PEDIDO DE PROPOSTA — RITO', `Nome: ${name}`, `E-mail: ${email}`, `WhatsApp: ${phone}`, `Evento: ${eventType}`, `Data: ${date || 'A definir'}`, `Cidade: ${city}`, `Pessoas: ${people}`, `Empresa: ${clean(d.company) || 'Não informada'}`];
    if (d.source === '/eventos-proposta/' && d.quote) {
      const q = d.quote;
      if (q.people !== people || people < 10 || people > 100 || ![1,2,3].includes(q.drinks) || typeof q.cookies !== 'boolean') return reply(400,{ok:false});
      const base = people < 20 ? 40-(people-10)*.5 : people < 40 ? 35-(people-20)*.25 : 30;
      const drinksTotal = Math.round((base-(3-q.drinks)*5)*people*100)/100;
      const cookiesTotal = q.cookies ? people*(people >= 20 ? 12 : 15) : 0;
      lines.push('', 'SIMULAÇÃO (valores recalculados no servidor)', `${people*q.drinks} bebidas (${q.drinks} por pessoa): ${money(drinksTotal)}`, `${q.cookies ? people : 0} cookies: ${money(cookiesTotal)}`, 'Estrutura e 2 horas de serviço incluídas.', `Total estimado: ${money(drinksTotal+cookiesTotal)}`, 'Sujeito à confirmação de local, logística, cardápio e disponibilidade.');
    }
    lines.push('', `Mensagem: ${clean(d.message,2000) || 'Sem observações'}`, `Origem: ${d.source}`);
    const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('LEAD_FROM_EMAIL');
    const to = Deno.env.get('LEAD_RECIPIENT_EMAIL') || 'giovanne@ritocafe.shop';
    if (!key || !from) return reply(503,{ok:false});
    const sent = await fetch('https://api.resend.com/emails', {method:'POST', headers:{Authorization:`Bearer ${key}`, 'Content-Type':'application/json', 'Idempotency-Key':`event-lead-${d.requestId}`}, body:JSON.stringify({from,to:[to],reply_to:email,subject:'Novo interesse em evento | Rito Café',text:lines.join('\n')}), signal:AbortSignal.timeout(15000)});
    if (!sent.ok) return reply(502,{ok:false});
    const result = await sent.json();
    if (!result.id) return reply(502,{ok:false});
    return reply(200,{ok:true,id:result.id});
  } catch (_) { return reply(400,{ok:false}); }
});
