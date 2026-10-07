// ---------- Dietas por aluno (coach) ----------
// O coach monta o plano alimentar de cada aluno (metas, refeições, orientações)
// e acompanha o que o aluno marcou nos últimos dias (refeições feitas e água).
let dietStudent = CLIENT;
let dietDraft = null; // cópia em edição; só vai para o state ao salvar

const emptyMeal = () => ({ name: '', time: '', kcal: '', items: [] });
// Ponto de partida: o cardápio de exemplo (demonstração) ou uma estrutura vazia
const dietTemplate = () => ({ kcal: SEED.macros.kcal, protein: SEED.macros.protein, carbs: SEED.macros.carbs, fat: SEED.macros.fat,
    water: 3000, notes: '', meals: SEED.meals.map(m => ({ ...m, items: [...m.items] })) });
const cloneDiet = d => JSON.parse(JSON.stringify(d));

function dietWeek(student) {
    const d = dietOf(student);
    const total = d ? d.meals.length : 0;
    const goal = (d && d.water) || 3000;
    return Array.from({ length: 7 }, (_, i) => offsetDate(-i)).map(date => {
        const log = (state.dailyLogs[student] || {})[date];
        const meals = log ? log.meals.filter(i => i < total).length : 0;
        return { date, meals, total, water: log ? log.water : 0, goal, has: !!log };
    });
}

