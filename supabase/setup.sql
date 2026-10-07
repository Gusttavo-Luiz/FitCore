-- =====================================================================
-- INSTALAÇÃO COMPLETA DO BANCO (Supabase)
-- Junta as migrações 0001 a 0009, na ordem. Cole este arquivo inteiro no
-- SQL Editor do Supabase e clique em Run. Pode rodar de novo sem problema:
-- nada é apagado.
-- (Gerado a partir de supabase/migrations/. Para mudar algo, edite a
--  migração e gere este arquivo de novo.)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0001_schema.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Sidnei Muller Coach — esquema do banco (Supabase / PostgreSQL)
--
-- Como aplicar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
-- Pode ser executado mais de uma vez (usa IF NOT EXISTS / OR REPLACE).
--
-- Papéis:
--   aluno  → vê e edita só os próprios dados
--   coach  → vê e edita os dados de todos os alunos
-- Toda conta nova nasce como 'aluno'. Para tornar alguém coach, veja o fim
-- deste arquivo.
-- =====================================================================

-- ---------- Perfis (1 por usuário do Supabase Auth) ----------
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    role        text not null default 'aluno' check (role in ('aluno', 'coach')),
    full_name   text not null default '',
    email       text,
    phone       text,
    height_cm   numeric(5, 1),
    age         int check (age between 0 and 120),
    plan        text not null default 'Performance',
    goal        text not null default 'Hipertrofia',
    target_weight numeric(5, 1),
    status      text not null default 'Ativo' check (status in ('Ativo', 'Atenção', 'Pendente', 'Inativo')),
    created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists target_weight numeric(5, 1);

-- O coach é quem tem role = 'coach'. "security definer" deixa a função ler
-- profiles sem cair nas próprias regras de RLS (evita recursão).
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Aluno não pode mudar o próprio papel nem os campos que o coach controla
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_coach() and auth.uid() is not null then
        if new.role is distinct from old.role
           or new.plan is distinct from old.plan
           or new.status is distinct from old.status then
            raise exception 'Somente o coach pode alterar papel, plano ou status';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
    before update on public.profiles
    for each row execute function public.protect_profile_fields();

-- ---------- Fichas de treino ----------
create table if not exists public.workout_plans (
    id          text primary key default gen_random_uuid()::text,
    student_id  uuid not null references public.profiles (id) on delete cascade,
    name        text not null,
    focus       text not null default '',
    day         text not null default 'Livre',
    duration    int not null default 60 check (duration between 5 and 600),
    notes       text not null default '',
    -- [{ "name", "sets", "reps", "load", "rest" }, ...] na ordem da ficha
    exercises   jsonb not null default '[]'::jsonb,
    position    int not null default 0,
    updated_at  timestamptz not null default now()
);
create index if not exists workout_plans_student_idx on public.workout_plans (student_id, position);

-- Exercícios marcados por ficha e por dia
create table if not exists public.workout_logs (
    student_id  uuid not null references public.profiles (id) on delete cascade,
    plan_id     text not null,
    date        date not null,
    done        int[] not null default '{}',
    primary key (student_id, plan_id, date)
);

-- Dias em que o aluno finalizou um treino
create table if not exists public.workout_days (
    student_id  uuid not null references public.profiles (id) on delete cascade,
    date        date not null,
    primary key (student_id, date)
);

-- ---------- Evolução e avaliações ----------
create table if not exists public.progress_entries (
    student_id  uuid not null references public.profiles (id) on delete cascade,
    date        date not null,
    weight      numeric(5, 1) not null,
    fat         numeric(4, 1) not null,
    waist       numeric(5, 1) not null,
    primary key (student_id, date)
);

