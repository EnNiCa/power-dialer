import os
from flask import Blueprint, request, jsonify, session
from twilio.twiml.voice_response import VoiceResponse, Dial
from db import get_connection
from auth.decoradores import login_required
from dashboard.queries import obtener_cola
from dialer.twilio_client import crear_access_token, validate_twilio_request

dialer_bp = Blueprint('dialer', __name__, url_prefix='/dialer')

RESULTADOS_AUTOMATICOS = {
    'no-answer': 'no_contesta',
    'busy': 'ocupado',
    'failed': 'no_contesta',
}
RESULTADOS_VALIDOS = {'contestada', 'no_contesta', 'buzon', 'ocupado'}


@dialer_bp.route('/token', methods=['POST'])
@login_required
def token():
    identity = f"agent-{session['usuario_id']}"
    return jsonify(token=crear_access_token(identity))


@dialer_bp.route('/voice', methods=['POST'])
@validate_twilio_request
def voice():
    call_sid = request.form.get('CallSid')
    cliente_id = request.form.get('cliente_id')
    telefono = request.form.get('telefono')
    usuario_id = request.form.get('usuario_id')

    conexion = get_connection()
    cursor = conexion.cursor()
    cursor.execute(
        """
        INSERT INTO llamadas (cliente_id, usuario_id, modo, estado, twilio_call_sid)
        VALUES (%s, %s, 'saliente', 'iniciada', %s)
        """,
        (cliente_id, usuario_id, call_sid)
    )
    conexion.commit()
    cursor.close()
    conexion.close()

    base = os.getenv('PUBLIC_BASE_URL', '').rstrip('/')
    respuesta = VoiceResponse()
    dial = Dial(
        action=f"{base}/dialer/status",
        method='POST',
        caller_id=os.getenv('TWILIO_CALLER_ID'),
        answer_on_bridge=True,
        record='do-not-record',
    )
    dial.number(telefono)
    respuesta.append(dial)
    return str(respuesta), 200, {'Content-Type': 'text/xml'}


@dialer_bp.route('/status', methods=['POST'])
@validate_twilio_request
def status():
    # Callback de "action" del <Dial> de /voice: se dispara una sola vez, al
    # terminar el intento de marcado, con el CallSid del tramo del
    # navegador (el mismo que guardamos en /voice) y el resultado del
    # tramo hacia el cliente en DialCallStatus/DialCallDuration.
    call_sid = request.form.get('CallSid')
    dial_call_status = request.form.get('DialCallStatus')
    duracion = request.form.get('DialCallDuration')
    resultado = RESULTADOS_AUTOMATICOS.get(dial_call_status)

    conexion = get_connection()
    cursor = conexion.cursor()
    if resultado:
        cursor.execute(
            """
            UPDATE llamadas
            SET estado = 'finalizada', resultado = %s, duracion_segundos = %s
            WHERE twilio_call_sid = %s
            """,
            (resultado, duracion, call_sid)
        )
    else:
        cursor.execute(
            "UPDATE llamadas SET estado = 'finalizada', duracion_segundos = %s WHERE twilio_call_sid = %s",
            (duracion, call_sid)
        )
    conexion.commit()
    cursor.close()
    conexion.close()

    # Respuesta TwiML vacía: cierra la pierna del navegador con normalidad.
    return str(VoiceResponse()), 200, {'Content-Type': 'text/xml'}


@dialer_bp.route('/llamada/<call_sid>', methods=['GET'])
@login_required
def obtener_llamada(call_sid):
    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)
    cursor.execute(
        "SELECT resultado, estado FROM llamadas WHERE twilio_call_sid = %s",
        (call_sid,)
    )
    fila = cursor.fetchone()
    cursor.close()
    conexion.close()
    return jsonify(fila or {'resultado': None, 'estado': None})


@dialer_bp.route('/wrapup', methods=['POST'])
@login_required
def wrapup():
    datos = request.get_json(silent=True) or {}
    call_sid = datos.get('call_sid')
    resultado = datos.get('resultado')

    if resultado not in RESULTADOS_VALIDOS:
        return jsonify(error='resultado inválido'), 400

    conexion = get_connection()
    cursor = conexion.cursor(dictionary=True)
    cursor.execute(
        "UPDATE llamadas SET resultado = %s, estado = 'finalizada' WHERE twilio_call_sid = %s",
        (resultado, call_sid)
    )
    conexion.commit()

    siguiente = obtener_cola(cursor, limit=1)
    cursor.close()
    conexion.close()

    return jsonify(cliente=siguiente[0] if siguiente else None)
