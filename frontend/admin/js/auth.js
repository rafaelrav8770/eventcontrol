// ============================================
// auth.js — Autenticacion del Portal de Novios
// Maneja login, verificacion de rol (novio/novia/acceso),
// y redireccion al dashboard o al scanner
// ============================================

// Checamos si estamos en la pagina de login
const isLoginPage = window.location.pathname.includes('index.html') ||
    window.location.pathname.endsWith('/admin/') ||
    window.location.pathname.endsWith('/admin');

// Si el usuario acaba de cerrar sesion, no lo redirigimos automaticamente
const justLoggedOut = sessionStorage.getItem('justLoggedOut');
if (justLoggedOut) {
    sessionStorage.removeItem('justLoggedOut');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // Solo checamos auth en la pagina de login (y si no acaba de cerrar sesion)
    if (isLoginPage && loginForm && !justLoggedOut) {
        checkAuth();
        loginForm.addEventListener('submit', handleLogin);
    } else if (isLoginPage && loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Verifica si ya hay sesion activa y redirige al dashboard
async function checkAuth() {
    const supabase = window.supabaseClient;
    if (!supabase) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Checa si es novio o novia para mandarlo directo al dashboard
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

// Maneja el submit del formulario de login
async function handleLogin(e) {
    e.preventDefault();

    const supabase = window.supabaseClient;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('error-message');
    const submitBtn = document.querySelector('.login-btn');

    // Deshabilitamos el boton mientras carga
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Ingresando...</span>';

    console.log('🔐 Intentando login con:', email);

    try {
        // Paso 1: autenticamos con Supabase
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error('❌ Error de autenticación:', error);
            throw error;
        }

        console.log('✅ Autenticación exitosa. User ID:', data.user.id);

        // Paso 2: buscamos el perfil para saber que rol tiene
        console.log('🔍 Buscando perfil de usuario...');
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role, first_name, email')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            // Si no tiene perfil, le creamos uno por default como novio
            console.error('⚠️ Error al obtener perfil:', profileError);
            console.log('🔧 Creando perfil automáticamente...');

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

        // Paso 3: redirigimos segun el rol
        const userRole = profile ? profile.role : 'groom';
        console.log('🎯 Rol del usuario:', userRole);

        if (userRole === 'access_control') {
            // Los de acceso van al scanner de QR
            console.log('🚀 Redirigiendo a control de acceso...');
            window.location.href = '../access-control/scanner.html';
        } else {
            // Novio/novia van al dashboard
            console.log('🚀 Redirigiendo a dashboard...');
            window.location.href = 'dashboard.html';
        }

    } catch (error) {
        // Mostramos un mensaje amigable segun el tipo de error
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

// Cerrar sesion limpiamente y evitar que se auto-loguee al volver
async function logout() {
    const supabase = window.supabaseClient;

    try {
        await supabase.auth.signOut();
        sessionStorage.setItem('justLoggedOut', 'true');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Forzamos redirect aunque falle el signout
        sessionStorage.setItem('justLoggedOut', 'true');
        window.location.href = 'index.html';
    }
}