create table if not exists public.assessments (
    id          text primary key default gen_random_uuid()::text,
    student_id  uuid not null references public.profiles (id) on delete cascade,
    date        date not null,
    weight      numeric(5, 1) not null,
    fat         numeric(4, 1) not null,
    chest       numeric(5, 1) not null,
    waist       numeric(5, 1) not null,
    hip         numeric(5, 1) not null,
    arm         numeric(5, 1) not null,
    thigh       numeric(5, 1) not null,
    notes       text not null default '',
    -- caminhos no Storage: { "front": "<aluno>/<id>-front.jpg", "side": ..., "back": ... }
    photos      jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists assessments_student_idx on public.assessments (student_id, date);

-- ---------- Agenda ----------
create table if not exists public.sessions (
    id          text primary key default gen_random_uuid()::text,
    student_id  uuid not null references public.profiles (id) on delete cascade,
    date        date not null,
    time        time not null,
    duration    int not null default 60 check (duration between 15 and 240),
    type        text not null check (type in ('Presencial', 'Online', 'Avaliação')),
    title       text not null,
    place       text not null default '',
    notes       text not null default '',
    status      text not null default 'pendente' check (status in ('confirmada', 'pendente', 'cancelada')),
    updated_at  timestamptz not null default now()
);
create index if not exists sessions_date_idx on public.sessions (date, time);

-- ---------- Cobranças ----------
create table if not exists public.invoices (
    id          text primary key default gen_random_uuid()::text,
    student_id  uuid not null references public.profiles (id) on delete cascade,
    plan        text not null,
    amount      numeric(10, 2) not null check (amount > 0),
    due         date not null,
    paid_at     date,
    method      text,
    created_at  timestamptz not null default now()
);
create index if not exists invoices_student_idx on public.invoices (student_id, due);

-- ---------- Vídeos da biblioteca (definidos pelo coach) ----------
create table if not exists public.exercise_videos (
    exercise_id text primary key,
    url         text not null check (url ~ '^https://'),
    updated_at  timestamptz not null default now()
);

-- =====================================================================
-- Segurança: Row Level Security (RLS)
-- Sem uma política que permita, nenhuma linha é lida ou gravada.
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.workout_plans    enable row level security;
alter table public.workout_logs     enable row level security;
alter table public.workout_days     enable row level security;
alter table public.progress_entries enable row level security;
alter table public.assessments      enable row level security;
alter table public.sessions         enable row level security;
alter table public.invoices         enable row level security;
alter table public.exercise_videos  enable row level security;

-- Perfis: cada um vê e edita o seu; o coach vê e edita todos
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
    using (id = auth.uid() or public.is_coach());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
    using (id = auth.uid() or public.is_coach())
    with check (id = auth.uid() or public.is_coach());

-- Fichas: o aluno só lê as suas; quem monta e altera é o coach
drop policy if exists plans_select on public.workout_plans;
create policy plans_select on public.workout_plans for select to authenticated
    using (student_id = auth.uid() or public.is_coach());
drop policy if exists plans_write on public.workout_plans;
create policy plans_write on public.workout_plans for all to authenticated
    using (public.is_coach()) with check (public.is_coach());

-- Dados que o próprio aluno registra (treinos feitos, evolução, avaliações):
-- o aluno faz tudo nos seus; o coach faz tudo em todos
do $$
declare t text;
begin
    foreach t in array array['workout_logs', 'workout_days', 'progress_entries', 'assessments'] loop
        execute format('drop policy if exists %1$s_owner on public.%1$s', t);
        execute format(
            'create policy %1$s_owner on public.%1$s for all to authenticated
                using (student_id = auth.uid() or public.is_coach())
                with check (student_id = auth.uid() or public.is_coach())', t);
    end loop;
end $$;

-- Agenda: o aluno vê as suas sessões, pede horário (pendente), remarca
-- (volta a pendente) ou cancela; só o coach confirma e exclui
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated
    using (student_id = auth.uid() or public.is_coach());
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated
    with check (public.is_coach() or (student_id = auth.uid() and status = 'pendente'));
drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update to authenticated
    using (student_id = auth.uid() or public.is_coach())
    with check (public.is_coach() or (student_id = auth.uid() and status in ('pendente', 'cancelada')));
drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions for delete to authenticated
    using (public.is_coach());

-- Horários ocupados: o aluno não pode ler as sessões dos outros, mas precisa
-- saber quais horários estão livres. Esta função devolve só data, hora e
-- duração, sem nomes.
create or replace function public.busy_slots(from_date date, to_date date)
returns table (id text, date date, "time" time, duration int)
language sql
stable
security definer
set search_path = public
as $$
    select s.id, s.date, s.time, s.duration
    from public.sessions s
    where s.status <> 'cancelada' and s.date between from_date and to_date
      and auth.uid() is not null;
$$;

-- Cobranças: o aluno só lê; o coach cria, marca como pago e exclui
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated
    using (student_id = auth.uid() or public.is_coach());
drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices for all to authenticated
    using (public.is_coach()) with check (public.is_coach());

-- Vídeos: todos os logados leem; só o coach altera
drop policy if exists videos_select on public.exercise_videos;
create policy videos_select on public.exercise_videos for select to authenticated using (true);
drop policy if exists videos_write on public.exercise_videos;
create policy videos_write on public.exercise_videos for all to authenticated
    using (public.is_coach()) with check (public.is_coach());

-- Permissões de tabela (o RLS acima decide quais linhas)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, delete on public.profiles from authenticated;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.busy_slots(date, date) to authenticated;

-- =====================================================================
-- Fotos das avaliações (Supabase Storage)
-- Bucket privado; cada aluno grava em uma pasta com o próprio id:
--   assessment-photos/<id do aluno>/<id da avaliação>-front.jpg
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('assessment-photos', 'assessment-photos', false)
on conflict (id) do nothing;

drop policy if exists assessment_photos_select on storage.objects;
create policy assessment_photos_select on storage.objects for select to authenticated
    using (bucket_id = 'assessment-photos'
           and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
drop policy if exists assessment_photos_insert on storage.objects;
create policy assessment_photos_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'assessment-photos'
                and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
drop policy if exists assessment_photos_delete on storage.objects;
create policy assessment_photos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'assessment-photos'
           and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));

-- =====================================================================
-- Tornar o Sidnei coach (rode depois que ele criar a conta pelo site):
--   update public.profiles set role = 'coach' where email = 'email-do-sidnei@exemplo.com';
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0002_student_invites.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Cadastro de alunos pelo coach
--
-- O coach cadastra nome, e-mail, plano e objetivo. O site grava o convite
-- aqui e pede ao Supabase para enviar um link de acesso ao e-mail do aluno.
-- Quando a conta do aluno é criada (pelo link ou pelo "Criar conta"), o
-- perfil já nasce com o nome, o plano e o objetivo do convite.
--
-- Como aplicar: SQL Editor → cole este arquivo → Run (depois do 0001).
-- =====================================================================

create table if not exists public.student_invites (
    email       text primary key check (email = lower(email)),
    full_name   text not null,
    plan        text not null default 'Performance',
    goal        text not null default 'Hipertrofia',
    invited_by  uuid references public.profiles (id) on delete set null,
    created_at  timestamptz not null default now(),
    accepted_at timestamptz
);

alter table public.student_invites enable row level security;

-- Só o coach vê e gerencia convites
drop policy if exists invites_coach on public.student_invites;
create policy invites_coach on public.student_invites for all to authenticated
    using (public.is_coach()) with check (public.is_coach());

grant select, insert, update, delete on public.student_invites to authenticated;

-- Perfil novo: usa os dados do convite, se houver um para esse e-mail
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    inv public.student_invites;
begin
    select * into inv from public.student_invites where email = lower(new.email);

    insert into public.profiles (id, email, full_name, plan, goal)
    values (
        new.id,
        new.email,
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), inv.full_name, ''),
        coalesce(inv.plan, 'Performance'),
        coalesce(inv.goal, 'Hipertrofia')
    )
    on conflict (id) do nothing;

    if inv.email is not null then
        update public.student_invites set accepted_at = now() where email = inv.email;
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 0003_messages.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Chat entre aluno e coach
--
-- Cada conversa é de um aluno (student_id) com o coach. Quem envia fica em
-- sender_id. As mensagens chegam na hora pelo Supabase Realtime.
--
-- Como aplicar: SQL Editor → cole este arquivo → Run (depois do 0001 e 0002).
-- =====================================================================

