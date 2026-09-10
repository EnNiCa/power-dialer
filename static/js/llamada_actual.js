(function () {
    const vacio = document.getElementById('panel-llamada-vacio');
    const activa = document.getElementById('panel-llamada-activa');
    if (!vacio || !activa) return;

    const flotante = document.getElementById('marcador-flotante');
    const registrarUrl = flotante ? flotante.dataset.registrarUrl : null;
    const metaCsrf = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = metaCsrf ? metaCsrf.content : '';

    const RESULTADO_LABELS = {
        contestada: 'Contestada',
        no_contesta: 'No contesta',
        buzon: 'Buzón de voz',
        ocupado: 'Ocupado',
        cancelada: 'Cancelada',
    };

    const FICHA_CAMPOS_TEXTO = [
        'email', 'telefono2', 'telefono3', 'fax', 'observaciones',
        'direccion', 'cp', 'poblacion', 'provincia', 'operador', 'canal', 'quien_ref',
    ];
    const FICHA_CAMPOS_CIERRE = [
        'cierre', 'cierre_nulo', 'cierre_venta_energia', 'cierre_venta_teleco', 'cierre_venta_alarmas',
    ];

    function elementoFicha(prefijo, campo) {
        return document.getElementById(`${prefijo}-${campo.replace(/_/g, '-')}`);
    }

    function poblarFicha(prefijo, cliente) {
        const nombreEl = document.getElementById(`${prefijo}-nombre`);
        const telefonoEl = document.getElementById(`${prefijo}-telefono`);
        if (nombreEl) nombreEl.value = cliente ? (cliente.nombre || '') : '';
        if (telefonoEl) telefonoEl.value = cliente ? (cliente.telefono || '') : '';
        FICHA_CAMPOS_TEXTO.forEach((campo) => {
            const el = elementoFicha(prefijo, campo);
            if (el) el.value = cliente ? (cliente[campo] || '') : '';
        });
        FICHA_CAMPOS_CIERRE.forEach((campo) => {
            const el = elementoFicha(prefijo, campo);
            if (el) el.checked = cliente ? !!cliente[campo] : false;
        });
    }

    function recogerFicha(prefijo) {
        const nombreEl = document.getElementById(`${prefijo}-nombre`);
        const telefonoEl = document.getElementById(`${prefijo}-telefono`);
        const payload = {
            nombre: nombreEl ? nombreEl.value.trim() : '',
            telefono: telefonoEl ? telefonoEl.value.trim() : '',
        };
        FICHA_CAMPOS_TEXTO.forEach((campo) => {
            const el = elementoFicha(prefijo, campo);
            payload[campo] = el ? el.value.trim() : '';
        });
        FICHA_CAMPOS_CIERRE.forEach((campo) => {
            const el = elementoFicha(prefijo, campo);
            payload[campo] = !!(el && el.checked);
        });
        return payload;
    }

    const nombreEl = document.getElementById('panel-llamada-nombre');
    const telefonoEl = document.getElementById('panel-llamada-telefono');
    const estadoEl = document.getElementById('panel-llamada-estado');
    const timerEl = document.getElementById('panel-llamada-timer');
    const historialLista = document.getElementById('panel-llamada-historial-lista');
    const sinHistorial = document.getElementById('panel-llamada-sin-historial');
    const resumen = document.getElementById('panel-llamada-resumen');

    const resultadoRapido = document.getElementById('panel-resultado-rapido');
    const resultadoRapidoBotones = resultadoRapido
        ? Array.from(resultadoRapido.querySelectorAll('button[data-resultado]'))
        : [];
    const resultadoRapidoError = document.getElementById('panel-resultado-rapido-error');

    const llamadaFichaForm = document.getElementById('llamada-ficha-form');
    const llamadaFichaError = document.getElementById('llamada-ficha-error');
    const llamadaFichaGuardar = document.getElementById('llamada-ficha-guardar');
    const llamadaFichaCancelar = document.getElementById('llamada-ficha-cancelar');

    let intervalId = null;
    let clienteIdCargado = null;
    let llamadaFichaClienteId = null;
    let llamadaFichaClienteIdCargado = null;

    function leerEstado(clave) {
        try {
            return JSON.parse(localStorage.getItem(clave));
        } catch (err) {
            return null;
        }
    }

    function guardarEstado(clave, valor) {
        try {
            if (valor === null) {
                localStorage.removeItem(clave);
            } else {
                localStorage.setItem(clave, JSON.stringify(valor));
            }
        } catch (err) {
            // almacenamiento no disponible: la página seguirá funcionando,
            // solo no persistirá entre recargas
        }
    }

    function formatoMmSs(segundosTotales) {
        const segundos = Math.max(0, Math.round(segundosTotales));
        const m = Math.floor(segundos / 60).toString().padStart(2, '0');
        const s = (segundos % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function segundosTranscurridos(llamada) {
        const enCurso = llamada.enPausa ? 0 : (Date.now() - llamada.inicio) / 1000;
        return llamada.acumulado + enCurso;
    }

    function pararIntervalo() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    function pintarHistorial(historial) {
        historialLista.innerHTML = '';
        if (!historial || historial.length === 0) {
            sinHistorial.hidden = false;
            return;
        }
        sinHistorial.hidden = true;
        historial.forEach((item) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${item.fecha}</span><span>${item.resultado}</span>`;
            historialLista.appendChild(li);
        });
    }

    function cargarHistorial(clienteId) {
        fetch(`/clientes/${clienteId}/detalle`)
            .then((r) => (r.ok ? r.json() : null))
            .then((datos) => {
                if (datos) pintarHistorial(datos.historial);
            })
            .catch(() => {});
    }

    function actualizarHistorial(clienteId) {
        if (clienteId) {
            if (clienteId !== clienteIdCargado) {
                clienteIdCargado = clienteId;
                historialLista.innerHTML = '';
                sinHistorial.hidden = true;
                cargarHistorial(clienteId);
            }
        } else {
            clienteIdCargado = null;
            pintarHistorial([]);
        }
    }

    // --- Ficha del cliente incrustada en la tarjeta de llamada ---
    function ocultarFichaLlamada() {
        if (!llamadaFichaForm) return;
        llamadaFichaForm.hidden = true;
        llamadaFichaClienteId = null;
        llamadaFichaClienteIdCargado = null;
    }

    function cargarClienteEnFichaLlamada(clienteId) {
        llamadaFichaError.hidden = true;
        poblarFicha('llamada-ficha', null);
        fetch(`/clientes/${clienteId}/detalle`)
            .then((r) => (r.ok ? r.json() : null))
            .then((datos) => {
                if (!datos || llamadaFichaClienteId !== clienteId) return;
                poblarFicha('llamada-ficha', datos.cliente);
            })
            .catch(() => {
                llamadaFichaError.textContent = 'No se pudo cargar la ficha del cliente.';
                llamadaFichaError.hidden = false;
            });
    }

    function mostrarFichaLlamada(clienteId) {
        if (!llamadaFichaForm || !clienteId) {
            ocultarFichaLlamada();
            return;
        }
        llamadaFichaForm.hidden = false;
        llamadaFichaClienteId = clienteId;
        if (clienteId !== llamadaFichaClienteIdCargado) {
            llamadaFichaClienteIdCargado = clienteId;
            cargarClienteEnFichaLlamada(clienteId);
        }
    }

    // termina la gestión de la llamada contestada: limpia el estado
    // pendiente, deja constancia de la última gestión y recarga para
    // volver a un estado listo para la siguiente llamada
    function concluirGestionContestada(clienteActualizado) {
        const pendiente = leerEstado('marcadorResultadoPendiente');
        if (!pendiente || !pendiente.contestada) return;
        guardarEstado('marcadorResultadoPendiente', null);
        guardarEstado('marcadorUltimoResultado', {
            clienteId: pendiente.clienteId,
            nombre: (clienteActualizado && clienteActualizado.nombre) || pendiente.nombre,
            telefono: (clienteActualizado && clienteActualizado.telefono) || pendiente.telefono,
            resultado: 'contestada',
            fecha: Date.now(),
        });
        window.location.reload();
    }

    function render() {
        const llamada = leerEstado('marcadorLlamada');
        const pendiente = leerEstado('marcadorResultadoPendiente');
        const ultimo = leerEstado('marcadorUltimoResultado');

        pararIntervalo();

        if (pendiente) {
            vacio.hidden = true;
            activa.hidden = false;
            nombreEl.textContent = pendiente.nombre || 'Número sin identificar';
            telefonoEl.textContent = pendiente.telefono;
            timerEl.hidden = true;
            resumen.hidden = true;

            if (pendiente.contestada) {
                estadoEl.textContent = '';
                if (resultadoRapido) resultadoRapido.hidden = true;
                mostrarFichaLlamada(pendiente.clienteId);
            } else {
                estadoEl.textContent = 'Registrando resultado…';
                if (resultadoRapido) resultadoRapido.hidden = false;
                ocultarFichaLlamada();
            }
            actualizarHistorial(pendiente.clienteId);
            return;
        }

        if (llamada) {
            vacio.hidden = true;
            activa.hidden = false;
            nombreEl.textContent = llamada.nombre || 'Número sin identificar';
            telefonoEl.textContent = llamada.telefono;
            estadoEl.textContent = llamada.enPausa ? 'En espera' : 'Llamada en curso';
            timerEl.hidden = false;
            resumen.hidden = true;
            if (resultadoRapido) resultadoRapido.hidden = true;
            const actualizarTimer = () => { timerEl.textContent = formatoMmSs(segundosTranscurridos(llamada)); };
            actualizarTimer();
            intervalId = setInterval(actualizarTimer, 1000);
            mostrarFichaLlamada(llamada.clienteId);
            actualizarHistorial(llamada.clienteId);
            return;
        }

        if (ultimo) {
            vacio.hidden = true;
            activa.hidden = false;
            nombreEl.textContent = ultimo.nombre || 'Número sin identificar';
            telefonoEl.textContent = ultimo.telefono;
            estadoEl.textContent = '';
            timerEl.hidden = true;
            if (resultadoRapido) resultadoRapido.hidden = true;
            ocultarFichaLlamada();
            const hora = new Date(ultimo.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const etiqueta = RESULTADO_LABELS[ultimo.resultado] || ultimo.resultado;
            resumen.textContent = `Última gestión (${hora}): ${etiqueta}`;
            resumen.hidden = false;
            actualizarHistorial(ultimo.clienteId);
            return;
        }

        vacio.hidden = false;
        activa.hidden = true;
        if (resultadoRapido) resultadoRapido.hidden = true;
        ocultarFichaLlamada();
        clienteIdCargado = null;
    }

    // --- Resultado rápido al colgar ---
    resultadoRapidoBotones.forEach((boton) => {
        boton.addEventListener('click', async () => {
            const pendiente = leerEstado('marcadorResultadoPendiente');
            if (!pendiente || !registrarUrl) return;
            const resultado = boton.dataset.resultado;

            resultadoRapidoError.hidden = true;
            resultadoRapidoBotones.forEach((b) => { b.disabled = true; });
            try {
                const respuesta = await fetch(registrarUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify({
                        cliente_id: pendiente.clienteId,
                        resultado,
                        duracion_segundos: pendiente.duracion,
                    }),
                });

                if (respuesta.status === 404) {
                    guardarEstado('marcadorResultadoPendiente', null);
                    window.location.reload();
                    return;
                }
                if (!respuesta.ok) throw new Error('registrar');

                if (resultado === 'contestada') {
                    guardarEstado('marcadorResultadoPendiente', Object.assign({}, pendiente, { contestada: true }));
                    render();
                } else {
                    guardarEstado('marcadorResultadoPendiente', null);
                    guardarEstado('marcadorUltimoResultado', {
                        clienteId: pendiente.clienteId,
                        nombre: pendiente.nombre,
                        telefono: pendiente.telefono,
                        resultado,
                        fecha: Date.now(),
                    });
                    window.location.reload();
                }
            } catch (err) {
                resultadoRapidoError.textContent = 'No se pudo registrar el resultado. Inténtalo de nuevo.';
                resultadoRapidoError.hidden = false;
                resultadoRapidoBotones.forEach((b) => { b.disabled = false; });
            }
        });
    });

    // --- Ficha incrustada: guardar / cancelar ---
    if (llamadaFichaForm) {
        llamadaFichaForm.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            if (!llamadaFichaClienteId) return;

            const payload = recogerFicha('llamada-ficha');
            if (!payload.nombre || !payload.telefono) {
                llamadaFichaError.textContent = 'Nombre y teléfono son obligatorios.';
                llamadaFichaError.hidden = false;
                return;
            }

            llamadaFichaError.hidden = true;
            llamadaFichaGuardar.disabled = true;
            try {
                const respuesta = await fetch(`/clientes/${llamadaFichaClienteId}/actualizar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify(payload),
                });
                const datos = await respuesta.json().catch(() => ({}));
                if (!respuesta.ok) {
                    llamadaFichaError.textContent = datos.error || 'No se pudo guardar la ficha.';
                    llamadaFichaError.hidden = false;
                    return;
                }

                nombreEl.textContent = datos.cliente.nombre;
                telefonoEl.textContent = datos.cliente.telefono;
                concluirGestionContestada(datos.cliente);
            } catch (err) {
                llamadaFichaError.textContent = 'No se pudo guardar la ficha. Inténtalo de nuevo.';
                llamadaFichaError.hidden = false;
            } finally {
                llamadaFichaGuardar.disabled = false;
            }
        });

        llamadaFichaCancelar.addEventListener('click', () => {
            const pendiente = leerEstado('marcadorResultadoPendiente');
            if (pendiente && pendiente.contestada) {
                concluirGestionContestada(null);
            } else if (llamadaFichaClienteId) {
                cargarClienteEnFichaLlamada(llamadaFichaClienteId);
            }
        });
    }

    const fichaModal = document.getElementById('ficha-modal');
    if (fichaModal) {
        const fichaModalFondo = document.getElementById('ficha-modal-fondo');
        const fichaModalCerrar = document.getElementById('ficha-modal-cerrar');
        const fichaForm = document.getElementById('ficha-form');
        const fichaError = document.getElementById('ficha-error');
        const fichaGuardar = document.getElementById('ficha-guardar');
        const fichaCancelar = document.getElementById('ficha-cancelar');
        const fichaHistorialLista = document.getElementById('ficha-historial-lista');
        const fichaSinHistorial = document.getElementById('ficha-sin-historial');

        let fichaClienteId = null;
        let fichaBotonActivo = null;

        function pintarFichaHistorial(historial) {
            fichaHistorialLista.innerHTML = '';
            if (!historial || historial.length === 0) {
                fichaSinHistorial.hidden = false;
                return;
            }
            fichaSinHistorial.hidden = true;
            historial.forEach((item) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${item.fecha}</span><span>${item.resultado}</span>`;
                fichaHistorialLista.appendChild(li);
            });
        }

        function cerrarFicha() {
            fichaModal.hidden = true;
            fichaClienteId = null;
            fichaBotonActivo = null;
        }

        function abrirFicha(clienteId, boton) {
            fichaClienteId = clienteId;
            fichaBotonActivo = boton;
            fichaError.hidden = true;
            poblarFicha('ficha', null);
            fichaHistorialLista.innerHTML = '';
            fichaSinHistorial.hidden = true;
            fichaModal.hidden = false;

            fetch(`/clientes/${clienteId}/detalle`)
                .then((r) => (r.ok ? r.json() : null))
                .then((datos) => {
                    if (!datos || fichaClienteId !== clienteId) return;
                    poblarFicha('ficha', datos.cliente);
                    pintarFichaHistorial(datos.historial);
                })
                .catch(() => {
                    fichaError.textContent = 'No se pudo cargar la ficha del cliente.';
                    fichaError.hidden = false;
                });
        }

        document.querySelectorAll('.actividad-item-btn').forEach((boton) => {
            boton.addEventListener('click', () => {
                const clienteId = parseInt(boton.dataset.clienteId, 10);
                if (clienteId) abrirFicha(clienteId, boton);
            });
        });

        fichaModalFondo.addEventListener('click', cerrarFicha);
        fichaModalCerrar.addEventListener('click', cerrarFicha);
        fichaCancelar.addEventListener('click', cerrarFicha);
        document.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape' && !fichaModal.hidden) cerrarFicha();
        });

        fichaForm.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            if (!fichaClienteId) return;

            const payload = recogerFicha('ficha');
            if (!payload.nombre || !payload.telefono) {
                fichaError.textContent = 'Nombre y teléfono son obligatorios.';
                fichaError.hidden = false;
                return;
            }

            fichaError.hidden = true;
            fichaGuardar.disabled = true;
            try {
                const respuesta = await fetch(`/clientes/${fichaClienteId}/actualizar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify(payload),
                });
                const datos = await respuesta.json().catch(() => ({}));
                if (!respuesta.ok) {
                    fichaError.textContent = datos.error || 'No se pudo guardar la ficha.';
                    fichaError.hidden = false;
                    return;
                }

                if (fichaBotonActivo) {
                    fichaBotonActivo.querySelector('.actividad-nombre').textContent = datos.cliente.nombre;
                    fichaBotonActivo.querySelector('.actividad-telefono').textContent = datos.cliente.telefono;
                }

                // si el cliente editado es el que se ve en la tarjeta de
                // llamada actual, refleja el cambio ahí también
                const claveActiva = fichaClienteId;
                ['marcadorLlamada', 'marcadorResultadoPendiente', 'marcadorUltimoResultado'].forEach((clave) => {
                    const estado = leerEstado(clave);
                    if (estado && estado.clienteId === claveActiva) {
                        estado.nombre = datos.cliente.nombre;
                        estado.telefono = datos.cliente.telefono;
                        guardarEstado(clave, estado);
                    }
                });
                render();

                cerrarFicha();
            } catch (err) {
                fichaError.textContent = 'No se pudo guardar la ficha. Inténtalo de nuevo.';
                fichaError.hidden = false;
            } finally {
                fichaGuardar.disabled = false;
            }
        });
    }

    window.addEventListener('storage', render);
    window.addEventListener('marcador-cambio', render);
    render();
})();
