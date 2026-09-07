CREATE DATABASE dialer
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE dialer;

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(30) NOT NULL
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
    resultado ENUM('contestada', 'no_contesta', 'buzon', 'ocupado'),
    twilio_call_sid VARCHAR(64),
    estado VARCHAR(20),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE KEY uq_twilio_call_sid (twilio_call_sid)
);