// Authentication Module for Admin Portal
// Use supabaseClient from window (loaded by supabase-config.js)

// Check if we're on the login page
const isLoginPage = window.location.pathname.includes('index.html') ||
    window.location.pathname.endsWith('/admin/') ||
    window.location.pathname.endsWith('/admin');

// Check for logout flag
const justLoggedOut = sessionStorage.getItem('justLoggedOut');
if (justLoggedOut) {
    sessionStorage.removeItem('justLoggedOut');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // Only check auth redirect on login page, and not if we just logged out
    if (isLoginPage && loginForm && !justLoggedOut) {
        checkAuth();
        loginForm.addEventListener('submit', handleLogin);
    } else if (isLoginPage && loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function checkAuth() {
    const supabase = window.supabaseClient;
    if (!supabase) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Check if user is a groom or bride
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile && (profile.role === 'groom' || profile.role === 'bride')) {
                window.location.href = 'dashboard.html';
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const supabase = window.supabaseClient;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.querySelector('.login-btn');

    // Disable button during login
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Ingresando...</span>';

    console.log('🔐 Intentando login con:', email);

    try {
        // Step 1: Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('❌ Error de autenticación:', error);
            throw error;
        }

        console.log('✅ Autenticación exitosa. User ID:', data.user.id);

        // Step 2: Check user role
        console.log('🔍 Buscando perfil de usuario...');
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role, first_name, email')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('⚠️ Error al obtener perfil:', profileError);
            console.log('🔧 Creando perfil automáticamente...');

            // Create profile if doesn't exist
            const { error: insertError } = await supabase.from('user_profiles').insert({
                id: data.user.id,
                email: data.user.email,
                first_name: 'Novio/a',
                role: 'groom'
            });

            if (insertError) {
                console.error('❌ Error al crear perfil:', insertError);
                throw new Error('No se pudo crear el perfil de usuario. Verifica las políticas RLS.');
            }

            console.log('✅ Perfil creado exitosamente');
        } else {
            console.log('✅ Perfil encontrado:', profile);
        }

        // Step 3: Redirect based on role
        const userRole = profile ? profile.role : 'groom';
        console.log('🎯 Rol del usuario:', userRole);

        if (userRole === 'access_control') {
            console.log('🚀 Redirigiendo a control de acceso...');
            window.location.href = '../access-control/scanner.html';
        } else {
            console.log('🚀 Redirigiendo a dashboard...');
            window.location.href = 'dashboard.html';
        }

    } catch (error) {
        // Provide helpful error messages
        let errorMessage = 'Error al iniciar sesión';

        if (error.message && error.message.includes('Invalid login credentials')) {
            errorMessage = 'Credenciales inválidas. Verifica tu correo y contraseña, o crea tu cuenta en Supabase Dashboard > Authentication.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        errorEl.textContent = errorMessage;
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Ingresar</span>';
    }
}

// Logout function - properly sign out and prevent auto-login
async function logout() {
    const supabase = window.supabaseClient;

    try {
        // Sign out from Supabase
        await supabase.auth.signOut();

        // Set flag to prevent auto-redirect on login page
        sessionStorage.setItem('justLoggedOut', 'true');

        // Redirect to login
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Force redirect anyway
        sessionStorage.setItem('justLoggedOut', 'true');
        window.location.href = 'index.html';
    }
}
