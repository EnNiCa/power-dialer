import os
from functools import wraps
from flask import request, abort
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.request_validator import RequestValidator


def crear_access_token(identity):
    token = AccessToken(
        os.getenv('TWILIO_ACCOUNT_SID'),
        os.getenv('TWILIO_API_KEY_SID'),
        os.getenv('TWILIO_API_KEY_SECRET'),
        identity=identity,
        ttl=3600,
    )
    token.add_grant(VoiceGrant(
        outgoing_application_sid=os.getenv('TWILIO_TWIML_APP_SID'),
        incoming_allow=False,
    ))
    return token.to_jwt()


def _url_publica_actual():
    base = os.getenv('PUBLIC_BASE_URL', '').rstrip('/')
    return f"{base}{request.path}"


def validate_twilio_request(f):
    """Rechaza peticiones a webhooks de Twilio que no traigan una firma válida.

    Construye la URL a partir de PUBLIC_BASE_URL en vez de request.url porque
    ngrok termina TLS y reenvía HTTP a Flask, así que request.url reportaría
    http:// aunque Twilio firmó la versión https:// que realmente llamó.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        validador = RequestValidator(os.getenv('TWILIO_AUTH_TOKEN', ''))
        firma = request.headers.get('X-Twilio-Signature', '')
        if not validador.validate(_url_publica_actual(), request.form, firma):
            abort(403)
        return f(*args, **kwargs)
    return decorated
