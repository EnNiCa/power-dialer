(function () {
    const app = document.getElementById('dialer-app');
    if (!app) return;

    const registrarUrl = app.dataset.registrarUrl;

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

    let cliente = window.DIALER_CLIENTE || null;

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: cliente.id,
                    resultado: seleccionado.value,
                }),
            });
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

    btnTerminada.addEventListener('click', mostrarWrapup);
    btnConfirmar.addEventListener('click', confirmarWrapup);

    pintarCliente();
})();
