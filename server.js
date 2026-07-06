const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config();
const app = express();
const requestedPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
const portCandidates = requestedPort ? [requestedPort] : [8080, 3000, 3001, 5000, 4000];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function ensureColumnExists(table, column, definition) {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows.length === 0) {
    await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    console.log(`Added missing column ${table}.${column}`);
  }
}

async function initSchema() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      year VARCHAR(50),
      series_name VARCHAR(50),
      shift VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await ensureColumnExists('rooms', 'year', 'year VARCHAR(50) AFTER name');
  await ensureColumnExists('rooms', 'series_name', 'series_name VARCHAR(50) AFTER year');
  await ensureColumnExists('rooms', 'shift', 'shift VARCHAR(50) AFTER series_name');

  await db.execute(
    `CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      ra VARCHAR(100) NOT NULL,
      series VARCHAR(100) NOT NULL,
      guardian_name VARCHAR(255) NOT NULL,
      guardian_phone VARCHAR(30) NOT NULL,
      room_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await ensureColumnExists('students', 'room_id', 'room_id INT DEFAULT NULL AFTER guardian_phone');
  await ensureColumnExists('students', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER room_id');

  await db.execute(
    `CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      date DATE NOT NULL,
      status ENUM('present', 'absent', 'excused') NOT NULL DEFAULT 'present',
      reason VARCHAR(255),
      notified TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE KEY student_date_unique (student_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await ensureColumnExists('attendance', 'notified', 'notified TINYINT(1) DEFAULT 0 AFTER reason');
  await ensureColumnExists('attendance', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER notified');
}

function buildWhatsappWebUrl(phone, text) {
  const cleaned = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
  return `https://web.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(text)}`;
}

// Rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name, year, series_name, shift FROM rooms ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar salas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar salas' });
  }
});

app.post('/api/rooms', async (req, res) => {
  const { name, year, series_name, shift } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome da sala é obrigatório' });
  try {
    const [result] = await db.execute(
      'INSERT INTO rooms (name, year, series_name, shift) VALUES (?, ?, ?, ?)',
      [name, year || null, series_name || null, shift || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar sala:', error);
    res.status(500).json({ error: 'Erro interno ao criar sala' });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir sala:', error);
    res.status(500).json({ error: 'Erro interno ao excluir sala' });
  }
});

// Series list
app.get('/api/series', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT DISTINCT series FROM students ORDER BY series');
    res.json(rows.map((item) => item.series));
  } catch (error) {
    console.error('Erro ao buscar séries:', error);
    res.status(500).json({ error: 'Erro interno ao buscar séries' });
  }
});

// Students
app.get('/api/students', async (req, res) => {
  try {
    const { series, room_id } = req.query;
    let query = `SELECT s.id, s.name, s.ra, s.series, s.guardian_name, s.guardian_phone, r.id AS room_id, r.name AS room_name
                 FROM students s
                 LEFT JOIN rooms r ON s.room_id = r.id`;
    const params = [];
    const filters = [];
    if (series) { filters.push('s.series = ?'); params.push(series); }
    if (room_id) { filters.push('s.room_id = ?'); params.push(room_id); }
    if (filters.length) query += ' WHERE ' + filters.join(' AND ');
    query += ' ORDER BY s.series, s.name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar alunos:', error);
    res.status(500).json({ error: 'Erro interno ao buscar alunos' });
  }
});

