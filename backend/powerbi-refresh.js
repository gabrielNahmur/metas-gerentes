const axios = require('axios');

/**
 * Configuração do Power BI REST API
 * 
 * IMPORTANTE: Você precisará configurar uma Azure AD App Registration
 * para obter as credenciais abaixo.
 * 
 * Documentação: https://learn.microsoft.com/en-us/power-bi/developer/embedded/register-app
 */
const config = {
    // TODO: Substituir pelas suas credenciais do Azure AD
    tenantId: 'SEU_TENANT_ID',
    clientId: 'SEU_CLIENT_ID',
    clientSecret: 'SEU_CLIENT_SECRET',

    // IDs do Power BI (obter no portal)
    workspaceId: 'SEU_WORKSPACE_ID',
    datasetId: 'SEU_DATASET_ID'
};

let accessToken = null;
let tokenExpiry = null;

/**
 * Obtém token de acesso do Azure AD
 */
async function getAccessToken() {
    // Se token ainda é válido, reutiliza
    if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
        return accessToken;
    }

    try {
        const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', config.clientId);
        params.append('client_secret', config.clientSecret);
        params.append('scope', 'https://analysis.windows.net/powerbi/api/.default');

        const response = await axios.post(tokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        accessToken = response.data.access_token;
        tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);

        console.log('✅ Token do Power BI obtido com sucesso');
        return accessToken;
    } catch (error) {
        console.error('❌ Erro ao obter token do Power BI:', error.message);
        throw error;
    }
}

/**
 * Dispara refresh do dataset no Power BI
 */
async function triggerRefresh() {
    // Verifica se está configurado
    if (config.tenantId === 'SEU_TENANT_ID') {
        console.warn('⚠️ Power BI API não configurada. Pulando refresh automático.');
        console.warn('   Configure as credenciais em powerbi-refresh.js');
        return { success: false, message: 'API não configurada' };
    }

    try {
        const token = await getAccessToken();

        const refreshUrl = `https://api.powerbi.com/v1.0/myorg/groups/${config.workspaceId}/datasets/${config.datasetId}/refreshes`;

        await axios.post(refreshUrl, {}, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Refresh do Power BI disparado com sucesso');
        return { success: true, message: 'Refresh iniciado' };
    } catch (error) {
        console.error('❌ Erro ao disparar refresh do Power BI:', error.message);
        return { success: false, message: error.message };
    }
}

/**
 * Verifica status do último refresh
 */
async function getRefreshStatus() {
    if (config.tenantId === 'SEU_TENANT_ID') {
        return { configured: false };
    }

    try {
        const token = await getAccessToken();

        const statusUrl = `https://api.powerbi.com/v1.0/myorg/groups/${config.workspaceId}/datasets/${config.datasetId}/refreshes?$top=1`;

        const response = await axios.get(statusUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const lastRefresh = response.data.value[0];
        return {
            configured: true,
            lastRefresh: lastRefresh ? {
                status: lastRefresh.status,
                startTime: lastRefresh.startTime,
                endTime: lastRefresh.endTime
            } : null
        };
    } catch (error) {
        return { configured: true, error: error.message };
    }
}

module.exports = {
    triggerRefresh,
    getRefreshStatus
};
