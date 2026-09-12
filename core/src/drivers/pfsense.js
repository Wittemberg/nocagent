const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Normaliza a URL do pfSense
 */
function buildBaseUrl(host, port) {
  let cleanHost = host.trim().replace(/\/+$/, '');
  if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
    cleanHost = `https://${cleanHost}`;
  }
  const urlObj = new URL(cleanHost);
  if (port && !urlObj.port) {
    urlObj.port = String(port);
  }
  return urlObj.origin;
}

/**
 * Cria cliente REST com cabeçalhos estritos exigidos pelo pfSense
 */
function createPfSenseClient(host, apiKey, port) {
  const baseUrl = buildBaseUrl(host, port);
  return axios.create({
    baseURL: baseUrl,
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    httpsAgent,
    timeout: 7000,
  });
}

/**
 * Coleta gateways e integridade do pfSense
 */
async function getPfSenseMetrics(host, apiKey, port) {
  const client = createPfSenseClient(host, apiKey, port);

  // 1. Consulta Gateways WAN / VPNs
  const gatewaysRes = await client.get('/api/v2/status/gateways');
  const gateways = gatewaysRes.data?.data || [];

  // 2. Consulta opcional de status do sistema
  let systemInfo = null;
  try {
    const sysRes = await client.get('/api/v2/status/system');
    systemInfo = sysRes.data?.data || null;
  } catch {}

  // 3. Consulta opcional de serviços
  let services = [];
  try {
    const srvRes = await client.get('/api/v2/status/services');
    services = srvRes.data?.data || [];
  } catch {}

  const onlineCount = gateways.filter((g) => g.status === 'online').length;
  const isAllOnline = gateways.length > 0 && onlineCount === gateways.length;
  const isDegraded = onlineCount > 0 && onlineCount < gateways.length;

  return {
    status: isAllOnline ? 'online' : isDegraded ? 'degraded' : gateways.length === 0 ? 'online' : 'offline',
    gateways: gateways.map((g) => ({
      name: g.name,
      status: g.status,
      delay: g.delay != null ? parseFloat(g.delay) : 0,
      loss: g.loss != null ? parseFloat(g.loss) : 0,
      srcip: g.srcip || '',
      monitorip: g.monitorip || '',
    })),
    system: systemInfo,
    services,
  };
}

module.exports = {
  createPfSenseClient,
  getPfSenseMetrics,
};
