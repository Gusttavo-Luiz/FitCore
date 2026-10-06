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
