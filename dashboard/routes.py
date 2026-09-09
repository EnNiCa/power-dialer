from flask import Blueprint, render_template, session, request, redirect, url_for, flash, jsonify
from datetime import date
from db import get_connection
from auth.decoradores import login_required, admin_required
from auth.csrf import require_csrf
from dashboard.queries import (
    obtener_cola, contar_pendientes, obtener_historial,
    obtener_clientes, upsert_cliente, buscar_clientes,
    obtener_historial_cliente,
)
from dashboard.importadores import parsear_clientes, FormatoNoSoportado

dashboard_bp = Blueprint('dashboard', __name__)

RESULTADO_LABELS = {
    'contestada': 'Contestada',
    'no_contesta': 'No contesta',
    'buzon': 'Buzón',
    'ocupado': 'Ocupado',
}


def _formatear_duracion(segundos):
    if segundos is None:
        return '—'
    minutos, restantes = divmod(int(segundos), 60)
    return f"{minutos:02d}:{restantes:02d}"


@dashboard_bp.route('/')
@login_required
def inicio():
    return render_template('dashboard/inicio.html', active_nav='dashboard')


@dashboard_bp.route('/clientes/<int:cliente_id>/detalle')
@login_required
def detalle_cliente(cliente_id):
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)

    cursor.execute("SELECT id, nombre, telefono FROM clientes WHERE id = %s", (cliente_id,))
    cliente = cursor.fetchone()
    if not cliente:
        cursor.close()
        conexion.close()
        return jsonify(error='cliente no encontrado'), 404

    filas = obtener_historial_cliente(cursor, cliente_id)
    cursor.close()
    conexion.close()

    historial = [
        {
            'fecha': fila['fecha_hora'].strftime('%d/%m/%Y %H:%M'),
            'resultado': RESULTADO_LABELS.get(fila['resultado'], '—'),
        }
        for fila in filas
    ]

    return jsonify(cliente=cliente, historial=historial)


@dashboard_bp.route('/analisis')
@login_required
def analisis():
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)

    pendientes_total = contar_pendientes(cursor)

    if session.get('rol') == 'admin':
        cursor.execute("""
            SELECT COUNT(*) AS total,
                   SUM(resultado = 'contestada') AS contactadas
            FROM llamadas
            WHERE DATE(fecha_hora) = CURDATE()
        """)
        stats = cursor.fetchone()

        cursor.execute("""
            SELECT u.nombre AS nombre,
                   COUNT(l.id) AS llamadas,
                   SUM(l.resultado = 'contestada') AS contactadas
            FROM usuarios u
            LEFT JOIN llamadas l ON l.usuario_id = u.id AND DATE(l.fecha_hora) = CURDATE()
            WHERE u.rol = 'comercial'
            GROUP BY u.id, u.nombre
            ORDER BY llamadas DESC
        """)
        equipo = cursor.fetchall()
        cursor.close()
        conexion.close()

        return render_template(
            'dashboard/analisis_admin.html',
            active_nav='analisis',
            fecha_hoy=date.today().strftime('%d/%m/%Y'),
            llamadas_hoy=stats['total'] or 0,
            contactadas_hoy=stats['contactadas'] or 0,
            pendientes_total=pendientes_total,
            equipo=equipo,
        )

    cursor.execute("""
        SELECT COUNT(*) AS total,
               SUM(resultado = 'contestada') AS contactadas
        FROM llamadas
        WHERE usuario_id = %s AND DATE(fecha_hora) = CURDATE()
    """, (session['usuario_id'],))
    stats = cursor.fetchone()

    cola = obtener_cola(cursor)
    cursor.close()
    conexion.close()

    return render_template(
        'dashboard/analisis_comercial.html',
        active_nav='analisis',
        fecha_hoy=date.today().strftime('%d/%m/%Y'),
        llamadas_hoy=stats['total'] or 0,
        contactadas_hoy=stats['contactadas'] or 0,
        pendientes_total=pendientes_total,
        cola=cola,
    )


@dashboard_bp.route('/clientes')
@login_required
def clientes():
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)
    filas = obtener_clientes(cursor)
    cursor.close()
    conexion.close()

    return render_template(
        'dashboard/clientes.html',
        active_nav='clientes',
        clientes=filas,
        es_admin=session.get('rol') == 'admin',
    )


@dashboard_bp.route('/clientes/buscar')
@login_required
def buscar_clientes_ruta():
    texto = (request.args.get('q') or '').strip()
    if len(texto) < 2:
        return jsonify(clientes=[])

    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)
    filas = buscar_clientes(cursor, texto)
    cursor.close()
    conexion.close()

    return jsonify(clientes=filas)


@dashboard_bp.route('/clientes/importar', methods=['POST'])
@admin_required
@require_csrf
def importar_clientes():
    fichero = request.files.get('archivo')
    if not fichero or not fichero.filename:
        flash('Selecciona un fichero .csv o .xlsx para importar.')
        return redirect(url_for('dashboard.clientes'))

    try:
        filas, omitidas = parsear_clientes(fichero, fichero.filename)
    except FormatoNoSoportado as error:
        flash(str(error))
        return redirect(url_for('dashboard.clientes'))

    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)

    nuevos = actualizados = sin_cambios = 0
    for fila in filas:
        codigo = upsert_cliente(cursor, fila['nombre'], fila['telefono'])
        if codigo == 1:
            nuevos += 1
        elif codigo == 2:
            actualizados += 1
        else:
            sin_cambios += 1
    conexion.commit()
    cursor.close()
    conexion.close()

    resumen = f"{nuevos} nuevos, {actualizados} actualizados, {sin_cambios} sin cambios"
    if omitidas:
        resumen += f", {len(omitidas)} filas omitidas por faltarles nombre o teléfono"
    flash(resumen)

    return redirect(url_for('dashboard.clientes'))


@dashboard_bp.route('/historial')
@login_required
def historial():
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)

    es_admin = session.get('rol') == 'admin'
    filas = obtener_historial(cursor, usuario_id=None if es_admin else session['usuario_id'])
    cursor.close()
    conexion.close()

    llamadas = [
        {
            'fecha': fila['fecha_hora'].strftime('%d/%m/%Y %H:%M'),
            'cliente_nombre': fila['cliente_nombre'],
            'cliente_telefono': fila['cliente_telefono'],
            'agente_nombre': fila['agente_nombre'],
            'resultado': RESULTADO_LABELS.get(fila['resultado'], '—'),
            'duracion': _formatear_duracion(fila['duracion_segundos']),
        }
        for fila in filas
    ]

    return render_template(
        'dashboard/historial.html',
        active_nav='historial',
        llamadas=llamadas,
        es_admin=es_admin,
    )


@dashboard_bp.route('/marcar')
@dashboard_bp.route('/marcar/<int:cliente_id>')
@login_required
def marcar(cliente_id=None):
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)

    if cliente_id is not None:
        cursor.execute(
            "SELECT id, nombre, telefono FROM clientes WHERE id = %s",
            (cliente_id,)
        )
        cliente = cursor.fetchone()
    else:
        cola = obtener_cola(cursor, limit=1)
        cliente = cola[0] if cola else None

    cursor.close()
    conexion.close()

    return render_template(
        'dashboard/marcar.html',
        active_nav='dashboard',
        cliente=cliente,
    )
