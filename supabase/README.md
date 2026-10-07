# Backend (Supabase) — como ligar

O site funciona em dois modos:

| Modo | Quando | Dados |
| --- | --- | --- |
| **Demonstração** | `supabaseUrl` e `supabaseAnonKey` vazios em `js/config.js` (padrão) | Exemplos, salvos só no navegador |
| **Produção** | As duas chaves preenchidas | Login real e dados no Supabase, compartilhados entre aluno e coach |

## Passo a passo (cerca de 10 minutos)

1. **Criar o projeto**
   - Entre em [supabase.com](https://supabase.com), crie uma conta e clique em **New project**.
   - Escolha um nome (ex.: `sidnei-coach`), uma senha para o banco e a região **South America (São Paulo)**.

2. **Criar as tabelas e as regras de segurança**
   - No projeto, abra **SQL Editor → New query**.
   - Cole o conteúdo inteiro de [`migrations/0001_schema.sql`](migrations/0001_schema.sql) e clique em **Run**.
   - Faça o mesmo, nesta ordem, com [`migrations/0002_student_invites.sql`](migrations/0002_student_invites.sql) (coach cadastra alunos) , [`migrations/0003_messages.sql`](migrations/0003_messages.sql) (chat em tempo real) , [`migrations/0004_default_videos.sql`](migrations/0004_default_videos.sql) (vídeos que já vêm cadastrados, como o do Burpee) , [`migrations/0005_expenses.sql`](migrations/0005_expenses.sql) (despesas do Financeiro), [`migrations/0006_assessment_review.sql`](migrations/0006_assessment_review.sql) (aluno envia fotos, coach avalia), [`migrations/0007_diet.sql`](migrations/0007_diet.sql) (dieta de cada aluno e registro diário de água e refeições), [`migrations/0008_due_day.sql`](migrations/0008_due_day.sql) (vencimento definido pelo coach no cadastro) e [`migrations/0009_plans_billing.sql`](migrations/0009_plans_billing.sql) (planos com preço e mensalidades automáticas).
   - Pode rodar de novo sem problema: os arquivos não apagam nada.

3. **Configurar o login**
   - **Authentication → URL Configuration**:
     - *Site URL*: `https://gusttavo-luiz.github.io/FitCore/`
     - *Redirect URLs*: adicione `https://gusttavo-luiz.github.io/FitCore/index.html`
   - **Authentication → Providers → Email**: deixe ativado. Se *Confirm email* estiver ligado, o aluno precisa clicar no link do e-mail antes do primeiro login (recomendado).
   - **E-mails:** o envio padrão do Supabase serve para testes e manda só poucos e-mails por hora. Para uso real (convites e "esqueci minha senha"), configure um SMTP em **Authentication → Emails → SMTP Settings** (ex.: Resend, Brevo ou o Gmail do Sidnei).

4. **Ligar o site ao Supabase**
   - Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
   - Cole em `js/config.js`:
     ```js
     supabaseUrl: 'https://xxxxxxxx.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...',
     ```
   - A chave *anon* pode ficar pública no site. Quem protege os dados são as regras de acesso (RLS) do passo 2. **Nunca** coloque a chave *service_role* no site.

5. **Tornar o Sidnei coach**
   - O Sidnei cria a conta pelo site (Entrar → Criar conta).
   - No **SQL Editor**, rode (com o e-mail dele):
     ```sql
     update public.profiles set role = 'coach' where email = 'email-do-sidnei@exemplo.com';
     ```

6. **Mensalidades automáticas (opcional, recomendado)**
   - Em **Database → Extensions**, ative a extensão **pg_cron**.
   - Rode de novo [`migrations/0009_plans_billing.sql`](migrations/0009_plans_billing.sql). Ela agenda a geração das mensalidades para todo dia 1º, às 9h (Brasília).
   - Para conferir, rode no SQL Editor: `select jobname, schedule from cron.job;` (deve aparecer `mensalidades-do-mes`).
   - Sem o pg_cron, nada quebra: o coach gera as mensalidades em **Financeiro → Cobranças → Mensalidades em lote**.

7. **Publicar**: envie para a `main`.

## Como os alunos entram

- **Coach cadastra (recomendado):** em **Alunos → Cadastrar aluno**, o coach informa nome, e-mail, plano, objetivo e a data do 1º vencimento. O aluno recebe um e-mail com um link de acesso; ao clicar, entra no site e cria a própria senha. O perfil já nasce com o plano, o objetivo e o dia de vencimento escolhidos, e a 1ª mensalidade é criada com o valor do plano.
- **Aluno se cadastra sozinho:** em **Entrar → Criar conta**. Se o coach já tiver cadastrado aquele e-mail, o perfil também recebe o plano e o objetivo do convite.
- Se o e-mail do convite não sair (ex.: limite de envios), o cadastro fica salvo e o aluno pode usar **Criar conta** com o mesmo e-mail.
- Para mudar **plano, objetivo, status ou dia de vencimento** depois, o coach clica em **Editar** na linha do aluno, na lista de Alunos. Ao mudar o dia, as cobranças em aberto que ainda não venceram passam para o novo dia.

## O que fica no banco

| Tabela | Conteúdo | Quem lê | Quem grava |
| --- | --- | --- | --- |
| `profiles` | Nome, e-mail, papel, plano, objetivo, status, dia de vencimento, altura, idade, telefone, peso-meta | O próprio usuário; coach lê todos | O próprio (exceto papel, plano, status e vencimento); coach |
| `workout_plans` | Fichas de treino (exercícios em JSON) | Aluno dono; coach | Coach |
| `workout_logs` | Exercícios marcados por ficha e dia | Aluno dono; coach | Aluno dono; coach |
| `workout_days` | Dias com treino finalizado | Aluno dono; coach | Aluno dono; coach |
| `progress_entries` | Peso, gordura e cintura por data | Aluno dono; coach | Aluno dono; coach |
| `assessments` | Avaliações físicas + caminhos das fotos, status (`enviada`/`avaliada`) e comentário do coach | Aluno dono; coach | Aluno envia (sempre como `enviada`) e edita o recado; só o coach avalia e comenta |
| `sessions` | Agenda | Aluno dono; coach | Aluno: só pede (pendente), remarca ou cancela. Coach: tudo |
| `invoices` | Cobranças | Aluno dono; coach | Coach |
| `exercise_videos` | Link do vídeo de cada exercício | Todos os logados | Coach |
| `plans` | Nome e preço de cada plano | Todos os logados | Coach |
| `student_invites` | Alunos cadastrados pelo coach (nome, e-mail, plano, objetivo, 1º vencimento e valor) | Coach | Coach |
| `expenses` | Despesas do coach (descrição, categoria, valor, data) | Coach | Coach |
| `diet_plans` | Plano alimentar de cada aluno: metas (kcal, proteínas, carboidratos, gorduras, água) e refeições | Aluno dono; coach | Coach |
| `daily_logs` | Água bebida e refeições marcadas por dia | Aluno dono; coach | Aluno dono; coach |
| `messages` | Chat: conversa de cada aluno com o coach, com confirmação de leitura | Aluno dono; coach | Quem participa da conversa, só em nome próprio. Ninguém edita nem apaga; só marca como lida |
| Storage `assessment-photos` | Fotos das avaliações, em `<id do aluno>/...` | Aluno dono; coach | Aluno dono; coach |

A função `busy_slots(de, até)` devolve só data, hora e duração das sessões de todos. Assim o aluno vê os horários ocupados sem ver com quem.

## Testes

As regras de acesso têm 92 verificações automáticas (`tests/rls_test.sql`), rodadas num PostgreSQL local que imita o Supabase (`tests/supabase_stub.sql`):

```bash
createdb teste
psql -d teste -f supabase/tests/supabase_stub.sql
psql -d teste -f supabase/migrations/0001_schema.sql
psql -d teste -f supabase/migrations/0002_student_invites.sql
psql -d teste -f supabase/migrations/0003_messages.sql
psql -d teste -f supabase/migrations/0004_default_videos.sql
psql -d teste -f supabase/migrations/0005_expenses.sql
psql -d teste -f supabase/migrations/0006_assessment_review.sql
psql -d teste -f supabase/migrations/0007_diet.sql
psql -d teste -f supabase/migrations/0008_due_day.sql
psql -d teste -f supabase/migrations/0009_plans_billing.sql
psql -d teste -f supabase/tests/rls_test.sql   # termina com "TODOS OS TESTES PASSARAM"
```

**Não** rode `supabase_stub.sql` no Supabase de verdade; ele existe só para testes locais.

## Ainda não passa pelo banco

- **Pagamento:** o botão "Pagar" leva ao checkout da Prime Coaching. O coach marca como pago no Financeiro.
