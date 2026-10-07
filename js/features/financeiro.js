// ---------- Financeiro do coach ----------
// Indicadores do mês, receitas x despesas, cobranças (receber, cobrar no WhatsApp,
// recibo, editar, gerar mensalidades em lote, exportar CSV) e despesas.
const EXPENSE_CATEGORIES = ['Aluguel e espaço', 'Equipamentos', 'Software e apps', 'Marketing', 'Impostos e taxas', 'Outros'];
const PAY_METHODS = ['Pix', 'Cartão', 'Dinheiro', 'Transferência'];
let finTab = 'cobrancas';
let finFilter = '';
let finQuery = '';
let finMonth = '';           // '' = todos os meses (cobranças)
let expMonth = today.slice(0, 7);

const sumBy = (arr, f = x => x.amount) => arr.reduce((t, x) => t + (+f(x) || 0), 0);
const ymOf = iso => (iso || '').slice(0, 7);
const ymLabel = (ym, long = false) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return long ? cap(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
        : d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(y).slice(2);
};
const lastMonths = n => Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i));
    return localISO(d).slice(0, 7);
});
const moneyShort = v => v >= 1000 ? 'R$ ' + num(v / 1000, 1) + ' mil' : money(v).replace(',00', '');
const firstName = n => String(n).split(' ')[0];

function financeNumbers(ym = today.slice(0, 7)) {
    const received = state.invoices.filter(i => i.paidAt && ymOf(i.paidAt) === ym);
    const open = state.invoices.filter(i => invoiceStatus(i).key === 'aberto');
    const late = state.invoices.filter(i => invoiceStatus(i).key === 'atrasado');
    const dueSoFar = state.invoices.filter(i => i.due <= today);
    const expenses = (state.expenses || []).filter(e => ymOf(e.date) === ym);
    const active = SEED.students.filter(s => s.status !== 'Inativo');
    const mrr = sumBy(active, s => SEED.planPrices[s.plan]);
    return {
        received, open, late, expenses, active, mrr,
        receivedTotal: sumBy(received), expenseTotal: sumBy(expenses),
        lateRate: dueSoFar.length ? sumBy(late) / sumBy(dueSoFar) * 100 : 0,
        avgTicket: received.length ? sumBy(received) / received.length : 0
    };
}

