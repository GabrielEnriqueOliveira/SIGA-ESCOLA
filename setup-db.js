const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  try {
    // Conectar ao banco com timeout maior
    const connection = await mysql.createConnection({
      host: 'shinkansen.proxy.rlwy.net',
      port: 42534,
      user: 'root',
      password: 'WONfkbMFLjmsXHpdfwbXMzfTSslMFbMg',
      database: 'railway',
      multipleStatements: true,
      connectTimeout: 30000,
      waitForConnections: true,
      enableKeepAlive: true
    });

    console.log('✅ Conectado ao MySQL Railway');

    // Ler o arquivo schema.sql
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remover as linhas CREATE DATABASE e USE (já estamos no banco correto)
    schema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('CREATE DATABASE') && !line.trim().startsWith('USE'))
      .join('\n');

    // Executar o schema
    await connection.query(schema);
    console.log('✅ Schema criado com sucesso!');

    // Ler e executar seed.sql (opcional)
    const seedPath = path.join(__dirname, 'db', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await connection.query(seed);
      console.log('✅ Dados de exemplo inseridos!');
    }

    await connection.end();
    console.log('✅ Banco de dados pronto para usar!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao configurar banco:', error.message);
    process.exit(1);
  }
}

setupDatabase();
