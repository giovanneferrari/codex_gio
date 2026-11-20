(() => {
  const form = document.querySelector('#event-lead');
  if (!form) return;
  const status = form.querySelector('.lead-status');
  const button = form.querySelector('[type="submit"]');
  const whatsapp = document.querySelector('.lead-whatsapp');
  const estimate = document.querySelector('#lead-estimate');
  const range = document.querySelector('#people-range');
  let busy = false;
  const startedAt = Date.now();
  let requestId = crypto.randomUUID();
  function selection() {
    if (!range) return null;
    return { people: Number(range.value), drinks: Number(document.querySelector('[name="drinks"]:checked').value), cookies: document.querySelector('#include-cookies').checked };
  }
  function refreshEstimate() {
    const quote = selection();
    if (!quote) return;
    requestId = crypto.randomUUID();
    estimate.hidden = true;
    estimate.textContent = `Sua simulação · 2 horas de serviço\n${quote.people} pessoas · ${quote.people * quote.drinks} bebidas · ${quote.cookies ? quote.people : 0} cookies\nTotal estimado: ${document.querySelector('#price-total').textContent}\nPara alterar as quantidades, ajuste a calculadora acima.`;
  }
  document.querySelector('.pricing-controls')?.addEventListener('input', refreshEstimate);
  document.querySelector('.pricing-controls')?.addEventListener('change', refreshEstimate);
  refreshEstimate();
  function payload() {
    const data = Object.fromEntries(new FormData(form));
    return {...data, people: selection()?.people ?? null, quote: selection(), source: location.pathname, requestId, startedAt};
  }
  function updateWhatsApp() {
    const d = payload();
    const lines = ['Olá! Quero levar a Rito para meu evento.', d.name && `Nome: ${d.name}`, d.eventType && `Evento: ${d.eventType}`, d.date && `Data: ${d.date.split('-').reverse().join('/')}`, d.city && `Cidade: ${d.city}`, d.people && `Pessoas: ${d.people}`, d.company && `Empresa: ${d.company}`, d.quote && estimate.textContent, d.message].filter(Boolean);
    whatsapp.href = 'https://wa.me/5511939231018?text=' + encodeURIComponent(lines.join('\n'));
  }
  form.addEventListener('input', () => { requestId = crypto.randomUUID(); updateWhatsApp(); });
  whatsapp.addEventListener('click', updateWhatsApp);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const endpoint = window.RITO_LEADS?.endpoint;
    if (!endpoint) {
      status.textContent = 'O envio por e-mail está em preparação. Continue pelo WhatsApp com as informações que você preencheu.';
      updateWhatsApp();
      return;
    }
    busy = true; button.disabled = true; button.textContent = 'Enviando seu pedido…'; status.textContent = '';
    try {
      const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload()), signal:AbortSignal.timeout(20000)});
      const result = await response.json();
      if (!response.ok || result.ok !== true || !result.id) throw new Error('Submission failed');
      try { sessionStorage.setItem('rito-lead-success', JSON.stringify({id:result.id, at:Date.now(), source:location.pathname})); } catch (_) {}
      location.assign('/obrigado/');
    } catch (_) {
      status.textContent = 'Não conseguimos confirmar o envio. Seus dados continuam aqui: tente novamente ou envie pelo WhatsApp.';
      updateWhatsApp();
    } finally { busy = false; button.disabled = false; button.textContent = 'Quero receber um contato'; }
  });
})();
