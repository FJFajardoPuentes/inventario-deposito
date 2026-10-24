const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./inventario.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS activos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activo_fijo TEXT UNIQUE NOT NULL,
      producto TEXT NOT NULL,
      marca TEXT,
      modelo TEXT NOT NULL,
      tipo_producto TEXT,
      estado TEXT NOT NULL DEFAULT 'ALTA',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

db.run(`
  CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activo_fijo TEXT NOT NULL,
    tipo_movimiento TEXT NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    producto TEXT NOT NULL,
    modelo TEXT NOT NULL,
    usuario TEXT
  )
`);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'OPERADOR',
      estado TEXT NOT NULL DEFAULT 'ACTIVO',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          cambios: this.changes
        });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  db,
  run,
  get,
  all
};