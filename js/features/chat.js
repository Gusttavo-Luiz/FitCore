// ---------- Chat aluno ↔ coach ----------
// O coach tem uma lista com todos os alunos e uma conversa particular com cada um.
// Com o Supabase, as mensagens vão para o banco e chegam em tempo real.
// No modo demonstração, ficam no navegador e a outra ponta "responde" sozinha.

// Mensagem: { id, studentId, student, mine (Supabase) | fromStudent (demo), body, createdAt, readAt }
const Chat = {
    // Alunos que aparecem na lista do coach
    people() {
        return Backend.enabled
            ? Backend.people.filter(p => p.role === 'aluno').map(p => ({ id: p.id, name: p.full_name || p.email }))
            : SEED.students.map(s => ({ id: s.name, name: s.name }));
    },
    // Conversa do aluno logado
    myThreadId: () => Backend.enabled ? Backend.profile.id : CLIENT,
    // Na demonstração dá para ver como coach ou como aluno, então "minha" depende de quem está vendo
    isMine: m => Backend.enabled ? m.mine : (user.role === 'personal') !== m.fromStudent,
    unread(studentId) {
        return state.chat.filter(m => !Chat.isMine(m) && !m.readAt &&
            (studentId ? m.studentId === studentId : user.role === 'personal' || m.studentId === Chat.myThreadId())).length;
    },
    async send(studentId, body) {
        if (Backend.enabled) return Backend.sendMessage(studentId, body);
        const fromStudent = user.role !== 'personal';
        state.chat.push({ id: newId('m'), studentId, student: studentId, fromStudent, body, createdAt: new Date().toISOString(), readAt: null });
        save();
        demoReply(studentId, fromStudent);
    },
    async markRead(studentId) {
        if (Backend.enabled) return Backend.markRead(studentId);
        const now = new Date().toISOString();
        state.chat.forEach(m => { if (m.studentId === studentId && !Chat.isMine(m) && !m.readAt) m.readAt = now; });
        save();
    }
};

// Demonstração: a outra ponta lê e responde depois de alguns segundos
const DEMO_REPLIES = {
    coach: ['Recebido! Já te respondo com mais detalhes 👊', 'Boa! Segue firme que o resultado vem.', 'Fechado, vou ajustar na sua ficha.'],
    student: ['Valeu, coach! 💪', 'Combinado, pode deixar!', 'Show, obrigado pelo retorno!']
};
function demoReply(studentId, fromStudent) {
    setTimeout(() => {
        const now = new Date().toISOString();
        // A outra pessoa "abriu" a conversa: as mensagens enviadas ficam como lidas
        state.chat.forEach(m => { if (m.studentId === studentId && m.fromStudent === fromStudent && !m.readAt) m.readAt = now; });
        const list = fromStudent ? DEMO_REPLIES.coach : DEMO_REPLIES.student;
        const body = list[state.chat.filter(m => m.studentId === studentId).length % list.length];
        state.chat.push({ id: newId('m'), studentId, student: studentId, fromStudent: !fromStudent, body, createdAt: now, readAt: null });
        save();
        onChatMessage({ studentId, student: studentId, mine: false });
    }, 1800);
}

// Conversas de exemplo da demonstração
function seedChat() {
    const ago = min => new Date(Date.now() - min * 60000).toISOString();
    const msg = (student, fromStudent, body, min, read = true) =>
        ({ id: newId('m'), studentId: student, student, fromStudent, body, createdAt: ago(min), readAt: read ? ago(min - 1) : null });
    return [
        msg('Lucas Andrade', false, 'Bom dia! Como foi o treino de pernas ontem?', 190),
        msg('Lucas Andrade', true, 'Foi pesado, mas consegui subir a carga no agachamento para 80 kg 💪', 172),
        msg('Lucas Andrade', false, 'Excelente! Mantém essa carga essa semana e foca na execução. Na próxima avaliação a gente ajusta.', 168),
        msg('Lucas Andrade', false, 'Lembre de beber pelo menos 3 L de água por dia.', 167),
        msg('Mariana Souza', true, 'Coach, terminei o treino B hoje! 🔥', 42, false),
        msg('Rafael Lima', false, 'Rafael, como está a recuperação do ombro?', 300),
        msg('Rafael Lima', true, 'Bem melhor! Posso voltar com o supino essa semana?', 25, false),
        msg('Juliana Costa', false, 'Juliana, senti sua falta nos treinos essa semana. Está tudo bem?', 1440, false)
    ];
}

const chatTime = iso => {
    const d = new Date(iso);
    const hm = d.toTimeString().slice(0, 5);
    return localISO(d) === today ? hm : `${fmtDate(localISO(d), { day: '2-digit', month: '2-digit' })} ${hm}`;
};

