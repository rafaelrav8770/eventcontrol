// ============================================
// dashboard.js — Panel de Administración
// Este es el archivo mas grande del proyecto.
// Maneja: mesas, pases de invitados, estadisticas,
// monitor en vivo, filtros, edicion, eliminacion,
// y mucho CSS inline al final.
// ============================================

// Shortcut para Supabase
function getSupabase() {
    return window.supabaseClient;
}

// --- Estado global del dashboard ---
let currentUser = null;       // usuario logueado
let userProfile = null;       // perfil del usuario (nombre, rol)
let eventConfig = null;       // config del evento (mesas, asientos)
let tables = [];              // lista de mesas
let passes = [];              // lista de pases/invitaciones
let userProfiles = {};        // cache de perfiles de creadores
let isInitialized = false;    // evita doble inicializacion
let tableTypes = [];          // tipos de mesa para creacion rapida

// =============================================
// INICIALIZACION — arranca todo al cargar la pagina
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (isInitialized) return;
    isInitialized = true;

    // Primero checamos que este logueado
    const hasAuth = await checkDashboardAuth();
    if (!hasAuth) return;

    // Cargamos perfil, nav, datos, formularios y UI
    await loadUserProfile();
    initNavigation();
    await loadDashboardData();
    initForms();
    updateCurrentDate();
    updateUserGreeting();
});

// Verifica que haya sesion activa, si no redirige al login
async function checkDashboardAuth() {
    const supabase = getSupabase();
    if (!supabase) {
        console.error('Supabase not initialized');
        return false;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return false;
    }

    currentUser = session.user;
    return true;
}

// Trae el perfil del usuario logueado (nombre, rol, etc)
async function loadUserProfile() {
    const supabase = getSupabase();
    const { data: profile } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        userProfile = profile;
    }
}

// Saludo personalizado en el header ("Hola, Abidan")
function updateUserGreeting() {
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl && userProfile) {
        greetingEl.textContent = `Hola, ${userProfile.nombre}`;
    }
}

// =============================================
// NAVEGACION DEL SIDEBAR
// Maneja los tabs, filtros y busqueda
// =============================================
function initNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show section
            document.querySelectorAll('.dashboard-section').forEach(s => {
                s.classList.remove('active');
            });
            document.getElementById(`section-${section}`).classList.add('active');

            // Refresh data for specific sections
            if (section === 'guests') loadGuests();
            if (section === 'passes') loadRecentPasses();
            if (section === 'live-monitor') loadLiveMonitor();
        });
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterGuests(btn.dataset.filter);
        });
    });

    // Search
    const searchInput = document.getElementById('guest-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchGuests(e.target.value);
        });
    }
}

