CREATE DATABASE dialer
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE dialer;

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    email VARCHAR(120),
    telefono2 VARCHAR(30),
    telefono3 VARCHAR(30),
    fax VARCHAR(30),
    observaciones TEXT,
    direccion VARCHAR(255),
    cp VARCHAR(10),
    poblacion VARCHAR(120),
    provincia VARCHAR(120),
    operador VARCHAR(120),
    canal VARCHAR(120),
    quien_ref VARCHAR(20),
    cierre BOOLEAN NOT NULL DEFAULT FALSE,
    cierre_nulo BOOLEAN NOT NULL DEFAULT FALSE,
    cierre_venta_energia BOOLEAN NOT NULL DEFAULT FALSE,
    cierre_venta_teleco BOOLEAN NOT NULL DEFAULT FALSE,
    cierre_venta_alarmas BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE KEY uq_telefono (telefono)
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('comercial', 'admin') NOT NULL
);

CREATE TABLE llamadas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    usuario_id INT NOT NULL,
    modo ENUM('entrante', 'saliente') NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    duracion_segundos INT,
    resultado ENUM('contestada', 'no_contesta', 'buzon', 'ocupado', 'cancelada'),
    observaciones TEXT,
    twilio_call_sid VARCHAR(64),
    estado VARCHAR(20),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE KEY uq_twilio_call_sid (twilio_call_sid)
);