function threadOf(studentId) {
    return state.chat.filter(m => m.studentId === studentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function chatBox(studentId, otherName) {
    const msgs = threadOf(studentId);
    return `<div class="card chat">
        <div class="card-head"><div class="cell-user"><div class="avatar">${initials(otherName)}</div>
            <div><b>${esc(otherName)}</b><div class="small muted">${user.role === 'personal' ? 'Conversa particular' : 'Seu coach'}</div></div></div></div>
        <div class="chat-body" id="chat-body">
            ${msgs.map(m => `<div class="msg ${Chat.isMine(m) ? 'me' : 'them'}">${esc(m.body)}<small>${chatTime(m.createdAt)}${
                Chat.isMine(m) && m.readAt ? ' • lida' : ''}</small></div>`).join('')
                || '<div class="empty">Nenhuma mensagem ainda. Mande a primeira!</div>'}
        </div>
        <form class="chat-form" id="chat-form">
            <input class="input" name="text" placeholder="Escreva uma mensagem..." autocomplete="off" maxlength="2000">
            <button class="btn btn-primary" type="submit">Enviar</button>
        </form>
    </div>`;
}

// Coach: conversa escolhida no endereço (#/personal/mensagens/<aluno>)
function coachThreadId(param) {
    const people = Chat.people();
    const wanted = param && decodeURIComponent(param);
    if (people.some(p => p.id === wanted)) return wanted;
    // Sem escolha: a conversa com mensagem mais recente, ou o primeiro aluno
    const last = [...state.chat].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .find(m => people.some(p => p.id === m.studentId));
    return last ? last.studentId : (people[0] || {}).id;
}

function threadList(activeId) {
    const threads = Chat.people().map(p => {
        const msgs = threadOf(p.id);
        return { ...p, last: msgs.at(-1), unread: Chat.unread(p.id) };
    }).sort((a, b) => ((b.last || {}).createdAt || '').localeCompare((a.last || {}).createdAt || '') || a.name.localeCompare(b.name));
    const total = threads.reduce((t, x) => t + x.unread, 0);
    return `<div class="card thread-list">
        <div class="card-head"><h2>Alunos</h2>${total ? `<span class="badge accent">${total} não lida${total > 1 ? 's' : ''}</span>` : ''}</div>
        <input class="input" id="thread-search" placeholder="Buscar aluno..." style="margin-bottom:10px">
        <div class="list" id="threads">${threads.map(t => `
            <a class="list-item clickable thread ${t.id === activeId ? 'active' : ''}" href="#/personal/mensagens/${encodeURIComponent(t.id)}" data-name="${esc(t.name.toLowerCase())}">
                <div class="avatar" style="width:34px;height:34px;font-size:12px">${initials(t.name)}</div>
                <div class="grow"><div class="title">${esc(t.name)}</div>
                    <div class="meta">${t.last ? esc(((Chat.isMine(t.last) ? 'Você: ' : '') + t.last.body).slice(0, 46)) : 'Sem mensagens — comece a conversa'}</div></div>
                <div class="thread-side">
                    ${t.last ? `<small class="muted">${chatTime(t.last.createdAt)}</small>` : ''}
                    ${t.unread ? `<span class="badge accent">${t.unread}</span>` : ''}
                </div>
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
            await Chat.send(studentId, text);
            redrawKeepingDraft('');
        } catch (err) {
            toast('Não foi possível enviar: ' + err.message);
        } finally {
            btn.disabled = false;
        }
    };
    // Abrir a conversa marca como lidas as mensagens recebidas
    if (Chat.unread(studentId)) {
        Promise.resolve(Chat.markRead(studentId)).then(() => {
            updateChatBadge();
            const b = document.querySelector('.thread.active .badge');
            if (b) b.remove();
            // Contador do topo da lista de alunos
            const head = document.querySelector('.thread-list .card-head .badge');
            const total = Chat.unread();
            if (head) { if (total) head.textContent = `${total} não lida${total > 1 ? 's' : ''}`; else head.remove(); }
        }).catch(err => console.error(err));
    }
}

// Redesenha a tela sem perder o que estava sendo digitado
function redrawKeepingDraft(draft) {
    if (draft === undefined) draft = (document.querySelector('#chat-form [name=text]') || {}).value || '';
    route();
    const input = document.querySelector('#chat-form [name=text]');
    if (input) { input.value = draft; input.focus(); }
}

function updateChatBadge() {
    const link = document.querySelector('.side-link[href$="/mensagens"]');
    if (!link) return;
    const n = Chat.unread();
    let badge = link.querySelector('.badge');
    if (!n) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement('span'); badge.className = 'badge accent'; link.append(badge); }
    badge.textContent = n;
}

// Mensagem nova (tempo real no Supabase, ou resposta automática na demonstração)
function onChatMessage(msg) {
    if (location.hash.split('/')[2] === 'mensagens') return redrawKeepingDraft();
    if (!msg.mine) toast(`Nova mensagem de ${user.role === 'personal' ? msg.student : SITE.coach}`);
    updateChatBadge();
}

clientPages.mensagens = {
    title: () => 'Mensagens',
    sub: () => `Conversa com ${SITE.coach}`,
    render: () => chatBox(Chat.myThreadId(), SITE.coach),
    bind: view => bindChatBox(view, Chat.myThreadId())
};

trainerPages.mensagens = {
    title: () => 'Mensagens',
    sub: () => 'Converse em particular com cada aluno',
    render(param) {
        const id = coachThreadId(param);
        const person = Chat.people().find(p => p.id === id);
        return `<div class="grid chat-layout">
            ${threadList(id)}
            ${person ? chatBox(id, person.name) : '<div class="card empty">Cadastre um aluno para começar a conversar.</div>'}
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

if (Backend.enabled) {
    Backend.onMessage = onChatMessage;
    // A outra pessoa leu: atualiza o "• lida" se a conversa estiver aberta
    Backend.onRead = () => { if (location.hash.split('/')[2] === 'mensagens') redrawKeepingDraft(); };
} else {
    state.chat = store.get('chat', null) || seedChat();
}
