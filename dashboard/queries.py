def obtener_cola(cursor, limit=8):
    cursor.execute(
        """
        SELECT c.id, c.nombre, c.telefono
        FROM clientes c
        LEFT JOIN llamadas l ON l.cliente_id = c.id
            AND (l.resultado = 'contestada' OR DATE(l.fecha_hora) = CURDATE())
        WHERE l.id IS NULL
        ORDER BY c.id
        LIMIT %s
        """,
        (limit,)
    )
    return cursor.fetchall()


def cliente_existe(cursor, cliente_id):
    cursor.execute("SELECT id FROM clientes WHERE id = %s", (cliente_id,))
    return cursor.fetchone() is not None


def contar_pendientes(cursor):
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM clientes c
        LEFT JOIN llamadas l ON l.cliente_id = c.id
            AND (l.resultado = 'contestada' OR DATE(l.fecha_hora) = CURDATE())
        WHERE l.id IS NULL
        """
    )
    return cursor.fetchone()['total']


def obtener_historial(cursor, usuario_id=None, limit=200):
    condiciones = []
    parametros = []
    if usuario_id is not None:
        condiciones.append("l.usuario_id = %s")
        parametros.append(usuario_id)
    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    parametros.append(limit)

    cursor.execute(
        f"""
        SELECT l.fecha_hora, l.resultado, l.duracion_segundos,
               c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
               u.nombre AS agente_nombre
        FROM llamadas l
        JOIN clientes c ON c.id = l.cliente_id
        JOIN usuarios u ON u.id = l.usuario_id
        {where}
        ORDER BY l.fecha_hora DESC
        LIMIT %s
        """,
        parametros
    )
    return cursor.fetchall()


def obtener_actividad_hoy(cursor, usuario_id=None, limit=30):
    condiciones = ["DATE(l.fecha_hora) = CURDATE()"]
    parametros = []
    if usuario_id is not None:
        condiciones.append("l.usuario_id = %s")
        parametros.append(usuario_id)
    where = f"WHERE {' AND '.join(condiciones)}"
    parametros.append(limit)

    cursor.execute(
        f"""
        SELECT l.modo, l.resultado, l.fecha_hora,
               c.id AS cliente_id, c.nombre, c.telefono
        FROM llamadas l
        JOIN clientes c ON c.id = l.cliente_id
        {where}
        ORDER BY l.fecha_hora DESC
        LIMIT %s
        """,
        parametros
    )
    return cursor.fetchall()


def obtener_historial_cliente(cursor, cliente_id, limit=10):
    cursor.execute(
        """
        SELECT fecha_hora, resultado
        FROM llamadas
        WHERE cliente_id = %s
        ORDER BY fecha_hora DESC
        LIMIT %s
        """,
        (cliente_id, limit)
    )
    return cursor.fetchall()


def obtener_clientes(cursor, limit=500):
    cursor.execute(
        """
        SELECT c.id, c.nombre, c.telefono,
               EXISTS (
                   SELECT 1 FROM llamadas l
                   WHERE l.cliente_id = c.id AND l.resultado = 'contestada'
               ) AS contactado
        FROM clientes c
        ORDER BY c.nombre
        LIMIT %s
        """,
        (limit,)
    )
    return cursor.fetchall()


def buscar_clientes(cursor, texto, limit=8):
    comodin = f"%{texto}%"
    cursor.execute(
        """
        SELECT id, nombre, telefono
        FROM clientes
        WHERE nombre LIKE %s OR telefono LIKE %s
        ORDER BY nombre
        LIMIT %s
        """,
        (comodin, comodin, limit)
    )
    return cursor.fetchall()


def upsert_cliente(cursor, nombre, telefono):
    """Inserta o actualiza un cliente por teléfono.

    Devuelve el rowcount que reporta MySQL para INSERT ... ON DUPLICATE KEY
    UPDATE: 1 si se insertó una fila nueva, 2 si se actualizó una existente,
    0 si la fila ya tenía esos mismos valores.
    """
    cursor.execute(
        """
        INSERT INTO clientes (nombre, telefono)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)
        """,
        (nombre, telefono)
    )
    return cursor.rowcount
