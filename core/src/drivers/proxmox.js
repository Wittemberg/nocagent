const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Normaliza a URL base do Proxmox VE
 */
function buildBaseUrl(host, port = 8006) {
  let cleanHost = host.trim().replace(/\/+$/, '');
  if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
    cleanHost = `https://${cleanHost}`;
  }
  // Se não tiver porta especificada na URL, anexa a porta informada
  const urlObj = new URL(cleanHost);
  if (!urlObj.port) {
    urlObj.port = String(port || 8006);
  }
  return urlObj.origin;
}

/**
 * Cria cliente autenticado para a API REST do Proxmox VE (/api2/json)
 */
async function createProxmoxClient(host, credentials, port = 8006) {
  const baseUrl = buildBaseUrl(host, port);
  let headers = {
    Accept: 'application/json',
  };

  // 1. Autenticação via API Token (Mais seguro e recomendado)
  if (credentials?.tokenId && credentials?.tokenSecret) {
    let tokenId = credentials.tokenId.trim();
    const tokenSecret = credentials.tokenSecret.trim();

    // Se o tokenId já vier no formato user@realm!token (ex: root@pam!nocagent)
    if (!tokenId.includes('!')) {
      const user = credentials.username?.trim() || 'root';
      const realm = credentials.realm?.trim() || 'pam';
      tokenId = `${user}@${realm}!${tokenId}`;
    }

    headers['Authorization'] = `PVEAPIToken=${tokenId}=${tokenSecret}`;
    return axios.create({
      baseURL: `${baseUrl}/api2/json`,
      headers,
      httpsAgent,
      timeout: 8000,
    });
  }

  // 2. Autenticação via Ticket (Usuário + Senha)
  if (credentials?.username && credentials?.password) {
    const user = credentials.username.trim();
    const realm = credentials.realm?.trim() || 'pam';
    const password = credentials.password;

    const ticketRes = await axios.post(
      `${baseUrl}/api2/json/access/ticket`,
      {
        username: `${user}@${realm}`,
        password,
      },
      {
        httpsAgent,
        timeout: 6000,
      }
    );

    const ticketData = ticketRes.data?.data;
    if (!ticketData?.ticket) {
      throw new Error('Falha ao obter ticket de autenticação do Proxmox VE.');
    }

    headers['CSRFPreventionToken'] = ticketData.CSRFPreventionToken;
    headers['Cookie'] = `PVEAuthCookie=${ticketData.ticket}`;

    return axios.create({
      baseURL: `${baseUrl}/api2/json`,
      headers,
      httpsAgent,
      timeout: 8000,
    });
  }

  throw new Error('Credenciais de Proxmox não configuradas (necessário API Token ou Usuário/Senha).');
}

/**
 * Coleta métricas abrangentes de nós, VMs, LXCs e storages do Proxmox
 */
