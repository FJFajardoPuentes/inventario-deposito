const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
require("dotenv").config();
const nodemailer = require("nodemailer");

const { run, get, all } = require("./database");

const app = express();
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({
  dest: "uploads/"
});
const PORT = 3000;

app.use(express.json());
app.use(session({
  secret: "CAMBIAR_ESTA_CLAVE_SECRETA_INVENTARIO",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(express.static(path.join(__dirname, "public")));

function requiereLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({
      error: "No hay sesión activa"
    });
  }

  next();
}

function requiereRol(rolesPermitidos) {
  return function (req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        error: "No hay sesión activa"
      });
    }

    if (!rolesPermitidos.includes(req.session.usuario.rol)) {
      return res.status(403).json({
        error: "No tenés permisos para realizar esta acción. Contactarse con el Administrador"
      });
    }

    next();
  };
}

async function guardarMovimiento(req, activo_fijo, tipo_movimiento, producto, modelo) {
  const usuario = req.session?.usuario
    ? `${req.session.usuario.nombre} (${req.session.usuario.email})`
    : "Sistema";

  await run(
    `
    INSERT INTO movimientos (
      activo_fijo,
      tipo_movimiento,
      producto,
      modelo,
      usuario
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      activo_fijo,
      tipo_movimiento,
      producto,
      modelo,
      usuario
    ]
  );
}

function correoConfigurado() {
  return (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.MAIL_FROM &&
    process.env.MAIL_TO
  );
}

function crearTransporterCorreo() {
  const opciones = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true"
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    opciones.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };
  }

  return nodemailer.createTransport(opciones);
}

async function enviarCorreoBajoStock(producto, modelo, cantidad) {
  if (!correoConfigurado()) {
    console.log("Correo no configurado. No se envió alerta de bajo stock.");
    return;
  }

  const transporter = crearTransporterCorreo();

  const minimo = Number(process.env.STOCK_MINIMO || 3);

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
    subject: `Bajo stock: ${producto} ${modelo}`,
    text: `
Alerta de bajo stock

Producto: ${producto}
Modelo: ${modelo}
Stock actual: ${cantidad}
Mínimo configurado: ${minimo}

Revisar reposición en el sistema de inventario.
    `,
    html: `
      <h2>Alerta de bajo stock</h2>

      <p>Se detectó un producto con stock bajo.</p>

      <table border="1" cellpadding="8" cellspacing="0">
        <tr>
          <th>Producto</th>
          <td>${producto}</td>
        </tr>
        <tr>
          <th>Modelo</th>
          <td>${modelo}</td>
        </tr>
        <tr>
          <th>Stock actual</th>
          <td>${cantidad}</td>
        </tr>
        <tr>
          <th>Mínimo configurado</th>
          <td>${minimo}</td>
        </tr>
      </table>

      <p>Revisar reposición en el sistema de inventario.</p>
    `
  });
}

async function verificarBajoStockYEnviarCorreo(producto, modelo) {
  try {
    const minimo = Number(process.env.STOCK_MINIMO || 3);

    const stock = await get(
      `
      SELECT COUNT(*) AS cantidad
      FROM activos
      WHERE estado = 'ALTA'
        AND producto = ?
        AND modelo = ?
      `,
      [
        producto,
        modelo
      ]
    );

    const cantidad = stock ? stock.cantidad : 0;

    if (cantidad < minimo) {
      await enviarCorreoBajoStock(producto, modelo, cantidad);
      console.log(`Alerta enviada por bajo stock: ${producto} ${modelo} - cantidad ${cantidad}`);
    }

  } catch (error) {
    console.error("Error al verificar/enviar alerta de bajo stock:", error);
  }
}

function generarClaveTemporal() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$";
  let clave = "";

  for (let i = 0; i < 10; i++) {
    const indice = crypto.randomInt(0, caracteres.length);
    clave += caracteres[indice];
  }

  return clave;
}

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        error: "Usuario y contraseña son obligatorios"
      });
    }

    const usuario = await get(
      `
      SELECT
        id,
        nombre,
        email,
        password_hash,
        rol,
        estado
      FROM usuarios
      WHERE email = ?
      `,
      [email]
    );

    if (!usuario) {
      return res.status(401).json({
        error: "Usuario o contraseña incorrectos"
      });
    }

    if (usuario.estado !== "ACTIVO") {
      return res.status(403).json({
        error: "El usuario está inactivo. Por favor contactarse con el Administrador"
      });
    }

    const passwordCorrecta = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        error: "Usuario o contraseña incorrectos"
      });
    }

    req.session.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    };

    res.json({
      mensaje: "Login correcto",
      usuario: req.session.usuario
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al iniciar sesión"
    });
  }
});

// USUARIO ACTUAL
app.get("/api/me", (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({
      error: "No hay sesión activa"
    });
  }

  res.json(req.session.usuario);
});

// LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      mensaje: "Sesión cerrada correctamente"
    });
  });
});

// LISTAR USUARIOS - SOLO  SUPER ADMIN
app.get("/api/usuarios", requiereRol(["SUPER ADMIN"]), async (req, res) => {
  try {
    const usuarios = await all(
      `
      SELECT
        id,
        nombre,
        email AS usuario,
        rol,
        estado,
        fecha
      FROM usuarios
      ORDER BY nombre
      `
    );

    res.json(usuarios);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al listar usuarios"
    });
  }
});

// CREAR USUARIO - SOLO SUPER ADMIN
app.post("/api/usuarios", requiereRol(["SUPER ADMIN"]), async (req, res) => {
  try {
    let {
      nombre,
      usuario,
      password,
      rol
    } = req.body;

    nombre = nombre?.trim();
    usuario = usuario?.trim().toLowerCase();
    rol = rol?.trim().toUpperCase();

    const rolesPermitidos = ["SUPER ADMIN", "ADMIN", "CONSULTA"];

    if (!nombre || !usuario || !password || !rol) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios"
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        error: "Rol inválido"
      });
    }

    const usuarioExistente = await get(
      "SELECT id FROM usuarios WHERE email = ?",
      [usuario]
    );

    if (usuarioExistente) {
      return res.status(400).json({
        error: "El usuario ya existe"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await run(
      `
      INSERT INTO usuarios (
        nombre,
        email,
        password_hash,
        rol,
        estado
      )
      VALUES (?, ?, ?, ?, 'ACTIVO')
      `,
      [
        nombre,
        usuario,
        passwordHash,
        rol
      ]
    );

    res.json({
      mensaje: "Usuario creado correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al crear usuario"
    });
  }
});

// ACTIVAR / DESACTIVAR USUARIO - SOLO  SUPER ADMIN
app.patch("/api/usuarios/:id/estado", requiereRol(["SUPER ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const usuario = await get(
      "SELECT id, nombre, estado FROM usuarios WHERE id = ?",
      [id]
    );

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado"
      });
    }

    const nuevoEstado = usuario.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    if (id === req.session.usuario.id && nuevoEstado === "INACTIVO") {
      return res.status(400).json({
        error: "No podés desactivar tu propio usuario"
      });
    }

    await run(
      "UPDATE usuarios SET estado = ? WHERE id = ?",
      [nuevoEstado, id]
    );

    res.json({
      mensaje: "Estado del usuario actualizado correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al cambiar estado del usuario"
    });
  }
});

//ALTA
app.post("/api/alta", requiereRol(["SUPER ADMIN", "ADMIN"]), async (req, res) => {
  try {
    let {
      activo_fijo,
      producto,
      marca,
      modelo,
      tipo_producto
    } = req.body;

    activo_fijo = activo_fijo?.trim();

    if (!activo_fijo) {
      return res.status(400).json({
        error: "El activo fijo es obligatorio"
      });
    }

    const activoExistente = await get(
      "SELECT * FROM activos WHERE activo_fijo = ?",
      [activo_fijo]
    );

    // SI EL ACTIVO YA EXISTE
    if (activoExistente) {
      if (activoExistente.estado === "ALTA") {
        return res.status(400).json({
          error: "Este activo ya está en estado ALTA"
        });
      }

      // SI EXISTE PERO ESTÁ EN BAJA, LO PASA A ALTA SIN PEDIR CAMPOS
      await run(
        `
        UPDATE activos
        SET estado = 'ALTA',
            ultima_actualizacion = CURRENT_TIMESTAMP
        WHERE activo_fijo = ?
        `,
        [activo_fijo]
      );

      await guardarMovimiento(
        req,
        activo_fijo,
        "ALTA",
        activoExistente.producto,
        activoExistente.modelo
      );

      return res.json({
        mensaje: "Activo existente dado de ALTA correctamente"
      });
    }

    // SI EL ACTIVO NO EXISTE, AHÍ SÍ PIDE LOS DATOS
    producto = producto?.trim();
    marca = marca?.trim() || "";
    modelo = modelo?.trim();
    tipo_producto = tipo_producto?.trim() || "";

    if (!producto || !modelo) {
      return res.status(400).json({
        error: "Como es un activo nuevo, producto y modelo son obligatorios"
      });
    }

    await run(
      `
      INSERT INTO activos (
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto,
        estado
      )
      VALUES (?, ?, ?, ?, ?, 'ALTA')
      `,
      [
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto
      ]
    );

    await guardarMovimiento(req, activo_fijo, "ALTA", producto, modelo);

    res.json({
      mensaje: "Activo creado y dado de ALTA correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al registrar el ALTA"
    });
  }
});

// BAJA
app.post("/api/baja", requiereRol(["SUPER ADMIN", "ADMIN"]), async (req, res) => {
  try {
    let { activo_fijo } = req.body;

    activo_fijo = activo_fijo?.trim();

    if (!activo_fijo) {
      return res.status(400).json({
        error: "El activo fijo es obligatorio"
      });
    }

    const activo = await get(
      "SELECT * FROM activos WHERE activo_fijo = ?",
      [activo_fijo]
    );

    if (!activo) {
      return res.status(404).json({
        error: "Activo fijo no encontrado"
      });
    }

    if (activo.estado === "BAJA") {
      return res.status(400).json({
        error: "Este activo ya está en estado BAJA"
      });
    }

    await run(
      `
      UPDATE activos
      SET estado = 'BAJA',
          ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE activo_fijo = ?
      `,
      [activo_fijo]
    );

await guardarMovimiento(req, activo_fijo, "BAJA", activo.producto, activo.modelo);

await verificarBajoStockYEnviarCorreo(activo.producto, activo.modelo);

    res.json({
      mensaje: "Activo dado de BAJA correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al registrar la BAJA"
    });
  }
});

// BUSCAR UN ACTIVO POR ACTIVO FIJO
app.get("/api/activo/:activo_fijo", requiereLogin, async (req, res) => {
  try {
    const activoFijo = req.params.activo_fijo.trim();

    const activo = await get(
      `
      SELECT
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto,
        estado,
        ultima_actualizacion AS fecha
      FROM activos
      WHERE activo_fijo = ?
      `,
      [activoFijo]
    );

    if (!activo) {
      return res.status(404).json({
        error: "Activo fijo no encontrado"
      });
    }

    res.json(activo);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al buscar el activo"
    });
  }
});
// CONSULTAS
app.get("/api/consultas", requiereLogin, async (req, res) => {
  try {
    const buscar = req.query.buscar?.trim();

    let resultado;

    if (buscar) {
      resultado = await all(
        `
        SELECT
          activo_fijo,
          producto,
          modelo,
          estado,
          ultima_actualizacion AS fecha
        FROM activos
        WHERE activo_fijo LIKE ?
           OR producto LIKE ?
           OR modelo LIKE ?
           OR estado LIKE ?
        ORDER BY ultima_actualizacion DESC
        `,
        [
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`
        ]
      );
    } else {
      resultado = await all(
        `
        SELECT
          activo_fijo,
          producto,
          modelo,
          estado,
          ultima_actualizacion AS fecha
        FROM activos
        ORDER BY ultima_actualizacion DESC
        `
      );
    }

    res.json(resultado);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al consultar activos"
    });
  }
});

