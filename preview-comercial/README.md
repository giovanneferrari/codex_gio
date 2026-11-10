# Diário comercial — proposta local

Abrir `/preview-comercial/` no servidor local. Dados fictícios em memória; recarregar reinicia. Não incluído no deploy, nem conectado ao banco.

## Racional para validar

- Pipeline acompanha a situação atual de cada relacionamento; diário registra cada interação individualmente.
- Cada contato tem data/hora, cliente, pessoa, canal, responsável, conversa e próximo passo opcional.
- Uma linha por cliente, ordenada pela próxima data de retorno (sem data ao final). Ao expandir, todas as trocas aparecem com data/hora, mais recentes primeiro. Busca e canal selecionam clientes, sem ocultar trocas do histórico expandido. No celular, cada linha reorganiza os campos sem rolagem horizontal.
- Observações existentes continuam como contexto geral do cliente. Não dividir texto antigo artificialmente em contatos nem inventar datas/autores.
- A próxima ação atual é separada dos combinados históricos. Informar uma nova ação no formulário substitui a atual; deixar vazio preserva a anterior. Não há conclusão de tarefas nesta prévia.

## Antes da integração real

Validar a proposta visual. Depois criar tabela de interações ligada ao prospecto, com autor autenticado, data do contato e data de criação separadas. Aplicar acesso restrito ao Comercial/admin e regras no banco; não confiar apenas em ocultar a tela. Integrar o diário global e o histórico filtrado dentro do cliente às duas interfaces. Registrar contato não altera etapa automaticamente. Definir explicitamente quando atualizar a próxima ação atual do cliente, preservando o combinado histórico da interação.

Publicar junto com a entrega aprovada da V3, após validar leitura/gravação e permissões. Esta prévia não implementa armazenamento real nem substitui o Comercial atual.
