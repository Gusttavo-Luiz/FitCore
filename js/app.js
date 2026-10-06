// ---------- Estado persistido ----------
const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem('fitcore_' + key);
            return v ? JSON.parse(v) : fallback;
        } catch (_) { return fallback; }
    },
    // Retorna false se o navegador recusar (ex.: armazenamento cheio)
    set(key, value) {
        try { localStorage.setItem('fitcore_' + key, JSON.stringify(value)); return true; } catch (_) { return false; }
    }
};

// Aluno da área do aluno: na demonstração é sempre o Lucas; com o Supabase,
// é quem fez login (definido em Backend.boot)
let CLIENT = 'Lucas Andrade';
const DEFAULT_NOTES = 'Controle a fase excêntrica (3 segundos na descida). Se completar todas as repetições com boa execução, aumente 2 kg na próxima sessão.';
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const user = store.get('user', { name: 'Lucas Andrade', email: 'lucas@email.com', role: 'cliente' });
const today = localISO(new Date());

const state = {
    // { 'A|2026-10-06': [0, 2, 3] } — índices dos exercícios concluídos por treino/dia
    doneExercises: store.get('done', {}),
    // datas (YYYY-MM-DD) em que algum treino foi finalizado
    workoutDays: store.get('workoutDays', seedWorkoutDays()),
    progress: store.get('progress', SEED.progress),
    messages: store.get('messages', SEED.messages),
    water: store.get('water_' + today, 0),
    profile: store.get('profile', { height: 178, age: 29, phone: '(11) 98765-4321' }),
    // Fichas de treino por aluno: { 'Lucas Andrade': [ficha, ...] }
    plans: store.get('plans', { [CLIENT]: SEED.workouts.map(w => ({ ...w, notes: DEFAULT_NOTES })) }),
    // Link de vídeo por exercício da biblioteca: { 'supino-reto-com-barra': 'https://youtu.be/...' }
    videos: store.get('videos', {}),
    assessments: store.get('assessments', SEED.assessments),
    invoices: store.get('invoices', SEED.invoices),
    sessions: store.get('sessions', SEED.sessions)
};

function seedWorkoutDays() {
    // Treinos da semana atual até ontem (exemplo)
    const days = [];
    const d = new Date();
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    for (let i = 1; i <= Math.min(dow, 3); i++) days.push(offsetDate(-i));
    return days;
}

function save() {
    // Com o Supabase ligado, os dados vão para o banco (não ficam no navegador)
    if (Backend.enabled) { Backend.queueSync(); return true; }
    store.set('done', state.doneExercises);
    store.set('workoutDays', state.workoutDays);
    store.set('progress', state.progress);
    store.set('messages', state.messages);
    store.set('water_' + today, state.water);
    store.set('profile', state.profile);
    store.set('plans', state.plans);
    store.set('videos', state.videos);
    store.set('invoices', state.invoices);
    store.set('sessions', state.sessions);
    // Avaliações têm fotos e podem estourar o limite do navegador
    if (!store.set('assessments', state.assessments)) {
        toast('Armazenamento do navegador cheio: remova fotos antigas.');
        return false;
    }
    return true;
}

// ---------- Utilidades ----------
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
const fmtDate = (iso, opts = { day: '2-digit', month: 'short' }) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', opts).replace('.', '');
const num = (n, d = 1) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function planOf(student) {
    return state.plans[student] || (state.plans[student] = []);
}

function myPlan() { return planOf(CLIENT); }

function todayWorkout() {
    const dayName = WEEKDAYS[(new Date().getDay() + 6) % 7]; // segunda = 0
    return myPlan().find(w => w.day === dayName) || null;
}

function libByName(name) {
    return SEED.library.find(e => e.name.toLowerCase() === String(name).toLowerCase());
}

function modal(html, onClose) {
    const root = $('#modal');
    root.innerHTML = `<div class="modal">${html}</div>`;
    root.classList.add('open');
    root.onclick = e => {
        if (e.target === root || e.target.closest('[data-close]')) { closeModal(); if (onClose) onClose(); }
    };
    return root.querySelector('.modal');
}

function closeModal() {
    const root = $('#modal');
    root.classList.remove('open');
    root.innerHTML = '';
}

const money = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function weekDays() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return localISO(d);
    });
}

function doneKey(id) { return id + '|' + today; }

// ---------- Componentes ----------
function ring(pct, label) {
    const r = 50, c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(1, pct)));
    return `<svg class="ring" viewBox="0 0 120 120">
        <circle class="bg" cx="60" cy="60" r="${r}"></circle>
        <circle class="fg" cx="60" cy="60" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}"></circle>
        <text x="60" y="68" text-anchor="middle">${label}</text>
    </svg>`;
}

