"""
crear-usuarios.py
Crea los 3 usuarios del sistema en Supabase Auth
y sus perfiles en la tabla perfiles_usuario.

Requiere: SUPABASE_SERVICE_ROLE_KEY en el archivo .env
"""

import urllib.request
import urllib.parse
import json
import os

# ─── Configuracion ───────────────────────────────────────────────────────────

SUPABASE_URL = "https://xethjgzynlkrwsirrzsf.supabase.co"

# Lee la service role key del .env
def leer_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    env = {}
    with open(env_path, 'r') as f:
        for linea in f:
            linea = linea.strip()
            if '=' in linea and not linea.startswith('#'):
                clave, valor = linea.split('=', 1)
                env[clave.strip()] = valor.strip()
    return env

# ─── Usuarios a crear ────────────────────────────────────────────────────────

USUARIOS = [
    {
        "email":    "abi@miboda.com",
        "password": "Abidan2024!",
        "nombre":   "Abidan",
        "rol":      "groom"
    },
    {
        "email":    "betsi@miboda.com",
        "password": "Betsi2024!",
        "nombre":   "Betsaida",
        "rol":      "bride"
    },
    {
        "email":    "recepcion@miboda.com",
        "password": "Recepcion2024!",
        "nombre":   "Recepcion",
        "rol":      "access_control"
    }
]

# ─── Funciones helper ─────────────────────────────────────────────────────────

def peticion(url, datos, headers):
    """Hace una peticion POST a la API de Supabase"""
    cuerpo = json.dumps(datos).encode('utf-8')
    req = urllib.request.Request(url, data=cuerpo, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8')), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8')), e.code

def peticion_post_directo(url, datos, headers):
    """POST con manejo de errores extendido"""
    try:
        respuesta, codigo = peticion(url, datos, headers)
        return respuesta, codigo
    except Exception as e:
        return {"error": str(e)}, 500

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("  Creador de usuarios - Boda Abidan & Betsaida")
    print("=" * 55)

    env = leer_env()
    service_key = env.get('SUPABASE_SERVICE_ROLE_KEY', '')

    if not service_key:
        print("\n❌ ERROR: No se encontro SUPABASE_SERVICE_ROLE_KEY en .env")
        print("\nPasos para obtenerla:")
        print("  1. Ve a https://supabase.com → tu proyecto")
        print("  2. Settings → API")
        print("  3. Copia 'service_role' (secret)")
        print("  4. Agrega en .env → SUPABASE_SERVICE_ROLE_KEY=tu_clave_aqui")
        return

    headers_admin = {
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {service_key}',
        'apikey':        service_key
    }

    uuids_creados = {}

    print("\n📋 Creando usuarios en Supabase Auth...\n")

    for usuario in USUARIOS:
        print(f"  → {usuario['email']} ({usuario['rol']})...", end=' ')

        datos = {
            "email":    usuario["email"],
            "password": usuario["password"],
            "email_confirm": True   # confirma el email automaticamente
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
            print(f"⚠️  ya existe (se omite)")
        else:
            print(f"❌ error {codigo}: {respuesta.get('msg', respuesta.get('message', respuesta))}")

    # ─── Crear perfiles ───────────────────────────────────────────────────────

    if not uuids_creados:
        print("\n⚠️  No se crearon usuarios nuevos. Verifica si ya existen en Supabase.")
        return

    print(f"\n📋 Creando perfiles en la tabla perfiles_usuario...\n")

    headers_rest = {
        'Content-Type':  'application/json',
        'Authorization': f'Bearer {service_key}',
        'apikey':        service_key,
        'Prefer':        'resolution=merge-duplicates'
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

    # ─── Resumen final ────────────────────────────────────────────────────────

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
