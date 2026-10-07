-- =====================================================================
-- CONFERÊNCIA DA INSTALAÇÃO
-- Cole no SQL Editor do Supabase e clique em Run. Cada linha mostra ✅ ou ❌.
-- Não altera nada no banco.
-- =====================================================================
select item, case when ok then '✅' else '❌' end as status, detalhe
from (
    select 1 as ordem, 'Tabelas do site' as item, count(*) = 15 as ok, count(*) || ' de 15 criadas' as detalhe
    from unnest(array['profiles', 'workout_plans', 'workout_logs', 'workout_days', 'progress_entries', 'assessments',
                      'sessions', 'invoices', 'exercise_videos', 'student_invites', 'messages', 'expenses',
                      'diet_plans', 'daily_logs', 'plans']) as t(name)
    where to_regclass('public.' || t.name) is not null

    union all
    select 2, 'Regras de acesso (RLS) ligadas', count(*) = 15, count(*) || ' de 15 tabelas protegidas'
    from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('profiles', 'workout_plans', 'workout_logs', 'workout_days', 'progress_entries', 'assessments',
                        'sessions', 'invoices', 'exercise_videos', 'student_invites', 'messages', 'expenses',
                        'diet_plans', 'daily_logs', 'plans')

    union all
    select 3, 'Pasta das fotos (Storage)', exists (select 1 from storage.buckets where id = 'assessment-photos'), 'assessment-photos'

    union all
    select 4, 'Chat em tempo real', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'), 'messages no supabase_realtime'

    union all
    select 5, 'Planos e preços', exists (select 1 from public.plans),
           coalesce((select string_agg(name || ' R$ ' || price, ', ' order by position) from public.plans), 'nenhum plano')

    union all
    select 6, 'Coach definido', exists (select 1 from public.profiles where role = 'coach'),
           coalesce((select string_agg(email, ', ') from public.profiles where role = 'coach'),
                    'crie a conta do Sidnei no site e rode: update public.profiles set role = ''coach'' where email = ''...'';')

    union all
    select 7, 'Mensalidades automáticas (opcional)', exists (select 1 from pg_extension where extname = 'pg_cron'),
           case when exists (select 1 from pg_extension where extname = 'pg_cron') then 'pg_cron ativo'
                else 'ative pg_cron em Database → Extensions e rode o setup.sql de novo' end
) as checks
order by ordem;