function lineChart(points, { suffix = '', decimals = 1 } = {}) {
    if (points.length < 2) return '<div class="empty">Registre ao menos duas medições para ver o gráfico.</div>';
    const W = 600, H = 220, P = { l: 44, r: 30, t: 16, b: 28 };
    const vals = points.map(p => p.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 1;
    min -= pad; max += pad;
    const x = i => P.l + (i * (W - P.l - P.r)) / (points.length - 1);
    const y = v => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${path} L${x(points.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
    const ticks = [0, 0.5, 1].map(t => min + t * (max - min));
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">
        <defs><linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style="stop-color:var(--accent);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient></defs>
        ${ticks.map(t => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/>
            <text x="4" y="${y(t) + 4}">${num(t, decimals)}${suffix}</text>`).join('')}
        <path class="area" d="${area}"/>
        <path class="line" d="${path}"/>
        ${points.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="4"><title>${p.label}: ${num(p.v, decimals)}${suffix}</title></circle>
            <text x="${x(i)}" y="${H - 8}" text-anchor="middle">${p.label}</text>`).join('')}
    </svg>`;
}

function barChart(values, labels) {
    const W = 600, H = 220, P = { l: 8, r: 8, t: 20, b: 28 };
    const max = Math.max(...values, 1) * 1.1; // evita divisão por zero quando tudo é 0
    const bw = (W - P.l - P.r) / values.length;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">
        ${values.map((v, i) => {
            const h = (v / max) * (H - P.t - P.b);
            const x = P.l + i * bw + bw * 0.2;
            const last = i === values.length - 1;
            return `<rect x="${x}" y="${H - P.b - h}" width="${bw * 0.6}" height="${h}" rx="6"
                        style="fill:${last ? 'var(--accent)' : 'var(--border-hover)'}"><title>R$ ${v.toLocaleString('pt-BR')}</title></rect>
                    <text x="${x + bw * 0.3}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>`;
        }).join('')}
    </svg>`;
}

const SESSION_COLORS = { Presencial: 'accent', Online: 'blue', Avaliação: 'orange' };
const STATUS_BADGE = { confirmada: ['green', 'Confirmada'], pendente: ['orange', 'Aguardando'], cancelada: ['red', 'Cancelada'] };

// Sessões visíveis para quem está logado (o aluno só vê as próprias)
function visibleSessions({ includeCancelled = false } = {}) {
    return state.sessions
        .filter(s => (user.role === 'personal' || s.student === CLIENT) && (includeCancelled || s.status !== 'cancelada'))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function upcomingSessions(limit) {
    const now = localISO(new Date()) + new Date().toTimeString().slice(0, 5);
    return visibleSessions().filter(s => s.date + s.time >= now).slice(0, limit);
}

function sessionItem(s) {
    const [statusColor, statusLabel] = STATUS_BADGE[s.status] || ['', ''];
    const who = user.role === 'personal' ? ` • ${esc(s.student)}` : '';
    return `<a class="list-item clickable ${s.status === 'cancelada' ? 'cancelled' : ''}" href="#/${user.role}/agenda/${s.date}/${s.id}">
        <div class="date-box"><b>${fmtDate(s.date, { day: '2-digit' })}</b><span>${fmtDate(s.date, { month: 'short' })}</span></div>
        <div class="grow"><div class="title">${esc(s.title)}</div><div class="meta">${s.time} • ${esc(s.place)}${who}</div></div>
        <div class="session-badges"><span class="badge ${SESSION_COLORS[s.type] || ''}">${s.type}</span>
            ${s.status !== 'confirmada' ? `<span class="badge ${statusColor}">${statusLabel}</span>` : ''}</div>
    </a>`;
}

// ---------- Páginas do aluno ----------
const clientPages = {
    dashboard: {
        title: () => `Olá, ${esc(user.name.split(' ')[0])} 👋`,
        sub: () => 'Aqui está o resumo da sua semana.',
        render() {
            const w = todayWorkout();
            const week = weekDays();
            const doneThisWeek = week.filter(d => state.workoutDays.includes(d)).length;
            const p = state.progress;
            const first = p[0], last = p.at(-1);
            // Meta: na demonstração vem dos dados de exemplo; com o Supabase, do perfil do aluno
            const goal = Backend.enabled
                ? { weight: state.profile.targetWeight, label: (Backend.profile && Backend.profile.goal) || 'Meta' }
                : SEED.goal;
            const hasGoal = last && goal.weight && first.weight !== goal.weight;
            const toGoal = hasGoal ? last.weight - goal.weight : 0;
            const goalPct = hasGoal ? Math.max(0, Math.min(1, (first.weight - last.weight) / (first.weight - goal.weight))) : 0;
            const noData = '<div class="value">—</div><div class="muted small"><a href="#/cliente/evolucao">Registrar medição →</a></div>';
            const doneIdx = w ? (state.doneExercises[doneKey(w.id)] || []) : [];
            const next = upcomingSessions(3);
            const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

            return `
            <div class="grid grid-4">
                <div class="card stat"><div class="label">Peso atual <span class="stat-ico">⚖️</span></div>
                    ${last ? `<div class="value">${num(last.weight)} <small>kg</small></div>
                    <div class="delta ${last.weight <= first.weight ? 'up' : 'down'}">${last.weight <= first.weight ? '▼' : '▲'} ${num(Math.abs(first.weight - last.weight))} kg desde o início</div>` : noData}</div>
                <div class="card stat"><div class="label">Gordura corporal <span class="stat-ico">🔥</span></div>
                    ${last ? `<div class="value">${num(last.fat)} <small>%</small></div>
                    <div class="delta ${last.fat <= first.fat ? 'up' : 'down'}">${last.fat <= first.fat ? '▼' : '▲'} ${num(Math.abs(first.fat - last.fat))} p.p.</div>` : noData}</div>
                <div class="card stat"><div class="label">Treinos na semana <span class="stat-ico">🏋️</span></div>
                    <div class="value">${doneThisWeek} <small>/ 5</small></div>
                    <div class="progress" style="margin-top:8px"><span style="width:${Math.min(100, doneThisWeek * 20)}%"></span></div></div>
                <div class="card stat"><div class="label">Água hoje <span class="stat-ico">💧</span></div>
                    <div class="value">${num(state.water / 1000)} <small>/ 3 L</small></div>
                    <div style="display:flex;gap:6px;margin-top:6px">
                        <button class="btn btn-sm" data-water="250">+250 ml</button>
                        <button class="btn btn-sm" data-water="-250">−</button>
                    </div></div>
            </div>

            <div class="grid grid-main" style="margin-top:18px">
                <div class="card">
                    <div class="card-head"><h2>Treino de hoje</h2><a href="#/cliente/treinos">Ver todos →</a></div>
                    ${w ? `
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
                            <div><b style="font-size:20px">${esc(w.name)} • ${esc(w.focus)}</b>
                                <div class="muted small">${w.exercises.length} exercícios • ~${w.duration} min</div></div>
                            <a class="btn btn-primary" href="#/cliente/treinos/${w.id}">${doneIdx.length ? 'Continuar' : 'Iniciar treino'} →</a>
                        </div>
                        <div class="macro-top"><span class="muted">Progresso</span><b>${doneIdx.length}/${w.exercises.length}</b></div>
                        <div class="progress"><span style="width:${(doneIdx.length / w.exercises.length) * 100}%"></span></div>
                        <div class="list" style="margin-top:8px">
                            ${w.exercises.slice(0, 4).map((e, i) => `<div class="list-item">
                                <span class="badge ${doneIdx.includes(i) ? 'accent' : ''}">${doneIdx.includes(i) ? '✓' : i + 1}</span>
                                <div class="grow"><div class="title">${esc(e.name)}</div></div>
                                <span class="muted small">${e.sets} × ${e.reps}</span></div>`).join('')}
                        </div>`
                    : '<div class="empty">🛌 Hoje é dia de descanso. Aproveite para recuperar!</div>'}
                </div>

                <div class="card">
                    <div class="card-head"><h2>Meta</h2><span class="badge accent">${esc(goal.label)}</span></div>
                    ${hasGoal ? `<div class="ring-wrap">
                        ${ring(goalPct, Math.round(goalPct * 100) + '%')}
                        <div><div class="muted small">Faltam</div><b style="font-size:24px">${num(Math.abs(toGoal))} kg</b>
                            <div class="muted small">para ${num(goal.weight)} kg</div></div>
                    </div>` : `<div class="empty">Defina seu peso-meta no <a href="#/cliente/perfil" style="color:var(--accent)">perfil</a>
                        e registre uma medição para acompanhar o progresso.</div>`}
                    <div class="card-head" style="margin:20px 0 10px"><h3>Esta semana</h3></div>
                    <div class="week">
                        ${week.map((d, i) => `<div class="day ${state.workoutDays.includes(d) ? 'done' : ''} ${d === today ? 'today' : ''}">
                            ${dayNames[i]}<b>${fmtDate(d, { day: '2-digit' })}</b>${state.workoutDays.includes(d) ? '<div class="dot"></div>' : ''}</div>`).join('')}
                    </div>
                </div>
            </div>

            <div class="grid grid-main" style="margin-top:18px">
                <div class="card">
                    <div class="card-head"><h2>Evolução do peso</h2><a href="#/cliente/evolucao">Detalhes →</a></div>
                    ${lineChart(p.map(e => ({ v: e.weight, label: fmtDate(e.date) })), { suffix: '' })}
                </div>
                <div class="card">
                    <div class="card-head"><h2>Próximas sessões</h2><a href="#/cliente/agenda">Agenda →</a></div>
                    <div class="list">${next.map(sessionItem).join('') || '<div class="empty">Nenhuma sessão agendada.</div>'}</div>
                </div>
            </div>`;
        },
        bind(view) {
            view.querySelectorAll('[data-water]').forEach(b => b.onclick = () => {
                state.water = Math.max(0, state.water + Number(b.dataset.water));
                save(); route();
            });
        }
    },

    treinos: {
        title: () => 'Meus treinos',
        sub: () => `Ficha montada por ${SEED.trainer.name}`,
        render(param) {
            const plan = myPlan();
            const w = plan.find(x => x.id === param) || todayWorkout() || plan[0];
            if (!w) return '<div class="card empty">Seu personal ainda não montou suas fichas de treino.</div>';
            const done = state.doneExercises[doneKey(w.id)] || [];
            const finished = state.workoutDays.includes(today);
            return `
            <div class="tabs">
                ${plan.map(x => `<a class="tab ${x.id === w.id ? 'active' : ''}" href="#/cliente/treinos/${x.id}">${x.name}</a>`).join('')}
            </div>
            <div class="grid grid-main">
                <div class="card">
                    <div class="card-head">
                        <div><h2>${esc(w.name)} — ${esc(w.focus)}</h2><div class="muted small">${w.day} • ~${w.duration} min</div></div>
                        <span class="badge ${done.length === w.exercises.length ? 'accent' : ''}">${done.length}/${w.exercises.length}</span>
                    </div>
                    ${w.exercises.map((e, i) => `
                        <div class="exercise ${done.includes(i) ? 'done' : ''}">
                            <button class="check" data-ex="${i}" aria-label="Marcar ${esc(e.name)}">${done.includes(i) ? '✓' : ''}</button>
                            <div><div class="ex-name">${esc(e.name)}${libByName(e.name)
                                ? ` <a class="small" style="color:var(--accent)" href="#/cliente/biblioteca/${libByName(e.name).id}">▶ ver execução</a>` : ''}</div>
                                <div class="ex-meta"><span class="badge">${e.sets} séries</span><span class="badge">${e.reps} reps</span>
                                <span class="badge blue">${e.load}</span><span class="badge">⏱ ${e.rest}</span></div></div>
                            <span class="muted small">#${i + 1}</span>
                        </div>`).join('')}
                    <button class="btn btn-primary btn-block" id="finish" style="margin-top:16px" ${finished ? 'disabled' : ''}>
                        ${finished ? '✓ Treino de hoje finalizado' : 'Finalizar treino'}</button>
                </div>
                <div class="card">
                    <div class="card-head"><h2>Cronômetro de descanso</h2></div>
                    <div style="text-align:center">
                        <div id="timer" style="font-size:56px;font-weight:800;letter-spacing:-2px">00:00</div>
                        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">
                            ${[45, 60, 90, 120].map(s => `<button class="btn btn-sm" data-rest="${s}">${s}s</button>`).join('')}
                            <button class="btn btn-sm btn-ghost" data-rest="0">Parar</button>
                        </div>
                    </div>
                    <div class="card-head" style="margin-top:24px"><h3>Observações do personal</h3></div>
                    <p class="muted small">${esc(w.notes || 'Sem observações para esta ficha.')}</p>
                </div>
            </div>`;
        },
        bind(view, param) {
            const plan = myPlan();
            const w = plan.find(x => x.id === param) || todayWorkout() || plan[0];
            if (!w) return;
            const key = doneKey(w.id);
            view.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => {
                const i = Number(b.dataset.ex);
                const list = state.doneExercises[key] || [];
                state.doneExercises[key] = list.includes(i) ? list.filter(x => x !== i) : [...list, i];
                save(); route();
            });
            const finish = view.querySelector('#finish');
            finish.onclick = () => {
                if (!state.workoutDays.includes(today)) state.workoutDays.push(today);
                state.doneExercises[key] = w.exercises.map((_, i) => i);
                save(); toast('Treino finalizado! 🔥'); route();
            };
            const timerEl = view.querySelector('#timer');
            view.querySelectorAll('[data-rest]').forEach(b => b.onclick = () => {
                clearInterval(window.__restTimer);
                let left = Number(b.dataset.rest);
                const draw = () => timerEl.textContent =
                    String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
                draw();
                if (!left) return;
                window.__restTimer = setInterval(() => {
                    left--; draw();
                    if (left <= 0) { clearInterval(window.__restTimer); toast('Descanso encerrado — próxima série!'); }
                }, 1000);
            });
        }
    },

    dieta: {
        title: () => 'Plano alimentar',
        sub: () => 'Refeições e metas de macronutrientes do dia',
        render() {
            const m = SEED.macros;
            const eaten = store.get('meals_' + today, []);
            const kcal = SEED.meals.reduce((t, x, i) => t + (eaten.includes(i) ? x.kcal : 0), 0);
            const ratio = kcal / m.kcal;
            const macro = (label, total, unit, color) => `<div class="macro">
                <div class="macro-top"><span>${label}</span><b>${Math.round(total * ratio)} / ${total} ${unit}</b></div>
                <div class="progress"><span style="width:${ratio * 100}%;background:${color}"></span></div></div>`;
            return `
            <div class="grid grid-main">
                <div class="card">
                    <div class="card-head"><h2>Refeições de hoje</h2><span class="muted small">Toque para marcar como feita</span></div>
                    ${SEED.meals.map((x, i) => `
                        <div class="meal" data-meal="${i}" style="cursor:pointer;${eaten.includes(i) ? 'border-color:var(--accent)' : ''}">
                            <div class="meal-head">
                                <div><b>${x.name}</b> <span class="muted small">• ${x.time}</span></div>
                                <span class="badge ${eaten.includes(i) ? 'accent' : ''}">${eaten.includes(i) ? '✓ Feita' : x.kcal + ' kcal'}</span>
                            </div>
                            <ul>${x.items.map(it => `<li>• ${esc(it)}</li>`).join('')}</ul>
                        </div>`).join('')}
                </div>
                <div class="card">
                    <div class="card-head"><h2>Resumo</h2></div>
                    <div class="ring-wrap" style="margin-bottom:20px">
                        ${ring(ratio, kcal)}
                        <div><div class="muted small">de</div><b style="font-size:22px">${m.kcal} kcal</b></div>
                    </div>
                    ${macro('Proteínas', m.protein, 'g', 'var(--accent)')}
                    ${macro('Carboidratos', m.carbs, 'g', 'var(--blue)')}
                    ${macro('Gorduras', m.fat, 'g', 'var(--orange)')}
                    <p class="muted small" style="margin-top:12px">💡 Beba pelo menos 3 L de água e evite pular refeições.</p>
                </div>
            </div>`;
        },
        bind(view) {
            view.querySelectorAll('[data-meal]').forEach(el => el.onclick = () => {
                const i = Number(el.dataset.meal);
                const eaten = store.get('meals_' + today, []);
                store.set('meals_' + today, eaten.includes(i) ? eaten.filter(x => x !== i) : [...eaten, i]);
                route();
            });
        }
    },

    evolucao: {
        title: () => 'Minha evolução',
        sub: () => 'Peso, gordura corporal e medidas',
        render() {
            const p = state.progress;
            return `
            <div class="grid grid-2">
                <div class="card"><div class="card-head"><h2>Peso (kg)</h2></div>
                    ${lineChart(p.map(e => ({ v: e.weight, label: fmtDate(e.date) })))}</div>
                <div class="card"><div class="card-head"><h2>Gordura corporal (%)</h2></div>
                    ${lineChart(p.map(e => ({ v: e.fat, label: fmtDate(e.date) })), { suffix: '%' })}</div>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-head"><h2>Nova medição</h2></div>
                <form id="progress-form" class="form-row">
                    <label class="field">Data<input class="input" type="date" name="date" value="${today}" required></label>
                    <label class="field">Peso (kg)<input class="input" type="number" step="0.1" name="weight" required></label>
                    <label class="field">Gordura (%)<input class="input" type="number" step="0.1" name="fat" required></label>
                    <label class="field">Cintura (cm)<input class="input" type="number" step="0.5" name="waist" required></label>
                    <button class="btn btn-primary" type="submit">Salvar</button>
                </form>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-head"><h2>Histórico</h2></div>
                <div class="table-wrap"><table>
                    <thead><tr><th>Data</th><th>Peso</th><th>Gordura</th><th>Cintura</th><th>IMC</th><th></th></tr></thead>
                    <tbody>${[...p].reverse().map(e => {
                        const imc = e.weight / Math.pow(state.profile.height / 100, 2);
                        return `<tr><td>${fmtDate(e.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                            <td>${num(e.weight)} kg</td><td>${num(e.fat)}%</td><td>${num(e.waist)} cm</td><td>${num(imc)}</td>
                            <td><button class="btn btn-ghost btn-sm" data-del="${e.date}" title="Remover">✕</button></td></tr>`;
                    }).join('')}</tbody>
                </table></div>
            </div>`;
        },
        bind(view) {
            const f = view.querySelector('#progress-form');
            f.onsubmit = e => {
                e.preventDefault();
                const entry = { date: f.date.value, weight: +f.weight.value, fat: +f.fat.value, waist: +f.waist.value };
                state.progress = [...state.progress.filter(x => x.date !== entry.date), entry]
                    .sort((a, b) => a.date.localeCompare(b.date));
                save(); toast('Medição registrada!'); route();
            };
            view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
                if (state.progress.length <= 1) return toast('Mantenha ao menos uma medição.');
                state.progress = state.progress.filter(x => x.date !== b.dataset.del);
                save(); route();
            });
        }
    },


    mensagens: {
        title: () => 'Mensagens',
        sub: () => `Conversa com ${SEED.trainer.name}`,
        render: renderChat,
        bind: bindChat
    },

    perfil: {
        title: () => 'Meu perfil',
        sub: () => 'Dados pessoais e assinatura',
        render() {
            const pr = state.profile;
            return `
            <div class="grid grid-main">
                <div class="card">
                    <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
                        <div class="avatar lg">${initials(user.name)}</div>
                        <div><h2>${esc(user.name)}</h2><div class="muted">${esc(user.email)}</div></div>
                    </div>
                    <form id="profile-form" class="form-row">
                        <label class="field">Altura (cm)<input class="input" type="number" name="height" value="${pr.height}"></label>
                        <label class="field">Idade<input class="input" type="number" name="age" value="${pr.age}"></label>
                        <label class="field">Telefone<input class="input" name="phone" value="${esc(pr.phone)}"></label>
                        <label class="field">Peso-meta (kg)<input class="input" type="number" step="0.1" name="targetWeight" value="${pr.targetWeight ?? (Backend.enabled ? '' : SEED.goal.weight)}"></label>
                        <button class="btn btn-primary" type="submit">Salvar</button>
                    </form>
                </div>
                <div class="card">
                    <div class="card-head"><h2>Assinatura</h2><span class="badge green">Ativa</span></div>
                    <div class="list">
                        <div class="list-item"><div class="grow muted">Plano</div><b>${esc(myPlanName())}</b></div>
                        <div class="list-item"><div class="grow muted">Valor</div><b>${money(SEED.planPrices[myPlanName()] || 0)}/mês</b></div>
                        <div class="list-item"><div class="grow muted">Cobranças</div><a href="#/cliente/pagamentos" style="color:var(--accent)">Ver pagamentos →</a></div>
                        <div class="list-item"><div class="grow muted">Coach</div><b>${SEED.trainer.name}</b></div>
                        ${SEED.trainer.cref ? `<div class="list-item"><div class="grow muted">Registro</div><b>${esc(SEED.trainer.cref)}</b></div>` : ''}
                        <div class="list-item"><div class="grow muted">Instagram</div><a href="${SITE.instagram}" target="_blank" rel="noopener" style="color:var(--accent)">${SITE.instagramHandle} ↗</a></div>
                    </div>
                </div>
            </div>`;
        },
        bind(view) {
            const f = view.querySelector('#profile-form');
            f.onsubmit = e => {
                e.preventDefault();
                state.profile = { height: +f.height.value, age: +f.age.value, phone: f.phone.value,
                    targetWeight: f.targetWeight.value ? +f.targetWeight.value : null };
                save(); toast('Perfil atualizado!');
            };
        }
    }
};

function myPlanName() {
    return (Backend.enabled && Backend.profile && Backend.profile.plan) || 'Performance';
}

// ---------- Páginas compartilhadas ----------
function renderChat() {
    // O chat ainda não passa pelo banco: com o Supabase ligado, a conversa é pelo WhatsApp
    if (Backend.enabled) {
        return `<div class="card empty" style="padding:40px">
            <p style="margin-bottom:16px">O chat dentro do app chega em breve.<br>Por enquanto, fale direto pelo WhatsApp.</p>
            ${SITE.whatsapp ? `<a class="btn brand-wa" target="_blank" rel="noopener"
                href="https://wa.me/${SITE.whatsapp.replace(/\D/g, '')}">Abrir WhatsApp</a>` : ''}
        </div>`;
    }
    const other = user.role === 'personal' ? 'Lucas Andrade' : SEED.trainer.name;
    return `
    <div class="card chat">
        <div class="card-head"><div class="cell-user"><div class="avatar">${initials(other)}</div>
            <div><b>${other}</b><div class="small" style="color:var(--green)">● online</div></div></div></div>
        <div class="chat-body" id="chat-body">
            ${state.messages.map(m => {
                // No painel do personal, os papéis se invertem
                const mine = user.role === 'personal' ? m.from === 'them' : m.from === 'me';
                return `<div class="msg ${mine ? 'me' : 'them'}">${esc(m.text)}<small>${m.at}</small></div>`;
            }).join('')}
        </div>
        <form class="chat-form" id="chat-form">
            <input class="input" name="text" placeholder="Escreva uma mensagem..." autocomplete="off">
            <button class="btn btn-primary" type="submit">Enviar</button>
        </form>
    </div>`;
}

function bindChat(view) {
    if (Backend.enabled) return;
    const body = view.querySelector('#chat-body');
    body.scrollTop = body.scrollHeight;
    const f = view.querySelector('#chat-form');
    f.text.focus();
    f.onsubmit = e => {
        e.preventDefault();
        const text = f.text.value.trim();
        if (!text) return;
        const at = new Date().toTimeString().slice(0, 5);
        state.messages.push({ from: user.role === 'personal' ? 'them' : 'me', text, at });
        save(); route();
        if (user.role !== 'personal') {
            setTimeout(() => {
                state.messages.push({ from: 'them', text: 'Recebido! Já te respondo com mais detalhes 👊', at: new Date().toTimeString().slice(0, 5) });
                save();
                if (location.hash.includes('mensagens')) route();
            }, 1500);
        }
    };
}

// ---------- Páginas do personal ----------
const statusBadge = s => ({ Ativo: 'green', Atenção: 'orange', Pendente: 'red', Convidado: 'blue' }[s] || '');

// editable: mostra o botão "Editar" (plano, objetivo e status) em cada linha
function studentsTable(list, { editable = false } = {}) {
    return `<div class="table-wrap"><table>
        <thead><tr><th>Aluno</th><th>Plano</th><th>Objetivo</th><th>Aderência</th><th>Último treino</th><th>Vencimento</th><th>Status</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>${list.map(s => `<tr>
            <td><div class="cell-user"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(s.name)}</div>${esc(s.name)}</div></td>
            <td>${s.plan}</td><td>${s.goal}</td>
            <td><div style="display:flex;align-items:center;gap:8px;min-width:120px"><div class="progress" style="flex:1"><span style="width:${s.adherence}%"></span></div>${s.adherence}%</div></td>
            <td class="muted">${s.lastWorkout}</td><td>${s.due}</td>
            <td><span class="badge ${statusBadge(s.status)}">${s.status}</span></td>
            ${editable ? `<td><button class="btn btn-sm" data-edit-student="${esc(s.name)}">Editar</button></td>` : ''}</tr>`).join('')}</tbody>
    </table></div>`;
}

// Janela para o coach mudar plano, objetivo e status de um aluno
function openStudentEditor(student) {
    if (!student) return;
    const invited = student.status === 'Convidado';
    const opts = (list, cur) => list.map(o => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('');
    const m = modal(`
        <h3>${esc(student.name)}</h3>
        <p class="sub">${invited ? 'Convite ainda não aceito: o plano e o objetivo valem quando a conta for criada.' : 'Alterar plano, objetivo e status do aluno.'}</p>
        <form id="student-edit">
            <label class="field">Plano<select class="input" name="plan">${opts(Object.keys(SEED.planPrices), student.plan)}</select></label>
            <p class="muted small" id="plan-price"></p>
            <label class="field">Objetivo<select class="input" name="goal">${opts(['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Saúde'], student.goal)}</select></label>
            ${invited ? '' : `<label class="field">Status<select class="input" name="status">${opts(['Ativo', 'Atenção', 'Pendente', 'Inativo'], student.status)}</select></label>`}
            <p class="small down" id="edit-msg" hidden></p>
            <button class="btn btn-primary btn-block" type="submit">Salvar</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    const f = m.querySelector('#student-edit');
    const price = () => { m.querySelector('#plan-price').textContent = `${money(SEED.planPrices[f.plan.value])}/mês — vale para as próximas cobranças.`; };
    f.plan.onchange = price; price();
    f.onsubmit = async e => {
        e.preventDefault();
        const data = { plan: f.plan.value, goal: f.goal.value, status: invited ? student.status : f.status.value };
        const btn = f.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
            if (Backend.enabled) await Backend.updateStudent(student, data);
            else { Object.assign(student, data); store.set('students', SEED.students); }
            toast('Aluno atualizado!');
            route();
        } catch (err) {
            const msg = m.querySelector('#edit-msg'); msg.hidden = false; msg.textContent = err.message;
            btn.disabled = false;
        }
    };
}

