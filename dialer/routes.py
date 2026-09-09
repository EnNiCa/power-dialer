from flask import Blueprint, request, jsonify, session
from db import get_connection
from auth.decoradores import login_required
from auth.csrf import require_csrf
from dashboard.queries import obtener_cola, cliente_existe

dialer_bp = Blueprint('dialer', __name__, url_prefix='/dialer')

RESULTADOS_VALIDOS = {'contestada', 'no_contesta', 'buzon', 'ocupado'}


@dialer_bp.route('/siguiente')
@login_required
def siguiente():
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)
    cola = obtener_cola(cursor, limit=1)
    cursor.close()
    conexion.close()
    return jsonify(cliente=cola[0] if cola else None)


@dialer_bp.route('/registrar', methods=['POST'])
@login_required
@require_csrf
def registrar():
    datos = request.get_json(silent=True) or {}
    resultado = datos.get('resultado')

    try:
        cliente_id = int(datos.get('cliente_id'))
    except (TypeError, ValueError):
        return jsonify(error='cliente_id inválido'), 400

    if resultado not in RESULTADOS_VALIDOS:
        return jsonify(error='resultado inválido'), 400

    duracion_segundos = datos.get('duracion_segundos')
    if duracion_segundos is not None:
        try:
            duracion_segundos = int(duracion_segundos)
            if duracion_segundos < 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify(error='duracion_segundos inválida'), 400

    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)

    if not cliente_existe(cursor, cliente_id):
        cursor.close()
        conexion.close()
        return jsonify(error='cliente no encontrado'), 404

    cursor.execute(
        """
        INSERT INTO llamadas (cliente_id, usuario_id, modo, estado, resultado, duracion_segundos)
        VALUES (%s, %s, 'saliente', 'finalizada', %s, %s)
        """,
        (cliente_id, session['usuario_id'], resultado, duracion_segundos)
    )
    conexion.commit()

    siguiente = obtener_cola(cursor, limit=1)
    cursor.close()
    conexion.close()

    return jsonify(cliente=siguiente[0] if siguiente else None)
