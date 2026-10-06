// ---------- Biblioteca de exercícios (aluno e personal) ----------
const LIB_GROUPS = [...new Set(SEED.library.map(e => e.group))];
let libFilter = { q: '', group: '' };

// Converte um link de vídeo em algo que dá para embutir na página
function videoEmbed(url) {
    if (!url) return null;
    let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
    if (m) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` };
    if (/^https:\/\/\S+\.(mp4|webm)(\?\S*)?$/i.test(url)) return { type: 'video', src: url };
    return null;
}

function videoHtml(ex) {
    const v = videoEmbed(state.videos[ex.id]);
    if (!v) {
        return `<div class="video-frame video-empty">
            <div>🎬</div>
            <p>${user.role === 'personal' ? 'Adicione abaixo o link do vídeo de execução.' : 'Seu personal ainda não adicionou o vídeo deste exercício.'}</p>
            <a class="btn btn-sm" target="_blank" rel="noopener"
               href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' execução correta')}">Buscar no YouTube ↗</a>
        </div>`;
    }
    return v.type === 'iframe'
        ? `<div class="video-frame"><iframe src="${esc(v.src)}" title="${esc(ex.name)}" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
        : `<div class="video-frame"><video src="${esc(v.src)}" controls preload="metadata"></video></div>`;
}

function libraryList() {
    const q = libFilter.q.toLowerCase();
    const list = SEED.library.filter(e =>
        (!libFilter.group || e.group === libFilter.group) &&
        (e.name.toLowerCase().includes(q) || e.muscles.toLowerCase().includes(q)));
    if (!list.length) return '<div class="empty">Nenhum exercício encontrado.</div>';
    return `<div class="lib-grid">${list.map(e => `
        <a class="lib-card" href="#/${user.role}/biblioteca/${e.id}">
            <div class="lib-thumb">${state.videos[e.id] ? '▶' : '🏋️'}</div>
            <div class="lib-body">
                <b>${esc(e.name)}</b>
                <div class="muted small">${esc(e.muscles)}</div>
                <div class="ex-meta"><span class="badge accent">${e.group}</span><span class="badge">${e.equipment}</span>
                    ${state.videos[e.id] ? '<span class="badge blue">vídeo</span>' : ''}</div>
            </div>
        </a>`).join('')}</div>`;
}

const bibliotecaPage = {
    title: () => 'Biblioteca de exercícios',
    sub: () => `${SEED.library.length} exercícios com execução e dicas`,
    render(id) {
        const ex = SEED.library.find(e => e.id === id);
        if (ex) {
            const levelColor = { Iniciante: 'green', Intermediário: 'orange', Avançado: 'red' }[ex.level];
            return `
            <a class="btn btn-sm btn-ghost" href="#/${user.role}/biblioteca" style="margin-bottom:14px">← Voltar à biblioteca</a>
            <div class="grid grid-main">
                <div class="card">
                    ${videoHtml(ex)}
                    ${user.role === 'personal' ? `
                    <form id="video-form" class="form-row" style="margin-top:16px">
                        <label class="field" style="grid-column:1/-1">Link do vídeo (YouTube, Vimeo ou arquivo .mp4)
                            <input class="input" name="url" value="${esc(state.videos[ex.id] || '')}" placeholder="https://youtu.be/...">
                        </label>
                        <button class="btn btn-primary" type="submit">Salvar vídeo</button>
                        ${state.videos[ex.id] ? '<button class="btn btn-ghost" type="button" id="video-remove">Remover</button>' : ''}
                    </form>` : ''}
                </div>
                <div class="card">
                    <div class="card-head"><h2>${esc(ex.name)}</h2><span class="badge ${levelColor}">${ex.level}</span></div>
                    <div class="list">
                        <div class="list-item"><div class="grow muted">Grupo</div><b>${ex.group}</b></div>
                        <div class="list-item"><div class="grow muted">Equipamento</div><b>${ex.equipment}</b></div>
                        <div class="list-item"><div class="grow muted">Músculos</div><b style="text-align:right">${esc(ex.muscles)}</b></div>
                    </div>
                    <div class="card-head" style="margin-top:18px"><h3>Dicas de execução</h3></div>
                    <ul class="tips">${ex.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
                </div>
            </div>`;
        }
        return `
        <div class="card">
            <div class="card-head" style="flex-wrap:wrap">
                <input class="input" id="lib-search" placeholder="Buscar por nome ou músculo..." value="${esc(libFilter.q)}" style="max-width:340px">
            </div>
            <div class="tabs">
                <button class="tab ${!libFilter.group ? 'active' : ''}" data-group="">Todos</button>
                ${LIB_GROUPS.map(g => `<button class="tab ${libFilter.group === g ? 'active' : ''}" data-group="${g}">${g}</button>`).join('')}
            </div>
            <div id="lib-list">${libraryList()}</div>
        </div>`;
    },
    bind(view, id) {
        const search = view.querySelector('#lib-search');
        if (search) {
            search.oninput = () => { libFilter.q = search.value; view.querySelector('#lib-list').innerHTML = libraryList(); };
            view.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { libFilter.group = b.dataset.group; route(); });
        }
        const form = view.querySelector('#video-form');
        if (form) {
            form.onsubmit = e => {
                e.preventDefault();
                const url = form.url.value.trim();
                if (!videoEmbed(url)) return toast('Link inválido. Use YouTube, Vimeo ou um arquivo .mp4/.webm (https).');
                state.videos[id] = url;
                save(); toast('Vídeo salvo!'); route();
            };
            const rm = view.querySelector('#video-remove');
            if (rm) rm.onclick = () => { delete state.videos[id]; save(); route(); };
        }
    }
};

clientPages.biblioteca = bibliotecaPage;
trainerPages.biblioteca = bibliotecaPage;
