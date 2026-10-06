// ---------- Fichas de treino por aluno (personal) ----------
let fichaStudent = CLIENT;
const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function libraryOptions() {
    return LIB_GROUPS.map(g => `<optgroup label="${g}">${SEED.library.filter(e => e.group === g)
        .map(e => `<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
}

trainerPages.fichas = {
    title: () => 'Fichas de treino',
    sub: () => 'Monte e ajuste as fichas de cada aluno',
    render(id) {
        if (!SEED.students.some(s => s.name === fichaStudent)) fichaStudent = (SEED.students[0] || {}).name || '';
        if (!fichaStudent) return '<div class="card empty">Nenhum aluno cadastrado ainda.</div>';
        const plan = planOf(fichaStudent);
        const w = plan.find(x => x.id === id) || plan[0];
        const toolbar = `
        <div class="card" style="margin-bottom:18px">
            <div class="form-row">
                <label class="field">Aluno
                    <select class="input" id="ficha-student">${SEED.students.map(s =>
                        `<option ${s.name === fichaStudent ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
                </label>
                <button class="btn btn-primary" id="ficha-new">+ Nova ficha</button>
                ${plan.length ? '' : `<select class="input" id="ficha-copy"><option value="">Copiar fichas de outro aluno...</option>
                    ${SEED.students.filter(s => s.name !== fichaStudent && planOf(s.name).length)
                        .map(s => `<option>${esc(s.name)}</option>`).join('')}</select>`}
            </div>
            ${fichaStudent === CLIENT ? '<p class="muted small" style="margin-top:10px">💡 As fichas do Lucas aparecem na área do aluno desta demonstração.</p>' : ''}
        </div>`;
        if (!w) return toolbar + '<div class="card empty">Este aluno ainda não tem fichas. Crie uma nova ou copie de outro aluno.</div>';

        return toolbar + `
        <div class="tabs">${plan.map(x =>
            `<a class="tab ${x.id === w.id ? 'active' : ''}" href="#/personal/fichas/${x.id}">${esc(x.name)}</a>`).join('')}</div>
        <div class="grid grid-main">
            <div class="card">
                <div class="card-head"><h2>Exercícios</h2><span class="badge">${w.exercises.length}</span></div>
                ${w.exercises.length ? `<div class="table-wrap"><table class="edit-table">
                    <thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Carga</th><th>Descanso</th><th></th></tr></thead>
                    <tbody>${w.exercises.map((e, i) => `<tr data-row="${i}">
                        <td><b>${esc(e.name)}</b></td>
                        <td><input class="input" type="number" min="1" data-f="sets" value="${e.sets}"></td>
                        <td><input class="input" data-f="reps" value="${esc(e.reps)}"></td>
                        <td><input class="input" data-f="load" value="${esc(e.load)}"></td>
                        <td><input class="input" data-f="rest" value="${esc(e.rest)}"></td>
                        <td style="white-space:nowrap">
                            <button class="btn btn-ghost btn-sm" data-move="-1" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
                            <button class="btn btn-ghost btn-sm" data-move="1" title="Descer" ${i === w.exercises.length - 1 ? 'disabled' : ''}>↓</button>
                            <button class="btn btn-ghost btn-sm" data-remove title="Remover">✕</button>
                        </td></tr>`).join('')}</tbody>
                </table></div>` : '<div class="empty">Nenhum exercício nesta ficha ainda.</div>'}
                <form id="ex-add" class="form-row" style="margin-top:16px">
                    <label class="field" style="grid-column:span 2">Adicionar exercício da biblioteca
                        <select class="input" name="name">${libraryOptions()}</select></label>
                    <label class="field">Séries<input class="input" type="number" min="1" name="sets" value="3"></label>
                    <label class="field">Reps<input class="input" name="reps" value="12"></label>
                    <button class="btn btn-primary" type="submit">Adicionar</button>
                </form>
            </div>
            <div class="card">
                <div class="card-head"><h2>Dados da ficha</h2></div>
                <form id="ficha-form" style="display:flex;flex-direction:column;gap:12px">
                    <label class="field">Nome<input class="input" name="name" value="${esc(w.name)}" required></label>
                    <label class="field">Foco<input class="input" name="focus" value="${esc(w.focus)}"></label>
                    <div class="form-row">
                        <label class="field">Dia<select class="input" name="day">
                            ${['Livre', ...WEEKDAYS].map(d => `<option ${d === w.day ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
                        <label class="field">Duração (min)<input class="input" type="number" min="5" name="duration" value="${w.duration}"></label>
                    </div>
                    <label class="field">Observações para o aluno
                        <textarea class="input" name="notes" rows="4">${esc(w.notes || '')}</textarea></label>
                    <button class="btn btn-primary" type="submit">Salvar ficha</button>
                </form>
                <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                    <button class="btn btn-sm" id="ficha-dup">Duplicar</button>
                    <button class="btn btn-sm btn-ghost" id="ficha-del" style="color:var(--red)">Excluir ficha</button>
                </div>
            </div>
        </div>`;
    },
    bind(view, id) {
        if (!fichaStudent) return;
        const plan = planOf(fichaStudent);
        const w = plan.find(x => x.id === id) || plan[0];
        // Salva e re-renderiza (mudar o hash já dispara a navegação)
        const go = target => {
            save();
            const hash = `#/personal/fichas/${target || ''}`;
            if (location.hash !== hash) location.hash = hash; else route();
        };

        view.querySelector('#ficha-student').onchange = e => { fichaStudent = e.target.value; go(''); };
        view.querySelector('#ficha-new').onclick = () => {
            const letter = String.fromCharCode(65 + plan.length);
            const f = { id: newId('f'), name: `Treino ${letter}`, focus: 'Novo treino', day: 'Livre', duration: 60, notes: '', exercises: [] };
            plan.push(f); toast('Ficha criada!'); go(f.id);
        };
        const copy = view.querySelector('#ficha-copy');
        if (copy) copy.onchange = () => {
            if (!copy.value) return;
            state.plans[fichaStudent] = planOf(copy.value).map(f => ({ ...JSON.parse(JSON.stringify(f)), id: newId('f') }));
            toast(`Fichas copiadas de ${copy.value}`); go('');
        };
        if (!w) return;

        view.querySelectorAll('[data-row]').forEach(tr => {
            const i = Number(tr.dataset.row);
            tr.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
                w.exercises[i][inp.dataset.f] = inp.dataset.f === 'sets' ? Math.max(1, +inp.value || 1) : inp.value.trim();
                save();
            });
            tr.querySelector('[data-remove]').onclick = () => { w.exercises.splice(i, 1); go(w.id); };
            tr.querySelectorAll('[data-move]').forEach(b => b.onclick = () => {
                const j = i + Number(b.dataset.move);
                [w.exercises[i], w.exercises[j]] = [w.exercises[j], w.exercises[i]];
                go(w.id);
            });
        });

        const add = view.querySelector('#ex-add');
        add.onsubmit = e => {
            e.preventDefault();
            w.exercises.push({ name: add.name.value, sets: Math.max(1, +add.sets.value || 1), reps: add.reps.value.trim() || '12', load: '—', rest: '60s' });
            go(w.id);
        };

        const form = view.querySelector('#ficha-form');
        form.onsubmit = e => {
            e.preventDefault();
            Object.assign(w, {
                name: form.name.value.trim(), focus: form.focus.value.trim(), day: form.day.value,
                duration: Math.max(5, +form.duration.value || 60), notes: form.notes.value.trim()
            });
            toast('Ficha salva!'); go(w.id);
        };
        view.querySelector('#ficha-dup').onclick = () => {
            const copyF = { ...JSON.parse(JSON.stringify(w)), id: newId('f'), name: w.name + ' (cópia)', day: 'Livre' };
            plan.splice(plan.indexOf(w) + 1, 0, copyF);
            toast('Ficha duplicada!'); go(copyF.id);
        };
        view.querySelector('#ficha-del').onclick = () => {
            if (!confirm(`Excluir a ficha "${w.name}"?`)) return;
            plan.splice(plan.indexOf(w), 1);
            toast('Ficha excluída.'); go('');
        };
    }
};
