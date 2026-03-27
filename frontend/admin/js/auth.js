// auth.js
// maneja el inicio de sesion del panel de administracion
// primero checa si ya hay una sesion activa, y si no muestra el formulario de login
// dependiendo del rol del usuario lo redirige al dashboard o al scanner

// sacamos la instancia de supabase que ya se creo en supabase-config.js
const supabaseInstance = window.supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // este codigo solo corre en la pagina de login, no en el dashboard
    // (el dashboard tiene su propia verificacion en dashboard.js)
    const isLoginPage = window.location.pathname.endsWith('/admin/index.html')
        || window.location.pathname.endsWith('/admin/')
        || window.location.pathname === '/admin';

    if (!isLoginPage) return; // si no es la pagina de login no hacemos nada

    // revisamos si ya hay una sesion activa guardada
    const { data: { session } } = await supabaseInstance.auth.getSession();

    if (session) {
        // ya esta logeado, vemos su rol y lo mandamos al lugar correcto
        await checkUserRole(session.user.id);
    } else {
        // no hay sesion, mostremos el form de login
        initAuthForm();
    }
});

// configura el formulario de login para manejar el envio
function initAuthForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // evitamos que recargue la pagina

        // sacamos los valores del formulario
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button');
        const errorMsg = document.getElementById('error-message');

        try {
            // deshabilitamos el boton mientras procesa
            submitBtn.disabled = true;
            submitBtn.textContent = 'Iniciando sesión...';
            errorMsg.style.display = 'none';

            // intentamos iniciar sesion con email y contraseña
            const { data, error } = await supabaseInstance.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error; // si hay error lo mandamos al catch

            console.log('Login successful:', data);
            await checkUserRole(data.user.id); // redirigimos segun el rol

        } catch (error) {
            // si fallo el login mostramos el mensaje de error
            console.error('Login error:', error);
            errorMsg.textContent = 'Credenciales inválidas. Intenta de nuevo.';
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Iniciar Sesión';
        }
    });
}

// busca el perfil del usuario en la tabla perfiles_usuario
// y dependiendo del rol lo redirige a la pagina que le corresponde
async function checkUserRole(userId) {
    try {
        const { data, error } = await supabaseInstance
            .from('perfiles_usuario')
            .select('rol, nombre, correo')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching role:', error);
            return;
        }

        console.log('User profile:', data);

        // si es el de control de acceso (el que escanea) va al scanner
        // si es novio, novia o admin va al dashboard
        if (data.rol === 'access_control') {
            window.location.href = '/access-control/scanner.html';
        } else {
            window.location.href = '/admin/dashboard.html';
        }

    } catch (error) {
        console.error('Role check error:', error);
    }
}

// funcion de logout — se llama desde el boton de cerrar sesion en el nav
// es global (window) para poder usarla desde el HTML
window.logout = async function () {
    await supabaseInstance.auth.signOut();
    window.location.href = '/admin/index.html';
};