// Alunos com conta + convites ainda não aceitos (só na lista de Alunos)
function allStudentsForList() {
    return [...SEED.students, ...(SEED.invites || [])];
}

// Soma das cobranças pagas em cada um dos últimos 6 meses
function revenueLast6Months() {
    return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
        const ym = localISO(d).slice(0, 7);
        return state.invoices.filter(x => x.paidAt && x.paidAt.slice(0, 7) === ym).reduce((t, x) => t + x.amount, 0);
    });
}

const trainerPages = {
    dashboard: {
        title: () => `Olá, ${esc(user.name.split(' ')[0])} 👋`,
        sub: () => 'Visão geral dos seus alunos e do negócio.',
        render() {
            const st = SEED.students;
            const active = st.filter(s => s.status !== 'Pendente');
            const avg = active.length ? Math.round(active.reduce((t, s) => t + s.adherence, 0) / active.length) : 0;
            const rev = Backend.enabled ? revenueLast6Months() : SEED.revenue;
            const months = Array.from({ length: rev.length }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - (rev.length - 1 - i));
                return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            });
            const growth = rev.at(-2) ? ((rev.at(-1) / rev.at(-2)) - 1) * 100 : 0;
            const todaySessions = upcomingSessions(4);
            return `
            <div class="grid grid-4">
                <div class="card stat"><div class="label">Alunos ativos <span class="stat-ico">👥</span></div>
                    <div class="value">${active.length}</div><div class="delta up">▲ 2 este mês</div></div>
                <div class="card stat"><div class="label">Faturamento do mês <span class="stat-ico">💰</span></div>
                    <div class="value"><small>R$</small> ${rev[rev.length - 1].toLocaleString('pt-BR')}</div>
                    <div class="delta up">▲ ${num(growth)}% vs mês anterior</div></div>
                <div class="card stat"><div class="label">Aderência média <span class="stat-ico">📊</span></div>
                    <div class="value">${avg}<small>%</small></div>
                    <div class="progress" style="margin-top:8px"><span style="width:${avg}%"></span></div></div>
                <div class="card stat"><div class="label">Precisam de atenção <span class="stat-ico">⚠️</span></div>
                    <div class="value">${st.filter(s => s.status !== 'Ativo').length}</div><div class="delta down">baixa frequência ou pagamento</div></div>
            </div>
            <div class="grid grid-main" style="margin-top:18px">
                <div class="card"><div class="card-head"><h2>Faturamento (6 meses)</h2></div>${barChart(rev, months)}</div>
                <div class="card"><div class="card-head"><h2>Próximas sessões</h2><a href="#/personal/agenda">Agenda →</a></div>
                    <div class="list">${todaySessions.map(sessionItem).join('') || '<div class="empty">Nenhuma sessão agendada.</div>'}</div></div>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-head"><h2>Alunos</h2><a href="#/personal/alunos">Ver todos →</a></div>
                ${studentsTable(st.slice(0, 4))}
            </div>`;
        }
    },

    alunos: {
        title: () => 'Alunos',
        sub: () => `${SEED.students.length} alunos cadastrados` + ((SEED.invites || []).length ? ` • ${SEED.invites.length} convite(s) pendente(s)` : ''),
        render() {
            const planOpts = Object.keys(SEED.planPrices).map(p => `<option ${p === 'Performance' ? 'selected' : ''}>${p}</option>`).join('');
            const goalOpts = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Saúde'].map(g => `<option>${g}</option>`).join('');
            return `
            <div class="card">
                <div class="card-head">
                    <input class="input" id="search" placeholder="Buscar aluno..." style="max-width:320px">
                    <select class="input" id="filter" style="max-width:180px">
                        <option value="">Todos os status</option><option>Ativo</option><option>Atenção</option><option>Pendente</option><option>Inativo</option>
                        ${Backend.enabled ? '<option>Convidado</option>' : ''}
                    </select>
                </div>
                <div id="students">${studentsTable(allStudentsForList(), { editable: true })}</div>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-head"><h2>Cadastrar aluno</h2></div>
                ${Backend.enabled ? `<p class="muted small" style="margin-bottom:14px">O aluno recebe um e-mail com um link de acesso.
                    Ao clicar, entra no site e cria a própria senha. O plano e o objetivo já ficam no perfil dele.</p>` : ''}
                <form id="student-form" class="form-row">
                    <label class="field">Nome<input class="input" name="name" required autocomplete="off"></label>
                    ${Backend.enabled ? '<label class="field">E-mail<input class="input" type="email" name="email" required autocomplete="off"></label>' : ''}
                    <label class="field">Plano<select class="input" name="plan">${planOpts}</select></label>
                    <label class="field">Objetivo<select class="input" name="goal">${goalOpts}</select></label>
                    <button class="btn btn-primary" type="submit">${Backend.enabled ? 'Cadastrar e enviar convite' : 'Adicionar'}</button>
                </form>
                <p class="small" id="invite-msg" hidden></p>
            </div>`;
        },
        bind(view) {
            const search = view.querySelector('#search'), filter = view.querySelector('#filter');
            const update = () => {
                const q = search.value.toLowerCase();
                view.querySelector('#students').innerHTML = studentsTable(allStudentsForList().filter(s =>
                    s.name.toLowerCase().includes(q) && (!filter.value || s.status === filter.value)), { editable: true });
                bindEditButtons();
            };
            const bindEditButtons = () => view.querySelectorAll('[data-edit-student]').forEach(b => b.onclick = () =>
                openStudentEditor(allStudentsForList().find(s => s.name === b.dataset.editStudent)));
            bindEditButtons();
            search.oninput = update; filter.onchange = update;
            const f = view.querySelector('#student-form');
            f.onsubmit = async e => {
                e.preventDefault();
                const data = { name: f.name.value.trim(), plan: f.plan.value, goal: f.goal.value };
                if (!Backend.enabled) {
                    SEED.students.push({ ...data, adherence: 0, lastWorkout: '—', status: 'Pendente', due: '—' });
                    store.set('students', SEED.students);
                    toast('Aluno cadastrado!'); route();
                    return;
                }
                const btn = f.querySelector('button'), msg = view.querySelector('#invite-msg');
                btn.disabled = true;
                try {
                    const mailError = await Backend.inviteStudent({ ...data, email: f.email.value });
                    if (!mailError) { toast(`Convite enviado para ${f.email.value.trim()}`); route(); return; }
                    // O convite ficou salvo; só o e-mail falhou (ex.: limite de envios do Supabase)
                    route();
                    const m = $('#invite-msg');
                    m.hidden = false; m.className = 'small down';
                    m.textContent = `Aluno cadastrado, mas o e-mail não foi enviado (${mailError}). ` +
                        'Ele pode entrar em "Criar conta" no site com esse mesmo e-mail: o plano e o objetivo já ficam no perfil.';
                } catch (err) {
                    msg.hidden = false; msg.className = 'small down'; msg.textContent = err.message;
                } finally {
                    btn.disabled = false;
                }
            };
        }
    },

    mensagens: { title: () => 'Mensagens', sub: () => 'Conversa com Lucas Andrade', render: renderChat, bind: bindChat }
};

