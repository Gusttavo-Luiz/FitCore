// Dados do coach usados no site inteiro. Edite aqui para atualizar links e textos.
const SITE = {
    coach: 'Sidnei Muller',
    instagram: 'https://www.instagram.com/sidneiomuller/',
    instagramHandle: '@sidneiomuller',
    threads: 'https://www.threads.net/@sidneiomuller',
    // Link completo do checkout da Prime Coaching (app.primecoaching.com.br/checkout/...).
    // Enquanto estiver vazio, os botões de compra levam ao Instagram.
    checkout: '',
    coupon: 'CHAMP',
    couponDiscount: '15%'
};

// Preenche os links marcados com data-link="instagram|threads|checkout"
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-link]').forEach(a => {
        const key = a.dataset.link;
        a.href = key === 'checkout' ? (SITE.checkout || SITE.instagram) : SITE[key];
        a.target = '_blank';
        a.rel = 'noopener';
    });
    document.querySelectorAll('[data-coupon]').forEach(el => el.textContent = SITE.coupon);
    document.querySelectorAll('[data-discount]').forEach(el => el.textContent = SITE.couponDiscount);
});
