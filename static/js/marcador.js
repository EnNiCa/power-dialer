(function () {
    const raiz = document.getElementById('marcador-flotante');
    if (!raiz) return;

    const buscarUrl = raiz.dataset.buscarUrl;
    const registrarUrl = raiz.dataset.registrarUrl;
    const siguienteUrl = raiz.dataset.siguienteUrl;
    const metaCsrf = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = metaCsrf ? metaCsrf.content : '';

    const CLAVE_LLAMADA = 'marcadorLlamada';
    const CLAVE_RESULTADO = 'marcadorResultadoPendiente';

    const vistaMarcar = document.getElementById('marcador-vista-marcar');
    const numeroNombre = document.getElementById('marcador-numero-nombre');
    const numeroTelefono = document.getElementById('marcador-numero-telefono');
    const input = document.getElementById('marcador-input');
    const resultados = document.getElementById('marcador-resultados');
    const btnLlamar = document.getElementById('marcador-btn-llamar');

    const vistaLlamada = document.getElementById('marcador-vista-llamada');
    const llamadaNombre = document.getElementById('marcador-llamada-nombre');
    const llamadaTelefono = document.getElementById('marcador-llamada-telefono');
    const llamadaEstado = document.getElementById('marcador-llamada-estado');
    const llamadaTimer = document.getElementById('marcador-llamada-timer');
    const miniTeclado = document.getElementById('marcador-mini-teclado');
    const tonoMostrado = document.getElementById('marcador-tono-mostrado');
    const nota = document.getElementById('marcador-nota');
    const btnSilenciar = document.getElementById('marcador-btn-silenciar');
    const btnGrabar = document.getElementById('marcador-btn-grabar');
    const btnAnadir = document.getElementById('marcador-btn-anadir');
    const btnTeclado = document.getElementById('marcador-btn-teclado');
    const btnRetener = document.getElementById('marcador-btn-retener');
    const iconoRetener = document.getElementById('marcador-icono-retener');
    const textoRetener = document.getElementById('marcador-texto-retener');
    const btnColgar = document.getElementById('marcador-btn-colgar');

    const vistaResultado = document.getElementById('marcador-vista-resultado');
    const resultadoNombre = document.getElementById('marcador-resultado-nombre');
    const resultadoOpciones = document.getElementById('marcador-resultado-opciones');
    const errorBox = document.getElementById('marcador-error');
    const btnConfirmar = document.getElementById('marcador-btn-confirmar');

    let clienteSeleccionado = null; // elegido en el desplegable de busqueda
    let clienteAutomatico = null;   // siguiente pendiente de la cola, sugerido solo
    let intervalId = null;
    let debounceId = null;

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
            // almacenamiento no disponible (privado/bloqueado): el widget sigue
            // funcionando en la pestaña actual, solo no sobrevive a un reload
        }
    }

    function formatoMmSs(segundosTotales) {
        const segundos = Math.max(0, Math.round(segundosTotales));
        const m = Math.floor(segundos / 60).toString().padStart(2, '0');
        const s = (segundos % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function ocultarTodasLasVistas() {
        vistaMarcar.hidden = true;
        vistaLlamada.hidden = true;
        vistaResultado.hidden = true;
    }

    // --- Vista marcar: objetivo (número que se marcaría ahora mismo) ---
    function calcularObjetivo() {
        if (clienteSeleccionado) {
            return {
                clienteId: clienteSeleccionado.id,
                nombre: clienteSeleccionado.nombre,
                telefono: clienteSeleccionado.telefono,
            };
        }
        const texto = input.value.trim();
        if (texto && /\d/.test(texto)) {
            return { clienteId: null, nombre: null, telefono: texto };
        }
        if (!texto && clienteAutomatico) {
            return {
                clienteId: clienteAutomatico.id,
                nombre: clienteAutomatico.nombre,
                telefono: clienteAutomatico.telefono,
            };
        }
        return null;
    }

    function pintarObjetivo() {
        const objetivo = calcularObjetivo();
        if (objetivo) {
            numeroNombre.textContent = objetivo.nombre || '';
            numeroTelefono.textContent = objetivo.telefono;
            numeroTelefono.classList.remove('marcador-numero-vacio');
            btnLlamar.disabled = false;
        } else {
            numeroNombre.textContent = '';
            numeroTelefono.textContent = 'Selecciona o marca un número';
            numeroTelefono.classList.add('marcador-numero-vacio');
            btnLlamar.disabled = true;
        }
    }

    function cargarSiguienteAutomatico() {
        fetch(siguienteUrl)
            .then((r) => r.json())
            .then((datos) => {
                clienteAutomatico = datos.cliente || null;
                pintarObjetivo();
            })
            .catch(() => {});
    }

    function reiniciarVistaMarcar(nuevoAutomatico) {
        ocultarTodasLasVistas();
        vistaMarcar.hidden = false;
        input.value = '';
        clienteSeleccionado = null;
        resultados.hidden = true;
        resultados.innerHTML = '';
        if (nuevoAutomatico !== undefined) {
            clienteAutomatico = nuevoAutomatico;
            pintarObjetivo();
        } else {
            cargarSiguienteAutomatico();
        }
    }

    // --- Vista en llamada ---
    function segundosTranscurridos(llamada) {
        const enCurso = llamada.enPausa ? 0 : (Date.now() - llamada.inicio) / 1000;
        return llamada.acumulado + enCurso;
    }

    function actualizarTimer(llamada) {
        llamadaTimer.textContent = formatoMmSs(segundosTranscurridos(llamada));
    }

    function pararIntervalo() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    function pintarVistaLlamada(llamada) {
        ocultarTodasLasVistas();
        vistaLlamada.hidden = false;

        llamadaNombre.textContent = llamada.nombre || 'Número sin identificar';
        llamadaTelefono.textContent = llamada.telefono;
        llamadaEstado.textContent = llamada.enPausa ? 'En espera' : 'Llamada en curso';

        btnSilenciar.classList.toggle('activo', !!llamada.silenciado);
        btnGrabar.classList.toggle('activo', !!llamada.grabando);
        iconoRetener.textContent = llamada.enPausa ? '▶' : '⏸';
        textoRetener.textContent = llamada.enPausa ? 'Reanudar' : 'Retener';
        miniTeclado.hidden = true;
        nota.hidden = true;

        actualizarTimer(llamada);
        pararIntervalo();
        intervalId = setInterval(() => actualizarTimer(llamada), 1000);
    }

    function pintarVistaResultado(pendiente) {
        ocultarTodasLasVistas();
        vistaResultado.hidden = false;
        resultadoNombre.textContent = pendiente.nombre || pendiente.telefono;
        resultadoOpciones.querySelectorAll('input[name="marcador-resultado"]').forEach((r) => {
            r.checked = false;
        });
        errorBox.hidden = true;
    }

    function iniciarLlamada(objetivo) {
        const llamada = {
            clienteId: objetivo.clienteId,
            nombre: objetivo.nombre,
            telefono: objetivo.telefono,
            inicio: Date.now(),
            acumulado: 0,
            enPausa: false,
            silenciado: false,
            grabando: false,
        };
        guardarEstado(CLAVE_LLAMADA, llamada);
        pintarVistaLlamada(llamada);
    }

    function colgar() {
        const llamada = leerEstado(CLAVE_LLAMADA);
        pararIntervalo();
        if (!llamada) {
            reiniciarVistaMarcar();
            return;
        }
        const duracion = Math.round(segundosTranscurridos(llamada));
        guardarEstado(CLAVE_LLAMADA, null);

        if (llamada.clienteId) {
            const pendiente = {
                clienteId: llamada.clienteId,
                nombre: llamada.nombre,
                telefono: llamada.telefono,
                duracion,
            };
            guardarEstado(CLAVE_RESULTADO, pendiente);
            pintarVistaResultado(pendiente);
        } else {
            reiniciarVistaMarcar();
        }
    }

    function mostrarNota(texto) {
        nota.textContent = texto;
        nota.hidden = false;
        setTimeout(() => { nota.hidden = true; }, 2200);
    }

    function alternarControlSimple(boton, campo) {
        const llamada = leerEstado(CLAVE_LLAMADA);
        if (!llamada) return;
        llamada[campo] = !llamada[campo];
        guardarEstado(CLAVE_LLAMADA, llamada);
        boton.classList.toggle('activo', llamada[campo]);
    }

    function alternarRetener() {
        const llamada = leerEstado(CLAVE_LLAMADA);
        if (!llamada) return;
        if (llamada.enPausa) {
            llamada.inicio = Date.now();
            llamada.enPausa = false;
        } else {
            llamada.acumulado = segundosTranscurridos(llamada);
            llamada.enPausa = true;
        }
        guardarEstado(CLAVE_LLAMADA, llamada);
        pintarVistaLlamada(llamada);
    }

    // --- Buscador ---
    function ejecutarBusqueda(texto) {
        if (texto.trim().length < 2) {
            resultados.hidden = true;
            resultados.innerHTML = '';
            return;
        }
        fetch(`${buscarUrl}?q=${encodeURIComponent(texto)}`)
            .then((r) => r.json())
            .then((datos) => {
                resultados.innerHTML = '';
                if (!datos.clientes || datos.clientes.length === 0) {
                    resultados.hidden = true;
                    return;
                }
                datos.clientes.forEach((cliente) => {
                    const li = document.createElement('li');
                    li.innerHTML = `${cliente.nombre}<span>${cliente.telefono}</span>`;
                    li.addEventListener('click', () => {
                        clienteSeleccionado = cliente;
                        resultados.hidden = true;
                        pintarObjetivo();
                    });
                    resultados.appendChild(li);
                });
                resultados.hidden = false;
            })
            .catch(() => {
                resultados.hidden = true;
            });
    }

    input.addEventListener('input', () => {
        clienteSeleccionado = null;
        pintarObjetivo();
        clearTimeout(debounceId);
        debounceId = setTimeout(() => ejecutarBusqueda(input.value), 250);
    });

    document.addEventListener('click', (evento) => {
        if (!raiz.contains(evento.target)) {
            resultados.hidden = true;
        }
    });

    vistaMarcar.querySelectorAll('.marcador-tecla').forEach((tecla) => {
        tecla.addEventListener('click', () => {
            input.value += tecla.dataset.digito;
            input.dispatchEvent(new Event('input'));
            input.focus();
        });
    });

    miniTeclado.querySelectorAll('.marcador-tecla').forEach((tecla) => {
        tecla.addEventListener('click', () => {
            tonoMostrado.textContent = `Tono: ${tecla.dataset.digito}`;
            setTimeout(() => { tonoMostrado.textContent = ''; }, 800);
        });
    });

    btnLlamar.addEventListener('click', () => {
        const objetivo = calcularObjetivo();
        if (!objetivo) return;
        window.location.href = `tel:${objetivo.telefono}`;
        iniciarLlamada(objetivo);
    });

    btnColgar.addEventListener('click', colgar);
    btnSilenciar.addEventListener('click', () => alternarControlSimple(btnSilenciar, 'silenciado'));
    btnGrabar.addEventListener('click', () => alternarControlSimple(btnGrabar, 'grabando'));
    btnRetener.addEventListener('click', alternarRetener);
    btnTeclado.addEventListener('click', () => {
        miniTeclado.hidden = !miniTeclado.hidden;
    });
    btnAnadir.addEventListener('click', () => {
        mostrarNota('Añadir a la llamada: función visual, todavía no conecta llamadas reales.');
    });

    async function confirmarResultado() {
        const pendiente = leerEstado(CLAVE_RESULTADO);
        if (!pendiente) {
            reiniciarVistaMarcar();
            return;
        }
        const seleccionado = resultadoOpciones.querySelector('input[name="marcador-resultado"]:checked');
        if (!seleccionado) {
            errorBox.textContent = 'Elige un resultado para la llamada.';
            errorBox.hidden = false;
            return;
        }

        errorBox.hidden = true;
        btnConfirmar.disabled = true;
        try {
            const respuesta = await fetch(registrarUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    cliente_id: pendiente.clienteId,
                    resultado: seleccionado.value,
                    duracion_segundos: pendiente.duracion,
                }),
            });
            if (respuesta.status === 404) {
                errorBox.textContent = 'Ese cliente ya no existe.';
                errorBox.hidden = false;
                guardarEstado(CLAVE_RESULTADO, null);
                setTimeout(() => reiniciarVistaMarcar(), 1800);
                return;
            }
            if (!respuesta.ok) throw new Error('registrar');
            const datos = await respuesta.json();

            guardarEstado(CLAVE_RESULTADO, null);
            reiniciarVistaMarcar(datos.cliente || null);
        } catch (err) {
            errorBox.textContent = 'No se pudo guardar el resultado. Inténtalo de nuevo.';
            errorBox.hidden = false;
        } finally {
            btnConfirmar.disabled = false;
        }
    }

    btnConfirmar.addEventListener('click', confirmarResultado);

    // --- Restaurar estado al cargar cualquier página ---
    const resultadoPendiente = leerEstado(CLAVE_RESULTADO);
    const llamadaActiva = leerEstado(CLAVE_LLAMADA);

    if (resultadoPendiente) {
        pintarVistaResultado(resultadoPendiente);
    } else if (llamadaActiva) {
        pintarVistaLlamada(llamadaActiva);
    } else {
        reiniciarVistaMarcar();
    }
})();
