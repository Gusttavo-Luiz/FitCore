// ---------- Avaliação física com fotos (aluno e personal) ----------
const MEASURES = [
    ['weight', 'Peso', 'kg', 'down'], ['fat', 'Gordura', '%', 'down'], ['chest', 'Peito', 'cm', ''],
    ['waist', 'Cintura', 'cm', 'down'], ['hip', 'Quadril', 'cm', 'down'], ['arm', 'Braço', 'cm', 'up'], ['thigh', 'Coxa', 'cm', 'up']
];
const POSES = [['front', 'Frente'], ['side', 'Lado'], ['back', 'Costas']];
let evalStudent = CLIENT;
let evalCompare = { a: null, b: null };

function assessmentsOf(student) {
    return (state.assessments[student] || (state.assessments[student] = []))
        .sort((x, y) => x.date.localeCompare(y.date));
}

// Reduz a foto para caber no armazenamento do navegador
function compressImage(file, max = 480) {
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
            resolve(c.toDataURL('image/jpeg', 0.72));
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

function deltaCell(a, b, dir) {
    const d = b - a;
    if (!d) return '<span class="muted">0</span>';
    const good = dir === 'down' ? d < 0 : dir === 'up' ? d > 0 : null;
    return `<span class="${good === null ? 'muted' : good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${num(d)}</span>`;
}

function renderAssessments(student) {
    const list = assessmentsOf(student);
    const byId = idv => list.find(x => x.id === idv);
    const A = byId(evalCompare.a) || list[0];
    const B = byId(evalCompare.b) || list[list.length - 1];
    const trainerBar = user.role === 'personal' ? `
        <label class="field" style="max-width:260px">Aluno
            <select class="input" id="eval-student">${SEED.students.map(s =>
                `<option ${s.name === student ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : '<div></div>';

    return `
    <div class="card-head" style="margin-bottom:18px;align-items:flex-end">${trainerBar}
        <button class="btn btn-primary" id="eval-new">+ Nova avaliação</button></div>
    ${!list.length ? '<div class="card empty">Nenhuma avaliação registrada ainda.</div>' : `
    <div class="card">
        <div class="card-head" style="flex-wrap:wrap">
            <h2>Comparar avaliações</h2>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <select class="input" id="cmp-a" style="width:auto">${list.map(x => `<option value="${x.id}" ${x === A ? 'selected' : ''}>${fmtDate(x.date, { day: '2-digit', month: 'short', year: 'numeric' })}</option>`).join('')}</select>
                <span class="muted">→</span>
                <select class="input" id="cmp-b" style="width:auto">${list.map(x => `<option value="${x.id}" ${x === B ? 'selected' : ''}>${fmtDate(x.date, { day: '2-digit', month: 'short', year: 'numeric' })}</option>`).join('')}</select>
            </div>
        </div>
        <div class="grid grid-2">
            <div class="table-wrap"><table>
                <thead><tr><th>Medida</th><th>Antes</th><th>Depois</th><th>Diferença</th></tr></thead>
                <tbody>${MEASURES.map(([k, label, unit, dir]) => `<tr><td>${label}</td>
                    <td>${num(A[k])} ${unit}</td><td>${num(B[k])} ${unit}</td><td>${deltaCell(A[k], B[k], dir)} ${unit}</td></tr>`).join('')}</tbody>
            </table></div>
            <div class="compare">
                ${POSES.map(([k, label]) => `<div class="compare-row">
                    ${photoBox(A.photos[k], label + ' • antes')}${photoBox(B.photos[k], label + ' • depois')}</div>`).join('')}
            </div>
        </div>
    </div>
    <div class="card" style="margin-top:18px">
        <div class="card-head"><h2>Histórico</h2><span class="badge">${list.length}</span></div>
        <div class="list">${[...list].reverse().map(x => `
            <div class="list-item" style="flex-wrap:wrap">
                <div class="date-box"><b>${fmtDate(x.date, { day: '2-digit' })}</b><span>${fmtDate(x.date, { month: 'short' })}</span></div>
                <div class="grow"><div class="title">${num(x.weight)} kg • ${num(x.fat)}% gordura • cintura ${num(x.waist)} cm</div>
                    <div class="meta">${esc(x.notes || 'Sem observações')}</div></div>
                <div class="thumbs">${POSES.map(([k, label]) => x.photos[k]
                    ? `<button class="thumb" data-photo="${x.photos[k]}" title="${label}"><img src="${x.photos[k]}" alt="${label}"></button>` : '').join('')}</div>
                <button class="btn btn-ghost btn-sm" data-del-eval="${x.id}" title="Excluir">✕</button>
            </div>`).join('')}</div>
    </div>`}`;
}

function openAssessmentForm(student) {
    const last = assessmentsOf(student).slice(-1)[0] || {};
    const m = modal(`
        <h3>Nova avaliação</h3>
        <p class="sub">${esc(student)}</p>
        <form id="eval-form">
            <div class="form-row">
                <label class="field">Data<input class="input" type="date" name="date" value="${today}" required></label>
                ${MEASURES.map(([k, label, unit]) => `<label class="field">${label} (${unit})
                    <input class="input" type="number" step="0.1" min="0" name="${k}" value="${last[k] ?? ''}" required></label>`).join('')}
            </div>
            <div class="field">Fotos (opcional)
                <div class="photo-inputs">${POSES.map(([k, label]) => `
                    <label class="photo photo-empty photo-pick">
                        <input type="file" accept="image/*" name="${k}" hidden>
                        <span>${label}</span><small>toque para escolher</small>
                    </label>`).join('')}</div>
            </div>
            <label class="field">Observações<textarea class="input" name="notes" rows="2"></textarea></label>
            <button class="btn btn-primary btn-block" type="submit">Salvar avaliação</button>
            <button class="btn btn-ghost btn-block" type="button" data-close>Cancelar</button>
        </form>`);
    m.classList.add('modal-wide');
    const form = m.querySelector('#eval-form');
    const photos = {};

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

    form.onsubmit = e => {
        e.preventDefault();
        const entry = { id: newId('av'), date: form.date.value, notes: form.notes.value.trim(), photos };
        MEASURES.forEach(([k]) => entry[k] = +form[k].value);
        const list = assessmentsOf(student);
        list.push(entry);
        // Na área do aluno, a avaliação também alimenta os gráficos de evolução
        const prevProgress = state.progress;
        if (student === CLIENT) {
            state.progress = [...state.progress.filter(p => p.date !== entry.date),
                { date: entry.date, weight: entry.weight, fat: entry.fat, waist: entry.waist }]
                .sort((a, b) => a.date.localeCompare(b.date));
        }
        if (!save()) { list.pop(); state.progress = prevProgress; save(); return; }
        evalCompare = { a: null, b: entry.id };
        toast('Avaliação registrada!');
        route();
    };
}

function bindAssessments(view, student) {
    view.querySelector('#eval-new').onclick = () => openAssessmentForm(student);
    const sel = view.querySelector('#eval-student');
    if (sel) sel.onchange = () => { evalStudent = sel.value; evalCompare = { a: null, b: null }; route(); };
    const a = view.querySelector('#cmp-a'), b = view.querySelector('#cmp-b');
    if (a) {
        a.onchange = b.onchange = () => { evalCompare = { a: a.value, b: b.value }; route(); };
    }
    view.querySelectorAll('[data-photo]').forEach(el => el.onclick = () =>
        modal(`<img src="${el.dataset.photo}" alt="" style="width:100%;border-radius:12px">
               <button class="btn btn-block" data-close style="margin-top:12px">Fechar</button>`));
    view.querySelectorAll('[data-del-eval]').forEach(btn => btn.onclick = () => {
        if (!confirm('Excluir esta avaliação e suas fotos?')) return;
        state.assessments[student] = assessmentsOf(student).filter(x => x.id !== btn.dataset.delEval);
        save(); route();
    });
}

clientPages.avaliacao = {
    title: () => 'Avaliação física',
    sub: () => 'Medidas e fotos para acompanhar sua evolução',
    render: () => renderAssessments(CLIENT),
    bind: view => bindAssessments(view, CLIENT)
};

trainerPages.avaliacoes = {
    title: () => 'Avaliações físicas',
    sub: () => 'Medidas e fotos dos seus alunos',
    render: () => {
        if (!SEED.students.some(s => s.name === evalStudent)) evalStudent = (SEED.students[0] || {}).name || '';
        if (!evalStudent) return '<div class="card empty">Nenhum aluno cadastrado ainda.</div>';
        return renderAssessments(evalStudent);
    },
    bind: view => { if (evalStudent) bindAssessments(view, evalStudent); }
};
