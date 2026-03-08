// countdown.js
// Cuenta regresiva para el dia del evento
// se actualiza cada segundo y muestra los dias, horas, minutos y segundos que faltan
// cuando llega a cero cambia el titulo a "Es Hoy!"

(function () {
    'use strict';

    // fecha del evento: 28 de marzo del 2026 a las 5pm (hora de Mexico, UTC-6)
    // esta fecha esta hardcodeada pero se podria sacar de la base de datos
    const targetDate = new Date('2026-03-28T17:00:00-06:00');

    // agarramos los elementos del DOM donde vamos a poner los numeros
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    // esta funcion calcula cuanto falta y actualiza los numeros en pantalla
    function updateCountdown() {
        const now = new Date();
        const difference = targetDate - now; // diferencia en milisegundos

        // si ya paso la fecha ponemos todo en ceros
        if (difference <= 0) {
            daysEl.textContent = '0';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';

            // cambiamos el titulo de la seccion para que diga que ya es hoy
            const countdownSection = document.getElementById('countdown');
            if (countdownSection) {
                const title = countdownSection.querySelector('.section-title');
                if (title) title.textContent = '¡Es Hoy!';
            }
            return; // ya no hay nada mas que calcular
        }

        // convertimos los milisegundos a dias, horas, minutos y segunos
        // usamos Math.floor para redondear hacia abajo
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        // metemos los valores al DOM
        // padStart le pone un cero enfrente si el numero es de un solo digito
        daysEl.textContent = days.toString();
        hoursEl.textContent = hours.toString().padStart(2, '0');
        minutesEl.textContent = minutes.toString().padStart(2, '0');
        secondsEl.textContent = seconds.toString().padStart(2, '0');
    }

    // la corremos una vez al cargar y despues cada segundo con setInterval
    updateCountdown();
    setInterval(updateCountdown, 1000);
})();
