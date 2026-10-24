async function verificarSesion() {
  try {
    const respuesta = await fetch("/api/me");

    if (!respuesta.ok) {
      window.location.href = "/login.html";
      return;
    }

    const usuario = await respuesta.json();

    // Mostrar usuario logueado
    const usuarioActual = document.getElementById("usuarioActual");

    if (usuarioActual) {
      usuarioActual.textContent = `${usuario.nombre} - Rol: ${usuario.rol}`;
    }

    // Botones principales
    const btnAlta = document.getElementById("btnAlta");
    const btnBaja = document.getElementById("btnBaja");
    const btnUsuarios = document.getElementById("btnUsuarios");
    const bloqueImportarExcel = document.getElementById("bloqueImportarExcel");

    // Si el rol es CONSULTA, ocultar ALTA y BAJA
    if (usuario.rol === "CONSULTA") {
      if (btnAlta) {
        btnAlta.classList.add("oculto");
      }

      if (btnBaja) {
        btnBaja.classList.add("oculto");
      }

      // Para que no arranque mostrando la pantalla de alta
      mostrarPantalla("pantallaConsultas");

    } else {
      if (btnAlta) {
        btnAlta.classList.remove("oculto");
      }

      if (btnBaja) {
        btnBaja.classList.remove("oculto");
      }
    }

    // Solo SUPER ADMIN ve el botón USUARIOS y la importación por Excel
    if (usuario.rol === "SUPER ADMIN") {
      if (btnUsuarios) {
        btnUsuarios.classList.remove("oculto");
      }

      if (bloqueImportarExcel) {
        bloqueImportarExcel.classList.remove("oculto");
      }

    } else {
      if (btnUsuarios) {
        btnUsuarios.classList.add("oculto");
      }

      if (bloqueImportarExcel) {
        bloqueImportarExcel.classList.add("oculto");
      }
    }

  } catch (error) {
    window.location.href = "/login.html";
  }
}

async function cerrarSesion() {
  await fetch("/api/logout", {
    method: "POST"
  });

  window.location.href = "/login.html";
}

function mostrarPantalla(idPantalla) {
  const pantallas = document.querySelectorAll(".pantalla");

  pantallas.forEach(pantalla => {
    pantalla.classList.add("oculto");
  });

  document.getElementById(idPantalla).classList.remove("oculto");

  limpiarMensaje();

  if (idPantalla === "pantallaConsultas") {
    cargarConsultas();
  }

  if (idPantalla === "pantallaStock") {
    cargarStock();
  }

  if (idPantalla === "pantallaMovimientos") {
    cargarMovimientos();
  }

  if (idPantalla === "pantallaUsuarios") {
  cargarUsuarios();
}
}

function mostrarMensaje(texto, tipo = "ok") {
  const mensaje = document.getElementById("mensaje");
  mensaje.textContent = texto;
  mensaje.className = tipo;
}

function limpiarMensaje() {
  const mensaje = document.getElementById("mensaje");
  mensaje.textContent = "";
  mensaje.className = "";
}

