// Dashboard Module
// Get Supabase client from window
function getSupabase() {
    return window.supabaseClient;
}

// State
let currentUser = null;
let userProfile = null;
let eventConfig = null;
let tables = [];
let passes = [];
let userProfiles = {}; // Cache of user profiles
let isInitialized = false;
let tableTypes = []; // [{capacity: 10, quantity: 5}, ...]

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    if (isInitialized) return;
    isInitialized = true;

    const hasAuth = await checkDashboardAuth();
    if (!hasAuth) return;

    await loadUserProfile();
    initNavigation();
    await loadDashboardData();
    initForms();
    updateCurrentDate();
    updateUserGreeting();
});

// Check authentication for dashboard
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

// Load user profile
async function loadUserProfile() {
    const supabase = getSupabase();
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        userProfile = profile;
    }
}

// Update greeting with user name
function updateUserGreeting() {
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl && userProfile) {
        greetingEl.textContent = `Hola, ${userProfile.first_name}`;
    }
}

// Navigation
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

// Navigate to section (for clickable stat cards)
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

// Update current date display
function updateCurrentDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = new Date().toLocaleDateString('es-MX', options);
    }
}

// Load all dashboard data
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
// Load event configuration
async function loadEventConfig() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('event_config')
        .select('*')
        .limit(1)
        .single();

    if (data) {
        eventConfig = data;
    } else {
        // Create default config
        const { data: newConfig } = await getSupabase()
            .from('event_config')
            .insert({ total_tables: 10, seats_per_table: 8 })
            .select()
            .single();

        eventConfig = newConfig;
    }
}

// Load tables
async function loadTables() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');

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

// Update tables count display
function updateTablesCount() {
    const countEl = document.getElementById('total-tables-count');
    const capacityEl = document.getElementById('total-capacity');

    if (countEl) countEl.textContent = tables.length;
    if (capacityEl) {
        const total = tables.reduce((sum, t) => sum + t.capacity, 0);
        capacityEl.textContent = total;
    }

    // Show/hide bulk delete button
    const bulkActions = document.getElementById('tables-bulk-actions');
    if (bulkActions) {
        const hasEmptyTables = tables.some(t => t.occupied_seats === 0);
        bulkActions.style.display = hasEmptyTables ? 'block' : 'none';
    }
}

// Load passes
async function loadPasses() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('guest_passes')
        .select(`*, tables (table_number)`)
        .order('created_at', { ascending: false });

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

// Load creator profiles for all passes
async function loadCreatorProfiles() {
    const supabase = getSupabase();

    // Get unique creator IDs
    const creatorIds = [...new Set(passes.map(p => p.created_by).filter(Boolean))];

    console.log('Loading creator profiles for IDs:', creatorIds);

    if (creatorIds.length === 0) {
        console.log('No creator IDs found');
        return;
    }

    const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, role')
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
            if (pass.created_by && userProfiles[pass.created_by]) {
                pass.creator = userProfiles[pass.created_by];
            }
        });

        // Update filter counts
        updateCreatorFilterCounts();
    }
}

