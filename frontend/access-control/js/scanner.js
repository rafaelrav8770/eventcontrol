// scanner.js
// Control de acceso / Escaner de codigos QR
// este archivo maneja todo lo del punto de entrada al evento:
// - el escaneo de QR con la camara del celular
// - la busqueda manual por codigo
// - la verificacion del pase contra la base de datos
// - el registro de entradas (cuantas personas entraron)
// - las estadisticas en tiempo real (cuantos adentro, cuantos faltan)
//
// usa la libreria Html5Qrcode para la camara

// variables globales del escaner
let scanner = null;          // instancia del escaner QR
let guestPasses = [];        // lista de pases cargados
let supabaseInstance = null;  // referencia a supabase
let lastScannedCode = null;  // ultimo codigo escaneado (para evitar duplicados)
let isProcessing = false;    // bandera para evitar procesar dos codigos a la vez
let currentUser = null;       // usuario logueado (el de recepcion)

// creamos un contexto de audio para reproducir sonidos
// estos sonidos sirven para confirmar si el escaneo fue exitoso o no
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// funcion que reproduce un beep
// si es success suena agudo y corto, si es error suena grave y largo
function playBeep(type = 'success') {
    // por si el navegador tiene el audio suspendido
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // creamos un oscilador (genera la onda de sonido)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain(); // para controlar el volumen

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
        // sonido de exito: onda senoidal, sube de 800 a 1200 Hz rapidamente
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } else {
        // sonido de error: onda sawtooth, baja de 200 a 150 Hz lentamente
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// funcion principal que inicializa todo el scanner
async function initScanner() {
    try {
        // obtenemos la instancia de supabase
        supabaseInstance = window.supabaseClient;

        if (!supabaseInstance) {
            console.error('Supabase no inicializado');
            showToast('Error: Supabase no conectado', 'error');
            return;
        }

        // verificamos que el usuario este autenticado
        // si no esta logueado lo mandamos al login
        const { data: { session } } = await supabaseInstance.auth.getSession();
        if (!session) {
            window.location.href = '/admin/index.html';
            return;
        }
        currentUser = session.user;

        // cargamos los datos de los pases
        await loadData();

        // nos suscribimos a cambios en tiempo real
        initRealtime();

        // arrancamos el escaner de QR
        startScanner();

    } catch (error) {
        console.error('Error initializing:', error);
        showToast('Error al iniciar la aplicación', 'error');
    }
}

// carga los pases que ya estan confirmados desde supabase
// solo trae los confirmados porque esos son los que pueden ingresar
async function loadData() {
    try {
        const { data, error } = await supabaseInstance
            .from('pases_invitados')
            .select(`*, mesas (numero_mesa)`)
            .eq('confirmado', true);

        if (error) throw error;

        guestPasses = data || [];
        updateStats();       // actualizamos los contadores
        renderEntryLog();    // mostramos las entradas recientes
        renderPendingList(); // mostramos los pendientes
        console.log('Pases cargados:', guestPasses.length);

    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error al cargar datos', 'error');
    }
}

// nos suscribimos a cambios en tiempo real de la tabla pases_invitados
// asi cuando alguien actualiza algo desde el dashboard se refleja aqui
function initRealtime() {
    supabaseInstance.channel('scanner_updates')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'pases_invitados' },
            payload => {
                console.log('Update received:', payload);
                loadData(); // recargamos los datos cuando hay cambios
            }
        )
        .subscribe();
}

