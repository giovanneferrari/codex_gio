# Ativação de operações simultâneas

1. Executar `supabase/migrations/20261116170000_parallel_operations.sql` no SQL Editor antes de publicar os arquivos. É uma transação; em caso de erro, não publicar.
2. Publicar os arquivos da aplicação e a V3.
3. Em Configurações > Operadores, vincular cada cadastro ao login correspondente. Não usar um login compartilhado entre pessoas.
4. Na agenda, selecionar os operadores de cada evento, confirmar e iniciar os eventos como administrador.
5. O operador com uma escala ativa entra nessa fila; com duas, escolhe no filtro Evento em operação. Administrador pode selecionar Todos os eventos para acompanhar, mas deve escolher um evento para criar pedidos.
6. O filtro Operador usa o autor original. Editar ou finalizar não altera o autor. Pedidos de autoatendimento têm origem própria e aparecem em Todos os operadores.
7. Para cada local, selecionar o evento e abrir Autoatendimento para copiar seu link e baixar seu QR Code. Links genéricos antigos não escolhem um evento quando há mais de um ativo.

## Validação após a migration

Usar dois eventos de teste, dois logins e um pedido em cada evento. Conferir evento e autor; trocar filtros; editar/finalizar com outro login e verificar autoria preservada. Conferir QR de cada evento e rejeição de link de evento encerrado. Fechar um evento e conferir que o outro segue ativo e mantém seus pedidos. Dados de teste no banco não são criados pelos testes locais.

## Limites desta etapa

Estoque, catálogo, preços e configuração geral de autoatendimento continuam compartilhados. O desligamento global de autoatendimento afeta os dois locais. Não há estoque físico por unidade. A separação dos pedidos é de interface e vínculo contábil; não altera integralmente as políticas de acesso existentes. As migrations e os fluxos autenticados precisam ser validados no Supabase; os testes locais cobrem seleção de filas e geração da V3.
