// ============================================
// countdown.js
// Cuenta regresiva para el dia de la boda
// Se actualiza cada segundo en la seccion del countdown
// ============================================

(function () {
    'use strict';

    // Fecha objetivo: 28 de marzo 2026, 5pm hora de Mexico (UTC-6)
    const targetDate = new Date('2026-03-28T17:00:00-06:00');

    // Agarramos los elementos donde van los numeros
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    // Esta funcion calcula cuanto falta y actualiza el DOM
    function updateCountdown() {
        const now = new Date();
        const difference = targetDate - now;

        // Si ya paso la fecha, ponemos todo en cero y cambiamos el titulo
        if (difference <= 0) {
            daysEl.textContent = '0';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';

            // Cambiamos el titulo de la seccion a "Es Hoy!"
            const countdownSection = document.getElementById('countdown');
            if (countdownSection) {
                const title = countdownSection.querySelector('.section-title');
                if (title) title.textContent = '¡Es Hoy!';
            }
            return;
        }

        // Sacamos dias, horas, minutos y segundos de la diferencia en ms
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        // Metemos los valores al DOM (con padding de ceros donde hace falta)
        daysEl.textContent = days.toString();
        hoursEl.textContent = hours.toString().padStart(2, '0');
        minutesEl.textContent = minutes.toString().padStart(2, '0');
        secondsEl.textContent = seconds.toString().padStart(2, '0');
    }

    // Corremos una vez al cargar y luego cada segundo
    updateCountdown();
    setInterval(updateCountdown, 1000);
})();
