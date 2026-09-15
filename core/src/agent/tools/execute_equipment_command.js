/**
 * execute_equipment_command.js — Ferramenta MCP do Porteiro Blindado
 *
 * Esta é a única interface SSH da IA. Ela aceita exclusivamente uma ação
 * homologada; comandos arbitrários não fazem parte do contrato.
 */

'use strict';

const { requestExecution } = require('../../security/executionService');

module.exports = {
  definition: {
    name: 'execute_registered_ssh_action',
    description:
      'Executa uma ação SSH homologada em equipamento do cofre. Não aceita shell ou comandos livres. ' +
      'O primeiro fingerprint SSH exige confirmação humana antes da execução.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: {
          type: 'string',
          description: 'ID ou nome exato do equipamento no cofre (ex: "ROUTER-FILIAL-01" ou o UUID do banco)',
        },
        actionKey: {
          type: 'string',
          enum: ['ssh.system_info.v1', 'ssh.network_interfaces.v1', 'ssh.reboot.v1'],
          description: 'Chave da ação SSH homologada.',
        },
        idempotencyKey: {
          type: 'string',
          description: 'Identificador único e estável da solicitação (16 a 128 caracteres).',
        },
      },
      required: ['equipmentId', 'actionKey', 'idempotencyKey'],
    },
  },

  handler: async ({ equipmentId, actionKey, idempotencyKey }, context) => {
    return requestExecution({ equipmentId, actionKey, idempotencyKey, actor: context?.actor });
  },
};
