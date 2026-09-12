const axios = require('axios');
const net = require('net');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Probe TCP na porta do Mikrotik (8728 API, 8729 SSL, 80/443 REST)
 */
function probeMikrotikPort(host, port = 8728, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0];
    const targetPort = port || 8728;
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const rtt = Date.now() - start;
      socket.destroy();
      resolve({ online: true, rtt, port: targetPort });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ online: false, error: 'TIMEOUT', port: targetPort });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ online: false, error: err.code || err.message, port: targetPort });
    });

    socket.connect(targetPort, cleanHost);
  });
}

/**
 * Tenta coletar dados completos via RouterOS v7 REST API
 */
async function getMikrotikRestData(host, credentials, port) {
  let cleanHost = host.trim().replace(/\/+$/, '');
  if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
    cleanHost = `https://${cleanHost}`;
  }

  const urlObj = new URL(cleanHost);
  // Se for porta customizada ou REST API
  if (port && port !== 8728 && port !== 8729) {
    urlObj.port = String(port);
  }

  const username = credentials?.username || 'admin';
  const password = credentials?.password || '';

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  const client = axios.create({
    baseURL: `${urlObj.origin}/rest`,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    httpsAgent,
    timeout: 5000,
  });

  const [resourceRes, interfacesRes] = await Promise.all([
    client.get('/system/resource'),
    client.get('/interface').catch(() => ({ data: [] })),
  ]);

  const resData = resourceRes.data || {};
  const interfaces = (interfacesRes.data || []).map((iface) => ({
    name: iface.name,
    type: iface.type,
    running: iface.running === 'true' || iface.running === true,
    disabled: iface.disabled === 'true' || iface.disabled === true,
    comment: iface.comment || '',
  }));

  const freeMem = parseInt(resData['free-memory'] || 0, 10);
  const totalMem = parseInt(resData['total-memory'] || 0, 10);
  const memUsedPercent = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;

  return {
    version: resData.version || 'RouterOS v7',
    boardName: resData['board-name'] || 'Mikrotik RouterBoard',
    uptime: resData.uptime || '',
    cpuLoadPercent: parseInt(resData['cpu-load'] || 0, 10),
    memory: {
      freeBytes: freeMem,
      totalBytes: totalMem,
      usedPercent: memUsedPercent,
    },
    interfaces,
    hasRestApi: true,
  };
}

/**
 * Coletor unificado para Mikrotik: tenta REST API v7, com fallback para TCP probe
 */
async function getMikrotikMetrics(host, credentials, port = 8728) {
  const probe = await probeMikrotikPort(host, port, 4000);

  if (!probe.online) {
    return {
      status: 'offline',
      lastLatency: null,
      lastLossPercent: 100,
      error: `Porta ${probe.port} fechada ou inacessível (${probe.error}).`,
    };
  }

  // Se porta estiver aberta, tenta obter dados ricos via REST API se for porta HTTP/HTTPS ou se o usuário configurou REST
  let restData = null;
  if (credentials?.username && credentials?.password) {
    try {
      restData = await getMikrotikRestData(host, credentials, port);
    } catch {
      // RouterOS v6 ou REST API desabilitada - o TCP probe já confirmou online
    }
  }

  return {
    status: 'online',
    lastLatency: probe.rtt,
    lastLossPercent: 0,
    port: probe.port,
    ...(restData || {
      version: 'RouterOS (Porta API Ativa)',
      hasRestApi: false,
    }),
  };
}

module.exports = {
  probeMikrotikPort,
  getMikrotikMetrics,
  getMikrotikRestData,
};
