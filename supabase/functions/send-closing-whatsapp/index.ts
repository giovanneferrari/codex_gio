import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const brl = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    if (request.headers.get('x-webhook-secret') !== required('CLOSING_WEBHOOK_SECRET')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = await request.json()
    const closingDate = payload?.record?.closing_date
    if (!closingDate) return new Response('Closing date not found', { status: 400 })

    const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'))
    const start = new Date(`${closingDate}T03:00:00.000Z`)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)

    const [ordersResult, financeResult, stockResult] = await Promise.all([
      supabase.from('orders').select('confirmed_total,order_items(product_name,quantity)')
        .eq('status', 'Finalizado').gte('ordered_at', start.toISOString()).lt('ordered_at', end.toISOString()),
      supabase.from('financial_entries').select('entry_type,amount').eq('occurred_on', closingDate),
      supabase.from('inventory_items').select('name,quantity_on_hand,unit').eq('active', true).order('name'),
    ])
    const queryError = ordersResult.error || financeResult.error || stockResult.error
    if (queryError) throw queryError

    const orders = ordersResult.data || []
    const finance = financeResult.data || []
    const orderRevenue = orders.reduce((sum, order) => sum + Number(order.confirmed_total || 0), 0)
    const otherIncome = finance.filter((entry) => entry.entry_type === 'income').reduce((sum, entry) => sum + Number(entry.amount), 0)
    const expenses = finance.filter((entry) => entry.entry_type === 'expense').reduce((sum, entry) => sum + Number(entry.amount), 0)
    const revenue = orderRevenue + otherIncome
    const stock = (stockResult.data || []).map((item) => `${item.name}: ${Math.round(Number(item.quantity_on_hand))} ${item.unit}`).join(' | ') || 'Sem insumos cadastrados'

    const graphVersion = required('WHATSAPP_GRAPH_VERSION')
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${required('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${required('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: required('WHATSAPP_TO'),
        type: 'template',
        template: {
          name: required('WHATSAPP_TEMPLATE_NAME'),
          language: { code: Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'pt_BR' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: new Date(`${closingDate}T12:00:00`).toLocaleDateString('pt-BR') },
              { type: 'text', text: brl(revenue) },
              { type: 'text', text: brl(expenses) },
              { type: 'text', text: brl(revenue - expenses) },
              { type: 'text', text: String(orders.length) },
              { type: 'text', text: stock.slice(0, 900) },
            ],
          }],
        },
      }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(JSON.stringify(result))
    return Response.json({ sent: true, result })
  } catch (error) {
    console.error(error)
    return Response.json({ sent: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})
