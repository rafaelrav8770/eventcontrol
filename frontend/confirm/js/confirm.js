// confirm.js
// logica de la pagina de confirmacion de asistencia
// aqui el invitado mete su codigo de 4 digitos que le dieron,
// lo validamos contra la base de datos de supabase,
// si es valido le mostramos su informacion y generamos su QR
// tambien le dejamos descargar su invitacion como imagen

// traemos el cliente de supabase que ya se inicio en supabase-config.js
const supabaseClient = window.supabaseClient;

// variables globales para el pase actual y la config del evento
let currentPass = null;
let currentEventConfig = null;

// -------------------------------------------
// INICIALIZACION
// se ejecuta cuando carga la pagina
// -------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // checamos si el codigo viene en la URL como parametro
    // ejemplo: /confirm/?code=A3X7
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');

    // cargamos los detalles del evento (fecha, salon, etc)
    await loadEventDetails();

    // si el codigo venia en la URL lo ponemos automaticamente en los inputs
    if (codeParam) {
        const inputs = document.querySelectorAll('.code-input');
        const chars = codeParam.toUpperCase().split('');
        chars.forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
        });
        // y verificamos automaticamente
        checkCode(codeParam.toUpperCase());
    }

    // configuramos los inputs del codigo
    // cada input es de un solo caracter y al escribir avanza al siguiente
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            // convertimos a mayusculas automaticamente
            const val = e.target.value.toUpperCase();
            e.target.value = val;

            // avanzamos al siguiente input si escribio algo
            if (val && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }

            // si ya estan los 4 digitos verificamos de una
            const fullCode = Array.from(inputs).map(i => i.value).join('');
            if (fullCode.length === 4) {
                checkCode(fullCode);
            }
        });

        // si le da backspace y el input esta vacio, regresamos al anterior
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    // por si le dan submit al formulario manualmente (con Enter)
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

// -------------------------------------------
// CARGAR CONFIGURACION DEL EVENTO
// -------------------------------------------
async function loadEventDetails() {
    try {
        // traemos la configuracion del evento de supabase
        const { data, error } = await supabaseClient
            .from('configuracion_evento')
            .select('*')
            .limit(1)
            .single();

        if (data) {
            currentEventConfig = data;
            updateEventUI(data); // actualizamos la interfaz con los datos
        }
    } catch (e) {
        console.error('Error loading event details', e);
    }
}

// actualiza la interfaz con los datos del evento
// por ahorita la fecha esta en el HTML directo pero se podria hacer dinamico
function updateEventUI(config) {
    // TODO: hacer que la fecha se ponga dinamicamente desde la config
}

// -------------------------------------------
// VERIFICAR EL CODIGO DEL INVITADO
// -------------------------------------------
async function checkCode(code) {
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.querySelector('.submit-btn');

    // ponemos el boton en estado de carga
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Verificando...</span>';
    }
    if (errorEl) errorEl.classList.add('hidden');

    try {
        // buscamos el pase en la base de datos por su codigo
        const { data: pass, error } = await supabaseClient
            .from('pases_invitados')
            .select(`*, mesas (numero_mesa)`)
            .eq('codigo_acceso', code)
            .single();

        // restauramos el boton
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Verificar Código</span>';
        }

        // si no se encontro el pase mostramos error
        if (error || !pass) {
            showError('Código no encontrado. Por favor verifica.');
            return;
        }

        // si si lo encontramos guardamos el pase y mostramos la info
        currentPass = pass;
        showSuccess(pass);
        generateQRCode(code); // generamos el QR con el codigo

        // si todavia no habia confirmado su asistencia la marcamos automaticamente
        if (!pass.confirmado) {
            confirmGuest(pass.id);
        }

    } catch (err) {
        // si hubo algun error restauramos el boton
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Verificar Código</span>';
        }
        console.error(err);
        showError('Hubo un error al verificar. Intenta de nuevo.');
    }
}