function formatearFechaUruguay(fecha) {
  if (!fecha) {
    return "";
  }

  try {
    const textoFecha = String(fecha).replace(" ", "T");

    // SQLite guarda CURRENT_TIMESTAMP en UTC.
    // Z para indicar que es hora UTC.
    const fechaUTC = new Date(textoFecha + "Z");

    if (isNaN(fechaUTC.getTime())) {
      return fecha;
    }

    return fechaUTC.toLocaleString("es-UY", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

  } catch (error) {
    return fecha;
  }
}

function mostrarConfirmacionModal({
  titulo = "Confirmar acción",
  mensaje = "",
  textoConfirmar = "Confirmar",
  peligro = false
}) {
  return new Promise(resolve => {
    const modal = document.getElementById("modalConfirmacion");
    const modalTitulo = document.getElementById("modalTitulo");
    const modalMensaje = document.getElementById("modalMensaje");
    const modalCancelar = document.getElementById("modalCancelar");
    const modalAceptar = document.getElementById("modalAceptar");

    if (!modal || !modalTitulo || !modalMensaje || !modalCancelar || !modalAceptar) {
      const confirmarFallback = confirm(mensaje || titulo);
      resolve(confirmarFallback);
      return;
    }

    modalTitulo.textContent = titulo;
    modalMensaje.textContent = mensaje;
    modalAceptar.textContent = textoConfirmar;

    modalAceptar.className = peligro
      ? "btn-modal btn-confirmar-peligro"
      : "btn-modal btn-confirmar";

    modal.classList.remove("oculto");

    function cerrarModal(resultado) {
      modal.classList.add("oculto");

      modalCancelar.removeEventListener("click", cancelar);
      modalAceptar.removeEventListener("click", aceptar);
      modal.removeEventListener("click", clickFuera);
      document.removeEventListener("keydown", teclaEscape);

      resolve(resultado);
    }

    function cancelar() {
      cerrarModal(false);
    }

    function aceptar() {
      cerrarModal(true);
    }

    function clickFuera(evento) {
      if (evento.target === modal) {
        cerrarModal(false);
      }
    }

    function teclaEscape(evento) {
      if (evento.key === "Escape") {
        cerrarModal(false);
      }
    }

    modalCancelar.addEventListener("click", cancelar);
    modalAceptar.addEventListener("click", aceptar);
    modal.addEventListener("click", clickFuera);
    document.addEventListener("keydown", teclaEscape);
  });
}

async function registrarAlta() {
  const activo_fijo = document.getElementById("altaActivoFijo").value.trim();
  const producto = document.getElementById("altaProducto").value.trim();
  const marca = document.getElementById("altaMarca").value.trim();
  const modelo = document.getElementById("altaModelo").value.trim();
  const tipo_producto = document.getElementById("altaTipoProducto").value.trim();

  if (!activo_fijo) {
    mostrarMensaje("Ingresá el activo fijo", "error");
    return;
  }

  try {
    const respuesta = await fetch("/api/alta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto
      })
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    document.getElementById("altaActivoFijo").value = "";
    document.getElementById("altaProducto").value = "";
    document.getElementById("altaMarca").value = "";
    document.getElementById("altaModelo").value = "";
    document.getElementById("altaTipoProducto").value = "";

    document.getElementById("altaActivoFijo").focus();

  } catch (error) {
    console.error(error);
    mostrarMensaje("Error al registrar el alta", "error");
  }
}

async function verificarActivoBaja() {
  const activoFijo = document.getElementById("bajaActivoFijo").value.trim();
  const preview = document.getElementById("previewBaja");
  const botonBaja = document.getElementById("btnRegistrarBaja");

  preview.innerHTML = "";
  preview.classList.add("oculto");
  botonBaja.disabled = true;

  if (activoFijo === "") {
    mostrarMensaje("Ingresá o escaneá un activo fijo", "error");
    return;
  }

  try {
    const respuesta = await fetch(
      "/api/activo/" + encodeURIComponent(activoFijo)
    );

    const activo = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(activo.error, "error");
      return;
    }

    limpiarMensaje();

    let claseEstado = activo.estado === "ALTA" ? "estado-alta" : "estado-baja";

    preview.innerHTML = `
      <h3>Activo encontrado</h3>

      <p><strong>Activo fijo:</strong> ${activo.activo_fijo}</p>
      <p><strong>Producto:</strong> ${activo.producto}</p>
      <p><strong>Marca:</strong> ${activo.marca || ""}</p>
      <p><strong>Modelo:</strong> ${activo.modelo}</p>
      <p><strong>Tipo de producto:</strong> ${activo.tipo_producto || ""}</p>
      <p><strong>Estado actual:</strong>
        <span class="${claseEstado}">${activo.estado}</span>
      </p>
      <p><strong>Última actualización:</strong> ${formatearFechaUruguay(activo.fecha)}</p>
    `;

    preview.classList.remove("oculto");

    if (activo.estado === "ALTA") {
      botonBaja.disabled = false;
    } else {
      botonBaja.disabled = true;
      mostrarMensaje("Este activo ya está en estado BAJA", "error");
    }

  } catch (error) {
    mostrarMensaje("Error de conexión con el servidor", "error");
  }
}