SEED.students = store.get('students', SEED.students);

// ---------- Navegação ----------
const NAV = {
    cliente: [
        ['dashboard', '🏠', 'Dashboard'], ['treinos', '🏋️', 'Treinos'], ['biblioteca', '🎬', 'Exercícios'], ['dieta', '🥗', 'Dieta'],
        ['evolucao', '📈', 'Evolução'], ['avaliacao', '📸', 'Avaliação física'], ['agenda', '📅', 'Agenda'],
        ['pagamentos', '💳', 'Pagamentos'], ['mensagens', '💬', 'Mensagens'], ['perfil', '👤', 'Perfil']
    ],
    personal: [
        ['dashboard', '🏠', 'Dashboard'], ['alunos', '👥', 'Alunos'], ['fichas', '📋', 'Fichas de treino'],
        ['biblioteca', '🎬', 'Exercícios'], ['avaliacoes', '📸', 'Avaliações'], ['financeiro', '💰', 'Financeiro'],
        ['agenda', '📅', 'Agenda'], ['mensagens', '💬', 'Mensagens']
    ]
};

function navBadge(role, id) {
    if (id === 'mensagens') return '<span class="badge accent">2</span>';
    if (id === 'agenda') {
        // Coach: solicitações aguardando confirmação
        const n = role === 'personal' ? state.sessions.filter(s => s.status === 'pendente').length : 0;
        return n ? `<span class="badge orange">${n}</span>` : '';
    }
    return '';
}

