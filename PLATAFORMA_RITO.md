# Plataforma RITO — contexto de continuidade

Última atualização: 1º de novembro de 2026.

Este documento reúne o contexto funcional e técnico necessário para continuar o desenvolvimento da plataforma RITO em uma nova conversa. Antes de alterar o projeto, leia este arquivo e confirme o comportamento atual diretamente no código. O código e as migrations são a fonte definitiva para detalhes de implementação.

## 1. Objetivo da plataforma

A plataforma centraliza a gestão da operação da RITO Café:

- pedidos e acompanhamento da produção;
- produtos, formas de pagamento e estoque;
- agenda operacional e eventos;
- financeiro e fluxo de caixa;
- CRM comercial;
- workshops, inscrições e checklists;
- autoatendimento do cliente por QR Code.

A interface possui visões administrativa e operacional. O projeto prioriza uso em celular durante a operação, mas também deve funcionar bem em desktop.

## 2. Ambiente e endereços

- Produção: <https://ritocafe.shop/>
- Pedidos pelo cliente: <https://ritocafe.shop/pedir/>
- Lista pública de workshops: <https://ritocafe.shop/workshop/>
- Edição atual do workshop: <https://ritocafe.shop/workshop/edicaosp-1/>
- Repositório: `giovanneferrari/codex_gio`
- Branch de produção: `main`
- Diretório local: `/Users/matheusfiore/Documents/GitHub/codex_gio`
- Backend: Supabase, projeto `wmsrwvlhivuycqmzjeea`
- Hospedagem: GitHub Pages com domínio personalizado.

Não registrar senhas, chaves privadas ou service-role keys neste arquivo. A chave pública do Supabase já está no frontend por ser própria para uso no navegador; a segurança depende das políticas RLS e das funções RPC.

## 3. Tecnologias e arquitetura

- Frontend estático em HTML, CSS e JavaScript puro.
- Supabase para autenticação, Postgres, RLS, RPC e Realtime.
- GitHub Actions para montagem e publicação no GitHub Pages.
- Google Places/Maps configurado por segredo no GitHub Actions.
- Sem framework de build no frontend principal.

Arquivos centrais:

- `index.html`: estrutura principal do sistema administrativo e operacional.
- `app.js`: estado, carregamento do Supabase e regras principais.
- `styles.css`: estilos gerais.
- `public-order-admin.js`: configuração administrativa do autoatendimento.
- `event-financials.js` e `event-financials.css`: fechamento e resumo financeiro por evento.
- `workshop-admin.js` e `workshop-admin.css`: gestão de workshops.
- `pedir/`: interface pública de pedidos.
- `workshop/`: páginas públicas de workshops e edições.
- `supabase/migrations/`: histórico completo do banco.
- `.github/workflows/deploy-pages.yml`: publicação em produção.

## 4. Publicação

O push para `main` dispara o workflow **Publicar no GitHub Pages**. O workflow cria `_site`, copia os arquivos permitidos e publica no Pages.

Ao adicionar um novo arquivo na raiz que precise chegar à produção, também é necessário incluí-lo no comando `cp` do workflow. Diretórios como `pedir/`, `workshop/`, `assets/` e `rev2/` já são copiados integralmente.

Fluxo recomendado:

1. Alterar somente arquivos relacionados à tarefa.
2. Executar `node --check` nos JavaScript alterados.
3. Executar `git diff --check`.
4. Revisar alterações e preservar arquivos não relacionados do usuário.
5. Commitar e enviar para `main`.
6. Confirmar a conclusão do GitHub Actions.
7. Verificar os arquivos publicados em `ritocafe.shop`.
8. Atualizar versões de query string (`?v=`) quando houver risco de cache no celular.

## 5. Migrations

As migrations são aplicadas manualmente no SQL Editor do Supabase, na ordem cronológica dos nomes. Antes de publicar uma interface que dependa de uma migration, criar fallback quando possível.

Migrations mais recentes e relevantes:

- `20261020120000_commercial_crm.sql`: CRM e ligação com agenda/eventos.
- `20261027180000_workshops.sql`: workshops e inscrições.
- `20261028120000_close_past_workshops.sql`: encerramento de edições passadas.
- `20261028123000_workshop_availability.sql`: disponibilidade e vagas.
- `20261029100000_workshop_event_management.sql`: gestão das edições.
- `20261029143000_workshop_checklists.sql`: checklists persistentes.
- `20261101100000_realtime_orders.sql`: pedidos em tempo real entre dispositivos.
- `20261101170000_public_ordering.sql`: pedidos públicos por QR Code.
- `20261101193000_public_payments_event_financials.sql`: formas de pagamento públicas e resultado financeiro detalhado por evento.

Todas as migrations listadas acima estavam aplicadas em produção na última atualização deste documento.

## 6. Autenticação e perfis

- A aplicação usa Supabase Auth.
- Há perfis administrativos e operacionais.
- Operações sensíveis devem permanecer protegidas por RLS, `auth.uid()` e/ou verificação administrativa.
- A página pública `/pedir/` usa somente RPCs `security definer` com validação no servidor.
- Nunca confiar em preços ou totais enviados pelo navegador.