async function registrarBaja() {
  const activoFijo = document.getElementById("bajaActivoFijo").value.trim();

  if (activoFijo === "") {
    mostrarMensaje("Ingresá o escaneá un activo fijo", "error");
    return;
  }

const confirmar = await mostrarConfirmacionModal({
  titulo: "Confirmar baja de activo",
  mensaje:
    "Vas a dar de BAJA el activo fijo: " + activoFijo + "\n\n" +
    "Esta acción quedará registrada en movimientos.",
  textoConfirmar: "Confirmar baja",
  peligro: true
});

if (!confirmar) {
  return;
}

  const datos = {
    activo_fijo: activoFijo
  };

  try {
    const respuesta = await fetch("/api/baja", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    document.getElementById("bajaActivoFijo").value = "";
    document.getElementById("previewBaja").innerHTML = "";
    document.getElementById("previewBaja").classList.add("oculto");
    document.getElementById("btnRegistrarBaja").disabled = true;

    document.getElementById("bajaActivoFijo").focus();

  } catch (error) {
    mostrarMensaje("Error de conexión con el servidor", "error");
  }
}

async function cargarConsultas() {
  const buscar = document.getElementById("buscarConsulta").value;

  let url = "/api/consultas";

  if (buscar.trim() !== "") {
    url += "?buscar=" + encodeURIComponent(buscar);
  }

  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    const tabla = document.getElementById("tablaConsultas");
    tabla.innerHTML = "";

    datos.forEach(item => {
      tabla.innerHTML += `
        <tr>
          <td>${item.activo_fijo}</td>
          <td>${item.producto}</td>
          <td>${item.modelo}</td>
          <td>${item.estado}</td>
          <td>${formatearFechaUruguay(item.fecha)}</td>
        </tr>
      `;
    });

  } catch (error) {
    mostrarMensaje("Error al cargar consultas", "error");
  }
}

async function cargarStock() {
  const buscar = document.getElementById("buscarStock").value;

  let url = "/api/stock";

  if (buscar.trim() !== "") {
    url += "?buscar=" + encodeURIComponent(buscar);
  }

  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(datos.error, "error");
      return;
    }

    const tabla = document.getElementById("tablaStock");
    tabla.innerHTML = "";

    if (datos.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="4">No se encontraron resultados</td>
        </tr>
      `;
      return;
    }

    datos.forEach(item => {
      const claseAlerta = item.alerta === "BAJO STOCK" ? "bajo-stock" : "";

      tabla.innerHTML += `
        <tr class="${claseAlerta}">
          <td>${item.producto}</td>
          <td>${item.modelo}</td>
          <td>${item.cantidad}</td>
          <td>${item.alerta}</td>
        </tr>
      `;
    });

  } catch (error) {
    mostrarMensaje("Error al cargar stock", "error");
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => {
        console.log("Service Worker registrado correctamente");
      })
      .catch(error => {
        console.log("Error al registrar Service Worker", error);
      });
  });
}

async function cargarMovimientos() {
  const buscar = document.getElementById("buscarMovimientos").value;

  let url = "/api/movimientos";

  if (buscar.trim() !== "") {
    url += "?buscar=" + encodeURIComponent(buscar);
  }

  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(datos.error, "error");
      return;
    }

    const tabla = document.getElementById("tablaMovimientos");
    tabla.innerHTML = "";

    if (datos.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="6">No se encontraron movimientos</td>
        </tr>
      `;
      return;
    }

    datos.forEach(item => {
      let claseMovimiento = "";

      if (item.tipo_movimiento === "ALTA") {
        claseMovimiento = "estado-alta";
      }

      if (item.tipo_movimiento === "BAJA") {
        claseMovimiento = "estado-baja";
      }

      tabla.innerHTML += `
        <tr>
          <td>${item.activo_fijo}</td>
          <td class="${claseMovimiento}">${item.tipo_movimiento}</td>
          <td>${formatearFechaUruguay(item.fecha_hora)}</td>
          <td>${item.producto}</td>
          <td>${item.modelo}</td>
          <td>${item.usuario || "Sin dato"}</td>
        </tr>
      `;
    });

  } catch (error) {
    mostrarMensaje("Error al cargar movimientos", "error");
  }
}

async function cargarUsuarios() {
  try {
    const respuesta = await fetch("/api/usuarios");
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(datos.error, "error");
      return;
    }

    const tabla = document.getElementById("tablaUsuarios");
    tabla.innerHTML = "";

    datos.forEach(usuario => {
      const textoBoton = usuario.estado === "ACTIVO" ? "Desactivar" : "Activar";

      tabla.innerHTML += `
        <tr>
          <td>${usuario.nombre}</td>
          <td>${usuario.usuario}</td>
          <td>${usuario.rol}</td>
          <td>${usuario.estado}</td>
          <td>${formatearFechaUruguay(usuario.fecha)}</td>
          <td>
          <button class="btn-tabla" onclick="cambiarEstadoUsuario(${usuario.id})">
          ${textoBoton}
          </button>
          <button class="btn-tabla btn-advertencia" onclick="regenerarClaveUsuario(${usuario.id})">
          Regenerar clave
          </button>
          </td>
        </tr>
      `;
    });

  } catch (error) {
    mostrarMensaje("Error al cargar usuarios", "error");
  }
}