function route() {
    // Formato: #/cliente/dashboard ou #/cliente/treinos/A
    let [, role, page, param, extra] = location.hash.split('/');
    if (role !== 'cliente' && role !== 'personal') role = user.role || 'cliente';
    // Com login de verdade, cada um vê só a própria área
    if (Backend.enabled) role = user.role;
    const pages = role === 'personal' ? trainerPages : clientPages;
    if (!pages[page]) page = 'dashboard';
    user.role = role;

    $('#side-nav').innerHTML = `<div class="side-label">${role === 'personal' ? 'Coach' : 'Aluno'}</div>` +
        NAV[role].map(([id, ico, label]) => `<a class="side-link ${id === page ? 'active' : ''}" href="#/${role}/${id}">
            <span class="ico">${ico}</span>${label}${navBadge(role, id)}</a>`).join('') +
        (Backend.enabled ? '' : `<div class="side-label">Alternar</div>
         <a class="side-link" href="#/${role === 'personal' ? 'cliente' : 'personal'}/dashboard"><span class="ico">🔁</span>Ver como ${role === 'personal' ? 'aluno' : 'coach'}</a>`);

    // Na demonstração, o painel do coach é sempre do Sidnei e a área do aluno é sempre do Lucas
    const name = Backend.enabled ? user.name : role === 'personal' ? SEED.trainer.name
        : user.name === SEED.trainer.name || user.name === 'Carla Pereira' ? CLIENT : user.name;
    user.name = name;
    $('#user-avatar').textContent = initials(name);
    $('#user-name').textContent = name;
    $('#user-role').textContent = role === 'personal' ? 'Coach' : 'Aluno • ' + myPlanName();

    const p = pages[page];
    $('#page-title').innerHTML = p.title();
    $('#page-sub').textContent = p.sub();
    $('#page-actions').innerHTML = page === 'dashboard' && role === 'cliente'
        ? '<a class="btn btn-primary" href="#/cliente/treinos">▶ Treinar agora</a>' : '';

    const view = $('#view');
    closeModal();
    view.innerHTML = p.render(param, extra);
    if (p.bind) p.bind(view, param, extra);
    $('#sidebar').classList.remove('open');
    document.title = `Sidnei Muller Coach — ${NAV[role].find(n => n[0] === page)[2]}`;
}

$('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');
$('#logout').onclick = async () => {
    try { localStorage.removeItem('fitcore_user'); } catch (_) {}
    if (Backend.enabled) {
        try { await Backend.flush(); await Backend.signOut(); } catch (err) { console.error(err); }
    }
    location.href = 'index.html';
};
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });

// Início: com o Supabase, carrega a conta e os dados antes de desenhar a primeira tela.
// As telas de js/features/ registram suas páginas antes disso (DOMContentLoaded).
async function boot() {
    if (!Backend.enabled) return route();
    $('#view').innerHTML = '<div class="card empty">Carregando seus dados…</div>';
    try {
        if (!(await Backend.boot())) { location.href = 'index.html'; return; }
        Object.assign(user, Backend.siteUser(Backend.profile));
        SEED.trainer.name = SITE.coach;
        route();
    } catch (err) {
        console.error(err);
        $('#view').innerHTML = `<div class="card empty">Não foi possível carregar seus dados.<br>${esc(err.message)}<br><br>
            <button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
    }
}
window.addEventListener('DOMContentLoaded', boot);
