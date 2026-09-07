from flask import Blueprint, render_template, session
from datetime import date
from db import get_connection
from auth.decoradores import login_required
from dashboard.queries import obtener_cola, contar_pendientes

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/')
@login_required
def inicio():
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
            'dashboard/inicio_admin.html',
            active_nav='dashboard',
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
        'dashboard/inicio_comercial.html',
        active_nav='dashboard',
        fecha_hoy=date.today().strftime('%d/%m/%Y'),
        llamadas_hoy=stats['total'] or 0,
        contactadas_hoy=stats['contactadas'] or 0,
        pendientes_total=pendientes_total,
        cola=cola,
    )


@dashboard_bp.route('/clientes')
@login_required
def clientes():
    return render_template(
        'dashboard/placeholder.html',
        active_nav='clientes',
        titulo='Clientes',
        mensaje='La gestión de clientes llega en un próximo paso.',
    )


@dashboard_bp.route('/historial')
@login_required
def historial():
    return render_template(
        'dashboard/placeholder.html',
        active_nav='historial',
        titulo='Historial de llamadas',
        mensaje='El historial de llamadas llega en un próximo paso.',
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