// ---------- Gráfico: receitas x despesas (mesma escala, um eixo) ----------
function revenueExpenseChart(months) {
    const rows = months.map(ym => {
        const rec = sumBy(state.invoices.filter(i => i.paidAt && ymOf(i.paidAt) === ym));
        const exp = sumBy((state.expenses || []).filter(e => ymOf(e.date) === ym));
        return { ym, rec, exp, net: rec - exp };
    });
    const W = 640, H = 240, P = { l: 64, r: 12, t: 16, b: 30 };
    // Escala com números redondos (ex.: 0, 600, 1.200)
    const raw = Math.max(...rows.flatMap(r => [r.rec, r.exp]), 1) * 1.05;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const max = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(f => f * mag).find(v => v >= raw);
    const step = (W - P.l - P.r) / rows.length, bw = Math.min(26, step * 0.3);
    const y = v => P.t + (1 - v / max) * (H - P.t - P.b);
    const ticks = [0, 0.5, 1].map(t => t * max);
    // Barra com o topo arredondado e a base reta, apoiada no eixo
    const bar = (x, v, cls) => {
        const top = y(v), base = y(0), h = base - top, r = Math.min(4, h);
        if (h <= 0) return '';
        return `<path class="${cls}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
    };
    const chart = `<svg class="chart fin-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas e despesas por mês">
        <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs>
        ${ticks.map(t => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/>
            <text x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end">${moneyShort(t)}</text>`).join('')}
        ${rows.map((r, i) => {
            const cx = P.l + step * i + step / 2;
            return `<g class="fin-group">
                ${bar(cx - bw - 1, r.rec, 'bar-rec')}${bar(cx + 1, r.exp, 'bar-exp')}
                <text x="${cx}" y="${H - 8}" text-anchor="middle">${ymLabel(r.ym)}</text>
                <rect class="hit" x="${cx - step / 2}" y="${P.t}" width="${step}" height="${H - P.t - P.b}">
                    <title>${ymLabel(r.ym, true)}&#10;Receitas: ${money(r.rec)}&#10;Despesas: ${money(r.exp)}&#10;Lucro: ${money(r.net)}</title></rect>
            </g>`;
        }).join('')}
    </svg>`;
    const table = `<details class="fin-table"><summary class="small muted">Ver em tabela</summary>
        <div class="table-wrap"><table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Lucro</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${ymLabel(r.ym, true)}</td><td>${money(r.rec)}</td><td>${money(r.exp)}</td>
            <td class="${r.net >= 0 ? 'up' : 'down'}">${money(r.net)}</td></tr>`).join('')}</tbody></table></div></details>`;
    return { chart, table, rows };
}

// ---------- Cobranças ----------
function filteredInvoices() {
    const q = finQuery.toLowerCase();
    return [...state.invoices]
        .filter(i => (!finFilter || invoiceStatus(i).key === finFilter) && (!finMonth || ymOf(i.due) === finMonth)
            && (!q || i.student.toLowerCase().includes(q)))
        .sort((a, b) => b.due.localeCompare(a.due));
}

function invoicesTable() {
    const list = filteredInvoices();
    if (!list.length) return '<div class="empty">Nenhuma cobrança com esses filtros.</div>';
    return `<div class="table-wrap"><table class="fin-invoices">
        <thead><tr><th>Aluno</th><th>Plano</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(i => { const st = invoiceStatus(i); return `<tr>
            <td><div class="cell-user"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(i.student)}</div>${esc(i.student)}</div></td>
            <td>${esc(i.plan)}</td><td>${money(i.amount)}</td><td>${fmtFull(i.due)}</td>
            <td><span class="badge ${st.color}">${st.label}</span>${i.paidAt ? `<div class="muted small">${fmtFull(i.paidAt)} • ${esc(i.method || '')}</div>` : ''}</td>
            <td class="fin-actions">
                ${i.paidAt
                    ? `<button class="btn btn-sm" data-receipt="${i.id}">Recibo</button>
                       <button class="btn btn-ghost btn-sm" data-unpay="${i.id}" title="Desfazer pagamento">Desfazer</button>`
                    : `<button class="btn btn-primary btn-sm" data-receive="${i.id}">Receber</button>
                       <a class="btn btn-sm brand-wa" data-remind="${i.id}" target="_blank" rel="noopener" title="Cobrar pelo WhatsApp">Cobrar</a>`}
                <button class="btn btn-ghost btn-sm" data-edit-inv="${i.id}" title="Editar">✎</button>
                <button class="btn btn-ghost btn-sm" data-del-inv="${i.id}" title="Excluir">✕</button>
            </td></tr>`; }).join('')}</tbody>
    </table></div>`;
}

// Link do WhatsApp com a cobrança já escrita (com o telefone do aluno quando existe)
function reminderLink(inv) {
    const person = Backend.enabled ? Backend.people.find(p => (p.full_name || p.email) === inv.student) : null;
    let phone = String((person && person.phone) || '').replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) phone = '55' + phone;
    const late = invoiceStatus(inv).key === 'atrasado';
    const text = `Olá, ${firstName(inv.student)}! Tudo bem? ${late ? 'Sua mensalidade está em aberto' : 'Passando para lembrar da sua mensalidade'}: ` +
        `plano ${inv.plan}, ${money(inv.amount)}, vencimento ${fmtFull(inv.due)}. ` +
        `Você pode pagar por aqui: ${SITE.checkout || SITE.instagram} . Qualquer dúvida, é só me chamar! 💪`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function openReceive(inv) {
    const m = modal(`
        <h3>Registrar pagamento</h3>
        <p class="sub">${esc(inv.student)} • ${esc(inv.plan)} • vencimento ${fmtFull(inv.due)}</p>
        <div class="pay-amount" style="margin-bottom:14px">${money(inv.amount)}</div>
        <form id="receive-form">
            <div class="form-row">
                <label class="field">Forma de pagamento<select class="input" name="method">${PAY_METHODS.map(p => `<option>${p}</option>`).join('')}</select></label>
                <label class="field">Data do pagamento<input class="input" type="date" name="date" value="${today}" max="${today}" required></label>
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:14px">Confirmar recebimento</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    const f = m.querySelector('#receive-form');
    f.onsubmit = e => {
        e.preventDefault();
        Object.assign(inv, { paidAt: f.date.value, method: f.method.value });
        save(); toast('Pagamento registrado!'); route();
    };
}

function openInvoiceEditor(inv) {
    const m = modal(`
        <h3>Editar cobrança</h3>
        <p class="sub">${esc(inv.student)}</p>
        <form id="inv-edit">
            <label class="field">Descrição / plano<input class="input" name="plan" value="${esc(inv.plan)}" required></label>
            <div class="form-row">
                <label class="field">Valor (R$)<input class="input" type="number" min="1" step="0.01" name="amount" value="${inv.amount}" required></label>
                <label class="field">Vencimento<input class="input" type="date" name="due" value="${inv.due}" required></label>
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:14px">Salvar</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    const f = m.querySelector('#inv-edit');
    f.onsubmit = e => {
        e.preventDefault();
        Object.assign(inv, { plan: f.plan.value.trim(), amount: +f.amount.value, due: f.due.value });
        save(); toast('Cobrança atualizada!'); route();
    };
}

// Recibo para imprimir ou salvar em PDF
function openReceipt(inv) {
    const w = window.open('', '_blank');
    if (!w) return toast('Permita pop-ups para abrir o recibo.');
    const nr = inv.id.replace(/[^\w]/g, '').slice(-8).toUpperCase();
    w.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Recibo ${nr}</title>
        <style>body{font-family:Inter,Arial,sans-serif;max-width:620px;margin:40px auto;padding:0 24px;color:#111}
        h1{font-size:22px;margin:0}.muted{color:#666}.box{border:1px solid #ddd;border-radius:12px;padding:20px;margin:24px 0}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.row:last-child{border:0}
        .total{font-size:28px;font-weight:800}button{padding:10px 18px;border-radius:8px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}
        @media print{button{display:none}}</style></head><body>
        <h1>Recibo nº ${nr}</h1><p class="muted">${esc(SITE.coach)} — Consultoria online</p>
        <div class="box">
            <p>Recebi de <b>${esc(inv.student)}</b> a quantia de</p><p class="total">${money(inv.amount)}</p>
            <p>referente à mensalidade do plano <b>${esc(inv.plan)}</b>, com vencimento em ${fmtFull(inv.due)}.</p>
        </div>
        <div class="box">
            <div class="row"><span class="muted">Pago em</span><b>${fmtFull(inv.paidAt)}</b></div>
            <div class="row"><span class="muted">Forma de pagamento</span><b>${esc(inv.method || '—')}</b></div>
            <div class="row"><span class="muted">Emitido em</span><b>${fmtFull(today)}</b></div>
        </div>
        <p style="margin-top:48px">______________________________<br>${esc(SITE.coach)}</p>
        <button onclick="print()">Imprimir / salvar em PDF</button></body></html>`);
    w.document.close();
}

// Gera a mensalidade do mês para todos os alunos ativos que ainda não têm cobrança nele
function monthlyBatch(ym) {
    return SEED.students.filter(s => s.status !== 'Inativo' && SEED.planPrices[s.plan]).filter(s =>
        !state.invoices.some(i => i.student === s.name && ymOf(i.due) === ym)
    ).map(s => {
        const prev = state.invoices.filter(i => i.student === s.name).sort((a, b) => b.due.localeCompare(a.due))[0];
        // Dia definido pelo coach; sem ele, o mesmo dia da última cobrança (ou 10)
        const day = s.dueDay || (prev ? +prev.due.slice(8, 10) : 10);
        return { id: newId('inv'), student: s.name, plan: s.plan, amount: SEED.planPrices[s.plan],
            due: withDay(`${ym}-01`, day), paidAt: null, method: null };
    });
}

function exportCsv() {
    const rows = filteredInvoices();
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Aluno', 'Plano', 'Valor', 'Vencimento', 'Status', 'Pago em', 'Forma de pagamento'].map(cell).join(';')]
        .concat(rows.map(i => [i.student, i.plan, num(i.amount, 2), fmtFull(i.due), invoiceStatus(i).label,
            i.paidAt ? fmtFull(i.paidAt) : '', i.method || ''].map(cell).join(';')));
    // BOM + ponto e vírgula: abre certo no Excel em português
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cobrancas-${finMonth || 'todas'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${rows.length} cobrança(s) exportada(s)`);
}

function invoicesTab() {
    const months = lastMonths(12).reverse();
    const nextYm = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); return localISO(d).slice(0, 7); })();
    const batchNow = monthlyBatch(today.slice(0, 7)), batchNext = monthlyBatch(nextYm);
    const filters = [['', 'Todas'], ['aberto', 'Em aberto'], ['atrasado', 'Atrasadas'], ['pago', 'Pagas']];
    return `
    <div class="card">
        <div class="fin-toolbar">
            <input class="input" id="fin-search" placeholder="Buscar aluno..." value="${esc(finQuery)}">
            <select class="input" id="fin-month"><option value="">Todos os meses</option>
                ${months.map(ym => `<option value="${ym}" ${ym === finMonth ? 'selected' : ''}>${ymLabel(ym, true)}</option>`).join('')}</select>
            <button class="btn" id="fin-csv">⬇ Exportar CSV</button>
        </div>
        <div class="tabs">${filters.map(([k, l]) => `<button class="tab ${finFilter === k ? 'active' : ''}" data-fin="${k}">${l}</button>`).join('')}</div>
        <div id="fin-list">${invoicesTable()}</div>
    </div>
    <div class="grid grid-2" style="margin-top:18px">
        <div class="card">
            <div class="card-head"><h2>Mensalidades em lote</h2></div>
            <p class="muted small" style="margin-bottom:14px">Cria a cobrança do mês para cada aluno ativo que ainda não tem uma,
                com o valor do plano, no dia de vencimento definido no cadastro do aluno (ou no mesmo dia do mês anterior).</p>
            <div class="fin-batch">
                <button class="btn ${batchNow.length ? 'btn-primary' : ''}" data-batch="${today.slice(0, 7)}" ${batchNow.length ? '' : 'disabled'}>
                    ${batchNow.length ? `Gerar ${ymLabel(today.slice(0, 7), true)} — ${batchNow.length} aluno(s), ${money(sumBy(batchNow))}` : `${ymLabel(today.slice(0, 7), true)}: todas geradas ✓`}</button>
                <button class="btn" data-batch="${nextYm}" ${batchNext.length ? '' : 'disabled'}>
                    ${batchNext.length ? `Gerar ${ymLabel(nextYm, true)} — ${batchNext.length} aluno(s), ${money(sumBy(batchNext))}` : `${ymLabel(nextYm, true)}: todas geradas ✓`}</button>
            </div>
        </div>
        <div class="card">
            <div class="card-head"><h2>Cobrança avulsa</h2></div>
            <form id="inv-form">
                <div class="form-row">
                    <label class="field">Aluno<select class="input" name="student">${SEED.students.map(s => `<option>${esc(s.name)}</option>`).join('')}</select></label>
                    <label class="field">Descrição<input class="input" name="plan" placeholder="Mensalidade, avaliação..."></label>
                </div>
                <div class="form-row">
                    <label class="field">Valor (R$)<input class="input" type="number" min="1" step="0.01" name="amount" required></label>
                    <label class="field">Vencimento<input class="input" type="date" name="due" value="${today}" required></label>
                </div>
                <label class="check-line"><input type="checkbox" name="coupon"> Aplicar cupom ${esc(SITE.coupon)} (${esc(SITE.couponDiscount)} de desconto)</label>
                <button class="btn btn-primary btn-block" type="submit">Gerar cobrança</button>
            </form>
        </div>
    </div>`;
}

// ---------- Despesas ----------
function expensesTab() {
    const months = lastMonths(12).reverse();
    const list = (state.expenses || []).filter(e => ymOf(e.date) === expMonth).sort((a, b) => b.date.localeCompare(a.date));
    const total = sumBy(list);
    const byCat = EXPENSE_CATEGORIES.map(c => ({ c, v: sumBy(list.filter(e => e.category === c)) })).filter(x => x.v).sort((a, b) => b.v - a.v);
    return `
    <div class="grid grid-main">
        <div class="card">
            <div class="card-head" style="flex-wrap:wrap"><h2>Despesas de ${ymLabel(expMonth, true)}</h2>
                <select class="input" id="exp-month" style="width:auto">${months.map(ym =>
                    `<option value="${ym}" ${ym === expMonth ? 'selected' : ''}>${ymLabel(ym, true)}</option>`).join('')}</select></div>
            ${list.length ? `<div class="table-wrap"><table>
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th></th></tr></thead>
                <tbody>${list.map(e => `<tr><td>${fmtFull(e.date)}</td><td>${esc(e.description)}</td>
                    <td><span class="badge">${esc(e.category)}</span></td><td>${money(e.amount)}</td>
                    <td><button class="btn btn-ghost btn-sm" data-del-exp="${e.id}" title="Excluir">✕</button></td></tr>`).join('')}
                <tr class="fin-total"><td colspan="3">Total</td><td>${money(total)}</td><td></td></tr></tbody></table></div>`
                : '<div class="empty">Nenhuma despesa neste mês.</div>'}
        </div>
        <div class="card">
            <div class="card-head"><h2>Nova despesa</h2></div>
            <form id="exp-form" style="display:flex;flex-direction:column;gap:12px">
                <label class="field">Descrição<input class="input" name="description" placeholder="Ex.: anúncios no Instagram" required></label>
                <label class="field">Categoria<select class="input" name="category">${EXPENSE_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label>
                <div class="form-row">
                    <label class="field">Valor (R$)<input class="input" type="number" min="0.01" step="0.01" name="amount" required></label>
                    <label class="field">Data<input class="input" type="date" name="date" value="${today}" required></label>
                </div>
                <button class="btn btn-primary" type="submit">Adicionar despesa</button>
            </form>
            ${byCat.length ? `<div class="card-head" style="margin-top:22px"><h3>Por categoria</h3></div>
                ${byCat.map(x => `<div class="macro"><div class="macro-top"><span>${esc(x.c)}</span><b>${money(x.v)} • ${Math.round(x.v / total * 100)}%</b></div>
                    <div class="progress"><span style="width:${x.v / total * 100}%"></span></div></div>`).join('')}` : ''}
        </div>
    </div>`;
}

trainerPages.financeiro = {
    title: () => 'Financeiro',
    sub: () => 'Receitas, cobranças e despesas da consultoria',
    render() {
        const n = financeNumbers();
        const profit = n.receivedTotal - n.expenseTotal;
        const { chart, table } = revenueExpenseChart(lastMonths(6));
        return `
        <div class="grid grid-3">
            <div class="card stat"><div class="label">Recebido no mês <span class="stat-ico">✅</span></div>
                <div class="value">${money(n.receivedTotal)}</div>
                <div class="muted small">${n.received.length} pagamento(s) em ${ymLabel(today.slice(0, 7), true).split(' ')[0].toLowerCase()}</div></div>
            <div class="card stat"><div class="label">A receber <span class="stat-ico">⏳</span></div>
                <div class="value">${money(sumBy(n.open))}</div><div class="muted small">${n.open.length} cobrança(s) em aberto</div></div>
            <div class="card stat"><div class="label">Em atraso <span class="stat-ico">⚠️</span></div>
                <div class="value ${n.late.length ? 'down' : ''}">${money(sumBy(n.late))}</div>
                <div class="muted small">Inadimplência ${num(n.lateRate, 1)}% • ${[...new Set(n.late.map(i => firstName(i.student)))].map(esc).join(', ') || 'ninguém'}</div></div>
            <div class="card stat"><div class="label">Despesas do mês <span class="stat-ico">🧾</span></div>
                <div class="value">${money(n.expenseTotal)}</div><div class="muted small">${n.expenses.length} lançamento(s)</div></div>
            <div class="card stat"><div class="label">Lucro do mês <span class="stat-ico">📈</span></div>
                <div class="value ${profit >= 0 ? 'up' : 'down'}">${money(profit)}</div><div class="muted small">recebido − despesas</div></div>
            <div class="card stat"><div class="label">Receita recorrente <span class="stat-ico">🔁</span></div>
                <div class="value">${money(n.mrr)}<small>/mês</small></div>
                <div class="muted small">${n.active.length} aluno(s) ativo(s) • ticket médio ${money(n.avgTicket)}</div></div>
        </div>

        <div class="card" style="margin-top:18px">
            <div class="card-head" style="flex-wrap:wrap"><h2>Receitas x despesas</h2>
                <div class="chart-legend"><span><i class="lg-rec"></i>Receitas</span><span><i class="lg-exp"></i>Despesas</span></div></div>
            ${chart}
            ${table}
        </div>

        <div class="tabs" style="margin-top:22px">
            <button class="tab ${finTab === 'cobrancas' ? 'active' : ''}" data-fintab="cobrancas">Cobranças</button>
            <button class="tab ${finTab === 'despesas' ? 'active' : ''}" data-fintab="despesas">Despesas</button>
        </div>
        ${finTab === 'cobrancas' ? invoicesTab() : expensesTab()}`;
    },
    bind(view) {
        view.querySelectorAll('[data-fintab]').forEach(b => b.onclick = () => { finTab = b.dataset.fintab; route(); });
        const find = idv => state.invoices.find(i => i.id === idv);

        if (finTab === 'despesas') {
            view.querySelector('#exp-month').onchange = e => { expMonth = e.target.value; route(); };
            view.querySelectorAll('[data-del-exp]').forEach(b => b.onclick = () => {
                if (!confirm('Excluir esta despesa?')) return;
                state.expenses = state.expenses.filter(e => e.id !== b.dataset.delExp);
                save(); route();
            });
            const f = view.querySelector('#exp-form');
            f.onsubmit = e => {
                e.preventDefault();
                (state.expenses ||= []).push({ id: newId('ex'), description: f.description.value.trim(), category: f.category.value,
                    amount: +f.amount.value, date: f.date.value });
                expMonth = ymOf(f.date.value);
                save(); toast('Despesa adicionada!'); route();
            };
            return;
        }

        // Filtros sem perder o foco da busca
        const refresh = () => { view.querySelector('#fin-list').innerHTML = invoicesTable(); bindRows(); };
        const search = view.querySelector('#fin-search');
        search.oninput = () => { finQuery = search.value; refresh(); };
        view.querySelector('#fin-month').onchange = e => { finMonth = e.target.value; refresh(); };
        view.querySelectorAll('[data-fin]').forEach(b => b.onclick = () => { finFilter = b.dataset.fin; route(); });
        view.querySelector('#fin-csv').onclick = exportCsv;

        const bindRows = () => {
            view.querySelectorAll('[data-receive]').forEach(b => b.onclick = () => openReceive(find(b.dataset.receive)));
            view.querySelectorAll('[data-remind]').forEach(a => { a.href = reminderLink(find(a.dataset.remind)); });
            view.querySelectorAll('[data-receipt]').forEach(b => b.onclick = () => openReceipt(find(b.dataset.receipt)));
            view.querySelectorAll('[data-unpay]').forEach(b => b.onclick = () => {
                Object.assign(find(b.dataset.unpay), { paidAt: null, method: null });
                save(); route();
            });
            view.querySelectorAll('[data-edit-inv]').forEach(b => b.onclick = () => openInvoiceEditor(find(b.dataset.editInv)));
            view.querySelectorAll('[data-del-inv]').forEach(b => b.onclick = () => {
                const inv = find(b.dataset.delInv);
                if (!confirm(`Excluir a cobrança de ${inv.student} (${money(inv.amount)})?`)) return;
                state.invoices = state.invoices.filter(i => i.id !== inv.id);
                save(); toast('Cobrança excluída.'); route();
            });
        };
        bindRows();

        view.querySelectorAll('[data-batch]').forEach(b => b.onclick = () => {
            const batch = monthlyBatch(b.dataset.batch);
            if (!batch.length) return;
            if (!confirm(`Gerar ${batch.length} mensalidade(s) de ${ymLabel(b.dataset.batch, true)}, total ${money(sumBy(batch))}?`)) return;
            state.invoices.push(...batch);
            save(); toast(`${batch.length} mensalidade(s) gerada(s)!`); route();
        });

        const form = view.querySelector('#inv-form');
        const student = () => SEED.students.find(s => s.name === form.student.value);
        const fill = () => {
            const base = SEED.planPrices[student()?.plan] || 0;
            form.amount.value = base ? (form.coupon.checked ? +(base * (1 - parseFloat(SITE.couponDiscount) / 100)).toFixed(2) : base) : '';
            form.plan.placeholder = student()?.plan ? `Mensalidade ${student().plan}` : 'Mensalidade, avaliação...';
        };
        form.student.onchange = form.coupon.onchange = fill;
        fill();
        form.onsubmit = e => {
            e.preventDefault();
            const desc = form.plan.value.trim() || student()?.plan || 'Avulso';
            state.invoices.push({ id: newId('inv'), student: form.student.value, plan: desc + (form.coupon.checked ? ` (cupom ${SITE.coupon})` : ''),
                amount: +form.amount.value, due: form.due.value, paidAt: null, method: null });
            save(); toast('Cobrança gerada!'); route();
        };
    }
};
