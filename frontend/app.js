/**
 * Sistema de Metas de Gerentes - GBI
 * Frontend JavaScript
 */

// Estado global
const state = {
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    metas: [],
    vendas: {},
    vendasYOY: {},
    vendasLLM: {},
    alteracoes: new Set(),
    carregando: false
};

// API Base URL
const API_URL = '';

// ========================================
// Inicialização
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initSelectores();
    carregarDados();
    setupEventListeners();
});

/**
 * Inicializa seletores de mês e ano
 */
function initSelectores() {
    const mesSelect = document.getElementById('mes-select');
    const anoSelect = document.getElementById('ano-select');

    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    meses.forEach((nome, i) => {
        const option = document.createElement('option');
        option.value = i + 1;
        option.textContent = nome;
        if (i + 1 === state.mes) option.selected = true;
        mesSelect.appendChild(option);
    });

    const anoAtual = new Date().getFullYear();
    for (let ano = anoAtual - 1; ano <= anoAtual + 1; ano++) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        if (ano === state.ano) option.selected = true;
        anoSelect.appendChild(option);
    }
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    document.getElementById('btn-carregar').addEventListener('click', () => {
        state.mes = parseInt(document.getElementById('mes-select').value);
        state.ano = parseInt(document.getElementById('ano-select').value);
        carregarDados();
    });

    document.getElementById('btn-sync').addEventListener('click', syncVendas);
    document.getElementById('btn-salvar').addEventListener('click', salvarMetas);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            salvarMetas();
        }
    });
}

// ========================================
// API Calls
// ========================================

/**
 * Carrega metas e vendas (com auto-sync)
 */
async function carregarDados() {
    if (state.carregando) return;

    state.carregando = true;
    showStatus('Sincronizando vendas...', 'loading');

    try {
        // Calcular períodos YOY e LLM
        const yoyMes = state.mes;
        const yoyAno = state.ano - 1;

        let llmMes = state.mes - 1;
        let llmAno = state.ano;
        if (llmMes === 0) { llmMes = 12; llmAno--; }

        // Agora contamos exclusivamente com o Push Agent. A UI só busca do banco local SQLite e não pausa.

        showStatus('Carregando dados...', 'loading');

        // Buscar metas do mês selecionado
        const metasRes = await fetch(`${API_URL}/api/metas?mes=${state.mes}&ano=${state.ano}`);
        const metasData = await metasRes.json();

        if (metasData.success) {
            state.metas = metasData.data;
        }

        // Buscar dados YOY (mesmo mês, ano anterior)
        try {
            const yoyRes = await fetch(`${API_URL}/api/vendas/indicadores?mes=${yoyMes}&ano=${yoyAno}`);
            const yoyData = await yoyRes.json();
            if (yoyData.success) {
                state.vendasYOY = {};
                yoyData.data.forEach(v => { state.vendasYOY[v.codigo] = v; });
            }
        } catch (e) { console.warn('YOY não disponível:', e.message); }

        // Buscar dados LLM (mês anterior)
        try {
            const llmRes = await fetch(`${API_URL}/api/vendas/indicadores?mes=${llmMes}&ano=${llmAno}`);
            const llmData = await llmRes.json();
            if (llmData.success) {
                state.vendasLLM = {};
                llmData.data.forEach(v => { state.vendasLLM[v.codigo] = v; });
            }
        } catch (e) { console.warn('LLM não disponível:', e.message); }

        renderTabela();
        state.alteracoes.clear();
        showStatus('Dados carregados', 'success');
        updateLastUpdate();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showStatus('Erro ao carregar dados', 'error');
    } finally {
        state.carregando = false;
    }
}

/**
 * Sincroniza vendas de um período específico (silencioso)
 */
async function syncPeriodo(mes, ano) {
    try {
        await fetch(`${API_URL}/api/vendas/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes, ano })
        });
    } catch (e) {
        console.warn(`Sync ${mes}/${ano} falhou:`, e.message);
    }
}

/**
 * Sincroniza vendas do SQL Server
 */
async function syncVendas() {
    showStatus('Sincronizando vendas...', 'loading');

    try {
        const res = await fetch(`${API_URL}/api/vendas/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes: state.mes, ano: state.ano })
        });

        const data = await res.json();

        if (data.success) {
            showStatus(`${data.count || 0} registros sincronizados`, 'success');
            await carregarDados();
        } else {
            showStatus('Erro na sincronização', 'error');
        }
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showStatus('Erro ao conectar ao SQL Server', 'error');
    }
}

