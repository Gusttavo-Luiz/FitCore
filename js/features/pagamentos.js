// ---------- Pagamentos (aluno) e financeiro (personal) ----------
// Demonstração: nenhum pagamento é processado de verdade.
let finFilter = '';

function invoiceStatus(inv) {
    if (inv.paidAt) return { key: 'pago', label: 'Pago', color: 'green' };
    if (inv.due < today) return { key: 'atrasado', label: 'Atrasado', color: 'red' };
    return { key: 'aberto', label: 'Em aberto', color: 'orange' };
}

const fmtFull = iso => fmtDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });

function invoicesOf(student) {
    return state.invoices.filter(i => i.student === student).sort((a, b) => b.due.localeCompare(a.due));
}

function openPayment(inv) {
    const m = modal(`
        <h3>Pagar mensalidade</h3>
        <p class="sub">Plano ${inv.plan} • vencimento ${fmtFull(inv.due)}</p>
        <div class="pay-amount">${money(inv.amount)}</div>
        <div class="role-switch" style="margin:16px 0">
            <button type="button" data-method="Pix" class="active">Pix</button>
            <button type="button" data-method="Cartão">Cartão</button>
        </div>
        <div id="pay-body"></div>
        <p class="muted small" style="margin:12px 0">⚠️ Ambiente de demonstração: nenhum valor é cobrado.</p>
        <button class="btn btn-primary btn-block" id="pay-confirm">Confirmar pagamento</button>
        <button class="btn btn-ghost btn-block" data-close style="margin-top:8px">Cancelar</button>`);
    let method = 'Pix';
    const body = m.querySelector('#pay-body');
    const draw = () => {
        m.querySelectorAll('[data-method]').forEach(b => b.classList.toggle('active', b.dataset.method === method));
        body.innerHTML = method === 'Pix'
            ? `<div class="pix-box"><div class="muted small">Código Pix copia e cola (exemplo)</div>
                <code>00020126FITCOREPRO-DEMO-${inv.id.toUpperCase()}</code>
                <button class="btn btn-sm" id="pix-copy">Copiar código</button></div>`
            : `<div class="pix-box"><div class="muted small">Cartão de crédito</div>
                <p class="small">Na versão real, o pagamento com cartão é feito na página segura do provedor
                (ex.: Mercado Pago, Stripe ou PagSeguro). Os dados do cartão nunca passam pelo site.</p></div>`;
        const copy = body.querySelector('#pix-copy');
        if (copy) copy.onclick = () => {
            navigator.clipboard?.writeText(body.querySelector('code').textContent).catch(() => {});
            toast('Código copiado!');
        };
    };
    m.querySelectorAll('[data-method]').forEach(b => b.onclick = () => { method = b.dataset.method; draw(); });
    draw();
    m.querySelector('#pay-confirm').onclick = () => {
        inv.paidAt = today;
        inv.method = method;
        save(); toast('Pagamento confirmado! ✅'); route();
    };
}

clientPages.pagamentos = {
    title: () => 'Pagamentos',
    sub: () => 'Mensalidades e histórico de cobranças',
    render() {
        const list = invoicesOf(CLIENT);
        const open = list.filter(i => !i.paidAt).sort((a, b) => a.due.localeCompare(b.due));
        const plan = list[0]?.plan || 'Performance';
        return `
        <div class="grid grid-3">
            <div class="card stat"><div class="label">Plano atual <span class="stat-ico">⭐</span></div>
                <div class="value" style="font-size:24px">${plan}</div><div class="muted small">${money(SEED.planPrices[plan])}/mês</div></div>
            <div class="card stat"><div class="label">Em aberto <span class="stat-ico">🧾</span></div>
                <div class="value">${money(open.reduce((t, i) => t + i.amount, 0))}</div>
                <div class="small ${open.some(i => invoiceStatus(i).key === 'atrasado') ? 'down' : 'muted'}">${open.length ? `${open.length} cobrança(s)` : 'Tudo em dia 🎉'}</div></div>
            <div class="card stat"><div class="label">Próximo vencimento <span class="stat-ico">📅</span></div>
                <div class="value" style="font-size:24px">${open[0] ? fmtFull(open[0].due) : '—'}</div>
                <div class="muted small">${open[0] ? money(open[0].amount) : 'Nenhuma cobrança pendente'}</div></div>
        </div>
        ${open.length ? `<div class="card" style="margin-top:18px">
            <div class="card-head"><h2>Cobranças em aberto</h2></div>
            <div class="list">${open.map(i => { const st = invoiceStatus(i); return `
                <div class="list-item">
                    <div class="grow"><div class="title">Mensalidade ${i.plan}</div><div class="meta">Vence em ${fmtFull(i.due)}</div></div>
                    <span class="badge ${st.color}">${st.label}</span><b>${money(i.amount)}</b>
                    <button class="btn btn-primary btn-sm" data-pay="${i.id}">Pagar</button>
                </div>`; }).join('')}</div>
        </div>` : ''}
        <div class="card" style="margin-top:18px">
            <div class="card-head"><h2>Histórico</h2></div>
            <div class="table-wrap"><table>
                <thead><tr><th>Vencimento</th><th>Plano</th><th>Valor</th><th>Pago em</th><th>Forma</th><th>Status</th></tr></thead>
                <tbody>${list.map(i => { const st = invoiceStatus(i); return `<tr>
                    <td>${fmtFull(i.due)}</td><td>${i.plan}</td><td>${money(i.amount)}</td>
                    <td>${i.paidAt ? fmtFull(i.paidAt) : '—'}</td><td>${i.method || '—'}</td>
                    <td><span class="badge ${st.color}">${st.label}</span></td></tr>`; }).join('')}</tbody>
            </table></div>
        </div>`;
    },
    bind(view) {
        view.querySelectorAll('[data-pay]').forEach(b => b.onclick = () =>
            openPayment(state.invoices.find(i => i.id === b.dataset.pay)));
    }
};