// marca al invitado como confirmado en la base de datos
async function confirmGuest(passId) {
    await supabaseClient
        .from('pases_invitados')
        .update({
            confirmado: true,
            confirmado_en: new Date().toISOString()
        })
        .eq('id', passId);
}

// -------------------------------------------
// MOSTRAR RESULTADOS EN PANTALLA
// -------------------------------------------

// muestra un mensaje de error debajo del formulario
function showError(msg) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }
}

// muestra la informacion del invitado en la tarjeta de confirmacion
function showSuccess(pass) {
    const tableNum = pass.mesas?.numero_mesa || 'Por asignar';

    // ponemos los datos en la tarjeta de exito
    const familyEl = document.getElementById('display-family');
    const guestsEl = document.getElementById('display-guests');
    const tableEl = document.getElementById('display-table');

    if (familyEl) familyEl.textContent = pass.nombre_familia;
    if (guestsEl) guestsEl.textContent = `${pass.total_invitados} persona${pass.total_invitados > 1 ? 's' : ''}`;
    if (tableEl) tableEl.textContent = `Mesa ${tableNum}`;

    // tambien llenamos los datos del template de la invitacion
    // (la imagen que se descarga)
    const invFamily = document.getElementById('inv-family');
    const invGuests = document.getElementById('inv-guests');
    const invTable = document.getElementById('inv-table');
    const invCode = document.getElementById('inv-code');

    if (invFamily) invFamily.textContent = pass.nombre_familia;
    if (invGuests) invGuests.textContent = pass.total_invitados;
    if (invTable) invTable.textContent = tableNum;
    if (invCode) invCode.textContent = pass.codigo_acceso;

    // ocultamos el formulario del codigo y mostramos la confirmacion
    const stepCode = document.getElementById('step-code');
    const stepConfirm = document.getElementById('step-confirm');

    if (stepCode) stepCode.classList.add('hidden');
    if (stepConfirm) stepConfirm.classList.remove('hidden');
}

// -------------------------------------------
// GENERACION DEL CODIGO QR
// usamos la libreria QRCode.js para generar el QR
// -------------------------------------------
function generateQRCode(text) {
    // esperamos un poquito a que el DOM se actualice
    setTimeout(() => {
        const container = document.getElementById('qr-canvas');
        if (!container) return;

        container.innerHTML = ''; // limpiamos el contenedor
        new QRCode(container, {
            text: text,
            width: 128,
            height: 128,
            colorDark: "#2c3e50",     // color del QR (azul oscuro)
            colorLight: "#ffffff",     // fondo blanco
            correctLevel: QRCode.CorrectLevel.H  // nivel de correccion alto
        });
    }, 100);
}

// -------------------------------------------
// FUNCION PARA DESCARGAR LA INVITACION COMO IMAGEN
// usa html2canvas para capturar el template y guardarlo como PNG
// -------------------------------------------
window.downloadInvitation = async function () {
    const card = document.getElementById('invitation-template');
    if (!card) return;

    // ponemos el template visible pero fuera de la pantalla
    // para que html2canvas pueda capturarlo sin que el usuario lo vea
    card.style.position = 'fixed';
    card.style.left = '-9999px';
    card.style.display = 'block';

    try {
        // cambiamos el texto del boton mientras genera
        const btn = document.getElementById('download-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Generando...</span>';
        btn.disabled = true;

        // registramos la descarga en la base de datos (para estadisticas)
        if (currentPass) {
            await supabaseClient.from('descargas_invitacion').insert({ pase_id: currentPass.id });
        }

        // capturamos el template como canvas
        const canvas = await html2canvas(card, {
            scale: 2,              // doble resolucion para que se vea bien
            backgroundColor: null,  // fondo transparente
            logging: false          // sin logs en consola
        });

        // escondemos el template otra vez
        card.style.display = '';
        card.style.position = '';
        card.style.left = '';

        // creamos un link de descarga y lo clickeamos automaticamente
        const link = document.createElement('a');
        link.download = `Invitacion_Boda_${currentPass.nombre_familia.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // restauramos el boton
        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (err) {
        // si fallo escondemos el template de todas formas
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