/**
 * Salva todas as metas alteradas
 */
async function salvarMetas() {
    if (state.alteracoes.size === 0) {
        showStatus('Nenhuma alteração para salvar', 'success');
        return;
    }

    showStatus('Salvando metas...', 'loading');

    try {
        const metasParaSalvar = state.metas
            .filter(m => state.alteracoes.has(m.codigo))
            .map(m => ({
                unidade_codigo: m.codigo,
                mes: state.mes,
                ano: state.ano,
                combustiveis_litros: m.combustiveis_litros,
                combustiveis_orcamento: m.combustiveis_orcamento || 0,
                conveniencia_valor: m.conveniencia_valor,
                conveniencia_orcamento: m.conveniencia_orcamento || 0,
                trocas_valor: m.trocas_valor,
                trocas_orcamento: m.trocas_orcamento || 0,
                dayway_percent: m.dayway_percent,
                atual_dayway_percent: m.atual_dayway_percent
            }));

        const res = await fetch(`${API_URL}/api/metas/batch`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metas: metasParaSalvar })
        });

        const data = await res.json();

        if (data.success) {
            showStatus(`${metasParaSalvar.length} metas salvas`, 'success');
            state.alteracoes.clear();
            document.querySelectorAll('.row-modified').forEach(el => {
                el.classList.remove('row-modified');
            });
        } else {
            showStatus('Erro ao salvar', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showStatus('Erro ao salvar metas', 'error');
    }
}

// ========================================
// Renderização
// ========================================

/**
 * Renderiza a tabela de metas
 */
function renderTabela() {
    const tbody = document.getElementById('metas-tbody');
    tbody.innerHTML = '';

    const urbanas = state.metas.filter(m => m.tipo === 'URBANO');
    const rodovias = state.metas.filter(m => m.tipo === 'RODOVIA');

    // Cabeçalho URBANO
    if (urbanas.length > 0) {
        const headerRow = document.createElement('tr');
        headerRow.className = 'section-header';
        headerRow.innerHTML = '<td colspan="18" style="background:#1e3a5f;color:white;font-weight:bold;text-align:left;padding-left:10px;">URBANO</td>';
        tbody.appendChild(headerRow);

        urbanas.forEach(m => tbody.appendChild(criarLinha(m)));

        // Totais URBANO
        tbody.appendChild(criarLinhaTotal(urbanas, 'KPI URBANO'));
    }

    // Cabeçalho RODOVIA
    if (rodovias.length > 0) {
        const headerRow = document.createElement('tr');
        headerRow.className = 'section-header';
        headerRow.innerHTML = '<td colspan="18" style="background:#1e3a5f;color:white;font-weight:bold;text-align:left;padding-left:10px;">RODOVIA</td>';
        tbody.appendChild(headerRow);

        rodovias.forEach(m => tbody.appendChild(criarLinha(m)));

        // Totais RODOVIA
        tbody.appendChild(criarLinhaTotal(rodovias, 'KPI RODOVIA'));
    }
}

/**
 * Cria uma linha da tabela
 */