function dietWeekCard(student) {
    const rows = dietWeek(student);
    const any = rows.some(r => r.has);
    return `<div class="card">
        <div class="card-head"><h2>Últimos 7 dias</h2><span class="muted small">o que ${esc(student.split(' ')[0])} marcou</span></div>
        ${!any ? '<div class="empty">Nenhum registro ainda. Aparece aqui quando o aluno marca refeições ou água.</div>' : `
        <div class="table-wrap"><table>
            <thead><tr><th>Dia</th><th>Refeições</th><th>Água</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
                <td>${r.date === today ? 'Hoje' : cap(fmtDate(r.date, { weekday: 'short', day: '2-digit' }))}</td>
                <td><div class="adh ${r.total && r.meals / r.total < 0.5 ? 'low' : ''}"><div class="progress"><span style="width:${r.total ? r.meals / r.total * 100 : 0}%"></span></div>${r.meals}/${r.total}</div></td>
                <td>${liters(r.water)} L <span class="muted small">/ ${liters(r.goal)}</span></td>
            </tr>`).join('')}</tbody>
        </table></div>`}
    </div>`;
}

function mealEditor(m, i, n) {
    return `<div class="meal-edit" data-i="${i}">
        <div class="meal-edit-head">
            <input class="input" data-f="name" value="${esc(m.name)}" placeholder="Nome (ex.: Almoço)" aria-label="Nome da refeição" required>
            <input class="input" data-f="time" type="time" value="${esc(m.time || '')}" aria-label="Horário">
            <input class="input" data-f="kcal" type="number" min="0" step="1" value="${m.kcal ?? ''}" placeholder="kcal" aria-label="Calorias">
            <div class="meal-edit-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-move="-1" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn btn-ghost btn-sm" data-move="1" title="Descer" ${i === n - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="btn btn-ghost btn-sm" data-remove title="Remover refeição">✕</button>
            </div>
        </div>
        <textarea class="input" data-f="items" rows="${Math.max(3, (m.items || []).length + 1)}" placeholder="Um alimento por linha (ex.: 150 g de frango grelhado)" aria-label="Alimentos">${esc((m.items || []).join('\n'))}</textarea>
    </div>`;
}

trainerPages.dietas = {
    title: () => 'Dietas',
    sub: () => 'Monte o plano alimentar de cada aluno e acompanhe o dia a dia',
    render() {
        if (!SEED.students.some(s => s.name === dietStudent)) dietStudent = (SEED.students[0] || {}).name || '';
        if (!dietStudent) return '<div class="card empty">Nenhum aluno cadastrado ainda.</div>';
        const saved = dietOf(dietStudent);
        if (!dietDraft || dietDraft.student !== dietStudent) dietDraft = saved ? { student: dietStudent, ...cloneDiet(saved) } : null;
        const others = SEED.students.filter(s => s.name !== dietStudent && dietOf(s.name));
        const toolbar = `
        <div class="card" style="margin-bottom:18px">
            <div class="form-row" style="align-items:end">
                <label class="field">Aluno
                    <select class="input" id="diet-student">${SEED.students.map(s =>
                        `<option ${s.name === dietStudent ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
                ${others.length ? `<label class="field">Copiar de outro aluno
                    <select class="input" id="diet-copy"><option value="">Escolha…</option>${others.map(s => `<option>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
            </div>
            ${!Backend.enabled && dietStudent === CLIENT ? '<p class="muted small" style="margin-top:10px">💡 A dieta do Lucas aparece na área do aluno desta demonstração.</p>' : ''}
        </div>`;
        if (!dietDraft) return toolbar + `
            <div class="grid grid-main">
                <div class="card empty">Este aluno ainda não tem plano alimentar.
                    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">
                        <button class="btn btn-primary" id="diet-template">Começar do modelo</button>
                        <button class="btn" id="diet-blank">Começar em branco</button>
                    </div></div>
                ${dietWeekCard(dietStudent)}
            </div>`;
        const d = dietDraft;
        const kcalSum = d.meals.reduce((t, m) => t + (+m.kcal || 0), 0);
        return toolbar + `
        <form id="diet-form">
        <div class="grid grid-main">
            <div class="card">
                <div class="card-head"><h2>Refeições</h2><span class="badge">${d.meals.length}</span></div>
                <div id="meal-list">${d.meals.map((m, i) => mealEditor(m, i, d.meals.length)).join('') || '<div class="empty">Nenhuma refeição ainda.</div>'}</div>
                <button type="button" class="btn" id="meal-add" style="margin-top:12px">+ Adicionar refeição</button>
                <label class="field" style="margin-top:18px">Orientações para o aluno (opcional)
                    <textarea class="input" name="notes" rows="3" placeholder="Ex.: beba água ao longo do dia; pode trocar o arroz por batata.">${esc(d.notes || '')}</textarea></label>
            </div>
            <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
                <div class="card">
                    <div class="card-head"><h2>Metas do dia</h2></div>
                    <div class="form-row">
                        <label class="field">Calorias (kcal)<input class="input" type="number" min="0" name="kcal" value="${d.kcal ?? ''}"></label>
                        <label class="field">Proteínas (g)<input class="input" type="number" min="0" name="protein" value="${d.protein ?? ''}"></label>
                        <label class="field">Carboidratos (g)<input class="input" type="number" min="0" name="carbs" value="${d.carbs ?? ''}"></label>
                        <label class="field">Gorduras (g)<input class="input" type="number" min="0" name="fat" value="${d.fat ?? ''}"></label>
                        <label class="field">Água (L)<input class="input" type="number" min="0" max="10" step="0.25" name="water" value="${num((d.water || 3000) / 1000, 2).replace(',', '.')}"></label>
                    </div>
                    <p class="muted small" id="kcal-sum" style="margin-top:8px">Soma das refeições: <b>${kcalSum} kcal</b>${d.kcal && Math.abs(kcalSum - d.kcal) > 50 ? ` <span class="down">(meta: ${d.kcal})</span>` : ''}</p>
                    <button class="btn btn-primary btn-block" type="submit" style="margin-top:14px">Salvar dieta</button>
                    ${saved ? '<button class="btn btn-ghost btn-block" type="button" id="diet-delete">Remover plano deste aluno</button>' : ''}
                </div>
                ${dietWeekCard(dietStudent)}
            </div>
        </div>
        </form>`;
    },
    bind(view) {
        const sel = view.querySelector('#diet-student');
        if (sel) sel.onchange = () => { dietStudent = sel.value; dietDraft = null; route(); };
        const copy = view.querySelector('#diet-copy');
        if (copy) copy.onchange = () => {
            if (!copy.value) return;
            if (dietDraft && !confirm(`Substituir o plano atual pelo de ${copy.value}? (só vale depois de salvar)`)) { copy.value = ''; return; }
            dietDraft = { student: dietStudent, ...cloneDiet(dietOf(copy.value)) };
            toast('Plano copiado. Revise e clique em Salvar.'); route();
        };
        const start = d => { dietDraft = { student: dietStudent, ...d }; route(); };
        const tpl = view.querySelector('#diet-template'), blank = view.querySelector('#diet-blank');
        if (tpl) tpl.onclick = () => start(dietTemplate());
        if (blank) blank.onclick = () => start({ kcal: '', protein: '', carbs: '', fat: '', water: 3000, notes: '', meals: [emptyMeal()] });
        const form = view.querySelector('#diet-form');
        if (!form) return;

        // Copia o que está digitado para o rascunho (antes de redesenhar)
        const readForm = () => {
            const n = v => v === '' ? '' : Math.max(0, Math.round(+v));
            Object.assign(dietDraft, { kcal: n(form.kcal.value), protein: n(form.protein.value), carbs: n(form.carbs.value),
                fat: n(form.fat.value), water: Math.round((+form.water.value || 3) * 1000), notes: form.notes.value.trim() });
            dietDraft.meals = [...form.querySelectorAll('.meal-edit')].map(el => {
                const f = k => el.querySelector(`[data-f="${k}"]`).value;
                return { name: f('name').trim(), time: f('time'), kcal: f('kcal') === '' ? '' : Math.max(0, Math.round(+f('kcal'))),
                    items: f('items').split('\n').map(x => x.trim()).filter(Boolean) };
            });
        };
        view.querySelector('#meal-add').onclick = () => { readForm(); dietDraft.meals.push(emptyMeal()); route();
            const last = [...$('#view').querySelectorAll('.meal-edit [data-f="name"]')].pop(); if (last) last.focus(); };
        form.querySelectorAll('.meal-edit').forEach(el => {
            const i = +el.dataset.i;
            el.querySelectorAll('[data-move]').forEach(b => b.onclick = () => {
                readForm(); const j = i + +b.dataset.move; const m = dietDraft.meals;
                [m[i], m[j]] = [m[j], m[i]]; route();
            });
            el.querySelector('[data-remove]').onclick = () => { readForm(); dietDraft.meals.splice(i, 1); route(); };
            el.querySelector('[data-f="kcal"]').oninput = () => {
                const sum = [...form.querySelectorAll('[data-f="kcal"]')].reduce((t, x) => t + (+x.value || 0), 0);
                view.querySelector('#kcal-sum b').textContent = sum + ' kcal';
            };
        });
        form.onsubmit = e => {
            e.preventDefault();
            readForm();
            if (dietDraft.meals.some(m => !m.name)) return toast('Dê um nome para cada refeição.');
            const { student, ...diet } = dietDraft;
            const prev = state.diets[student];
            state.diets[student] = cloneDiet(diet);
            if (!save()) { state.diets[student] = prev; return; }
            toast('Dieta salva! O aluno já vê o plano novo.');
            dietDraft = null; route();
        };
        const del = view.querySelector('#diet-delete');
        if (del) del.onclick = () => {
            if (!confirm(`Remover o plano alimentar de ${dietStudent}?`)) return;
            delete state.diets[dietStudent]; save(); dietDraft = null; toast('Plano removido.'); route();
        };
    }
};
