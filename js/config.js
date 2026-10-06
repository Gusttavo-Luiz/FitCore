// Dados do coach usados no site inteiro. Edite aqui para atualizar links e textos.
const SITE = {
    coach: 'Sidnei Muller',
    instagram: 'https://www.instagram.com/sidneiomuller/',
    instagramHandle: '@sidneiomuller',
    threads: 'https://www.threads.net/@sidneiomuller',
    // Link completo do checkout da Prime Coaching (app.primecoaching.com.br/checkout/...).
    // Enquanto estiver vazio, os botões de compra levam ao Instagram.
    checkout: '',
    // WhatsApp com DDI + DDD, só números (ex.: '5511999999999'). Vazio = botões escondidos.
    whatsapp: '5511921410448', // número de exemplo: trocar pelo do Sidnei
    whatsappMessage: 'Olá, Sidnei! Vim pelo site e quero saber mais sobre a consultoria.',
    // Supabase (banco de dados e login). Supabase → Project Settings → API.
    // Vazios = modo demonstração (dados de exemplo, salvos só no navegador).
    // A chave "anon" pode ficar pública: quem protege os dados são as regras do banco (RLS).
    supabaseUrl: '',
    supabaseAnonKey: '',
    coupon: 'CHAMP',
    couponDiscount: '15%'
};

// Preenche os links marcados com data-link="instagram|threads|checkout"
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-link]').forEach(a => {
        const key = a.dataset.link;
        if (key === 'whatsapp') {
            const num = SITE.whatsapp.replace(/\D/g, '');
            if (!num) { a.hidden = true; return; }
            a.href = `https://wa.me/${num}?text=${encodeURIComponent(SITE.whatsappMessage)}`;
        } else {
            a.href = key === 'checkout' ? (SITE.checkout || SITE.instagram) : SITE[key];
        }
        a.target = '_blank';
        a.rel = 'noopener';
    });
    document.querySelectorAll('[data-coupon]').forEach(el => el.textContent = SITE.coupon);
    document.querySelectorAll('[data-discount]').forEach(el => el.textContent = SITE.couponDiscount);
});
