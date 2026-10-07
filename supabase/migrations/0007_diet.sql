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
