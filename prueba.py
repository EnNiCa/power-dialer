import unicodedata

def quitar_tildes(texto):
    # Protegemos la ñ/Ñ temporalmente para que NFKD no la toque
    texto = texto.replace('ñ', '\x01').replace('Ñ', '\x02')
    
    forma_descompuesta = unicodedata.normalize('NFKD', texto)
    sin_tildes = ''.join(c for c in forma_descompuesta if not unicodedata.combining(c))
    
    # Restauramos la ñ/Ñ
    return sin_tildes.replace('\x01', 'ñ').replace('\x02', 'Ñ')

print(quitar_tildes("González"))  # → "Gonzalez"
print(quitar_tildes("Muñoz"))     # → "Muñoz"  (¡la ñ se mantiene!)
print(quitar_tildes("año"))       # → "año"    (se mantiene distinto de "ano")