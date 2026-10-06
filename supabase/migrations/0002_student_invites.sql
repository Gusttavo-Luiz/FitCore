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
