(function () {
    const app = document.getElementById('dialer-app');
    if (!app) return;

    const tokenUrl = app.dataset.tokenUrl;
    const wrapupUrl = app.dataset.wrapupUrl;
    const usuarioId = app.dataset.usuarioId;

    const badge = document.getElementById('dialer-status-badge');
    const errorBox = document.getElementById('dialer-error');
    const emptyBox = document.getElementById('dialer-empty');
    const card = document.getElementById('dialer-card');
    const nombreEl = document.getElementById('dialer-cliente-nombre');
    const telefonoEl = document.getElementById('dialer-cliente-telefono');
    const timerEl = document.getElementById('dialer-timer');
    const btnLlamar = document.getElementById('dialer-btn-llamar');
    const btnColgar = document.getElementById('dialer-btn-colgar');
    const wrapupPanel = document.getElementById('dialer-wrapup');
    const wrapupOptions = document.getElementById('wrapup-options');
    const btnConfirmar = document.getElementById('dialer-btn-confirmar');

    let device = null;
    let activeCall = null;
    let activeCallSid = null;
    let cliente = window.DIALER_CLIENTE || null;
    let cronometroInterval = null;
    let segundosTranscurridos = 0;

    function setBadge(estado, texto) {
        badge.dataset.state = estado;
        badge.textContent = texto;
    }

    function mostrarError(mensaje) {
        errorBox.textContent = mensaje;
        errorBox.hidden = false;
    }

    function limpiarError() {
        errorBox.hidden = true;
        errorBox.textContent = '';
    }

    function pintarCliente() {
        if (!cliente) {
            card.hidden = true;
            emptyBox.hidden = false;
            return;
        }
        emptyBox.hidden = true;
        card.hidden = false;
        nombreEl.textContent = cliente.nombre;
        telefonoEl.textContent = cliente.telefono;
    }

    function iniciarCronometro() {
        segundosTranscurridos = 0;
        timerEl.hidden = false;
        actualizarCronometro();
        cronometroInterval = setInterval(() => {
            segundosTranscurridos += 1;
            actualizarCronometro();
        }, 1000);
    }

    function actualizarCronometro() {
        const minutos = String(Math.floor(segundosTranscurridos / 60)).padStart(2, '0');
        const segundos = String(segundosTranscurridos % 60).padStart(2, '0');
        timerEl.textContent = `${minutos}:${segundos}`;
    }

    function detenerCronometro() {
        clearInterval(cronometroInterval);
        cronometroInterval = null;
        timerEl.hidden = true;
    }

    async function inicializarDevice() {
        try {
            const respuesta = await fetch(tokenUrl, { method: 'POST' });
            if (!respuesta.ok) throw new Error('token');
            const datos = await respuesta.json();

            device = new Twilio.Device(datos.token, { logLevel: 'error' });

            device.on('registered', () => {
                setBadge('ready', 'Listo');
                if (cliente) btnLlamar.disabled = false;
            });
            device.on('error', (err) => {
                setBadge('error', 'Error de conexión');
                mostrarError('No se pudo conectar con el servicio de llamadas: ' + err.message);
            });
            device.on('unregistered', () => {
                setBadge('error', 'Desconectado');
            });

            await device.register();
        } catch (err) {
            setBadge('error', 'Error de conexión');
            mostrarError('No se pudo preparar el softphone. Recarga la página para reintentar.');
        }
    }

    async function llamar() {
        if (!cliente || !device) return;
        limpiarError();
        btnLlamar.disabled = true;
        wrapupPanel.hidden = true;
        setBadge('oncall', 'Llamando…');

        try {
            activeCall = await device.connect({
                params: {
                    cliente_id: String(cliente.id),
                    telefono: cliente.telefono,
                    usuario_id: String(usuarioId),
                },
            });
            activeCallSid = activeCall.parameters && activeCall.parameters.CallSid;

            activeCall.on('accept', (call) => {
                activeCallSid = (call.parameters && call.parameters.CallSid) || activeCallSid;
                setBadge('oncall', 'En llamada');
                btnColgar.hidden = false;
                iniciarCronometro();
            });

            activeCall.on('disconnect', manejarFinDeLlamada);
            activeCall.on('cancel', manejarFinDeLlamada);
            activeCall.on('error', (err) => {
                mostrarError('Error en la llamada: ' + err.message);
                manejarFinDeLlamada();
            });
        } catch (err) {
            mostrarError('No se pudo iniciar la llamada.');
            setBadge('ready', 'Listo');
            btnLlamar.disabled = false;
        }
    }

    function colgar() {
        if (activeCall) activeCall.disconnect();
    }

    async function manejarFinDeLlamada() {
        detenerCronometro();
        btnColgar.hidden = true;
        setBadge('ready', 'Llamada finalizada');

        let resultadoSugerido = 'contestada';
        try {
            if (activeCallSid) {
                const respuesta = await fetch(`/dialer/llamada/${activeCallSid}`);
                if (respuesta.ok) {
                    const datos = await respuesta.json();
                    if (datos.resultado) resultadoSugerido = datos.resultado;
                }
            }
        } catch (err) {
            // si falla la consulta, seguimos con el valor por defecto
        }

        const radio = wrapupOptions.querySelector(`input[value="${resultadoSugerido}"]`);
        if (radio) radio.checked = true;

        wrapupPanel.hidden = false;
    }

    async function confirmarWrapup() {
        const seleccionado = wrapupOptions.querySelector('input[name="resultado"]:checked');
        if (!seleccionado) {
            mostrarError('Elige un resultado para la llamada.');
            return;
        }

        btnConfirmar.disabled = true;
        try {
            const respuesta = await fetch(wrapupUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    call_sid: activeCallSid,
                    resultado: seleccionado.value,
                }),
            });
            if (!respuesta.ok) throw new Error('wrapup');
            const datos = await respuesta.json();

            wrapupPanel.hidden = true;
            activeCall = null;
            activeCallSid = null;
            cliente = datos.cliente;
            pintarCliente();

            if (cliente) {
                setBadge('ready', 'Listo');
                await llamar();
            } else {
                setBadge('ready', 'Cola completada');
            }
        } catch (err) {
            mostrarError('No se pudo guardar el resultado. Inténtalo de nuevo.');
        } finally {
            btnConfirmar.disabled = false;
        }
    }

    btnLlamar.addEventListener('click', llamar);
    btnColgar.addEventListener('click', colgar);
    btnConfirmar.addEventListener('click', confirmarWrapup);

    pintarCliente();
    if (cliente) {
        inicializarDevice();
    } else {
        setBadge('ready', 'Listo');
    }
})();
