// ---------- Estado persistido ----------
const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem('fitcore_' + key);
            return v ? JSON.parse(v) : fallback;
        } catch (_) { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem('fitcore_' + key, JSON.stringify(value)); } catch (_) {}
    }
};

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
    profile: store.get('profile', { height: 178, age: 29, phone: '(11) 98765-4321' })
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
    store.set('done', state.doneExercises);
    store.set('workoutDays', state.workoutDays);
    store.set('progress', state.progress);
    store.set('messages', state.messages);
    store.set('water_' + today, state.water);
    store.set('profile', state.profile);
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

function todayWorkout() {
    const dow = (new Date().getDay() + 6) % 7; // segunda = 0
    return SEED.workouts[dow] || null; // sábado/domingo: descanso
}

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
            <stop offset="0" stop-color="#c6f432" stop-opacity=".28"/><stop offset="1" stop-color="#c6f432" stop-opacity="0"/>
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
    const max = Math.max(...values) * 1.1;
    const bw = (W - P.l - P.r) / values.length;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">
        ${values.map((v, i) => {
            const h = (v / max) * (H - P.t - P.b);
            const x = P.l + i * bw + bw * 0.2;
            const last = i === values.length - 1;
            return `<rect x="${x}" y="${H - P.b - h}" width="${bw * 0.6}" height="${h}" rx="6"
                        fill="${last ? '#c6f432' : '#2a303a'}"><title>R$ ${v.toLocaleString('pt-BR')}</title></rect>
                    <text x="${x + bw * 0.3}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>`;
        }).join('')}
    </svg>`;
}

function sessionItem(s) {
    const color = { Presencial: 'accent', Online: 'blue', Avaliação: 'orange' }[s.type] || '';
    return `<div class="list-item">
        <div class="date-box"><b>${fmtDate(s.date, { day: '2-digit' })}</b><span>${fmtDate(s.date, { month: 'short' })}</span></div>
        <div class="grow"><div class="title">${esc(s.title)}</div><div class="meta">${s.time} • ${esc(s.place)}</div></div>
        <span class="badge ${color}">${s.type}</span>
    </div>`;
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
            const first = p[0], last = p[p.length - 1];
            const toGoal = last.weight - SEED.goal.weight;
            const goalPct = (first.weight - last.weight) / (first.weight - SEED.goal.weight);
            const doneIdx = w ? (state.doneExercises[doneKey(w.id)] || []) : [];
            const next = SEED.sessions.filter(s => s.date >= today).slice(0, 3);
            const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

            return `
            <div class="grid grid-4">
                <div class="card stat"><div class="label">Peso atual <span class="stat-ico">⚖️</span></div>
                    <div class="value">${num(last.weight)} <small>kg</small></div>
                    <div class="delta down">▼ ${num(first.weight - last.weight)} kg desde o início</div></div>
                <div class="card stat"><div class="label">Gordura corporal <span class="stat-ico">🔥</span></div>
                    <div class="value">${num(last.fat)} <small>%</small></div>
                    <div class="delta up">▼ ${num(first.fat - last.fat)} p.p.</div></div>
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
                            <div><b style="font-size:20px">${w.name} • ${w.focus}</b>
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
                    <div class="card-head"><h2>Meta</h2><span class="badge accent">${esc(SEED.goal.label)}</span></div>
                    <div class="ring-wrap">
                        ${ring(goalPct, Math.round(goalPct * 100) + '%')}
                        <div><div class="muted small">Faltam</div><b style="font-size:24px">${num(toGoal)} kg</b>
                            <div class="muted small">para ${SEED.goal.weight} kg</div></div>
                    </div>
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
            const w = SEED.workouts.find(x => x.id === param) || todayWorkout() || SEED.workouts[0];
            const done = state.doneExercises[doneKey(w.id)] || [];
            const finished = state.workoutDays.includes(today);
            return `
            <div class="tabs">
                ${SEED.workouts.map(x => `<a class="tab ${x.id === w.id ? 'active' : ''}" href="#/cliente/treinos/${x.id}">${x.name}</a>`).join('')}
            </div>
            <div class="grid grid-main">
                <div class="card">
                    <div class="card-head">
                        <div><h2>${w.name} — ${w.focus}</h2><div class="muted small">${w.day} • ~${w.duration} min</div></div>
                        <span class="badge ${done.length === w.exercises.length ? 'accent' : ''}">${done.length}/${w.exercises.length}</span>
                    </div>
                    ${w.exercises.map((e, i) => `
                        <div class="exercise ${done.includes(i) ? 'done' : ''}">
                            <button class="check" data-ex="${i}" aria-label="Marcar ${esc(e.name)}">${done.includes(i) ? '✓' : ''}</button>
                            <div><div class="ex-name">${esc(e.name)}</div>
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
                    <p class="muted small">Controle a fase excêntrica (3 segundos na descida). Se completar todas as repetições com boa execução, aumente 2 kg na próxima sessão.</p>
                </div>
            </div>`;
        },
        bind(view, param) {
            const w = SEED.workouts.find(x => x.id === param) || todayWorkout() || SEED.workouts[0];
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

    agenda: {
        title: () => 'Agenda',
        sub: () => 'Suas aulas e avaliações',
        render: renderAgenda
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
                        <button class="btn btn-primary" type="submit">Salvar</button>
                    </form>
                </div>
                <div class="card">
                    <div class="card-head"><h2>Assinatura</h2><span class="badge green">Ativa</span></div>
                    <div class="list">
                        <div class="list-item"><div class="grow muted">Plano</div><b>Performance</b></div>
                        <div class="list-item"><div class="grow muted">Valor</div><b>R$ 149/mês</b></div>
                        <div class="list-item"><div class="grow muted">Próxima cobrança</div><b>10/10</b></div>
                        <div class="list-item"><div class="grow muted">Personal</div><b>${SEED.trainer.name}</b></div>
                        <div class="list-item"><div class="grow muted">Registro</div><b>${SEED.trainer.cref}</b></div>
                    </div>
                </div>
            </div>`;
        },
        bind(view) {
            const f = view.querySelector('#profile-form');
            f.onsubmit = e => {
                e.preventDefault();
                state.profile = { height: +f.height.value, age: +f.age.value, phone: f.phone.value };
                save(); toast('Perfil atualizado!');
            };
        }
    }
};

