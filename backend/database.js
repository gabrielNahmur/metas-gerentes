const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Garantir que o diretório data existe
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'metas.db');
let db = null;

/**
 * Inicializa o banco de dados SQLite e cria as tabelas necessárias
 */
function initialize() {
    db = new Database(dbPath);

    // Criar tabela de unidades (postos)
    db.exec(`
        CREATE TABLE IF NOT EXISTS unidades (
            id INTEGER PRIMARY KEY,
            codigo TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT DEFAULT 'URBANO',
            is_combinada INTEGER DEFAULT 0
        )
    `);

    // Criar tabela de metas (formato normalizado - uma linha por tipo)
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

    // Criar tabela para DayWay (separada, pois é um percentual geral da unidade)
    db.exec(`
        CREATE TABLE IF NOT EXISTS metas_dayway (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidade_codigo TEXT NOT NULL,
            mes INTEGER NOT NULL,
            ano INTEGER NOT NULL,
            dayway_percent REAL DEFAULT 100,
            atual_dayway_percent REAL DEFAULT 0,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(unidade_codigo, mes, ano)
        )
    `);

    // Criar tabela de vendas (cache local do SQL Server)
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

    // Criar tabela de histórico (backup)
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

    // Inserir unidades padrão se não existirem
    seedUnidades();

    console.log('✅ Banco de dados SQLite inicializado');
    return db;
}

/**
 * Popula as unidades iniciais baseado na planilha
 */
function seedUnidades() {
    const unidades = [
        { codigo: '001', nome: 'G. Sampaio', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '002', nome: 'S. Filho', tipo: 'URBANO', is_combinada: 1 },
        { codigo: '003', nome: 'P. Vargas', tipo: 'URBANO', is_combinada: 1 },
        { codigo: '004', nome: 'Próprio - Rio Branco', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '005', nome: 'S. Gabriel', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '006', nome: 'S. Bernardo', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '008', nome: 'B. Upacarai', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '012', nome: 'Gral Osorio (Bagé)', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '013', nome: 'Gral Netto', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '051', nome: 'Mathias', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '052', nome: 'Rio Branco', tipo: 'URBANO', is_combinada: 0 },
        { codigo: '054', nome: 'Helvio Basso', tipo: 'URBANO', is_combinada: 1 },
        { codigo: '007', nome: 'BR 293', tipo: 'RODOVIA', is_combinada: 1 },
        { codigo: '050', nome: 'Eldorado', tipo: 'RODOVIA', is_combinada: 1 }
    ];

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO unidades (codigo, nome, tipo, is_combinada)
        VALUES (@codigo, @nome, @tipo, @is_combinada)
    `);

    for (const unidade of unidades) {
        stmt.run(unidade);
    }
}

/**
 * Verifica se o banco está conectado
 */
function isConnected() {
    return db !== null && db.open;
}

/**
 * Retorna a instância do banco de dados
 */
function getDb() {
    if (!db) {
        initialize();
    }
    return db;
}

/**
 * Fecha a conexão com o banco
 */
function close() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    initialize,
    isConnected,
    getDb,
    close
};
