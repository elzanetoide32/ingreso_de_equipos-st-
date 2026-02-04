const express = require("express");
const mariadb = require("mariadb");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mariadb.createPool({
  host: "192.168.1.50",
  user: "luca",
  password: "Martinaeze11",
  database: "servicio_tecnico",
  connectionLimit: 5
});

// 📤 ENVÍO WHATSAPP
const enviarWhatsApp = async (numero, mensaje) => {
  numero = numero.replace(/\D/g, "");
  if (!numero.startsWith("549")) numero = "549" + numero;

  try {
    await axios.post("http://coinza.duckdns.org:3000/api/sendText",
      {
        session: "default",
        chatId: numero + "@c.us",
        text: mensaje
      },
      {
        headers: { "X-Api-Key": "171c1c89eb454468ad396074eaf91a4e" }
      }
    );
    console.log("WhatsApp enviado a", numero);
  } catch (err) {
    console.log("Error WhatsApp:", err.response?.data || err.message);
  }
};

// 📝 FORM SUBMIT
app.post("/guardar", async (req, res) => {
  const {
    nombre, telefono, tipo_maquina,
    marca, modelo, estado, problema,
    accesorios, recibido_por, usuario_id
  } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();

    await conn.query(
      `INSERT INTO recepciones 
      (nombre, telefono, tipo_maquina, marca, modelo, estado, problema, accesorios, recibido_por, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, telefono, tipo_maquina, marca, modelo, estado, problema, accesorios, recibido_por, usuario_id]
    );
    // 🔍 Buscar nombre del técnico
    const tecnico = await conn.query(
      "SELECT nombre FROM usuarios WHERE id = ?",
      [usuario_id]
    );
    const mensaje = `Hola ${nombre},

Recibimos tu ${tipo_maquina} ${marca} modelo ${modelo} en nuestro servicio técnico.

👤 Ingresado por: ${tecnico}
📌 Incidente: ${estado}
🛠 Problema informado: ${problema}
🔌 Accesorios entregados: ${accesorios}

Tu equipo ya fue registrado y está en revisión técnica.

Le haremos saber los resultados tan pronto los tengamos.`;

    await enviarWhatsApp(telefono, mensaje);

    res.send("✅ Equipo registrado y mensaje enviado");
  } catch (err) {
    console.log(err);
    res.send("❌ Error");
  } finally {
    if (conn) conn.release();
  }
});

//lista db
app.get("/api/recepciones", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(`
      SELECT 
        r.id,
        r.nombre AS cliente,
        r.telefono,
        r.tipo_maquina,
        r.marca,
        r.modelo,
        r.estado,
        r.problema,
        r.fecha,
        u.nombre AS tecnico,
        u.rol
      FROM recepciones r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.fecha DESC
    `);

    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error DB");
  } finally {
    if (conn) conn.release();
  }
});
app.get("/api/usuarios", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT id, nombre FROM usuarios");
    res.json(rows);
  } catch (err) {
    res.status(500).send("Error");
  } finally {
    if (conn) conn.release();
  }
});
app.post("/api/asignar-tecnico", async (req, res) => {
  const { recepcion_id, usuario_id } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query(
      "UPDATE recepciones SET usuario_id=? WHERE id=?",
      [usuario_id, recepcion_id]
    );
    res.send("OK");
  } catch (err) {
    res.status(500).send("Error");
  } finally {
    if (conn) conn.release();
  }
});


app.listen(3001, () => console.log("Servidor en puerto 3001"));
