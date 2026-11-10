# RITO v3 — demonstração para validação

Publicação: o fluxo existente do GitHub Pages copia os HTML, CSS e JS desta pasta para `/v3/`. O sistema da raiz não é substituído.

## Rotas após a publicação

- `/v3/`: pedidos responsivos; no celular abre diretamente a visão mobile.
- `/v3/celular.html`: moldura de celular para comparação no computador.
- `/v3/resumo-evento.html`: resumo administrativo com exemplos independentes de venda e parceria.

## Limites importantes

Esta é uma demonstração pública com dados fictícios. Não é um ambiente autenticado de homologação. `noindex` pede aos buscadores que não indexem, mas não restringe acesso.

Não usa Supabase, não lê nem grava pedidos reais, não movimenta estoque e não envia mensagens ou cobranças. As interações ficam em memória e reiniciam ao recarregar. O resumo usa exemplos próprios; não é calculado a partir dos pedidos criados na demonstração.

Apenas a configuração de parceria para novos pedidos está simulada. Integração com estoque, cadastros reais, lançamentos de fechamento, custo histórico e demais regras de produção exigem implementação e validação antes de substituir o sistema atual.

Recursos externos: fonte do Google Fonts. A identidade usa o monograma já publicado em `/assets/rito-monograma.png`.

## Verificação

`node --test tests/v3-preview.test.cjs preview-pedidos/resumo-model.test.cjs`

O commit não publica por si só. O envio à branch main dispara o fluxo que também inclui `/v3/` no site.
