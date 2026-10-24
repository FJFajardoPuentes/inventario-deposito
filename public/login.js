document.getElementById("formLogin").addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("emailLogin").value;
  const password = document.getElementById("passwordLogin").value;
  const mensaje = document.getElementById("mensajeLogin");

  mensaje.textContent = "";
  mensaje.className = "";

  try {
    const respuesta = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      mensaje.textContent = resultado.error;
      mensaje.className = "error";
      return;
    }

    window.location.href = "/index.html";

  } catch (error) {
    mensaje.textContent = "Error de conexión con el servidor";
    mensaje.className = "error";
  }
});