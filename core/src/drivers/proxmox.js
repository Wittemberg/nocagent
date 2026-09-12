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

  // 1. Coleta lista de nós do cluster
  const nodesRes = await client.get('/nodes');
  const nodes = nodesRes.data?.data || [];

  if (nodes.length === 0) {
    throw new Error('Nenhum nó do Proxmox VE retornado pela API.');
  }

  const primaryNode = nodes[0];
  const nodeName = primaryNode.node;

  // 2. Coleta status detalhado do nó primário (CPU, RAM, Uptime, Versão PVE)
  let nodeStatus = primaryNode;
  try {
    const statusRes = await client.get(`/nodes/${nodeName}/status`);
    if (statusRes.data?.data) {
      nodeStatus = { ...nodeStatus, ...statusRes.data.data };
    }
  } catch (err) {
    console.warn(`[Proxmox] Aviso ao buscar status do nó ${nodeName}:`, err.message);
  }

  // 3. Coleta inventário de VMs QEMU e Containers LXC do nó
  let vms = [];
  let lxcs = [];
  try {
    const [vmsRes, lxcsRes] = await Promise.all([
      client.get(`/nodes/${nodeName}/qemu`).catch(() => ({ data: { data: [] } })),
      client.get(`/nodes/${nodeName}/lxc`).catch(() => ({ data: { data: [] } })),
    ]);
    vms = vmsRes.data?.data || [];
    lxcs = lxcsRes.data?.data || [];
  } catch (err) {
    console.warn(`[Proxmox] Erro ao buscar VMs/LXCs de ${nodeName}:`, err.message);
  }

  // 4. Coleta storages do nó
  let storages = [];
  try {
    const storagesRes = await client.get(`/nodes/${nodeName}/storage`);
    storages = (storagesRes.data?.data || []).map((s) => ({
      name: s.storage,
      type: s.type,
      active: !!s.active,
      usedBytes: s.used || 0,
      totalBytes: s.total || 0,
      usedPercent: s.total > 0 ? Math.round(((s.used || 0) / s.total) * 100) : 0,
    }));
  } catch (err) {
    console.warn(`[Proxmox] Erro ao buscar storages de ${nodeName}:`, err.message);
  }

  // Cálculos de CPU e Memória
  const cpuPercent = nodeStatus.cpu != null ? Math.round(nodeStatus.cpu * 100) : 0;
  const memUsedBytes = nodeStatus.memory?.used ?? nodeStatus.mem ?? 0;
  const memTotalBytes = nodeStatus.memory?.total ?? nodeStatus.maxmem ?? 0;
  const memPercent = memTotalBytes > 0 ? Math.round((memUsedBytes / memTotalBytes) * 100) : 0;
  const memUsedGB = (memUsedBytes / (1024 * 1024 * 1024)).toFixed(1);
  const memTotalGB = (memTotalBytes / (1024 * 1024 * 1024)).toFixed(1);

  // Contagem de VMs
  const runningVms = vms.filter((v) => v.status === 'running').length;
  const stoppedVms = vms.filter((v) => v.status !== 'running').length;

  // Contagem de LXCs
  const runningLxcs = lxcs.filter((c) => c.status === 'running').length;
  const stoppedLxcs = lxcs.filter((c) => c.status !== 'running').length;

  return {
    node: nodeName,
    pveVersion: nodeStatus.pveversion || 'Proxmox VE',
    uptimeSeconds: nodeStatus.uptime || 0,
    cpu: {
      percent: cpuPercent,
      cores: nodeStatus.cpuinfo?.cpus || primaryNode.maxcpu || 0,
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
        cpuPercent: v.cpu != null ? Math.round(v.cpu * 100) : 0,
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
