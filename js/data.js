// Dados de exemplo da plataforma. Em produção viriam de uma API/banco de dados.
const SEED = {
    trainer: { name: SITE.coach, cref: '' }, // preencha o CREF quando tiver

    workouts: [
        {
            id: 'A', name: 'Treino A', focus: 'Peito e Tríceps', day: 'Segunda', duration: 60,
            exercises: [
                { name: 'Supino reto com barra', sets: 4, reps: '10', load: '60 kg', rest: '90s' },
                { name: 'Supino inclinado com halteres', sets: 3, reps: '12', load: '22 kg', rest: '75s' },
                { name: 'Crucifixo na polia', sets: 3, reps: '15', load: '15 kg', rest: '60s' },
                { name: 'Mergulho nas paralelas', sets: 3, reps: '10', load: 'Peso corporal', rest: '75s' },
                { name: 'Tríceps corda', sets: 4, reps: '12', load: '25 kg', rest: '60s' },
                { name: 'Tríceps francês', sets: 3, reps: '12', load: '14 kg', rest: '60s' }
            ]
        },
        {
            id: 'B', name: 'Treino B', focus: 'Costas e Bíceps', day: 'Terça', duration: 60,
            exercises: [
                { name: 'Puxada frontal', sets: 4, reps: '10', load: '55 kg', rest: '90s' },
                { name: 'Remada curvada', sets: 4, reps: '10', load: '50 kg', rest: '90s' },
                { name: 'Remada unilateral', sets: 3, reps: '12', load: '24 kg', rest: '60s' },
                { name: 'Pulldown na polia', sets: 3, reps: '15', load: '30 kg', rest: '60s' },
                { name: 'Rosca direta', sets: 4, reps: '10', load: '30 kg', rest: '60s' },
                { name: 'Rosca martelo', sets: 3, reps: '12', load: '14 kg', rest: '60s' }
            ]
        },
        {
            id: 'C', name: 'Treino C', focus: 'Pernas', day: 'Quarta', duration: 70,
            exercises: [
                { name: 'Agachamento livre', sets: 4, reps: '8', load: '80 kg', rest: '120s' },
                { name: 'Leg press 45°', sets: 4, reps: '12', load: '200 kg', rest: '90s' },
                { name: 'Cadeira extensora', sets: 3, reps: '15', load: '45 kg', rest: '60s' },
                { name: 'Mesa flexora', sets: 3, reps: '12', load: '40 kg', rest: '60s' },
                { name: 'Stiff', sets: 3, reps: '10', load: '50 kg', rest: '90s' },
                { name: 'Panturrilha em pé', sets: 4, reps: '20', load: '60 kg', rest: '45s' }
            ]
        },
        {
            id: 'D', name: 'Treino D', focus: 'Ombros e Abdômen', day: 'Quinta', duration: 50,
            exercises: [
                { name: 'Desenvolvimento com halteres', sets: 4, reps: '10', load: '18 kg', rest: '90s' },
                { name: 'Elevação lateral', sets: 4, reps: '15', load: '8 kg', rest: '60s' },
                { name: 'Elevação frontal', sets: 3, reps: '12', load: '8 kg', rest: '60s' },
                { name: 'Crucifixo invertido', sets: 3, reps: '15', load: '6 kg', rest: '60s' },
                { name: 'Prancha', sets: 3, reps: '45s', load: '—', rest: '45s' },
                { name: 'Abdominal infra', sets: 3, reps: '15', load: '—', rest: '45s' }
            ]
        },
        {
            id: 'E', name: 'Treino E', focus: 'Cardio + Funcional', day: 'Sexta', duration: 45,
            exercises: [
                { name: 'Esteira (intervalado)', sets: 1, reps: '20 min', load: '—', rest: '—' },
                { name: 'Burpee', sets: 4, reps: '12', load: '—', rest: '45s' },
                { name: 'Kettlebell swing', sets: 4, reps: '15', load: '16 kg', rest: '45s' },
                { name: 'Corda naval', sets: 4, reps: '30s', load: '—', rest: '30s' }
            ]
        }
    ],

    meals: [
        { time: '07:00', name: 'Café da manhã', kcal: 480, items: ['3 ovos mexidos', '2 fatias de pão integral', '1 banana', 'Café sem açúcar'] },
        { time: '10:00', name: 'Lanche da manhã', kcal: 220, items: ['Iogurte natural', '30 g de granola', 'Morangos'] },
        { time: '13:00', name: 'Almoço', kcal: 650, items: ['150 g de frango grelhado', '150 g de arroz integral', 'Feijão', 'Salada à vontade'] },
        { time: '16:30', name: 'Pré-treino', kcal: 300, items: ['Batata-doce 150 g', 'Whey protein (1 dose)'] },
        { time: '20:00', name: 'Jantar', kcal: 520, items: ['Filé de tilápia 150 g', 'Legumes no vapor', 'Azeite (1 colher)'] },
        { time: '22:30', name: 'Ceia', kcal: 180, items: ['Queijo cottage', 'Castanhas (5 un.)'] }
    ],
    macros: { kcal: 2350, protein: 180, carbs: 240, fat: 70 },

    progress: [
        { date: '2026-07-06', weight: 88.4, fat: 24.1, waist: 96 },
        { date: '2026-07-20', weight: 87.6, fat: 23.6, waist: 95 },
        { date: '2026-08-03', weight: 86.5, fat: 22.8, waist: 94 },
        { date: '2026-08-17', weight: 85.9, fat: 22.1, waist: 93 },
        { date: '2026-08-31', weight: 84.7, fat: 21.4, waist: 91.5 },
        { date: '2026-09-14', weight: 84.0, fat: 20.9, waist: 90.5 },
        { date: '2026-09-28', weight: 83.2, fat: 20.2, waist: 89.5 }
    ],
    goal: { weight: 78, label: 'Hipertrofia + perda de gordura' },

    // Sessões da agenda. status: confirmada | pendente | cancelada
    sessions: [
        { id: 's1', student: 'Lucas Andrade', date: offsetDate(0), time: '18:00', duration: 60, title: 'Treino presencial', type: 'Presencial', place: 'Academia Smart Fit — Centro', status: 'confirmada', notes: '' },
        { id: 's2', student: 'Lucas Andrade', date: offsetDate(2), time: '07:30', duration: 45, title: 'Aula online — Funcional', type: 'Online', place: 'Google Meet', status: 'confirmada', notes: '' },
        { id: 's3', student: 'Lucas Andrade', date: offsetDate(5), time: '09:00', duration: 60, title: 'Avaliação física', type: 'Avaliação', place: 'Online — Google Meet', status: 'confirmada', notes: 'Tirar fotos de frente, lado e costas.' },
        { id: 's4', student: 'Lucas Andrade', date: offsetDate(9), time: '18:00', duration: 60, title: 'Treino presencial', type: 'Presencial', place: 'Academia Smart Fit — Centro', status: 'confirmada', notes: '' },
        { id: 's5', student: 'Mariana Souza', date: offsetDate(1), time: '19:00', duration: 60, title: 'Treino presencial', type: 'Presencial', place: 'Academia Smart Fit — Centro', status: 'confirmada', notes: '' },
        { id: 's6', student: 'Rafael Lima', date: offsetDate(2), time: '12:00', duration: 45, title: 'Call de ajuste de treino', type: 'Online', place: 'Google Meet', status: 'confirmada', notes: '' },
        { id: 's7', student: 'Beatriz Rocha', date: offsetDate(3), time: '08:00', duration: 60, title: 'Avaliação física inicial', type: 'Avaliação', place: 'Online — Google Meet', status: 'pendente', notes: 'Primeira avaliação.' },
        { id: 's8', student: 'Pedro Martins', date: offsetDate(6), time: '17:00', duration: 60, title: 'Treino presencial', type: 'Presencial', place: 'Academia Smart Fit — Centro', status: 'confirmada', notes: '' }
    ],


    // Usado no painel do personal
    students: [
        { name: 'Lucas Andrade', plan: 'Performance', goal: 'Hipertrofia', adherence: 86, lastWorkout: 'Hoje', status: 'Ativo', due: '10/10' },
        { name: 'Mariana Souza', plan: 'Premium', goal: 'Emagrecimento', adherence: 94, lastWorkout: 'Ontem', status: 'Ativo', due: '15/10' },
        { name: 'Rafael Lima', plan: 'Premium', goal: 'Condicionamento', adherence: 72, lastWorkout: 'Há 2 dias', status: 'Ativo', due: '12/10' },
        { name: 'Juliana Costa', plan: 'Essencial', goal: 'Emagrecimento', adherence: 41, lastWorkout: 'Há 6 dias', status: 'Atenção', due: '08/10' },
        { name: 'Pedro Martins', plan: 'Performance', goal: 'Hipertrofia', adherence: 80, lastWorkout: 'Hoje', status: 'Ativo', due: '20/10' },
        { name: 'Beatriz Rocha', plan: 'Essencial', goal: 'Saúde', adherence: 0, lastWorkout: '—', status: 'Pendente', due: '06/10' }
    ],
    revenue: [6200, 6900, 7400, 7100, 8300, 8950]
};

