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