function criarLinha(meta) {
    const tr = document.createElement('tr');
    tr.dataset.codigo = meta.codigo;

    if (meta.is_combinada) tr.classList.add('combinada');

    const yoy = state.vendasYOY[meta.codigo] || {};
    const llm = state.vendasLLM[meta.codigo] || {};

    // Calcular % vs Ano Anterior
    const pctComb = yoy.combustiveis_qtd ? ((meta.combustiveis_litros / yoy.combustiveis_qtd) * 100).toFixed(2) : '-';
    const pctConv = yoy.conveniencia_valor ? ((meta.conveniencia_valor / yoy.conveniencia_valor) * 100).toFixed(2) : '-';
    const pctTrocas = yoy.trocas_valor ? ((meta.trocas_valor / yoy.trocas_valor) * 100).toFixed(2) : '-';

    tr.innerHTML = `
        <td class="col-unidade">${meta.codigo} - ${meta.nome}</td>
        
        <!-- Combustíveis -->
        <td class="readonly combustiveis-bg">${formatNumber(yoy.combustiveis_qtd || 0)}</td>
        <td class="editable combustiveis-bg" data-field="combustiveis_orcamento">${formatNumber(meta.combustiveis_orcamento || 0)}</td>
        <td class="readonly combustiveis-bg">${formatNumber(llm.combustiveis_qtd || 0)}</td>
        <td class="editable combustiveis-bg meta-col" data-field="combustiveis_litros">${formatNumber(meta.combustiveis_litros)}</td>
        <td class="readonly combustiveis-bg pct">${pctComb !== '-' ? pctComb + '%' : '-'}</td>
        
        <!-- Loja/Conveniência -->
        <td class="readonly conveniencia-bg">${formatCurrency(yoy.conveniencia_valor || 0)}</td>
        <td class="editable conveniencia-bg" data-field="conveniencia_orcamento">${formatCurrency(meta.conveniencia_orcamento || 0)}</td>
        <td class="readonly conveniencia-bg">${formatCurrency(llm.conveniencia_valor || 0)}</td>
        <td class="editable conveniencia-bg meta-col" data-field="conveniencia_valor">${formatCurrency(meta.conveniencia_valor)}</td>
        <td class="readonly conveniencia-bg pct">${pctConv !== '-' ? pctConv + '%' : '-'}</td>
        
        <!-- Trocas de Óleo -->
        <td class="readonly trocas-bg">${formatCurrency(yoy.trocas_valor || 0)}</td>
        <td class="editable trocas-bg" data-field="trocas_orcamento">${formatCurrency(meta.trocas_orcamento || 0)}</td>
        <td class="readonly trocas-bg">${formatCurrency(llm.trocas_valor || 0)}</td>
        <td class="editable trocas-bg meta-col" data-field="trocas_valor">${formatCurrency(meta.trocas_valor)}</td>
        <td class="readonly trocas-bg pct">${pctTrocas !== '-' ? pctTrocas + '%' : '-'}</td>
        
        <!-- DayWay -->
        <td class="editable" data-field="atual_dayway_percent">${meta.atual_dayway_percent || 0}%</td>
        <td class="editable meta-col" data-field="dayway_percent">${meta.dayway_percent || 100}%</td>
    `;

    // Event listeners para células editáveis
    tr.querySelectorAll('.editable').forEach(cell => {
        cell.addEventListener('dblclick', () => startEditing(cell, meta));
    });

    return tr;
}

/**
 * Cria linha de totais
 */
function criarLinhaTotal(unidades, label) {
    const tr = document.createElement('tr');
    tr.className = 'total-row';

    let totais = {
        yoy_comb: 0, orc_comb: 0, llm_comb: 0, meta_comb: 0,
        yoy_conv: 0, orc_conv: 0, llm_conv: 0, meta_conv: 0,
        yoy_trocas: 0, orc_trocas: 0, llm_trocas: 0, meta_trocas: 0
    };

    unidades.forEach(m => {
        const yoy = state.vendasYOY[m.codigo] || {};
        const llm = state.vendasLLM[m.codigo] || {};

        totais.yoy_comb += yoy.combustiveis_qtd || 0;
        totais.orc_comb += m.combustiveis_orcamento || 0;
        totais.llm_comb += llm.combustiveis_qtd || 0;
        totais.meta_comb += m.combustiveis_litros || 0;

        totais.yoy_conv += yoy.conveniencia_valor || 0;
        totais.orc_conv += m.conveniencia_orcamento || 0;
        totais.llm_conv += llm.conveniencia_valor || 0;
        totais.meta_conv += m.conveniencia_valor || 0;

        totais.yoy_trocas += yoy.trocas_valor || 0;
        totais.orc_trocas += m.trocas_orcamento || 0;
        totais.llm_trocas += llm.trocas_valor || 0;
        totais.meta_trocas += m.trocas_valor || 0;
    });

    const pctComb = totais.yoy_comb ? ((totais.meta_comb / totais.yoy_comb) * 100).toFixed(2) + '%' : '-';
    const pctConv = totais.yoy_conv ? ((totais.meta_conv / totais.yoy_conv) * 100).toFixed(2) + '%' : '-';
    const pctTrocas = totais.yoy_trocas ? ((totais.meta_trocas / totais.yoy_trocas) * 100).toFixed(2) + '%' : '-';

    tr.innerHTML = `
        <td><strong>${label}</strong></td>
        <td class="combustiveis-bg">${formatNumber(totais.yoy_comb)}</td>
        <td class="combustiveis-bg">${formatNumber(totais.orc_comb)}</td>
        <td class="combustiveis-bg">${formatNumber(totais.llm_comb)}</td>
        <td class="combustiveis-bg meta-col"><strong>${formatNumber(totais.meta_comb)}</strong></td>
        <td class="combustiveis-bg">${pctComb}</td>
        <td class="conveniencia-bg">${formatCurrency(totais.yoy_conv)}</td>
        <td class="conveniencia-bg">${formatCurrency(totais.orc_conv)}</td>
        <td class="conveniencia-bg">${formatCurrency(totais.llm_conv)}</td>
        <td class="conveniencia-bg meta-col"><strong>${formatCurrency(totais.meta_conv)}</strong></td>
        <td class="conveniencia-bg">${pctConv}</td>
        <td class="trocas-bg">${formatCurrency(totais.yoy_trocas)}</td>
        <td class="trocas-bg">${formatCurrency(totais.orc_trocas)}</td>
        <td class="trocas-bg">${formatCurrency(totais.llm_trocas)}</td>
        <td class="trocas-bg meta-col"><strong>${formatCurrency(totais.meta_trocas)}</strong></td>
        <td class="trocas-bg">${pctTrocas}</td>
        <td>-</td>
        <td>-</td>
    `;

    return tr;
}

