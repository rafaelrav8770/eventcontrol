// gallery.js
// Logica del lightbox (visor de imagenes) de la galeria de fotos
// soporta navegacion por click, teclas del teclado (flechas y Esc)
// y tambien el swipe en celulares (deslizar con el dedo)

(function () {
    'use strict';

    // buscamos todos los elementos que necesitamos del HTML
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');

    let currentIndex = 0;  // indice de la foto que se esta mostrando
    let images = [];       // arreglo con todas las URLs de las fotos

    // --- Inicializacion de la galeria ---
    // recorre todos los items de la galeria, guarda las URLs
    // y les pone el evento de click para abrir el lightbox
    function initGallery() {
        galleryItems.forEach((item, index) => {
            const img = item.querySelector('img');
            if (img) {
                images.push(img.src); // guardamos la url de cada imagen

                // el boton de "ver mas" siempre abre desde la primera foto
                if (item.classList.contains('gallery-more')) {
                    item.addEventListener('click', () => openLightbox(0));
                } else {
                    // las demas fotos abren en su posicion correspondiente
                    item.addEventListener('click', () => openLightbox(index));
                }
            }
        });
    }

    // --- Funciones para abrir y cerrar el lightbox ---
    function openLightbox(index) {
        currentIndex = index;
        updateLightboxImage();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // bloqueamos el scroll del fondo
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // desbloqueamos el scroll
    }

    // cambia la imagen que se muestra con un efecto de fade (opacidad)
    function updateLightboxImage() {
        lightboxImg.style.opacity = '0'; // primero la hacemos transparente
        setTimeout(() => {
            lightboxImg.src = images[currentIndex]; // cambiamos la imagen
            lightboxImg.style.opacity = '1'; // y la hacemos visible de nuevo
        }, 150);
    }

    // --- Navegacion entre las fotos ---
    // usa modulo (%) para que al llegar al final regrese al inicio
    function prevImage() {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updateLightboxImage();
    }

    function nextImage() {
        currentIndex = (currentIndex + 1) % images.length;
        updateLightboxImage();
    }

    // conectamos los botones de cerrar, anterior y siguiente
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', prevImage);
    if (nextBtn) nextBtn.addEventListener('click', nextImage);

    // si le dan click al fondo oscuro (overlay) tambien lo cerramos
    lightbox?.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // --- Atajos de teclado ---
    // Escape cierra, flechas izq/der cambian de foto
    document.addEventListener('keydown', (e) => {
        if (!lightbox?.classList.contains('active')) return; // solo funciona si esta abierto

        switch (e.key) {
            case 'Escape': closeLightbox(); break;
            case 'ArrowLeft': prevImage(); break;
            case 'ArrowRight': nextImage(); break;
        }
    });

    // --- Soporte para swipe en celulares ---
    // detectamos el gesto de deslizar el dedo para cambiar de foto
    let touchStartX = 0;
    let touchEndX = 0;

    // guardamos donde empezo el toque
    lightbox?.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    // cuando levanta el dedo calculamos la diferencia
    lightbox?.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    // determina si el swipe fue suficiente (minimo 50px)
    // y hacia que direccion fue
    function handleSwipe() {
        const swipeThreshold = 50; // minimo de pixeles para que cuente como swipe
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextImage();  // deslizar a la izquierda = siguiente foto
            } else {
                prevImage();  // deslizar a la derecha = foto anterior
            }
        }
    }

    // le ponemos transicion suave a la imagen del lightbox
    if (lightboxImg) {
        lightboxImg.style.transition = 'opacity 0.15s ease';
    }

    // arrancamos la galeria
    initGallery();
})();
