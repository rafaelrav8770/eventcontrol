// ============================================
// confirm.js — Pagina de Confirmacion de Invitados
// El invitado mete su codigo de 4 digitos,
// se marca como confirmado en Supabase, y puede
// descargar su invitacion con QR para presentar
// el dia del evento.
// ============================================

// Shortcut para Supabase
function getSupabase() {
    return window.supabaseClient;
}

// Pase actual del invitado
let currentPass = null;

// =============================================
// INICIALIZACION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initBackgroundMusic();
    initCodeInputs();
    initForm();

    // Si la URL tiene ?code=XXXX lo llenamos automatico
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl && codeFromUrl.length === 4) {
        fillCodeFromUrl(codeFromUrl.toUpperCase());
    }
});

// =============================================
// MUSICA DE FONDO
// Continua desde donde quedo en la pagina principal
// usando localStorage para recordar la posicion
// =============================================
function initBackgroundMusic() {
    const music = document.getElementById('background-music');
    if (!music) return;

    music.volume = 0.5;

    // Recuperamos donde se quedo la musica
    const savedTime = parseFloat(localStorage.getItem('musicTime')) || 0;
    const wasPlaying = localStorage.getItem('musicPlaying') === 'true';

    // Guardamos la posicion cada medio segundo para que no se pierda
    let savingInterval = null;
    const startSavingTime = () => {
        if (savingInterval) return;
        savingInterval = setInterval(() => {
            if (!music.paused) {
                localStorage.setItem('musicTime', music.currentTime);
                localStorage.setItem('musicPlaying', 'true');
            }
        }, 500);
    };

    // Restaura la posicion y empieza a tocar
    const restoreAndPlay = (targetTime) => {
        return new Promise((resolve) => {
            if (targetTime > 0) {
                const setPosition = () => {
                    music.currentTime = targetTime;
                    const onSeeked = () => {
                        music.removeEventListener('seeked', onSeeked);
                        music.play().then(() => {
                            startSavingTime();
                            resolve(true);
                        }).catch(() => resolve(false));
                    };
                    music.addEventListener('seeked', onSeeked);
                };

                if (music.readyState >= 2) {
                    setPosition();
                } else {
                    music.addEventListener('canplay', () => setPosition(), { once: true });
                }
            } else {
                music.play().then(() => {
                    startSavingTime();
                    resolve(true);
                }).catch(() => resolve(false));
            }
        });
    };

    // Si estaba sonando, intentamos continuar
    if (wasPlaying) {
        const latestTime = parseFloat(localStorage.getItem('musicTime')) || savedTime;
        restoreAndPlay(latestTime).then((success) => {
            if (!success) {
                // Si el browser bloquea autoplay, esperamos al primer click
                const playOnInteraction = () => {
                    const currentLatestTime = parseFloat(localStorage.getItem('musicTime')) || savedTime;
                    restoreAndPlay(currentLatestTime);
                    document.removeEventListener('click', playOnInteraction);
                    document.removeEventListener('touchstart', playOnInteraction);
                    document.removeEventListener('keydown', playOnInteraction);
                };

                document.addEventListener('click', playOnInteraction);
                document.addEventListener('touchstart', playOnInteraction);
                document.addEventListener('keydown', playOnInteraction);
            }
        });
    }
}

// =============================================
// INPUTS DEL CODIGO
// 4 cajitas, con auto-avance, backspace y paste
// =============================================
function initCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');

    inputs.forEach((input, index) => {
        // Al escribir un caracter, salta al siguiente input
        input.addEventListener('input', (e) => {
            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            e.target.value = value;

            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // Backspace en input vacio regresa al anterior
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Si pegan un codigo completo, lo distribuimos en las 4 cajitas
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

            for (let i = 0; i < Math.min(paste.length, 4); i++) {
                if (inputs[i]) inputs[i].value = paste[i];
            }

            if (paste.length >= 4) inputs[3].focus();
        });
    });

    // Focus en el primer input al cargar
    inputs[0]?.focus();
}

// Llena los inputs si el codigo viene en la URL
function fillCodeFromUrl(code) {
    const inputs = document.querySelectorAll('.code-input');
    for (let i = 0; i < 4; i++) {
        if (inputs[i] && code[i]) inputs[i].value = code[i];
    }
}

// =============================================
// FORMULARIO — verificar codigo
// =============================================
function initForm() {
    const form = document.getElementById('code-form');
    form?.addEventListener('submit', handleCodeSubmit);

    const downloadBtn = document.getElementById('download-btn');
    downloadBtn?.addEventListener('click', downloadInvitation);
}

// Junta los 4 valores de los inputs
function getCode() {
    const inputs = document.querySelectorAll('.code-input');
    return Array.from(inputs).map(i => i.value.toUpperCase()).join('');
}

