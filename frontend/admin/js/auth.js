// auth.js — maneja el login del panel admin
// checa si ya hay sesion, y si no, muestra el form de login
// segun el rol te manda al dashboard o al scanner

const supabaseInstance = window.supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // esto solo corre en el login, no en el dashboard
    // (el dashboard tiene su propio check en dashboard.js)
    const isLoginPage = window.location.pathname.endsWith('/admin/index.html')
        || window.location.pathname.endsWith('/admin/')
        || window.location.pathname === '/admin';

    if (!isLoginPage) return;

    // si ya hay sesion activa, lo mandamos segun su rol
    const { data: { session } } = await supabaseInstance.auth.getSession();

    if (session) {
        // ya esta logueado, checamos su rol y redirigimos
        await checkUserRole(session.user.id);
    } else {
        // no hay sesion, mostramos el form de login
        initAuthForm();
    }
});

function initAuthForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button');
        const errorMsg = document.getElementById('error-message');

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Iniciando sesión...';
            errorMsg.style.display = 'none';

            const { data, error } = await supabaseInstance.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            console.log('Login successful:', data);
            await checkUserRole(data.user.id);

        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = 'Credenciales inválidas. Intenta de nuevo.';
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Iniciar Sesión';
        }
    });
}

// busca el perfil del usuario en la tabla perfiles_usuario
// y segun el rol lo manda al lugar correcto
async function checkUserRole(userId) {
    try {
        const { data, error } = await supabaseInstance
            .from('perfiles_usuario')
            .select('rol, nombre, correo')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching role:', error);
            // If strictly needed, maybe sign out
            // await supabaseInstance.auth.signOut();
            return;
        }

        console.log('User profile:', data);

        // si es guardia va al scanner, si no va al dashboard
        if (data.rol === 'access_control') {
            window.location.href = '/access-control/scanner.html';
        } else {
            // novios y admin van al dashboard
            window.location.href = '/admin/dashboard.html';
        }

    } catch (error) {
        console.error('Role check error:', error);
    }
}

// funcion global de logout, se llama desde el boton de cerrar sesion
window.logout = async function () {
    await supabaseInstance.auth.signOut();
    window.location.href = '/admin/index.html';
};
