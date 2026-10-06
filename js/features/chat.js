// ---------- Chat aluno ↔ coach (com o Supabase) ----------
// No modo demonstração continua o chat de exemplo de app.js.
const chatTime = iso => {
    const d = new Date(iso);
    const hm = d.toTimeString().slice(0, 5);
    return localISO(d) === today ? hm : `${fmtDate(localISO(d), { day: '2-digit', month: '2-digit' })} ${hm}`;
};

function threadOf(studentId) {
    return state.chat.filter(m => m.studentId === studentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function chatBox(studentId, otherName) {
    const msgs = threadOf(studentId);
    return `<div class="card chat">
        <div class="card-head"><div class="cell-user"><div class="avatar">${initials(otherName)}</div>
            <div><b>${esc(otherName)}</b><div class="small muted">${user.role === 'personal' ? 'Aluno' : 'Seu coach'}</div></div></div></div>
        <div class="chat-body" id="chat-body">
            ${msgs.map(m => `<div class="msg ${m.mine ? 'me' : 'them'}">${esc(m.body)}<small>${chatTime(m.createdAt)}${
                m.mine && m.readAt ? ' • lida' : ''}</small></div>`).join('')
                || '<div class="empty">Nenhuma mensagem ainda. Mande a primeira!</div>'}
        </div>
        <form class="chat-form" id="chat-form" data-student="${studentId}">
            <input class="input" name="text" placeholder="Escreva uma mensagem..." autocomplete="off" maxlength="2000">
            <button class="btn btn-primary" type="submit">Enviar</button>
        </form>
    </div>`;
}

// Coach: conversa escolhida no endereço (#/personal/mensagens/<id do aluno>)
function coachThreadId(param) {
    const students = Backend.people.filter(p => p.role === 'aluno');
    if (students.some(p => p.id === param)) return param;
    // Sem escolha: a conversa com mensagem mais recente, ou o primeiro aluno
    const last = [...state.chat].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return last ? last.studentId : (students[0] || {}).id;
}

function threadList(activeId) {
    const students = Backend.people.filter(p => p.role === 'aluno').map(p => {
        const msgs = threadOf(p.id);
        return { id: p.id, name: p.full_name || p.email, last: msgs.at(-1), unread: Backend.unreadCount(p.id) };
    }).sort((a, b) => ((b.last || {}).createdAt || '').localeCompare((a.last || {}).createdAt || '') || a.name.localeCompare(b.name));
    return `<div class="card thread-list">
        <div class="card-head"><h2>Conversas</h2></div>
        <input class="input" id="thread-search" placeholder="Buscar aluno..." style="margin-bottom:10px">
        <div class="list" id="threads">${students.map(t => `
            <a class="list-item clickable thread ${t.id === activeId ? 'active' : ''}" href="#/personal/mensagens/${t.id}" data-name="${esc(t.name.toLowerCase())}">
                <div class="avatar" style="width:34px;height:34px;font-size:12px">${initials(t.name)}</div>
                <div class="grow"><div class="title">${esc(t.name)}</div>
                    <div class="meta">${t.last ? esc((t.last.mine ? 'Você: ' : '') + t.last.body).slice(0, 48) : 'Sem mensagens'}</div></div>
                ${t.unread ? `<span class="badge accent">${t.unread}</span>` : ''}
            </a>`).join('') || '<div class="empty">Nenhum aluno ainda.</div>'}</div>
    </div>`;
}

function bindChatBox(view, studentId) {
    const body = view.querySelector('#chat-body');
    if (body) body.scrollTop = body.scrollHeight;
    const f = view.querySelector('#chat-form');
    if (!f) return;
    f.text.focus();
    f.onsubmit = async e => {
        e.preventDefault();
        const text = f.text.value.trim();
        if (!text) return;
        const btn = f.querySelector('button');
        btn.disabled = true;
        try {
            await Backend.sendMessage(studentId, text);
            f.text.value = '';
            route();
        } catch (err) {
            toast('Não foi possível enviar: ' + err.message);
        } finally {
            btn.disabled = false;
        }
    };
    // Abrir a conversa marca como lidas as mensagens recebidas
    if (Backend.unreadCount(studentId)) {
        Backend.markRead(studentId).then(() => {
            updateChatBadge();
            const b = document.querySelector('.thread.active .badge');
            if (b) b.remove();
        }).catch(err => console.error(err));
    }
}

function updateChatBadge() {
    const link = document.querySelector(`.side-link[href$="/mensagens"]`);
    if (!link) return;
    const n = Backend.unreadCount();
    let badge = link.querySelector('.badge');
    if (!n) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement('span'); badge.className = 'badge accent'; link.append(badge); }
    badge.textContent = n;
}

if (Backend.enabled) {
    clientPages.mensagens = {
        title: () => 'Mensagens',
        sub: () => `Conversa com ${SITE.coach}`,
        render: () => chatBox(Backend.profile.id, SITE.coach),
        bind: view => bindChatBox(view, Backend.profile.id)
    };

    trainerPages.mensagens = {
        title: () => 'Mensagens',
        sub: () => 'Conversas com seus alunos',
        render(param) {
            const id = coachThreadId(param);
            const student = Backend.people.find(p => p.id === id);
            return `<div class="grid chat-layout">
                ${threadList(id)}
                ${student ? chatBox(id, student.full_name || student.email) : '<div class="card empty">Cadastre um aluno para começar a conversar.</div>'}
            </div>`;
        },
        bind(view, param) {
            const id = coachThreadId(param);
            const search = view.querySelector('#thread-search');
            search.oninput = () => view.querySelectorAll('.thread').forEach(a => {
                a.hidden = !a.dataset.name.includes(search.value.toLowerCase());
            });
            if (id) bindChatBox(view, id);
        }
    };

    // A outra pessoa leu: atualiza o "• lida" se a conversa estiver aberta
    Backend.onRead = () => {
        if (location.hash.split('/')[2] !== 'mensagens') return;
        const draft = (document.querySelector('#chat-form [name=text]') || {}).value || '';
        route();
        const input = document.querySelector('#chat-form [name=text]');
        if (input) { input.value = draft; input.focus(); }
    };

    // Mensagem nova chegando em tempo real
    Backend.onMessage = msg => {
        const [, , page, param] = location.hash.split('/');
        const open = page === 'mensagens' &&
            (user.role === 'cliente' || coachThreadId(param) === msg.studentId);
        if (open || (page === 'mensagens' && user.role === 'personal')) {
            // Redesenha a conversa sem perder o que estava sendo digitado
            const draft = (document.querySelector('#chat-form [name=text]') || {}).value || '';
            route();
            const input = document.querySelector('#chat-form [name=text]');
            if (input) { input.value = draft; input.focus(); }
            return;
        }
        if (!msg.mine) toast(`Nova mensagem de ${user.role === 'personal' ? msg.student : SITE.coach}`);
        updateChatBadge();
    };
}
