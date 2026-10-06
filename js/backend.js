// ---------- Backend (Supabase) ----------
// Quando SITE.supabaseUrl e SITE.supabaseAnonKey estão preenchidos em js/config.js,
// o site usa login de verdade e guarda os dados no Supabase. Sem eles, continua no
// modo demonstração (dados de exemplo salvos só no navegador).
//
// Como funciona a sincronização: as telas continuam alterando o objeto `state`.
// Ao salvar, `Backend.queueSync()` compara cada coleção com o que já está no banco
// e envia só o que mudou (inclusões, alterações e exclusões).
const Backend = (() => {
    const enabled = Boolean(SITE.supabaseUrl && SITE.supabaseAnonKey);
    const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    const PHOTO_BUCKET = 'assessment-photos';
    const api = { enabled, client: null, profile: null, people: [] };
    let sb = null;

    function loadLibrary() {
        if (window.supabase) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = LIB;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Não foi possível carregar o Supabase. Verifique a conexão.'));
            document.head.append(s);
        });
    }

    async function connect() {
        if (sb) return sb;
        await loadLibrary();
        sb = api.client = window.supabase.createClient(SITE.supabaseUrl, SITE.supabaseAnonKey);
        return sb;
    }

    // Erros do Supabase viram exceções com mensagem em português quando possível
    function check({ data, error }) {
        if (!error) return data;
        const msg = {
            'Invalid login credentials': 'E-mail ou senha incorretos.',
            'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
            'User already registered': 'Já existe uma conta com esse e-mail.'
        }[error.message] || error.message;
        throw new Error(msg);
    }

    // ---------- Autenticação ----------
    api.signIn = async (email, password) => {
        await connect();
        check(await sb.auth.signInWithPassword({ email, password }));
        return api.loadProfile();
    };

    // Devolve true se o Supabase exigir confirmação por e-mail antes do primeiro login
    api.signUp = async (fullName, email, password) => {
        await connect();
        const data = check(await sb.auth.signUp({
            email, password,
            options: { data: { full_name: fullName }, emailRedirectTo: location.href.replace(/[^/]*$/, 'index.html') }
        }));
        return !data.session;
    };

    api.resetPassword = async email => {
        await connect();
        check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.replace(/[^/]*$/, 'index.html') }));
    };

    // Depois de clicar no link do e-mail (convite ou "esqueci a senha"), o Supabase
    // volta para index.html com o login no endereço. Devolve o tipo do link.
    api.hasAuthRedirect = () => /access_token=|[?&]code=|type=(recovery|magiclink|invite|signup)/.test(location.href);
    api.handleRedirect = async () => {
        const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
        const type = params.get('type') || 'magiclink';
        if (params.get('error_description')) throw new Error(params.get('error_description').replace(/\+/g, ' '));
        await connect();
        const { data: { session } } = await sb.auth.getSession();
        if (!session) throw new Error('O link expirou ou já foi usado. Peça um novo.');
        history.replaceState(null, '', location.pathname);
        await api.loadProfile();
        return type;
    };

    api.updatePassword = async password => {
        await connect();
        check(await sb.auth.updateUser({ password }));
    };

    // Coach cadastra um aluno: guarda o convite e envia o link de acesso por e-mail.
    // Devolve null se o e-mail saiu, ou a mensagem de erro do envio (o convite fica salvo).
    api.inviteStudent = async ({ name, email, plan, goal }) => {
        email = email.trim().toLowerCase();
        if (api.people.some(p => (p.email || '').toLowerCase() === email)) throw new Error('Já existe uma conta com esse e-mail.');
        check(await sb.from('student_invites').upsert({ email, full_name: name, plan, goal, invited_by: api.profile.id }));
        const { error } = await sb.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true, data: { full_name: name }, emailRedirectTo: location.href.replace(/[^/]*$/, 'index.html') }
        });
        await api.refreshStudents();
        return error ? error.message : null;
    };

    api.signOut = async () => {
        await connect();
        await sb.auth.signOut();
    };

    api.loadProfile = async () => {
        const { data: { user: authUser } } = await sb.auth.getUser();
        if (!authUser) return null;
        api.profile = check(await sb.from('profiles').select('*').eq('id', authUser.id).single());
        return api.profile;
    };

    // Usuário para o restante do site no formato que o app já usa
    api.siteUser = p => ({ name: p.full_name || p.email, email: p.email, role: p.role === 'coach' ? 'personal' : 'cliente' });

    // ---------- Carregar dados ----------
    const nameOf = id => (api.people.find(p => p.id === id) || {}).full_name || 'Aluno';
    const idOf = name => (api.people.find(p => p.full_name === name) || {}).id;
    const isCoach = () => api.profile && api.profile.role === 'coach';
    const num = v => v === null || v === undefined ? null : Number(v);

    // Abre a área logada: devolve false se não houver login (quem chama redireciona)
    api.boot = async () => {
        await connect();
        if (!(await api.loadProfile())) return false;
        const me = api.profile;
        api.people = check(await sb.from('profiles').select('*').order('full_name'));
        const students = api.people.filter(p => p.role === 'aluno');

        const since = offsetDate(-60);
        const [plans, logs, days, progress, assessments, sessions, invoices, videos] = await Promise.all([
            sb.from('workout_plans').select('*').order('position'),
            sb.from('workout_logs').select('*').gte('date', since),
            sb.from('workout_days').select('*').gte('date', since),
            sb.from('progress_entries').select('*').order('date'),
            sb.from('assessments').select('*').order('date'),
            sb.from('sessions').select('*'),
            sb.from('invoices').select('*'),
            sb.from('exercise_videos').select('*')
        ].map(p => p.then(check)));

        // Quem está logado vira o "aluno" da área do aluno
        if (!isCoach()) CLIENT = me.full_name || me.email;
        else CLIENT = (students[0] || {}).full_name || '';

        state.plans = {};
        plans.forEach(r => {
            (state.plans[nameOf(r.student_id)] ||= []).push({
                id: r.id, name: r.name, focus: r.focus, day: r.day, duration: r.duration, notes: r.notes, exercises: r.exercises
            });
        });
        state.doneExercises = {};
        logs.filter(r => r.student_id === me.id).forEach(r => { state.doneExercises[`${r.plan_id}|${r.date}`] = r.done; });
        state.workoutDays = days.filter(r => r.student_id === me.id).map(r => r.date);
        state.progress = progress.filter(r => r.student_id === me.id)
            .map(r => ({ date: r.date, weight: num(r.weight), fat: num(r.fat), waist: num(r.waist) }));
        state.sessions = sessions.map(r => ({
            id: r.id, student: nameOf(r.student_id), date: r.date, time: r.time.slice(0, 5), duration: r.duration,
            type: r.type, title: r.title, place: r.place, notes: r.notes, status: r.status
        }));
        state.invoices = invoices.map(r => ({
            id: r.id, student: nameOf(r.student_id), plan: r.plan, amount: num(r.amount), due: r.due, paidAt: r.paid_at, method: r.method
        }));
        state.videos = Object.fromEntries(videos.map(r => [r.exercise_id, r.url]));
        state.profile = { height: num(me.height_cm) || '', age: me.age || '', phone: me.phone || '', targetWeight: num(me.target_weight) };
        state.messages = [];

        // Fotos: o banco guarda o caminho no Storage; para exibir, gera links temporários
        state.assessments = {};
        const paths = assessments.flatMap(r => Object.values(r.photos || {}));
        const signed = {};
        if (paths.length) {
            const res = check(await sb.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60 * 6));
            res.forEach(x => { if (x.signedUrl) signed[x.path] = x.signedUrl; });
        }
        assessments.forEach(r => {
            const photoPaths = r.photos || {};
            (state.assessments[nameOf(r.student_id)] ||= []).push({
                id: r.id, date: r.date, weight: num(r.weight), fat: num(r.fat), chest: num(r.chest), waist: num(r.waist),
                hip: num(r.hip), arm: num(r.arm), thigh: num(r.thigh), notes: r.notes,
                photoPaths: { ...photoPaths },
                photos: Object.fromEntries(Object.entries(photoPaths).map(([k, path]) => [k, signed[path]]).filter(([, u]) => u))
            });
        });

        api.days = days;
        await api.refreshStudents();

        // O aluno não pode ler a agenda dos outros; para não marcar horário em cima
        // de outra pessoa, busca só os horários ocupados (sem nomes)
        state.busySlots = isCoach() ? [] : check(await sb.rpc('busy_slots', { from_date: today, to_date: offsetDate(120) }))
            .map(r => ({ id: r.id, date: r.date, time: r.time.slice(0, 5), duration: r.duration }));

        snapshotAll();
        return true;
    };

    // Lista de alunos do coach, com números calculados a partir dos dados reais.
    // Convites ainda sem conta aparecem como "Convidado".
    api.refreshStudents = async () => {
        if (isCoach()) api.people = check(await sb.from('profiles').select('*').order('full_name'));
        const students = api.people.filter(p => p.role === 'aluno');
        const days = api.days || [];
        const invites = isCoach() ? check(await sb.from('student_invites').select('*').is('accepted_at', null)) : [];
        SEED.students = students.map(p => {
            const myDays = days.filter(d => d.student_id === p.id).map(d => d.date).sort();
            const last28 = myDays.filter(d => d >= offsetDate(-28)).length;
            const open = state.invoices.filter(i => i.student === p.full_name && !i.paidAt).sort((a, b) => a.due.localeCompare(b.due));
            const lastDay = myDays.at(-1);
            return {
                name: p.full_name || p.email, plan: p.plan, goal: p.goal, status: p.status,
                adherence: Math.min(100, Math.round(last28 / 20 * 100)), // meta: 5 treinos por semana
                lastWorkout: !lastDay ? '—' : lastDay === today ? 'Hoje' : lastDay === offsetDate(-1) ? 'Ontem' : fmtDate(lastDay),
                due: open[0] ? fmtDate(open[0].due, { day: '2-digit', month: '2-digit' }) : '—'
            };
        });
        // Ficam fora de SEED.students: sem conta ainda, não há onde salvar fichas ou agenda
        SEED.invites = invites.map(i => ({
            name: i.full_name, email: i.email, plan: i.plan, goal: i.goal, status: 'Convidado', adherence: 0, lastWorkout: '—', due: '—'
        }));
    };

    // ---------- Sincronização ----------
    // Cada coleção sabe transformar o `state` em linhas do banco
    const COLLECTIONS = {
        workout_plans: {
            pk: ['id'], canWrite: isCoach,
            rows: () => Object.entries(state.plans).flatMap(([name, plans]) => plans.map((w, i) => ({
                id: w.id, student_id: idOf(name), name: w.name, focus: w.focus || '', day: w.day || 'Livre',
                duration: w.duration || 60, notes: w.notes || '', exercises: w.exercises || [], position: i
            })))
        },
        workout_logs: {
            pk: ['student_id', 'plan_id', 'date'], canWrite: () => !isCoach(),
            rows: () => Object.entries(state.doneExercises).map(([k, done]) => {
                const [plan_id, date] = k.split('|');
                return { student_id: api.profile.id, plan_id, date, done };
            })
        },
        workout_days: {
            pk: ['student_id', 'date'], canWrite: () => !isCoach(),
            rows: () => state.workoutDays.map(date => ({ student_id: api.profile.id, date }))
        },
        progress_entries: {
            pk: ['student_id', 'date'], canWrite: () => !isCoach(),
            rows: () => state.progress.map(p => ({ student_id: api.profile.id, date: p.date, weight: p.weight, fat: p.fat, waist: p.waist }))
        },
        assessments: {
            pk: ['id'], canWrite: () => true,
            rows: () => Object.entries(state.assessments).flatMap(([name, list]) => list.map(a => ({
                id: a.id, student_id: idOf(name), date: a.date, weight: a.weight, fat: a.fat, chest: a.chest, waist: a.waist,
                hip: a.hip, arm: a.arm, thigh: a.thigh, notes: a.notes || '', photos: a.photoPaths || {}
            })))
        },
        sessions: {
            pk: ['id'], canWrite: () => true,
            rows: () => state.sessions.filter(s => isCoach() || s.student === CLIENT).map(s => ({
                id: s.id, student_id: idOf(s.student), date: s.date, time: s.time, duration: s.duration || 60,
                type: s.type, title: s.title, place: s.place || '', notes: s.notes || '', status: s.status
            }))
        },
        invoices: {
            pk: ['id'], canWrite: isCoach,
            rows: () => state.invoices.map(i => ({
                id: i.id, student_id: idOf(i.student), plan: i.plan, amount: i.amount, due: i.due, paid_at: i.paidAt || null, method: i.method || null
            }))
        },
        exercise_videos: {
            pk: ['exercise_id'], canWrite: isCoach,
            rows: () => Object.entries(state.videos).map(([exercise_id, url]) => ({ exercise_id, url }))
        }
    };

    const snapshots = {}; // coleção → Map(chave → JSON da linha)
    let profileSnapshot = '';
    const keyOf = (pk, row) => pk.map(k => row[k]).join('|');

    function profileRow() {
        const p = state.profile || {};
        const n = v => v === '' || v === null || v === undefined || isNaN(+v) ? null : +v;
        return { phone: p.phone || null, height_cm: n(p.height), age: n(p.age), target_weight: n(p.targetWeight) };
    }

    function snapshotAll() {
        for (const [name, c] of Object.entries(COLLECTIONS)) {
            snapshots[name] = new Map(c.rows().filter(r => Object.values(r).every(v => v !== undefined))
                .map(r => [keyOf(c.pk, r), JSON.stringify(r)]));
        }
        profileSnapshot = JSON.stringify(profileRow());
    }

    // Envia para o Storage as fotos novas (ainda em data:) e guarda o caminho
    async function uploadPhotos() {
        for (const [name, list] of Object.entries(state.assessments)) {
            const studentId = idOf(name);
            for (const a of list) {
                a.photoPaths ||= {};
                for (const [pose, src] of Object.entries(a.photos || {})) {
                    if (!String(src).startsWith('data:') || a.photoPaths[pose]) continue;
                    const path = `${studentId}/${a.id}-${pose}.jpg`;
                    const blob = await (await fetch(src)).blob();
                    check(await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true }));
                    a.photoPaths[pose] = path;
                }
            }
        }
    }

    async function syncCollection(name) {
        const c = COLLECTIONS[name];
        if (!c.canWrite()) return;
        const prev = snapshots[name] || new Map();
        // Linha sem aluno correspondente (undefined) não é enviada
        const rows = c.rows().filter(r => Object.values(r).every(v => v !== undefined));
        const next = new Map(rows.map(r => [keyOf(c.pk, r), JSON.stringify(r)]));
        const changed = rows.filter(r => prev.get(keyOf(c.pk, r)) !== next.get(keyOf(c.pk, r)));
        const removed = [...prev.keys()].filter(k => !next.has(k));

        if (changed.length) check(await sb.from(name).upsert(changed, { onConflict: c.pk.join(',') }));
        for (const k of removed) {
            const row = JSON.parse(prev.get(k));
            if (name === 'assessments') {
                const paths = Object.values(row.photos || {});
                if (paths.length) await sb.storage.from(PHOTO_BUCKET).remove(paths);
            }
            check(await sb.from(name).delete().match(Object.fromEntries(c.pk.map(p => [p, row[p]]))));
        }
        snapshots[name] = next;
    }

    async function syncAll() {
        await uploadPhotos();
        for (const name of Object.keys(COLLECTIONS)) await syncCollection(name);
        const pr = JSON.stringify(profileRow());
        if (pr !== profileSnapshot) {
            check(await sb.from('profiles').update(profileRow()).eq('id', api.profile.id));
            profileSnapshot = pr;
        }
    }

    // Junta salvamentos seguidos e envia um de cada vez, na ordem
    let queue = Promise.resolve();
    let timer = null;
    api.queueSync = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            queue = queue.then(syncAll).catch(err => {
                console.error(err);
                toast('Não foi possível salvar: ' + err.message);
            });
        }, 300);
    };
    // Espera o envio pendente terminar (usado antes de sair da página)
    api.flush = async () => { clearTimeout(timer); queue = queue.then(syncAll); return queue; };

    return api;
})();