/**
 * Inicia edição de uma célula
 */
function startEditing(cell, meta) {
    if (cell.classList.contains('editing')) return;

    const field = cell.dataset.field;
    const isPercent = field.includes('dayway_percent');
    const isCurrency = field.includes('valor') || field.includes('orcamento') && !field.includes('combustiveis');

    let valor = meta[field] || 0;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = valor;
    input.step = isCurrency ? '0.01' : '1';

    const originalValue = cell.textContent;

    cell.classList.add('editing');
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    const saveAndClose = () => {
        const novoValor = parseFloat(input.value) || 0;
        meta[field] = novoValor;

        cell.classList.remove('editing');

        if (isPercent) {
            cell.textContent = novoValor + '%';
        } else if (isCurrency) {
            cell.textContent = formatCurrency(novoValor);
        } else {
            cell.textContent = formatNumber(novoValor);
        }

        state.alteracoes.add(meta.codigo);
        cell.closest('tr').classList.add('row-modified');

        // Atualizar % vs Ano Anterior
        atualizarPercentuais(meta);
    };

    const cancelEdit = () => {
        cell.classList.remove('editing');
        cell.textContent = originalValue;
    };

    input.addEventListener('blur', saveAndClose);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveAndClose();
        } else if (e.key === 'Escape') {
            input.removeEventListener('blur', saveAndClose);
            cancelEdit();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            saveAndClose();
        }
    });
}

/**
 * Atualiza os percentuais calculados
 */
function atualizarPercentuais(meta) {
    const tr = document.querySelector(`tr[data-codigo="${meta.codigo}"]`);
    if (!tr) return;

    const yoy = state.vendasYOY[meta.codigo] || {};

    const pcts = tr.querySelectorAll('.pct');
    const pctComb = yoy.combustiveis_qtd ? ((meta.combustiveis_litros / yoy.combustiveis_qtd) * 100).toFixed(2) + '%' : '-';
    const pctConv = yoy.conveniencia_valor ? ((meta.conveniencia_valor / yoy.conveniencia_valor) * 100).toFixed(2) + '%' : '-';
    const pctTrocas = yoy.trocas_valor ? ((meta.trocas_valor / yoy.trocas_valor) * 100).toFixed(2) + '%' : '-';

    if (pcts[0]) pcts[0].textContent = pctComb;
    if (pcts[1]) pcts[1].textContent = pctConv;
    if (pcts[2]) pcts[2].textContent = pctTrocas;
}

// ========================================
// Utilitários
// ========================================

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num || 0);
}

function formatCurrency(num) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(num || 0);
}

function showStatus(message, type) {
    const el = document.getElementById('status-message');
    el.textContent = message;
    el.className = 'status-message ' + type;

    if (type !== 'loading') {
        setTimeout(() => {
            el.textContent = '';
            el.className = 'status-message';
        }, 3000);
    }
}

function updateLastUpdate() {
    const el = document.getElementById('last-update');
    el.textContent = 'Atualizado: ' + new Date().toLocaleTimeString('pt-BR');
}