app.post('/api/students', async (req, res) => {
  const { name, ra, series, guardian_name, guardian_phone, room_id } = req.body;
  if (!name || !ra || !guardian_name || !guardian_phone) {
    return res.status(400).json({ error: 'Nome, RA e dados do responsável são obrigatórios' });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO students (name, ra, series, guardian_name, guardian_phone, room_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, ra, series, guardian_name, guardian_phone, room_id || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Erro ao cadastrar aluno:', error);
    res.status(500).json({ error: 'Erro interno ao cadastrar aluno' });
  }
});

app.put('/api/students/:id', async (req, res) => {
  const { name, ra, series, guardian_name, guardian_phone, room_id } = req.body;
  const { id } = req.params;
  if (!name || !ra || !guardian_name || !guardian_phone) {
    return res.status(400).json({ error: 'Nome, RA e dados do responsável são obrigatórios' });
  }

  try {
    const [result] = await db.execute(
      `UPDATE students
       SET name = ?, ra = ?, series = ?, guardian_name = ?, guardian_phone = ?, room_id = ?
       WHERE id = ?`,
      [name, ra, series, guardian_name, guardian_phone, room_id || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar aluno:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar aluno' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM students WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir aluno:', error);
    res.status(500).json({ error: 'Erro interno ao excluir aluno' });
  }
});

// Attendance
app.post('/api/attendance', async (req, res) => {
  const { studentId, date, status, reason } = req.body;
  if (!studentId || !date || !status) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  try {
    const [studentRows] = await db.execute('SELECT * FROM students WHERE id = ?', [studentId]);
    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    const [result] = await db.execute(
      `INSERT INTO attendance (student_id, date, status, reason)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), reason = VALUES(reason)`,
      [studentId, date, status, reason || null]
    );

    // Try to get the attendance id (select)
    const [[attendanceRow]] = await db.execute('SELECT id FROM attendance WHERE student_id = ? AND date = ?', [studentId, date]);
    res.json({ success: true, attendanceId: attendanceRow ? attendanceRow.id : null });
  } catch (error) {
    console.error('Erro ao registrar presença:', error);
    res.status(500).json({ error: 'Erro interno ao registrar presença' });
  }
});

app.post('/api/attendance/bulk', async (req, res) => {
  const { date, entries } = req.body;
  if (!date || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Data e registros são obrigatórios' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    for (const entry of entries) {
      const { studentId, status, reason } = entry;
      const [studentRows] = await connection.execute('SELECT * FROM students WHERE id = ?', [studentId]);
      if (studentRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `Aluno não encontrado: ${studentId}` });
      }

      await connection.execute(
        `INSERT INTO attendance (student_id, date, status, reason)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), reason = VALUES(reason)`,
        [studentId, date, status, reason || null]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao registrar faltas em lote:', error);
    res.status(500).json({ error: 'Erro interno ao registrar faltas em lote' });
  } finally {
    connection.release();
  }
});

app.get('/api/attendance', async (req, res) => {
  const { date } = req.query;
  const selectedDate = date || new Date().toISOString().slice(0, 10);

  try {
    const [rows] = await db.execute(
      `SELECT a.id, a.date, a.status, a.reason, a.notified, a.student_id, s.name AS student_name, s.series, r.name AS room_name
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       LEFT JOIN rooms r ON s.room_id = r.id
       WHERE a.date = ?
       ORDER BY s.series, s.name`,
      [selectedDate]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar faltas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar faltas' });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    await db.execute('DELETE FROM attendance');
    await db.execute('DELETE FROM students');
    await db.execute('DELETE FROM rooms');
    await db.execute('ALTER TABLE attendance AUTO_INCREMENT = 1');
    await db.execute('ALTER TABLE students AUTO_INCREMENT = 1');
    await db.execute('ALTER TABLE rooms AUTO_INCREMENT = 1');
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao resetar dados:', error);
    res.status(500).json({ error: 'Erro interno ao resetar dados' });
  }
});

// Notify via WhatsApp Web (returns URL and attendance id if exists)
app.get('/api/notify/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const { date } = req.query;
  try {
    const [rows] = await db.execute('SELECT * FROM students WHERE id = ?', [studentId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Aluno não encontrado' });

    const student = rows[0];
    const selectedDate = date || new Date().toISOString().slice(0, 10);
    const message = `Olá ${student.guardian_name}, informamos que ${student.name} não compareceu à escola em ${selectedDate}. Motivo: não informado.`;
    const url = buildWhatsappWebUrl(student.guardian_phone, message);

    const [attRows] = await db.execute('SELECT id FROM attendance WHERE student_id = ? AND date = ?', [studentId, selectedDate]);
    res.json({ url, message, attendanceId: attRows[0] ? attRows[0].id : null });
  } catch (error) {
    console.error('Erro em notify:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Mark attendance notified
app.post('/api/attendance/:id/notify', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('UPDATE attendance SET notified = 1 WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar notificado:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

async function startServer() {
  await initSchema();

  for (const candidate of portCandidates) {
    try {
      await new Promise((resolve, reject) => {
        const server = app.listen(candidate, () => {
          console.log(`Servidor rodando em http://localhost:${candidate}`);
          resolve();
        });
        server.on('error', reject);
      });
      return;
    } catch (error) {
      if (error.code === 'EADDRINUSE') {
        console.warn(`Porta ${candidate} ocupada, tentando próxima...`);
        continue;
      }
      console.error('Erro ao iniciar o servidor:', error);
      process.exit(1);
    }
  }

  console.error('Não foi possível iniciar o servidor: todas as portas testadas estão ocupadas.');
  process.exit(1);
}

startServer();
