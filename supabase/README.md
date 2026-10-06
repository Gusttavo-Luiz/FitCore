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
   - Pode rodar de novo sem problema: o arquivo não apaga nada.

3. **Configurar o login**
   - **Authentication → URL Configuration**:
     - *Site URL*: `https://gusttavo-luiz.github.io/FitCore/`
     - *Redirect URLs*: adicione `https://gusttavo-luiz.github.io/FitCore/index.html`
   - **Authentication → Providers → Email**: deixe ativado. Se *Confirm email* estiver ligado, o aluno precisa clicar no link do e-mail antes do primeiro login (recomendado).

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

6. **Publicar**: envie para a `main`. A partir daí, cada aluno cria a própria conta no site e aparece na lista do coach.

## O que fica no banco

| Tabela | Conteúdo | Quem lê | Quem grava |
| --- | --- | --- | --- |
| `profiles` | Nome, e-mail, papel, plano, objetivo, status, altura, idade, telefone, peso-meta | O próprio usuário; coach lê todos | O próprio (exceto papel, plano e status); coach |
| `workout_plans` | Fichas de treino (exercícios em JSON) | Aluno dono; coach | Coach |
| `workout_logs` | Exercícios marcados por ficha e dia | Aluno dono; coach | Aluno dono; coach |
| `workout_days` | Dias com treino finalizado | Aluno dono; coach | Aluno dono; coach |
| `progress_entries` | Peso, gordura e cintura por data | Aluno dono; coach | Aluno dono; coach |
| `assessments` | Avaliações físicas + caminhos das fotos | Aluno dono; coach | Aluno dono; coach |
| `sessions` | Agenda | Aluno dono; coach | Aluno: só pede (pendente), remarca ou cancela. Coach: tudo |
| `invoices` | Cobranças | Aluno dono; coach | Coach |
| `exercise_videos` | Link do vídeo de cada exercício | Todos os logados | Coach |
| Storage `assessment-photos` | Fotos das avaliações, em `<id do aluno>/...` | Aluno dono; coach | Aluno dono; coach |

A função `busy_slots(de, até)` devolve só data, hora e duração das sessões de todos. Assim o aluno vê os horários ocupados sem ver com quem.

## Testes

As regras de acesso têm 40 verificações automáticas (`tests/rls_test.sql`), rodadas num PostgreSQL local que imita o Supabase (`tests/supabase_stub.sql`):

```bash
createdb teste
psql -d teste -f supabase/tests/supabase_stub.sql
psql -d teste -f supabase/migrations/0001_schema.sql
psql -d teste -f supabase/tests/rls_test.sql   # termina com "TODOS OS TESTES PASSARAM"
```

**Não** rode `supabase_stub.sql` no Supabase de verdade; ele existe só para testes locais.

## Ainda não passa pelo banco

- **Chat:** com o Supabase ligado, a tela de mensagens leva ao WhatsApp.
- **Dieta e água:** continuam salvas só no aparelho do aluno.
- **Pagamento:** o botão "Pagar" leva ao checkout da Prime Coaching. O coach marca como pago no Financeiro.
- **Cadastro de aluno pelo coach:** o aluno cria a própria conta. Plano e status são alterados no Supabase (Table Editor → `profiles`).
