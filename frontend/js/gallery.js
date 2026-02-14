// ============================================
// gallery.js
// Lightbox de la galeria de fotos
// Soporta click, teclado (flechas + Esc) y swipe en movil
// ============================================

(function () {
    'use strict';

    // Elementos del lightbox
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');

    let currentIndex = 0;
    let images = [];

    // --- Inicializar galeria ---
    // Recorre todos los items, guarda las URLs y les pone click
    function initGallery() {
        galleryItems.forEach((item, index) => {
            const img = item.querySelector('img');
            if (img) {
                images.push(img.src);

                // El boton de "ver mas" siempre abre desde la primera foto
                if (item.classList.contains('gallery-more')) {
                    item.addEventListener('click', () => openLightbox(0));
                } else {
                    item.addEventListener('click', () => openLightbox(index));
                }
            }
        });
    }

    // --- Abrir/cerrar lightbox ---
    function openLightbox(index) {
        currentIndex = index;
        updateLightboxImage();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // bloqueamos scroll del fondo
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Cambia la imagen con una transicion suave de opacidad
    function updateLightboxImage() {
        lightboxImg.style.opacity = '0';
        setTimeout(() => {
            lightboxImg.src = images[currentIndex];
            lightboxImg.style.opacity = '1';
        }, 150);
    }

    // --- Navegacion entre fotos ---
    function prevImage() {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updateLightboxImage();
    }

    function nextImage() {
        currentIndex = (currentIndex + 1) % images.length;
        updateLightboxImage();
    }

    // Botones de cerrar, anterior y siguiente
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', prevImage);
    if (nextBtn) nextBtn.addEventListener('click', nextImage);

    // Click en el fondo oscuro tambien cierra
    lightbox?.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // --- Atajos de teclado ---
    document.addEventListener('keydown', (e) => {
        if (!lightbox?.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape': closeLightbox(); break;
            case 'ArrowLeft': prevImage(); break;
            case 'ArrowRight': nextImage(); break;
        }
    });

    // --- Swipe en movil ---
    // Detectamos el gesto de deslizar para cambiar de foto
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox?.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox?.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 50; // minimo de pixeles para contar como swipe
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextImage();  // deslizar a la izquierda = siguiente
            } else {
                prevImage();  // deslizar a la derecha = anterior
            }
        }
    }

    // Transicion suave para la imagen
    if (lightboxImg) {
        lightboxImg.style.transition = 'opacity 0.15s ease';
    }

    // Arrancamos todo
    initGallery();
})();