// Update creator filter counts
function updateCreatorFilterCounts() {
    let totalGuests = 0;
    let groomGuests = 0;
    let brideGuests = 0;

    passes.forEach(pass => {
        const guests = pass.total_guests || 0;
        totalGuests += guests;

        if (pass.creator) {
            if (pass.creator.role === 'groom') {
                groomGuests += guests;
            } else if (pass.creator.role === 'bride') {
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

// Update statistics
function updateStats() {
    document.getElementById('stat-tables').textContent = tables.length;
    document.getElementById('stat-passes').textContent = passes.length;

    const confirmed = passes.filter(p => p.confirmed).length;
    document.getElementById('stat-confirmed').textContent = confirmed;

    const totalGuests = passes.reduce((sum, p) => sum + p.total_guests, 0);
    document.getElementById('stat-guests').textContent = totalGuests;

    // Update chart
    const pending = passes.filter(p => !p.confirmed).length;
    const inside = passes.filter(p => p.guests_entered > 0).length;

    document.getElementById('chart-pending').textContent = pending;
    document.getElementById('chart-confirmed').textContent = confirmed;
    document.getElementById('chart-inside').textContent = inside;

    // Update total capacity
    const capacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    document.getElementById('total-capacity').textContent = capacity;
}

// Render tables visual grid
function renderTablesGrid() {
    const container = document.getElementById('tables-grid');
    if (!container) return;

    container.innerHTML = tables.map(table => {
        const occupiedPercent = (table.occupied_seats / table.capacity) * 100;
        const statusClass = occupiedPercent >= 100 ? 'full' :
            occupiedPercent >= 50 ? 'partial' : 'empty';

        return `
            <div class="table-item ${statusClass}" onclick="showTableGuests('${table.id}', ${table.table_number})" style="cursor: pointer;">
                <div class="table-number">Mesa ${table.table_number}</div>
                <div class="table-occupancy">
                    ${table.occupied_seats} / ${table.capacity}
                </div>
                <div class="table-bar">
                    <div class="table-bar-fill" style="width: ${occupiedPercent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Populate table select dropdown
function populateTableSelect() {
    const select = document.getElementById('table-select');
    const guestInput = document.getElementById('guest-count');
    if (!select) return;

    const requiredSeats = guestInput ? parseInt(guestInput.value) || 1 : 1;
    const currentSelection = select.value;

    select.innerHTML = '<option value="">Selecciona una mesa</option>' +
        tables.map(table => {
            const available = table.capacity - table.occupied_seats;
            // Show all tables, but disable if not enough space
            const isEnoughSpace = available >= requiredSeats;
            const disabled = !isEnoughSpace ? 'disabled' : '';
            const statusText = available === 0 ? 'llena' : `${available} lugares disponibles`;

            return `<option value="${table.id}" ${disabled}>
                Mesa ${table.table_number} (${statusText})
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

// Initialize forms
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

// ==================== SIMPLE TABLE MANAGEMENT ====================

// Render the list of tables with delete buttons
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
        const isOccupied = table.occupied_seats > 0;
        const statusClass = isOccupied ? 'occupied' : 'empty';
        const guestsAssigned = passes.filter(p => p.table_id === table.id);
        const totalGuests = guestsAssigned.reduce((sum, p) => sum + p.total_guests, 0);

        return `
            <div class="table-list-item ${statusClass}" onclick="showTableGuests('${table.id}', ${table.table_number})" style="cursor: pointer;">
                <div class="table-info">
                    <span class="table-number">Mesa ${table.table_number}</span>
                    <span class="table-capacity">${table.capacity} personas</span>
                    ${isOccupied ? `<span class="table-occupied">${guestsAssigned.length} familia${guestsAssigned.length > 1 ? 's' : ''} (${totalGuests} personas)</span>` : '<span class="table-empty-label">Sin asignar</span>'}
                </div>
                <div class="table-actions">
                    <button type="button" 
                        class="btn-view-table"
                        onclick="event.stopPropagation(); showTableGuests('${table.id}', ${table.table_number})"
                        title="Ver invitados">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button type="button" 
                        onclick="event.stopPropagation(); deleteSingleTable('${table.id}', ${table.table_number}, ${isOccupied})" 
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

// Add a single table
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
        ? Math.max(...tables.map(t => t.table_number)) + 1
        : 1;

    try {
        const { error } = await supabase
            .from('tables')
            .insert([{
                table_number: nextNumber,
                capacity: capacity,
                occupied_seats: 0
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

// Add multiple tables at once
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
        ? Math.max(...tables.map(t => t.table_number)) + 1
        : 1;

    const newTables = [];
    for (let i = 0; i < quantity; i++) {
        newTables.push({
            table_number: nextNumber++,
            capacity: capacity,
            occupied_seats: 0
        });
    }

    try {
        const { error } = await supabase
            .from('tables')
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

// Custom confirmation modal
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

// Delete a single table
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
                    .from('guest_passes')
                    .update({ table_id: null })
                    .eq('table_id', tableId);

                if (unassignError) throw unassignError;
            }

            // Delete the table
            const { error } = await supabase
                .from('tables')
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

// Delete all empty tables
async function deleteAllEmptyTables() {
    const emptyTables = tables.filter(t => t.occupied_seats === 0);

    if (emptyTables.length === 0) {
        showToast('No hay mesas vacías para eliminar', 'info');
        return;
    }

    showConfirmModal(`¿Eliminar ${emptyTables.length} mesa(s) vacías?`, async () => {
        const supabase = getSupabase();

        try {
            const { error } = await supabase
                .from('tables')
                .delete()
                .eq('occupied_seats', 0);

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

// Generate unique 4-character code
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Handle create pass
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

    const available = table.capacity - table.occupied_seats;
    if (guestCount > available) {
        showToast(`La Mesa ${table.table_number} solo tiene ${available} lugares disponibles`, 'error');
        return;
    }

    try {
        // Generate unique code
        let code = generateCode();
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            const { data } = await supabase
                .from('guest_passes')
                .select('id')
                .eq('access_code', code)
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
            .from('guest_passes')
            .insert({
                access_code: code,
                family_name: familyName,
                total_guests: guestCount,
                table_id: tableId,
                created_by: currentUser.id,
                phone: phone || null
            })
            .single();

        if (error) throw error;

        // Update table occupied seats
        const table = tables.find(t => t.id === tableId);
        await supabase
            .from('tables')
            .update({ occupied_seats: table.occupied_seats + guestCount })
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

// Copy code to clipboard
function copyCode() {
    const code = document.getElementById('pass-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado al portapapeles', 'success');
    });
}

// Load recent passes with compact card design
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
        const tableNum = pass.tables?.table_number || '-';

        return `
            <div class="recent-pass-card">
                <div class="recent-pass-info">
                    <div class="recent-pass-header">
                        <span class="recent-pass-family">${pass.family_name}</span>
                        <code class="recent-pass-code">${pass.access_code}</code>
                    </div>
                    <div class="recent-pass-details">
                        <span class="detail-item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            ${pass.total_guests}
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
                <button class="btn-copy-compact" onclick="copyPassCode('${pass.access_code}')" title="Copiar código">
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

// Load guests list with improved card-based design
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
        const tableNum = pass.tables?.table_number || '-';
        const confirmedDate = pass.confirmed_at
            ? new Date(pass.confirmed_at).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
            : '-';
        // Debug: Log creator info
        if (!pass.creator) {
            console.warn('No creator data for pass:', pass.access_code, 'created_by:', pass.created_by);
        }

        const creatorName = pass.creator?.first_name || 'N/A';
        const creatorRole = pass.creator?.role || 'unknown';
        const creatorLabel = creatorRole === 'groom' ? 'Novio' :
            creatorRole === 'bride' ? 'Novia' : 'Sin asignar';

        return `
            <div class="guest-card" data-status="${status.class}" data-family="${pass.family_name.toLowerCase()}" data-id="${pass.id}" data-creator-role="${creatorRole}">
                <!-- Header -->
                <div class="guest-card-header">
                    <div class="guest-card-title">
                        <h3>${pass.family_name}</h3>
                        <code class="guest-code">${pass.access_code}</code>
                    </div>
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>

                <!-- Main Info Grid -->
                <div class="guest-card-body">
                    <div class="info-row">
                        <div class="info-item">
                            <label>INVITADOS</label>
                            <span class="info-value">${pass.total_guests} persona${pass.total_guests > 1 ? 's' : ''}</span>
                        </div>
                        
                        <div class="info-item">
                            <label>ENTRADA</label>
                            <span class="info-value">
                                <strong>${pass.guests_entered}</strong> de ${pass.total_guests}
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

// Get pass status
function getPassStatus(pass) {
    if (pass.all_entered) {
        return { class: 'complete', text: 'Completo' };
    }
    if (pass.guests_entered > 0) {
        return { class: 'partial', text: 'Parcial' };
    }
    if (pass.confirmed) {
        return { class: 'confirmed', text: 'Confirmado' };
    }
    return { class: 'pending', text: 'Pendiente' };
}

// Filter guests by status
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

// Filter guests by creator
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

// Search guests
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

// Show/hide empty state message
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

// Copy pass code
function copyPassCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado', 'success');
    });
}

// Edit pass - show modal
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

    const tableNum = pass.tables?.table_number || '';

    modal.innerHTML = `
        <div class="table-modal-overlay" onclick="closeEditModal()"></div>
        <div class="table-modal-content">
            <button class="table-modal-close" onclick="closeEditModal()">×</button>
            <h2>Editar Pase</h2>
            <p class="modal-subtitle">Código: <code>${pass.access_code}</code></p>
            
            <form id="edit-pass-form" class="edit-form">
                <input type="hidden" id="edit-pass-id" value="${pass.id}">
                <input type="hidden" id="edit-old-guests" value="${pass.total_guests}">
                <input type="hidden" id="edit-old-table" value="${pass.table_id}">
                
                <div class="form-group">
                    <label>Nombre de la Familia</label>
                    <input type="text" id="edit-family" value="${pass.family_name}" required>
                </div>
                
                <div class="form-group">
                    <label>Número de Invitados</label>
                    <input type="number" id="edit-guests" value="${pass.total_guests}" min="1" max="20" required>
                </div>
                
                <div class="form-group">
                    <label>Mesa</label>
                    <select id="edit-table" required>
                        ${tables.map(t => `
                            <option value="${t.id}" ${t.id === pass.table_id ? 'selected' : ''}>
                                Mesa ${t.table_number} (${t.capacity - t.occupied_seats} disponibles)
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

// Save pass edit
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
            .from('guest_passes')
            .update({
                family_name: newFamily,
                total_guests: newGuests,
                table_id: newTableId
            })
            .eq('id', passId);

        // Update table occupancy if table or guest count changed
        if (newTableId !== oldTableId || newGuests !== oldGuests) {
            // Free old table seats
            if (oldTableId) {
                const oldTable = tables.find(t => t.id === oldTableId);
                if (oldTable) {
                    await supabase
                        .from('tables')
                        .update({ occupied_seats: Math.max(0, oldTable.occupied_seats - oldGuests) })
                        .eq('id', oldTableId);
                }
            }

            // Occupy new table seats
            const newTable = tables.find(t => t.id === newTableId);
            if (newTable) {
                await supabase
                    .from('tables')
                    .update({ occupied_seats: newTable.occupied_seats + newGuests })
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

// Close edit modal
function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Delete pass
async function deletePass(passId) {
    if (!confirm('¿Estás seguro de eliminar este pase?')) return;
    const supabase = getSupabase();

    try {
        const pass = passes.find(p => p.id === passId);

        // Update table seats
        if (pass && pass.table_id) {
            const table = tables.find(t => t.id === pass.table_id);
            if (table) {
                await supabase
                    .from('tables')
                    .update({ occupied_seats: Math.max(0, table.occupied_seats - pass.total_guests) })
                    .eq('id', pass.table_id);
            }
        }

        // First delete entry logs to avoid foreign key constraints/persistence issues
        await supabase.from('entry_logs').delete().eq('guest_pass_id', passId);

        // Then delete the pass
        await supabase.from('guest_passes').delete().eq('id', passId);

        showToast('Pase eliminado', 'success');
        await loadTables();
        await loadPasses();
        updateStats();

    } catch (error) {
        showToast('Error al eliminar: ' + error.message, 'error');
    }
}

// Toast notifications
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

// Show guests for a specific table
function showTableGuests(tableId, tableNumber) {
    // Find guests assigned to this table
    const tableGuests = passes.filter(p => p.table_id === tableId);

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
                                <strong>${guest.family_name}</strong>
                                <span class="guest-count">${guest.total_guests} persona${guest.total_guests > 1 ? 's' : ''}</span>
                            </div>
                            <div class="guest-status">
                                <span class="status-badge ${status.class}">${status.text}</span>
                                <code>${guest.access_code}</code>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
            <div class="table-summary">
                <p>Total: <strong>${tableGuests.reduce((sum, g) => sum + g.total_guests, 0)}</strong> personas</p>
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

// Close table modal
function closeTableModal() {
    const modal = document.getElementById('table-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Add additional CSS for dashboard elements
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
        border-color: var(--primary);
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
        border-color: var(--error);
    }
    
    .table-item.partial {
        border-color: var(--warning);
    }
    
    .table-number {
        font-weight: 600;
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
    
    .bar-fill.pending { background: var(--warning); }
    .bar-fill.confirmed { background: var(--success); }
    .bar-fill.inside { background: var(--primary); }
    
    .bar-label {
        color: var(--text-muted);
        font-size: 0.85rem;
    }
    
    .bar-value {
        font-size: 1.5rem;
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
        font-family: var(--font-display);
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
        border-color: var(--primary);
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
        margin-top: 1.5rem;
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
        text-align: center;
        color: var(--text-muted);
        padding: 2rem;
        font-style: italic;
    }
    
    .table-item:hover {
        border-color: var(--primary);
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
        border-color: var(--primary);
        background: rgba(184, 134, 11, 0.1);
    }
    
    .btn-icon.delete:hover {
        border-color: var(--error);
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

// Load Live Monitor Data
function loadLiveMonitor() {
    // Filter passes that have entered guests
    const activePasses = passes.filter(p => p.guests_entered > 0);

    // Sort by most recent update (approximate entry time)
    // Sort by most recent update (approximate entry time)
    activePasses.sort((a, b) => {
        // Use entry_logs if available for sorting
        const getLatestLog = (p) => {
            if (p.entry_logs && p.entry_logs.length > 0) {
                return p.entry_logs.reduce((latest, log) => {
                    const d = new Date(log.entered_at);
                    return d > latest ? d : latest;
                }, new Date(0));
            }
            return new Date(0);
        };

        return getLatestLog(b) - getLatestLog(a);
    });

    // Update stats
    // Update stats
    const totalInside = passes.reduce((sum, p) => sum + p.guests_entered, 0);
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
        const tableNum = pass.tables?.table_number || '-';
        const isComplete = pass.guests_entered >= pass.total_guests;

        // Find latest entry time from logs
        let lastEntryTime = null;
        if (pass.entry_logs && pass.entry_logs.length > 0) {
            // Sort to find newest
            const sortedLogs = pass.entry_logs.sort((a, b) => new Date(b.entered_at) - new Date(a.entered_at));
            lastEntryTime = sortedLogs[0].entered_at;
        }

        const time = lastEntryTime
            ? new Date(lastEntryTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            : '--:--';

        return `
            <tr>
                <td data-label="Familia">${pass.family_name}</td>
                <td data-label="Mesa"><span>Mesa ${tableNum}</span></td>
                <td data-label="Entrada"><span><strong>${pass.guests_entered}</strong> / ${pass.total_guests}</span></td>
                <td data-label="Hora"><span>~ ${time}</span></td>
                <td data-label="Estatus"><span class="status-badge ${isComplete ? 'complete' : 'partial'}">${isComplete ? 'Completo' : 'Parcial'}</span></td>
            </tr>
        `;
    }).join('');
}

// Initialize Realtime Subscription
function initRealtime() {
    const supabase = getSupabase();
    console.log('Initializing realtime subscription...');

    supabase.channel('admin_dashboard')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'guest_passes' },
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

// Helper to generate WhatsApp button
function getWhatsAppButton(pass, type = 'card') {
    if (!pass.phone) return '';

    const message = `Hola *${pass.family_name}*, nos da mucha alegría invitarlos a nuestra boda.

Para ver los detalles y *confirmar su asistencia*, por favor ingresa a esta página web:
https://boda-abi-lupita.vercel.app/

Su código de acceso es:
*${pass.access_code}*

¡Esperamos contar con su presencia!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/52${pass.phone.replace(/\D/g, '')}?text=${encodedMessage}`;

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
