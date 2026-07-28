from flask import Flask
from dotenv import load_dotenv
from db import get_connection
from auth.routes import auth_bp

load_dotenv()


app = Flask(__name__)

@app.route('/')
def home():
    conexion = get_connection()
    cursor = conexion.cursor()
    cursor.execute("SELECT COUNT(*) FROM clientes")
    resultado = cursor.fetchone()
    cursor.close()
    conexion.close()
    return f"Dialer funcionando. Clientes en base de datos: {resultado[0]}"


if __name__ == '__main__':
    app.run(debug=True)