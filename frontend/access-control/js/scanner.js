// ============================================
// scanner.js — Control de Acceso / Scanner QR
// Se usa el dia del evento para verificar invitados.
// Escanea QR o busca por codigo manual, registra entradas
// y muestra stats en tiempo real.
// ============================================

// Shortcut para agarrar el cliente de Supabase
function getSupabase() {
    return window.supabaseClient;
}

// --- Estado de la app ---
let currentUser = null;    // usuario logueado
let currentPass = null;    // pase que se esta verificando ahora
let passes = [];           // todos los pases confirmados
let entryLogs = [];        // historial de entradas
let html5QrCode = null;    // instancia del lector QR

// =============================================
// INICIALIZACION
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadData();
    initScanner();
    initRealtime();
});

// Verifica que el usuario este logueado, si no lo manda al login
async function checkAuth() {
    const { data: { session } } = await getSupabase().auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;
}

// =============================================
// CARGA DE DATOS
// =============================================
async function loadData() {
    await loadPasses();
    await loadEntryLogs();
    updateStats();
    updatePendingList();
}

// Trae todos los pases confirmados con su numero de mesa
async function loadPasses() {
    const { data } = await getSupabase()
        .from('guest_passes')
        .select(`*, tables (table_number)`)
        .eq('confirmed', true)
        .order('family_name');

    if (data) passes = data;
}

// Trae las ultimas 20 entradas registradas
async function loadEntryLogs() {
    const { data } = await getSupabase()
        .from('entry_logs')
        .select(`*, guest_passes (family_name, access_code)`)
        .order('entered_at', { ascending: false })
        .limit(20);

    if (data) {
        entryLogs = data;
        renderEntryLog();
    }
}

// =============================================
// STATS — numeros arriba de la pantalla
// =============================================
function updateStats() {
    const totalExpected = passes.reduce((sum, p) => sum + p.total_guests, 0);
    const totalInside = passes.reduce((sum, p) => sum + p.guests_entered, 0);
    const totalPending = totalExpected - totalInside;

    document.getElementById('stat-expected').textContent = totalExpected;
    document.getElementById('stat-inside').textContent = totalInside;
    document.getElementById('stat-pending').textContent = totalPending;
}

// =============================================
// LISTA DE PENDIENTES
// Familias que aun no llegan completas
// =============================================
function updatePendingList() {
    const container = document.getElementById('pending-list');
    const pending = passes.filter(p => p.guests_entered < p.total_guests);

    if (pending.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">¡Todos los invitados han llegado!</p>';
        return;
    }

    container.innerHTML = pending.map(pass => {
        const remaining = pass.total_guests - pass.guests_entered;
        const tableNum = pass.tables?.table_number || '-';

        return `
            <div class="pending-item" onclick="showGuestByCode('${pass.access_code}')">
                <span class="family">${pass.family_name}</span>
                <span class="count">${remaining} por llegar</span>
                <span class="table">Mesa ${tableNum}</span>
            </div>
        `;
    }).join('');
}

// =============================================
// HISTORIAL DE ENTRADAS
// Agrupado por familia para no repetir
// =============================================
function renderEntryLog() {
    const container = document.getElementById('entry-log');

    if (entryLogs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Sin entradas registradas</p>';
        return;
    }

    // Agrupamos por familia y mostramos el status mas reciente
    const familyStatus = new Map();

    entryLogs.forEach(log => {
        const familyName = log.guest_passes?.family_name || 'Desconocido';
        const passId = log.guest_pass_id;

        if (!familyStatus.has(passId)) {
            const pass = passes.find(p => p.id === passId);
            familyStatus.set(passId, {
                familyName,
                totalGuests: pass?.total_guests || 0,
                guestsEntered: pass?.guests_entered || log.guests_entering,
                lastEntry: log.entered_at,
                isComplete: pass ? pass.guests_entered >= pass.total_guests : false
            });
        }
    });

    container.innerHTML = Array.from(familyStatus.values()).map(family => {
        const time = new Date(family.lastEntry).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const statusText = family.isComplete
            ? `Completa (${family.totalGuests}/${family.totalGuests})`
            : `${family.guestsEntered}/${family.totalGuests} - Faltan ${family.totalGuests - family.guestsEntered}`;

        return `
            <div class="log-item ${family.isComplete ? 'complete' : 'partial'}">
                <div class="info">
                    <span class="family">${family.familyName}</span>
                    <span class="details">${statusText}</span>
                </div>
                <span class="time">${time}</span>
            </div>
        `;
    }).join('');
}

// =============================================
// ESCANER QR
// Usa la camara del celular para leer codigos QR
// =============================================
function initScanner() {
    html5QrCode = new Html5Qrcode("qr-reader");

    html5QrCode.start(
        { facingMode: "environment" },  // camara trasera
        { fps: 10, qrbox: { width: 180, height: 180 }, aspectRatio: 1.0 },
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.log("Camera error:", err);
        showToast('No se pudo acceder a la cámara', 'error');
    });
}

// Cuando el QR se lee exitosamente, extraemos el codigo
function onScanSuccess(decodedText) {
    let code = decodedText;

    // Puede venir como URL o como texto plano
    if (code.includes('?code=')) {
        code = new URL(code).searchParams.get('code');
    } else if (code.includes('/confirm/')) {
        code = code.split('/confirm/').pop();
    }

    // Limpiamos y nos quedamos con los 4 caracteres
    code = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 4);

    if (code.length === 4) {
        showGuestByCode(code);
    }
}

