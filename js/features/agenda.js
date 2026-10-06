// ---------- Agenda interativa (aluno e coach) ----------
const SESSION_TYPES = {
    Presencial: { title: 'Treino presencial', place: 'Academia Smart Fit — Centro' },
    Online: { title: 'Aula online', place: 'Google Meet' },
    Avaliação: { title: 'Avaliação física', place: 'Online — Google Meet' }
};
const WORK_HOURS = { start: 6, end: 21 }; // horários oferecidos pelo coach
const WEEK_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
let agendaMonth = null; // primeiro dia do mês exibido
let agendaStudent = ''; // filtro do coach

const isoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const fmtLong = iso => cap(fmtDate(iso, { weekday: 'long', day: '2-digit', month: 'long' }));
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function sessionsOn(date, { includeCancelled = true } = {}) {
    return visibleSessions({ includeCancelled })
        .filter(s => s.date === date && (!agendaStudent || s.student === agendaStudent));
}

// Conflito de horário na agenda do coach (considera todos os alunos)
function conflictWith(date, time, duration, ignoreId) {
    const a = toMin(time), b = a + duration;
    return state.sessions.find(s => s.id !== ignoreId && s.status !== 'cancelada' && s.date === date &&
        toMin(s.time) < b && a < toMin(s.time) + (s.duration || 60));
}

function freeSlots(date, duration) {
    const slots = [];
    const nowMin = date === today ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
    for (let h = WORK_HOURS.start; h + duration / 60 <= WORK_HOURS.end; h++) {
        const t = String(h).padStart(2, '0') + ':00';
        if (h * 60 > nowMin && !conflictWith(date, t, duration)) slots.push(t);
    }
    return slots;
}

function googleCalendarUrl(s) {
    const start = new Date(`${s.date}T${s.time}:00`);
    const end = new Date(start.getTime() + (s.duration || 60) * 60000);
    const f = d => localISO(d).replace(/-/g, '') + 'T' + d.toTimeString().slice(0, 8).replace(/:/g, '');
    const q = new URLSearchParams({
        action: 'TEMPLATE', text: `${s.title} — ${SITE.coach}`, dates: `${f(start)}/${f(end)}`,
        details: s.notes || '', location: s.place
    });
    return 'https://calendar.google.com/calendar/render?' + q;
}