// Navegar a una seccion desde las tarjetas de stats (click en "invitados" etc)
function navigateToSection(section) {
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    // Update active states
    navLinks.forEach(l => l.classList.remove('active'));
    const targetLink = document.querySelector(`[data-section="${section}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
    }

    // Show section
    document.querySelectorAll('.dashboard-section').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(`section-${section}`).classList.add('active');

    // Refresh data for specific sections
    if (section === 'guests') loadGuests();
    if (section === 'passes') loadRecentPasses();
    if (section === 'live-monitor') loadLiveMonitor();
}

// Muestra la fecha actual en el header
function updateCurrentDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = new Date().toLocaleDateString('es-MX', options);
    }
}

// =============================================
// CARGA DE DATOS
// Trae todo desde Supabase: config, mesas, pases
// =============================================
async function loadDashboardData() {
    await loadDashboardDataAsync();
    initRealtime();
}

async function loadDashboardDataAsync() {
    await loadEventConfig();
    await loadTables();
    await loadPasses();
    updateStats();
    updateCurrentDate();
}

// Config del evento — si no existe, creamos una por default
async function loadEventConfig() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('configuracion_evento')
        .select('*')
        .limit(1)
        .single();

    if (data) {
        eventConfig = data;
    } else {
        // Create default config
        const { data: newConfig } = await getSupabase()
            .from('configuracion_evento')
            .insert({ total_mesas: 10, asientos_por_mesa: 8 })
            .select()
            .single();

        eventConfig = newConfig;
    }
}

// Trae todas las mesas ordenadas por numero
async function loadTables() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .order('numero_mesa');

    if (error) {
        console.error('Error loading tables:', error);
        return;
    }

    if (data) {
        tables = data;
        renderTablesList();
        populateTableSelect();
        updateTablesCount();
    }
}

// Actualiza los contadores de mesas en la UI
function updateTablesCount() {
    const countEl = document.getElementById('total-tables-count');
    const capacityEl = document.getElementById('total-capacity');

    if (countEl) countEl.textContent = tables.length;
    if (capacityEl) {
        const total = tables.reduce((sum, t) => sum + t.capacidad, 0);
        capacityEl.textContent = total;
    }

    // Show/hide bulk delete button
    const bulkActions = document.getElementById('tables-bulk-actions');
    if (bulkActions) {
        const hasEmptyTables = tables.some(t => t.asientos_ocupados === 0);
        bulkActions.style.display = hasEmptyTables ? 'block' : 'none';
    }
}

// Trae todos los pases con su mesa asignada
async function loadPasses() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('pases_invitados')
        .select(`*, mesas (numero_mesa), registros_entrada (*)`)
        .order('creado_en', { ascending: false });

    if (error) {
        console.error('Error loading passes:', error);
        return;
    }

    if (data) {
        passes = data;

        // Load creator profiles for passes
        await loadCreatorProfiles();

        loadRecentPasses();
        loadGuests();
    }
}

// Carga los perfiles de quien creo cada pase (novio o novia)
async function loadCreatorProfiles() {
    const supabase = getSupabase();

    // Get unique creator IDs
    const creatorIds = [...new Set(passes.map(p => p.creado_por).filter(Boolean))];

    console.log('Loading creator profiles for IDs:', creatorIds);

    if (creatorIds.length === 0) {
        console.log('No creator IDs found');
        return;
    }

    const { data: profiles, error } = await supabase
        .from('perfiles_usuario')
        .select('id, nombre, rol')
        .in('id', creatorIds);

    if (error) {
        console.error('Error loading creator profiles:', error);
        return;
    }

    console.log('Loaded creator profiles:', profiles);

    if (profiles) {
        // Create lookup map
        profiles.forEach(p => {
            userProfiles[p.id] = p;
        });

        // Attach creator info to passes
        passes.forEach(pass => {
            if (pass.creado_por && userProfiles[pass.creado_por]) {
                pass.creator = userProfiles[pass.creado_por];
            }
        });

        // Update filter counts
        updateCreatorFilterCounts();
    }
}

// Actualiza los contadores del filtro "creado por" (Abidan: X, Betsaida: Y)
function updateCreatorFilterCounts() {
    let totalGuests = 0;
    let groomGuests = 0;
    let brideGuests = 0;

    passes.forEach(pass => {
        const guests = pass.total_invitados || 0;
        totalGuests += guests;

        if (pass.creator) {
            if (pass.creator.rol === 'groom') {
                groomGuests += guests;
            } else if (pass.creator.rol === 'bride') {
                brideGuests += guests;
            }
        }
    });

    // Update select options
    const select = document.getElementById('creator-filter');
    if (select) {
        // Update options text while preserving values
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            if (option.value === 'all') {
                option.textContent = `Todos (${totalGuests} invitados)`;
            } else if (option.value === 'groom') {
                option.textContent = `Abidán (${groomGuests} invitados)`;
            } else if (option.value === 'bride') {
                option.textContent = `Betsaida (${brideGuests} invitados)`;
            }
        }
    }
}

// =============================================
// ESTADISTICAS — los numeritos del dashboard
// =============================================
function updateStats() {
    document.getElementById('stat-tables').textContent = tables.length;
    document.getElementById('stat-passes').textContent = passes.length;

    const confirmed = passes.filter(p => p.confirmado).length;
    document.getElementById('stat-confirmed').textContent = confirmed;

    const totalGuests = passes.reduce((sum, p) => sum + p.total_invitados, 0);
    document.getElementById('stat-guests').textContent = totalGuests;

    // Update chart
    const pending = passes.filter(p => !p.confirmado).length;
    const inside = passes.filter(p => p.invitados_ingresados > 0).length;

    document.getElementById('chart-pending').textContent = pending;
    document.getElementById('chart-confirmed').textContent = confirmed;
    document.getElementById('chart-inside').textContent = inside;

    // Update total capacity
    const capacity = tables.reduce((sum, t) => sum + t.capacidad, 0);
    document.getElementById('total-capacity').textContent = capacity;
}

// =============================================
// MESAS — visualizacion, creacion, eliminacion
// =============================================

// Grid visual de mesas con barrita de ocupacion
function renderTablesGrid() {
    const container = document.getElementById('tables-grid');
    if (!container) return;

    container.innerHTML = tables.map(table => {
        const occupiedPercent = (table.asientos_ocupados / table.capacidad) * 100;
        const statusClass = occupiedPercent >= 100 ? 'full' :
            occupiedPercent >= 50 ? 'partial' : 'empty';

        return `
            <div class="table-item ${statusClass}" onclick="showTableGuests('${table.id}', ${table.numero_mesa})" style="cursor: pointer;">
                <div class="table-number">Mesa ${table.numero_mesa}</div>
                <div class="table-occupancy">
                    ${table.asientos_ocupados} / ${table.capacidad}
                </div>
                <div class="table-bar">
                    <div class="table-bar-fill" style="width: ${occupiedPercent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Llena el dropdown de mesas en el form de crear pase
// Deshabilita mesas que no tienen espacio suficiente
function populateTableSelect() {
    const select = document.getElementById('table-select');
    const guestInput = document.getElementById('guest-count');
    if (!select) return;

    const requiredSeats = guestInput ? parseInt(guestInput.value) || 1 : 1;
    const currentSelection = select.value;

    select.innerHTML = '<option value="">Selecciona una mesa</option>' +
        tables.map(table => {
            const available = table.capacidad - table.asientos_ocupados;
            // Show all tables, but disable if not enough space
            const isEnoughSpace = available >= requiredSeats;
            const disabled = !isEnoughSpace ? 'disabled' : '';
            const statusText = available === 0 ? 'llena' : `${available} lugares disponibles`;

            return `<option value="${table.id}" ${disabled}>
                Mesa ${table.numero_mesa} (${statusText})
            </option>`;
        }).join('');

    // Restore selection if still valid
    if (currentSelection) {
        const option = select.querySelector(`option[value="${currentSelection}"]`);
        if (option && !option.disabled) {
            select.value = currentSelection;
        } else {
            select.value = ''; // Reset if selected table is no longer valid
        }
    }
}

// Conecta los formularios con sus handlers
function initForms() {
    // Tables config form
    const tablesForm = document.getElementById('tables-config-form');
    if (tablesForm) {
        tablesForm.addEventListener('submit', handleTablesConfig);
    }

    // Create pass form
    const passForm = document.getElementById('create-pass-form');
    if (passForm) {
        passForm.addEventListener('submit', handleCreatePass);

        // Add listener for guest count changes
        const guestInput = document.getElementById('guest-count');
        if (guestInput) {
            guestInput.addEventListener('input', () => populateTableSelect());
            guestInput.addEventListener('change', () => populateTableSelect());
        }
    }
}

// =============================================
// GESTION DE MESAS — lista, agregar, eliminar
// =============================================

// Renderiza la lista de mesas con botones de ver y eliminar
function renderTablesList() {
    const container = document.getElementById('tables-list');
    if (!container) return;

    if (tables.length === 0) {
        container.innerHTML = `
            <div class="tables-empty">
                <p>No hay mesas creadas todavía.</p>
                <p>Usa el formulario de arriba para agregar mesas.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tables.map(table => {
        const isOccupied = table.asientos_ocupados > 0;
        const statusClass = isOccupied ? 'occupied' : 'empty';
        const guestsAssigned = passes.filter(p => p.mesa_id === table.id);
        const totalGuests = guestsAssigned.reduce((sum, p) => sum + p.total_invitados, 0);

        return `
            <div class="table-list-item ${statusClass}" onclick="showTableGuests('${table.id}', ${table.numero_mesa})" style="cursor: pointer;">
                <div class="table-info">
                    <span class="table-number">Mesa ${table.numero_mesa}</span>
                    <span class="table-capacity">${table.capacidad} personas</span>
                    ${isOccupied ? `<span class="table-occupied">${guestsAssigned.length} familia${guestsAssigned.length > 1 ? 's' : ''} (${totalGuests} personas)</span>` : '<span class="table-empty-label">Sin asignar</span>'}
                </div>
                <div class="table-actions">
                    <button type="button" 
                        class="btn-view-table"
                        onclick="event.stopPropagation(); showTableGuests('${table.id}', ${table.numero_mesa})"
                        title="Ver invitados">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button type="button" 
                        onclick="event.stopPropagation(); deleteSingleTable('${table.id}', ${table.numero_mesa}, ${isOccupied})" 
                        class="btn-delete-table"
                        title="${isOccupied ? 'Eliminar mesa (invitados quedarán sin asignar)' : 'Eliminar mesa'}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Agrega una mesa individual con la capacidad indicada
async function addSingleTable() {
    const capacityInput = document.getElementById('new-table-capacity');
    const capacity = parseInt(capacityInput.value);

    if (!capacity || capacity < 1) {
        showToast('Ingresa una capacidad válida (mínimo 1)', 'error');
        return;
    }

    const supabase = getSupabase();

    // Get next table number
    const nextNumber = tables.length > 0
        ? Math.max(...tables.map(t => t.numero_mesa)) + 1
        : 1;

    try {
        const { error } = await supabase
            .from('mesas')
            .insert([{
                numero_mesa: nextNumber,
                capacidad: capacity,
                asientos_ocupados: 0
            }]);

        if (error) throw error;

        showToast(`Mesa ${nextNumber} agregada (${capacity} personas)`, 'success');
        await loadTables();
        updateStats();
    } catch (error) {
        console.error('Error adding table:', error);
        showToast('Error al agregar mesa: ' + error.message, 'error');
    }
}

// Agrega varias mesas de golpe ("5 mesas de 10 personas")
async function addMultipleTables() {
    const quantityInput = document.getElementById('quick-add-quantity');
    const capacityInput = document.getElementById('quick-add-capacity');

    const quantity = parseInt(quantityInput.value);
    const capacity = parseInt(capacityInput.value);

    if (!quantity || quantity < 1) {
        showToast('Ingresa una cantidad válida', 'error');
        return;
    }

    if (!capacity || capacity < 1) {
        showToast('Ingresa una capacidad válida', 'error');
        return;
    }

    const supabase = getSupabase();

    // Get next table number
    let nextNumber = tables.length > 0
        ? Math.max(...tables.map(t => t.numero_mesa)) + 1
        : 1;

    const newTables = [];
    for (let i = 0; i < quantity; i++) {
        newTables.push({
            numero_mesa: nextNumber++,
            capacidad: capacity,
            asientos_ocupados: 0
        });
    }

    try {
        const { error } = await supabase
            .from('mesas')
            .insert(newTables);

        if (error) throw error;

        showToast(`${quantity} mesa(s) de ${capacity} personas agregadas`, 'success');
        await loadTables();
        updateStats();
    } catch (error) {
        console.error('Error adding tables:', error);
        showToast('Error al agregar mesas: ' + error.message, 'error');
    }
}

// Modal de confirmacion para acciones destructivas (eliminar mesa, etc)
function showConfirmModal(message, onConfirm, onCancel = null) {
    // Create or get modal
    let modal = document.getElementById('confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirm-modal';
        modal.className = 'confirm-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="confirm-modal-overlay"></div>
        <div class="confirm-modal-content">
            <p class="confirm-message">${message}</p>
            <div class="confirm-actions">
                <button type="button" class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
                <button type="button" class="btn btn-danger" id="confirm-accept">Eliminar</button>
            </div>
        </div>
    `;

    modal.classList.add('active');

    // Handle buttons
    document.getElementById('confirm-cancel').onclick = () => {
        modal.classList.remove('active');
        if (onCancel) onCancel();
    };

    document.getElementById('confirm-accept').onclick = () => {
        modal.classList.remove('active');
        onConfirm();
    };

    // Close on overlay click
    modal.querySelector('.confirm-modal-overlay').onclick = () => {
        modal.classList.remove('active');
        if (onCancel) onCancel();
    };
}

// Elimina una mesa — si tiene invitados, los desasigna primero
async function deleteSingleTable(tableId, tableNumber, isOccupied) {
    const message = isOccupied
        ? `¿Eliminar Mesa ${tableNumber}? Los invitados asignados quedarán sin mesa.`
        : `¿Eliminar Mesa ${tableNumber}?`;

    showConfirmModal(message, async () => {
        const supabase = getSupabase();

        try {
            // If table has guests, unassign them first
            if (isOccupied) {
                const { error: unassignError } = await supabase
                    .from('pases_invitados')
                    .update({ mesa_id: null })
                    .eq('mesa_id', tableId);

                if (unassignError) throw unassignError;
            }

            // Delete the table
            const { error } = await supabase
                .from('mesas')
                .delete()
                .eq('id', tableId);

            if (error) throw error;

            showToast(`Mesa ${tableNumber} eliminada`, 'success');
            await loadTables();
            await loadPasses();
            updateStats();
        } catch (error) {
            console.error('Error deleting table:', error);
            showToast('Error al eliminar mesa: ' + error.message, 'error');
        }
    });
}

// Elimina todas las mesas vacias de un jalon
async function deleteAllEmptyTables() {
    const emptyTables = tables.filter(t => t.asientos_ocupados === 0);

    if (emptyTables.length === 0) {
        showToast('No hay mesas vacías para eliminar', 'info');
        return;
    }

    showConfirmModal(`¿Eliminar ${emptyTables.length} mesa(s) vacías?`, async () => {
        const supabase = getSupabase();

        try {
            const { error } = await supabase
                .from('mesas')
                .delete()
                .eq('asientos_ocupados', 0);

            if (error) throw error;

            showToast(`${emptyTables.length} mesa(s) eliminadas`, 'success');
            await loadTables();
            updateStats();
        } catch (error) {
            console.error('Error deleting tables:', error);
            showToast('Error al eliminar mesas: ' + error.message, 'error');
        }
    });
}

// =============================================
// PASES DE INVITADOS — crear, copiar codigo
// =============================================

// Genera un codigo unico de 4 caracteres (sin I, O, 0, 1 para evitar confusion)
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Crea un nuevo pase: genera codigo, lo guarda en Supabase y actualiza la mesa
async function handleCreatePass(e) {
    e.preventDefault();
    const supabase = getSupabase();

    const familyName = document.getElementById('family-name').value.trim();
    const guestCount = parseInt(document.getElementById('guest-count').value);
    const tableId = document.getElementById('table-select').value;
    const phone = document.getElementById('family-phone').value.trim();

    if (!familyName || !tableId) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }

    // Verify capacity again (double check)
    const table = tables.find(t => t.id === tableId);
    if (!table) {
        showToast('Mesa no encontrada', 'error');
        return;
    }

    const available = table.capacidad - table.asientos_ocupados;
    if (guestCount > available) {
        showToast(`La Mesa ${table.numero_mesa} solo tiene ${available} lugares disponibles`, 'error');
        return;
    }

    try {
        // Generate unique code
        let code = generateCode();
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            const { data } = await supabase
                .from('pases_invitados')
                .select('id')
                .eq('codigo_acceso', code)
                .single();

            if (!data) {
                isUnique = true;
            } else {
                code = generateCode();
                attempts++;
            }
        }

        // Create pass
        const { data: newPass, error } = await supabase
            .from('pases_invitados')
            .insert({
                codigo_acceso: code,
                nombre_familia: familyName,
                total_invitados: guestCount,
                mesa_id: tableId,
                creado_por: currentUser.id,
                telefono: phone || null
            })
            .single();

        if (error) throw error;

        // Update table occupied seats
        const table = tables.find(t => t.id === tableId);
        await supabase
            .from('mesas')
            .update({ asientos_ocupados: table.asientos_ocupados + guestCount })
            .eq('id', tableId);

        // Show generated code
        document.getElementById('pass-code').textContent = code;
        document.getElementById('generated-pass').style.display = 'block';

        // Reset form
        document.getElementById('family-name').value = '';
        document.getElementById('family-phone').value = '';
        document.getElementById('guest-count').value = '2';
        document.getElementById('table-select').value = '';

        showToast('Pase creado exitosamente', 'success');

        // Reload data
        await loadTables();
        await loadPasses();
        updateStats();

    } catch (error) {
        showToast('Error al crear pase: ' + error.message, 'error');
    }
}

// Copia el codigo recien generado al portapapeles
function copyCode() {
    const code = document.getElementById('pass-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado al portapapeles', 'success');
    });
}

// =============================================
// PASES RECIENTES — tarjetas compactas
// =============================================
function loadRecentPasses() {
    const container = document.getElementById('recent-passes');
    if (!container) return;

    const recent = passes.slice(0, 10);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state-compact">
                <p>No hay pases creados aún</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(pass => {
        const status = getPassStatus(pass);
        const tableNum = pass.mesas?.numero_mesa || '-';

        return `
            <div class="recent-pass-card">
                <div class="recent-pass-info">
                    <div class="recent-pass-header">
                        <span class="recent-pass-family">${pass.nombre_familia}</span>
                        <code class="recent-pass-code">${pass.codigo_acceso}</code>
                    </div>
                    <div class="recent-pass-details">
                        <span class="detail-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            ${pass.total_invitados}
                        </span>
                        <span class="detail-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12,6 12,12 16,14"></polyline>
                            </svg>
                            Mesa ${tableNum}
                        </span>
                        <span class="status-badge ${status.class}">${status.text}</span>
                    </div>
                </div>
                <button class="btn-copy-compact" onclick="copyPassCode('${pass.codigo_acceso}')" title="Copiar código">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
                ${getWhatsAppButton(pass, 'compact')}
            </div>
        `;
    }).join('');
}

// =============================================
// LISTA COMPLETA DE INVITADOS
// Cards con toda la info: familia, mesa, creador, estado
// =============================================
function loadGuests() {
    const container = document.getElementById('guests-list');
    if (!container) return;

    if (passes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">-</div>
                <h3>No hay invitados registrados</h3>
                <p>Comienza creando pases de invitación en la sección "Crear Pases"</p>
            </div>
        `;
        return;
    }

    container.innerHTML = passes.map(pass => {
        const status = getPassStatus(pass);
        const tableNum = pass.mesas?.numero_mesa || '-';
        const confirmedDate = pass.confirmado_en
            ? new Date(pass.confirmado_en).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
            : '-';
        // Debug: Log creator info
        if (!pass.creator) {
            console.warn('No creator data for pass:', pass.codigo_acceso, 'created_by:', pass.creado_por);
        }

        const creatorName = pass.creator?.nombre || 'N/A';
        const creatorRole = pass.creator?.rol || 'unknown';
        const creatorLabel = creatorRole === 'groom' ? 'Novio' :
            creatorRole === 'bride' ? 'Novia' : 'Sin asignar';

        return `
            <div class="guest-card" data-status="${status.class}" data-family="${pass.nombre_familia.toLowerCase()}" data-id="${pass.id}" data-creator-role="${creatorRole}">
                <!-- Header -->
                <div class="guest-card-header">
                    <div class="guest-card-title">
                        <h3>${pass.nombre_familia}</h3>
                        <code class="guest-code">${pass.codigo_acceso}</code>
                    </div>
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>

                <!-- Main Info Grid -->
                <div class="guest-card-body">
                    <div class="info-row">
                        <div class="info-item">
                            <label>INVITADOS</label>
                            <span class="info-value">${pass.total_invitados} persona${pass.total_invitados > 1 ? 's' : ''}</span>
                        </div>

                        <div class="info-item">
                            <label>ENTRADA</label>
                            <span class="info-value">
                                <strong>${pass.invitados_ingresados}</strong> de ${pass.total_invitados}
                            </span>
                        </div>

                        <div class="info-item">
                            <label>MESA</label>
                            <span class="info-value">Mesa ${tableNum}</span>
                        </div>
                    </div>

                    <div class="info-row">
                        <div class="info-item">
                            <label>CREADO POR</label>
                            <span class="creator-badge ${creatorRole}">${creatorLabel}: ${creatorName}</span>
                        </div>

                        <div class="info-item">
                            <label>CONFIRMADO</label>
                            <span class="info-value">${confirmedDate}</span>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="guest-card-actions">
                    ${getWhatsAppButton(pass, 'card')}
                    <button class="btn-card edit" onclick="editPass('${pass.id}')" title="Editar invitación">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Editar
                    </button>
                    <button class="btn-card delete" onclick="deletePass('${pass.id}')" title="Eliminar invitación">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Eliminar
                    </button>
                </div>
            </div>
            `;
    }).join('');
}

// Determina el estado de un pase segun sus flags
function getPassStatus(pass) {
    if (pass.todos_ingresaron) {
        return { class: 'complete', text: 'Completo' };
    }
    if (pass.invitados_ingresados > 0) {
        return { class: 'partial', text: 'Parcial' };
    }
    if (pass.confirmado) {
        return { class: 'confirmed', text: 'Confirmado' };
    }
    return { class: 'pending', text: 'Pendiente' };
}

// =============================================
// FILTROS Y BUSQUEDA
// =============================================

// Filtra invitados por estado (todos, confirmados, adentro, pendientes)
function filterGuests(filter) {
    const cards = document.querySelectorAll('.guest-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const status = card.dataset.status;
        let shouldShow = false;

        if (filter === 'all') {
            shouldShow = true;
        } else if (filter === 'confirmed') {
            // Show confirmed, partial, and complete guests (anyone who confirmed)
            shouldShow = ['confirmed', 'partial', 'complete'].includes(status);
        } else if (filter === 'inside') {
            // Show partial and complete guests
            shouldShow = ['partial', 'complete'].includes(status);
        } else if (filter === 'pending') {
            shouldShow = status === 'pending';
        } else {
            // Fallback for exact match
            shouldShow = status === filter;
        }

        if (shouldShow) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    showEmptyState(visibleCount);
}

// Filtra invitados por quien los creo (novio o novia)
function filterByCreator(creatorRole) {
    const cards = document.querySelectorAll('.guest-card');
    let visibleCount = 0;

    cards.forEach(card => {
        if (creatorRole === 'all') {
            card.style.display = '';
            visibleCount++;
        } else {
            if (card.dataset.creatorRole === creatorRole) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        }
    });

    showEmptyState(visibleCount);
}

// Busca invitados por nombre de familia
function searchGuests(query) {
    const cards = document.querySelectorAll('.guest-card');
    const q = query.toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
        if (card.dataset.family.includes(q)) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    showEmptyState(visibleCount);
}

// Muestra/oculta el mensaje de "no se encontraron resultados"
function showEmptyState(visibleCount) {
    const container = document.getElementById('guests-list');
    let emptyState = container.querySelector('.filter-empty-state');

    if (visibleCount === 0) {
        // No results - show empty state
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.className = 'filter-empty-state';
            emptyState.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">-</div>
                <h3>No se encontraron invitados</h3>
                <p>Intenta cambiar los filtros o realiza otra búsqueda</p>
            </div>
            `;
            container.appendChild(emptyState);
        }
        emptyState.style.display = 'block';
    } else {
        // Has results - hide empty state
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
}

// =============================================
// ACCIONES DE PASES — copiar, editar, eliminar
// =============================================

// Copia codigo de pase al portapapeles
function copyPassCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado', 'success');
    });
}

// Abre un modal para editar el pase (nombre, invitados, mesa)
function editPass(passId) {
    const pass = passes.find(p => p.id === passId);
    if (!pass) return;

    // Create or get modal
    let modal = document.getElementById('edit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-modal';
        modal.className = 'table-modal';
        document.body.appendChild(modal);
    }

    const tableNum = pass.mesas?.numero_mesa || '';

    modal.innerHTML = `
            <div class="table-modal-overlay" onclick="closeEditModal()"></div>
            <div class="table-modal-content">
                <button class="table-modal-close" onclick="closeEditModal()">×</button>
                <h2>Editar Pase</h2>
                <p class="modal-subtitle">Código: <code>${pass.codigo_acceso}</code></p>

                <form id="edit-pass-form" class="edit-form">
                    <input type="hidden" id="edit-pass-id" value="${pass.id}">
                        <input type="hidden" id="edit-old-guests" value="${pass.total_invitados}">
                            <input type="hidden" id="edit-old-table" value="${pass.mesa_id}">

                                <div class="form-group">
                                    <label>Nombre de la Familia</label>
                                    <input type="text" id="edit-family" value="${pass.nombre_familia}" required>
                                </div>

                                <div class="form-group">
                                    <label>Número de Invitados</label>
                                    <input type="number" id="edit-guests" value="${pass.total_invitados}" min="1" max="20" required>
                                </div>

                                <div class="form-group">
                                    <label>Mesa</label>
                                    <select id="edit-table" required>
                                        ${tables.map(t => `
                            <option value="${t.id}" ${t.id === pass.mesa_id ? 'selected' : ''}>
                                Mesa ${t.numero_mesa} (${t.capacidad - t.asientos_ocupados} disponibles)
                            </option>
                        `).join('')}
                                    </select>
                                </div>

                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancelar</button>
                                    <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                                </div>
                            </form>
                        </div>
                        `;

    modal.classList.add('active');

    // Add form submit handler
    document.getElementById('edit-pass-form').addEventListener('submit', savePassEdit);
}

// Guarda los cambios del pase editado y reajusta la ocupacion de mesas
async function savePassEdit(e) {
    e.preventDefault();
    const supabase = getSupabase();

    const passId = document.getElementById('edit-pass-id').value;
    const newFamily = document.getElementById('edit-family').value.trim();
    const newGuests = parseInt(document.getElementById('edit-guests').value);
    const newTableId = document.getElementById('edit-table').value;
    const oldGuests = parseInt(document.getElementById('edit-old-guests').value);
    const oldTableId = document.getElementById('edit-old-table').value;

    try {
        // Update guest pass
        await supabase
            .from('pases_invitados')
            .update({
                nombre_familia: newFamily,
                total_invitados: newGuests,
                mesa_id: newTableId
            })
            .eq('id', passId);

        // Update table occupancy if table or guest count changed
        if (newTableId !== oldTableId || newGuests !== oldGuests) {
            // Free old table seats
            if (oldTableId) {
                const oldTable = tables.find(t => t.id === oldTableId);
                if (oldTable) {
                    await supabase
                        .from('mesas')
                        .update({ asientos_ocupados: Math.max(0, oldTable.asientos_ocupados - oldGuests) })
                        .eq('id', oldTableId);
                }
            }

            // Occupy new table seats
            const newTable = tables.find(t => t.id === newTableId);
            if (newTable) {
                await supabase
                    .from('mesas')
                    .update({ asientos_ocupados: newTable.asientos_ocupados + newGuests })
                    .eq('id', newTableId);
            }
        }

        closeEditModal();
        showToast('Pase actualizado correctamente', 'success');
        await loadTables();
        await loadPasses();
        updateStats();

    } catch (error) {
        showToast('Error al actualizar: ' + error.message, 'error');
    }
}

// Cierra el modal de edicion
function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Elimina un pase — borra logs, libera asientos y recarga todo
async function deletePass(passId) {
    if (!confirm('¿Estás seguro de eliminar este pase?')) return;
    const supabase = getSupabase();

    try {
        const pass = passes.find(p => p.id === passId);

        // Update table seats
        if (pass && pass.mesa_id) {
            const table = tables.find(t => t.id === pass.mesa_id);
            if (table) {
                await supabase
                    .from('mesas')
                    .update({ asientos_ocupados: Math.max(0, table.asientos_ocupados - pass.total_invitados) })
                    .eq('id', pass.mesa_id);
            }
        }

        // First delete entry logs to avoid foreign key constraints/persistence issues
        await supabase.from('registros_entrada').delete().eq('pase_id', passId);

        // Then delete the pass
        await supabase.from('pases_invitados').delete().eq('id', passId);

        showToast('Pase eliminado', 'success');
        await loadTables();
        await loadPasses();
        updateStats();

    } catch (error) {
        showToast('Error al eliminar: ' + error.message, 'error');
    }
}

// =============================================
// TOAST — notificaciones temporales
// =============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
                        <span class="toast-icon ${type}"></span>
                        <span>${message}</span>
                        `;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}

// =============================================
// MODAL DE MESA — muestra invitados asignados a una mesa
// =============================================
function showTableGuests(tableId, tableNumber) {
    // Find guests assigned to this table
    const tableGuests = passes.filter(p => p.mesa_id === tableId);

    // Create or get modal
    let modal = document.getElementById('table-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'table-modal';
        modal.className = 'table-modal';
        document.body.appendChild(modal);
    }

    // Build guest list
    let guestListHTML = '';
    if (tableGuests.length === 0) {
        guestListHTML = '<p class="no-guests">No hay invitados asignados a esta mesa</p>';
    } else {
        guestListHTML = `
            <div class="table-guest-list">
                ${tableGuests.map(guest => {
            const status = getPassStatus(guest);
            return `
                        <div class="table-guest-item">
                            <div class="guest-info">
                                <strong>${guest.nombre_familia}</strong>
                                <span class="guest-count">${guest.total_invitados} persona${guest.total_invitados > 1 ? 's' : ''}</span>
                            </div>
                            <div class="guest-status">
                                <span class="status-badge ${status.class}">${status.text}</span>
                                <code>${guest.codigo_acceso}</code>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
            <div class="table-summary">
                <p>Total: <strong>${tableGuests.reduce((sum, g) => sum + g.total_invitados, 0)}</strong> personas</p>
            </div>
        `;
    }

    modal.innerHTML = `
                        <div class="table-modal-overlay" onclick="closeTableModal()"></div>
                        <div class="table-modal-content">
                            <button class="table-modal-close" onclick="closeTableModal()">×</button>
                            <h2>Mesa ${tableNumber}</h2>
                            <p class="modal-subtitle">Invitados asignados</p>
                            ${guestListHTML}
                        </div>
                        `;

    modal.classList.add('active');
}

// Cierra el modal de invitados por mesa
function closeTableModal() {
    const modal = document.getElementById('table-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// =============================================
// CSS DINAMICO
// Estilos que se inyectan con JS porque no estan en el CSS principal
// (lo ideal seria mover esto a dashboard.css pero aqui funciona)
// =============================================
const style = document.createElement('style');
style.textContent = `
                        .dashboard-section {
                            display: none;
    }
                        .dashboard-section.active {
                            display: block;
    }

                        .stat-card.clickable {
                            cursor: pointer;
                        transition: all 0.3s ease;
    }

                        .stat-card.clickable:hover {
                            border - color: var(--primary);
                        transform: translateY(-3px);
                        box-shadow: 0 5px 20px rgba(184, 134, 11, 0.3);
    }

                        .tables-visual-grid {
                            display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: 1rem;
    }

                        .table-item {
                            background: var(--surface-light);
                        border: 1px solid var(--border);
                        border-radius: 10px;
                        padding: 1rem;
                        text-align: center;
    }

                        .table-item.full {
                            border - color: var(--error);
    }

                        .table-item.partial {
                            border - color: var(--warning);
    }

                        .table-number {
                            font - weight: 600;
                        margin-bottom: 0.5rem;
    }

                        .table-occupancy {
                            color: var(--text-muted);
                        font-size: 0.9rem;
                        margin-bottom: 0.5rem;
    }

                        .table-bar {
                            height: 4px;
                        background: var(--surface);
                        border-radius: 2px;
                        overflow: hidden;
    }

                        .table-bar-fill {
                            height: 100%;
                        background: var(--primary);
                        transition: width 0.3s ease;
    }

                        .filter-tabs {
                            display: flex;
                        gap: 0.5rem;
                        margin-bottom: 1.5rem;
                        flex-wrap: wrap;
    }

                        .filter-btn {
                            background: var(--surface-light);
                        border: 1px solid var(--border);
                        color: var(--text-muted);
                        padding: 0.5rem 1rem;
                        border-radius: 25px;
                        cursor: pointer;
                        font-family: var(--font-body);
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
    }

                        .filter-btn:hover,
                        .filter-btn.active {
                            background: var(--primary);
                        border-color: var(--primary);
                        color: var(--text);
    }

                        .search-input {
                            background: var(--surface-light);
                        border: 1px solid var(--border);
                        border-radius: 10px;
                        padding: 0.75rem 1rem;
                        color: var(--text);
                        font-family: var(--font-body);
                        width: 250px;
    }

                        .search-input:focus {
                            outline: none;
                        border-color: var(--primary);
    }

                        .attendance-chart {
                            padding: 1rem 0;
    }

                        .chart-bars {
                            display: flex;
                        justify-content: space-around;
                        align-items: flex-end;
                        height: 150px;
                        gap: 2rem;
    }

                        .chart-bar {
                            display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0.5rem;
    }

                        .bar-fill {
                            width: 60px;
                        border-radius: 5px 5px 0 0;
                        transition: height 0.5s ease;
    }

                        .bar-fill.pending {background: var(--warning); }
                        .bar-fill.confirmed {background: var(--success); }
                        .bar-fill.inside {background: var(--primary); }

                        .bar-label {
                            color: var(--text-muted);
                        font-size: 0.85rem;
    }

                        .bar-value {
                            font - size: 1.5rem;
                        font-weight: 600;
                        color: var(--text);
    }

                        code {
                            background: var(--surface-light);
                        padding: 0.25rem 0.5rem;
                        border-radius: 4px;
                        font-family: 'Courier New', monospace;
                        color: var(--primary);
    }

                        .nav-logout {
                            display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        padding: 1rem;
                        color: var(--error);
                        text-decoration: none;
                        border-radius: 10px;
                        transition: all 0.3s ease;
                        font-size: 0.95rem;
                        width: 100%;
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        font-family: var(--font-body);
                        text-align: left;
    }

                        .nav-logout:hover {
                            background: rgba(231, 76, 60, 0.1);
    }

                        .nav-logout svg {
                            width: 20px;
                        height: 20px;
    }

                        /* Table Modal Styles */
                        .table-modal {
                            position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 1000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        visibility: hidden;
                        transition: all 0.3s ease;
    }

                        .table-modal.active {
                            opacity: 1;
                        visibility: visible;
    }

                        .table-modal-overlay {
                            position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.7);
                        backdrop-filter: blur(5px);
    }

                        .table-modal-content {
                            position: relative;
                        background: var(--surface);
                        border: 1px solid var(--border);
                        border-radius: 20px;
                        padding: 2rem;
                        width: 90%;
                        max-width: 450px;
                        max-height: 80vh;
                        overflow-y: auto;
                        transform: translateY(20px);
                        transition: transform 0.3s ease;
    }

                        .table-modal.active .table-modal-content {
                            transform: translateY(0);
    }

                        .table-modal-close {
                            position: absolute;
                        top: 1rem;
                        right: 1.5rem;
                        background: none;
                        border: none;
                        color: var(--text-muted);
                        font-size: 2rem;
                        cursor: pointer;
                        transition: color 0.3s ease;
    }

                        .table-modal-close:hover {
                            color: var(--error);
    }

                        .table-modal-content h2 {
                            font - family: var(--font-display);
                        font-size: 1.75rem;
                        margin-bottom: 0.25rem;
                        color: var(--primary);
    }

                        .modal-subtitle {
                            color: var(--text-muted);
                        margin-bottom: 1.5rem;
    }

                        .table-guest-list {
                            display: flex;
                        flex-direction: column;
                        gap: 1rem;
    }

                        .table-guest-item {
                            background: var(--surface-light);
                        border: 1px solid var(--border);
                        border-radius: 12px;
                        padding: 1rem;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 1rem;
    }

                        .table-guest-item:hover {
                            border - color: var(--primary);
    }

                        .guest-info {
                            display: flex;
                        flex-direction: column;
                        gap: 0.25rem;
    }

                        .guest-info strong {
                            color: var(--text);
    }

                        .guest-count {
                            color: var(--text-muted);
                        font-size: 0.85rem;
    }

                        .guest-status {
                            display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        gap: 0.5rem;
    }

                        .table-summary {
                            margin - top: 1.5rem;
                        padding-top: 1rem;
                        border-top: 1px solid var(--border);
                        text-align: center;
                        color: var(--text-muted);
    }

                        .table-summary strong {
                            color: var(--primary);
                        font-size: 1.25rem;
    }

                        .no-guests {
                            text - align: center;
                        color: var(--text-muted);
                        padding: 2rem;
                        font-style: italic;
    }

                        .table-item:hover {
                            border - color: var(--primary);
                        transform: translateY(-2px);
    }

                        /* Action buttons */
                        .actions-cell {
                            display: flex;
                        gap: 0.5rem;
                        justify-content: center;
                        align-items: center;
                        white-space: nowrap;
    }

                        .btn-icon {
                            background: transparent;
                        border: 1px solid var(--border);
                        border-radius: 8px;
                        padding: 0.4rem 0.6rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: 0.9rem;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 32px;
                        height: 32px;
    }

                        .btn-icon.edit:hover {
                            border - color: var(--primary);
                        background: rgba(184, 134, 11, 0.1);
    }

                        .btn-icon.delete:hover {
                            border - color: var(--error);
                        background: rgba(231, 76, 60, 0.1);
    }

                        /* Edit Form */
                        .edit-form {
                            display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
    }

                        .edit-form .form-group {
                            display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
    }

                        .edit-form label {
                            color: var(--text-muted);
                        font-size: 0.9rem;
    }

                        .edit-form input,
                        .edit-form select {
                            background: var(--surface-light);
                        border: 1px solid var(--border);
                        border-radius: 10px;
                        padding: 0.875rem 1rem;
                        color: var(--text);
                        font-size: 1rem;
                        font-family: var(--font-body);
    }

                        .edit-form input:focus,
                        .edit-form select:focus {
                            outline: none;
                        border-color: var(--primary);
    }

                        .form-actions {
                            display: flex;
                        gap: 1rem;
                        justify-content: flex-end;
                        margin-top: 1rem;
    }

                        /* User greeting */
                        .user-greeting {
                            color: var(--primary);
                        font-size: 1.1rem;
                        font-weight: 500;
    }

                        .header-left {
                            display: flex;
                        flex-direction: column;
                        gap: 0.25rem;
    }

                        /* Creator badges */
                        .creator-badge {
                            display: inline-block;
                        padding: 0.25rem 0.75rem;
                        border-radius: 15px;
                        font-size: 0.8rem;
                        font-weight: 500;
    }

                        .creator-badge.groom {
                            background: rgba(52, 152, 219, 0.2);
                        color: #3498db;
    }

                        .creator-badge.bride {
                            background: rgba(155, 89, 182, 0.2);
                        color: #9b59b6;
    }

                        .creator-badge.unknown {
                            background: var(--surface-light);
                        color: var(--text-muted);
    }

                        /* Filters row */
                        .filters-row {
                            display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 1rem;
                        margin-bottom: 1.5rem;
    }

                        .creator-filter {
                            display: flex;
                        align-items: center;
                        gap: 0.75rem;
    }

                        .creator-filter label {
                            color: var(--text-muted);
                        font-size: 0.9rem;
    }

                        .creator-filter select {
                            background: var(--surface-light);
                        border: 1px solid var(--border);
                        border-radius: 8px;
                        padding: 0.5rem 1rem;
                        color: var(--text);
                        font-family: var(--font-body);
                        cursor: pointer;
    }

                        .creator-filter select:focus {
                            outline: none;
                        border-color: var(--primary);
    }
                        `;
document.head.appendChild(style);

// =============================================
// MONITOR EN VIVO — tabla de invitados que ya estan adentro
// =============================================
function loadLiveMonitor() {
    // Filter passes that have entered guests
    const activePasses = passes.filter(p => p.invitados_ingresados > 0);

    // Sort by most recent update (approximate entry time)
    // Sort by most recent update (approximate entry time)
    activePasses.sort((a, b) => {
        // Use registos_entrada if available for sorting
        const getLatestLog = (p) => {
            if (p.registros_entrada && p.registros_entrada.length > 0) {
                return p.registros_entrada.reduce((latest, log) => {
                    const d = new Date(log.ingreso_en);
                    return d > latest ? d : latest;
                }, new Date(0));
            }
            return new Date(0);
        };

        return getLatestLog(b) - getLatestLog(a);
    });

    // Update stats
    // Update stats
    const totalInside = passes.reduce((sum, p) => sum + p.invitados_ingresados, 0);
    const totalEl = document.getElementById('live-total-inside');
    const familiesEl = document.getElementById('live-families-inside');

    if (totalEl) totalEl.textContent = totalInside;
    if (familiesEl) familiesEl.textContent = activePasses.length;

    // Render table
    const tbody = document.getElementById('live-guests-list');
    if (!tbody) return;

    if (activePasses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Aún no hay invitados dentro del evento</td></tr>';
        return;
    }

    tbody.innerHTML = activePasses.map(pass => {
        const tableNum = pass.mesas?.numero_mesa || '-';
        const isComplete = pass.invitados_ingresados >= pass.total_invitados;

        // Find latest entry time from logs
        let lastEntryTime = null;
        if (pass.registros_entrada && pass.registros_entrada.length > 0) {
            // Sort to find newest
            const sortedLogs = pass.registros_entrada.sort((a, b) => new Date(b.ingreso_en) - new Date(a.ingreso_en));
            lastEntryTime = sortedLogs[0].ingreso_en;
        }

        const time = lastEntryTime
            ? new Date(lastEntryTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            : '--:--';

        return `
                        <tr>
                            <td data-label="Familia">${pass.nombre_familia}</td>
                            <td data-label="Mesa"><span>Mesa ${tableNum}</span></td>
                            <td data-label="Entrada"><span><strong>${pass.invitados_ingresados}</strong> / ${pass.total_invitados}</span></td>
                            <td data-label="Hora"><span>~ ${time}</span></td>
                            <td data-label="Estatus"><span class="status-badge ${isComplete ? 'complete' : 'partial'}">${isComplete ? 'Completo' : 'Parcial'}</span></td>
                        </tr>
                        `;
    }).join('');
}

// =============================================
// REALTIME — se actualiza solo cuando cambian los pases
// =============================================
function initRealtime() {
    const supabase = getSupabase();
    console.log('Initializing realtime subscription...');

    supabase.channel('admin_dashboard')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'pases_invitados' },
            payload => {
                console.log('Realtime change:', payload);
                loadPasses().then(() => {
                    updateStats();
                    const activeSection = document.querySelector('.sidebar-nav a.active')?.dataset.section;
                    if (activeSection === 'live-monitor') loadLiveMonitor();
                    if (activeSection === 'guests') loadGuests();
                });
            }
        )
        .subscribe();
}

// =============================================
// WHATSAPP — genera un boton con mensaje pre-armado
// para enviar la invitacion por WhatsApp
// =============================================
function getWhatsAppButton(pass, type = 'card') {
    if (!pass.telefono) return '';

    const message = `Hola *${pass.nombre_familia}*, nos da mucha alegría invitarlos a nuestra boda.

                        Para ver los detalles y *confirmar su asistencia*, por favor ingresa a esta página web:
                        https://boda-abi-lupita.vercel.app/

                        Su código de acceso es:
                        *${pass.codigo_acceso}*

                        ¡Esperamos contar con su presencia!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/52${pass.telefono.replace(/\D/g, '')}?text=${encodedMessage}`;

    if (type === 'compact') {
        return `
                        <a href="${whatsappUrl}" target="_blank" class="btn-whatsapp-compact" title="Enviar por WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                        </a>
                        `;
    } else {
        return `
                        <a href="${whatsappUrl}" target="_blank" class="btn-whatsapp" title="Enviar invitación">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            WhatsApp
                        </a>
                        `;
    }
}