// No hacemos nada cuando falla el scan — sigue intentando
function onScanFailure() { }

// =============================================
// BUSQUEDA MANUAL
// Para cuando no se puede escanear el QR
// =============================================
function searchByCode() {
    const input = document.getElementById('manual-code');
    const code = input.value.toUpperCase().trim();

    if (code.length !== 4) {
        showToast('El código debe tener 4 caracteres', 'error');
        return;
    }

    showGuestByCode(code);
}

// Busca el pase por codigo — primero en cache, luego en la BD
async function showGuestByCode(code) {
    let pass = passes.find(p => p.access_code === code);

    // Si no esta en cache, lo buscamos directo (puede no estar confirmado aun)
    if (!pass) {
        const { data } = await getSupabase()
            .from('guest_passes')
            .select(`*, tables (table_number)`)
            .eq('access_code', code)
            .single();

        if (data) pass = data;
    }

    if (!pass) {
        showToast('Código no encontrado: ' + code, 'error');
        return;
    }

    currentPass = pass;
    displayGuestInfo(pass);
}

// Muestra la info del invitado en pantalla
function displayGuestInfo(pass) {
    const remaining = pass.total_guests - pass.guests_entered;
    const tableNum = pass.tables?.table_number || '-';

    document.getElementById('info-family').textContent = pass.family_name;
    document.getElementById('info-code').textContent = pass.access_code;
    document.getElementById('info-total').textContent = pass.total_guests;
    document.getElementById('info-inside').textContent = pass.guests_entered;
    document.getElementById('info-remaining').textContent = remaining;
    document.getElementById('info-table').textContent = tableNum;

    // Ponemos el conteo default de personas que van a entrar
    const enteringInput = document.getElementById('entering-count');
    enteringInput.value = Math.min(remaining, 1);
    enteringInput.max = remaining;

    // Mostramos la tarjeta del invitado
    document.getElementById('guest-info').classList.add('active');
    document.getElementById('no-guest').style.display = 'none';

    // Aviso si ya entraron todos
    if (remaining === 0) {
        showToast('[!] Esta familia ya está completa dentro', 'warning');
    }
}

// =============================================
// REGISTRO DE ENTRADA
// Confirma que X personas de una familia estan entrando
// =============================================
async function confirmEntry() {
    if (!currentPass) return;

    const enteringCount = parseInt(document.getElementById('entering-count').value);
    const remaining = currentPass.total_guests - currentPass.guests_entered;

    if (enteringCount < 1) {
        showToast('Debe entrar al menos 1 persona', 'error');
        return;
    }

    if (enteringCount > remaining) {
        showToast(`Solo quedan ${remaining} personas por entrar`, 'error');
        return;
    }

    try {
        // Creamos el log de entrada
        const { error: logError } = await getSupabase()
            .from('entry_logs')
            .insert({
                guest_pass_id: currentPass.id,
                guests_entering: enteringCount,
                verified_by: currentUser.id
            });

        if (logError) throw logError;

        // Actualizamos el pase con las personas que ya entraron
        const newEntered = currentPass.guests_entered + enteringCount;
        const allEntered = newEntered >= currentPass.total_guests;

        const { error: updateError } = await getSupabase()
            .from('guest_passes')
            .update({
                guests_entered: newEntered,
                all_entered: allEntered,
                confirmed: true,
                confirmed_at: currentPass.confirmed_at || new Date().toISOString()
            })
            .eq('id', currentPass.id);

        if (updateError) throw updateError;

        showToast(`${enteringCount} persona(s) de ${currentPass.family_name} registradas`, 'success');

        // Vibracion de feedback si el celular lo soporta
        if (navigator.vibrate) navigator.vibrate(200);

        // Reseteamos y recargamos datos
        cancelEntry();
        await loadData();

    } catch (error) {
        showToast('Error al registrar: ' + error.message, 'error');
    }
}

// Cancela la verificacion actual y vuelve al estado inicial
function cancelEntry() {
    currentPass = null;
    document.getElementById('guest-info').classList.remove('active');
    document.getElementById('no-guest').style.display = 'flex';
    document.getElementById('manual-code').value = '';
}

// =============================================
// REALTIME — actualizaciones en vivo
// Si alguien mas registra una entrada, se actualiza solo
// =============================================
function initRealtime() {
    // Escuchamos nuevas entradas
    getSupabase()
        .channel('entry_logs_changes')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'entry_logs' },
            async () => { await loadData(); }
        )
        .subscribe();

    // Escuchamos cambios en pases (confirmaciones, etc)
    getSupabase()
        .channel('passes_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'guest_passes' },
            async () => {
                await loadPasses();
                updateStats();
                updatePendingList();
            }
        )
        .subscribe();
}

// =============================================
// LOGOUT — cierra sesion y apaga la camara
// =============================================
async function logout() {
    if (html5QrCode) {
        try { await html5QrCode.stop(); } catch (e) { }
    }
    await getSupabase().auth.signOut();
    window.location.href = 'index.html';
}

// =============================================
// UTILIDADES
// =============================================

// Muestra una notificacion temporal (toast)
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Input del codigo manual — enter para buscar y auto-mayusculas
document.getElementById('manual-code')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') searchByCode();
    e.target.value = e.target.value.toUpperCase();
});