// ---------- Páginas compartilhadas ----------
function renderAgenda() {
    const upcoming = SEED.sessions.filter(s => s.date >= today);
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const sessionDates = new Set(SEED.sessions.map(s => s.date));
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div></div>');
    for (let d = 1; d <= daysInMonth; d++) {
        const iso = localISO(new Date(now.getFullYear(), now.getMonth(), d));
        cells.push(`<div class="day ${sessionDates.has(iso) ? 'done' : ''} ${iso === today ? 'today' : ''}"><b>${d}</b>${sessionDates.has(iso) ? '<div class="dot"></div>' : ''}</div>`);
    }
    return `
    <div class="grid grid-main">
        <div class="card">
            <div class="card-head"><h2>Próximas sessões</h2></div>
            <div class="list">${upcoming.map(sessionItem).join('') || '<div class="empty">Nenhuma sessão agendada.</div>'}</div>
        </div>
        <div class="card">
            <div class="card-head"><h2 style="text-transform:capitalize">${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2></div>
            <div class="week" style="margin-bottom:6px">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(d => `<div class="muted small" style="text-align:center">${d}</div>`).join('')}</div>
            <div class="week">${cells.join('')}</div>
        </div>
    </div>`;
}

function renderChat() {
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
const statusBadge = s => ({ Ativo: 'green', Atenção: 'orange', Pendente: 'red' }[s] || '');

function studentsTable(list) {
    return `<div class="table-wrap"><table>
        <thead><tr><th>Aluno</th><th>Plano</th><th>Objetivo</th><th>Aderência</th><th>Último treino</th><th>Vencimento</th><th>Status</th></tr></thead>
        <tbody>${list.map(s => `<tr>
            <td><div class="cell-user"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(s.name)}</div>${esc(s.name)}</div></td>
            <td>${s.plan}</td><td>${s.goal}</td>
            <td><div style="display:flex;align-items:center;gap:8px;min-width:120px"><div class="progress" style="flex:1"><span style="width:${s.adherence}%"></span></div>${s.adherence}%</div></td>
            <td class="muted">${s.lastWorkout}</td><td>${s.due}</td>
            <td><span class="badge ${statusBadge(s.status)}">${s.status}</span></td></tr>`).join('')}</tbody>
    </table></div>`;
}

