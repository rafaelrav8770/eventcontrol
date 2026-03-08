"""
crear-usuarios.py

script para crear los usarios del sistema en Supabase Auth
y agregarles su perfil en la tabla perfiles_usuario.

basicamente necesitamos 3 usarios:
  - el novio (admin)
  - la novia (admin)
  - el de recepcion (control de acceso)

para correrlo necesitas el SUPABASE_SERVICE_ROLE_KEY en el .env
esta llave es secreta y tiene permisos de admin en supabase
(no se usa la anon key aca porque esa no puede crear users)

como correrlo: python scripts/crear-usuarios.py
"""

import urllib.request
import urllib.parse
import json
import os

# --- Configuracion de Supabase ---
# esta es la URL del proyecto, no cambia
SUPABASE_URL = "https://xethjgzynlkrwsirrzsf.supabase.co"

# lee las variables del archivo .env
# las parseamos manual porque no usamos la libreria python-dotenv
def leer_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    env = {}
    with open(env_path, 'r') as f:
        for linea in f:
            linea = linea.strip()
            # ignoramos lineas vacias y comentarios
            if '=' in linea and not linea.startswith('#'):
                clave, valor = linea.split('=', 1)
                env[clave.strip()] = valor.strip()
    return env

# --- Lista de usarios que vamos a crear ---
# cada uno tiene su email, contraseña, nombre y rol
USUARIOS = [
    {
        "email":    "abi@miboda.com",
        "password": "Abidan2024!",
        "nombre":   "Abidan",
        "rol":      "groom"   # novio
    },
    {
        "email":    "betsi@miboda.com",
        "password": "Betsi2024!",
        "nombre":   "Betsaida",
        "rol":      "bride"   # novia
    },
    {
        "email":    "recepcion@miboda.com",
        "password": "Recepcion2024!",
        "nombre":   "Recepcion",
        "rol":      "access_control"  # el de la puerta
    }
]

# --- Funciones para hacer peticiones HTTP ---

def peticion(url, datos, headers):
    """hace un POST a la API de Supabase y regresa la respuesta"""
    cuerpo = json.dumps(datos).encode('utf-8')
    req = urllib.request.Request(url, data=cuerpo, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8')), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8')), e.code

def peticion_post_directo(url, datos, headers):
    """wrapper de peticion() con manejo de errores extra"""
    try:
        respuesta, codigo = peticion(url, datos, headers)
        return respuesta, codigo
    except Exception as e:
        return {"error": str(e)}, 500

# --- Funcion principal ---

def main():
    print("=" * 55)
    print("  Creador de usuarios - Boda Abidan & Betsaida")
    print("=" * 55)

    # leemos la service role key del .env
    env = leer_env()
    service_key = env.get('SUPABASE_SERVICE_ROLE_KEY', '')

    # si no la encontro mostramos instrucciones para obtenerla
    if not service_key:
        print("\n❌ ERROR: No se encontro SUPABASE_SERVICE_ROLE_KEY en .env")
        print("\nPasos para obtenerla:")
        print("  1. Ve a https://supabase.com → tu proyecto")
        print("  2. Settings → API")
        print("  3. Copia 'service_role' (secret)")
        print("  4. Agrega en .env → SUPABASE_SERVICE_ROLE_KEY=tu_clave_aqui")
        return

    # headers que necesita la API de admin de supabase
    headers_admin = {
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {service_key}',
        'apikey':        service_key
    }

    uuids_creados = {}  # aqui guardamos los IDs de los usuarios que se crearon

    print("\n📋 Creando usuarios en Supabase Auth...\n")

    # recorremos la lista y creamos cada usuario
    for usuario in USUARIOS:
        print(f"  → {usuario['email']} ({usuario['rol']})...", end=' ')

        datos = {
            "email":    usuario["email"],
            "password": usuario["password"],
            "email_confirm": True   # le decimos a supabase que confirme el email automatico
        }

        respuesta, codigo = peticion_post_directo(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            datos,
            headers_admin
        )

        if codigo in (200, 201):
            uid = respuesta.get('id', '')
            uuids_creados[usuario["email"]] = {
                "id":     uid,
                "nombre": usuario["nombre"],
                "rol":    usuario["rol"]
            }
            print(f"✅ creado (id: {uid[:8]}...)")
        elif codigo == 422 and 'already' in str(respuesta).lower():
            # si ya existia no pasa nada, seguimos
            print(f"⚠️  ya existe (se omite)")
        else:
            print(f"❌ error {codigo}: {respuesta.get('msg', respuesta.get('message', respuesta))}")

    # --- Creamos los perfiles en la tabla perfiles_usuario ---

    if not uuids_creados:
        print("\n⚠️  No se crearon usuarios nuevos. Verifica si ya existen en Supabase.")
        return

    print(f"\n📋 Creando perfiles en la tabla perfiles_usuario...\n")

    # los headers del API REST son un poco diferentes a los del auth
    headers_rest = {
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {service_key}',
        'apikey':        service_key,
        'Prefer':        'resolution=merge-duplicates'  # upsert: si ya existia lo actualiza
    }

    for email, info in uuids_creados.items():
        print(f"  → Perfil de {info['nombre']}...", end=' ')

        perfil = {
            "id":     info["id"],
            "correo": email,
            "nombre": info["nombre"],
            "rol":    info["rol"]
        }

        resp, codigo = peticion_post_directo(
            f"{SUPABASE_URL}/rest/v1/perfiles_usuario",
            perfil,
            headers_rest
        )

        if codigo in (200, 201):
            print("✅ creado")
        else:
            print(f"❌ error {codigo}: {resp}")

    # --- Imprimimos las credenciales al final ---

    print("\n" + "=" * 55)
    print("  ✅ LISTO — Credenciales de acceso:")
    print("=" * 55)
    print(f"  {'URL:':<12} http://localhost:8000/admin/")
    print()
    for u in USUARIOS:
        print(f"  Email:    {u['email']}")
        print(f"  Password: {u['password']}")
        print()

if __name__ == "__main__":
    main()
