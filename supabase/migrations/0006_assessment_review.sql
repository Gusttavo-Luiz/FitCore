-- =====================================================================
-- Avaliação por fotos: o aluno envia, o coach avalia
-- - As medidas passam a ser opcionais (o aluno pode mandar só as fotos).
-- - status: 'enviada' (aguardando o coach) ou 'avaliada'.
-- - feedback e reviewed_at: comentário do coach e quando ele avaliou.
-- - Só o coach muda status, comentário e data da avaliação. Tudo que o
--   aluno grava nasce como 'enviada'.
-- Como aplicar: SQL Editor → cole → Run. Pode rodar de novo sem problema.
-- =====================================================================
alter table public.assessments
    alter column weight drop not null,
    alter column fat    drop not null,
    alter column chest  drop not null,
    alter column waist  drop not null,
    alter column hip    drop not null,
    alter column arm    drop not null,
    alter column thigh  drop not null;

alter table public.assessments add column if not exists status text not null default 'avaliada'
    check (status in ('enviada', 'avaliada'));
alter table public.assessments add column if not exists feedback text not null default '';
alter table public.assessments add column if not exists reviewed_at timestamptz;
alter table public.assessments add column if not exists submitted_by text not null default 'coach'
    check (submitted_by in ('aluno', 'coach'));

create index if not exists assessments_pending_idx on public.assessments (date) where status = 'enviada';

create or replace function public.protect_assessment_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_coach() and auth.uid() is not null then
        if tg_op = 'INSERT' then
            new.status := 'enviada';
            new.feedback := '';
            new.reviewed_at := null;
            new.submitted_by := 'aluno';
        else
            new.status := old.status;
            new.feedback := old.feedback;
            new.reviewed_at := old.reviewed_at;
            new.submitted_by := old.submitted_by;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_assessment_review on public.assessments;
create trigger protect_assessment_review
    before insert or update on public.assessments
    for each row execute function public.protect_assessment_review();