## 7. Pedidos internos

O módulo de pedidos oferece:

- Kanban e visualização em cards;
- etapas `A fazer`, `Em preparo` e `Finalizado`;
- filtros por período, status, pagamento e produto;
- atualização simultânea entre dispositivos por Supabase Realtime;
- polling de segurança quando a aba está visível;
- identificação de pedidos originados pelo QR Code;
- observação do cliente no card;
- interface móvel com pagamento e status em linhas separadas.

Os pedidos vinculados a um evento ativo recebem automaticamente `operation_mode = event` e o `event_id` correspondente.

## 8. Pedidos públicos por QR Code

URL: `/pedir/`.

Fluxo atual:

1. O cliente acessa o QR Code.
2. Visualiza produtos ativos.
3. O catálogo é apresentado em três grupos visuais:
   - bebidas quentes;
   - bebidas geladas;
   - comidas.
4. Adiciona produtos e acompanha quantidade e total.
5. Toca na barra inferior para abrir o carrinho.
6. Pode aumentar, reduzir ou excluir produtos.
7. Informa nome e observação opcional.
8. Escolhe uma das formas de pagamento ativas cadastradas no sistema.
9. Envia o pedido.
10. Acompanha o status até a finalização.

Regras importantes:

- O servidor recalcula preços usando a tabela `products`.
- Há limite de quantidade e rate limit por navegador.
- `request_key` evita pedidos duplicados.
- O cliente recebe um token público próprio para consultar somente o status daquele pedido.
- Formas de pagamento vêm de `payment_methods`.
- Pix só aparece se existir uma forma de pagamento com “Pix” no nome e o campo de Pix estiver preenchido em **Pedidos → QR / Autoatendimento**.
- O campo Pix aceita link ou código Copia e Cola.
- Após um pedido Pix válido, a confirmação exibe o conteúdo cadastrado (link ou código) como texto selecionável, com o botão “Copiar Pix” abaixo. O texto visível corresponde ao conteúdo copiado.
- A seleção de pagamento usa botões visuais e precisa manter `type="button"` para não enviar o formulário prematuramente.
- Depois de alterar estilos ou comportamento, renovar as versões de `cart.css` e `order.js` em `pedir/index.html`.

Configuração administrativa em `public-order-admin.js`:

- ativar/desativar pedidos;
- nome exibido;
- texto de apresentação;
- link ou código Pix;
- copiar link público;
- gerar e baixar QR Code.

RPCs relevantes:

- `get_public_ordering_catalog()`;
- `create_public_order_v2(...)`;
- `get_public_order_status(uuid)`.

## 9. Produtos e formas de pagamento

- Produtos ativos vêm de `products`.
- Formas ativas vêm de `payment_methods`.
- Cadastro e edição são feitos em Configurações.
- A interface do cliente deve refletir as mesmas opções do barista.
- A classificação em quente, gelada e comida é somente visual na página pública; não altera a categoria armazenada.
- Nomes contendo “gelado”, “iced”, “tônica”, “orange”, “sunset” ou “cold” são tratados como gelados.
- Doces, cookies, bolos, salgados e acompanhamentos são apresentados como comidas.

## 10. Agenda e eventos

A Agenda permite:

- compromissos previstos e confirmados;
- tipos Evento, Feira, Carrinho na rua, Dia operacional e Outro;
- operadores escalados;
- horários, local e observações;
- modelos de cobrança:
  - por consumo;
  - valor fechado;
  - por pessoa;
- iniciar um evento confirmado;
- vincular pedidos ao evento ativo;
- encerrar o evento;
- duplicar um compromisso;
- excluir conforme regras do ciclo de vida.

Somente um evento pode estar ativo por vez.

## 11. Resultado financeiro por evento

Implementado em `event-financials.js`, `event-financials.css` e na migration `20261101193000_public_payments_event_financials.sql`.

No encerramento:

- a receita de pedidos finalizados é apurada automaticamente;
- o contrato é incluído conforme o modelo de cobrança;
- as despesas são preenchidas em linhas com descrição e valor;
- produtos servidos conciliam estoque;
- são registrados faturamento, despesas e lucro;
- os lançamentos também alimentam o Financeiro;
- despesas usam `financial_entries.related_event_id` para permitir várias linhas sem quebrar a receita única em `event_id`.

Na edição de um compromisso iniciado ou encerrado, o resumo apresenta:

- faturamento;
- despesas;
- lucro;
- quantidade de pedidos;
- linhas de receita e despesas;
- situação “Em andamento” ou “Fechado”.

Tabelas/campos relevantes:

- `operation_events`;
- `operation_event_expenses`;
- `financial_entries.event_id` para a receita principal;
- `financial_entries.related_event_id` para despesas detalhadas;
- `orders.event_id` para pedidos associados.

RPC de encerramento atual: `close_schedule_operation_v3(...)`.

Existe fallback para `close_schedule_operation_v2(...)`, mas a v3 deve ser considerada a implementação vigente.

