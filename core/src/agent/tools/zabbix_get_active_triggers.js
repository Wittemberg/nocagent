const { getDecryptedEquipment } = require('../equipmentUtils');
const { getZabbixActiveTriggers } = require('../../drivers/zabbix');

module.exports = {
  definition: {
    name: 'zabbix_get_active_triggers',
    description: 'Consulta alarmes críticos e desastres ativos no servidor Zabbix.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do Zabbix no cofre (opcional)' },
      },
    },
  },
  handler: async (args) => {
    const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'ZABBIX');
    const triggers = await getZabbixActiveTriggers(eq.host, credentials, eq.port);
    return {
      equipment: eq.name,
      count: triggers.length,
      triggers,
    };
  }
};
