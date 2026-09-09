from flask import Flask
import os
from dotenv import load_dotenv
from auth.routes import auth_bp
from auth.csrf import csrf_token
from dashboard.routes import dashboard_bp
from dialer.routes import dialer_bp

load_dotenv()


app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.jinja_env.globals['csrf_token'] = csrf_token
app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(dialer_bp)


if __name__ == '__main__':
    app.run(debug=True)
