-- Testes das regras de acesso (RLS). Rodar num banco com supabase_stub.sql + a migração.
-- Cada verificação lança erro se falhar; ao final imprime "TODOS OS TESTES PASSARAM".
\set ON_ERROR_STOP on
\set coach '11111111-1111-1111-1111-111111111111'
\set ana   '22222222-2222-2222-2222-222222222222'
\set bruno '33333333-3333-3333-3333-333333333333'

create or replace function public.t_assert(ok boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(ok, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
grant execute on function public.t_assert(boolean, text) to authenticated;
-- Espera que o comando seja recusado
create or replace function public.t_denied(cmd text, msg text) returns void language plpgsql as
$$ begin execute cmd; raise exception 'FALHOU (deveria ser recusado): %', msg;
   exception when insufficient_privilege or raise_exception or check_violation then
       if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok (recusado): %', msg; end $$;
grant execute on function public.t_denied(text, text) to authenticated;

-- Cadastro: o gatilho cria os perfis como 'aluno'
insert into auth.users (id, email, raw_user_meta_data) values
  (:'coach', 'sidnei@exemplo.com', '{"full_name":"Sidnei Muller"}'),
  (:'ana',   'ana@exemplo.com',    '{"full_name":"Ana Lima"}'),
  (:'bruno', 'bruno@exemplo.com',  '{"full_name":"Bruno Reis"}');
select t_assert((select count(*) from profiles where role = 'aluno') = 3, 'cadastro cria 3 perfis de aluno');
select t_assert((select full_name from profiles where id = :'ana') = 'Ana Lima', 'nome vem do cadastro');
update profiles set role = 'coach' where email = 'sidnei@exemplo.com';  -- feito no SQL Editor (sem usuário logado)
select t_assert((select role from profiles where id = :'coach') = 'coach', 'SQL Editor promove o coach');

-- ===== Coach =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'coach', false);
select t_assert(is_coach(), 'is_coach() verdadeiro para o coach');
select t_assert((select count(*) from profiles) = 3, 'coach vê todos os perfis');
insert into workout_plans (id, student_id, name, exercises) values
  ('fa1', :'ana', 'Treino A', '[{"name":"Supino reto com barra","sets":4,"reps":"10","load":"60 kg","rest":"90s"}]'),
  ('fb1', :'bruno', 'Treino A', '[]');
insert into sessions (id, student_id, date, time, type, title, status) values
  ('s-ana', :'ana', current_date + 1, '18:00', 'Presencial', 'Treino', 'confirmada'),
  ('s-bruno', :'bruno', current_date + 1, '19:00', 'Online', 'Aula', 'confirmada');
insert into invoices (id, student_id, plan, amount, due) values ('i-ana', :'ana', 'Performance', 149, current_date + 5);
insert into exercise_videos values ('supino-reto-com-barra', 'https://youtu.be/abcdefghijk');
update profiles set plan = 'Premium', status = 'Atenção' where id = :'ana';
select t_assert((select plan from profiles where id = :'ana') = 'Premium', 'coach altera plano do aluno');
select t_denied($$insert into exercise_videos values ('x', 'http://inseguro')$$, 'vídeo precisa ser https');

-- ===== Aluna Ana =====
select set_config('request.jwt.claim.sub', :'ana', false);
select t_assert(not is_coach(), 'is_coach() falso para aluna');
select t_assert((select count(*) from profiles) = 1, 'aluna vê só o próprio perfil');
select t_assert((select count(*) from workout_plans) = 1, 'aluna vê só a própria ficha');
select t_assert((select count(*) from sessions) = 1, 'aluna vê só a própria sessão');
select t_assert((select count(*) from invoices) = 1, 'aluna vê a própria cobrança');
select t_assert((select count(*) from exercise_videos) = 2, 'aluna vê os vídeos (o do coach + o do Burpee que já vem cadastrado)');
select t_assert((select count(*) from busy_slots(current_date, current_date + 7)) = 2, 'busy_slots mostra horários ocupados de todos');

update profiles set phone = '11999990000', age = 30 where id = :'ana';
select t_assert((select phone from profiles where id = :'ana') = '11999990000', 'aluna edita telefone e idade');
select t_denied(format($$update profiles set role = 'coach' where id = %L$$, :'ana'), 'aluna não vira coach');
select t_denied(format($$update profiles set plan = 'Essencial' where id = %L$$, :'ana'), 'aluna não muda o próprio plano');
update profiles set full_name = 'Hackeado' where id = :'bruno';
select t_assert(true, 'update no perfil do Bruno não dá erro mas não afeta linhas');

update workout_plans set name = 'X';  -- RLS: nenhuma linha atualizada
select t_assert((select name from workout_plans where id = 'fa1') = 'Treino A', 'aluna não edita ficha (continua igual)');

insert into workout_logs values (:'ana', 'fa1', current_date, '{0,2}');
insert into workout_days values (:'ana', current_date);
insert into progress_entries values (:'ana', current_date, 80.5, 18.2, 85);
insert into assessments (id, student_id, date, weight, fat, chest, waist, hip, arm, thigh, photos)
  values ('av-ana', :'ana', current_date, 80.5, 18.2, 100, 85, 98, 36, 58, format('{"front":"%s/av-ana-front.jpg"}', :'ana')::jsonb);
select t_assert((select count(*) from progress_entries) = 1, 'aluna registra a própria evolução');
select t_denied(format($$insert into progress_entries values (%L, current_date, 1, 1, 1)$$, :'bruno'), 'aluna não grava evolução de outro aluno');

insert into sessions (id, student_id, date, time, type, title, status) values ('s-pedido', :'ana', current_date + 2, '07:00', 'Online', 'Pedido', 'pendente');
select t_assert(true, 'aluna solicita horário (pendente)');
select t_denied(format($$insert into sessions (student_id, date, time, type, title, status) values (%L, current_date + 3, '08:00', 'Online', 'X', 'confirmada')$$, :'ana'), 'aluna não cria sessão já confirmada');
select t_denied(format($$insert into sessions (student_id, date, time, type, title, status) values (%L, current_date + 3, '08:00', 'Online', 'X', 'pendente')$$, :'bruno'), 'aluna não agenda para outro aluno');
update sessions set time = '06:00', status = 'pendente' where id = 's-ana';
select t_assert((select status from sessions where id = 's-ana') = 'pendente', 'aluna remarca (volta a pendente)');
select t_denied($$update sessions set status = 'confirmada' where id = 's-pedido'$$, 'aluna não confirma a própria sessão');
update sessions set status = 'cancelada' where id = 's-pedido';
select t_assert((select status from sessions where id = 's-pedido') = 'cancelada', 'aluna cancela');
delete from sessions where id = 's-ana';
select t_assert((select count(*) from sessions where id = 's-ana') = 1, 'aluna não exclui sessão (nenhuma linha apagada)');

update invoices set paid_at = current_date;  -- RLS: nenhuma linha atualizada
select t_assert((select paid_at from invoices where id = 'i-ana') is null, 'aluna não marca cobrança como paga');
select t_denied($$insert into exercise_videos values ('y', 'https://youtu.be/xxxxxxxxxxx')$$, 'aluna não altera vídeos');

insert into storage.objects (bucket_id, name) values ('assessment-photos', :'ana' || '/av-ana-front.jpg');
select t_assert(true, 'aluna envia foto na própria pasta');
select t_denied(format($$insert into storage.objects (bucket_id, name) values ('assessment-photos', '%s/x.jpg')$$, :'bruno'), 'aluna não envia foto na pasta de outro');

-- ===== Aluno Bruno =====
select set_config('request.jwt.claim.sub', :'bruno', false);
select t_assert((select full_name from profiles) = 'Bruno Reis', 'nome do Bruno não foi alterado pela Ana');
select t_assert((select count(*) from assessments) = 0, 'Bruno não vê avaliação da Ana');
select t_assert((select count(*) from storage.objects) = 0, 'Bruno não vê fotos da Ana');
select t_assert((select count(*) from workout_logs) = 0, 'Bruno não vê treinos da Ana');

-- ===== Sem login =====
select set_config('request.jwt.claim.sub', '', false);
select t_assert((select count(*) from sessions) = 0, 'sem login não vê nada');
select t_assert((select count(*) from busy_slots(current_date, current_date + 7)) = 0, 'busy_slots vazio sem login');

-- ===== Coach de novo =====
select set_config('request.jwt.claim.sub', :'coach', false);
update sessions set status = 'confirmada' where id = 's-ana';
update invoices set paid_at = current_date, method = 'Pix' where id = 'i-ana';
select t_assert((select count(*) from assessments) = 1 and (select count(*) from storage.objects) = 1, 'coach vê avaliação e fotos da Ana');
delete from sessions where id = 's-pedido';
select t_assert((select count(*) from sessions) = 2, 'coach confirma, marca pago e exclui');
-- ===== Convites (0002) =====
insert into student_invites (email, full_name, plan, goal, invited_by)
  values ('carla@exemplo.com', 'Carla Souza', 'Premium', 'Emagrecimento', :'coach');
select t_assert((select count(*) from student_invites) = 1, 'coach cadastra convite');
select set_config('request.jwt.claim.sub', :'ana', false);
select t_assert((select count(*) from student_invites) = 0, 'aluna não vê convites');
select t_denied($$insert into student_invites (email, full_name) values ('x@exemplo.com', 'X')$$, 'aluna não cria convite');
reset role;
-- O Supabase cria a conta (link do convite ou "Criar conta"), sem nome nos metadados
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'Carla@Exemplo.com');
select t_assert((select full_name || '|' || plan || '|' || goal from profiles where id = '44444444-4444-4444-4444-444444444444')
                = 'Carla Souza|Premium|Emagrecimento', 'perfil nasce com nome, plano e objetivo do convite (e-mail sem diferenciar maiúsculas)');