create table if not exists public.messages (
    id          text primary key default gen_random_uuid()::text,
    student_id  uuid not null references public.profiles (id) on delete cascade,
    sender_id   uuid not null references public.profiles (id) on delete cascade,
    body        text not null check (char_length(body) between 1 and 2000),
    created_at  timestamptz not null default now(),
    read_at     timestamptz
);
create index if not exists messages_student_idx on public.messages (student_id, created_at);

alter table public.messages enable row level security;

-- Lê: o aluno a própria conversa; o coach todas
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
    using (student_id = auth.uid() or public.is_coach());

-- Envia: sempre em nome de quem está logado, na própria conversa (o coach em qualquer uma)
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
    with check (sender_id = auth.uid() and (student_id = auth.uid() or public.is_coach()));

-- Marcar como lida: quem participa da conversa. Só a coluna read_at pode mudar
-- (ninguém edita o texto nem apaga mensagens)
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for update to authenticated
    using (student_id = auth.uid() or public.is_coach())
    with check (student_id = auth.uid() or public.is_coach());

revoke all on public.messages from authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Tempo real: avisa o site quando chega mensagem nova (respeita as regras acima)
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables
                       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
        execute 'alter publication supabase_realtime add table public.messages';
    end if;
end $$;

-- ---------------------------------------------------------------------
-- 0004_default_videos.sql
-- ---------------------------------------------------------------------
-- Vídeos de execução que já vêm cadastrados (o coach pode trocar pelo site).
-- Como aplicar: SQL Editor → cole este arquivo → Run. Não sobrescreve um vídeo já escolhido.
insert into public.exercise_videos (exercise_id, url) values
    ('burpee', 'https://youtube.com/shorts/aFSpzKujvZk')
