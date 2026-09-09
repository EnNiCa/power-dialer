(function () {
    const app = document.getElementById('dialer-app');
    if (!app) return;

    const registrarUrl = app.dataset.registrarUrl;
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    const errorBox = document.getElementById('dialer-error');
    const emptyBox = document.getElementById('dialer-empty');
    const card = document.getElementById('dialer-card');
    const nombreEl = document.getElementById('dialer-cliente-nombre');
    const telefonoEl = document.getElementById('dialer-cliente-telefono');
    const linkLlamar = document.getElementById('dialer-btn-llamar');
    const btnTerminada = document.getElementById('dialer-btn-terminada');
    const wrapupPanel = document.getElementById('dialer-wrapup');
    const wrapupOptions = document.getElementById('wrapup-options');
    const btnConfirmar = document.getElementById('dialer-btn-confirmar');
    const timerEl = document.getElementById('dialer-card-timer');

    let cliente = window.DIALER_CLIENTE || null;
    let llamadaInicio = null;
    let duracionSegundos = null;
    let timerInterval = null;

    function formatoMmSs(segundos) {
        const m = Math.floor(segundos / 60).toString().padStart(2, '0');
        const s = Math.floor(segundos % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function iniciarTimer() {
        llamadaInicio = Date.now();
        duracionSegundos = null;
        timerEl.textContent = formatoMmSs(0);
        timerEl.hidden = false;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerEl.textContent = formatoMmSs((Date.now() - llamadaInicio) / 1000);
        }, 1000);
    }

    function detenerTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        if (llamadaInicio) {
            duracionSegundos = Math.round((Date.now() - llamadaInicio) / 1000);
        }
        llamadaInicio = null;
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
        wrapupPanel.hidden = true;
        clearInterval(timerInterval);
        timerInterval = null;
        llamadaInicio = null;
        duracionSegundos = null;
        timerEl.hidden = true;
        if (!cliente) {
            card.hidden = true;
            emptyBox.hidden = false;
            return;
        }
        emptyBox.hidden = true;
        card.hidden = false;
        nombreEl.textContent = cliente.nombre;
        telefonoEl.textContent = cliente.telefono;
        linkLlamar.href = `tel:${cliente.telefono}`;
    }

    function mostrarWrapup() {
        detenerTimer();
        wrapupOptions.querySelectorAll('input[name="resultado"]').forEach((r) => {
            r.checked = false;
        });
        wrapupPanel.hidden = false;
    }

    async function confirmarWrapup() {
        const seleccionado = wrapupOptions.querySelector('input[name="resultado"]:checked');
        if (!seleccionado) {
            mostrarError('Elige un resultado para la llamada.');
            return;
        }

        limpiarError();
        btnConfirmar.disabled = true;
        try {
            const respuesta = await fetch(registrarUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    cliente_id: cliente.id,
                    resultado: seleccionado.value,
                    duracion_segundos: duracionSegundos,
                }),
            });
            if (respuesta.status === 409) {
                mostrarError('Este cliente ya no está pendiente (puede que otro agente lo haya gestionado). Recargando la cola…');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }
            if (!respuesta.ok) throw new Error('registrar');
            const datos = await respuesta.json();

            cliente = datos.cliente;
            pintarCliente();
        } catch (err) {
            mostrarError('No se pudo guardar el resultado. Inténtalo de nuevo.');
        } finally {
            btnConfirmar.disabled = false;
        }
    }

    linkLlamar.addEventListener('click', iniciarTimer);
    btnTerminada.addEventListener('click', mostrarWrapup);
    btnConfirmar.addEventListener('click', confirmarWrapup);

    pintarCliente();
})();
