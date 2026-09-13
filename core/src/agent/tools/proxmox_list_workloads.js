const { getDecryptedEquipment } = require('../equipmentUtils');
const { getProxmoxMetrics } = require('../../drivers/proxmox');

module.exports = {
  definition: {
    name: 'proxmox_list_workloads',
    description: 'Lista inventário de VMs (QEMU) e Containers (LXC) em execução e parados no cluster Proxmox.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do Proxmox no cofre (opcional)' },
      },
    },
  },
  handler: async (args) => {
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
};
