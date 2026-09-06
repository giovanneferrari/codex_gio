const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  if (!publicKey) return new Response(JSON.stringify({ error: 'VAPID não configurado.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ publicKey }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
