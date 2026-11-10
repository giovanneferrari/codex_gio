# V3 real — Pedidos e diário Comercial

## Arquitetura

`node v3/build.cjs` gera `v3/index.html` localmente. No deploy, `node v3/build.cjs _site/v3` gera a mesma entrada publicada.

A entrada deriva do index principal a cada build e carrega os mesmos app.js, módulos, cliente Supabase e sessão. live.js altera apenas a apresentação de Pedidos, chama as funções existentes para abrir/salvar/alterar etapa e usa os dados já carregados. Não cria outro banco, tabela de pedidos, serviço de replicação ou lógica de baixa de estoque.

- `/`: interface atual preservada.
- `/v3/`: interface nova de Pedidos com dados e efeitos reais; demais módulos atuais.
- `/v3/demo/`: protótipo fictício, reiniciado ao recarregar.
- `/v3/demo/resumo-evento.html`: exemplos independentes de resumo; NÃO é relatório real.

## Limites desta entrega

O Comercial das duas interfaces inclui a opção Diário. A migration `20261110190000_commercial_diary.sql` cria histórico individual, restrito a administradores, sem transformar observações antigas em contatos fictícios. A gravação e a atualização opcional da próxima ação são atômicas. O mesmo identificador de requisição impede duplicações por repetição. Clientes com histórico não podem ser excluídos fisicamente: use os status de stand-by para preservar seus registros. Histórico recarrega em Atualizar e ao retornar à janela; não há importação automática de mensagens do WhatsApp.

Validação do banco: executar `tests/commercial-diary.sql` no SQL Editor. O teste usa uma transação revertida ao final; verifica gravação, repetição, preservação do contexto, falha atômica, bloqueio anônimo e configuração de permissões. Não substitui teste visual com usuário real.

Não há migration nem nova regra financeira. Mantidos os modelos de cobrança existentes. Parceria automática e resumo financeiro novos permanecem apenas na demo. Mantida também a confirmação de finalização existente, quando aplicável, para não mudar regras operacionais nesta migração.

Sincronização usa o Realtime e polling de 5 segundos já presentes no app; depende da conexão e da aba ativa. Atualizar a página força a recarga. Duas interfaces não significam duas baixas: ambas alteram a mesma linha de pedido; a aplicação do estoque continua no backend existente. Isso precisa ser confirmado no piloto real, não apenas nos testes locais.

O backend existente não foi redesenhado para edição simultânea. Evitar editar o mesmo pedido em duas telas ao mesmo tempo. A v3 atualiza o estado antes de avançar o card, mas isso não substitui um controle de concorrência transacional no servidor.

## Validação antes de liberar à equipe

1. Entrar nas duas versões com perfis reais autorizados (incluindo operador).
2. Comparar IDs/números, valores, itens, período e evento dos mesmos pedidos.
3. Criar um pedido legítimo pela v3 e conferir na raiz; fazer o inverso.
4. Avançar para Em preparo, retornar e verificar ambas as interfaces.
5. Em uma entrega real, finalizar uma vez e conferir a movimentação de estoque e forma de pagamento nas duas versões.
6. Testar reconexão, atualização e formulário com teclado no iPhone.
7. Conferir o link Voltar à versão atual.

Não criar pedidos fictícios em produção para provar a integração sem autorização específica e plano de limpeza. A preparação automatizada não fez gravações no banco.

## Rollback

Voltar a usar `/` imediatamente; pedidos reais permanecem acessíveis. Para desativar a v3 publicamente, substituir sua entrada por um link/redirect à raiz em um commit separado. Não reverter migrations nem apagar pedidos: rollback visual NÃO desfaz dados.

## Testes

`node --test tests/v3-live.test.cjs tests/v3-preview.test.cjs tests/workflow-updates.test.cjs preview-pedidos/resumo-model.test.cjs`