on conflict (exercise_id) do nothing;

-- ---------------------------------------------------------------------
-- 0005_expenses.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Despesas do coach (Financeiro → Despesas)
-- Só o coach vê e lança. Como aplicar: SQL Editor → cole → Run.
-- =====================================================================
create table if not exists public.expenses (
    id          text primary key default gen_random_uuid()::text,
    description text not null check (char_length(description) between 1 and 200),
    category    text not null default 'Outros',
    amount      numeric(10, 2) not null check (amount > 0),
    date        date not null,
    created_at  timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (date);

alter table public.expenses enable row level security;
drop policy if exists expenses_coach on public.expenses;
create policy expenses_coach on public.expenses for all to authenticated
    using (public.is_coach()) with check (public.is_coach());
grant select, insert, update, delete on public.expenses to authenticated;

-- ---------------------------------------------------------------------
-- 0006_assessment_review.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Avaliação por fotos: o aluno envia, o coach avalia
-- - As medidas passam a ser opcionais (o aluno pode mandar só as fotos).
-- - status: 'enviada' (aguardando o coach) ou 'avaliada'.
-- - feedback e reviewed_at: comentário do coach e quando ele avaliou.
-- - Só o coach muda status, comentário e data da avaliação. Tudo que o
--   aluno grava nasce como 'enviada'.
-- Como aplicar: SQL Editor → cole → Run. Pode rodar de novo sem problema.
-- =====================================================================
alter table public.assessments
    alter column weight drop not null,
    alter column fat    drop not null,
    alter column chest  drop not null,
    alter column waist  drop not null,
    alter column hip    drop not null,
    alter column arm    drop not null,
    alter column thigh  drop not null;

alter table public.assessments add column if not exists status text not null default 'avaliada'
    check (status in ('enviada', 'avaliada'));
alter table public.assessments add column if not exists feedback text not null default '';
alter table public.assessments add column if not exists reviewed_at timestamptz;
alter table public.assessments add column if not exists submitted_by text not null default 'coach'
    check (submitted_by in ('aluno', 'coach'));

create index if not exists assessments_pending_idx on public.assessments (date) where status = 'enviada';

create or replace function public.protect_assessment_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_coach() and auth.uid() is not null then
        if tg_op = 'INSERT' then
            new.status := 'enviada';
            new.feedback := '';
            new.reviewed_at := null;
            new.submitted_by := 'aluno';
        else
            new.status := old.status;
            new.feedback := old.feedback;
            new.reviewed_at := old.reviewed_at;
            new.submitted_by := old.submitted_by;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_assessment_review on public.assessments;
create trigger protect_assessment_review
    before insert or update on public.assessments
    for each row execute function public.protect_assessment_review();

-- ---------------------------------------------------------------------
-- 0007_diet.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Dieta por aluno e registro diário (água e refeições feitas)
-- - diet_plans: o plano alimentar de cada aluno, montado pelo coach.
--   O aluno só lê o seu.
-- - daily_logs: o que o aluno marcou no dia (água bebida e refeições
--   feitas). O aluno grava o seu; o coach lê de todos.
-- Como aplicar: SQL Editor → cole → Run. Pode rodar de novo sem problema.
-- =====================================================================
create table if not exists public.diet_plans (
    student_id  uuid primary key references public.profiles (id) on delete cascade,
    -- metas do dia (podem ficar vazias)
    kcal        int check (kcal between 0 and 20000),
    protein     int check (protein between 0 and 2000),
    carbs       int check (carbs between 0 and 2000),
    fat         int check (fat between 0 and 2000),
    water_ml    int not null default 3000 check (water_ml between 0 and 10000),
    -- refeições: [{ "name": "Almoço", "time": "13:00", "kcal": 650, "items": ["150 g de frango", ...] }]
    meals       jsonb not null default '[]'::jsonb check (jsonb_typeof(meals) = 'array'),
    notes       text not null default '',
    updated_at  timestamptz not null default now()
);

create table if not exists public.daily_logs (
    student_id  uuid not null references public.profiles (id) on delete cascade,
    date        date not null,
    water_ml    int not null default 0 check (water_ml between 0 and 20000),
    -- posições (0, 1, 2...) das refeições do plano marcadas como feitas
    meals_done  int[] not null default '{}',
    primary key (student_id, date)
);

alter table public.diet_plans enable row level security;
alter table public.daily_logs enable row level security;

-- Dieta: o aluno só lê a sua; quem monta e altera é o coach
drop policy if exists diet_select on public.diet_plans;
create policy diet_select on public.diet_plans for select to authenticated
    using (student_id = auth.uid() or public.is_coach());
drop policy if exists diet_write on public.diet_plans;
create policy diet_write on public.diet_plans for all to authenticated
    using (public.is_coach()) with check (public.is_coach());

-- Registro do dia: igual aos treinos feitos (o aluno no seu; o coach em todos)
drop policy if exists daily_logs_owner on public.daily_logs;
create policy daily_logs_owner on public.daily_logs for all to authenticated
    using (student_id = auth.uid() or public.is_coach())
    with check (student_id = auth.uid() or public.is_coach());

grant select, insert, update, delete on public.diet_plans, public.daily_logs to authenticated;

-- ---------------------------------------------------------------------
-- 0008_due_day.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Vencimento definido pelo coach
-- - profiles.due_day: dia do mês em que vencem as mensalidades do aluno.
--   Só o coach altera.
-- - No cadastro (convite), o coach informa a data do 1º vencimento. Quando
--   o aluno cria a conta, o perfil recebe o dia de vencimento e a primeira
--   cobrança é criada automaticamente com o valor do plano.
-- Como aplicar: SQL Editor → cole → Run. Pode rodar de novo sem problema.
-- =====================================================================
alter table public.profiles add column if not exists due_day smallint check (due_day between 1 and 31);

alter table public.student_invites add column if not exists due_day smallint check (due_day between 1 and 31);
alter table public.student_invites add column if not exists first_due date;
alter table public.student_invites add column if not exists first_amount numeric(10, 2) check (first_amount > 0);

-- Aluno não pode mudar o próprio papel, plano, status nem o dia de vencimento
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_coach() and auth.uid() is not null then
        if new.role is distinct from old.role
           or new.plan is distinct from old.plan
           or new.status is distinct from old.status
           or new.due_day is distinct from old.due_day then
            raise exception 'Somente o coach pode alterar papel, plano, status ou vencimento';
        end if;
    end if;
    return new;
end;
$$;

-- Perfil novo: usa os dados do convite e cria a 1ª cobrança, se o coach informou
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    inv public.student_invites;
begin
    select * into inv from public.student_invites where email = lower(new.email);

    insert into public.profiles (id, email, full_name, plan, goal, due_day)
    values (
        new.id,
        new.email,
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), inv.full_name, ''),
        coalesce(inv.plan, 'Performance'),
        coalesce(inv.goal, 'Hipertrofia'),
        inv.due_day
    )
    on conflict (id) do nothing;

    if inv.email is not null then
        if inv.first_due is not null and inv.first_amount is not null and inv.accepted_at is null then
            insert into public.invoices (student_id, plan, amount, due)
            values (new.id, coalesce(inv.plan, 'Performance'), inv.first_amount, inv.first_due);
        end if;
        update public.student_invites set accepted_at = now() where email = inv.email;
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 0009_plans_billing.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Planos com preço no banco e mensalidades automáticas
-- - plans: nome e preço de cada plano. Todos os logados leem (o aluno vê
--   o valor do próprio plano); só o coach cria, altera ou remove.
-- - generate_monthly_invoices(mês): cria a mensalidade do mês para cada
--   aluno que ainda não tem, com o preço do plano e o dia de vencimento do
--   aluno (ou o dia da última cobrança, ou 10). Não duplica.
-- - Se o Supabase tiver a extensão pg_cron, agenda a função para todo dia
--   1º às 9h (horário de Brasília).
-- Como aplicar: SQL Editor → cole → Run. Pode rodar de novo sem problema.
-- =====================================================================
create table if not exists public.plans (
    name        text primary key check (char_length(name) between 1 and 40),
    price       numeric(10, 2) not null check (price > 0),
    position    int not null default 0
);

