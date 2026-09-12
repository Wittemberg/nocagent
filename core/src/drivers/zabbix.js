const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Normaliza endpoint da API do Zabbix
 */
function buildZabbixUrl(host, port) {
  let cleanHost = host.trim().replace(/\/+$/, '');
  if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
    cleanHost = `http://${cleanHost}`;
  }
  const urlObj = new URL(cleanHost);
  if (port && !urlObj.port) {
    urlObj.port = String(port);
  }
  let pathname = urlObj.pathname.replace(/\/+$/, '');
  if (!pathname.endsWith('api_jsonrpc.php')) {
    pathname = `${pathname}/api_jsonrpc.php`.replace(/^\/\//, '/');
  }
  return `${urlObj.origin}${pathname}`;
}

/**
 * Executa requisição JSON-RPC 2.0 no Zabbix
 */
async function zabbixRequest(url, method, params, auth = null) {
  const payload = {
    jsonrpc: '2.0',
    method,
    params,
    id: Date.now(),
    auth,
  };

  const res = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json-rpc',
      Accept: 'application/json',
    },
    httpsAgent,
    timeout: 7000,
  });

  if (res.data?.error) {
    throw new Error(`Zabbix RPC Error: ${res.data.error.message || res.data.error.data}`);
  }

  return res.data?.result;
}

/**
 * Consulta triggers críticas ativas (Severidade High=4 e Disaster=5)
 */
async function getZabbixActiveTriggers(host, credentials, port) {
  const url = buildZabbixUrl(host, port);
  const token = credentials?.apiKey || credentials?.token || credentials?.password;

  let authToken = token;
  // Se forem passados usuário e senha e não for Bearer token
  if (credentials?.username && credentials?.password && !credentials?.apiKey) {
    authToken = await zabbixRequest(url, 'user.login', {
      user: credentials.username,
      password: credentials.password,
    });
  }

  const triggers = await zabbixRequest(
    url,
    'trigger.get',
    {
      only_true: 1,
      active: 1,
      min_severity: 3, // Average (3), High (4), Disaster (5)
      selectHosts: ['host', 'name'],
      sortfield: 'priority',
      sortorder: 'DESC',
      limit: 15,
    },
    authToken
  );

  return (triggers || []).map((t) => ({
    triggerId: t.triggerid,
    description: t.description,
    priority: parseInt(t.priority, 10),
    severityText: t.priority === '5' ? 'DISASTER' : t.priority === '4' ? 'HIGH' : 'AVERAGE',
    hostName: t.hosts?.[0]?.name || t.hosts?.[0]?.host || 'Desconhecido',
    lastChange: t.lastchange ? new Date(parseInt(t.lastchange, 10) * 1000).toISOString() : null,
  }));
}

module.exports = {
  buildZabbixUrl,
  zabbixRequest,
  getZabbixActiveTriggers,
};
