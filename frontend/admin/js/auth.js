const supabaseInstance = window.supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // Solo ejecutar la logica de redireccion en la pagina de login (index.html),
    // NO en el dashboard (que tiene su propio chequeo en dashboard.js).
    const isLoginPage = window.location.pathname.endsWith('/admin/index.html')
        || window.location.pathname.endsWith('/admin/')
        || window.location.pathname === '/admin';

    if (!isLoginPage) return;

    // Check current session
    const { data: { session } } = await supabaseInstance.auth.getSession();

    if (session) {
        // User is logged in, redirect based on role
        await checkUserRole(session.user.id);
    } else {
        // Init auth UI
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

        // Redirect logic
        if (data.rol === 'access_control') {
            window.location.href = '/access-control/scanner.html';
        } else {
            // Admin, groom, bride go to dashboard
            window.location.href = '/admin/dashboard.html';
        }

    } catch (error) {
        console.error('Role check error:', error);
    }
}

// Global logout function
window.logout = async function () {
    await supabaseInstance.auth.signOut();
    window.location.href = '/admin/index.html';
};
