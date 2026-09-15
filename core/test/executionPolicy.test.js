const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getActionDefinition,
  validateExecutionRequest,
} = require('../src/security/executionPolicy');

test('permite ação de leitura para operador autenticado', () => {
  const result = validateExecutionRequest({
    actionKey: 'ssh.system_info.v1',
    equipment: { id: 'eq-1', tenantId: 'tenant-1', active: true },
    actor: { id: 'user-1', role: 'OPERATOR', tenantId: 'tenant-1' },
  });

  assert.equal(result.requiresApproval, false);
  assert.equal(result.action.command, 'uname -a && uptime');
});

test('exige aprovação para ação mutável', () => {
  const result = validateExecutionRequest({
    actionKey: 'ssh.reboot.v1',
    equipment: { id: 'eq-1', tenantId: 'tenant-1', active: true },
    actor: { id: 'user-1', role: 'TENANT_MASTER', tenantId: 'tenant-1' },
  });

  assert.equal(result.requiresApproval, true);
});

test('nega ação desconhecida e acesso entre tenants', () => {
  assert.throws(
    () => getActionDefinition('ssh.freeform.v1'),
    /Ação de execução desconhecida/
  );

  assert.throws(
    () => validateExecutionRequest({
      actionKey: 'ssh.system_info.v1',
      equipment: { id: 'eq-1', tenantId: 'tenant-1', active: true },
      actor: { id: 'user-1', role: 'OPERATOR', tenantId: 'tenant-2' },
    }),
    /outro tenant/
  );
});
