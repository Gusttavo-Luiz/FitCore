-- Vídeos de execução que já vêm cadastrados (o coach pode trocar pelo site).
-- Como aplicar: SQL Editor → cole este arquivo → Run. Não sobrescreve um vídeo já escolhido.
insert into public.exercise_videos (exercise_id, url) values
    ('burpee', 'https://youtube.com/shorts/aFSpzKujvZk')
on conflict (exercise_id) do nothing;