select t_assert((select accepted_at is not null from student_invites where email = 'carla@exemplo.com'), 'convite marcado como aceito');
insert into auth.users (id, email, raw_user_meta_data) values ('55555555-5555-5555-5555-555555555555', 'semconvite@exemplo.com', '{"full_name":"Diego"}');
select t_assert((select plan from profiles where id = '55555555-5555-5555-5555-555555555555') = 'Performance', 'sem convite, plano padrão');
-- ===== Chat (0003) =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);
insert into messages (id, student_id, sender_id, body) values ('m1', :'ana', :'ana', 'Oi, coach!');
select t_assert(true, 'aluna envia mensagem na própria conversa');
select t_denied(format($$insert into messages (student_id, sender_id, body) values (%L, %L, 'x')$$, :'bruno', :'ana'), 'aluna não escreve na conversa de outro');
select t_denied(format($$insert into messages (student_id, sender_id, body) values (%L, %L, 'x')$$, :'ana', :'coach'), 'aluna não envia em nome do coach');
select t_denied(format($$insert into messages (student_id, sender_id, body) values (%L, %L, '')$$, :'ana', :'ana'), 'mensagem vazia é recusada');
select set_config('request.jwt.claim.sub', :'coach', false);
insert into messages (id, student_id, sender_id, body) values ('m2', :'ana', :'coach', 'Oi, Ana!'), ('m3', :'bruno', :'coach', 'Oi, Bruno!');
select t_assert((select count(*) from messages) = 3, 'coach vê todas as conversas e responde');
update messages set read_at = now() where id = 'm1';
select t_assert((select read_at is not null from messages where id = 'm1'), 'coach marca como lida');
select set_config('request.jwt.claim.sub', :'ana', false);
select t_assert((select count(*) from messages) = 2, 'aluna vê só a própria conversa');
select t_denied($$update messages set body = 'editado' where id = 'm2'$$, 'ninguém edita o texto de uma mensagem');
update messages set read_at = now() where id = 'm2';
select t_assert((select read_at is not null from messages where id = 'm2'), 'aluna marca a resposta como lida');
select t_denied($$delete from messages where id = 'm1'$$, 'ninguém apaga mensagens');
reset role;
select t_assert(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'), 'mensagens ligadas ao tempo real');
-- ===== Dieta e registro diário (0007) =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'coach', false);
insert into diet_plans (student_id, kcal, protein, water_ml, meals) values
  (:'ana', 2000, 150, 2500, '[{"name":"Almoço","time":"13:00","kcal":600,"items":["Frango","Arroz"]}]'),
  (:'bruno', 2800, 200, 3500, '[]');
