const { getDecryptedEquipment } = require('../equipmentUtils');
const { rebootVm } = require('../../drivers/proxmox');

module.exports = {
  definition: {
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
  handler: async (args) => {
    const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'PROXMOX');
    const result = await rebootVm(eq.host, credentials, eq.port, args.node, args.vmid);
    return { success: true, message: `Comando de reinício enviado para VM ${args.vmid} no nó ${args.node}`, result };
  }
};
