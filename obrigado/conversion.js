(() => {
  'use strict';
  const storageKey = 'rito-lead-success';
  let success;
  try {
    success = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
  } catch (_) { return; }

  // This browser marker is created only after the server accepts the submission.
  // It is a client-side guard, not proof signed by the server.
  if (!success || typeof success.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(success.id) ||
      !Number.isFinite(success.at) ||
      !['/eventos/', '/eventos-proposta/'].includes(success.source)) return;
  const age = Date.now() - success.at;
  if (age < 0 || age >= 1800000) return;

  document.querySelector('#success-label').textContent = 'PEDIDO ENVIADO';
  document.querySelector('#success-title').textContent = 'Agora, o próximo passo é com a gente.';
  document.querySelector('#success-copy').textContent = 'Recebemos seu pedido de proposta. Vamos olhar os detalhes e entrar em contato pelo e-mail ou WhatsApp que você informou.';
  document.querySelector('#return-link').href = success.source;

  if (typeof window.gtag !== 'function') return;
  const sentKey = 'rito-ads-conversion:' + success.id;
  try {
    if (sessionStorage.getItem(sentKey)) return;
    // Reserve before queuing, protecting against reloads and repeated execution.
    sessionStorage.setItem(sentKey, 'queued');
  } catch (_) { return; }
  try {
    window.gtag('event', 'conversion', {
      send_to: 'AW-18586754751/LkwMCKCCq7wdEL-97Z5F',
      transaction_id: success.id
    });
  } catch (_) {
    try { sessionStorage.removeItem(sentKey); } catch (_) {}
  }
  // Queuing is not confirmation of delivery to Google (e.g. ad blockers).
})();
