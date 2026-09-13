const { getDecryptedEquipment } = require('../equipmentUtils');
const { getProxmoxMetrics } = require('../../drivers/proxmox');

module.exports = {
  definition: {
    name: 'proxmox_get_node_status',
    description: 'Consulta status de nó Proxmox VE: CPU, Memória RAM alocada/total, Uptime, nós e storages.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID ou Nome do equipamento Proxmox no cofre (opcional)' },
      },
    },
  },
  handler: async (args) => {
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
};
