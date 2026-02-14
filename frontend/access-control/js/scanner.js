// ============================================
// scanner.js — Control de acceso / Escaner QR
// Maneja: escaneo de codigos QR, busqueda manual,
// verificacion de pases, registro de entradas,
// y estadisticas en tiempo real.
// ============================================

let scanner = null;
let guestPasses = [];
let supabaseInstance = null;
let lastScannedCode = null;
let isProcessing = false;
let currentUser = null;

// Audio context para sonidos de confirmacion/error
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Reproduce un beep de exito o error
function playBeep(type = 'success') {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// Inicializa todo el scanner
async function initScanner() {
    try {
        // Usamos el cliente de Supabase ya creado por supabase-config.js
        supabaseInstance = window.supabaseClient;

        if (!supabaseInstance) {
            console.error('Supabase no inicializado');
            showToast('Error: Supabase no conectado', 'error');
            return;
        }

        // Verificar autenticacion
        const { data: { session } } = await supabaseInstance.auth.getSession();
        if (!session) {
            window.location.href = '/admin/index.html';
            return;
        }
        currentUser = session.user;

        // Cargar datos
        await loadData();

        // Suscribirse a cambios en tiempo real
        initRealtime();

        // Iniciar escaner QR
        startScanner();

    } catch (error) {
        console.error('Error initializing:', error);
        showToast('Error al iniciar la aplicación', 'error');
    }
}

// Carga los pases confirmados desde Supabase
async function loadData() {
    try {
        const { data, error } = await supabaseInstance
            .from('pases_invitados')
            .select(`*, mesas (numero_mesa)`)
            .eq('confirmado', true);

        if (error) throw error;

        guestPasses = data || [];
        updateStats();
        renderEntryLog();
        renderPendingList();
        console.log('Pases cargados:', guestPasses.length);

    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error al cargar datos', 'error');
    }
}

// Suscripcion a cambios en tiempo real
function initRealtime() {
    supabaseInstance.channel('scanner_updates')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'pases_invitados' },
            payload => {
                console.log('Update received:', payload);
                loadData();
            }
        )
        .subscribe();
}

// Inicia el escaner de camara QR
function startScanner() {
    const readerEl = document.getElementById('qr-reader');
    if (!readerEl) return;

    scanner = new Html5Qrcode("qr-reader");

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    scanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
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

// Callback cuando se escanea un QR exitosamente
function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    if (decodedText === lastScannedCode) {
        // Debounce para el mismo codigo
        setTimeout(() => lastScannedCode = null, 3000);
        return;
    }

    lastScannedCode = decodedText;
    processCode(decodedText);
}

function onScanFailure(error) {
    // Silencioso — ocurre constantemente mientras no haya QR
}

// Busqueda manual por codigo
function searchByCode() {
    const input = document.getElementById('manual-code');
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) return;

    processCode(code);
}
// Hacer disponible globalmente
window.searchByCode = searchByCode;

// Procesa un codigo (QR o manual)
async function processCode(code) {
    isProcessing = true;

    // Buscar el pase localmente
    const pass = guestPasses.find(p => p.codigo_acceso === code);

    if (!pass) {
        // Codigo no encontrado
        showGuestNotFound();
        playBeep('error');
        isProcessing = false;
        return;
    }

    // Verificar si ya ingresaron todos
    if (pass.todos_ingresaron) {
        showAlreadyUsed(pass);
        playBeep('error');
    } else {
        // Pase valido — mostrar info
        showGuestInfo(pass);
        playBeep('success');
    }

    isProcessing = false;
}