// inicia la camara y el escaner de QR
// usa la libreria Html5Qrcode
function startScanner() {
    const readerEl = document.getElementById('qr-reader');
    if (!readerEl) return;

    scanner = new Html5Qrcode("qr-reader");

    // configuracion del escaner
    const config = {
        fps: 10,                            // frames por segundo
        qrbox: { width: 250, height: 250 }, // tamaño del area de escaneo
        aspectRatio: 1.0                     // relacion de aspecto cuadrada
    };

    // iniciamos el escaner usando la camara trasera
    scanner.start(
        { facingMode: "environment" },  // camara trasera del celular
        config,
        onScanSuccess,   // callback cuando se lee un QR
        onScanFailure    // callback cuando falla (es normal, pasa todo el tiempo)
    ).catch(err => {
        // si no se pudo iniciar la camara mostramos un mensaje
        console.error('Error starting scanner:', err);
        readerEl.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--error, #ff6b6b);">
                <p>No se pudo iniciar la cámara.</p>
                <p>Verifica los permisos y que estés usando HTTPS.</p>
                <button onclick="startScanner()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">Intentar de nuevo</button>
            </div>
        `;
    });
}

// se ejecuta cada vez que el escaner lee un QR exitosamente
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return; // si ya estamos procesando otro ignoramos

    // debounce: si es el mismo codigo que acabamos de escanear lo ignoramos
    // para evitar que se registre doble
    if (decodedText === lastScannedCode) {
        setTimeout(() => lastScannedCode = null, 3000);
        return;
    }

    lastScannedCode = decodedText;
    processCode(decodedText);
}

// esta funcion se llama constantemente cuando no hay QR
// no hacemos nada, es normal
function onScanFailure(error) {
    // silencioso, pasa todo el rato mientras no haya QR enfrente
}

// busqueda manual: el usuario escribe el codigo a mano
function searchByCode() {
    const input = document.getElementById('manual-code');
    if (!input) return;

    const code = input.value.trim().toUpperCase(); // convertimos a mayusculas
    if (!code) return;

    processCode(code);
}
// la hacemos global para poder llamarla desde el HTML
window.searchByCode = searchByCode;

// procesa un codigo (ya sea escaneado por QR o ingresado manualmente)
// busca el pase, verifica si es valido y muestra el resultado
async function processCode(code) {
    isProcessing = true;

    // buscamos el pase en el arreglo local
    const pass = guestPasses.find(p => p.codigo_acceso === code);

    if (!pass) {
        // no se encontro el pase — codigo invalido
        showGuestNotFound();
        playBeep('error');
        isProcessing = false;
        return;
    }

    // si ya entraron todos los invitados del pase
    if (pass.todos_ingresaron) {
        showAlreadyUsed(pass);
        playBeep('error');
    } else {
        // pase valido y aun tiene entradas disponibles
        showGuestInfo(pass);
        playBeep('success');
    }

    isProcessing = false;
}

// muestra la informacion del invitado cuando el pase es valido
function showGuestInfo(pass) {
    const guestInfo = document.getElementById('guest-info');
    const noGuest = document.getElementById('no-guest');

    if (!guestInfo) return;

    // mostramos el panel de info y ocultamos el placeholder
    guestInfo.style.display = 'block';
    if (noGuest) noGuest.style.display = 'none';

    const tableNum = pass.mesas?.numero_mesa || 'Sin Asignar';
    const remaining = pass.total_invitados - pass.invitados_ingresados;

    // llenamos los campos con la informacion del pase
    document.getElementById('info-family').textContent = pass.nombre_familia;
    document.getElementById('info-code').textContent = pass.codigo_acceso;
    document.getElementById('info-total').textContent = pass.total_invitados;
    document.getElementById('info-inside').textContent = pass.invitados_ingresados;
    document.getElementById('info-remaining').textContent = remaining;
    document.getElementById('info-table').textContent = tableNum;

    // configuramos el input de cuantos invitados van a entrar
    const enteringInput = document.getElementById('entering-count');
    if (enteringInput) {
        enteringInput.value = 1;         // por default 1
        enteringInput.max = remaining;    // maximo los que faltan
    }

    // guardamos el ID del pase para usar en confirmEntry
    guestInfo.dataset.passId = pass.id;
}

// muestra un mensaje cuando el codigo no se encontro
function showGuestNotFound() {
    const guestInfo = document.getElementById('guest-info');
    const noGuest = document.getElementById('no-guest');

    if (guestInfo) guestInfo.style.display = 'none';
    if (noGuest) {
        noGuest.style.display = 'flex';
        noGuest.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <p style="color: var(--error, #ff6b6b);">Código no válido. No existe en el sistema.</p>
        `;
        // despues de 3 segundos restauramos la vista
        setTimeout(() => resetScannerView(), 3000);
    }

    showToast('Código no válido', 'error');
}

// muestra un mensaje cuando ya entraron todos los del pase
function showAlreadyUsed(pass) {
    const guestInfo = document.getElementById('guest-info');
    const noGuest = document.getElementById('no-guest');

    if (guestInfo) guestInfo.style.display = 'none';
    if (noGuest) {
        noGuest.style.display = 'flex';
        const tableNum = pass.mesas?.numero_mesa || 'Sin Asignar';
        noGuest.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <p style="color: var(--warning, #f0ad4e);">
                <strong>${pass.nombre_familia}</strong> — Ya ingresaron todos (${pass.invitados_ingresados}/${pass.total_invitados}). Mesa ${tableNum}.
            </p>
        `;
        setTimeout(() => resetScannerView(), 4000);
    }

    showToast('Este pase ya completó sus entradas', 'warning');
}

// restaura la vista del escaner a su estado original
// (el icono de camara y el texto de instrucciones)
function resetScannerView() {
    const guestInfo = document.getElementById('guest-info');
    const noGuest = document.getElementById('no-guest');

    if (guestInfo) guestInfo.style.display = 'none';
    if (noGuest) {
        noGuest.style.display = 'flex';
        noGuest.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <p>Escanea un código QR o ingresa el código manualmente</p>
        `;
    }
}

// confirma la entrada de los invitados
// actualiza la base de datos con cuantos entraron
window.confirmEntry = async function () {
    const guestInfo = document.getElementById('guest-info');
    if (!guestInfo) return;

    const passId = guestInfo.dataset.passId;
    const enteringInput = document.getElementById('entering-count');
    const enteringCount = parseInt(enteringInput?.value) || 1;

    // buscamos el pase en el arreglo local
    const pass = guestPasses.find(p => p.id === passId);
    if (!pass) return;

    try {
        // calculamos el nuevo total de personas adentro
        const newTotal = pass.invitados_ingresados + enteringCount;
        const allEntered = newTotal >= pass.total_invitados; // si ya entraron todos

        // paso 1: registramos la entrada en el log de registros
        await supabaseInstance
            .from('registros_entrada')
            .insert({
                pase_id: pass.id,
                invitados_ingresando: enteringCount,
                verificado_por: currentUser.id
            });

        // paso 2: actualizamos el pase con el nuevo conteo
        const { error } = await supabaseInstance
            .from('pases_invitados')
            .update({
                invitados_ingresados: newTotal,
                todos_ingresaron: allEntered
            })
            .eq('id', passId);

        if (error) throw error;

        // todo salio bien, restauramos la vista y recargamos datos
        resetScannerView();
        await loadData();
        showToast(`Entrada registrada: ${enteringCount} persona(s) de ${pass.nombre_familia}`, 'success');
        playBeep('success');

        // limpiamos el input manual por si fue busqueda manual
        const manualInput = document.getElementById('manual-code');
        if (manualInput) manualInput.value = '';

    } catch (error) {
        console.error('Error confirming entry:', error);
        showToast('Error al registrar entrada', 'error');
    }
};

// cancela el proceso de entrada, regresa a la vista normal
window.cancelEntry = function () {
    resetScannerView();
};

// actualiza las estadisticas del panel (esperados, adentro, pendientes)
function updateStats() {
    const total = guestPasses.reduce((sum, p) => sum + p.total_invitados, 0);
    const entered = guestPasses.reduce((sum, p) => sum + p.invitados_ingresados, 0);
    const pending = total - entered;

    // ponemos los numeros en los elementos del HTML
    const statExpected = document.getElementById('stat-expected');
    const statInside = document.getElementById('stat-inside');
    const statPending = document.getElementById('stat-pending');

    if (statExpected) statExpected.textContent = total;
    if (statInside) statInside.textContent = entered;
    if (statPending) statPending.textContent = pending;
}

// renderiza el log de las ultimas entradas registradas
function renderEntryLog() {
    const container = document.getElementById('entry-log');
    if (!container) return;

    // filtramos solo los pases que ya tienen al menos una persona adentro
    const enteredPasses = guestPasses
        .filter(p => p.invitados_ingresados > 0)
        .sort((a, b) => new Date(b.actualizado_en || b.creado_en) - new Date(a.actualizado_en || a.creado_en));

    if (enteredPasses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted, #999); text-align: center; padding: 1rem;">Sin entradas registradas aún</p>';
        return;
    }

    // mostramos los ultimos 10
    container.innerHTML = enteredPasses.slice(0, 10).map(pass => {
        const tableNum = pass.mesas?.numero_mesa || '—';
        return `
            <div class="entry-item">
                <div class="entry-name">${pass.nombre_familia}</div>
                <div class="entry-detail">Mesa ${tableNum} · ${pass.invitados_ingresados}/${pass.total_invitados}</div>
            </div>
        `;
    }).join('');
}

// renderiza la lista de pases pendientes (los que aun no han llegado completos)
function renderPendingList() {
    const container = document.getElementById('pending-list');
    if (!container) return;

    const pendingPasses = guestPasses.filter(p => !p.todos_ingresaron);

    if (pendingPasses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted, #999); text-align: center; padding: 1rem;">¡Todos han llegado!</p>';
        return;
    }

    container.innerHTML = pendingPasses.map(pass => {
        const tableNum = pass.mesas?.numero_mesa || '—';
        const remaining = pass.total_invitados - pass.invitados_ingresados;
        return `
            <div class="pending-item">
                <div class="pending-name">${pass.nombre_familia}</div>
                <div class="pending-detail">Mesa ${tableNum} · Faltan ${remaining}</div>
            </div>
        `;
    }).join('');
}

// muestra notificaciones temporales (toast) en la esquina
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.log(`[${type}] ${message}`);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // forzamos un reflow para que la animacion CSS funcione
    toast.offsetHeight;
    toast.classList.add('show');

    // lo quitamos despues de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// funcion de logout, cierra sesion y redirige al login
window.logout = async function () {
    await supabaseInstance.auth.signOut();
    window.location.href = '/admin/index.html';
};

// iniciamos todo cuando el DOM esta listo
document.addEventListener('DOMContentLoaded', initScanner);
