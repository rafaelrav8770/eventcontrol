// Confirm Page Module
// Get Supabase client from window
function getSupabase() {
    return window.supabaseClient;
}

// State
let currentPass = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initBackgroundMusic();
    initCodeInputs();
    initForm();

    // Check for code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl && codeFromUrl.length === 4) {
        fillCodeFromUrl(codeFromUrl.toUpperCase());
    }
});

// Initialize background music - continues from exactly where it was on main page
function initBackgroundMusic() {
    const music = document.getElementById('background-music');
    if (!music) return;

    music.volume = 0.5;

    // Restore music position from localStorage (saved from main page)
    const savedTime = parseFloat(localStorage.getItem('musicTime')) || 0;
    const wasPlaying = localStorage.getItem('musicPlaying') === 'true';

    // Function to start saving music time periodically
    let savingInterval = null;
    const startSavingTime = () => {
        if (savingInterval) return; // Already saving
        savingInterval = setInterval(() => {
            if (!music.paused) {
                localStorage.setItem('musicTime', music.currentTime);
                localStorage.setItem('musicPlaying', 'true');
            }
        }, 500);
    };

    // Function to restore position and play music
    const restoreAndPlay = (targetTime) => {
        return new Promise((resolve) => {
            if (targetTime > 0) {
                // Wait for audio to be ready, then set position
                const setPosition = () => {
                    music.currentTime = targetTime;
                    // Wait for seeked event to confirm position was set
                    const onSeeked = () => {
                        music.removeEventListener('seeked', onSeeked);
                        music.play().then(() => {
                            startSavingTime();
                            resolve(true);
                        }).catch((e) => {
                            console.log('Play after seek failed:', e);
                            resolve(false);
                        });
                    };
                    music.addEventListener('seeked', onSeeked);
                };

                // Check if audio is ready
                if (music.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                    setPosition();
                } else {
                    // Wait for audio to load enough data
                    music.addEventListener('canplay', () => setPosition(), { once: true });
                }
            } else {
                // No saved position, just play from start
                music.play().then(() => {
                    startSavingTime();
                    resolve(true);
                }).catch((e) => {
                    console.log('Play failed:', e);
                    resolve(false);
                });
            }
        });
    };

    // Try to play with restored position
    if (wasPlaying) {
        const latestTime = parseFloat(localStorage.getItem('musicTime')) || savedTime;
        restoreAndPlay(latestTime).then((success) => {
            if (!success) {
                // If autoplay is blocked, play on first user interaction
                const playOnInteraction = () => {
                    // Get the latest saved time before playing
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

// Initialize code input behavior
function initCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');

    inputs.forEach((input, index) => {
        // Auto-focus next on input
        input.addEventListener('input', (e) => {
            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            e.target.value = value;

            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

            for (let i = 0; i < Math.min(paste.length, 4); i++) {
                if (inputs[i]) {
                    inputs[i].value = paste[i];
                }
            }

            if (paste.length >= 4) {
                inputs[3].focus();
            }
        });
    });

    // Focus first input
    inputs[0]?.focus();
}

// Fill code from URL parameter
function fillCodeFromUrl(code) {
    const inputs = document.querySelectorAll('.code-input');
    for (let i = 0; i < 4; i++) {
        if (inputs[i] && code[i]) {
            inputs[i].value = code[i];
        }
    }
}

// Initialize form
function initForm() {
    const form = document.getElementById('code-form');
    form?.addEventListener('submit', handleCodeSubmit);

    const downloadBtn = document.getElementById('download-btn');
    downloadBtn?.addEventListener('click', downloadInvitation);
}

// Get code from inputs
function getCode() {
    const inputs = document.querySelectorAll('.code-input');
    return Array.from(inputs).map(i => i.value.toUpperCase()).join('');
}

// Handle code submission
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
        // Fetch pass from database
        const { data: pass, error } = await supabase
            .from('guest_passes')
            .select(`*, tables (table_number)`)
            .eq('access_code', code)
            .single();

        if (error || !pass) {
            throw new Error('Código no válido. Verifica e intenta nuevamente.');
        }

        currentPass = pass;

        // Check if already confirmed
        const alreadyConfirmed = pass.confirmed;

        // Mark as confirmed if not already
        if (!alreadyConfirmed) {
            await supabase
                .from('guest_passes')
                .update({
                    confirmed: true,
                    confirmed_at: new Date().toISOString()
                })
                .eq('id', pass.id);
        }

        // Log the download intent
        await supabase
            .from('invitation_downloads')
            .insert({
                guest_pass_id: pass.id
            });

        // Show confirmation step with already confirmed flag
        showConfirmation(pass, alreadyConfirmed);

    } catch (error) {
        showError(error.message);
        btn.disabled = false;
        btn.innerHTML = '<span>Verificar Código</span>';
    }
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

// Show confirmation step
async function showConfirmation(pass, alreadyConfirmed = false) {
    const tableNum = pass.tables?.table_number || '-';

    // Update header based on confirmation status
    const successIcon = document.querySelector('.success-icon');
    const headerTitle = document.querySelector('#step-confirm h1');

    if (alreadyConfirmed) {
        // Already confirmed before - show different message
        if (successIcon) successIcon.textContent = '✓';
        if (headerTitle) headerTitle.innerHTML = '¡Ya confirmaste!<br><small style="font-size: 0.5em; color: var(--text-muted);">Tu código QR sigue siendo válido</small>';
    } else {
        // First time confirmation
        if (successIcon) successIcon.textContent = '✓';
        if (headerTitle) headerTitle.textContent = '¡Confirmado!';
    }

    // Update display
    document.getElementById('display-family').textContent = pass.family_name;
    document.getElementById('display-guests').textContent = `${pass.total_guests} persona${pass.total_guests > 1 ? 's' : ''}`;
    document.getElementById('display-table').textContent = `Mesa ${tableNum}`;

    // Update invitation template
    document.getElementById('inv-family').textContent = pass.family_name;
    document.getElementById('inv-guests').textContent = pass.total_guests;
    document.getElementById('inv-table').textContent = tableNum;
    document.getElementById('inv-code').textContent = pass.access_code;

    // Generate QR code
    await generateQRCode(pass.access_code);

    // Generate preview
    await generatePreview();

    // Switch views
    document.getElementById('step-code').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
}

// Generate QR Code
async function generateQRCode(code) {
    const qrContainer = document.getElementById('qr-canvas');

    // Clear previous QR if exists
    qrContainer.innerHTML = '';

    try {
        // qrcodejs uses a different API - creates QR in a div/canvas element
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

// Generate preview image
async function generatePreview() {
    const template = document.querySelector('.invitation-card');
    const preview = document.getElementById('invitation-preview');

    try {
        // Move template to visible area temporarily
        const templateContainer = document.getElementById('invitation-template');
        templateContainer.style.left = '0';
        templateContainer.style.position = 'absolute';
        templateContainer.style.visibility = 'visible';

        const canvas = await html2canvas(template, {
            scale: 2,
            backgroundColor: null,
            useCORS: true
        });

        // Reset template position
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

// Download invitation
async function downloadInvitation() {
    if (!currentPass) return;

    const btn = document.getElementById('download-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>Generando...</span>';

    try {
        const template = document.querySelector('.invitation-card');
        const templateContainer = document.getElementById('invitation-template');

        // Make visible for capture
        templateContainer.style.left = '0';
        templateContainer.style.position = 'absolute';
        templateContainer.style.visibility = 'visible';

        const canvas = await html2canvas(template, {
            scale: 3, // High quality
            backgroundColor: null,
            useCORS: true
        });

        // Reset
        templateContainer.style.left = '-9999px';
        templateContainer.style.position = 'fixed';
        templateContainer.style.visibility = 'hidden';

        // Create download link
        const link = document.createElement('a');
        link.download = `Invitacion-${currentPass.family_name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>¡Descargado!</span>
        `;

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