select t_assert((select count(*) from diet_plans) = 2, 'coach monta a dieta de cada aluno');
select t_denied($$insert into diet_plans (student_id, meals) values ('22222222-2222-2222-2222-222222222222', '{}')$$, 'refeições precisam ser uma lista');
select set_config('request.jwt.claim.sub', :'ana', false);
select t_assert((select count(*) from diet_plans) = 1 and (select kcal from diet_plans) = 2000, 'aluna lê só a própria dieta');
update diet_plans set kcal = 5000 where student_id = :'ana';
select t_assert((select kcal from diet_plans) = 2000, 'aluna não altera a dieta (nenhuma linha muda)');
select t_denied(format($$insert into diet_plans (student_id) values (%L)$$, :'ana'), 'aluna não cria dieta');
insert into daily_logs (student_id, date, water_ml, meals_done) values (:'ana', current_date, 750, '{0}');
update daily_logs set water_ml = 1000, meals_done = '{0,1}' where student_id = :'ana' and date = current_date;
select t_assert((select water_ml from daily_logs) = 1000, 'aluna registra água e refeições do dia');
select t_denied(format($$insert into daily_logs (student_id, date) values (%L, current_date)$$, :'bruno'), 'aluna não registra o dia de outro');
select t_denied(format($$insert into daily_logs (student_id, date, water_ml) values (%L, current_date - 1, -5)$$, :'ana'), 'água negativa é recusada');
select set_config('request.jwt.claim.sub', :'bruno', false);
select t_assert((select count(*) from daily_logs) = 0 and (select count(*) from diet_plans) = 1, 'Bruno não vê o registro nem a dieta da Ana');
select set_config('request.jwt.claim.sub', :'coach', false);
select t_assert((select meals_done from daily_logs where student_id = :'ana') = '{0,1}', 'coach acompanha o registro do dia da aluna');
reset role;
-- ===== Despesas (0005) =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'coach', false);
insert into expenses (id, description, category, amount, date) values ('e1', 'Aluguel', 'Aluguel e espaço', 450, current_date);
select t_assert((select count(*) from expenses) = 1, 'coach lança despesa');
select set_config('request.jwt.claim.sub', :'ana', false);
select t_assert((select count(*) from expenses) = 0, 'aluna não vê despesas do coach');
select t_denied($$insert into expenses (description, amount, date) values ('x', 1, current_date)$$, 'aluna não lança despesa');
reset role;
-- ===== Avaliação por fotos (0006) =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);
insert into assessments (id, student_id, date, notes, photos, status, feedback)
    values ('av-envio', :'ana', current_date, 'Fotos de 8 semanas', '{"front":"22222222-2222-2222-2222-222222222222/av-envio-front.jpg"}', 'avaliada', 'eu mesma aprovei');
