const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('Conectando ao MySQL Railway...');
    const connection = await mysql.createConnection({
      host: 'shinkansen.proxy.rlwy.net',
      port: 42534,
      user: 'root',
      password: 'WONfkbMFLjmsXHpdfwbXMzfTSslMFbMg',
      database: 'railway',
      connectTimeout: 30000
    });
    console.log('✅ Conectado com sucesso!');
    await connection.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testConnection();
