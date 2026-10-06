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
