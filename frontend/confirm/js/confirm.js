// confirm.js — logica de confirmacion de asistencia
// el invitado mete su codigo de 4 digitos, lo validamos contra supabase,
// le mostramos su info, generamos QR y le dejamos bajar su invitacion

const supabaseClient = window.supabaseClient;

// estado global del invitado actual y config del evento
let currentPass = null;
let currentEventConfig = null;

// =============================================
// INICIALIZACION
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    // ver si el codigo viene en la URL (ej: ?code=A3X7)
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');

    await loadEventDetails();

    if (codeParam) {
        // auto-rellenar los inputs con el codigo de la URL
        const inputs = document.querySelectorAll('.code-input');
        const chars = codeParam.toUpperCase().split('');
        chars.forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
        });
        checkCode(codeParam.toUpperCase());
    }

    // cada input avanza al siguiente al escribir, y al tener 4 digitos verifica
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.toUpperCase();
            e.target.value = val;

            if (val && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }

            // si ya estan los 4 digitos, verificamos automaticamente
            const fullCode = Array.from(inputs).map(i => i.value).join('');
            if (fullCode.length === 4) {
                checkCode(fullCode);
            }
        });

        // backspace te regresa al input anterior
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    // por si le dan submit al form manualmente
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
// CARGAR CONFIG DEL EVENTO
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
    // por ahora la fecha esta hardcodeada en el HTML, pero se puede hacer dinamica
    // const dateEl = document.querySelector('.event-date');
    // if (dateEl && config.fecha_evento) {
    //     ...
    // }
}

// =============================================
// VERIFICAR CODIGO
// =============================================
async function checkCode(code) {
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.querySelector('.submit-btn');

    // poner el boton en modo "cargando"
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

        // restaurar el boton
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

        // si aun no ha confirmado, lo marcamos como confirmado automaticamente
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
// MOSTRAR RESULTADO EN PANTALLA
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

    // poner los datos del invitado en la tarjeta de confirmacion
    const familyEl = document.getElementById('display-family');
    const guestsEl = document.getElementById('display-guests');
    const tableEl = document.getElementById('display-table');

    if (familyEl) familyEl.textContent = pass.nombre_familia;
    if (guestsEl) guestsEl.textContent = `${pass.total_invitados} persona${pass.total_invitados > 1 ? 's' : ''}`;
    if (tableEl) tableEl.textContent = `Mesa ${tableNum}`;

    // tambien llenar el template de la invitacion (para la descarga)
    const invFamily = document.getElementById('inv-family');
    const invGuests = document.getElementById('inv-guests');
    const invTable = document.getElementById('inv-table');
    const invCode = document.getElementById('inv-code');

    if (invFamily) invFamily.textContent = pass.nombre_familia;
    if (invGuests) invGuests.textContent = pass.total_invitados;
    if (invTable) invTable.textContent = tableNum;
    if (invCode) invCode.textContent = pass.codigo_acceso;

    // cambiar de pantalla: ocultar el form y mostrar la confirmacion
    const stepCode = document.getElementById('step-code');
    const stepConfirm = document.getElementById('step-confirm');

    if (stepCode) stepCode.classList.add('hidden');
    if (stepConfirm) stepConfirm.classList.remove('hidden');
}

// =============================================
// GENERACION DE QR
// =============================================
function generateQRCode(text) {
    // esperamos tantito a que el DOM se actualice antes de generar el QR
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
// DESCARGAR INVITACION COMO IMAGEN
// =============================================
window.downloadInvitation = async function () {
    const card = document.getElementById('invitation-template');
    if (!card) return;

    // lo ponemos visible pero fuera de pantalla para que html2canvas lo capture
    card.style.position = 'fixed';
    card.style.left = '-9999px';
    card.style.display = 'block';

    try {
        const btn = document.getElementById('download-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Generando...</span>';
        btn.disabled = true;

        // registrar la descarga en la base de datos
        if (currentPass) {
            await supabaseClient.from('descargas_invitacion').insert({ pase_id: currentPass.id });
        }

        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: null,
            logging: false
        });

        // esconder el template otra vez
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
        // si truena, igual escondemos el template
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
