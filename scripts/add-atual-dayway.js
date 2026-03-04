const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/metas.db');
const db = new Database(dbPath);

console.log('Adicionando coluna atual_dayway_percent...');
try {
    db.exec(`ALTER TABLE metas_dayway ADD COLUMN atual_dayway_percent REAL DEFAULT 0`);
    console.log('✅ Coluna adicionada com sucesso!');
} catch (e) {
    if (e.message.includes('duplicate column name')) {
        console.log('✅ A coluna já existe.');
    } else {
        console.error('❌ Erro:', e.message);
    }
}
db.close();
