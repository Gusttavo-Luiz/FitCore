// ---------- Avaliação física com fotos (aluno e personal) ----------
// O aluno envia as próprias fotos (status 'enviada'); o coach compara com as
// anteriores, escreve o comentário e marca como 'avaliada'.
const MEASURES = [
    ['weight', 'Peso', 'kg', 'down'], ['fat', 'Gordura', '%', 'down'], ['chest', 'Peito', 'cm', ''],
    ['waist', 'Cintura', 'cm', 'down'], ['hip', 'Quadril', 'cm', 'down'], ['arm', 'Braço', 'cm', 'up'], ['thigh', 'Coxa', 'cm', 'up']
];
const POSES = [['front', 'Frente'], ['side', 'Lado'], ['back', 'Costas']];
let evalStudent = CLIENT;
let evalCompare = { a: null, b: null };

const hasVal = v => v !== null && v !== undefined && v !== '';
const fmtMeasure = (v, unit) => hasVal(v) ? `${num(v)} ${unit}` : '—';
const isPending = x => x.status === 'enviada';
const evalDate = iso => fmtDate(iso, { day: '2-digit', month: 'short', year: 'numeric' });

function assessmentsOf(student) {
    return (state.assessments[student] || (state.assessments[student] = []))
        .sort((x, y) => x.date.localeCompare(y.date));
}

// Envios de todos os alunos esperando o coach, mais antigos primeiro
function pendingReviews() {
    return Object.entries(state.assessments)
        .flatMap(([student, list]) => list.filter(isPending).map(x => ({ student, x })))
        .sort((a, b) => a.x.date.localeCompare(b.x.date));
}

// Na demonstração, quem já tinha dados salvos também recebe o envio de exemplo
(function seedPendingDemo() {
    if (Backend.enabled || store.get('seed_review_v1')) return;
    for (const [student, list] of Object.entries(SEED.assessments)) {
        const mine = state.assessments[student] || (state.assessments[student] = []);
        list.forEach(x => { if (x.status && !mine.some(y => y.id === x.id)) mine.push(x); });
    }
    store.set('assessments', state.assessments);
    store.set('seed_review_v1', true);
})();

// Reduz a foto: no navegador (demonstração) o espaço é pequeno; no Supabase cabe mais detalhe
function compressImage(file, max = Backend.enabled ? 1000 : 480) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL('image/jpeg', Backend.enabled ? 0.82 : 0.72));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
        img.src = url;
    });
}

function photoBox(src, label) {
    return src
        ? `<button class="photo" data-photo="${src}" title="${label}"><img src="${src}" alt="${label}"><span>${label}</span></button>`
        : `<div class="photo photo-empty"><span>${label}</span><small>sem foto</small></div>`;
}

function thumbs(x) {
    return `<div class="thumbs">${POSES.map(([k, label]) => x.photos && x.photos[k]
        ? `<button class="thumb" data-photo="${x.photos[k]}" title="${label}"><img src="${x.photos[k]}" alt="${label}"></button>` : '').join('')}</div>`;
}

function deltaCell(a, b, dir) {
    if (!hasVal(a) || !hasVal(b)) return '<span class="muted">—</span>';
    const d = b - a;
    if (!d) return '<span class="muted">0</span>';
    const good = dir === 'down' ? d < 0 : dir === 'up' ? d > 0 : null;
    return `<span class="${good === null ? 'muted' : good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${num(d)}</span>`;
}

function evalStatusBadge(x) {
    return isPending(x)
        ? `<span class="badge orange">${user.role === 'personal' ? 'Aguardando sua avaliação' : 'Aguardando o coach'}</span>`
        : '<span class="badge green">Avaliada ✓</span>';
}

function summaryLine(x) {
    const parts = [];
    if (hasVal(x.weight)) parts.push(`${num(x.weight)} kg`);
    if (hasVal(x.fat)) parts.push(`${num(x.fat)}% gordura`);
    if (hasVal(x.waist)) parts.push(`cintura ${num(x.waist)} cm`);
    return parts.join(' • ') || 'Envio de fotos';
}