function financeTable() {
    const list = [...state.invoices]
        .filter(i => !finFilter || invoiceStatus(i).key === finFilter)
        .sort((a, b) => b.due.localeCompare(a.due));
    if (!list.length) return '<div class="empty">Nenhuma cobrança neste filtro.</div>';
    return `<div class="table-wrap"><table>
        <thead><tr><th>Aluno</th><th>Plano</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(i => { const st = invoiceStatus(i); return `<tr>
            <td><div class="cell-user"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(i.student)}</div>${esc(i.student)}</div></td>
            <td>${esc(i.plan)}</td><td>${money(i.amount)}</td><td>${fmtFull(i.due)}</td>
            <td><span class="badge ${st.color}">${st.label}</span>${i.paidAt ? ` <span class="muted small">${i.method}</span>` : ''}</td>
            <td>${i.paidAt ? `<button class="btn btn-ghost btn-sm" data-unpay="${i.id}">Desfazer</button>`
                : `<button class="btn btn-sm" data-markpaid="${i.id}">Marcar pago</button>`}</td></tr>`; }).join('')}</tbody>
    </table></div>`;
}

trainerPages.financeiro = {
    title: () => 'Financeiro',
    sub: () => 'Mensalidades e cobranças dos alunos',
    render() {
        const month = today.slice(0, 7);
        const sum = arr => arr.reduce((t, i) => t + i.amount, 0);
        const received = state.invoices.filter(i => i.paidAt && i.paidAt.slice(0, 7) === month);
        const open = state.invoices.filter(i => invoiceStatus(i).key === 'aberto');
        const late = state.invoices.filter(i => invoiceStatus(i).key === 'atrasado');
        const filters = [['', 'Todas'], ['aberto', 'Em aberto'], ['atrasado', 'Atrasadas'], ['pago', 'Pagas']];
        return `
        <div class="grid grid-3">
            <div class="card stat"><div class="label">Recebido no mês <span class="stat-ico">✅</span></div>
                <div class="value">${money(sum(received))}</div><div class="muted small">${received.length} pagamento(s)</div></div>
            <div class="card stat"><div class="label">A receber <span class="stat-ico">⏳</span></div>
                <div class="value">${money(sum(open))}</div><div class="muted small">${open.length} cobrança(s)</div></div>
            <div class="card stat"><div class="label">Em atraso <span class="stat-ico">⚠️</span></div>
                <div class="value ${late.length ? 'down' : ''}">${money(sum(late))}</div>
                <div class="muted small">${[...new Set(late.map(i => i.student))].map(esc).join(', ') || 'Ninguém em atraso'}</div></div>
        </div>
        <div class="card" style="margin-top:18px">
            <div class="card-head"><h2>Cobranças</h2></div>
            <div class="tabs">${filters.map(([k, l]) => `<button class="tab ${finFilter === k ? 'active' : ''}" data-fin="${k}">${l}</button>`).join('')}</div>
            ${financeTable()}
        </div>
        <div class="card" style="margin-top:18px">
            <div class="card-head"><h2>Nova cobrança</h2></div>
            <form id="inv-form" class="form-row">
                <label class="field">Aluno<select class="input" name="student">${SEED.students.map(s => `<option>${esc(s.name)}</option>`).join('')}</select></label>
                <label class="field">Valor (R$)<input class="input" type="number" min="1" step="0.01" name="amount" required></label>
                <label class="field">Vencimento<input class="input" type="date" name="due" value="${today}" required></label>
                <button class="btn btn-primary" type="submit">Gerar cobrança</button>
            </form>
        </div>`;
    },
    bind(view) {
        view.querySelectorAll('[data-fin]').forEach(b => b.onclick = () => { finFilter = b.dataset.fin; route(); });
        const find = idv => state.invoices.find(i => i.id === idv);
        view.querySelectorAll('[data-markpaid]').forEach(b => b.onclick = () => {
            Object.assign(find(b.dataset.markpaid), { paidAt: today, method: 'Manual' });
            save(); toast('Pagamento registrado!'); route();
        });
        view.querySelectorAll('[data-unpay]').forEach(b => b.onclick = () => {
            Object.assign(find(b.dataset.unpay), { paidAt: null, method: null });
            save(); route();
        });
        const form = view.querySelector('#inv-form');
        const student = () => SEED.students.find(s => s.name === form.student.value);
        const fillAmount = () => { form.amount.value = SEED.planPrices[student()?.plan] || ''; };
        form.student.onchange = fillAmount;
        fillAmount();
        form.onsubmit = e => {
            e.preventDefault();
            state.invoices.push({ id: newId('inv'), student: form.student.value, plan: student()?.plan || 'Avulso',
                amount: +form.amount.value, due: form.due.value, paidAt: null, method: null });
            save(); toast('Cobrança gerada!'); route();
        };
    }
};
