CREATE DATABASE dialer
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE dialer;

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(30) NOT NULL
);

CREATE TABLE comerciales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL
);

CREATE TABLE llamadas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    comercial_id INT NOT NULL,
    modo ENUM('entrante', 'saliente') NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    duracion_segundos INT,
    resultado ENUM('contestada', 'no_contesta', 'buzon', 'ocupado'),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (comercial_id) REFERENCES comerciales(id)
);