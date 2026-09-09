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


def cliente_esta_pendiente(cursor, cliente_id):
    cursor.execute(
        """
        SELECT c.id
        FROM clientes c
        LEFT JOIN llamadas l ON l.cliente_id = c.id
            AND (l.resultado = 'contestada' OR DATE(l.fecha_hora) = CURDATE())
        WHERE c.id = %s AND l.id IS NULL
        """,
        (cliente_id,)
    )
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
