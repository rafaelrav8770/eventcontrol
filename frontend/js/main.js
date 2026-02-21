// ============================================
// main.js
// Logica principal del sitio de la boda
// Maneja: pantalla de entrada, navegacion, modales,
// animaciones de scroll, RSVP por WhatsApp y lazy loading
// ============================================

(function () {
    'use strict';

    // --- Elementos principales del DOM ---
    const entryScreen = document.getElementById('entry-screen');
    const enterBtn = document.getElementById('enter-btn');
    const mainContent = document.getElementById('main-content');
    const guestPass = document.getElementById('guest-pass');
    const floatingNav = document.getElementById('floating-nav');

    // --- Elementos del RSVP / WhatsApp ---
    const confirmBrideBtn = document.getElementById('confirm-bride');
    const confirmGroomBtn = document.getElementById('confirm-groom');
    const whatsappModal = document.getElementById('whatsapp-modal');
    const pendingModal = document.getElementById('pending-modal');
    const modalClose = document.getElementById('modal-close');
    const pendingClose = document.getElementById('pending-close');
    const pendingOk = document.getElementById('pending-ok');
    const rsvpForm = document.getElementById('rsvp-form');

    // Config de WhatsApp y evento
    const config = {
        brideWhatsApp: '529613030443',
        groomWhatsApp: '529611030648',
        eventDate: '28 de marzo de 2026',
        eventTime: '5:00 pm'
    };

    // =============================================
    // PANTALLA DE ENTRADA
    // Si la URL trae ?pase=NombreFamilia lo mostramos
    // =============================================
    function initGuestPass() {
        const urlParams = new URLSearchParams(window.location.search);
        const pase = urlParams.get('pase');

        if (pase && guestPass) {
            guestPass.textContent = `Pase para: ${decodeURIComponent(pase.replace(/\+/g, ' '))}`;
        }
    }

    // Al darle click a "ENTRAR", hacemos fade out y mostramos el contenido
    function initEntryScreen() {
        if (!enterBtn || !entryScreen || !mainContent) return;

        enterBtn.addEventListener('click', () => {
            entryScreen.classList.add('fade-out');
            setTimeout(() => {
                entryScreen.style.display = 'none';
                mainContent.classList.remove('hidden');
                requestAnimationFrame(() => {
                    mainContent.classList.add('show');
                    checkScrollAnimations(); // revisamos si ya hay cosas visibles
                });
            }, 800);
        });
    }

    // =============================================
    // NAVEGACION (menu hamburguesa)
    // Aparece despues de scrollear pasado el hero
    // =============================================
    function initFloatingNav() {
        const menuToggle = document.getElementById('menu-toggle');
        const navClose = document.getElementById('nav-close');
        const navOverlay = floatingNav?.querySelector('.nav-overlay');

        if (!floatingNav || !menuToggle) return;

        const heroSection = document.getElementById('hero');
        const heroHeight = heroSection?.offsetHeight || 500;

        // Mostramos/ocultamos el boton del menu segun el scroll
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > heroHeight - 100) {
                menuToggle.classList.add('visible');
            } else {
                menuToggle.classList.remove('visible');
                closeNav(); // si suben mucho, cerramos el nav
            }
        }, { passive: true });

        // Toggle del menu
        menuToggle.addEventListener('click', () => {
            floatingNav.classList.contains('active') ? closeNav() : openNav();
        });

        // Cerrar con boton X o con click en el overlay
        navClose?.addEventListener('click', closeNav);
        navOverlay?.addEventListener('click', closeNav);

        // ESC tambien cierra
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && floatingNav.classList.contains('active')) {
                closeNav();
            }
        });

        // Smooth scroll al dar click en los links del nav
        const navLinks = floatingNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetSection = document.getElementById(targetId);

                if (targetSection) {
                    window.scrollTo({
                        top: targetSection.offsetTop - 20,
                        behavior: 'smooth'
                    });
                    closeNav();
                }
            });
        });

        function openNav() {
            floatingNav.classList.add('active');
            menuToggle.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeNav() {
            floatingNav.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // =============================================
    // ANIMACIONES DE SCROLL
    // Usamos IntersectionObserver para animar
    // elementos cuando entran en el viewport
    // =============================================
    function initScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        });

        animatedElements.forEach(el => observer.observe(el));
    }

    // Checamos manualmente que elementos ya estan visibles
    // (se usa al mostrar el contenido principal por primera vez)
    function checkScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        animatedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 50) {
                el.classList.add('visible');
            }
        });
    }

    // =============================================
    // MODALES
    // Abrir, cerrar con boton, overlay o ESC
    // =============================================
    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function initModals() {
        // Botones de cerrar
        modalClose?.addEventListener('click', () => closeModal(whatsappModal));
        pendingClose?.addEventListener('click', () => closeModal(pendingModal));
        pendingOk?.addEventListener('click', () => closeModal(pendingModal));

        // Click en el overlay cierra el modal
        whatsappModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(whatsappModal));
        pendingModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(pendingModal));

        // ESC cierra todo
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal(whatsappModal);
                closeModal(pendingModal);
            }
        });
    }

    // =============================================
    // RSVP / CONFIRMACION POR WHATSAPP
    // Los invitados llenan un formulario y se abre
    // WhatsApp con el mensaje pre-armado
    // =============================================
    let selectedWhatsApp = config.brideWhatsApp; // por default va a la novia

    function initRSVP() {
        // Boton de confirmar con la novia
        confirmBrideBtn?.addEventListener('click', () => {
            selectedWhatsApp = config.brideWhatsApp;
            openModal(whatsappModal);
        });

        // Boton de confirmar con el novio
        confirmGroomBtn?.addEventListener('click', () => {
            selectedWhatsApp = config.groomWhatsApp;
            openModal(whatsappModal);
        });

        // Al enviar el formulario, armamos el mensaje y abrimos WhatsApp
        rsvpForm?.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('guest-name')?.value.trim();
            const guests = document.getElementById('guest-count')?.value;
            const note = document.getElementById('guest-note')?.value.trim();

            if (!name || !guests) {
                alert('Por favor completa los campos requeridos.');
                return;
            }

            const message = buildWhatsAppMessage(name, guests, note);
            const whatsappUrl = `https://wa.me/${selectedWhatsApp}?text=${encodeURIComponent(message)}`;

            window.open(whatsappUrl, '_blank');

            closeModal(whatsappModal);
            rsvpForm.reset();
        });
    }

    // Armamos el texto del mensaje de WhatsApp
    function buildWhatsAppMessage(name, guests, note) {
        let message = `Hola, soy ${name}. Confirmo mi asistencia a la boda de Abidán y Betsaida el ${config.eventDate} a las ${config.eventTime}. Asistiremos ${guests} persona(s).`;

        if (note) message += ` Nota: ${note}`;

        message += ' ¡Muchas gracias!';
        return message;
    }

    // =============================================
    // LAZY LOADING DE IMAGENES
    // Para que no carguen todas al inicio
    // =============================================
    function initLazyLoading() {
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => imageObserver.observe(img));
        }
    }

    // =============================================
    // ARRANQUE
    // Inicializamos todo al cargar el DOM
    // =============================================
    function init() {
        initGuestPass();
        initEntryScreen();
        initFloatingNav();
        initScrollAnimations();
        initModals();
        initRSVP();
        initLazyLoading();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
