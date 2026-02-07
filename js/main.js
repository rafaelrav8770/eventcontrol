/* Main Logic */

(function () {
    'use strict';

    // DOM Elements
    const entryScreen = document.getElementById('entry-screen');
    const enterBtn = document.getElementById('enter-btn');
    const mainContent = document.getElementById('main-content');
    const guestPass = document.getElementById('guest-pass');
    const floatingNav = document.getElementById('floating-nav');

    // RSVP Elements
    const confirmBrideBtn = document.getElementById('confirm-bride');
    const confirmGroomBtn = document.getElementById('confirm-groom');
    const whatsappModal = document.getElementById('whatsapp-modal');
    const pendingModal = document.getElementById('pending-modal');
    const modalClose = document.getElementById('modal-close');
    const pendingClose = document.getElementById('pending-close');
    const pendingOk = document.getElementById('pending-ok');
    const rsvpForm = document.getElementById('rsvp-form');

    // Configuration
    const config = {
        brideWhatsApp: '529613030443',
        groomWhatsApp: '529611030648',
        eventDate: '15 de marzo de 2026',
        eventTime: '5:00 pm'
    };

    // Guest Pass Init
    function initGuestPass() {
        const urlParams = new URLSearchParams(window.location.search);
        const pase = urlParams.get('pase');

        if (pase && guestPass) {
            guestPass.textContent = `Pase para: ${decodeURIComponent(pase.replace(/\+/g, ' '))}`;
        }
    }

    // Entry Screen Logic
    function initEntryScreen() {
        if (!enterBtn || !entryScreen || !mainContent) return;

        enterBtn.addEventListener('click', () => {
            entryScreen.classList.add('fade-out');
            setTimeout(() => {
                entryScreen.style.display = 'none';
                mainContent.classList.remove('hidden');
                requestAnimationFrame(() => {
                    mainContent.classList.add('show');
                    checkScrollAnimations();
                });
            }, 800);
        });
    }

    // Navigation Logic
    function initFloatingNav() {
        const menuToggle = document.getElementById('menu-toggle');
        const navClose = document.getElementById('nav-close');
        const navOverlay = floatingNav?.querySelector('.nav-overlay');

        if (!floatingNav || !menuToggle) return;

        const heroSection = document.getElementById('hero');
        const heroHeight = heroSection?.offsetHeight || 500;

        // Show/hide menu button on scroll
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            // Show menu toggle after scrolling past hero
            if (currentScrollY > heroHeight - 100) {
                menuToggle.classList.add('visible');
            } else {
                menuToggle.classList.remove('visible');
                // Also close nav if open and scrolled back up
                closeNav();
            }
        }, { passive: true });

        // Toggle menu
        menuToggle.addEventListener('click', () => {
            if (floatingNav.classList.contains('active')) {
                closeNav();
            } else {
                openNav();
            }
        });

        // Close button
        navClose?.addEventListener('click', closeNav);

        // Click overlay to close
        navOverlay?.addEventListener('click', closeNav);

        // ESC key to close nav
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && floatingNav.classList.contains('active')) {
                closeNav();
            }
        });

        // Smooth scroll for nav links
        const navLinks = floatingNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetSection = document.getElementById(targetId);

                if (targetSection) {
                    const targetPosition = targetSection.offsetTop - 20;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });

                    // Close nav after clicking
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

    // Scroll Animations
    function initScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // Optionally unobserve after animation
                    // observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        animatedElements.forEach(el => observer.observe(el));
    }

    function checkScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        animatedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 50) {
                el.classList.add('visible');
            }
        });
    }

    // Modals
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
        // Close buttons
        modalClose?.addEventListener('click', () => closeModal(whatsappModal));
        pendingClose?.addEventListener('click', () => closeModal(pendingModal));
        pendingOk?.addEventListener('click', () => closeModal(pendingModal));

        // Click overlay to close
        whatsappModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(whatsappModal));
        pendingModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(pendingModal));

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal(whatsappModal);
                closeModal(pendingModal);
            }
        });
    }

    // RSVP & WhatsApp
    let selectedWhatsApp = config.brideWhatsApp; // Default to bride

    function initRSVP() {
        // Bride button - Opens form modal (sends to bride)
        confirmBrideBtn?.addEventListener('click', () => {
            selectedWhatsApp = config.brideWhatsApp;
            openModal(whatsappModal);
        });

        // Groom button - Opens form modal (sends to groom)
        confirmGroomBtn?.addEventListener('click', () => {
            selectedWhatsApp = config.groomWhatsApp;
            openModal(whatsappModal);
        });

        // Form submission
        rsvpForm?.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('guest-name')?.value.trim();
            const guests = document.getElementById('guest-count')?.value;
            const note = document.getElementById('guest-note')?.value.trim();

            if (!name || !guests) {
                alert('Por favor completa los campos requeridos.');
                return;
            }

            // Build WhatsApp message
            const message = buildWhatsAppMessage(name, guests, note);
            const whatsappUrl = `https://wa.me/${selectedWhatsApp}?text=${encodeURIComponent(message)}`;

            // Open WhatsApp
            window.open(whatsappUrl, '_blank');

            // Close modal and reset form
            closeModal(whatsappModal);
            rsvpForm.reset();
        });
    }

    function buildWhatsAppMessage(name, guests, note) {
        let message = `Hola, soy ${name}. Confirmo mi asistencia a la boda de Abidán y Betsaida el ${config.eventDate} a las ${config.eventTime}. Asistiremos ${guests} persona(s).`;

        if (note) {
            message += ` Nota: ${note}`;
        }

        message += ' ¡Muchas gracias!';

        return message;
    }

    // Lazy Loading
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

    // Init
    function init() {
        initGuestPass();
        initEntryScreen();
        initFloatingNav();
        initScrollAnimations();
        initModals();
        initRSVP();
        initLazyLoading();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
