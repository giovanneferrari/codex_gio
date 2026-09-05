# RITO — Gestão da cafeteria

Dashboard responsivo e instalável para acompanhar operação, estoque e finanças da RITO.

## Instalar como aplicativo

- **iPhone/iPad:** abra `https://ritocafe.shop` no Safari, toque em **Compartilhar** e selecione **Adicionar à Tela de Início**.
- **Android/desktop:** abra o site em um navegador compatível e escolha **Instalar RITO** no menu ou na barra de endereço.
- A interface pode abrir a partir do cache sem conexão, mas alterações em pedidos, estoque e financeiro exigem internet para sincronizar com o Supabase.

## Executar localmente

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

## Backend e acesso

O login usa o Supabase Auth, e os produtos, formas de pagamento, pedidos e perfis
são persistidos no banco compartilhado. Use o usuário criado no painel do Supabase.

Depois da migration inicial, execute também
`supabase/migrations/20260830223000_app_functions.sql` no SQL Editor. Essa etapa
habilita o salvamento atômico dos pedidos e a atualização segura do perfil.

### Gestão de usuários

A criação, edição e exclusão de acessos usa a Edge Function protegida
`supabase/functions/manage-users/index.ts`. Publique-a com uma sessão autenticada
no Supabase CLI:

```bash
npx supabase login
npx supabase functions deploy manage-users --project-ref wmsrwvlhivuycqmzjeea
```

A função exige o JWT do usuário conectado, confirma no banco que ele é
administrador e mantém as credenciais privilegiadas somente no Supabase.

## Publicação no GitHub Pages

O projeto inclui uma automação em `.github/workflows/deploy-pages.yml`. A cada envio para as branches `main` ou `work`, o GitHub Actions publica a versão mais recente automaticamente.

Depois de enviar este repositório ao GitHub:

1. acesse **Settings → Pages** no repositório;
2. em **Build and deployment → Source**, selecione **GitHub Actions**;
3. abra a aba **Actions** e aguarde a execução “Publicar no GitHub Pages” terminar;
4. use a URL pública exibida no resumo da execução, no formato:

   ```text
   https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
   ```

Essa URL funciona em qualquer navegador e aparelho com acesso à internet. Não é necessário manter um computador ou servidor local ligado.

## Recursos

- login inicial para acesso ao sistema;
- dashboard com faturamento, pedidos, ticket médio, custo e filtros por período;
- indicadores financeiros calculados exclusivamente com pedidos finalizados;
- receita líquida calculada como 60% do faturamento finalizado;
- big numbers interativos que alternam a métrica do gráfico;
- gráfico com agrupamento diário ou mensal;
- gráficos de faturamento e formas de pagamento;
- criação de pedidos por meio de um cardápio digital;
- confirmação editável do valor e seleção da forma de pagamento;
- Kanban com pedidos a fazer, em preparo e finalizados;
- status inicial configurável no lançamento;
- central de pedidos com busca, filtros e exclusão;
- perfil compartilhado com nome editável, e-mail bloqueado e alteração de senha;
- seleção pós-login entre ambiente administrativo e operacional;
- alternância de ambiente pelo rodapé da navegação;
- edição de pedidos a partir do Kanban e dos últimos lançamentos;
- filtro personalizado por dia ou intervalo de datas;
- fechamento do editor de pedidos pelo fundo externo, retornando ao Kanban;
- configurações para criar, editar e excluir produtos do cardápio;
- configurações para criar, editar e excluir formas de pagamento;
- formas de pagamento configuráveis refletidas no dashboard;
- preço e nome do produto preservados no pedido no momento da venda;
- histórico de pedidos com filtros Hoje, 7 dias, mês, tudo e período personalizado;
- criação, edição e exclusão segura de usuários administrativos e operacionais;
- pedidos com data e hora editáveis para lançamentos retroativos;
- horário preenchido com o minuto atual e livremente editável;
- Kanban com altura estável e rolagem independente por coluna;
- monograma RITO aplicado como ícone do site;
- perfil fechado sem salvar ao clicar no fundo externo;
- exclusão disponível diretamente na edição de pedidos;
- modais de configuração fechados ao clicar no fundo externo;
- pedidos persistidos no Supabase e sincronizados em tempo real entre dispositivos;
- layout adaptado para desktop, tablet e celular.
