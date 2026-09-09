import secrets
from functools import wraps
from flask import session, request, abort


def csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def require_csrf(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        enviado = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token', '')
        esperado = session.get('csrf_token', '')
        if not esperado or not secrets.compare_digest(enviado, esperado):
            abort(403)
        return f(*args, **kwargs)
    return decorated
