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
