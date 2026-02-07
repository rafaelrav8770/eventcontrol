// Scanner Module for Access Control
// Use supabaseClient from window (loaded by supabase-config.js)
function getSupabase() {
    return window.supabaseClient;
}

// State
let currentUser = null;
let currentPass = null;
let passes = [];
let entryLogs = [];
let html5QrCode = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadData();
    initScanner();
    initRealtime();
});

// Check authentication
async function checkAuth() {
    const { data: { session } } = await getSupabase().auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;
}

// Load all data
async function loadData() {
    await loadPasses();
    await loadEntryLogs();
    updateStats();
    updatePendingList();
}

// Load passes
async function loadPasses() {
    const { data, error } = await getSupabase()
        .from('guest_passes')
        .select(`
            *,
            tables (table_number)
        `)
        .eq('confirmed', true)
        .order('family_name');

    if (data) {
        passes = data;
    }
}

// Load entry logs
async function loadEntryLogs() {
    const { data, error } = await getSupabase()
        .from('entry_logs')
        .select(`
            *,
            guest_passes (family_name, access_code)
        `)
        .order('entered_at', { ascending: false })
        .limit(20);

    if (data) {
        entryLogs = data;
        renderEntryLog();
    }
}

// Update statistics
function updateStats() {
    const totalExpected = passes.reduce((sum, p) => sum + p.total_guests, 0);
    const totalInside = passes.reduce((sum, p) => sum + p.guests_entered, 0);
    const totalPending = totalExpected - totalInside;

    document.getElementById('stat-expected').textContent = totalExpected;
    document.getElementById('stat-inside').textContent = totalInside;
    document.getElementById('stat-pending').textContent = totalPending;
}

// Update pending list
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

// Render entry log - consolidated by family
function renderEntryLog() {
    const container = document.getElementById('entry-log');

    if (entryLogs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Sin entradas registradas</p>';
        return;
    }

    // Group entries by family and show latest status
    const familyStatus = new Map();

    entryLogs.forEach(log => {
        const familyName = log.guest_passes?.family_name || 'Desconocido';
        const passId = log.guest_pass_id;

        if (!familyStatus.has(passId)) {
            // Find the pass to get total info
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

        const statusClass = family.isComplete ? 'complete' : 'partial';

        return `
            <div class="log-item ${statusClass}">
                <div class="info">
                    <span class="family">${family.familyName}</span>
                    <span class="details">${statusText}</span>
                </div>
                <span class="time">${time}</span>
            </div>
        `;
    }).join('');
}

// Initialize QR Scanner
function initScanner() {
    const qrReaderEl = document.getElementById('qr-reader');

    html5QrCode = new Html5Qrcode("qr-reader");

    const config = {
        fps: 10,
        qrbox: { width: 180, height: 180 },
        aspectRatio: 1.0
    };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.log("Camera error:", err);
        showToast('No se pudo acceder a la cámara', 'error');
    });
}

// QR Scan success callback
function onScanSuccess(decodedText, decodedResult) {
    // Extract code from QR (might be just the code or a URL containing it)
    let code = decodedText;

    // If it's a URL, extract the code parameter
    if (code.includes('?code=')) {
        const url = new URL(code);
        code = url.searchParams.get('code');
    } else if (code.includes('/confirm/')) {
        // Extract from path
        code = code.split('/confirm/').pop();
    }

    // Clean the code
    code = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 4);

    if (code.length === 4) {
        showGuestByCode(code);
    }
}

function onScanFailure(error) {
    // Silent - continuous scanning
}

// Search by manual code
function searchByCode() {
    const input = document.getElementById('manual-code');
    const code = input.value.toUpperCase().trim();

    if (code.length !== 4) {
        showToast('El código debe tener 4 caracteres', 'error');
        return;
    }

    showGuestByCode(code);
}

// Show guest info by code
async function showGuestByCode(code) {
    // Find in local cache first
    let pass = passes.find(p => p.access_code === code);

    if (!pass) {
        // Try to fetch from database (might not be confirmed yet)
        const { data, error } = await getSupabase()
            .from('guest_passes')
            .select(`*, tables (table_number)`)
            .eq('access_code', code)
            .single();

        if (data) {
            pass = data;
        }
    }

    if (!pass) {
        showToast('Código no encontrado: ' + code, 'error');
        return;
    }

    currentPass = pass;
    displayGuestInfo(pass);
}

// Display guest information
function displayGuestInfo(pass) {
    const remaining = pass.total_guests - pass.guests_entered;
    const tableNum = pass.tables?.table_number || '-';

    document.getElementById('info-family').textContent = pass.family_name;
    document.getElementById('info-code').textContent = pass.access_code;
    document.getElementById('info-total').textContent = pass.total_guests;
    document.getElementById('info-inside').textContent = pass.guests_entered;
    document.getElementById('info-remaining').textContent = remaining;
    document.getElementById('info-table').textContent = tableNum;

    // Set default entering count
    const enteringInput = document.getElementById('entering-count');
    enteringInput.value = Math.min(remaining, 1);
    enteringInput.max = remaining;

    // Show guest info, hide no-guest state
    document.getElementById('guest-info').classList.add('active');
    document.getElementById('no-guest').style.display = 'none';

    // Highlight if already all inside
    if (remaining === 0) {
        showToast('[!] Esta familia ya está completa dentro', 'warning');
    }
}

// Confirm entry
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
        // Create entry log
        const { error: logError } = await getSupabase()
            .from('entry_logs')
            .insert({
                guest_pass_id: currentPass.id,
                guests_entering: enteringCount,
                verified_by: currentUser.id
            });

        if (logError) throw logError;

        // Update guest pass
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

        // Success feedback
        showToast(`${enteringCount} persona(s) de ${currentPass.family_name} registradas`, 'success');

        // Sound/vibration feedback if available
        if (navigator.vibrate) navigator.vibrate(200);

        // Reset and reload
        cancelEntry();
        await loadData();

    } catch (error) {
        showToast('Error al registrar: ' + error.message, 'error');
    }
}

// Cancel entry / Reset view
function cancelEntry() {
    currentPass = null;
    document.getElementById('guest-info').classList.remove('active');
    document.getElementById('no-guest').style.display = 'flex';
    document.getElementById('manual-code').value = '';
}

// Initialize realtime subscription
function initRealtime() {
    // Subscribe to entry_logs changes
    getSupabase()
        .channel('entry_logs_changes')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'entry_logs' },
            async (payload) => {
                await loadData();
            }
        )
        .subscribe();

    // Subscribe to guest_passes changes
    getSupabase()
        .channel('passes_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'guest_passes' },
            async (payload) => {
                await loadPasses();
                updateStats();
                updatePendingList();
            }
        )
        .subscribe();
}

// Logout
async function logout() {
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (e) { }
    }
    await getSupabase().auth.signOut();
    window.location.href = 'index.html';
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}

// Handle manual code input
document.getElementById('manual-code')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        searchByCode();
    }
    // Auto-uppercase
    e.target.value = e.target.value.toUpperCase();
});
