const { getDecryptedEquipment } = require('../equipmentUtils');
const { getPfSenseMetrics } = require('../../drivers/pfsense');

module.exports = {
  definition: {
    name: 'pfsense_get_gateways',
    description: 'Consulta status de todos os gateways de internet do pfSense, perda de pacotes e latência.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do pfSense no cofre (opcional)' },
      },
    },
  },
  handler: async (args) => {
    const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'PFSENSE');
    const apiKey = typeof credentials === 'object' ? (credentials.apiKey || credentials.key) : String(credentials);
    const metrics = await getPfSenseMetrics(eq.host, apiKey, eq.port);
    return {
      equipment: eq.name,
      status: metrics.status,
      gateways: metrics.gateways,
    };
  }
};
