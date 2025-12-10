/**
 * Script para recriar o banco de dados com o novo schema
 * Execute com: node scripts/reset-db.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/metas.db');

// Verificar se o banco existe
if (fs.existsSync(dbPath)) {
    console.log('Removendo banco de dados antigo...');
    fs.unlinkSync(dbPath);

    // Remover arquivos WAL/SHM se existirem
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
}

console.log('Criando novo banco de dados...');

// Garantir que o diretório data existe
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Criar tabela de unidades
db.exec(`
    CREATE TABLE IF NOT EXISTS unidades (
        id INTEGER PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT DEFAULT 'URBANO',
        is_combinada INTEGER DEFAULT 0
    )
`);

// Criar tabela de metas (formato normalizado)
db.exec(`
    CREATE TABLE IF NOT EXISTS metas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unidade_codigo TEXT NOT NULL,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        tipo_produto TEXT NOT NULL,
        meta REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(unidade_codigo, mes, ano, tipo_produto)
    )
`);

// Criar tabela para DayWay
db.exec(`
    CREATE TABLE IF NOT EXISTS metas_dayway (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unidade_codigo TEXT NOT NULL,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        dayway_percent REAL DEFAULT 100,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(unidade_codigo, mes, ano)
    )
`);

// Criar tabela de vendas
db.exec(`
    CREATE TABLE IF NOT EXISTS vendas_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unidade_codigo TEXT NOT NULL,
        categoria TEXT NOT NULL,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        valor_total REAL DEFAULT 0,
        quantidade_total REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(unidade_codigo, categoria, mes, ano)
    )
`);

// Criar tabela de histórico
db.exec(`
    CREATE TABLE IF NOT EXISTS metas_historico (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unidade_codigo TEXT NOT NULL,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        tipo_produto TEXT NOT NULL,
        meta REAL DEFAULT 0,
        saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Inserir unidades
const unidades = [
    { codigo: '001', nome: 'D. Sampaio', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '002', nome: 'S. Filho', tipo: 'URBANO', is_combinada: 1 },
    { codigo: '003', nome: 'P. Vargas', tipo: 'URBANO', is_combinada: 1 },
    { codigo: '004', nome: 'Própria - Rio Branco', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '005', nome: 'S. Gabriel', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '006', nome: 'S. Bernardo', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '008', nome: 'B. Upacaraí', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '012', nome: 'Bairro Glória (Bagé)', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '013', nome: 'Srai Netto', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '051', nome: 'Mathias', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '052', nome: 'Rio Branco', tipo: 'URBANO', is_combinada: 0 },
    { codigo: '054', nome: 'Helvio Basso', tipo: 'URBANO', is_combinada: 1 },
    { codigo: '007', nome: 'BR 290', tipo: 'RODOVIA', is_combinada: 1 },
    { codigo: '050', nome: 'Eldorado', tipo: 'RODOVIA', is_combinada: 1 }
];

const stmt = db.prepare(`
    INSERT OR IGNORE INTO unidades (codigo, nome, tipo, is_combinada)
    VALUES (@codigo, @nome, @tipo, @is_combinada)
`);

for (const unidade of unidades) {
    stmt.run(unidade);
}

db.close();

console.log('✅ Banco de dados recriado com sucesso!');
console.log('   Agora execute: npm start');
