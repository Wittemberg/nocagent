'use strict';

const SSH_ACTIONS = Object.freeze({
  'ssh.system_info.v1': {
    key: 'ssh.system_info.v1',
    label: 'Consultar sistema',
    command: 'uname -a && uptime',
    risk: 'READ',
    allowedRoles: ['OPERATOR', 'TENANT_MASTER', 'SUPERADMIN'],
    requiresApproval: false,
  },
  'ssh.network_interfaces.v1': {
    key: 'ssh.network_interfaces.v1',
    label: 'Consultar interfaces de rede',
    command: 'ip -brief address',
    risk: 'READ',
    allowedRoles: ['OPERATOR', 'TENANT_MASTER', 'SUPERADMIN'],
    requiresApproval: false,
  },
  'ssh.reboot.v1': {
    key: 'ssh.reboot.v1',
    label: 'Reiniciar equipamento Linux',
    command: '/sbin/reboot',
    risk: 'MUTATING',
    allowedRoles: ['TENANT_MASTER', 'SUPERADMIN'],
    requiresApproval: true,
  },
});

function getActionDefinition(actionKey) {
  const action = SSH_ACTIONS[actionKey];
  if (!action) throw new Error('Ação de execução desconhecida ou não homologada.');
  return action;
}

function canAccessTenant(actor, equipment) {
  return actor.role === 'SUPERADMIN' || actor.tenantId === equipment.tenantId;
}

function validateExecutionRequest({ actionKey, equipment, actor }) {
  if (!actor?.id || !actor?.role) throw new Error('Contexto do operador autenticado é obrigatório.');
  if (!equipment?.active) throw new Error('Equipamento inexistente ou inativo.');
  if (!canAccessTenant(actor, equipment)) throw new Error('Acesso negado: equipamento pertence a outro tenant.');

  const action = getActionDefinition(actionKey);
  if (!action.allowedRoles.includes(actor.role)) throw new Error('Acesso negado para esta ação homologada.');

  return { action, requiresApproval: action.requiresApproval };
}

function getPublicActionDefinitions() {
  return Object.values(SSH_ACTIONS).map(({ command, ...action }) => action);
}

module.exports = {
  getActionDefinition,
  getPublicActionDefinitions,
  validateExecutionRequest,
};
