from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import mysql.connector
import os

load_dotenv()

nombre = input("Nombre completo: ")
username = input("Username: ")
password = input("Contraseña: ")
rol = input("Rol (comercial/admin): ")

password_hash = generate_password_hash(password)

conexion = mysql.connector.connect(
    host=os.getenv('DB_HOST'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME')
)
cursor = conexion.cursor()

cursor.execute(
    "INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES (%s, %s, %s, %s)",
    (nombre, username, password_hash, rol)
)
conexion.commit()

print(f"Usuario '{username}' creado correctamente.")

cursor.close()
conexion.close()