async function getProxmoxMetrics(host, credentials, port = 8006) {
  const client = await createProxmoxClient(host, credentials, port);

  // 1. Coleta recursos globais do cluster (/cluster/resources)
  let clusterResources = [];
  try {
    const clusterRes = await client.get('/cluster/resources');
    clusterResources = clusterRes.data?.data || [];
  } catch (err) {
    console.warn(`[Proxmox] /cluster/resources não disponível ou sem permissão em ${host}:`, err.message);
  }

  // 2. Coleta lista de nós (/nodes)
  let nodes = [];
  try {
    const nodesRes = await client.get('/nodes');
    nodes = nodesRes.data?.data || [];
  } catch (err) {
    console.warn(`[Proxmox] /nodes não disponível em ${host}:`, err.message);
  }

  if (nodes.length === 0 && clusterResources.length === 0) {
    throw new Error('Nenhum nó ou recurso do Proxmox VE retornado pela API. Verifique token e permissões no cofre.');
  }

  // Identifica o nó ativo principal
  const onlineNode = nodes.find((n) => n.status === 'online') || nodes[0];
  const nodeResource = clusterResources.find((r) => r.type === 'node' && r.status === 'online') || clusterResources.find((r) => r.type === 'node');
  const nodeName = onlineNode?.node || nodeResource?.node || 'pve';

  let primaryNode = onlineNode || nodeResource || {};

  // 3. Tenta status detalhado do nó primário (/nodes/{node}/status)
  let nodeStatus = { ...primaryNode };
  try {
    const statusRes = await client.get(`/nodes/${nodeName}/status`);
    if (statusRes.data?.data) {
      nodeStatus = { ...nodeStatus, ...statusRes.data.data };
    }
  } catch (err) {
    console.warn(`[Proxmox] Aviso ao buscar status de ${nodeName}:`, err.message);
  }

  // 4. Versão limpa do Proxmox VE
  let rawVersion = nodeStatus.pveversion || primaryNode.pveversion || '';
  if (!rawVersion) {
    try {
      const verRes = await client.get('/version');
      if (verRes.data?.data) {
        rawVersion = verRes.data.data.release || verRes.data.data.version || '';
      }
    } catch {}
  }
  // Extrai versão limpa (ex: "8.4.21" a partir de "pve-manager/8.4.21/...")
  const versionMatch = rawVersion.match(/(\d+\.\d+[\.\-\w]*)/);
  const cleanVersion = versionMatch ? `PVE v${versionMatch[1]}` : (rawVersion ? `PVE ${rawVersion}` : 'Proxmox VE');

  // 5. Coleta inventário de VMs QEMU e Containers LXC
  let vms = [];
  let lxcs = [];
  try {
    const [vmsRes, lxcsRes] = await Promise.all([
      client.get(`/nodes/${nodeName}/qemu`).catch(() => null),
      client.get(`/nodes/${nodeName}/lxc`).catch(() => null),
    ]);
    if (vmsRes?.data?.data) vms = vmsRes.data.data;
    if (lxcsRes?.data?.data) lxcs = lxcsRes.data.data;
  } catch (err) {
    console.warn(`[Proxmox] Aviso ao listar VMs/LXCs locais:`, err.message);
  }

  // Fallback para clusterResources se a consulta direta retornou vazio ou 403
  if (vms.length === 0 && clusterResources.length > 0) {
    vms = clusterResources
      .filter((r) => r.type === 'qemu')
      .map((v) => ({
        vmid: v.vmid,
        name: v.name || `VM ${v.vmid}`,
        status: v.status || 'unknown',
        cpu: v.cpu,
        mem: v.mem,
        maxmem: v.maxmem,
      }));
  }

  if (lxcs.length === 0 && clusterResources.length > 0) {
    lxcs = clusterResources
      .filter((r) => r.type === 'lxc')
      .map((c) => ({
        vmid: c.vmid,
        name: c.name || `CT ${c.vmid}`,
        status: c.status || 'unknown',
        cpu: c.cpu,
        mem: c.mem,
        maxmem: c.maxmem,
      }));
  }

  // 6. Coleta storages com múltiplos fallbacks (nó -> cluster/resources -> config global /storage)
  let storages = [];
  try {
    const storagesRes = await client.get(`/nodes/${nodeName}/storage`);
    if (Array.isArray(storagesRes.data?.data)) {
      storages = storagesRes.data.data.map((s) => ({
        name: s.storage,
        type: s.type,
        active: !!s.active,
        usedBytes: s.used || 0,
        totalBytes: s.total || 0,
        usedPercent: s.total > 0 ? Math.round(((s.used || 0) / s.total) * 100) : 0,
      }));
    }
  } catch (err) {
    console.warn(`[Proxmox] Aviso ao buscar storages locais de ${nodeName}:`, err.message);
  }

  // Fallback 1: storages listados em /cluster/resources
  if (storages.length === 0 && clusterResources.length > 0) {
    const clusterStorages = clusterResources.filter((r) => r.type === 'storage');
    storages = clusterStorages.map((s) => ({
      name: s.storage,
      type: s.plugintype || s.type || 'storage',
      active: true,
      usedBytes: s.disk || 0,
      totalBytes: s.maxdisk || 0,
      usedPercent: s.maxdisk > 0 ? Math.round(((s.disk || 0) / s.maxdisk) * 100) : 0,
    }));
  }

  // Fallback 2: /storage global de configuração
  if (storages.length === 0) {
    try {
      const globalStorageRes = await client.get('/storage');
      if (Array.isArray(globalStorageRes.data?.data)) {
        storages = globalStorageRes.data.data.map((s) => ({
          name: s.storage,
          type: s.type || 'storage',
          active: true,
          usedBytes: 0,
          totalBytes: 0,
          usedPercent: 0,
        }));
      }
    } catch {}
  }

  // 7. Cálculos resilientes de CPU e Memória
  let rawCpu = nodeStatus.cpu ?? primaryNode.cpu ?? nodeResource?.cpu ?? 0;
  if (rawCpu > 1) rawCpu = rawCpu / 100;
  const cpuPercent = Math.round(rawCpu * 100);

  const memUsedBytes = nodeStatus.memory?.used ?? nodeStatus.mem ?? primaryNode.mem ?? nodeResource?.mem ?? 0;
  const memTotalBytes = nodeStatus.memory?.total ?? nodeStatus.maxmem ?? primaryNode.maxmem ?? nodeResource?.maxmem ?? 0;
  const memPercent = memTotalBytes > 0 ? Math.round((memUsedBytes / memTotalBytes) * 100) : 0;
  const memUsedGB = (memUsedBytes / (1024 * 1024 * 1024)).toFixed(1);
  const memTotalGB = (memTotalBytes / (1024 * 1024 * 1024)).toFixed(1);
  const cores = nodeStatus.cpuinfo?.cpus || primaryNode.maxcpu || nodeResource?.maxcpu || 0;

  // Contagem de VMs
  const runningVms = vms.filter((v) => v.status === 'running').length;
  const stoppedVms = vms.filter((v) => v.status !== 'running').length;

  // Contagem de LXCs
  const runningLxcs = lxcs.filter((c) => c.status === 'running').length;
  const stoppedLxcs = lxcs.filter((c) => c.status !== 'running').length;

  return {
    node: nodeName,
    pveVersion: cleanVersion,
    uptimeSeconds: nodeStatus.uptime || primaryNode.uptime || nodeResource?.uptime || 0,
    cpu: {
      percent: cpuPercent,
      cores,
      model: nodeStatus.cpuinfo?.model || '',
    },
    memory: {
      usedBytes: memUsedBytes,
      totalBytes: memTotalBytes,
      usedGB: memUsedGB,
      totalGB: memTotalGB,
      percent: memPercent,
    },
    workloads: {
      totalVMs: vms.length,
      runningVMs: runningVms,
      stoppedVMs: stoppedVms,
      totalLXCs: lxcs.length,
      runningLXCs: runningLxcs,
      stoppedLXCs: stoppedLxcs,
      vmsList: vms.map((v) => ({
        vmid: v.vmid,
        name: v.name,
        status: v.status,
        cpuPercent: v.cpu != null ? Math.round((v.cpu > 1 ? v.cpu : v.cpu * 100)) : 0,
        memUsedMB: Math.round((v.mem || 0) / (1024 * 1024)),
      })),
      lxcsList: lxcs.map((c) => ({
        vmid: c.vmid,
        name: c.name,
        status: c.status,
      })),
    },
    storages,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reinicia uma VM QEMU específica no Proxmox (Ação L2)
 */
async function rebootVm(host, credentials, port = 8006, node, vmid) {
  const client = await createProxmoxClient(host, credentials, port);
  const res = await client.post(`/nodes/${node}/qemu/${vmid}/status/reboot`);
  return res.data;
}

/**
 * Cria snapshot de segurança de uma VM QEMU
 */
async function snapshotVm(host, credentials, port = 8006, node, vmid, snapname, description = '') {
  const client = await createProxmoxClient(host, credentials, port);
  const res = await client.post(`/nodes/${node}/qemu/${vmid}/snapshot`, {
    snapname,
    description: description || `Snapshot automático de contingência NOC-Agent ${new Date().toISOString()}`,
  });
  return res.data;
}

module.exports = {
  createProxmoxClient,
  getProxmoxMetrics,
  rebootVm,
  snapshotVm,
};