// Uma linha do histórico (ou da fila do coach)
function evalItem(x, student, { showName = false, canDelete = false } = {}) {
    const review = user.role === 'personal' && isPending(x);
    return `
    <div class="list-item eval-item" style="flex-wrap:wrap">
        <div class="date-box"><b>${fmtDate(x.date, { day: '2-digit' })}</b><span>${fmtDate(x.date, { month: 'short' })}</span></div>
        <div class="grow" style="min-width:180px">
            <div class="title">${showName ? `${esc(student)} • ` : ''}${summaryLine(x)} ${evalStatusBadge(x)}</div>
            <div class="meta">${x.notes ? (isPending(x) || x.submittedBy === 'aluno' ? 'Aluno: ' : '') + esc(x.notes) : 'Sem observações'}</div>
        </div>
        ${thumbs(x)}
        ${review ? `<button class="btn btn-primary btn-sm" data-review="${esc(student)}|${x.id}">Avaliar</button>` : ''}
        ${canDelete ? `<button class="btn btn-ghost btn-sm" data-del-eval="${x.id}" title="Excluir">✕</button>` : ''}
        ${x.feedback ? `<div class="eval-feedback"><b>💬 Comentário do coach</b>${x.reviewedAt ? `<small> • ${evalDate(x.reviewedAt.slice(0, 10))}</small>` : ''}<p>${esc(x.feedback)}</p></div>` : ''}
    </div>`;
}

// Coach: fila com os envios de todos os alunos
function renderReviewQueue() {
    const queue = pendingReviews();
    return `
    <div class="card" style="margin-bottom:18px" id="review-queue">
        <div class="card-head"><h2>📸 Fotos aguardando avaliação</h2><span class="badge ${queue.length ? 'orange' : ''}">${queue.length}</span></div>
        ${queue.length ? `<div class="list">${queue.map(({ student, x }) => evalItem(x, student, { showName: true })).join('')}</div>`
            : '<p class="muted" style="margin:0">Nenhum envio pendente. Quando um aluno mandar fotos, elas aparecem aqui.</p>'}
    </div>`;
}

