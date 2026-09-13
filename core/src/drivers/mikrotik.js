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
function processMikrotikRawData(resData = {}, rawInterfaces = [], rawRoutes = [], rawAddresses = []) {
  // 1. Identifica a interface da Rota Padrão Ativa (Default Gateway: 0.0.0.0/0)
  let activeDefaultInterface = null;
  const defaultRoutes = (Array.isArray(rawRoutes) ? rawRoutes : []).filter(r => {
    const dst = r['dst-address'] || r.dstAddress || '';
    const isDisabled = r.disabled === true || r.disabled === 'true';
    return dst === '0.0.0.0/0' && !isDisabled;
  });

  // Ordena colocando rotas ativas primeiro e com menor distance (menor métrica ganha)
  defaultRoutes.sort((a, b) => {
    const aActive = (a.active === true || a.active === 'true') ? 1 : 0;
    const bActive = (b.active === true || b.active === 'true') ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    const distA = parseInt(a.distance || 1, 10);
    const distB = parseInt(b.distance || 1, 10);
    return distA - distB;
  });

  for (const r of defaultRoutes) {
    const gwStatus = String(r['gateway-status'] || r.gatewayStatus || '');
    const immGateway = String(r['immediate-gateway'] || r.immediateGateway || '');
    const gw = String(r.gateway || '');
    const iface = String(r.interface || '');

    // RouterOS v6: "192.168.15.1 reachable via  ether1-isp1"
    let m = gwStatus.match(/via\s+([a-zA-Z0-9_\-\.]+)/i);
    if (m) {
      activeDefaultInterface = m[1];
      break;
    }

    // RouterOS v6 PPPoE / direta: "pppoe-Link2-NWT reachable" ou "ether1 reachable"
    m = gwStatus.match(/^([a-zA-Z0-9_\-\.]+)\s+reachable/i);
    if (m) {
      activeDefaultInterface = m[1];
      break;
    }

    // RouterOS v7 ou notação com interface: "%ether1-isp1"
    m = `${immGateway} ${gw} ${gwStatus}`.match(/%([a-zA-Z0-9_\-\.]+)/);
    if (m) {
      activeDefaultInterface = m[1];
      break;
    }

    // Se immediate-gateway for diretamente o nome da interface
    if (immGateway && !immGateway.includes('.') && !immGateway.includes('/')) {
      activeDefaultInterface = immGateway;
      break;
    }

    // Se gateway for diretamente o nome da interface (ex: pppoe-out1 ou ether1)
    if (gw && !gw.includes('.') && !gw.includes('/')) {
      activeDefaultInterface = gw;
      break;
    }

    if (iface) {
      activeDefaultInterface = iface;
      break;
    }
  }

  // Se rota padrão tiver apenas IP de gateway e não encontramos a interface pelo status da rota,
  // consulta tabela de endereços (/ip/address) para mapear a qual interface a rede do gateway pertence
  if (!activeDefaultInterface && defaultRoutes[0]) {
    const gw = String(defaultRoutes[0].gateway || '');
    if (gw && gw.match(/^\d+\.\d+\.\d+\.\d+$/) && Array.isArray(rawAddresses)) {
      const gwParts = gw.split('.').slice(0, 3).join('.');
      const matchedAddr = rawAddresses.find(a => {
        const net = String(a.network || '');
        const addr = String(a.address || '');
        return net.startsWith(gwParts) || addr.startsWith(gwParts);
      });
      if (matchedAddr && (matchedAddr.interface || matchedAddr['actual-interface'])) {
        activeDefaultInterface = matchedAddr.interface || matchedAddr['actual-interface'];
      }
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

    const isDefaultRoute = activeDefaultInterface ? (
      name.toLowerCase() === activeDefaultInterface.toLowerCase() ||
      activeDefaultInterface.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(activeDefaultInterface.toLowerCase())
    ) : false;

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
  const wanRegex = /(wan|link|isp|internet|fibra|adsl|vivo|claro|oi|tim|starlink|operadora|dedicado|backup|contingencia|principal|secundario|gvt|embratel|algar|nwt|elonline)/i;
  
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

  // 4. Determina qual link está ativo
  let hasActive = false;
  wanLinks = wanLinks.map(w => {
    const isActive = Boolean(w.isDefaultRoute && w.running && !w.disabled);
    if (isActive) hasActive = true;
    return {
      ...w,
      isActive,
    };
  });

  // Se a rota padrão não foi associada diretamente a nenhuma interface WAN (ex: rotas recursivas ou scripts),
  // aplica heurística determinística garantindo que o link principal seja identificado visualmente
  if (!hasActive) {
    const runningLinks = wanLinks.filter(w => w.running && !w.disabled);
    if (runningLinks.length === 1) {
      runningLinks[0].isActive = true;
    } else if (runningLinks.length > 1) {
      // Prioridade 1: Comentário ou nome com Link 1, ISP 1, WAN 1, Principal, Primário, Fibra
      const primaryCandidate = runningLinks.find(w => 
        /(link\s*1|isp\s*1|wan\s*1|principal|prim[aá]ri[oa]|fibra|dedicado|adsl)/i.test(`${w.name} ${w.comment}`)
      );
      if (primaryCandidate) {
        primaryCandidate.isActive = true;
      } else {
        // Prioridade 2: Interface com maior tráfego acumulado (RX + TX)
        const sortedByTraffic = [...runningLinks].sort((a, b) => 
          ((b.rxBytes + b.txBytes) - (a.rxBytes + a.txBytes))
        );
        sortedByTraffic[0].isActive = true;
      }
    }
  }

  // 5. Atribui status final (ACTIVE, STANDBY, DOWN)
  wanLinks = wanLinks.map(w => ({
    ...w,
    status: (!w.running || w.disabled) ? 'DOWN' : (w.isActive ? 'ACTIVE' : 'STANDBY'),
  }));

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
    const [resourceRows, interfaceRows, routeRows, addressRows] = await Promise.all([
      conn.write('/system/resource/print').catch(() => []),
      conn.write('/interface/print').catch(() => []),
      conn.write('/ip/route/print').catch(() => []),
      conn.write('/ip/address/print').catch(() => []),
    ]);

    const resData = resourceRows[0] || {};
    return processMikrotikRawData(resData, interfaceRows, routeRows, addressRows);
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

  const [resourceRes, interfacesRes, routesRes, addressRes] = await Promise.all([
    client.get('/system/resource').catch(() => ({ data: {} })),
    client.get('/interface').catch(() => ({ data: [] })),
    client.get('/ip/route').catch(() => ({ data: [] })),
    client.get('/ip/address').catch(() => ({ data: [] })),
  ]);

  const resData = resourceRes.data || {};
  const rawInterfaces = Array.isArray(interfacesRes.data) ? interfacesRes.data : [];
  const rawRoutes = Array.isArray(routesRes.data) ? routesRes.data : [];
  const rawAddresses = Array.isArray(addressRes.data) ? addressRes.data : [];

  return processMikrotikRawData(resData, rawInterfaces, rawRoutes, rawAddresses);
}

/**
 * Coletor unificado para Mikrotik: Suporta RouterOS v6.x e v7.x (Native API + REST API)
 *
 * Estratégia de porta:
 *  - O probe TCP usa a porta cadastrada (pode ser porta do WinBox ou qualquer porta acessível)
 *    apenas para verificar se o dispositivo está online e medir latência.
 *  - A conexão com a API RouterOS tenta candidatos na ordem:
 *      1. Porta cadastrada (eq.port) — caso o usuário tenha cadastrado a porta da API diretamente
 *      2. Porta 8728 padrão (RouterOS Native API)
 *      3. Porta 8729 (RouterOS Native API SSL)
 *    Isso garante que mesmo se o usuário cadastrou a porta do WinBox (ex: 58292),
 *    o sistema ainda encontrará a API na porta padrão 8728.
 */
async function getMikrotikMetrics(host, credentials, port = 8728) {
  const probe = await probeMikrotikPort(host, port, 4000);

  if (!probe.online) {
    // Se a porta cadastrada não responde, tenta porta padrão WinBox/API antes de declarar offline
    const fallbackProbe = await probeMikrotikPort(host, 8728, 3000);
    if (!fallbackProbe.online) {
      return {
        status: 'offline',
        lastLatency: null,
        lastLossPercent: 100,
        error: `Dispositivo inacessível nas portas ${port} e 8728 (${probe.error}).`,
      };
    }
    // Dispositivo online pela porta 8728
    probe.online = true;
    probe.rtt = fallbackProbe.rtt;
    probe.port = fallbackProbe.port;
  }

  let data = null;
  if (credentials?.username && credentials?.password) {
    // Candidatos de porta para a API RouterOS (Native Binary Protocol)
    // Ordem: porta cadastrada → 8728 padrão → 8729 SSL
    const apiPortCandidates = [...new Set([probe.port, 8728, 8729])];

    for (const apiPort of apiPortCandidates) {
      try {
        data = await getMikrotikNativeApiData(host, credentials, apiPort);
        break; // Sucesso — para de tentar outras portas
      } catch {
        // Porta não suporta API nativa, tenta próxima
      }
    }

    // Se API nativa falhou em todas as portas, tenta REST API v7 (HTTP/HTTPS)
    if (!data) {
      try {
        data = await getMikrotikRestData(host, credentials, probe.port);
      } catch {
        // REST API também falhou — credenciais erradas ou API não habilitada
      }
    }
  }

  return {
    status: 'online',
    lastLatency: probe.rtt,
    lastLossPercent: 0,
    port: probe.port,
    ...(data || {
      version: 'RouterOS (API Indisponível)',
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
