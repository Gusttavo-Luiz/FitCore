// ---------- Painel (dashboard) do aluno ----------
// Indicadores clicáveis, "Para fazer hoje", treino do dia, evolução com filtro
// (peso, gordura ou cintura; 3 meses ou tudo) e linha da meta, semana planejada
// x feita, próximas sessões e o último comentário do coach.
const WEEK_GOAL = 5;       // treinos por semana
let evoMetric = 'weight';
let evoRange = store.get('evo_range', 'all');

const EVO_METRICS = { weight: ['Peso', 'kg', 1], fat: ['Gordura', '%', 1], waist: ['Cintura', 'cm', 1] };
// plural() vem de painel.js
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

function myGoal() {
    return Backend.enabled
        ? { weight: state.profile.targetWeight, label: (Backend.profile && Backend.profile.goal) || 'Meta' }
        : SEED.goal;
}

// Próximo treino da ficha a partir de amanhã (para dia de descanso)
function nextWorkout() {
    const plan = myPlan();
    for (let i = 1; i <= 7; i++) {
        const d = offsetDate(i);
        const w = plan.find(x => x.day === WEEKDAYS[(new Date(d + 'T12:00:00').getDay() + 6) % 7]);
        if (w) return { w, date: d };
    }
    return null;
}

// ---------- Gráfico de evolução (uma linha, meta tracejada) ----------
function evolutionChart(points, { unit, decimals, goal }) {
    if (points.length < 2) return '<div class="empty">Registre ao menos duas medições para ver o gráfico.</div>';
    const narrow = innerWidth < 760; // no celular, menos largura = texto maior
    const W = narrow ? 420 : 640, H = narrow ? 260 : 240, P = { l: 52, r: 18, t: 22, b: 30 };
    const vals = points.map(p => p.v).concat(goal ? [goal] : []);
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.12 || 1;
    min -= pad; max += pad;
    const x = i => P.l + (i * (W - P.l - P.r)) / (points.length - 1);
    const y = v => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${path} L${x(points.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
    const every = Math.ceil(points.length / (narrow ? 4 : 7)); // no máximo ~7 datas no eixo
    const last = points.length - 1;
    return `<svg class="chart evo-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução">
        <defs><linearGradient id="evoGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style="stop-color:var(--accent);stop-opacity:.25"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient></defs>
        ${[0, 0.5, 1].map(t => min + t * (max - min)).map(t => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/>
            <text x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end">${num(t, decimals)}</text>`).join('')}
        ${goal ? `<line class="goal-line" x1="${P.l}" x2="${W - P.r}" y1="${y(goal)}" y2="${y(goal)}"/>
            <text class="goal-text" x="${W - P.r}" y="${y(goal) - 6}" text-anchor="end">meta ${num(goal, decimals)} ${unit}</text>` : ''}
        <path class="area" d="${area}" style="fill:url(#evoGrad)"/>
        <path class="line" d="${path}"/>
        ${points.map((p, i) => `<g class="evo-pt">
            <circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="${i === last ? 6 : 4}"><title>${p.label}: ${num(p.v, decimals)} ${unit}</title></circle>
            ${i === 0 || i === last ? `<text class="pt-value" x="${x(i)}" y="${y(p.v) - 12}" text-anchor="${i === 0 ? 'start' : 'end'}">${num(p.v, decimals)} ${unit}</text>` : ''}
            ${(last - i) % every === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === last ? 'end' : i === 0 ? 'start' : 'middle'}">${p.label}</text>` : ''}</g>`).join('')}
    </svg>`;
}

function evolutionCard() {
    const [label, unit, dec] = EVO_METRICS[evoMetric];
    const from = evoRange === '3m' ? offsetDate(-91) : '';
    const rows = state.progress.filter(e => e.date >= from && e[evoMetric] !== null && e[evoMetric] !== undefined);
    const pts = rows.map(e => ({ v: +e[evoMetric], label: fmtDate(e.date) }));
    const goal = evoMetric === 'weight' ? myGoal().weight : null;
    const first = pts[0], lastP = pts.at(-1);
    const diff = first && lastP ? lastP.v - first.v : 0;
    const good = evoMetric === 'weight' && goal && first ? Math.abs(lastP.v - goal) <= Math.abs(first.v - goal) : diff <= 0;
    return `
    <div class="card-head" style="flex-wrap:wrap;gap:10px">
        <h2>Sua evolução</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div class="tabs" style="margin:0">${Object.entries(EVO_METRICS).map(([k, [l]]) =>
                `<button class="tab ${evoMetric === k ? 'active' : ''}" data-metric="${k}">${l}</button>`).join('')}</div>
            <select class="input" id="evo-range" style="width:auto">
                <option value="3m" ${evoRange === '3m' ? 'selected' : ''}>Últimos 3 meses</option>
                <option value="all" ${evoRange === 'all' ? 'selected' : ''}>Desde o início</option></select>
        </div>
    </div>
    ${pts.length ? `<div class="dash-summary">
        <div><span>Início (${rows[0] ? fmtDate(rows[0].date) : '—'})</span><b>${num(first.v, dec)} ${unit}</b></div>
        <div><span>Atual</span><b>${num(lastP.v, dec)} ${unit}</b></div>
        <div><span>Variação</span><b class="${diff ? (good ? 'up' : 'down') : ''}">${diff > 0 ? '+' : ''}${num(diff, dec)} ${unit}</b></div>
    </div>` : ''}
    ${evolutionChart(pts, { unit, decimals: dec, goal })}
    <div class="chart-legend"><span><i class="lg-rec"></i>${label}</span>${goal ? '<span><i class="lg-avg"></i>Sua meta</span>' : ''}
        <a href="#/cliente/evolucao" style="margin-left:auto">Registrar medição →</a></div>`;
}

// ---------- Para fazer hoje ----------
function clientTodo() {
    const items = []; // [feito?, ícone, texto, link]
    const w = todayWorkout();
    if (w) {
        const done = state.workoutDays.includes(today);
        const n = (state.doneExercises[doneKey(w.id)] || []).length;
        items.push([done, '🏋️', done ? `Treino ${esc(w.name.replace(/^Treino\s*/, ''))} concluído` : `Fazer o ${esc(w.name)}${n ? ` (${n}/${w.exercises.length} feitos)` : ''}`, `#/cliente/treinos/${w.id}`]);
    }
    const water = myLog().water, WATER_GOAL = waterGoal();
    items.push([water >= WATER_GOAL, '💧', water >= WATER_GOAL ? 'Meta de água batida' : `Beber água: ${liters(water)} de ${liters(WATER_GOAL)} L`, null, 'water']);
    const sessionToday = upcomingSessions(10).find(s => s.date === today);
    if (sessionToday) items.push([false, '📅', `${esc(sessionToday.title)} hoje às ${sessionToday.time}`, `#/cliente/agenda/${sessionToday.date}/${sessionToday.id}`]);
    const unpaid = invoicesOf(CLIENT).filter(i => !i.paidAt).sort((a, b) => a.due.localeCompare(b.due))[0];
    if (unpaid) {
        const days = daysBetween(today, unpaid.due);
        if (days < 0) items.push([false, '💳', `Mensalidade atrasada há ${plural(-days, 'dia', 'dias')} • ${money(unpaid.amount)}`, '#/cliente/pagamentos', 'late']);
        else if (days <= 7) items.push([false, '💳', `Mensalidade vence ${days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`} • ${money(unpaid.amount)}`, '#/cliente/pagamentos']);
    }
    const unread = Chat.unread();
    if (unread) items.push([false, '💬', `${plural(unread, 'mensagem nova', 'mensagens novas')} do coach`, '#/cliente/mensagens']);
    const evals = assessmentsOf(CLIENT);
    const lastEval = evals.at(-1);
    const age = lastEval ? daysBetween(lastEval.date, today) : Infinity;
    if (lastEval && isPending(lastEval)) items.push([true, '📸', `Fotos de ${fmtDate(lastEval.date)} enviadas • aguardando o coach`, '#/cliente/avaliacao']);
    else if (age >= 28) items.push([false, '📸', lastEval ? `Hora de mandar fotos novas (a última foi há ${age} dias)` : 'Enviar suas primeiras fotos para o coach', '#/cliente/avaliacao']);
    const open = items.filter(i => !i[0]).length;
    return { open, html: `<div class="list">${items.map(([done, ico, text, href, tone]) => tone === 'water'
        // Água: marca direto daqui, sem mudar de página
        ? `<div class="list-item todo-item ${done ? 'is-done' : ''}">
            <span class="todo-ico">${done ? '✓' : ico}</span><div class="grow title">${text}</div>
            ${done ? '' : '<button class="btn btn-sm" data-water="250">+250 ml</button>'}</div>`
        : `<a class="list-item clickable todo-item ${done ? 'is-done' : ''} ${tone || ''}" href="${href}">
            <span class="todo-ico">${done ? '✓' : ico}</span><div class="grow title">${text}</div><span class="muted">→</span></a>`).join('')}</div>` };
}

clientPages.dashboard = {
    title: () => `Olá, ${esc(user.name.split(' ')[0])} 👋`,
    sub: () => {
        const w = todayWorkout();
        return w ? `Hoje é dia de ${w.name} • ${w.focus}. Bora!` : 'Hoje é dia de descanso. Aproveite para recuperar.';
    },
    render() {
        const w = todayWorkout();
        const week = weekDays();
        const plan = myPlan();
        const doneThisWeek = week.filter(d => state.workoutDays.includes(d)).length;
        const last30 = state.workoutDays.filter(d => d > offsetDate(-30) && d <= today).length;
        const p = state.progress;
        const first = p[0], last = p.at(-1);
        const goal = myGoal();
        const hasGoal = last && goal.weight && first.weight !== goal.weight;
        const toGoal = hasGoal ? last.weight - goal.weight : 0;
        const goalPct = hasGoal ? Math.max(0, Math.min(1, (first.weight - last.weight) / (first.weight - goal.weight))) : 0;
        const doneIdx = w ? (state.doneExercises[doneKey(w.id)] || []) : [];
        const nw = w ? null : nextWorkout();
        const todo = clientTodo();
        const feedback = [...assessmentsOf(CLIENT)].reverse().find(x => x.feedback);
        const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        const plannedOn = d => plan.find(x => x.day === WEEKDAYS[(new Date(d + 'T12:00:00').getDay() + 6) % 7]);
        const sinceStart = (a, b) => a <= b ? '▼' : '▲';
        const noData = '<div class="value">—</div><div class="delta muted">Registre uma medição</div>';

        return `
        <div class="grid grid-4">
            <a class="card stat stat-link" href="#/cliente/evolucao">
                <div class="label">Peso atual <span class="stat-ico">⚖️</span></div>
                ${last ? `<div class="value">${num(last.weight)} <small>kg</small></div>
                <div class="delta ${last.weight <= first.weight ? 'up' : 'down'}">${sinceStart(last.weight, first.weight)} ${num(Math.abs(first.weight - last.weight))} kg desde ${fmtDate(first.date)}</div>` : noData}</a>
            <a class="card stat stat-link" href="#/cliente/perfil">
                <div class="label">Meta <span class="stat-ico">🎯</span></div>
                ${hasGoal ? `<div class="value">${Math.round(goalPct * 100)}<small>%</small></div>
                <div class="progress" style="margin:6px 0 4px"><span style="width:${goalPct * 100}%"></span></div>
                <div class="delta muted">${toGoal > 0 ? `faltam ${num(toGoal)} kg para ${num(goal.weight)} kg` : 'Meta alcançada! 🎉'}</div>`
                : '<div class="value">—</div><div class="delta muted">Defina seu peso-meta no perfil</div>'}</a>
            <a class="card stat stat-link" href="#/cliente/treinos">
                <div class="label">Treinos na semana <span class="stat-ico">🏋️</span></div>
                <div class="value">${doneThisWeek} <small>de ${WEEK_GOAL}</small></div>
                <div class="progress" style="margin:6px 0 4px"><span style="width:${Math.min(100, doneThisWeek / WEEK_GOAL * 100)}%"></span></div>
                <div class="delta muted">${plural(last30, 'treino', 'treinos')} nos últimos 30 dias</div></a>
            <div class="card stat">
                <div class="label">Água hoje <span class="stat-ico">💧</span></div>
                <div class="value">${liters(myLog().water)} <small>de ${liters(waterGoal())} L</small></div>
                <div class="progress" style="margin:6px 0 8px"><span style="width:${Math.min(100, myLog().water / waterGoal() * 100)}%"></span></div>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-sm" data-water="250">+250 ml</button>
                    <button class="btn btn-sm" data-water="500">+500 ml</button>
                    <button class="btn btn-sm btn-ghost" data-water="-250" title="Desfazer 250 ml">−</button>
                </div></div>
        </div>

        <div class="grid grid-main" style="margin-top:18px">
            <div class="card">
                <div class="card-head"><h2>Treino de hoje</h2><a href="#/cliente/treinos">Todos os treinos →</a></div>
                ${w ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
                        <div><b style="font-size:20px">${esc(w.name)} • ${esc(w.focus)}</b>
                            <div class="muted small">${w.exercises.length} exercícios • ~${w.duration} min</div></div>
                        <a class="btn btn-primary" href="#/cliente/treinos/${w.id}">${state.workoutDays.includes(today) ? 'Ver treino' : doneIdx.length ? 'Continuar' : 'Iniciar treino'} →</a>
                    </div>
                    <div class="macro-top"><span class="muted">Progresso</span><b>${doneIdx.length} de ${w.exercises.length}</b></div>
                    <div class="progress"><span style="width:${(doneIdx.length / w.exercises.length) * 100}%"></span></div>
                    <div class="list" style="margin-top:8px">
                        ${w.exercises.slice(0, 5).map((e, i) => `<div class="list-item">
                            <span class="badge ${doneIdx.includes(i) ? 'accent' : ''}">${doneIdx.includes(i) ? '✓' : i + 1}</span>
                            <div class="grow"><div class="title">${esc(e.name)}</div></div>
                            <span class="muted small">${e.sets} × ${e.reps}${e.load ? ` • ${esc(e.load)}` : ''}</span></div>`).join('')}
                    </div>
                    ${w.exercises.length > 5 ? `<a class="small muted" href="#/cliente/treinos/${w.id}" style="display:block;padding-top:10px">+ ${plural(w.exercises.length - 5, 'exercício', 'exercícios')} →</a>` : ''}`
                : `<div class="empty">🛌 Hoje é dia de descanso. Aproveite para recuperar!
                    ${nw ? `<div style="margin-top:10px">Próximo: <b>${esc(nw.w.name)} • ${esc(nw.w.focus)}</b> (${esc(nw.w.day.toLowerCase())})
                        <br><a href="#/cliente/treinos/${nw.w.id}" style="color:var(--accent)">Ver o treino →</a></div>` : ''}</div>`}
            </div>
            <div class="card todo-card">
                <div class="card-head"><h2>Para fazer hoje</h2>${todo.open ? `<span class="badge orange">${todo.open}</span>` : '<span class="badge green">Tudo feito ✓</span>'}</div>
                ${todo.html}
            </div>
        </div>

        <div class="grid grid-main" style="margin-top:18px">
            <div class="card" id="evo-card">${evolutionCard()}</div>
            <div class="card">
                <div class="card-head"><h2>Esta semana</h2><span class="muted small">${doneThisWeek} de ${WEEK_GOAL} treinos</span></div>
                <div class="week">
                    ${week.map((d, i) => {
                        const done = state.workoutDays.includes(d), planned = plannedOn(d);
                        const missed = planned && !done && d < today;
                        return `<div class="day ${done ? 'done' : ''} ${d === today ? 'today' : ''} ${missed ? 'missed' : ''}"
                            title="${done ? 'Treino feito' : planned ? `${planned.name}${missed ? ' (não feito)' : ''}` : 'Descanso'}">
                            ${dayNames[i]}<b>${fmtDate(d, { day: '2-digit' })}</b>
                            <small class="day-tag">${done ? '✓' : planned ? esc(planned.name.replace(/^Treino\s*/, '').slice(0, 2)) : '—'}</small></div>`;
                    }).join('')}
                </div>
                <div class="chart-legend" style="margin-top:10px;flex-wrap:wrap"><span><i class="lg-done"></i>Feito</span><span><i class="lg-planned"></i>Planejado</span><span><i class="lg-missed"></i>Não feito</span></div>
                <div class="card-head" style="margin:22px 0 10px"><h3>Próximas sessões</h3><a href="#/cliente/agenda">Agenda →</a></div>
                <div class="list">${upcomingSessions(3).map(sessionItem).join('') || '<div class="empty">Nenhuma sessão agendada. <a href="#/cliente/agenda" style="color:var(--accent)">Marcar horário →</a></div>'}</div>
            </div>
        </div>

        ${feedback ? `<div class="card eval-feedback-card" style="margin-top:18px">
            <div class="card-head"><h2>💬 Último comentário do coach</h2><a href="#/cliente/avaliacao">Avaliações →</a></div>
            <p class="muted small" style="margin:0 0 6px">Sobre as fotos de ${fmtDate(feedback.date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            <p style="margin:0;white-space:pre-line">${esc(feedback.feedback)}</p></div>` : ''}`;
    },
    bind(view) {
        view.querySelectorAll('[data-water]').forEach(b => b.onclick = () => {
            myLog().water = Math.max(0, myLog().water + Number(b.dataset.water));
            save(); route();
        });
        const bindEvo = () => {
            const card = view.querySelector('#evo-card');
            card.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { evoMetric = b.dataset.metric; card.innerHTML = evolutionCard(); bindEvo(); });
            card.querySelector('#evo-range').onchange = e => { evoRange = e.target.value; store.set('evo_range', evoRange); card.innerHTML = evolutionCard(); bindEvo(); };
        };
        bindEvo();
    }
};
