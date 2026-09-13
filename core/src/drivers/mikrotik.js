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

const { RouterOSAPI } = require('node-routeros');

function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Processador unificado para telemetria de Mikrotik (tanto Native API v6/v7 quanto REST API v7)
 */
function processMikrotikRawData(resData = {}, rawInterfaces = [], rawRoutes = []) {
  // 1. Identifica a interface da Rota Padrão Ativa (Default Gateway: 0.0.0.0/0)
  let activeDefaultInterface = null;
  const defaultRoutes = rawRoutes.filter(r => 
    (r['dst-address'] === '0.0.0.0/0' || r.dstAddress === '0.0.0.0/0')
  );

  const activeDefaultRoute = defaultRoutes.find(r => 
    r.active === true || r.active === 'true'
  );

  if (activeDefaultRoute) {
    const immGateway = activeDefaultRoute['immediate-gateway'] || activeDefaultRoute.immediateGateway || '';
    const gw = activeDefaultRoute.gateway || '';
    // Ex: "192.168.15.1%ether1-isp1" -> "ether1-isp1"
    const match = String(immGateway).match(/%([a-zA-Z0-9_\-\.]+)/) || String(gw).match(/%([a-zA-Z0-9_\-\.]+)/);
    if (match) {
      activeDefaultInterface = match[1];
    } else if (gw && !gw.includes('.')) {
      activeDefaultInterface = gw;
    }
  }

  // 2. Mapeia e sanitiza todas as interfaces
  const interfaces = rawInterfaces.map((iface) => {
    const name = iface.name || '';
    const type = iface.type || '';
    const rawComment = iface.comment ? String(iface.comment).trim() : '';
    // Limpa marcadores comuns de comentários (ex: "::: LINK ADSL" -> "LINK ADSL")
    const comment = rawComment.replace(/^[:\s\-]+/, '').trim();
    const running = iface.running === 'true' || iface.running === true;
    const disabled = iface.disabled === 'true' || iface.disabled === true;
    const rxBytes = parseInt(iface['rx-byte'] || iface['rx-bytes'] || iface['bytes-in'] || iface.rxByte || 0, 10) || 0;
    const txBytes = parseInt(iface['tx-byte'] || iface['tx-bytes'] || iface['bytes-out'] || iface.txByte || 0, 10) || 0;
    const isDefaultRoute = activeDefaultInterface ? (name === activeDefaultInterface || activeDefaultInterface.includes(name)) : false;

    return {
      name,
      type,
      comment: comment || rawComment,
      rawComment,
      running,
      disabled,
      rxBytes,
      txBytes,
      formattedRx: formatBytes(rxBytes),
      formattedTx: formatBytes(txBytes),
      isDefaultRoute,
    };
  });

  // 3. Filtra especificamente interfaces WAN / Links de Internet
  const wanRegex = /(wan|link|isp|internet|fibra|adsl|vivo|claro|oi|tim|starlink|operadora|dedicado|backup|contingencia|principal|secundario|gvt|embratel|algar)/i;
  
  let wanLinks = interfaces.filter(iface => {
    const textToMatch = `${iface.name} ${iface.rawComment} ${iface.comment}`;
    return wanRegex.test(textToMatch) || 
           iface.type === 'pppoe-out' || 
           iface.type === 'lte' || 
           iface.name.toLowerCase().startsWith('wan') || 
           iface.name.toLowerCase().includes('isp') || 
           iface.isDefaultRoute;
  });

  // Se nenhuma tiver comentário WAN explícito, busca interfaces ativas com rota padrão ou tráfego relevante
  if (wanLinks.length === 0) {
    wanLinks = interfaces.filter(iface => iface.isDefaultRoute || (iface.running && !iface.name.includes('bridge') && !iface.name.includes('loopback')));
  }

  // Define se a interface está ativa como internet principal
  wanLinks = wanLinks.map(w => {
    const isActive = w.isDefaultRoute || (w.running && (wanLinks.length === 1 || (w.comment && /principal|primario|vivo|dedicado|adsl/i.test(w.comment))));
    return {
      ...w,
      isActive,
      status: (!w.running || w.disabled) ? 'DOWN' : (isActive ? 'ACTIVE' : 'STANDBY'),
    };
  });

  // Ordena colocando a Internet Ativa no topo
  wanLinks.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

  const activeWan = wanLinks.find(w => w.isActive);
  const activeWanName = activeWan 
    ? (activeWan.comment ? `${activeWan.comment} (${activeWan.name})` : activeWan.name)
    : null;

  const freeMem = parseInt(resData['free-memory'] || 0, 10);
  const totalMem = parseInt(resData['total-memory'] || 0, 10);
  const memUsedPercent = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;

  return {
    version: resData.version || 'RouterOS',
    boardName: resData['board-name'] || 'Mikrotik RouterBoard',
    uptime: resData.uptime || '',
    cpuLoadPercent: parseInt(resData['cpu-load'] || 0, 10),
    memory: {
      freeBytes: freeMem,
      totalBytes: totalMem,
      usedPercent: memUsedPercent,
    },
    interfaces,
    wanLinks,
    activeWanName,
    hasRestApi: true,
    hasData: true,
  };
}

