// ---------- Painel (dashboard) do coach ----------
// Indicadores clicáveis, "Para fazer agora", recebido por mês com filtro de
// período, próximas sessões e a lista de alunos com busca, filtros e motivo de atenção.
const LOW_ADHERENCE = 60; // abaixo disso o aluno entra em "Precisam de atenção"
let dashPeriod = +store.get('dash_period', 6) || 6;
let dashFilter = '';      // '' | 'att' | 'pay' | 'adh'
let dashQuery = '';
let dashPlan = '';
let dashSort = 'name';
let dashSessions = null;  // null = hoje, ou os próximos 7 dias se hoje estiver vazio

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Motivos para o coach olhar um aluno com mais cuidado
function studentAlerts(s) {
    const alerts = [];
    const late = state.invoices.filter(i => i.student === s.name && invoiceStatus(i).key === 'atrasado');
    if (late.length) alerts.push({ key: 'pay', color: 'red', label: `Pagamento atrasado (${money(sumBy(late))})` });
    if (!['Convidado', 'Inativo', 'Pendente'].includes(s.status) && s.adherence < LOW_ADHERENCE)
        alerts.push({ key: 'adh', color: 'orange', label: `Aderência baixa (${s.adherence}%)` });
    if (s.status === 'Atenção') alerts.push({ key: 'flag', color: 'orange', label: 'Marcado para atenção' });
    if (s.status === 'Pendente') alerts.push({ key: 'flag', color: 'orange', label: 'Cadastro pendente' });
    return alerts;
}

const needsAttention = s => studentAlerts(s).length > 0;

const DASH_FILTERS = [
    ['', 'Todos', () => true],
    ['att', 'Precisam de atenção', needsAttention],
    ['pay', 'Pagamento atrasado', s => studentAlerts(s).some(a => a.key === 'pay')],
    ['adh', `Aderência abaixo de ${LOW_ADHERENCE}%`, s => studentAlerts(s).some(a => a.key === 'adh')]
];

function dashStudents() {
    const q = dashQuery.toLowerCase();
    const test = DASH_FILTERS.find(f => f[0] === dashFilter)[2];
    const sorters = {
        name: (a, b) => a.name.localeCompare(b.name),
        adhLow: (a, b) => a.adherence - b.adherence,
        adhHigh: (a, b) => b.adherence - a.adherence,
        alerts: (a, b) => studentAlerts(b).length - studentAlerts(a).length || a.name.localeCompare(b.name)
    };
    return SEED.students.filter(s => test(s) && (!dashPlan || s.plan === dashPlan) && (!q || s.name.toLowerCase().includes(q)))
        .sort(sorters[dashSort]);
}

function dashTable() {
    const list = dashStudents();
    if (!list.length) return '<div class="empty">Nenhum aluno com esse filtro.</div>';
    return `<div class="table-wrap"><table class="dash-table">
        <thead><tr><th>Aluno</th><th>Plano</th><th>Aderência</th><th>Último treino</th><th>Vencimento</th><th>Situação</th><th></th></tr></thead>
        <tbody>${list.map(s => {
            const alerts = studentAlerts(s);
            const chatId = chatIdOf(s.name);
            return `<tr>
            <td><div class="cell-user"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(s.name)}</div>${esc(s.name)}</div></td>
            <td>${esc(s.plan)}</td>
            <td><div class="adh ${s.adherence < LOW_ADHERENCE ? 'low' : ''}"><div class="progress"><span style="width:${s.adherence}%"></span></div>${s.adherence}%</div></td>
            <td class="muted">${esc(s.lastWorkout)}</td><td>${esc(studentDue(s))}</td>
            <td><div class="alert-badges">${alerts.length ? alerts.map(a => `<span class="badge ${a.color}">${a.label}</span>`).join('')
                : '<span class="badge green">Em dia ✓</span>'}</div></td>
            <td>${chatId ? `<a class="btn btn-ghost btn-sm" href="#/personal/mensagens/${encodeURIComponent(chatId)}" title="Abrir conversa">💬</a>` : ''}</td>
        </tr>`;
        }).join('')}</tbody>
    </table></div>`;
}

