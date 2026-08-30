# RITO — Gestão da cafeteria

Dashboard responsivo e instalável para acompanhar operação, estoque e finanças da RITO.

## Executar localmente

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

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

- visão geral com receita, pedidos, ticket médio e custos;
- acompanhamento semanal de receita;
- estoque com alertas e atualização rápida;
- pedidos recentes com mudança de status;
- projeção financeira e composição dos custos;
- dados persistidos no navegador (`localStorage`);
- layout adaptado para desktop, tablet e celular.
