// Dados de exemplo da plataforma. Em produção viriam de uma API/banco de dados.
const SEED = {
    trainer: { name: 'Carla Pereira', cref: 'CREF 012345-G/SP' },

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

    sessions: [
        { date: offsetDate(0), time: '18:00', title: 'Treino presencial', type: 'Presencial', place: 'Academia Smart Fit — Centro' },
        { date: offsetDate(2), time: '07:30', title: 'Aula online — Funcional', type: 'Online', place: 'Google Meet' },
        { date: offsetDate(5), time: '09:00', title: 'Avaliação física', type: 'Avaliação', place: 'Estúdio FitCore' },
        { date: offsetDate(9), time: '18:00', title: 'Treino presencial', type: 'Presencial', place: 'Academia Smart Fit — Centro' }
    ],

    messages: [
        { from: 'them', text: 'Bom dia! Como foi o treino de pernas ontem?', at: '08:12' },
        { from: 'me', text: 'Foi pesado, mas consegui subir a carga no agachamento para 80 kg 💪', at: '08:30' },
        { from: 'them', text: 'Excelente! Mantém essa carga essa semana e foca na execução. Na próxima avaliação a gente ajusta.', at: '08:34' },
        { from: 'them', text: 'Lembre de beber pelo menos 3 L de água por dia.', at: '08:35' }
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