function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return localISO(d);
}

// Data no fuso local no formato YYYY-MM-DD
function localISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- Biblioteca de exercícios ----------
// [nome, grupo, equipamento, nível, músculos, dicas]
SEED.library = [
    ['Supino reto com barra', 'Peito', 'Barra', 'Intermediário', 'Peitoral maior, tríceps, deltoide anterior', ['Escápulas retraídas e pés firmes no chão', 'Desça a barra até a linha do peito', 'Não tire o quadril do banco']],
    ['Supino inclinado com halteres', 'Peito', 'Halteres', 'Intermediário', 'Peitoral superior, deltoide anterior', ['Banco entre 30° e 45°', 'Cotovelos a ~45° do tronco', 'Junte os halteres no alto sem bater']],
    ['Crucifixo na polia', 'Peito', 'Polia', 'Iniciante', 'Peitoral maior', ['Cotovelos levemente flexionados o tempo todo', 'Movimento em arco, como um abraço', 'Contraia o peito no final']],
    ['Flexão de braço', 'Peito', 'Peso corporal', 'Iniciante', 'Peitoral, tríceps, core', ['Corpo alinhado da cabeça aos pés', 'Mãos um pouco além da largura dos ombros', 'Peito quase encosta no chão']],
    ['Mergulho nas paralelas', 'Peito', 'Paralelas', 'Avançado', 'Peitoral inferior, tríceps', ['Incline o tronco à frente para focar no peito', 'Desça até ~90° de cotovelo', 'Evite elevar os ombros']],
    ['Tríceps corda', 'Tríceps', 'Polia', 'Iniciante', 'Tríceps braquial', ['Cotovelos colados ao corpo', 'Abra a corda no final do movimento', 'Controle a volta']],
    ['Tríceps francês', 'Tríceps', 'Halteres', 'Intermediário', 'Tríceps (cabeça longa)', ['Cotovelos apontando para cima', 'Desça o peso atrás da cabeça', 'Não abra os cotovelos']],
    ['Tríceps testa', 'Tríceps', 'Barra W', 'Intermediário', 'Tríceps braquial', ['Braços perpendiculares ao chão', 'Desça a barra em direção à testa', 'Só o antebraço se move']],
    ['Puxada frontal', 'Costas', 'Polia', 'Iniciante', 'Latíssimo do dorso, bíceps', ['Puxe a barra até a parte alta do peito', 'Peito aberto, leve inclinação para trás', 'Não use impulso']],
    ['Remada curvada', 'Costas', 'Barra', 'Intermediário', 'Latíssimo, romboides, trapézio', ['Tronco a ~45°, coluna neutra', 'Puxe a barra em direção ao umbigo', 'Aperte as escápulas no topo']],
    ['Remada unilateral', 'Costas', 'Halteres', 'Iniciante', 'Latíssimo, romboides', ['Apoie joelho e mão no banco', 'Puxe o cotovelo para trás e para cima', 'Evite girar o tronco']],
    ['Pulldown na polia', 'Costas', 'Polia', 'Iniciante', 'Latíssimo do dorso', ['Braços quase estendidos', 'Leve a barra até as coxas', 'Foque em puxar com as costas']],
    ['Barra fixa', 'Costas', 'Barra fixa', 'Avançado', 'Latíssimo, bíceps, core', ['Comece com os braços estendidos', 'Suba até o queixo passar a barra', 'Sem balançar o corpo']],
    ['Rosca direta', 'Bíceps', 'Barra', 'Iniciante', 'Bíceps braquial', ['Cotovelos fixos ao lado do corpo', 'Não balance o tronco', 'Desça devagar']],
    ['Rosca martelo', 'Bíceps', 'Halteres', 'Iniciante', 'Braquial, braquiorradial', ['Pegada neutra (palmas para dentro)', 'Suba alternando ou simultâneo', 'Punhos firmes']],
    ['Rosca concentrada', 'Bíceps', 'Halteres', 'Iniciante', 'Bíceps braquial', ['Cotovelo apoiado na parte interna da coxa', 'Suba contraindo bem o bíceps', 'Movimento lento e controlado']],
    ['Agachamento livre', 'Pernas', 'Barra', 'Avançado', 'Quadríceps, glúteos, posteriores', ['Pés na largura dos ombros', 'Joelhos acompanham a ponta dos pés', 'Coluna neutra durante todo o movimento']],
    ['Leg press 45°', 'Pernas', 'Máquina', 'Iniciante', 'Quadríceps, glúteos', ['Lombar sempre apoiada no encosto', 'Não trave os joelhos no alto', 'Desça até ~90°']],
    ['Cadeira extensora', 'Pernas', 'Máquina', 'Iniciante', 'Quadríceps', ['Ajuste o eixo na linha do joelho', 'Segure 1 segundo no topo', 'Desça controlando']],
    ['Mesa flexora', 'Pernas', 'Máquina', 'Iniciante', 'Posteriores da coxa', ['Quadril colado no banco', 'Flexione até ~90°', 'Evite tirar o quadril']],
    ['Stiff', 'Pernas', 'Barra', 'Intermediário', 'Posteriores, glúteos, lombar', ['Joelhos levemente flexionados', 'Leve o quadril para trás', 'Barra próxima às pernas']],
    ['Afundo com halteres', 'Pernas', 'Halteres', 'Intermediário', 'Quadríceps, glúteos', ['Passo largo à frente', 'Joelho de trás quase toca o chão', 'Tronco ereto']],
    ['Elevação pélvica', 'Pernas', 'Barra', 'Intermediário', 'Glúteos', ['Costas apoiadas no banco', 'Suba até alinhar tronco e coxas', 'Contraia os glúteos no topo']],
    ['Panturrilha em pé', 'Pernas', 'Máquina', 'Iniciante', 'Gastrocnêmio, sóleo', ['Amplitude completa', 'Pausa no alto', 'Não deixe os joelhos dobrarem']],
    ['Desenvolvimento com halteres', 'Ombros', 'Halteres', 'Intermediário', 'Deltoides, tríceps', ['Sentado com as costas apoiadas', 'Desça até a altura das orelhas', 'Não arqueie a lombar']],
    ['Elevação lateral', 'Ombros', 'Halteres', 'Iniciante', 'Deltoide lateral', ['Suba até a linha dos ombros', 'Cotovelos levemente flexionados', 'Sem impulso do tronco']],
    ['Elevação frontal', 'Ombros', 'Halteres', 'Iniciante', 'Deltoide anterior', ['Suba até a altura dos olhos', 'Braços quase estendidos', 'Alterne os braços se preferir']],
    ['Crucifixo invertido', 'Ombros', 'Halteres', 'Iniciante', 'Deltoide posterior, romboides', ['Tronco inclinado à frente', 'Abra os braços até a linha dos ombros', 'Aperte as escápulas']],
    ['Prancha', 'Abdômen', 'Peso corporal', 'Iniciante', 'Core, transverso do abdômen', ['Cotovelos abaixo dos ombros', 'Quadril alinhado, sem cair', 'Respire normalmente']],
    ['Abdominal infra', 'Abdômen', 'Peso corporal', 'Iniciante', 'Reto abdominal (porção inferior)', ['Lombar colada no chão', 'Eleve as pernas sem impulso', 'Desça devagar']],
    ['Abdominal crunch', 'Abdômen', 'Peso corporal', 'Iniciante', 'Reto abdominal', ['Mãos ao lado da cabeça, sem puxar o pescoço', 'Suba só até tirar as escápulas do chão', 'Expire ao subir']],
    ['Esteira (intervalado)', 'Cardio', 'Esteira', 'Iniciante', 'Sistema cardiovascular', ['Alterne 1 min forte e 1 min leve', 'Aqueça 3 a 5 min antes', 'Mantenha a postura ereta']],
    ['Burpee', 'Cardio', 'Peso corporal', 'Intermediário', 'Corpo inteiro', ['Agache, apoie as mãos e jogue os pés para trás', 'Faça uma flexão (opcional)', 'Volte e salte com os braços para cima']],
    ['Kettlebell swing', 'Cardio', 'Kettlebell', 'Intermediário', 'Glúteos, posteriores, core', ['O movimento vem do quadril, não dos braços', 'Kettlebell até a altura do peito', 'Coluna neutra']],
    ['Corda naval', 'Cardio', 'Corda naval', 'Iniciante', 'Ombros, braços, core', ['Joelhos semiflexionados', 'Ondas rápidas e alternadas', 'Mantenha o abdômen firme']]
].map(([name, group, equipment, level, muscles, tips]) => ({
    id: name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name, group, equipment, level, muscles, tips
}));