// STOCK
app.get("/api/stock", requiereLogin, async (req, res) => {
  try {
    const buscar = req.query.buscar?.trim();

    let resultado;

    if (buscar) {
      resultado = await all(
        `
        SELECT
          producto,
          modelo,
          COUNT(*) AS cantidad,
          CASE
            WHEN COUNT(*) < 3 THEN 'BAJO STOCK'
            ELSE 'OK'
          END AS alerta
        FROM activos
        WHERE estado = 'ALTA'
          AND (
            producto LIKE ?
            OR modelo LIKE ?
            OR tipo_producto LIKE ?
          )
        GROUP BY producto, modelo
        ORDER BY producto, modelo
        `,
        [
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`
        ]
      );
    } else {
      resultado = await all(
        `
        SELECT
          producto,
          modelo,
          COUNT(*) AS cantidad,
          CASE
            WHEN COUNT(*) < 3 THEN 'BAJO STOCK'
            ELSE 'OK'
          END AS alerta
        FROM activos
        WHERE estado = 'ALTA'
        GROUP BY producto, modelo
        ORDER BY producto, modelo
        `
      );
    }

    res.json(resultado);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al consultar stock"
    });
  }
});

// MOVIMIENTOS
app.get("/api/movimientos", requiereLogin, async (req, res) => {
  try {
    const buscar = req.query.buscar?.trim();

    let resultado;

    if (buscar) {
      resultado = await all(
        `
        SELECT
          activo_fijo,
          tipo_movimiento,
          fecha_hora,
          producto,
          modelo,
          COALESCE(usuario, 'Sin dato') AS usuario
        FROM movimientos
        WHERE activo_fijo LIKE ?
           OR tipo_movimiento LIKE ?
           OR fecha_hora LIKE ?
           OR producto LIKE ?
           OR modelo LIKE ?
           OR COALESCE(usuario, '') LIKE ?
        ORDER BY fecha_hora DESC
        `,
        [
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`,
          `%${buscar}%`
        ]
      );
    } else {
      resultado = await all(
        `
        SELECT
          activo_fijo,
          tipo_movimiento,
          fecha_hora,
          producto,
          modelo,
          COALESCE(usuario, 'Sin dato') AS usuario
        FROM movimientos
        ORDER BY fecha_hora DESC
        `
      );
    }

    res.json(resultado);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al consultar movimientos"
    });
  }
});

