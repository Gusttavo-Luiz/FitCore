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
