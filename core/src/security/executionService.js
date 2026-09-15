'use strict';

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { getActionDefinition, validateExecutionRequest } = require('./executionPolicy');
const { runRegisteredAction } = require('./proxy');

const prisma = new PrismaClient();
const APPROVAL_TTL_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 60 * 1000;

function createApprovalCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function getIdempotencyKey(idempotencyKey) {
  if (idempotencyKey && /^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return idempotencyKey;
  throw new Error('idempotencyKey é obrigatório e deve conter entre 16 e 128 caracteres seguros.');
}

function assertApprovalRole(actor) {
  if (!['TENANT_MASTER', 'SUPERADMIN'].includes(actor?.role)) {
    throw new Error('Aprovação restrita ao Tenant Master ou Superadmin.');
  }
}

async function createAuditLog({ action, equipment, actor, status, details }) {
  await prisma.auditLog.create({
    data: {
      action,
      target: `${equipment.name} (${equipment.type})`,
      status,
      source: 'ZERO_TRUST_PROXY',
      details: { actorId: actor.id, ...details },
    },
  }).catch(() => {});
}

async function getExecution(executionId) {
  const execution = await prisma.executionRequest.findUnique({
    where: { id: executionId },
    include: { equipment: true, approval: true },
  });
  if (!execution) throw new Error('Execução não encontrada.');
  return execution;
}

function assertExecutionAccess(execution, actor) {
  if (actor.role !== 'SUPERADMIN' && execution.tenantId !== actor.tenantId) {
    throw new Error('Acesso negado: execução pertence a outro tenant.');
  }
}

async function acquireExecutionLock(executionId, equipmentId) {
  const resourceKey = `equipment:${equipmentId}:execution`;
  await prisma.executionLock.deleteMany({ where: { resourceKey, expiresAt: { lt: new Date() } } });
  try {
    await prisma.executionLock.create({
      data: { resourceKey, executionId, expiresAt: new Date(Date.now() + LOCK_TTL_MS) },
    });
  } catch {
    throw new Error('Equipamento já possui uma execução em andamento. Tente novamente após sua conclusão.');
  }
  return resourceKey;
}

async function releaseExecutionLock(resourceKey, executionId) {
  await prisma.executionLock.deleteMany({ where: { resourceKey, executionId } });
}

function serializeExecution(execution) {
  return {
    id: execution.id,
    actionKey: execution.actionKey,
    risk: execution.risk,
    status: execution.status,
    equipmentId: execution.equipmentId,
    expiresAt: execution.expiresAt,
    output: execution.output || null,
    error: execution.error || null,
    approval: execution.approval ? { code: execution.approval.code, expiresAt: execution.approval.expiresAt } : null,
  };
}

async function runExecution(execution, actor) {
  const resourceKey = await acquireExecutionLock(execution.id, execution.equipmentId);
  await prisma.executionRequest.update({
    where: { id: execution.id },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    const action = getActionDefinition(execution.actionKey);
    const result = await runRegisteredAction(execution.equipment, action);
    const completed = await prisma.executionRequest.update({
      where: { id: execution.id },
      data: { status: 'SUCCEEDED', output: result.output, completedAt: new Date() },
      include: { approval: true },
    });
    await createAuditLog({ action: execution.actionKey, equipment: execution.equipment, actor, status: 'SUCCESS', details: { executionId: execution.id, exitCode: result.exitCode } });
    return { success: true, execution: serializeExecution(completed), exitCode: result.exitCode };
  } catch (error) {
    const failed = await prisma.executionRequest.update({
      where: { id: execution.id },
      data: { status: 'FAILED', error: error.message, completedAt: new Date() },
      include: { approval: true },
    });
    await createAuditLog({ action: execution.actionKey, equipment: execution.equipment, actor, status: 'FAILED', details: { executionId: execution.id, error: error.message } });
    return { success: false, execution: serializeExecution(failed) };
  } finally {
    await releaseExecutionLock(resourceKey, execution.id);
  }
}

async function requestExecution({ equipmentId, actionKey, actor, idempotencyKey }) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  const { action, requiresApproval } = validateExecutionRequest({ actionKey, equipment, actor });
  const key = getIdempotencyKey(idempotencyKey);
  const existing = await prisma.executionRequest.findUnique({ where: { idempotencyKey: key }, include: { approval: true } });
  if (existing) return { success: true, replayed: true, execution: serializeExecution(existing) };

  const expiresAt = requiresApproval ? new Date(Date.now() + APPROVAL_TTL_MS) : null;
  const execution = await prisma.executionRequest.create({
    data: {
      equipmentId: equipment.id,
      tenantId: equipment.tenantId,
      actionKey: action.key,
      risk: action.risk,
      status: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
      requestedByUserId: actor.id,
      idempotencyKey: key,
      expiresAt,
      approval: requiresApproval ? {
        create: { code: createApprovalCode(), requestedById: actor.id, expiresAt },
      } : undefined,
    },
    include: { equipment: true, approval: true },
  });

  await createAuditLog({ action: action.key, equipment, actor, status: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED', details: { executionId: execution.id } });
  if (requiresApproval) return { success: true, pendingApproval: true, execution: serializeExecution(execution) };
  return runExecution(execution, actor);
}

async function approveExecution({ executionId, approvalCode, actor }) {
  assertApprovalRole(actor);
  const execution = await getExecution(executionId);
  assertExecutionAccess(execution, actor);
  if (execution.status !== 'PENDING_APPROVAL' || !execution.approval) throw new Error('Execução não está aguardando aprovação.');
  if (execution.approval.code !== approvalCode) throw new Error('Código de aprovação inválido.');
  if (execution.approval.expiresAt < new Date()) {
    await prisma.executionRequest.update({ where: { id: execution.id }, data: { status: 'EXPIRED' } });
    throw new Error('Aprovação expirada. Solicite uma nova execução.');
  }

  const approved = await prisma.executionRequest.update({
    where: { id: execution.id },
    data: {
      status: 'APPROVED',
      approvedByUserId: actor.id,
      approvedAt: new Date(),
      approval: { update: { approvedById: actor.id, approvedAt: new Date() } },
    },
    include: { equipment: true, approval: true },
  });
  return runExecution(approved, actor);
}

module.exports = {
  approveExecution,
  requestExecution,
};