// Vídeos de execução que já vêm no site (o coach pode trocar ou adicionar outros)
SEED.defaultVideos = {
    burpee: 'https://youtube.com/shorts/aFSpzKujvZk'
};

// ---------- Avaliações físicas (por aluno) ----------
SEED.assessments = {
    'Lucas Andrade': [
        { id: 'av1', date: '2026-07-06', weight: 88.4, fat: 24.1, chest: 104, waist: 96, hip: 102, arm: 35, thigh: 60, notes: 'Avaliação inicial.', photos: {} },
        { id: 'av2', date: '2026-08-31', weight: 84.7, fat: 21.4, chest: 103, waist: 91.5, hip: 100, arm: 35.5, thigh: 59.5, notes: 'Boa evolução na cintura.', photos: {} }
    ]
};

// ---------- Cobranças ----------
SEED.planPrices = { Essencial: 89, Performance: 149, Premium: 299 };
SEED.invoices = (() => {
    const list = [];
    const now = new Date();
    const dueDays = { 'Lucas Andrade': 10, 'Mariana Souza': 15, 'Rafael Lima': 12, 'Juliana Costa': 8, 'Pedro Martins': 20, 'Beatriz Rocha': 6 };
    const plans = { 'Lucas Andrade': 'Performance', 'Mariana Souza': 'Premium', 'Rafael Lima': 'Premium', 'Juliana Costa': 'Essencial', 'Pedro Martins': 'Performance', 'Beatriz Rocha': 'Essencial' };
    Object.keys(plans).forEach(student => {
        for (let m = -5; m <= 0; m++) {
            if (student === 'Beatriz Rocha' && m < 0) continue; // aluna nova
            if (student === 'Pedro Martins' && m < -2) continue; // entrou há 3 meses
            const due = localISO(new Date(now.getFullYear(), now.getMonth() + m, dueDays[student]));
            // Meses anteriores pagos; no mês atual, só alguns já pagaram
            const paid = m < 0 ? !(student === 'Juliana Costa' && m === -1) : ['Mariana Souza', 'Pedro Martins'].includes(student);
            list.push({
                id: `${student.split(' ')[0].toLowerCase()}-${due}`, student, plan: plans[student],
                amount: SEED.planPrices[plans[student]], due,
                paidAt: paid ? due : null, method: paid ? (m % 2 ? 'Pix' : 'Cartão') : null
            });
        }
    });
    return list;
})();

// ---------- Despesas do coach (exemplo) ----------
SEED.expenses = (() => {
    const now = new Date();
    const list = [];
    const day = (m, d) => localISO(new Date(now.getFullYear(), now.getMonth() + m, d));
    for (let m = -5; m <= 0; m++) {
        list.push({ id: 'ex-das' + m, description: 'Guia DAS do MEI', category: 'Impostos e taxas', amount: 75.9, date: day(m, 5) });
        list.push({ id: 'ex-sw' + m, description: 'App de treinos e agenda', category: 'Software e apps', amount: 59.9, date: day(m, 8) });
        list.push({ id: 'ex-mk' + m, description: 'Anúncios no Instagram', category: 'Marketing', amount: [120, 150, 90, 200, 180, 160][m + 5], date: day(m, 15) });
    }
    list.push({ id: 'ex-eq1', description: 'Elásticos e kettlebell', category: 'Equipamentos', amount: 380, date: day(-2, 20) });
    return list;
})();
