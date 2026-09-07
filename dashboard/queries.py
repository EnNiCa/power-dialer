def obtener_cola(cursor, limit=8):
    cursor.execute(
        """
        SELECT c.id, c.nombre, c.telefono
        FROM clientes c
        LEFT JOIN llamadas l ON l.cliente_id = c.id AND l.resultado = 'contestada'
        WHERE l.id IS NULL
        ORDER BY c.id
        LIMIT %s
        """,
        (limit,)
    )
    return cursor.fetchall()


def contar_pendientes(cursor):
    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM clientes c
        LEFT JOIN llamadas l ON l.cliente_id = c.id AND l.resultado = 'contestada'
        WHERE l.id IS NULL
        """
    )
    return cursor.fetchone()['total']