## 12. Financeiro e estoque

O sistema possui:

- receitas e despesas;
- fluxo de caixa;
- contas financeiras e cartões;
- datas de competência, vencimento e liquidação;
- lançamentos recorrentes;
- estoque e movimentações;
- receitas de produtos e consumo automático;
- ajustes e perdas;
- conciliação de diferenças no encerramento de eventos.

Ao modificar eventos, preservar a integração com `financial_entries`, `inventory_movements`, `product_recipes` e `operation_event_items`.

## 13. CRM comercial

O CRM permite:

- cadastrar prospectos;
- pipeline por etapa;
- busca e filtros;
- visualização em pipeline e lista;
- receita gerada e quantidade de eventos;
- endereço com Google Places;
- abertura do endereço no mapa;
- observações padronizadas;
- ligação do prospecto aos compromissos da Agenda;
- evolução automática para cliente conforme eventos;
- exclusão ou descarte de leads sem interesse.

Os big numbers devem respeitar os mesmos filtros aplicados à busca e ao funil.

## 14. Workshops

Rotas públicas:

- `/workshop/`: cards das edições;
- `/workshop/<slug>/`: formulário de uma edição.

Recursos públicos:

- nome completo;
- WhatsApp;
- restrição alimentar;
- aviso de pagamento no dia;
- confirmação e tela de sucesso;
- barra de ocupação e urgência quando restarem cinco vagas ou menos;
- edições futuras primeiro;
- máscara “Evento finalizado” em edições passadas.

Gestão administrativa:

- criar e editar eventos;
- definir capacidade;
- ampliar capacidade e indicar novo lote;
- enviar arte de capa;
- listar, editar e excluir inscrições;
- big numbers horizontais;
- checklist persistente por evento;
- criar, editar, excluir, concluir e duplicar itens para outra edição.

## 15. Realtime

Pedidos devem aparecer nos dispositivos conectados sem atualizar a página.

Implementação:

- subscriptions para `orders` e `order_items`;
- recarga controlada por debounce;
- polling periódico como contingência;
- sincronização ao voltar o foco ou reabrir a aba.

Ao alterar essa parte, evitar múltiplos canais e intervalos concorrentes.

## 16. Google Places

- A chave é injetada no deploy pelo segredo/variável `GOOGLE_MAPS_API_KEY`.
- O workflow gera `google-maps-config.js` dentro de `_site`.
- O objetivo atual é autocomplete de endereço; mapa incorporado não é obrigatório.
- Restringir a chave aos domínios de produção e às APIs realmente usadas.

## 17. Princípios de interface

- Manter a identidade visual atual da RITO.
- Priorizar legibilidade em smartphone.
- Campos e filtros devem seguir o mesmo sistema visual.
- Evitar cards transbordando com textos longos.
- Big numbers devem ser horizontais quando possível para reduzir rolagem.
- Ações destrutivas precisam de confirmação.
- Estados selecionados precisam de retorno visual evidente.
- Não reconstruir módulos inteiros para pequenos ajustes.
- Preservar interfaces já aprovadas quando a solicitação for localizada.

## 18. Cuidados conhecidos

- O frontend usa arquivos estáticos e o cache do celular pode manter versões antigas. Sempre avaliar atualização de `?v=`.
- `index.html` e alguns JavaScript estão compactos; fazer alterações pontuais com cuidado.
- Não editar nem adicionar ao commit arquivos não relacionados que já estejam no diretório.
- Ao criar arquivos raiz novos, atualizar o workflow de deploy.
- Aplicar migrations antes de remover fallbacks.
- Confirmar RPCs públicos com a chave anônima sem criar registros reais.
- Não expor o código Pix no catálogo; ele só deve ser devolvido após um pedido Pix válido.
- Não permitir que o navegador determine preço, total ou vínculo com evento.

## 19. Estado validado na última atualização

- `/pedir/` publicado e ativo.
- Catálogo público retornando produtos e formas Crédito, Débito e Pix.
- Pix oculto porque o campo “Link ou código Pix fixo” estava vazio na última verificação.
- `create_public_order_v2` instalada.
- `operation_event_expenses` instalada.
- `close_schedule_operation_v3` instalada e restrita a usuários autenticados.
- Seleção visual de pagamento corrigida e publicada com:
  - `cart.css?v=2`;
  - `order.js?v=4`.
- Ajuste local posterior: confirmação Pix exibe texto e botão de copiar abaixo; versões `cart.css?v=3` e `order.js?v=5`. Publicação ainda pendente.
- Último commit conhecido na criação deste documento: `a65ab24f`.

## 20. Como iniciar uma nova conversa

Mensagem recomendada:

> Leia integralmente o arquivo `/Users/matheusfiore/Documents/GitHub/codex_gio/PLATAFORMA_RITO.md`, inspecione os arquivos relacionados à tarefa e continue a plataforma a partir do estado documentado. Preserve funcionalidades e alterações não relacionadas.

Depois, descreva apenas a mudança desejada, a página afetada, o comportamento atual e o comportamento esperado.