// IMPORTAR EXCEL - SOLO SUPER ADMIN
app.post("/api/importar-excel", requiereRol(["SUPER ADMIN"]), upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No se recibió ningún archivo"
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const nombreHoja = workbook.SheetNames[0];
    const hoja = workbook.Sheets[nombreHoja];

    const filas = XLSX.utils.sheet_to_json(hoja, {
      defval: ""
    });

    let creados = 0;
    let actualizados = 0;
    let errores = [];

    function obtenerValor(fila, nombres) {
      for (const nombre of nombres) {
        if (fila[nombre] !== undefined && fila[nombre] !== null) {
          return String(fila[nombre]).trim();
        }
      }

      return "";
    }

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numeroFila = i + 2;

      const activo_fijo = obtenerValor(fila, [
        "activo_fijo",
        "Activo fijo",
        "Activo Fijo",
        "AF"
      ]);

      const producto = obtenerValor(fila, [
        "producto",
        "Producto"
      ]);

      const marca = obtenerValor(fila, [
        "marca",
        "Marca"
      ]);

      const modelo = obtenerValor(fila, [
        "modelo",
        "Modelo"
      ]);

      const tipo_producto = obtenerValor(fila, [
        "tipo_producto",
        "Tipo producto",
        "Tipo Producto",
        "Tipo"
      ]);

      let estado = obtenerValor(fila, [
        "estado",
        "Estado"
      ]).toUpperCase();

      if (!estado) {
        estado = "ALTA";
      }

      if (!activo_fijo || !producto || !modelo) {
        errores.push(`Fila ${numeroFila}: activo_fijo, producto y modelo son obligatorios`);
        continue;
      }

      if (estado !== "ALTA" && estado !== "BAJA") {
        errores.push(`Fila ${numeroFila}: estado inválido. Debe ser ALTA o BAJA`);
        continue;
      }

      const activoExistente = await get(
        "SELECT * FROM activos WHERE activo_fijo = ?",
        [activo_fijo]
      );

      if (!activoExistente) {
        await run(
          `
          INSERT INTO activos (
            activo_fijo,
            producto,
            marca,
            modelo,
            tipo_producto,
            estado
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            activo_fijo,
            producto,
            marca,
            modelo,
            tipo_producto,
            estado
          ]
        );

await guardarMovimiento(req, activo_fijo, estado, producto, modelo);

        creados++;

      } else {
        const estadoAnterior = activoExistente.estado;

        await run(
          `
          UPDATE activos
          SET producto = ?,
              marca = ?,
              modelo = ?,
              tipo_producto = ?,
              estado = ?,
              ultima_actualizacion = CURRENT_TIMESTAMP
          WHERE activo_fijo = ?
          `,
          [
            producto,
            marca,
            modelo,
            tipo_producto,
            estado,
            activo_fijo
          ]
        );

        if (estadoAnterior !== estado) {
          await guardarMovimiento(req, activo_fijo, estado, producto, modelo);
        }

        actualizados++;
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({
      mensaje: "Importación finalizada",
      creados,
      actualizados,
      errores
    });

  } catch (error) {
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Error interno al importar Excel"
    });
  }
});

// CAMBIAR CLAVE - USUARIO LOGUEADO
app.post("/api/cambiar-clave", requiereLogin, async (req, res) => {
  try {
    const {
      claveActual,
      nuevaClave,
      confirmarClave
    } = req.body;

    if (!claveActual || !nuevaClave || !confirmarClave) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios"
      });
    }

    if (nuevaClave !== confirmarClave) {
      return res.status(400).json({
        error: "La nueva clave y la confirmación no coinciden"
      });
    }

    if (nuevaClave.length < 6) {
      return res.status(400).json({
        error: "La nueva clave debe tener al menos 6 caracteres"
      });
    }

    const usuario = await get(
      `
      SELECT
        id,
        password_hash
      FROM usuarios
      WHERE id = ?
      `,
      [req.session.usuario.id]
    );

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado"
      });
    }

    const claveCorrecta = await bcrypt.compare(
      claveActual,
      usuario.password_hash
    );

    if (!claveCorrecta) {
      return res.status(400).json({
        error: "La clave actual no es correcta"
      });
    }

    const nuevoHash = await bcrypt.hash(nuevaClave, 10);

    await run(
      "UPDATE usuarios SET password_hash = ? WHERE id = ?",
      [
        nuevoHash,
        usuario.id
      ]
    );

    res.json({
      mensaje: "Clave actualizada correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al cambiar la clave"
    });
  }
});

// BUSCAR ADAPTADOR POR ACTIVO FIJO - TODOS LOS USUARIOS LOGUEADOS
app.get("/api/adaptador/:activo_fijo", requiereLogin, async (req, res) => {
  try {
    const activoFijo = req.params.activo_fijo.trim();

    const activo = await get(
      `
      SELECT
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto,
        estado,
        ultima_actualizacion AS fecha
      FROM activos
      WHERE activo_fijo = ?
      `,
      [activoFijo]
    );

    if (!activo) {
      return res.status(404).json({
        error: "Activo fijo no encontrado"
      });
    }

    const tipoProducto = String(activo.tipo_producto || "").toUpperCase();

    if (!tipoProducto.includes("ADAPTADOR")) {
      return res.status(400).json({
        error: "Este activo no es un adaptador"
      });
    }

    res.json(activo);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al buscar adaptador"
    });
  }
});


// BAJA ADAPTADOR - TODOS LOS USUARIOS LOGUEADOS
app.post("/api/baja-adaptador", requiereLogin, async (req, res) => {
  try {
    let { activo_fijo } = req.body;

    activo_fijo = activo_fijo?.trim();

    if (!activo_fijo) {
      return res.status(400).json({
        error: "El activo fijo es obligatorio"
      });
    }

    const activo = await get(
      "SELECT * FROM activos WHERE activo_fijo = ?",
      [activo_fijo]
    );

    if (!activo) {
      return res.status(404).json({
        error: "Activo fijo no encontrado"
      });
    }

    const tipoProducto = String(activo.tipo_producto || "").toUpperCase();

    if (!tipoProducto.includes("ADAPTADOR")) {
      return res.status(400).json({
        error: "Este activo no es un adaptador"
      });
    }

    if (activo.estado === "BAJA") {
      return res.status(400).json({
        error: "Este adaptador ya está en estado BAJA"
      });
    }

    await run(
      `
      UPDATE activos
      SET estado = 'BAJA',
          ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE activo_fijo = ?
      `,
      [activo_fijo]
    );

await guardarMovimiento(req, activo_fijo, "BAJA", activo.producto, activo.modelo);

await verificarBajoStockYEnviarCorreo(activo.producto, activo.modelo);

    res.json({
      mensaje: "Adaptador dado de BAJA correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al dar de baja el adaptador"
    });
  }
});

// ALTA ADAPTADOR - TODOS LOS USUARIOS LOGUEADOS
app.post("/api/alta-adaptador", requiereLogin, async (req, res) => {
  try {
    let {
      activo_fijo,
      producto,
      marca,
      modelo
    } = req.body;

    activo_fijo = activo_fijo?.trim();
    producto = producto?.trim() || "Adaptador";
    marca = marca?.trim() || "";
    modelo = modelo?.trim();

    const tipo_producto = "Adaptador";

    if (!activo_fijo) {
      return res.status(400).json({
        error: "El activo fijo es obligatorio"
      });
    }

    const activoExistente = await get(
      "SELECT * FROM activos WHERE activo_fijo = ?",
      [activo_fijo]
    );

    // SI YA EXISTE
    if (activoExistente) {
      const tipoProductoExistente = String(activoExistente.tipo_producto || "").toUpperCase();

      if (!tipoProductoExistente.includes("ADAPTADOR")) {
        return res.status(400).json({
          error: "Ese activo fijo ya existe, pero no es un adaptador"
        });
      }

      if (activoExistente.estado === "ALTA") {
        return res.status(400).json({
          error: "Este adaptador ya está en estado ALTA"
        });
      }

      // Si estaba en BAJA, vuelve a ALTA sin pedir datos nuevamente
      await run(
        `
        UPDATE activos
        SET estado = 'ALTA',
            ultima_actualizacion = CURRENT_TIMESTAMP
        WHERE activo_fijo = ?
        `,
        [activo_fijo]
      );

await guardarMovimiento(req, activo_fijo, "ALTA", activoExistente.producto, activoExistente.modelo);

      return res.json({
        mensaje: "Adaptador dado de ALTA nuevamente correctamente"
      });
    }

    // SI NO EXISTE, ES UN ADAPTADOR NUEVO
    if (!modelo) {
      return res.status(400).json({
        error: "Para un adaptador nuevo, el modelo es obligatorio"
      });
    }

    await run(
      `
      INSERT INTO activos (
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto,
        estado
      )
      VALUES (?, ?, ?, ?, ?, 'ALTA')
      `,
      [
        activo_fijo,
        producto,
        marca,
        modelo,
        tipo_producto
      ]
    );

await guardarMovimiento(req, activo_fijo, "ALTA", producto, modelo);

    res.json({
      mensaje: "Adaptador creado y dado de ALTA correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al dar de alta el adaptador"
    });
  }
});

// REGENERAR CLAVE DE USUARIO - SOLO SUPER ADMIN
app.post("/api/usuarios/:id/regenerar-clave", requiereRol(["SUPER ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const usuario = await get(
      `
      SELECT
        id,
        nombre,
        email,
        rol,
        estado
      FROM usuarios
      WHERE id = ?
      `,
      [id]
    );

    if (!usuario) {
      return res.status(404).json({
        error: "Usuario no encontrado"
      });
    }

    if (id === req.session.usuario.id) {
      return res.status(400).json({
        error: "Para cambiar claves usá la opción Cambiar clave"
      });
    }

    const nuevaClave = generarClaveTemporal();
    const nuevoHash = await bcrypt.hash(nuevaClave, 10);

    await run(
      "UPDATE usuarios SET password_hash = ? WHERE id = ?",
      [
        nuevoHash,
        id
      ]
    );

    res.json({
      mensaje: "Clave regenerada correctamente",
      usuario: usuario.email,
      nombre: usuario.nombre,
      nuevaClave
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno al regenerar clave"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});