insert into public.plans (name, price, position) values
    ('Essencial', 89, 0), ('Performance', 149, 1), ('Premium', 299, 2)
on conflict (name) do nothing;

alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated using (true);
drop policy if exists plans_coach on public.plans;
create policy plans_coach on public.plans for all to authenticated
    using (public.is_coach()) with check (public.is_coach());
grant select, insert, update, delete on public.plans to authenticated;

create or replace function public.generate_monthly_invoices(month date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    first_day date := date_trunc('month', month)::date;
    last_day  int  := extract(day from (date_trunc('month', month) + interval '1 month - 1 day'))::int;
    created   int;
begin
    -- Pelo site, só o coach pode gerar. Pelo agendamento (sem usuário), pode.
    if auth.uid() is not null and not public.is_coach() then
        raise exception 'Somente o coach gera mensalidades';
    end if;

    insert into public.invoices (student_id, plan, amount, due)
    select p.id, p.plan, pl.price,
           first_day + (least(coalesce(
               p.due_day,
               (select extract(day from i.due)::int from public.invoices i where i.student_id = p.id order by i.due desc limit 1),
               10), last_day) - 1)
    from public.profiles p
    join public.plans pl on pl.name = p.plan
    where p.role = 'aluno' and p.status <> 'Inativo'
      and not exists (
          select 1 from public.invoices i
          where i.student_id = p.id and date_trunc('month', i.due) = date_trunc('month', first_day));

    get diagnostics created = row_count;
    return created;
end;
$$;

revoke all on function public.generate_monthly_invoices(date) from public;
grant execute on function public.generate_monthly_invoices(date) to authenticated;

-- Agendamento automático (só se o pg_cron existir no projeto)
do $$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        execute 'create extension if not exists pg_cron';
        -- 12h UTC = 9h em Brasília, todo dia 1º
        execute $cron$select cron.schedule('mensalidades-do-mes', '0 12 1 * *', 'select public.generate_monthly_invoices()')$cron$;
    end if;
end $$;
