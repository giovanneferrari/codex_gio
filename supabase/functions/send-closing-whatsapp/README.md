# WhatsApp no fechamento diário

A função recebe o webhook de uma nova linha em `stock_closings`, calcula o resumo do dia e envia um template pelo WhatsApp Cloud API.

Secrets necessários no Supabase:

- `CLOSING_WEBHOOK_SECRET`
- `RITO_SUPABASE_SECRET_KEY` (uma Secret key do projeto, nunca a chave pública)
- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TO` (DDI + DDD + número)
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE` (opcional; padrão `pt_BR`)

O template aprovado deve receber, nesta ordem: data, receita, despesas, saldo, pedidos finalizados e resumo do estoque.

Após publicar a função, crie um Database Webhook de `INSERT` na tabela `stock_closings`, apontando para `send-closing-whatsapp`, e envie o mesmo segredo no header `x-webhook-secret`.
