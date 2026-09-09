(function () {
    const vacio = document.getElementById('panel-llamada-vacio');
    const activa = document.getElementById('panel-llamada-activa');
    if (!vacio || !activa) return;

    const nombreEl = document.getElementById('panel-llamada-nombre');
    const telefonoEl = document.getElementById('panel-llamada-telefono');
    const estadoEl = document.getElementById('panel-llamada-estado');
    const timerEl = document.getElementById('panel-llamada-timer');
    const historialLista = document.getElementById('panel-llamada-historial-lista');
    const sinHistorial = document.getElementById('panel-llamada-sin-historial');

    let intervalId = null;
    let clienteIdCargado = null;

    function leerEstado(clave) {
        try {
            return JSON.parse(localStorage.getItem(clave));
        } catch (err) {
            return null;
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

    function render() {
        const llamada = leerEstado('marcadorLlamada');
        const pendiente = leerEstado('marcadorResultadoPendiente');
        const actual = llamada || pendiente;

        pararIntervalo();

        if (!actual) {
            vacio.hidden = false;
            activa.hidden = true;
            clienteIdCargado = null;
            return;
        }

        vacio.hidden = true;
        activa.hidden = false;
        nombreEl.textContent = actual.nombre || 'Número sin identificar';
        telefonoEl.textContent = actual.telefono;

        if (llamada) {
            estadoEl.textContent = llamada.enPausa ? 'En espera' : 'Llamada en curso';
            timerEl.hidden = false;
            const actualizarTimer = () => { timerEl.textContent = formatoMmSs(segundosTranscurridos(llamada)); };
            actualizarTimer();
            intervalId = setInterval(actualizarTimer, 1000);
        } else {
            estadoEl.textContent = 'Registrando resultado…';
            timerEl.hidden = true;
        }

        if (actual.clienteId) {
            if (actual.clienteId !== clienteIdCargado) {
                clienteIdCargado = actual.clienteId;
                historialLista.innerHTML = '';
                sinHistorial.hidden = true;
                cargarHistorial(actual.clienteId);
            }
        } else {
            clienteIdCargado = null;
            pintarHistorial([]);
        }
    }

    window.addEventListener('storage', render);
    window.addEventListener('marcador-cambio', render);
    render();
})();
