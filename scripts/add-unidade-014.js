/**
 * Migração: Adiciona unidade 014 - Av. Santa Tecla (Texaco)
 * Execute uma única vez: node scripts/add-unidade-014.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/metas.db');
const db = new Database(dbPath);

try {
    const result = db.prepare(`
        INSERT OR IGNORE INTO unidades (codigo, nome, tipo, is_combinada)
        VALUES ('014', 'Av. Santa Tecla (Texaco)', 'URBANO', 0)
    `).run();

    if (result.changes > 0) {
        console.log('✅ Unidade 014 - Av. Santa Tecla (Texaco) cadastrada com sucesso!');
    } else {
        console.log('ℹ️ Unidade 014 já existia no banco. Nenhuma alteração necessária.');
    }

    const unidade = db.prepare(`SELECT * FROM unidades WHERE codigo = '014'`).get();
    console.log('📋 Registro atual:', JSON.stringify(unidade, null, 2));

    // Listar todas as unidades para confirmação
    const todas = db.prepare(`SELECT codigo, nome, tipo FROM unidades ORDER BY codigo`).all();
    console.log('\n📊 Todas as unidades cadastradas:');
    todas.forEach(u => console.log(`   ${u.codigo} - ${u.nome} (${u.tipo})`));

} finally {
    db.close();
}
