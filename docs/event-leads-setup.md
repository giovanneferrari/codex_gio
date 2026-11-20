# Formulário de interesse — Rito

Destinatário: giovanne@ritocafe.shop. Implementação preparada; envio desativado até configurar o provedor e testar. GitHub Pages publica apenas o site; não publica a função Supabase.

## Ativação

1. No Resend, verificar o domínio remetente com os registros DNS solicitados. Preservar os registros MX do e-mail atual. Criar uma chave restrita a envio.
2. No painel Supabase do projeto existente, cadastrar como secrets: `RESEND_API_KEY`, `LEAD_FROM_EMAIL` (endereço do domínio verificado, por exemplo `Rito Café <propostas@ritocafe.shop>`), `LEAD_RECIPIENT_EMAIL` (`giovanne@ritocafe.shop`). Não salvar a chave em arquivos públicos nem no Git.
3. Publicar `supabase/functions/event-lead/index.ts` como Edge Function `event-lead`, sem exigência de JWT, pois recebe visitantes anônimos. Configuração em `supabase/config.toml`.
4. Alterar `eventos-proposta/lead-config.js` para endpoint `https://wmsrwvlhivuycqmzjeea.supabase.co/functions/v1/event-lead`. Executar `python3 tools/sync_eventos.py`.
5. Testar um envio real em cada página: confirmar recebimento na caixa e responder ao endereço do visitante. Testar falha de rede: dados devem permanecer no formulário, sem redirecionamento. Confirmar resumo com 10/20/40/100 pessoas e cookies.
6. Publicar o site pelo fluxo GitHub Pages existente.

O servidor recalcula os valores; nunca aceita o preço vindo do navegador. Usa chave de idempotência para retentativas, campo antispam e limitação por IP por instância (não é limite global). Antes de campanhas com tráfego alto, configurar quotas/alertas no provedor e proteção antispam adicional se necessário. Aceitação pelo Resend não garante chegada à caixa de entrada; validar entrega real antes de ativar a campanha.

## Google Ads

URL de sucesso planejada: `https://ritocafe.shop/obrigado/`. Não informar como pronta antes da publicação e teste de envio.

Instalar a tag real fornecida pelo Google Ads nas duas páginas de entrada e na página de agradecimento. Para a opção por URL, criar uma conversão com caminho exato `/obrigado/` e contagem “Uma”. Não instalar também outro disparo para a mesma conversão por envio de formulário. O WhatsApp deve ser uma conversão separada de clique, pois não confirma conversa iniciada.

Nenhuma tag fictícia foi adicionada. Precisamos do ID da tag do Google (AW-… ou GTM-…) e, se a configuração for por evento, do rótulo de conversão. A página pública de agradecimento pode ser acessada diretamente: medição por URL tem essa limitação. Para maior precisão, usar evento confirmado pelo servidor com deduplicação, em vez de combinar evento e visita à página.

O formulário não envia nome, e-mail ou telefone para URLs nem para eventos de publicidade. Não há armazenamento de leads no banco nesta implementação: o destino é a caixa de e-mail. Não coleta identificadores de campanha nem ativa conversões otimizadas automaticamente.