const trainerPages = {
    dashboard: {
        title: () => `Olá, ${esc(user.name.split(' ')[0])} 👋`,
        sub: () => 'Visão geral dos seus alunos e do negócio.',
        render() {
            const st = SEED.students;
            const active = st.filter(s => s.status !== 'Pendente');
            const avg = Math.round(active.reduce((t, s) => t + s.adherence, 0) / active.length);
            const rev = SEED.revenue;
            const months = Array.from({ length: rev.length }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - (rev.length - 1 - i));
                return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            });
            const growth = ((rev[rev.length - 1] / rev[rev.length - 2]) - 1) * 100;
            const todaySessions = SEED.sessions.filter(s => s.date >= today).slice(0, 4);
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
                    <div class="list">${todaySessions.map(s => sessionItem({ ...s, title: s.title + ' — Lucas' })).join('')}</div></div>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-head"><h2>Alunos</h2><a href="#/personal/alunos">Ver todos →</a></div>
                ${studentsTable(st.slice(0, 4))}
            </div>`;
        }
    },

    alunos: {
        title: () => 'Alunos',
        sub: () => `${SEED.students.length} alunos cadastrados`,
        render() {
            return `
            <div class="card">
                <div class="card-head">
                    <input class="input" id="search" placeholder="Buscar aluno..." style="max-width:320px">
                    <select class="input" id="filter" style="max-width:180px">
                        <option value="">Todos os status</option><option>Ativo</option><option>Atenção</option><option>Pendente</option>
                    </select>
                </div>
                <div id="students">${studentsTable(SEED.students)}</div>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-head"><h2>Cadastrar aluno</h2></div>
                <form id="student-form" class="form-row">
                    <label class="field">Nome<input class="input" name="name" required></label>
                    <label class="field">Plano<select class="input" name="plan"><option>Essencial</option><option>Performance</option><option>Premium</option></select></label>
                    <label class="field">Objetivo<select class="input" name="goal"><option>Hipertrofia</option><option>Emagrecimento</option><option>Condicionamento</option><option>Saúde</option></select></label>
                    <button class="btn btn-primary" type="submit">Adicionar</button>
                </form>
            </div>`;
        },
        bind(view) {
            const search = view.querySelector('#search'), filter = view.querySelector('#filter');
            const update = () => {
                const q = search.value.toLowerCase();
                view.querySelector('#students').innerHTML = studentsTable(SEED.students.filter(s =>
                    s.name.toLowerCase().includes(q) && (!filter.value || s.status === filter.value)));
            };
            search.oninput = update; filter.onchange = update;
            const f = view.querySelector('#student-form');
            f.onsubmit = e => {
                e.preventDefault();
                SEED.students.push({ name: f.name.value.trim(), plan: f.plan.value, goal: f.goal.value, adherence: 0, lastWorkout: '—', status: 'Pendente', due: '—' });
                store.set('students', SEED.students);
                toast('Aluno cadastrado!'); route();
            };
        }
    },

    agenda: { title: () => 'Agenda', sub: () => 'Sessões com seus alunos', render: renderAgenda },
    mensagens: { title: () => 'Mensagens', sub: () => 'Conversa com Lucas Andrade', render: renderChat, bind: bindChat }
};

SEED.students = store.get('students', SEED.students);

// ---------- Navegação ----------
const NAV = {
    cliente: [
        ['dashboard', '🏠', 'Dashboard'], ['treinos', '🏋️', 'Treinos'], ['dieta', '🥗', 'Dieta'],
        ['evolucao', '📈', 'Evolução'], ['agenda', '📅', 'Agenda'], ['mensagens', '💬', 'Mensagens'], ['perfil', '👤', 'Perfil']
    ],
    personal: [
        ['dashboard', '🏠', 'Dashboard'], ['alunos', '👥', 'Alunos'], ['agenda', '📅', 'Agenda'], ['mensagens', '💬', 'Mensagens']
    ]
};

function route() {
    // Formato: #/cliente/dashboard ou #/cliente/treinos/A
    let [, role, page, param] = location.hash.split('/');
    if (role !== 'cliente' && role !== 'personal') role = user.role || 'cliente';
    const pages = role === 'personal' ? trainerPages : clientPages;
    if (!pages[page]) page = 'dashboard';
    user.role = role;

    $('#side-nav').innerHTML = `<div class="side-label">${role === 'personal' ? 'Personal' : 'Aluno'}</div>` +
        NAV[role].map(([id, ico, label]) => `<a class="side-link ${id === page ? 'active' : ''}" href="#/${role}/${id}">
            <span class="ico">${ico}</span>${label}${id === 'mensagens' ? '<span class="badge accent">2</span>' : ''}</a>`).join('') +
        `<div class="side-label">Alternar</div>
         <a class="side-link" href="#/${role === 'personal' ? 'cliente' : 'personal'}/dashboard"><span class="ico">🔁</span>Ver como ${role === 'personal' ? 'aluno' : 'personal'}</a>`;

    const name = role === 'personal' && user.name === 'Lucas Andrade' ? SEED.trainer.name
        : role === 'cliente' && user.name === SEED.trainer.name ? 'Lucas Andrade' : user.name;
    user.name = name;
    $('#user-avatar').textContent = initials(name);
    $('#user-name').textContent = name;
    $('#user-role').textContent = role === 'personal' ? 'Personal Trainer' : 'Aluno • Performance';

    const p = pages[page];
    $('#page-title').innerHTML = p.title();
    $('#page-sub').textContent = p.sub();
    $('#page-actions').innerHTML = page === 'dashboard' && role === 'cliente'
        ? '<a class="btn btn-primary" href="#/cliente/treinos">▶ Treinar agora</a>' : '';

    const view = $('#view');
    view.innerHTML = p.render(param);
    if (p.bind) p.bind(view, param);
    $('#sidebar').classList.remove('open');
    document.title = `FitCore Pro — ${NAV[role].find(n => n[0] === page)[2]}`;
}

$('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');
$('#logout').onclick = () => {
    try { localStorage.removeItem('fitcore_user'); } catch (_) {}
    location.href = 'index.html';
};
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });
route();
