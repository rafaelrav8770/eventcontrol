import urllib.request, urllib.error, json

URL  = 'https://xethjgzynlkrwsirrzsf.supabase.co'
ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGhqZ3p5bmxrcndzaXJyenNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjQ3ODgsImV4cCI6MjA4NjAwMDc4OH0.wD_eGAbyqL9maM4sqqeZ7kuaVcmkAu3VkKW1k0DuYIg'

usuarios = [
    ('abi@miboda.com',       'Abidan2024!',    'Abidan'),
    ('betsi@miboda.com',     'Betsi2024!',     'Betsaida'),
    ('recepcion@miboda.com', 'Recepcion2024!', 'Recepcion'),
]

headers = {'Content-Type': 'application/json', 'apikey': ANON}

for email, password, nombre in usuarios:
    print('Creando ' + email + '...', end=' ')
    body = json.dumps({'email': email, 'password': password}).encode()
    req = urllib.request.Request(URL + '/auth/v1/signup', data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
            user = data.get('user') or data
            uid  = user.get('id', '?')
            print('OK -> id: ' + uid[:8] + '...')
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print('ERROR ' + str(e.code) + ': ' + str(err.get('msg', err.get('message', err))))

print('')
print('Listo! Ahora entra a: http://localhost:8000/admin/')
