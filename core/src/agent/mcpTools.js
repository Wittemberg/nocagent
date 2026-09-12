const { getProxmoxMetrics, rebootVm, snapshotVm } = require('../drivers/proxmox');
const { getMikrotikMetrics } = require('../drivers/mikrotik');
const { getPfSenseMetrics } = require('../drivers/pfsense');
const { getZabbixActiveTriggers } = require('../drivers/zabbix');
const { decryptCredentials } = require('../security/vault');
const { isGlobalKillSwitchActive } = require('../security/flags');
const { recordMcpTrace } = require('../observability/apm');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Definições formais das Ferramentas MCP compatíveis com Claude / OpenAI Tool Calling
 */
const MCP_TOOLS_DEFINITIONS = [
  {
    name: 'proxmox_get_node_status',
    description: 'Consulta status de nó Proxmox VE: CPU, Memória RAM alocada/total, Uptime, nós e storages.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID ou Nome do equipamento Proxmox no cofre (opcional)' },
      },
    },
  },
  {
    name: 'proxmox_list_workloads',
    description: 'Lista inventário de VMs (QEMU) e Containers (LXC) em execução e parados no cluster Proxmox.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do Proxmox no cofre (opcional)' },
      },
    },
  },
  {
    name: 'proxmox_restart_vm',
    description: 'Reinicia uma máquina virtual no Proxmox. EXIGE aprovação humana em 2 etapas (Human-in-the-Loop L2).',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do Proxmox no cofre' },
        node: { type: 'string', description: 'Nome do nó Proxmox (ex: pve, calvi)' },
        vmid: { type: 'number', description: 'ID numérico da VM (ex: 100, 101)' },
      },
      required: ['equipmentId', 'node', 'vmid'],
    },
  },
  {
    name: 'mikrotik_get_status',
    description: 'Consulta métricas do Mikrotik RouterOS: latência RTT, interfaces de rede ativas e uso de CPU.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID ou Nome do Mikrotik no cofre (opcional)' },
      },
    },
  },
  {
    name: 'pfsense_get_gateways',
    description: 'Consulta status de todos os gateways de internet do pfSense, perda de pacotes e latência.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do pfSense no cofre (opcional)' },
      },
    },
  },
  {
    name: 'zabbix_get_active_triggers',
    description: 'Consulta alarmes críticos e desastres ativos no servidor Zabbix.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do Zabbix no cofre (opcional)' },
      },
    },
  },
];

/**
 * Localiza equipamento no cofre e decifra suas credenciais com segurança
 */
async function getDecryptedEquipment(equipmentId, fallbackType = null) {
  let eq = null;
  if (equipmentId) {
    eq = await prisma.equipment.findFirst({
      where: {
        OR: [
          { id: equipmentId },
          { name: { contains: equipmentId, mode: 'insensitive' } },
        ],
        active: true,
      },
    });
  }

  if (!eq && fallbackType) {
    eq = await prisma.equipment.findFirst({
      where: { type: fallbackType, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!eq) {
    throw new Error(`Equipamento ${fallbackType || equipmentId || ''} não encontrado no cofre.`);
  }

  const credentials = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
  return { eq, credentials };
}

/**
 * Executor unificado de chamadas MCP com medição APM e trava de segurança Kill-Switch
 */
async function executeMcpTool(toolName, args = {}) {
  // Trava de segurança imediata: Se Kill-Switch estiver ativo, bloquear ações ativas/destrutivas
  if (isGlobalKillSwitchActive()) {
    if (toolName === 'proxmox_restart_vm' || toolName.includes('reboot') || toolName.includes('restart') || toolName.includes('delete')) {
      throw new Error('🚨 Ação MCP bloqueada: Emergency Kill-Switch Global está ATIVADO. Nenhuma ação modificadora permitida.');
    }
  }

  const startTime = Date.now();
  let driver = 'GENERIC';
  if (toolName.startsWith('proxmox_')) driver = 'PROXMOX';
  else if (toolName.startsWith('mikrotik_')) driver = 'MIKROTIK';
  else if (toolName.startsWith('pfsense_')) driver = 'PFSENSE';
  else if (toolName.startsWith('zabbix_')) driver = 'ZABBIX';

  let statusCode = 200;
  let errorMsg = null;

  try {
    switch (toolName) {
      case 'proxmox_get_node_status': {
        const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'PROXMOX');
        const metrics = await getProxmoxMetrics(eq.host, credentials, eq.port);
        return {
          equipment: eq.name,
          node: metrics.node,
          cpuPercent: `${metrics.cpu.percent}%`,
          memoryUsage: `${metrics.memory.usedGB} GB de ${metrics.memory.totalGB} GB (${metrics.memory.percent}%)`,
          uptime: `${Math.round(metrics.uptimeSeconds / 86400)} dias`,
          storages: metrics.storages,
        };
      }

      case 'proxmox_list_workloads': {
        const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'PROXMOX');
        const metrics = await getProxmoxMetrics(eq.host, credentials, eq.port);
        return {
          equipment: eq.name,
          node: metrics.node,
          vms: {
            total: metrics.workloads.totalVMs,
            running: metrics.workloads.runningVMs,
            stopped: metrics.workloads.stoppedVMs,
            list: metrics.workloads.vmsList,
          },
          lxcs: {
            total: metrics.workloads.totalLXCs,
            running: metrics.workloads.runningLXCs,
            stopped: metrics.workloads.stoppedLXCs,
            list: metrics.workloads.lxcsList,
          },
        };
      }

      case 'proxmox_restart_vm': {
        const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'PROXMOX');
        const result = await rebootVm(eq.host, credentials, eq.port, args.node, args.vmid);
        return { success: true, message: `Comando de reinício enviado para VM ${args.vmid} no nó ${args.node}`, result };
      }

      case 'mikrotik_get_status': {
        const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'MIKROTIK');
        const metrics = await getMikrotikMetrics(eq.host, credentials, eq.port);
        return {
          equipment: eq.name,
          status: metrics.status,
          latency: metrics.lastLatency ? `${metrics.lastLatency} ms` : 'N/A',
          loss: `${metrics.lastLossPercent}%`,
          cpuLoad: metrics.cpuLoadPercent != null ? `${metrics.cpuLoadPercent}%` : 'N/A',
          version: metrics.version,
          interfaces: metrics.interfaces || [],
        };
      }

      case 'pfsense_get_gateways': {
        const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'PFSENSE');
        const apiKey = typeof credentials === 'object' ? (credentials.apiKey || credentials.key) : String(credentials);
        const metrics = await getPfSenseMetrics(eq.host, apiKey, eq.port);
        return {
          equipment: eq.name,
          status: metrics.status,
          gateways: metrics.gateways,
        };
      }

      case 'zabbix_get_active_triggers': {
        const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'ZABBIX');
        const triggers = await getZabbixActiveTriggers(eq.host, credentials, eq.port);
        return {
          equipment: eq.name,
          count: triggers.length,
          triggers,
        };
      }

      default:
        throw new Error(`Ferramenta MCP desconhecida: ${toolName}`);
    }
  } catch (err) {
    statusCode = err.response?.status || 500;
    errorMsg = err.message || String(err);
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    recordMcpTrace({
      driver,
      equipmentId: args.equipmentId || null,
      method: 'MCP_CALL',
      endpoint: toolName,
      durationMs,
      statusCode,
      error: errorMsg,
    }).catch(() => {});
  }
}

module.exports = {
  MCP_TOOLS_DEFINITIONS,
  executeMcpTool,
};