// Al enviar el codigo, lo buscamos en Supabase
async function handleCodeSubmit(e) {
    e.preventDefault();
    const supabase = getSupabase();

    const code = getCode();
    const errorEl = document.getElementById('error-message');
    const btn = document.querySelector('.submit-btn');

    if (code.length !== 4) {
        showError('Por favor ingresa los 4 caracteres del código');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>Verificando...</span>';
    errorEl.classList.add('hidden');

    try {
        // Buscamos el pase con esa clave
        const { data: pass, error } = await supabase
            .from('guest_passes')
            .select(`*, tables (table_number)`)
            .eq('access_code', code)
            .single();

        if (error || !pass) {
            throw new Error('Código no válido. Verifica e intenta nuevamente.');
        }

        currentPass = pass;
        const alreadyConfirmed = pass.confirmed;

        // Si es la primera vez, lo marcamos como confirmado
        if (!alreadyConfirmed) {
            await supabase
                .from('guest_passes')
                .update({ confirmed: true, confirmed_at: new Date().toISOString() })
                .eq('id', pass.id);
        }

        // Registramos que descargo/vio su invitacion
        await supabase
            .from('invitation_downloads')
            .insert({ guest_pass_id: pass.id });

        // Pasamos al paso 2 con la info de su pase
        showConfirmation(pass, alreadyConfirmed);

    } catch (error) {
        showError(error.message);
        btn.disabled = false;
        btn.innerHTML = '<span>Verificar Código</span>';
    }
}

// Muestra mensaje de error debajo del form
function showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

// =============================================
// PASO 2 — Ya confirmo, mostramos su info y QR
// =============================================
async function showConfirmation(pass, alreadyConfirmed = false) {
    const tableNum = pass.tables?.table_number || '-';

    // Cambiamos el mensaje segun si ya habia confirmado o es primera vez
    const successIcon = document.querySelector('.success-icon');
    const headerTitle = document.querySelector('#step-confirm h1');

    if (alreadyConfirmed) {
        if (successIcon) successIcon.textContent = '✓';
        if (headerTitle) headerTitle.innerHTML = '¡Ya confirmaste!<br><small style="font-size: 0.5em; color: var(--text-muted);">Tu código QR sigue siendo válido</small>';
    } else {
        if (successIcon) successIcon.textContent = '✓';
        if (headerTitle) headerTitle.textContent = '¡Confirmado!';
    }

    // Llenamos la info del invitado
    document.getElementById('display-family').textContent = pass.family_name;
    document.getElementById('display-guests').textContent = `${pass.total_guests} persona${pass.total_guests > 1 ? 's' : ''}`;
    document.getElementById('display-table').textContent = `Mesa ${tableNum}`;

    // Llenamos el template de la invitacion descargable
    document.getElementById('inv-family').textContent = pass.family_name;
    document.getElementById('inv-guests').textContent = pass.total_guests;
    document.getElementById('inv-table').textContent = tableNum;
    document.getElementById('inv-code').textContent = pass.access_code;

    // Generamos el QR y la preview
    await generateQRCode(pass.access_code);
    await generatePreview();

    // Cambiamos de vista (paso 1 -> paso 2)
    document.getElementById('step-code').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
}

// =============================================
// GENERACION DE QR
// =============================================
async function generateQRCode(code) {
    const qrContainer = document.getElementById('qr-canvas');
    qrContainer.innerHTML = '';

    try {
        new QRCode(qrContainer, {
            text: code,
            width: 180,
            height: 180,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (error) {
        console.error('Error generating QR:', error);
    }
}

// =============================================
// PREVIEW — muestra como se vera la invitacion
// =============================================
async function generatePreview() {
    const template = document.querySelector('.invitation-card');
    const preview = document.getElementById('invitation-preview');

    try {
        // Movemos el template a un lugar visible temporalmente para capturarlo
        const templateContainer = document.getElementById('invitation-template');
        templateContainer.style.left = '0';
        templateContainer.style.position = 'absolute';
        templateContainer.style.visibility = 'visible';

        const canvas = await html2canvas(template, {
            scale: 2,
            backgroundColor: null,
            useCORS: true
        });

        // Lo regresamos a donde estaba (fuera de pantalla)
        templateContainer.style.left = '-9999px';
        templateContainer.style.position = 'fixed';
        templateContainer.style.visibility = 'hidden';

        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.alt = 'Vista previa de tu invitación';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';

        preview.innerHTML = '';
        preview.appendChild(img);

    } catch (error) {
        console.error('Error generating preview:', error);
        preview.innerHTML = '<p style="color: var(--text-muted); padding: 2rem;">Vista previa no disponible</p>';
    }
}

// =============================================
// DESCARGA DE INVITACION
// Genera una imagen PNG de alta calidad de la invitacion
// =============================================
async function downloadInvitation() {
    if (!currentPass) return;

    const btn = document.getElementById('download-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>Generando...</span>';

    try {
        const template = document.querySelector('.invitation-card');
        const templateContainer = document.getElementById('invitation-template');

        // Hacemos visible para capturar
        templateContainer.style.left = '0';
        templateContainer.style.position = 'absolute';
        templateContainer.style.visibility = 'visible';

        const canvas = await html2canvas(template, {
            scale: 3, // alta calidad para que se vea bien al imprimir
            backgroundColor: null,
            useCORS: true
        });

        // Regresamos a su lugar
        templateContainer.style.left = '-9999px';
        templateContainer.style.position = 'fixed';
        templateContainer.style.visibility = 'hidden';

        // Creamos el link de descarga
        const link = document.createElement('a');
        link.download = `Invitacion-${currentPass.family_name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

        // Feedback visual de que se descargo
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>¡Descargado!</span>
        `;

        // Despues de 3 segundos volvemos al boton normal
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Descargar Invitación con QR</span>
            `;
        }, 3000);

    } catch (error) {
        console.error('Error downloading:', error);
        btn.disabled = false;
        btn.innerHTML = '<span>Error - Intenta de nuevo</span>';
    }
}