// ---------- Recebido por mês ----------
function receivedChart(months) {
    const cur = today.slice(0, 7);
    const rows = months.map(ym => {
        const paid = state.invoices.filter(i => i.paidAt && ymOf(i.paidAt) === ym);
        return { ym, v: sumBy(paid), n: paid.length, partial: ym === cur };
    });
    const full = rows.filter(r => !r.partial);
    const avg = full.length ? sumBy(full, r => r.v) / full.length : 0;
    // Largo no computador (o gráfico ocupa a linha toda); mais estreito no celular para o texto não ficar miúdo
    const W = innerWidth < 760 ? 520 : 1000, H = innerWidth < 760 ? 280 : 260, P = { l: 64, r: 12, t: 24, b: 30 };
    const raw = Math.max(...rows.map(r => r.v), avg, 1) * 1.08;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const max = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(f => f * mag).find(v => v >= raw);
    const step = (W - P.l - P.r) / rows.length, bw = Math.min(46, step * 0.56);
    const y = v => P.t + (1 - v / max) * (H - P.t - P.b);
    const showValues = rows.length <= (W > 600 ? 12 : 6);
    const bar = (x, v, cls) => {
        const top = y(v), base = y(0), h = base - top, r = Math.min(5, h);
        if (h <= 0) return '';
        return `<path class="${cls}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
    };
    const chart = `<svg class="chart fin-chart dash-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Valor recebido por mês">
        <defs><pattern id="hatch-dash" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs>
        ${[0, 0.5, 1].map(t => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(t * max)}" y2="${y(t * max)}"/>
            <text x="${P.l - 8}" y="${y(t * max) + 4}" text-anchor="end">${moneyShort(t * max)}</text>`).join('')}
        ${avg ? `<line class="avg-line" x1="${P.l}" x2="${W - P.r}" y1="${y(avg)}" y2="${y(avg)}"/>` : ''}
        ${rows.map((r, i) => {
            const cx = P.l + step * i + step / 2;
            return `<g class="fin-group">
                ${bar(cx - bw / 2, r.v, r.partial ? 'bar-partial' : 'bar-rec')}
                ${showValues && r.v ? (y(0) - y(r.v) > 28 && !r.partial
                    ? `<text class="bar-value inside" x="${cx}" y="${y(r.v) + 17}" text-anchor="middle">${moneyShort(r.v)}</text>`
                    : `<text class="bar-value" x="${cx}" y="${y(r.v) - 6}" text-anchor="middle">${moneyShort(r.v)}</text>`) : ''}
                ${W < 600 && rows.length > 6 && (rows.length - 1 - i) % 2 ? '' : `<text x="${cx}" y="${H - 8}" text-anchor="middle">${ymLabel(r.ym)}</text>`}
                <rect class="hit" x="${cx - step / 2}" y="${P.t}" width="${step}" height="${H - P.t - P.b}">
                    <title>${ymLabel(r.ym, true)}${r.partial ? ' (até hoje)' : ''}&#10;Recebido: ${money(r.v)}&#10;${plural(r.n, 'pagamento', 'pagamentos')}</title></rect>
            </g>`;
        }).join('')}
    </svg>`;
    const best = full.length ? full.reduce((a, b) => b.v > a.v ? b : a) : null;
    const total = sumBy(rows, r => r.v);
    const summary = `<div class="dash-summary">
        <div><span>Total no período</span><b>${money(total)}</b></div>
        <div><span>Média por mês</span><b>${money(avg)}</b></div>
        <div><span>Melhor mês</span><b>${best && best.v ? `${ymLabel(best.ym)} • ${moneyShort(best.v)}` : '—'}</b></div>
    </div>`;
    const table = `<details class="fin-table"><summary class="small muted">Ver em tabela</summary>
        <div class="table-wrap"><table><thead><tr><th>Mês</th><th>Recebido</th><th>Pagamentos</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${ymLabel(r.ym, true)}${r.partial ? ' (até hoje)' : ''}</td><td>${money(r.v)}</td><td>${r.n}</td></tr>`).join('')}</tbody></table></div></details>`;
    return { chart, summary, table, avg };
}

// ---------- Para fazer agora ----------
function dashTodo() {
    const photos = pendingReviews().length;
    const requests = state.sessions.filter(s => s.status === 'pendente' && s.date >= today).length;
    const late = state.invoices.filter(i => invoiceStatus(i).key === 'atrasado');
    const unread = Chat.unread();
    const items = [
        [photos, '📸', plural(photos, 'envio de fotos para avaliar', 'envios de fotos para avaliar'), '#/personal/avaliacoes', ''],
        [requests, '📅', plural(requests, 'pedido de horário para confirmar', 'pedidos de horário para confirmar'), '#/personal/agenda', ''],
        [late.length, '💳', `${plural(late.length, 'cobrança atrasada', 'cobranças atrasadas')} • ${money(sumBy(late))}`, '#/personal/financeiro', 'late'],
        [unread, '💬', plural(unread, 'mensagem não lida', 'mensagens não lidas'), '#/personal/mensagens', '']
    ].filter(i => i[0]);
    return items.length ? `<div class="list">${items.map(([, ico, text, href, act]) => `
        <a class="list-item clickable todo-item" href="${href}" ${act ? `data-todo="${act}"` : ''}>
            <span class="todo-ico">${ico}</span><div class="grow title">${text}</div><span class="muted">→</span></a>`).join('')}</div>`
        : '<div class="empty" style="padding:18px 0">Tudo em dia ✓ Nada pendente agora.</div>';
}

function dashSessionsList() {
    const until = dashSessions === 'today' ? today : offsetDate(7);
    const list = upcomingSessions(50).filter(s => s.date <= until);
    return list.slice(0, 4).map(sessionItem).join('')
        + (list.length > 4 ? `<a class="small muted" href="#/personal/agenda" style="display:block;padding-top:10px">+ ${plural(list.length - 4, 'sessão', 'sessões')} na agenda →</a>` : '')
        || `<div class="empty" style="padding:18px 0">Nenhuma sessão ${dashSessions === 'today' ? 'hoje' : 'nos próximos 7 dias'}.</div>`;
}

trainerPages.dashboard = {
    title: () => `Olá, ${esc(user.name.split(' ')[0])} 👋`,
    sub: () => 'O que precisa da sua atenção e como está o negócio.',
    render() {
        const st = SEED.students;
        const active = st.filter(s => !['Pendente', 'Inativo'].includes(s.status));
        const avg = active.length ? Math.round(sumBy(active, s => s.adherence) / active.length) : 0;
        const low = st.filter(s => studentAlerts(s).some(a => a.key === 'adh')).length;
        const attention = st.filter(needsAttention).length;
        const fin = financeNumbers();
        const toReceive = state.invoices.filter(i => !i.paidAt && ymOf(i.due) === today.slice(0, 7));
        const months = lastMonths(dashPeriod);
        const rc = receivedChart(months);
        const countSessions = until => upcomingSessions(50).filter(s => s.date <= until).length;
        if (!dashSessions) dashSessions = countSessions(today) ? 'today' : 'week';
        return `
        <div class="grid grid-4">
            <button class="card stat stat-link" data-kpi="">
                <div class="label">Alunos ativos <span class="stat-ico">👥</span></div>
                <div class="value">${active.length}</div><div class="delta muted">de ${st.length} cadastrados</div></button>
            <a class="card stat stat-link" href="#/personal/financeiro">
                <div class="label">Recebido em ${ymLabel(today.slice(0, 7), true).split(' ')[0].toLowerCase()} <span class="stat-ico">💰</span></div>
                <div class="value">${money(fin.receivedTotal).replace(',00', '')}</div>
                <div class="delta muted">${toReceive.length ? `${money(sumBy(toReceive))} ainda a receber este mês` : 'Nada a receber este mês'}</div></a>
            <button class="card stat stat-link" data-kpi="adh">
                <div class="label">Aderência média <span class="stat-ico">📊</span></div>
                <div class="value">${avg}<small>%</small></div>
                <div class="progress" style="margin:6px 0 4px"><span style="width:${avg}%"></span></div>
                <div class="delta ${low ? 'down' : 'muted'}">${low ? `${plural(low, 'aluno', 'alunos')} abaixo de ${LOW_ADHERENCE}%` : 'Todos acima de ' + LOW_ADHERENCE + '%'}</div></button>
            <button class="card stat stat-link" data-kpi="att">
                <div class="label">Precisam de atenção <span class="stat-ico">⚠️</span></div>
                <div class="value">${attention}</div>
                <div class="delta ${attention ? 'down' : 'muted'}">${attention ? 'Clique para ver quem e por quê' : 'Ninguém agora ✓'}</div></button>
        </div>

        <div class="grid grid-2" style="margin-top:18px">
            <div class="card">
                <div class="card-head"><h2>Para fazer agora</h2></div>
                ${dashTodo()}
            </div>
            <div class="card">
                <div class="card-head" style="flex-wrap:wrap;gap:8px"><h2>Próximas sessões</h2><a href="#/personal/agenda">Agenda →</a></div>
                <div class="tabs" style="margin-bottom:6px">
                    <button class="tab ${dashSessions === 'today' ? 'active' : ''}" data-sessions="today">Hoje (${countSessions(today)})</button>
                    <button class="tab ${dashSessions === 'week' ? 'active' : ''}" data-sessions="week">7 dias (${countSessions(offsetDate(7))})</button>
                </div>
                <div class="list" id="dash-sessions">${dashSessionsList()}</div>
            </div>
        </div>

        <div class="card" style="margin-top:18px">
            <div class="card-head" style="flex-wrap:wrap;gap:10px">
                <h2>Recebido por mês</h2>
                <div class="tabs" style="margin:0">${[3, 6, 12].map(n =>
                    `<button class="tab ${dashPeriod === n ? 'active' : ''}" data-period="${n}">${n} meses</button>`).join('')}</div>
            </div>
            ${rc.summary}
            ${rc.chart}
            <div class="chart-legend"><span><i class="lg-rec"></i>Recebido</span><span><i class="lg-partial"></i>Mês atual (até hoje)</span>
                ${rc.avg ? '<span><i class="lg-avg"></i>Média dos meses fechados</span>' : ''}</div>
            ${rc.table}
        </div>

        <div class="card" style="margin-top:18px" id="dash-students">
            <div class="card-head"><h2>Alunos</h2><a href="#/personal/alunos">Gerenciar alunos →</a></div>
            <div class="fin-toolbar">
                <input class="input" id="dash-search" placeholder="Buscar aluno..." value="${esc(dashQuery)}">
                <select class="input" id="dash-plan"><option value="">Todos os planos</option>
                    ${Object.keys(SEED.planPrices).map(p => `<option ${p === dashPlan ? 'selected' : ''}>${p}</option>`).join('')}</select>
                <select class="input" id="dash-sort">
                    ${[['name', 'Ordenar: nome'], ['alerts', 'Ordenar: mais alertas'], ['adhLow', 'Ordenar: menor aderência'], ['adhHigh', 'Ordenar: maior aderência']]
                        .map(([k, l]) => `<option value="${k}" ${k === dashSort ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </div>
            <div class="tabs" id="dash-filters">${DASH_FILTERS.map(([k, l, f]) =>
                `<button class="tab ${dashFilter === k ? 'active' : ''}" data-filter="${k}">${l} (${st.filter(f).length})</button>`).join('')}</div>
            <div id="dash-table">${dashTable()}</div>
        </div>`;
    },
    bind(view) {
        const redrawTable = () => { view.querySelector('#dash-table').innerHTML = dashTable(); };
        const setFilter = k => {
            dashFilter = k;
            view.querySelectorAll('#dash-filters .tab').forEach(t => t.classList.toggle('active', t.dataset.filter === k));
            redrawTable();
        };
        view.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => setFilter(b.dataset.filter));
        view.querySelectorAll('[data-kpi]').forEach(b => b.onclick = () => {
            setFilter(b.dataset.kpi);
            view.querySelector('#dash-students').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        view.querySelector('#dash-search').oninput = e => { dashQuery = e.target.value; redrawTable(); };
        view.querySelector('#dash-plan').onchange = e => { dashPlan = e.target.value; redrawTable(); };
        view.querySelector('#dash-sort').onchange = e => { dashSort = e.target.value; redrawTable(); };
        view.querySelectorAll('[data-period]').forEach(b => b.onclick = () => {
            dashPeriod = +b.dataset.period; store.set('dash_period', dashPeriod); route();
        });
        view.querySelectorAll('[data-sessions]').forEach(b => b.onclick = () => {
            dashSessions = b.dataset.sessions;
            view.querySelectorAll('[data-sessions]').forEach(t => t.classList.toggle('active', t === b));
            view.querySelector('#dash-sessions').innerHTML = dashSessionsList();
        });
        // Atalho: abre o Financeiro já filtrado nas cobranças atrasadas
        view.querySelectorAll('[data-todo=late]').forEach(a => a.onclick = () => { finTab = 'cobrancas'; finFilter = 'atrasado'; finMonth = ''; finQuery = ''; });
    }
};
