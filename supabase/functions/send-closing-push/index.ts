import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: request.headers.get('Authorization') || '' } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { date } = await request.json();
    const day = String(date || new Date().toISOString().slice(0, 10));
    const start = `${day}T00:00:00-03:00`, end = `${day}T23:59:59-03:00`;
    const db = createClient(url, service);
    const [ordersResult, financeResult, stockResult, subscriptionsResult] = await Promise.all([
      db.from('orders').select('confirmed_total,order_items(product_name,quantity)').eq('status', 'Finalizado').gte('ordered_at', start).lte('ordered_at', end),
      db.from('financial_entries').select('entry_type,amount').eq('occurred_on', day),
      db.from('inventory_items').select('name,quantity_on_hand,unit').eq('active', true).order('name'),
      db.from('push_subscriptions').select('*'),
    ]);
    const orders = ordersResult.data || [], finance = financeResult.data || [], stock = stockResult.data || [];
    const revenue = orders.reduce((sum, order) => sum + Number(order.confirmed_total || 0), 0) + finance.filter(item => item.entry_type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = finance.filter(item => item.entry_type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const products = new Map<string, number>();
    orders.flatMap(order => order.order_items || []).forEach((item: { product_name: string; quantity: number }) => products.set(item.product_name, (products.get(item.product_name) || 0) + Number(item.quantity)));
    const productText = [...products.entries()].map(([name, quantity]) => `${quantity}× ${name}`).join(' · ') || 'Nenhum produto';
    const stockText = stock.slice(0, 5).map(item => `${item.name}: ${Math.round(Number(item.quantity_on_hand))} ${item.unit}`).join(' · ');
    const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const payload = JSON.stringify({ title: 'Fechamento RITO', body: `Receitas ${brl(revenue)} · Despesas ${brl(expenses)} · Saldo ${brl(revenue - expenses)}\n${orders.length} pedidos · ${productText}\nEstoque: ${stockText || 'sem insumos'}`, data: { url: './?view=pedidos' } });

    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@ritocafe.shop', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
    const expired: string[] = [];
    let sent = 0;
    const failures: Array<{ status: number; reason: string }> = [];
    await Promise.all((subscriptionsResult.data || []).map(async subscription => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
        sent += 1;
      } catch (error: any) {
        const status = Number(error?.statusCode || 500);
        if ([404, 410].includes(status)) expired.push(subscription.endpoint);
        failures.push({ status, reason: String(error?.body || error?.message || 'Falha desconhecida').slice(0, 240) });
        console.error('Web Push rejeitado', { status, body: error?.body, endpointHost: new URL(subscription.endpoint).hostname });
      }
    }));
    if (expired.length) await db.from('push_subscriptions').delete().in('endpoint', expired);
    return new Response(JSON.stringify({ attempted: (subscriptionsResult.data || []).length, sent, failed: failures.length, failures }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
