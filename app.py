from flask import Flask
from dotenv import load_dotenv
import mysql.connector
import os

load_dotenv()


app = Flask(__name__)

@app.route('/')
def home():
    conexion = mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    cursor = conexion.cursor()
    cursor.execute("SELECT COUNT(*) FROM clientes")
    resultado = cursor.fetchone()
    cursor.close()
    conexion.close()
    return f"Dialer funcionando. Clientes en base de datos: {resultado[0]}"


if __name__ == '__main__':
    app.run(debug=True)