/**
 * Coleta dados via RouterOS API nativa (Porta 8728 / 8729 / customizada) - Compatível com v6 e v7
 */
async function getMikrotikNativeApiData(host, credentials, port = 8728) {
  const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0];
  const targetPort = port || 8728;
  const username = credentials?.username || 'admin';
  const password = credentials?.password || '';

  const conn = new RouterOSAPI({
    host: cleanHost,
    user: username,
    password: password,
    port: targetPort,
    timeout: 4,
    keepalive: false,
  });

  await conn.connect();
  try {
    const [resourceRows, interfaceRows, routeRows] = await Promise.all([
      conn.write('/system/resource/print').catch(() => []),
      conn.write('/interface/print').catch(() => []),
      conn.write('/ip/route/print').catch(() => []),
    ]);

    const resData = resourceRows[0] || {};
    return processMikrotikRawData(resData, interfaceRows, routeRows);
  } finally {
    conn.close().catch(() => {});
  }
}

/**
 * Tenta coletar dados completos via RouterOS v7 REST API
 */
async function getMikrotikRestData(host, credentials, port) {
  let rawHost = host.trim().replace(/\/+$/, '');
  let isHttps = !rawHost.startsWith('http://');
  let cleanHost = rawHost.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0];

  let targetPort = port;
  if (!port || port === 8728 || port === 8729) {
    targetPort = isHttps ? 443 : 80;
  }

  const username = credentials?.username || 'admin';
  const password = credentials?.password || '';
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  const baseURL = `${isHttps ? 'https' : 'http'}://${cleanHost}:${targetPort}/rest`;

  const client = axios.create({
    baseURL,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    httpsAgent,
    timeout: 5000,
  });

  const [resourceRes, interfacesRes, routesRes] = await Promise.all([
    client.get('/system/resource').catch(() => ({ data: {} })),
    client.get('/interface').catch(() => ({ data: [] })),
    client.get('/ip/route').catch(() => ({ data: [] })),
  ]);

  const resData = resourceRes.data || {};
  const rawInterfaces = Array.isArray(interfacesRes.data) ? interfacesRes.data : [];
  const rawRoutes = Array.isArray(routesRes.data) ? routesRes.data : [];

  return processMikrotikRawData(resData, rawInterfaces, rawRoutes);
}

/**
 * Coletor unificado para Mikrotik: Suporta RouterOS v6.x e v7.x (Native API + REST API)
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

  let data = null;
  if (credentials?.username && credentials?.password) {
    // 1. Tenta via RouterOS Native API (Porta 8728 ou customizada - suporta RouterOS v6 e v7)
    try {
      data = await getMikrotikNativeApiData(host, credentials, probe.port);
    } catch (apiErr) {
      // 2. Se falhar API nativa (ex: porta é 443/80), tenta REST API v7
      try {
        data = await getMikrotikRestData(host, credentials, probe.port);
      } catch (restErr) {
        // Falha de autenticação ou serviço de API desabilitado
      }
    }
  }

  return {
    status: 'online',
    lastLatency: probe.rtt,
    lastLossPercent: 0,
    port: probe.port,
    ...(data || {
      version: 'RouterOS (Porta API Ativa)',
      hasRestApi: false,
      hasData: false,
    }),
  };
}

module.exports = {
  probeMikrotikPort,
  getMikrotikMetrics,
  getMikrotikRestData,
  getMikrotikNativeApiData,
};
