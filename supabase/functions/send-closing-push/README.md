# Notificações Web Push do fechamento

1. Execute a migration `20260906160000_web_push_subscriptions.sql` no SQL Editor.
2. Gere um par VAPID:

   ```bash
   npx web-push generate-vapid-keys
   ```

3. Cadastre as chaves como secrets do projeto:

   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY="CHAVE_PUBLICA" VAPID_PRIVATE_KEY="CHAVE_PRIVADA" VAPID_SUBJECT="mailto:ritocoffeeSP@gmail.com"
   ```

4. Publique as funções:

   ```bash
   npx supabase functions deploy push-config
   npx supabase functions deploy send-closing-push
   ```

5. No sistema, acesse **Configurações → Notificações do fechamento** e ative cada dispositivo que deverá receber os resumos.

No iPhone, Web Push exige que o site esteja instalado na tela inicial como PWA. A permissão só deve ser solicitada após o toque no botão de ativação.
