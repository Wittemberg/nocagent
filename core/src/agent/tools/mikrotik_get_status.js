const { getDecryptedEquipment } = require('../equipmentUtils');
const { getMikrotikMetrics } = require('../../drivers/mikrotik');

module.exports = {
  definition: {
    name: 'mikrotik_get_status',
    description: 'Consulta métricas do Mikrotik RouterOS: latência RTT, interfaces de rede ativas e uso de CPU.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID ou Nome do Mikrotik no cofre (opcional)' },
      },
    },
  },
  handler: async (args) => {
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
};