function renderAssessments(student) {
    const list = assessmentsOf(student);
    const coach = user.role === 'personal';
    const byId = idv => list.find(x => x.id === idv);
    const A = byId(evalCompare.a) || list[0];
    const B = byId(evalCompare.b) || list[list.length - 1];
    const lastFeedback = [...list].reverse().find(x => x.feedback);
    const bar = coach ? `
        <label class="field" style="max-width:260px">Aluno
            <select class="input" id="eval-student">${SEED.students.map(s =>
                `<option ${s.name === student ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <button class="btn btn-primary" id="eval-new">+ Nova avaliação</button>` : `
        <div class="muted small" style="max-width:420px">Tire fotos de frente, de lado e de costas, com boa luz e roupa de treino. O coach compara com as anteriores e te responde.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost" id="eval-new">Registrar medidas</button>
            <button class="btn btn-primary" id="eval-send">📸 Enviar fotos para o coach</button>
        </div>`;

    return `
    <div class="card-head" style="margin-bottom:18px;align-items:flex-end;flex-wrap:wrap;gap:12px">${bar}</div>
    ${!coach && lastFeedback ? `<div class="card eval-feedback-card" style="margin-bottom:18px">
        <div class="card-head"><h2>💬 Último comentário do coach</h2><span class="muted small">fotos de ${evalDate(lastFeedback.date)}</span></div>
        <p style="margin:0;white-space:pre-line">${esc(lastFeedback.feedback)}</p></div>` : ''}
    ${!list.length ? `<div class="card empty">${coach ? 'Nenhuma avaliação registrada ainda.' : 'Você ainda não enviou fotos. Toque em “Enviar fotos para o coach” para começar.'}</div>` : `
    ${list.length > 1 ? `<div class="card">
        <div class="card-head" style="flex-wrap:wrap">
            <h2>Comparar avaliações</h2>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <select class="input" id="cmp-a" style="width:auto">${list.map(x => `<option value="${x.id}" ${x === A ? 'selected' : ''}>${evalDate(x.date)}</option>`).join('')}</select>
                <span class="muted">→</span>
                <select class="input" id="cmp-b" style="width:auto">${list.map(x => `<option value="${x.id}" ${x === B ? 'selected' : ''}>${evalDate(x.date)}</option>`).join('')}</select>
            </div>
        </div>
        <div class="grid grid-2">
            <div class="table-wrap"><table>
                <thead><tr><th>Medida</th><th>Antes</th><th>Depois</th><th>Diferença</th></tr></thead>
                <tbody>${MEASURES.map(([k, label, unit, dir]) => `<tr><td>${label}</td>
                    <td>${fmtMeasure(A[k], unit)}</td><td>${fmtMeasure(B[k], unit)}</td><td>${deltaCell(A[k], B[k], dir)}${hasVal(A[k]) && hasVal(B[k]) ? ' ' + unit : ''}</td></tr>`).join('')}</tbody>
            </table></div>
            <div class="compare">
                ${POSES.map(([k, label]) => `<div class="compare-row">
                    ${photoBox((A.photos || {})[k], label + ' • antes')}${photoBox((B.photos || {})[k], label + ' • depois')}</div>`).join('')}
            </div>
        </div>
    </div>` : ''}
    <div class="card" style="margin-top:18px">
        <div class="card-head"><h2>Histórico</h2><span class="badge">${list.length}</span></div>
        <div class="list">${[...list].reverse().map(x => evalItem(x, student, { canDelete: coach || isPending(x) })).join('')}</div>
    </div>`}`;
}

// Escolha das 3 fotos (frente, lado, costas) dentro de um formulário
function photoPickers(form, photos) {
    form.querySelectorAll('input[type=file]').forEach(inp => inp.onchange = async () => {
        const file = inp.files[0];
        if (!file) return;
        try {
            photos[inp.name] = await compressImage(file);
            const box = inp.closest('.photo-pick');
            box.classList.remove('photo-empty');
            box.style.backgroundImage = `url(${photos[inp.name]})`;
            box.querySelector('small').textContent = 'trocar foto';
        } catch (_) { toast('Não foi possível ler essa imagem.'); }
    });
}

const photoInputs = () => `<div class="photo-inputs">${POSES.map(([k, label]) => `
    <label class="photo photo-empty photo-pick">
        <input type="file" accept="image/*" name="${k}" hidden>
        <span>${label}</span><small>toque para escolher</small>
    </label>`).join('')}</div>`;

// Grava a avaliação; na área do aluno, o peso também alimenta os gráficos de evolução
function storeAssessment(student, entry) {
    const list = assessmentsOf(student);
    list.push(entry);
    const prevProgress = state.progress;
    if (student === CLIENT && hasVal(entry.weight)) {
        const last = state.progress.slice(-1)[0] || {};
        state.progress = [...state.progress.filter(p => p.date !== entry.date),
            { date: entry.date, weight: entry.weight, fat: hasVal(entry.fat) ? entry.fat : last.fat ?? 0, waist: hasVal(entry.waist) ? entry.waist : last.waist ?? 0 }]
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    if (!save()) { list.pop(); state.progress = prevProgress; save(); return false; }
    evalCompare = { a: null, b: entry.id };
    return true;
}

const emptyMeasures = () => Object.fromEntries(MEASURES.map(([k]) => [k, null]));
const readMeasure = v => v === '' ? null : +v;

// Aluno: envio rápido de fotos para o coach avaliar
function openPhotoSubmit() {
    const m = modal(`
        <h3>📸 Enviar fotos para o coach</h3>
        <p class="sub">Frente, lado e costas, com boa luz e a mesma roupa das fotos anteriores. Envie pelo menos uma.</p>
        <form id="send-form">
            <div class="field">Fotos ${photoInputs()}</div>
            <div class="form-row">
                <label class="field">Peso de hoje (kg, opcional)<input class="input" type="number" step="0.1" min="0" name="weight"></label>
            </div>
            <label class="field">Recado para o coach (opcional)<textarea class="input" name="notes" rows="2" placeholder="Ex.: como você se sentiu nas últimas semanas"></textarea></label>
            <button class="btn btn-primary btn-block" type="submit">Enviar para avaliação</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    m.classList.add('modal-wide');
    const form = m.querySelector('#send-form');
    const photos = {};
    photoPickers(form, photos);
    form.onsubmit = e => {
        e.preventDefault();
        if (!Object.keys(photos).length) return toast('Escolha pelo menos uma foto.');
        const entry = { id: newId('av'), date: today, ...emptyMeasures(), weight: readMeasure(form.weight.value),
            notes: form.notes.value.trim(), photos, status: 'enviada', feedback: '', reviewedAt: null, submittedBy: 'aluno' };
        if (!storeAssessment(CLIENT, entry)) return;
        closeModal();
        toast('Fotos enviadas! O coach vai avaliar e te responder.');
        route();
    };
}

// Registro completo (medidas + fotos). Do aluno vai para o coach avaliar; do coach já fica avaliada.
function openAssessmentForm(student) {
    const coach = user.role === 'personal';
    const last = [...assessmentsOf(student)].reverse();
    const lastVal = k => (last.find(x => hasVal(x[k])) || {})[k] ?? '';
    const m = modal(`
        <h3>${coach ? 'Nova avaliação' : 'Registrar medidas'}</h3>
        <p class="sub">${esc(student)} • preencha só o que tiver medido</p>
        <form id="eval-form">
            <div class="form-row">
                <label class="field">Data<input class="input" type="date" name="date" value="${today}" max="${today}" required></label>
                ${MEASURES.map(([k, label, unit]) => `<label class="field">${label} (${unit})
                    <input class="input" type="number" step="0.1" min="0" name="${k}" value="${lastVal(k)}"></label>`).join('')}
            </div>
            <div class="field">Fotos (opcional) ${photoInputs()}</div>
            <label class="field">Observações<textarea class="input" name="notes" rows="2"></textarea></label>
            <button class="btn btn-primary btn-block" type="submit">${coach ? 'Salvar avaliação' : 'Enviar para o coach'}</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    m.classList.add('modal-wide');
    const form = m.querySelector('#eval-form');
    const photos = {};
    photoPickers(form, photos);

    form.onsubmit = e => {
        e.preventDefault();
        const entry = { id: newId('av'), date: form.date.value, notes: form.notes.value.trim(), photos,
            status: coach ? 'avaliada' : 'enviada', feedback: '', reviewedAt: coach ? new Date().toISOString() : null, submittedBy: coach ? 'coach' : 'aluno' };
        MEASURES.forEach(([k]) => entry[k] = readMeasure(form[k].value));
        if (!Object.keys(photos).length && MEASURES.every(([k]) => !hasVal(entry[k])))
            return toast('Preencha alguma medida ou escolha uma foto.');
        if (!storeAssessment(student, entry)) return;
        closeModal();
        toast(coach ? 'Avaliação registrada!' : 'Enviado! O coach vai avaliar e te responder.');
        route();
    };
}

// Id da conversa do aluno no chat: o nome na demonstração, o id do perfil no Supabase
function chatIdOf(student) {
    return Backend.enabled ? (Backend.people.find(p => p.full_name === student) || {}).id : student;
}

// Coach: compara as fotos novas com as últimas avaliadas e escreve o retorno
function openReview(student, id) {
    const list = assessmentsOf(student);
    const x = list.find(a => a.id === id);
    if (!x) return;
    const prevOf = pose => [...list].reverse().find(a => a !== x && !isPending(a) && a.date <= x.date && a.photos && a.photos[pose]);
    const tile = (src, label) => src ? `<div class="photo"><img src="${src}" alt="${label}"><span>${label}</span></div>`
        : `<div class="photo photo-empty"><span>${label}</span><small>sem foto anterior</small></div>`;
    const poses = POSES.filter(([k]) => x.photos && x.photos[k]);
    const m = modal(`
        <h3>Avaliar fotos</h3>
        <p class="sub">${esc(student)} • enviadas em ${evalDate(x.date)}</p>
        ${x.notes ? `<div class="eval-feedback" style="margin:0 0 14px"><b>Recado do aluno</b><p>${esc(x.notes)}</p></div>` : ''}
        <div class="compare review-compare">${poses.map(([k, label]) => {
            const prev = prevOf(k);
            return `<div class="compare-row">${tile(prev && prev.photos[k], `${label} • ${prev ? fmtDate(prev.date) : 'anterior'}`)}${tile(x.photos[k], `${label} • nova`)}</div>`;
        }).join('') || '<p class="muted">Este envio não tem fotos.</p>'}</div>
        <form id="review-form" style="margin-top:14px">
            <details class="field"><summary>Medidas (opcional)</summary>
                <div class="form-row" style="margin-top:8px">${MEASURES.map(([k, label, unit]) => `<label class="field">${label} (${unit})
                    <input class="input" type="number" step="0.1" min="0" name="${k}" value="${hasVal(x[k]) ? x[k] : ''}"></label>`).join('')}</div>
            </details>
            <label class="field">Seu comentário para o aluno
                <textarea class="input" name="feedback" rows="4" required placeholder="O que melhorou, o que ajustar no treino e na dieta…"></textarea></label>
            <label class="check-line"><input type="checkbox" name="chat" checked> Enviar o comentário também no chat do aluno</label>
            <button class="btn btn-primary btn-block" type="submit">Concluir avaliação</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    m.classList.add('modal-wide');
    const form = m.querySelector('#review-form');
    form.onsubmit = async e => {
        e.preventDefault();
        const feedback = form.feedback.value.trim();
        if (!feedback) return toast('Escreva um comentário para o aluno.');
        const before = { ...x };
        MEASURES.forEach(([k]) => x[k] = readMeasure(form[k].value));
        Object.assign(x, { feedback, status: 'avaliada', reviewedAt: new Date().toISOString() });
        if (!save()) { Object.assign(x, before); save(); return; }
        closeModal();
        toast('Avaliação concluída!');
        route();
        const chatId = form.chat.checked && chatIdOf(student);
        if (chatId) {
            try { await Chat.send(chatId, `📸 Avaliação das suas fotos de ${evalDate(x.date)}:\n${feedback}`); }
            catch (_) { toast('Avaliação salva, mas a mensagem no chat não foi enviada.'); }
        }
    };
}

function bindAssessments(view, student) {
    const newBtn = view.querySelector('#eval-new');
    if (newBtn) newBtn.onclick = () => openAssessmentForm(student);
    const sendBtn = view.querySelector('#eval-send');
    if (sendBtn) sendBtn.onclick = openPhotoSubmit;
    const sel = view.querySelector('#eval-student');
    if (sel) sel.onchange = () => { evalStudent = sel.value; evalCompare = { a: null, b: null }; route(); };
    const a = view.querySelector('#cmp-a'), b = view.querySelector('#cmp-b');
    if (a) {
        a.onchange = b.onchange = () => { evalCompare = { a: a.value, b: b.value }; route(); };
    }
    view.querySelectorAll('[data-photo]').forEach(el => el.onclick = () =>
        modal(`<img src="${el.dataset.photo}" alt="" style="width:100%;border-radius:12px">
               <button class="btn btn-block" data-close style="margin-top:12px">Fechar</button>`));
    view.querySelectorAll('[data-review]').forEach(btn => btn.onclick = () => {
        const [name, id] = btn.dataset.review.split('|');
        openReview(name, id);
    });
    view.querySelectorAll('[data-del-eval]').forEach(btn => btn.onclick = () => {
        if (!confirm('Excluir esta avaliação e suas fotos?')) return;
        state.assessments[student] = assessmentsOf(student).filter(x => x.id !== btn.dataset.delEval);
        save(); route();
    });
}

clientPages.avaliacao = {
    title: () => 'Avaliação física',
    sub: () => 'Envie suas fotos e receba o retorno do coach',
    render: () => renderAssessments(CLIENT),
    bind: view => bindAssessments(view, CLIENT)
};

trainerPages.avaliacoes = {
    title: () => 'Avaliações físicas',
    sub: () => 'Fotos enviadas pelos alunos, medidas e evolução',
    render: () => {
        if (!SEED.students.some(s => s.name === evalStudent)) evalStudent = (SEED.students[0] || {}).name || '';
        if (!evalStudent) return renderReviewQueue() + '<div class="card empty">Nenhum aluno cadastrado ainda.</div>';
        return renderReviewQueue() + renderAssessments(evalStudent);
    },
    bind: view => bindAssessments(view, evalStudent)
};