// Muestra la info del invitado encontrado
function showGuestInfo(pass) {
    const guestInfo = document.getElementById('guest-info');
    const noGuest = document.getElementById('no-guest');

    if (!guestInfo) return;

    // Mostrar panel de info, ocultar placeholder
    guestInfo.style.display = 'block';
    if (noGuest) noGuest.style.display = 'none';

    const tableNum = pass.mesas?.numero_mesa || 'Sin Asignar';
    const remaining = pass.total_invitados - pass.invitados_ingresados;

    document.getElementById('info-family').textContent = pass.nombre_familia;
    document.getElementById('info-code').textContent = pass.codigo_acceso;
    document.getElementById('info-total').textContent = pass.total_invitados;
    document.getElementById('info-inside').textContent = pass.invitados_ingresados;
    document.getElementById('info-remaining').textContent = remaining;
    document.getElementById('info-table').textContent = tableNum;

    // Configurar el input de "cuantos entran"
    const enteringInput = document.getElementById('entering-count');
    if (enteringInput) {
        enteringInput.value = 1;
        enteringInput.max = remaining;
    }

    // Guardar el pase actual para confirmEntry
    guestInfo.dataset.passId = pass.id;
}

// Muestra mensaje de codigo no encontrado
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
        // Restaurar despues de 3 segundos
        setTimeout(() => resetScannerView(), 3000);
    }

    showToast('Código no válido', 'error');
}

// Muestra que ya ingresaron todos
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

// Restaura la vista del scanner al estado inicial
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

// Confirma la entrada de invitados
window.confirmEntry = async function () {
    const guestInfo = document.getElementById('guest-info');
    if (!guestInfo) return;

    const passId = guestInfo.dataset.passId;
    const enteringInput = document.getElementById('entering-count');
    const enteringCount = parseInt(enteringInput?.value) || 1;

    const pass = guestPasses.find(p => p.id === passId);
    if (!pass) return;

    try {
        // Actualizar base de datos
        const newTotal = pass.invitados_ingresados + enteringCount;
        const allEntered = newTotal >= pass.total_invitados;

        // 1. Registrar entrada en el log
        await supabaseInstance
            .from('registros_entrada')
            .insert({
                pase_id: pass.id,
                invitados_ingresando: enteringCount,
                verificado_por: currentUser.id
            });

        // 2. Actualizar pase
        const { error } = await supabaseInstance
            .from('pases_invitados')
            .update({
                invitados_ingresados: newTotal,
                todos_ingresaron: allEntered
            })
            .eq('id', passId);

        if (error) throw error;

        // Exito
        resetScannerView();
        await loadData();
        showToast(`Entrada registrada: ${enteringCount} persona(s) de ${pass.nombre_familia}`, 'success');
        playBeep('success');

        // Limpiar input manual
        const manualInput = document.getElementById('manual-code');
        if (manualInput) manualInput.value = '';

    } catch (error) {
        console.error('Error confirming entry:', error);
        showToast('Error al registrar entrada', 'error');
    }
};

// Cancela el proceso de entrada
window.cancelEntry = function () {
    resetScannerView();
};

// Actualiza las estadisticas del panel derecho
function updateStats() {
    const total = guestPasses.reduce((sum, p) => sum + p.total_invitados, 0);
    const entered = guestPasses.reduce((sum, p) => sum + p.invitados_ingresados, 0);
    const pending = total - entered;

    const statExpected = document.getElementById('stat-expected');
    const statInside = document.getElementById('stat-inside');
    const statPending = document.getElementById('stat-pending');

    if (statExpected) statExpected.textContent = total;
    if (statInside) statInside.textContent = entered;
    if (statPending) statPending.textContent = pending;
}

// Renderiza el log de ultimas entradas
function renderEntryLog() {
    const container = document.getElementById('entry-log');
    if (!container) return;

    // Filtrar pases con al menos una entrada
    const enteredPasses = guestPasses
        .filter(p => p.invitados_ingresados > 0)
        .sort((a, b) => new Date(b.actualizado_en || b.creado_en) - new Date(a.actualizado_en || a.creado_en));

    if (enteredPasses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted, #999); text-align: center; padding: 1rem;">Sin entradas registradas aún</p>';
        return;
    }

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

// Renderiza la lista de pendientes por llegar
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

// Toast de notificacion (usa el mismo contenedor del HTML)
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

    // Forzar reflow para animacion
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Cerrar sesion
window.logout = async function () {
    await supabaseInstance.auth.signOut();
    window.location.href = '/admin/index.html';
};

// Arrancar al cargar la pagina
document.addEventListener('DOMContentLoaded', initScanner);
