/* Countdown Logic */

(function () {
    'use strict';

    // Target date: March 15, 2026, 5:00 PM (Mexico City time)
    // During standard time (November - April), Mexico City is UTC-6
    const targetDate = new Date('2025-03-28T17:00:00-06:00');

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    function updateCountdown() {
        const now = new Date();
        const difference = targetDate - now;

        if (difference <= 0) {
            // Event has passed or is happening now
            daysEl.textContent = '0';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';

            // Optional: Show a message or change styling
            const countdownSection = document.getElementById('countdown');
            if (countdownSection) {
                const title = countdownSection.querySelector('.section-title');
                if (title) {
                    title.textContent = '¡Es Hoy!';
                }
            }
            return;
        }

        // Calculate time units
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        // Update DOM with zero-padding
        daysEl.textContent = days.toString();
        hoursEl.textContent = hours.toString().padStart(2, '0');
        minutesEl.textContent = minutes.toString().padStart(2, '0');
        secondsEl.textContent = seconds.toString().padStart(2, '0');
    }

    // Initial update
    updateCountdown();

    // Update every second
    setInterval(updateCountdown, 1000);
})();