select t_assert((select status || '|' || feedback || '|' || submitted_by from assessments where id = 'av-envio') = 'enviada||aluno',
                'aluna envia só fotos (sem medidas) e o envio nasce aguardando o coach');
update assessments set status = 'avaliada', feedback = 'ok', notes = 'Atualizei o recado' where id = 'av-envio';
select t_assert((select status || '|' || notes from assessments where id = 'av-envio') = 'enviada|Atualizei o recado',
                'aluna edita o recado mas não marca como avaliada');
select set_config('request.jwt.claim.sub', :'coach', false);
select t_assert((select count(*) from assessments where status = 'enviada') = 2, 'coach vê na fila tudo que a aluna enviou (as duas avaliações)');
update assessments set status = 'avaliada', feedback = 'Cintura bem mais fina!', reviewed_at = now(), weight = 63.2 where id = 'av-envio';
select set_config('request.jwt.claim.sub', :'ana', false);
select t_assert((select status || '|' || feedback || '|' || weight from assessments where id = 'av-envio') = 'avaliada|Cintura bem mais fina!|63.2',
                'aluna vê o comentário do coach');
insert into assessments (id, student_id, date, notes, photos, status, feedback) values ('av-envio', :'ana', current_date, 'de novo', '{}', 'enviada', '')
    on conflict (id) do update set notes = excluded.notes, status = excluded.status, feedback = excluded.feedback;
select t_assert((select status || '|' || feedback from assessments where id = 'av-envio') = 'avaliada|Cintura bem mais fina!',
                'reenvio (upsert) da aluna não apaga a avaliação do coach');
select t_denied(format($$insert into assessments (student_id, date, photos) values (%L, current_date, '{}')$$, :'bruno'), 'aluna não envia fotos em nome de outro');
reset role;
\echo TODOS OS TESTES PASSARAM