function calendarHtml(selected) {
    const m = agendaMonth;
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: (first.getDay() + 6) % 7 }, () => '<div></div>');
    for (let d = 1; d <= days; d++) {
        const iso = localISO(new Date(m.getFullYear(), m.getMonth(), d));
        const list = sessionsOn(iso, { includeCancelled: false });
        const pending = list.some(s => s.status === 'pendente');
        cells.push(`<button class="cal-day ${iso === selected ? 'selected' : ''} ${iso === today ? 'today' : ''} ${iso < today ? 'past' : ''}"
            data-day="${iso}" aria-label="${fmtLong(iso)}${list.length ? `, ${list.length} sessão(ões)` : ''}">
            <b>${d}</b>
            <div class="cal-dots">${list.slice(0, 3).map(s => `<i class="dot-${SESSION_COLORS[s.type]}"></i>`).join('')}
                ${list.length > 3 ? `<small>+${list.length - 3}</small>` : ''}</div>
            ${pending ? '<span class="cal-pending" title="Aguardando confirmação"></span>' : ''}
        </button>`);
    }
    return `
        <div class="cal-head">
            <button class="btn btn-sm btn-ghost" data-month="-1" aria-label="Mês anterior">‹</button>
            <h2>${cap(m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2>
            <button class="btn btn-sm btn-ghost" data-month="1" aria-label="Próximo mês">›</button>
            <button class="btn btn-sm" data-month="0">Hoje</button>
        </div>
        <div class="cal-grid cal-labels">${WEEK_INITIALS.map(d => `<div>${d}</div>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
        <div class="cal-legend">
            ${Object.keys(SESSION_TYPES).map(t => `<span><i class="dot-${SESSION_COLORS[t]}"></i>${t}</span>`).join('')}
            <span><i class="cal-pending static"></i>Aguardando</span>
        </div>`;
}

function renderAgendaPage(dateParam) {
    const selected = isoDate(dateParam) || today;
    if (!agendaMonth || selected.slice(0, 7) !== localISO(agendaMonth).slice(0, 7)) {
        const d = new Date(selected + 'T12:00:00');
        agendaMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const coach = user.role === 'personal';
    const dayList = sessionsOn(selected);
    const upcoming = upcomingSessions(50).filter(s => !agendaStudent || s.student === agendaStudent).slice(0, 6);
    const pending = coach ? state.sessions.filter(s => s.status === 'pendente') : [];
    const canBook = selected >= today;

    return `
    ${coach ? `<div class="card-head" style="margin-bottom:18px;flex-wrap:wrap">
        <label class="field" style="max-width:260px">Filtrar por aluno
            <select class="input" id="agenda-student"><option value="">Todos os alunos</option>
                ${SEED.students.map(s => `<option ${s.name === agendaStudent ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <button class="btn btn-primary" data-new="${canBook ? selected : today}">+ Agendar sessão</button>
    </div>` : `<div class="card-head" style="margin-bottom:18px;justify-content:flex-end">
        <button class="btn btn-primary" data-new="${canBook ? selected : today}">+ Solicitar horário</button></div>`}

    ${pending.length ? `<div class="card pending-card" style="margin-bottom:18px">
        <div class="card-head"><h2>Solicitações aguardando confirmação</h2><span class="badge orange">${pending.length}</span></div>
        <div class="list">${pending.map(s => `<div class="list-item">
            <div class="grow"><div class="title">${esc(s.student)} • ${esc(s.title)}</div>
                <div class="meta">${fmtLong(s.date)} às ${s.time}${s.notes ? ' • “' + esc(s.notes) + '”' : ''}</div></div>
            <button class="btn btn-sm btn-primary" data-confirm="${s.id}">Confirmar</button>
            <button class="btn btn-sm btn-ghost" data-decline="${s.id}">Recusar</button>
        </div>`).join('')}</div>
    </div>` : ''}

    <div class="grid grid-main">
        <div class="card">${calendarHtml(selected)}</div>
        <div class="card">
            <div class="card-head"><h2>${fmtLong(selected)}</h2>
                ${selected === today ? '<span class="badge accent">Hoje</span>' : ''}</div>
            <div class="list">${dayList.map(sessionItem).join('') || `<div class="empty">Nenhuma sessão neste dia.</div>`}</div>
            ${canBook ? `<button class="btn btn-block" data-new="${selected}" style="margin-top:12px">
                ${coach ? '+ Agendar neste dia' : '+ Solicitar horário neste dia'}</button>` : ''}
            <div class="card-head" style="margin-top:24px"><h3>Próximas sessões</h3></div>
            <div class="list">${upcoming.map(sessionItem).join('') || '<div class="empty">Nenhuma sessão agendada.</div>'}</div>
        </div>
    </div>`;
}

function openSessionDetail(s) {
    const coach = user.role === 'personal';
    const [statusColor, statusLabel] = STATUS_BADGE[s.status];
    const future = s.date + s.time >= today + new Date().toTimeString().slice(0, 5);
    const m = modal(`
        <div class="card-head"><h3>${esc(s.title)}</h3><span class="badge ${statusColor}">${statusLabel}</span></div>
        <div class="list">
            <div class="list-item"><div class="grow muted">Data</div><b>${fmtLong(s.date)}</b></div>
            <div class="list-item"><div class="grow muted">Horário</div><b>${s.time} • ${s.duration || 60} min</b></div>
            <div class="list-item"><div class="grow muted">Tipo</div><span class="badge ${SESSION_COLORS[s.type]}">${s.type}</span></div>
            <div class="list-item"><div class="grow muted">Local</div><b style="text-align:right">${esc(s.place)}</b></div>
            <div class="list-item"><div class="grow muted">${coach ? 'Aluno' : 'Coach'}</div><b>${esc(coach ? s.student : SEED.trainer.name)}</b></div>
            ${s.notes ? `<div class="list-item"><div class="grow muted">Observação</div><span style="text-align:right">${esc(s.notes)}</span></div>` : ''}
        </div>
        ${s.status === 'pendente' && !coach ? '<p class="muted small" style="margin-top:12px">⏳ Aguardando o coach confirmar este horário.</p>' : ''}
        <div class="modal-actions">
            ${s.status !== 'cancelada' ? `<a class="btn" href="${googleCalendarUrl(s)}" target="_blank" rel="noopener">📅 Adicionar ao Google Agenda</a>` : ''}
            ${coach && s.status === 'pendente' ? '<button class="btn btn-primary" data-act="confirm">Confirmar</button>' : ''}
            ${future && s.status !== 'cancelada' ? `<button class="btn" data-act="edit">${coach ? 'Editar' : 'Remarcar'}</button>
                <button class="btn btn-ghost danger" data-act="cancel">Cancelar sessão</button>` : ''}
            ${coach && s.status === 'cancelada' ? '<button class="btn btn-ghost danger" data-act="delete">Excluir</button>' : ''}
            <button class="btn btn-ghost" data-close>Fechar</button>
        </div>`,
        // Ao fechar, tira o id da sessão do endereço para ela poder ser aberta de novo
        () => history.replaceState(null, '', `#/${user.role}/agenda/${s.date}`));
    const act = (name, fn) => { const b = m.querySelector(`[data-act="${name}"]`); if (b) b.onclick = fn; };
    act('confirm', () => { s.status = 'confirmada'; save(); toast('Sessão confirmada!'); route(); });
    act('edit', () => openSessionForm({ session: s }));
    act('cancel', () => {
        if (!confirm('Cancelar esta sessão?')) return;
        s.status = 'cancelada'; save(); toast('Sessão cancelada.'); route();
    });
    act('delete', () => {
        state.sessions = state.sessions.filter(x => x.id !== s.id);
        save(); toast('Sessão excluída.'); location.hash = `#/${user.role}/agenda/${s.date}`;
    });
}

function openSessionForm({ date, session } = {}) {
    const coach = user.role === 'personal';
    const s = session || { date: date || today, time: '', duration: 60, type: 'Presencial', ...SESSION_TYPES.Presencial,
        student: agendaStudent || CLIENT, notes: '' };
    const m = modal(`
        <h3>${session ? (coach ? 'Editar sessão' : 'Remarcar sessão') : (coach ? 'Agendar sessão' : 'Solicitar horário')}</h3>
        <p class="sub">${coach ? 'A sessão já entra confirmada.' : 'O coach recebe sua solicitação e confirma o horário.'}</p>
        <form id="session-form">
            ${coach ? `<label class="field">Aluno<select class="input" name="student">${SEED.students.map(st =>
                `<option ${st.name === s.student ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}</select></label>` : ''}
            <div class="form-row">
                <label class="field">Tipo<select class="input" name="type">${Object.keys(SESSION_TYPES).map(t =>
                    `<option ${t === s.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label class="field">Duração<select class="input" name="duration">${[30, 45, 60, 90].map(d =>
                    `<option value="${d}" ${d === (s.duration || 60) ? 'selected' : ''}>${d} min</option>`).join('')}</select></label>
            </div>
            <div class="form-row">
                <label class="field">Data<input class="input" type="date" name="date" min="${today}" value="${s.date < today ? today : s.date}" required></label>
                <label class="field">Horário<input class="input" type="time" name="time" step="900" value="${s.time}" required></label>
            </div>
            <div class="field">Horários livres<div class="slots" id="slots"></div></div>
            <label class="field">Título<input class="input" name="title" value="${esc(s.title)}" required></label>
            <label class="field">Local<input class="input" name="place" value="${esc(s.place)}" required></label>
            <label class="field">${coach ? 'Observações' : 'Recado para o coach (opcional)'}
                <textarea class="input" name="notes" rows="2">${esc(s.notes || '')}</textarea></label>
            <p class="small down" id="conflict" hidden></p>
            <button class="btn btn-primary btn-block" type="submit">${session ? 'Salvar' : coach ? 'Agendar' : 'Enviar solicitação'}</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    const f = m.querySelector('#session-form');
    const slotsEl = m.querySelector('#slots'), conflictEl = m.querySelector('#conflict');

    const check = () => {
        const c = f.time.value && conflictWith(f.date.value, f.time.value, +f.duration.value, session?.id);
        conflictEl.hidden = !c;
        // O aluno não vê com quem o coach está ocupado
        if (c) conflictEl.textContent = coach
            ? `⚠️ Horário ocupado: ${c.time} — ${c.student} • ${c.title}. Escolha outro horário.`
            : '⚠️ Esse horário já está ocupado na agenda do coach. Escolha um dos horários livres.';
        return !c;
    };
    const drawSlots = () => {
        const free = f.date.value ? freeSlots(f.date.value, +f.duration.value) : [];
        slotsEl.innerHTML = free.map(t => `<button type="button" class="slot ${t === f.time.value ? 'active' : ''}" data-slot="${t}">${t}</button>`).join('')
            || '<span class="muted small">Nenhum horário livre nesta data.</span>';
        slotsEl.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { f.time.value = b.dataset.slot; drawSlots(); check(); });
    };
    f.type.onchange = () => {
        // Sugere título e local do tipo escolhido, sem apagar o que a pessoa digitou
        const prev = Object.values(SESSION_TYPES);
        if (!f.title.value || prev.some(p => p.title === f.title.value)) f.title.value = SESSION_TYPES[f.type.value].title;
        if (!f.place.value || prev.some(p => p.place === f.place.value)) f.place.value = SESSION_TYPES[f.type.value].place;
    };
    f.date.onchange = f.duration.onchange = () => { drawSlots(); check(); };
    f.time.oninput = () => { drawSlots(); check(); };
    drawSlots();

    f.onsubmit = e => {
        e.preventDefault();
        if (f.date.value + f.time.value < today + new Date().toTimeString().slice(0, 5)) return toast('Escolha um horário no futuro.');
        if (!check()) return;
        const data = {
            date: f.date.value, time: f.time.value, duration: +f.duration.value, type: f.type.value,
            title: f.title.value.trim(), place: f.place.value.trim(), notes: f.notes.value.trim(),
            student: coach ? f.student.value : CLIENT,
            // O aluno sempre passa pela confirmação do coach
            status: coach ? 'confirmada' : 'pendente'
        };
        if (session) Object.assign(session, data);
        else state.sessions.push({ id: newId('s'), ...data });
        save();
        toast(coach ? 'Sessão agendada!' : 'Solicitação enviada ao coach!');
        const hash = `#/${user.role}/agenda/${data.date}`;
        if (location.hash !== hash) location.hash = hash; else route();
    };
}

function bindAgenda(view, dateParam, sessionId) {
    const go = date => { location.hash = `#/${user.role}/agenda/${date}`; };
    view.querySelectorAll('[data-day]').forEach(b => b.onclick = () => go(b.dataset.day));
    view.querySelectorAll('[data-month]').forEach(b => b.onclick = () => {
        const step = +b.dataset.month;
        if (!step) return go(today);
        agendaMonth = new Date(agendaMonth.getFullYear(), agendaMonth.getMonth() + step, 1);
        // Seleciona o dia 1 do novo mês (ou hoje, se for o mês atual)
        go(localISO(agendaMonth).slice(0, 7) === today.slice(0, 7) ? today : localISO(agendaMonth));
    });
    view.querySelectorAll('[data-new]').forEach(b => b.onclick = () => openSessionForm({ date: b.dataset.new }));
    const sel = view.querySelector('#agenda-student');
    if (sel) sel.onchange = () => { agendaStudent = sel.value; route(); };
    const find = idv => state.sessions.find(s => s.id === idv);
    view.querySelectorAll('[data-confirm]').forEach(b => b.onclick = () => {
        find(b.dataset.confirm).status = 'confirmada'; save(); toast('Sessão confirmada!'); route();
    });
    view.querySelectorAll('[data-decline]').forEach(b => b.onclick = () => {
        find(b.dataset.decline).status = 'cancelada'; save(); toast('Solicitação recusada.'); route();
    });
    // Link direto para uma sessão (#/.../agenda/AAAA-MM-DD/id) abre o detalhe
    const s = sessionId && visibleSessions({ includeCancelled: true }).find(x => x.id === sessionId);
    if (s) openSessionDetail(s);
}

const agendaPage = {
    title: () => 'Agenda',
    sub: () => user.role === 'personal' ? 'Sessões com seus alunos' : 'Suas aulas e avaliações',
    render: renderAgendaPage,
    bind: bindAgenda
};
clientPages.agenda = agendaPage;
trainerPages.agenda = agendaPage;
