// Usamos el cliente compartido creado por supabase-config.js
const supabaseClient = window.supabaseClient;

// State
let currentPass = null;
let currentEventConfig = null;

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Check if code is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');

    await loadEventDetails();

    if (codeParam) {
        // Auto-fill code inputs from URL
        const inputs = document.querySelectorAll('.code-input');
        const chars = codeParam.toUpperCase().split('');
        chars.forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
        });
        checkCode(codeParam.toUpperCase());
    }

    // Code input auto-advance and auto-submit
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.toUpperCase();
            e.target.value = val;

            if (val && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }

            // Check if all 4 inputs are filled
            const fullCode = Array.from(inputs).map(i => i.value).join('');
            if (fullCode.length === 4) {
                checkCode(fullCode);
            }
        });

        // Handle backspace to go to previous input
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    // Form submit
    const codeForm = document.getElementById('code-form');
    if (codeForm) {
        codeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fullCode = Array.from(inputs).map(i => i.value).join('').toUpperCase();
            if (fullCode.length === 4) {
                checkCode(fullCode);
            }
        });
    }
});

// =============================================
// LOAD EVENT DETAILS
// =============================================
async function loadEventDetails() {
    try {
        const { data, error } = await supabaseClient
            .from('configuracion_evento')
            .select('*')
            .limit(1)
            .single();

        if (data) {
            currentEventConfig = data;
            updateEventUI(data);
        }
    } catch (e) {
        console.error('Error loading event details', e);
    }
}

function updateEventUI(config) {
    // Update date/time if needed (currently static in HTML)
    // const dateEl = document.querySelector('.event-date');
    // if (dateEl && config.fecha_evento) {
    //     ...
    // }
}

// =============================================
// CHECK CODE
// =============================================
async function checkCode(code) {
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.querySelector('.submit-btn');

    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Verificando...</span>';
    }
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const { data: pass, error } = await supabaseClient
            .from('pases_invitados')
            .select(`*, mesas (numero_mesa)`)
            .eq('codigo_acceso', code)
            .single();

        // Reset button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Verificar Código</span>';
        }

        if (error || !pass) {
            showError('Código no encontrado. Por favor verifica.');
            return;
        }

        currentPass = pass;
        showSuccess(pass);
        generateQRCode(code);

        // Auto-confirm if not confirmed
        if (!pass.confirmado) {
            confirmGuest(pass.id);
        }

    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Verificar Código</span>';
        }
        console.error(err);
        showError('Hubo un error al verificar. Intenta de nuevo.');
    }
}

async function confirmGuest(passId) {
    await supabaseClient
        .from('pases_invitados')
        .update({
            confirmado: true,
            confirmado_en: new Date().toISOString()
        })
        .eq('id', passId);
}

// =============================================
// RENDER UI
// =============================================
function showError(msg) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }
}

function showSuccess(pass) {
    const tableNum = pass.mesas?.numero_mesa || 'Por asignar';

    // Update step-confirm display elements
    const familyEl = document.getElementById('display-family');
    const guestsEl = document.getElementById('display-guests');
    const tableEl = document.getElementById('display-table');

    if (familyEl) familyEl.textContent = pass.nombre_familia;
    if (guestsEl) guestsEl.textContent = `${pass.total_invitados} persona${pass.total_invitados > 1 ? 's' : ''}`;
    if (tableEl) tableEl.textContent = `Mesa ${tableNum}`;

    // Update invitation template elements
    const invFamily = document.getElementById('inv-family');
    const invGuests = document.getElementById('inv-guests');
    const invTable = document.getElementById('inv-table');
    const invCode = document.getElementById('inv-code');

    if (invFamily) invFamily.textContent = pass.nombre_familia;
    if (invGuests) invGuests.textContent = pass.total_invitados;
    if (invTable) invTable.textContent = tableNum;
    if (invCode) invCode.textContent = pass.codigo_acceso;

    // Switch from step-code to step-confirm
    const stepCode = document.getElementById('step-code');
    const stepConfirm = document.getElementById('step-confirm');

    if (stepCode) stepCode.classList.add('hidden');
    if (stepConfirm) stepConfirm.classList.remove('hidden');
}

// =============================================
// QR GENERATION
// =============================================
function generateQRCode(text) {
    // Wait for DOM to update after switching steps
    setTimeout(() => {
        const container = document.getElementById('qr-canvas');
        if (!container) return;

        container.innerHTML = '';
        new QRCode(container, {
            text: text,
            width: 128,
            height: 128,
            colorDark: "#2c3e50",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }, 100);
}

// =============================================
// DOWNLOAD IMAGE
// =============================================
window.downloadInvitation = async function () {
    const card = document.getElementById('invitation-template');
    if (!card) return;

    // Temporarily make it visible for rendering
    card.style.position = 'fixed';
    card.style.left = '-9999px';
    card.style.display = 'block';

    try {
        const btn = document.getElementById('download-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Generando...</span>';
        btn.disabled = true;

        // Log download
        if (currentPass) {
            await supabaseClient.from('descargas_invitacion').insert({ pase_id: currentPass.id });
        }

        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: null,
            logging: false
        });

        // Hide the template again
        card.style.display = '';
        card.style.position = '';
        card.style.left = '';

        const link = document.createElement('a');
        link.download = `Invitacion_Boda_${currentPass.nombre_familia.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (err) {
        // Hide the template on error too
        card.style.display = '';
        card.style.position = '';
        card.style.left = '';

        console.error(err);
        alert('No se pudo descargar la imagen. Puedes tomar una captura de pantalla.');
        const btn = document.getElementById('download-btn');
        if (btn) {
            btn.innerHTML = '<span>Error al descargar</span>';
            btn.disabled = false;
        }
    }
};