async function crearUsuario() {
  const datos = {
    nombre: document.getElementById("nuevoUsuarioNombre").value,
    usuario: document.getElementById("nuevoUsuarioLogin").value,
    password: document.getElementById("nuevoUsuarioPassword").value,
    rol: document.getElementById("nuevoUsuarioRol").value
  };

  try {
    const respuesta = await fetch("/api/usuarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    document.getElementById("nuevoUsuarioNombre").value = "";
    document.getElementById("nuevoUsuarioLogin").value = "";
    document.getElementById("nuevoUsuarioPassword").value = "";
    document.getElementById("nuevoUsuarioRol").value = "ADMIN";

    cargarUsuarios();

  } catch (error) {
    mostrarMensaje("Error al crear usuario", "error");
  }
}

async function cambiarEstadoUsuario(id) {
const confirmar = await mostrarConfirmacionModal({
  titulo: "Cambiar estado de usuario",
  mensaje:
    "Vas a cambiar el estado de este usuario.\n\n" +
    "Si está ACTIVO pasará a INACTIVO.\n" +
    "Si está INACTIVO pasará a ACTIVO.",
  textoConfirmar: "Cambiar estado",
  peligro: false
});

if (!confirmar) {
  return;
}

  try {
    const respuesta = await fetch(`/api/usuarios/${id}/estado`, {
      method: "PATCH"
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    cargarUsuarios();

  } catch (error) {
    mostrarMensaje("Error al cambiar estado del usuario", "error");
  }
}

async function importarExcel() {
  const archivo = document.getElementById("archivoExcel").files[0];
  const resultadoDiv = document.getElementById("resultadoImportacion");

  resultadoDiv.innerHTML = "";

  if (!archivo) {
    mostrarMensaje("Seleccioná un archivo Excel", "error");
    return;
  }

  const formData = new FormData();
  formData.append("archivo", archivo);

  try {
    const respuesta = await fetch("/api/importar-excel", {
      method: "POST",
      body: formData
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    let html = `
      <h3>Resultado</h3>
      <p><strong>Creados:</strong> ${resultado.creados}</p>
      <p><strong>Actualizados:</strong> ${resultado.actualizados}</p>
    `;

    if (resultado.errores && resultado.errores.length > 0) {
      html += `
        <h4>Errores encontrados</h4>
        <ul>
      `;

      resultado.errores.forEach(error => {
        html += `<li>${error}</li>`;
      });

      html += `</ul>`;
    }

    resultadoDiv.innerHTML = html;

    document.getElementById("archivoExcel").value = "";

  } catch (error) {
    mostrarMensaje("Error al importar Excel", "error");
  }
}

async function cambiarClave() {
  const datos = {
    claveActual: document.getElementById("claveActual").value,
    nuevaClave: document.getElementById("nuevaClave").value,
    confirmarClave: document.getElementById("confirmarClave").value
  };

  try {
    const respuesta = await fetch("/api/cambiar-clave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    document.getElementById("claveActual").value = "";
    document.getElementById("nuevaClave").value = "";
    document.getElementById("confirmarClave").value = "";

  } catch (error) {
    mostrarMensaje("Error al cambiar la clave", "error");
  }
}

async function verificarAdaptadorBaja() {
  const activoFijo = document.getElementById("bajaAdaptadorActivoFijo").value.trim();
  const preview = document.getElementById("previewBajaAdaptador");
  const botonBaja = document.getElementById("btnRegistrarBajaAdaptador");

  preview.innerHTML = "";
  preview.classList.add("oculto");
  botonBaja.disabled = true;

  if (activoFijo === "") {
    mostrarMensaje("Ingresá o escaneá un activo fijo", "error");
    return;
  }

  try {
    const respuesta = await fetch(
      "/api/adaptador/" + encodeURIComponent(activoFijo)
    );

    const activo = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(activo.error, "error");
      return;
    }

    limpiarMensaje();

    let claseEstado = activo.estado === "ALTA" ? "estado-alta" : "estado-baja";

    preview.innerHTML = `
      <h3>Adaptador encontrado</h3>

      <p><strong>Activo fijo:</strong> ${activo.activo_fijo}</p>
      <p><strong>Producto:</strong> ${activo.producto}</p>
      <p><strong>Marca:</strong> ${activo.marca || ""}</p>
      <p><strong>Modelo:</strong> ${activo.modelo}</p>
      <p><strong>Tipo de producto:</strong> ${activo.tipo_producto || ""}</p>
      <p><strong>Estado actual:</strong>
        <span class="${claseEstado}">${activo.estado}</span>
      </p>
      <p><strong>Última actualización:</strong> ${formatearFechaUruguay(activo.fecha)}</p>
    `;

    preview.classList.remove("oculto");

    if (activo.estado === "ALTA") {
      botonBaja.disabled = false;
    } else {
      botonBaja.disabled = true;
      mostrarMensaje("Este adaptador ya está en estado BAJA", "error");
    }

  } catch (error) {
    mostrarMensaje("Error de conexión con el servidor", "error");
  }
}


async function registrarBajaAdaptador() {
  const activoFijo = document.getElementById("bajaAdaptadorActivoFijo").value.trim();

  if (activoFijo === "") {
    mostrarMensaje("Ingresá o escaneá un activo fijo", "error");
    return;
  }

const confirmar = await mostrarConfirmacionModal({
  titulo: "Confirmar baja de adaptador",
  mensaje:
    "Vas a dar de BAJA el adaptador: " + activoFijo + "\n\n" +
    "Esta acción quedará registrada en movimientos.",
  textoConfirmar: "Confirmar baja",
  peligro: true
});

if (!confirmar) {
  return;
}

  const datos = {
    activo_fijo: activoFijo
  };

  try {
    const respuesta = await fetch("/api/baja-adaptador", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    document.getElementById("bajaAdaptadorActivoFijo").value = "";
    document.getElementById("previewBajaAdaptador").innerHTML = "";
    document.getElementById("previewBajaAdaptador").classList.add("oculto");
    document.getElementById("btnRegistrarBajaAdaptador").disabled = true;

    document.getElementById("bajaAdaptadorActivoFijo").focus();

  } catch (error) {
    mostrarMensaje("Error al dar de baja el adaptador", "error");
  }
}

async function registrarAltaAdaptador() {
  const datos = {
    activo_fijo: document.getElementById("altaAdaptadorActivoFijo").value,
    producto: document.getElementById("altaAdaptadorProducto").value,
    marca: document.getElementById("altaAdaptadorMarca").value,
    modelo: document.getElementById("altaAdaptadorModelo").value
  };

  try {
    const respuesta = await fetch("/api/alta-adaptador", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    document.getElementById("altaAdaptadorActivoFijo").value = "";
    document.getElementById("altaAdaptadorProducto").value = "Adaptador";
    document.getElementById("altaAdaptadorMarca").value = "";
    document.getElementById("altaAdaptadorModelo").value = "";

    document.getElementById("altaAdaptadorActivoFijo").focus();

  } catch (error) {
    mostrarMensaje("Error al dar de alta el adaptador", "error");
  }
}

async function regenerarClaveUsuario(id) {
const confirmar = await mostrarConfirmacionModal({
  titulo: "Regenerar clave",
  mensaje:
    "Vas a regenerar la clave de este usuario.\n\n" +
    "La clave anterior dejará de funcionar.\n" +
    "Se generará una nueva clave temporal.",
  textoConfirmar: "Regenerar clave",
  peligro: true
});

if (!confirmar) {
  return;
}

  try {
    const respuesta = await fetch(`/api/usuarios/${id}/regenerar-clave`, {
      method: "POST"
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(resultado.error, "error");
      return;
    }

    mostrarMensaje(resultado.mensaje, "ok");

    const resultadoClave = document.getElementById("resultadoClaveUsuario");

    resultadoClave.innerHTML = `
      <div class="clave-temporal">
        <p><strong>Usuario:</strong> ${resultado.nombre} (${resultado.usuario})</p>
        <p><strong>Nueva clave temporal:</strong></p>
        <code>${resultado.nuevaClave}</code>
        <p>Copiá esta clave y pasásela al usuario. Luego el usuario puede cambiarla desde "Cambiar clave".</p>
      </div>
    `;

  } catch (error) {
    mostrarMensaje("Error al regenerar clave", "error");
  }
}

verificarSesion();