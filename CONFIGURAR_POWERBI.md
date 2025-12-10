# Conectar Power BI à API do Sistema de Metas

## Passo 1: Abrir Power BI Desktop

Abra o relatório **Analise de Metas - Copia** no Power BI Desktop.

---

## Passo 2: Adicionar Nova Fonte de Dados (Web)

1. Clique em **Página Inicial** → **Obter Dados** → **Web**

2. Selecione **Avançado**

3. Configure:
   - **URL**: 
   ```
   https://janeen-nontabulated-fredia.ngrok-free.dev/api/metas
   ```
   
   - **Parâmetros de URL** (clique em "Adicionar parte"):
     - `mes` = `12` (ou o mês desejado)
     - `ano` = `2025`

4. Clique **OK**

---

## Passo 3: Transformar os Dados

O Power BI vai abrir o **Editor do Power Query**.

1. Clique na coluna `data` → **Expandir para Novas Linhas**
2. Clique no ícone de expandir da coluna → Selecione as colunas:
   - `codigo`
   - `nome`
   - `tipo`
   - `is_combinada`
   - `combustiveis_litros`
   - `conveniencia_valor`
   - `trocas_valor`
   - `dayway_percent`
3. Clique **OK**
4. Renomeie a query para `Metas_API`
5. Clique **Fechar e Aplicar**

---

## Passo 4: Criar Relações

No modelo, crie uma relação entre:
- `Metas_API[codigo]` ↔ `dPosto[CD_ESTAB]`

---

## Passo 5: Atualizar Medidas DAX

Substitua a referência da tabela antiga `Metas_Produtos` pela nova `Metas_API`:

### Exemplo - % Atingimento Meta Litros:
```dax
% Atingimento Meta Litros = 
VAR ValorReal = 
    CALCULATE(
        SUM('fVendas'[QTD_VENDA]),
        'dItem'[DESCRICAO_CATEGORIA_ITEM] = "COMBUSTÍVEIS"
    )

VAR ValorMeta = 
    CALCULATE(
        SUM('Metas_API'[combustiveis_litros])  -- Alterado aqui
    )

RETURN
    DIVIDE(ValorReal, ValorMeta, BLANK())
```

---

## Passo 6: Publicar no Power BI Service

1. Clique em **Publicar**
2. Selecione o workspace
3. Aguarde a publicação

---

## Passo 7: Configurar Gateway para a Conexão Web

No Power BI Service:

1. Vá em **Configurações** → **Datasets**
2. Selecione o dataset publicado
3. Em **Conexões de gateway**, adicione a URL da API:
   ```
   https://janeen-nontabulated-fredia.ngrok-free.dev
   ```
4. Configure como **Anônimo** (nossa API não requer autenticação)

---

## Passo 8: Agendar Atualização

1. Em **Atualização agendada**, ative
2. Configure horário: **07:00** (após o sync de vendas às 6h)
3. Salve

---

## URLs da API Disponíveis

| Endpoint | Descrição |
|----------|-----------|
| `/api/metas?mes=X&ano=Y` | Lista todas as metas do mês |
| `/api/metas/config/unidades` | Lista de unidades |
| `/api/vendas?mes=X&ano=Y` | Vendas do SQL Server |
| `/api/health` | Status do sistema |

---

## Fluxo Final

```
06:00 - Sistema sincroniza vendas do SQL Server
07:00 - Power BI atualiza (busca metas da API + vendas)
       ↓
    Dashboard atualizado!
```
