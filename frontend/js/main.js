// main.js
// Logica principal del sitio web de la boda
// este archivo maneja varias cosas:
// - la pantalla de bienvenida (entry screen)
// - la navegacion flotante (menu hamburguesa)
// - los modales (ventanas emergentes)
// - las animaciones cuando haces scroll
// - el RSVP (confirmacion por WhatsApp)
// - el lazy loading de imagenes
//
// todo esta encapsulado en un IIFE para no contaminar el scope global

(function () {
    'use strict';

    // --- Agarramos los elementos principales del DOM ---
    const entryScreen = document.getElementById('entry-screen');
    const enterBtn = document.getElementById('enter-btn');
    const mainContent = document.getElementById('main-content');
    const guestPass = document.getElementById('guest-pass');
    const floatingNav = document.getElementById('floating-nav');

    // --- Elementos del formulario de RSVP y WhatsApp ---
    const confirmBrideBtn = document.getElementById('confirm-bride');
    const confirmGroomBtn = document.getElementById('confirm-groom');
    const whatsappModal = document.getElementById('whatsapp-modal');
    const pendingModal = document.getElementById('pending-modal');
    const modalClose = document.getElementById('modal-close');
    const pendingClose = document.getElementById('pending-close');
    const pendingOk = document.getElementById('pending-ok');
    const rsvpForm = document.getElementById('rsvp-form');

    // configuracion de los numeros de WhatsApp y datos del evento
    const config = {
        brideWhatsApp: '529613030443',
        groomWhatsApp: '529611030648',
        eventDate: '28 de marzo de 2026',
        eventTime: '5:00 pm'
    };

    // -------------------------------------------
    // PANTALLA DE BIENVENIDA
    // si la URL trae un parametro ?pase=NombreFamilia
    // lo mostramos en la pantalla de entrada
    // -------------------------------------------
    function initGuestPass() {
        const urlParams = new URLSearchParams(window.location.search);
        const pase = urlParams.get('pase');

        // si vienen el parametro lo mostramos
        if (pase && guestPass) {
            guestPass.textContent = `Pase para: ${decodeURIComponent(pase.replace(/\+/g, ' '))}`;
        }
    }

    // cuando el usuario le da click al boton de "ENTRAR"
    // hacemos un fade out de la pantalla de entrada y mostramos el contenido
    function initEntryScreen() {
        if (!enterBtn || !entryScreen || !mainContent) return;

        enterBtn.addEventListener('click', () => {
            // le ponemos la clase fade-out para la animacion
            entryScreen.classList.add('fade-out');

            // despues de 800ms ocultamos la pantalla y mostramos el contenido
            setTimeout(() => {
                entryScreen.style.display = 'none';
                mainContent.classList.remove('hidden');

                // usamos requestAnimationFrame para que el navegador pinte el cambio
                requestAnimationFrame(() => {
                    mainContent.classList.add('show');
                    checkScrollAnimations(); // checamos si ya hay elementos visibles
                });
            }, 800);
        });
    }

    // -------------------------------------------
    // NAVEGACION FLOTANTE (menu hamburguesa)
    // aparece cuando el usario scrollea mas abajo del hero
    // -------------------------------------------
    function initFloatingNav() {
        const menuToggle = document.getElementById('menu-toggle');
        const navClose = document.getElementById('nav-close');
        const navOverlay = floatingNav?.querySelector('.nav-overlay');

        if (!floatingNav || !menuToggle) return;

        // calculamos la altura del hero para saber cuando mostrar el menu
        const heroSection = document.getElementById('hero');
        const heroHeight = heroSection?.offsetHeight || 500;

        // evento de scroll: mostramos u ocultamos el boton del menu
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > heroHeight - 100) {
                menuToggle.classList.add('visible'); // mostramos el boton
            } else {
                menuToggle.classList.remove('visible'); // lo ocultamos
                closeNav(); // y cerramos el nav si estaba abierto
            }
        }, { passive: true });

        // click en el boton hamburguesa: abre o cierra el menu
        menuToggle.addEventListener('click', () => {
            floatingNav.classList.contains('active') ? closeNav() : openNav();
        });

        // boton X y overlay tambien cierran el menu
        navClose?.addEventListener('click', closeNav);
        navOverlay?.addEventListener('click', closeNav);

        // la tecla Escape tambien cierra
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && floatingNav.classList.contains('active')) {
                closeNav();
            }
        });

        // smooth scroll cuando el usuario da click en un link del nav
        // cada link tiene un href como #countdown, #gallery, etc
        const navLinks = floatingNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1); // quitamos el #
                const targetSection = document.getElementById(targetId);

                if (targetSection) {
                    // hacemos scroll suave hasta la seccion
                    window.scrollTo({
                        top: targetSection.offsetTop - 20,
                        behavior: 'smooth'
                    });
                    closeNav(); // cerramos el menu despues de navegar
                }
            });
        });

        // funciones auxiliares para abrir/cerrar el nav
        function openNav() {
            floatingNav.classList.add('active');
            menuToggle.classList.add('active');
            document.body.style.overflow = 'hidden'; // bloqueamos scroll del fondo
        }

        function closeNav() {
            floatingNav.classList.remove('active');
            menuToggle.classList.remove('active');
            document.body.style.overflow = ''; // restauramos el scroll
        }
    }

    // -------------------------------------------
    // ANIMACIONES DE SCROLL
    // usamos IntersectionObserver para detectar cuando
    // un elemento entra en la pantalla y le ponemos una clase
    // que activa la animacion CSS
    // -------------------------------------------
    function initScrollAnimations() {
        // buscamos todos los elementos que tienen la clase animate-on-scroll
        const animatedElements = document.querySelectorAll('.animate-on-scroll');

        // creamos el observer con un umbral del 10%
        // osea que cuando el 10% del elemento sea visible, se activa
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -50px 0px', // un poquito de margen abajo
            threshold: 0.1
        });

        // observamos cada elemento
        animatedElements.forEach(el => observer.observe(el));
    }

    // esta funcion revisa manualmente que elementos ya estan visibles
    // se usa cuando mostramos el contenido principal por primera vez
    // porque el observer no detecta elementos que ya estaban en pantalla
    function checkScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        animatedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 50) {
                el.classList.add('visible');
            }
        });
    }

    // -------------------------------------------
    // MODALES (ventanas emergentes)
    // funciones genericas para abrir, cerrar con boton, overlay o ESC
    // -------------------------------------------
    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // bloqueamos scroll
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = ''; // desbloqueamos scroll
    }

    function initModals() {
        // botones de cerrar
        modalClose?.addEventListener('click', () => closeModal(whatsappModal));
        pendingClose?.addEventListener('click', () => closeModal(pendingModal));
        pendingOk?.addEventListener('click', () => closeModal(pendingModal));

        // click en el overlay (fondo oscuro) tambien cierra
        whatsappModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(whatsappModal));
        pendingModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(pendingModal));

        // tecla Escape cierra todos los modales
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal(whatsappModal);
                closeModal(pendingModal);
            }
        });
    }

    // -------------------------------------------
    // RSVP / CONFIRMACION POR WHATSAPP
    // el invitado elige con quien confirmar (novio o novia),
    // llena un formulario y se abre WhatsApp con el mensaje listo
    // -------------------------------------------
    let selectedWhatsApp = config.brideWhatsApp; // por default va con la novia

    function initRSVP() {
        // boton de confirmar con la novia
        confirmBrideBtn?.addEventListener('click', () => {
            selectedWhatsApp = config.brideWhatsApp;
            openModal(whatsappModal);
        });

        // boton de confirmar con el novio
        confirmGroomBtn?.addEventListener('click', () => {
            selectedWhatsApp = config.groomWhatsApp;
            openModal(whatsappModal);
        });

        // cuando envian el formulario armamos el mensaje y abrimos whatsapp
        rsvpForm?.addEventListener('submit', (e) => {
            e.preventDefault(); // evitamos que se recargue la pagina

            // sacamos los valores del formulario
            const name = document.getElementById('guest-name')?.value.trim();
            const guests = document.getElementById('guest-count')?.value;
            const note = document.getElementById('guest-note')?.value.trim();

            // validacion basica
            if (!name || !guests) {
                alert('Por favor completa los campos requeridos.');
                return;
            }

            // armamos el mensaje y abrimos la URL de whatsapp
            const message = buildWhatsAppMessage(name, guests, note);
            const whatsappUrl = `https://wa.me/${selectedWhatsApp}?text=${encodeURIComponent(message)}`;

            window.open(whatsappUrl, '_blank'); // abrimos en nueva pestaña

            // cerramos el modal y limpiamos el form
            closeModal(whatsappModal);
            rsvpForm.reset();
        });
    }

    // esta funcion arma el texto del mensaje que se manda por WhatsApp
    function buildWhatsAppMessage(name, guests, note) {
        let message = `Hola, soy ${name}. Confirmo mi asistencia a la boda de Abidán y Betsaida el ${config.eventDate} a las ${config.eventTime}. Asistiremos ${guests} persona(s).`;

        // si escribio una nota la agregamos al final
        if (note) message += ` Nota: ${note}`;

        message += ' ¡Muchas gracias!';
        return message;
    }

    // -------------------------------------------
    // LAZY LOADING DE IMAGENES
    // para que las imagenes no se carguen todas al inicio
    // sino conforme el usuario va scrolleando
    // -------------------------------------------
    function initLazyLoading() {
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');

        // verificamos que el navegador soporte IntersectionObserver
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        // si la imagen tiene data-src, lo ponemos como src
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        imageObserver.unobserve(img); // ya no la observamos
                    }
                });
            });

            // empezamos a observar cada imagen lazy
            lazyImages.forEach(img => imageObserver.observe(img));
        }
    }

    // -------------------------------------------
    // FUNCION DE ARRANQUE
    // inicializamos todos los modulos cuando el DOM esta listo
    // -------------------------------------------
    function init() {
        initGuestPass();
        initEntryScreen();
        initFloatingNav();
        initScrollAnimations();
        initModals();
        initRSVP();
        initLazyLoading();
    }

    // si el DOM todavia no cargó esperamos, si ya cargo ejecutamos directo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
