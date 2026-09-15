'use strict';

const crypto = require('crypto');
const { Client: SshClient } = require('ssh2');
const { PrismaClient } = require('@prisma/client');
const { decryptCredentials } = require('./vault');

const prisma = new PrismaClient();

function deriveFingerprint(hostKey) {
  return `SHA256:${crypto.createHash('sha256').update(hostKey).digest('base64')}`;
}

function fingerprintsMatch(expected, received) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function hostConnectionOptions(equipment, credentials = {}) {
  const host = equipment.host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  return {
    host,
    port: equipment.port || 22,
    username: credentials.username || credentials.user,
    password: credentials.password || credentials.pass,
    readyTimeout: 15000,
  };
}

async function registerPendingHostKey(equipmentId, hostKey) {
  const fingerprint = deriveFingerprint(hostKey);
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { knownHostKey: true, pendingHostKey: true },
  });

  if (!equipment) throw new Error('Equipamento não encontrado no cofre.');
  if (equipment.knownHostKey && !fingerprintsMatch(equipment.knownHostKey, fingerprint)) {
    throw new Error('ALERTA_ANTI_MITM: o fingerprint SSH confiado mudou. Acesso bloqueado.');
  }
  if (!equipment.knownHostKey && equipment.pendingHostKey !== fingerprint) {
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: { pendingHostKey: fingerprint, pendingHostKeyAt: new Date() },
    });
  }
  return fingerprint;
}

async function validateConfirmedHostKey(equipmentId, hostKey) {
  const fingerprint = deriveFingerprint(hostKey);
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { knownHostKey: true },
  });

  if (!equipment) throw new Error('Equipamento não encontrado no cofre.');
  if (equipment.knownHostKey && fingerprintsMatch(equipment.knownHostKey, fingerprint)) return fingerprint;
  if (!equipment.knownHostKey) await registerPendingHostKey(equipmentId, hostKey);
  throw new Error('HOST_KEY_CONFIRMATION_REQUIRED: confirme o fingerprint SSH antes de executar ações.');
}

function captureHostFingerprint(equipment) {
  return new Promise((resolve, reject) => {
    const connection = new SshClient();
    let settled = false;
    const settle = (callback, value) => {
      if (!settled) {
        settled = true;
        connection.end();
        callback(value);
      }
    };

    connection.on('error', (error) => {
      if (!settled) settle(reject, new Error(`Falha ao descobrir chave SSH: ${error.message}`));
    });
    connection.connect({
      ...hostConnectionOptions(equipment),
      hostVerifier: (hostKey, callback) => {
        registerPendingHostKey(equipment.id, hostKey)
          .then((fingerprint) => {
            callback(false);
            settle(resolve, { fingerprint, status: 'PENDING_CONFIRMATION' });
          })
          .catch((error) => {
            callback(false);
            settle(reject, error);
          });
      },
    });
  });
}

function runSshAction(equipment, credentials, command) {
  return new Promise((resolve, reject) => {
    const connection = new SshClient();
    let stdout = '';
    let stderr = '';
    let settled = false;
    const fail = (error) => {
      if (!settled) {
        settled = true;
        connection.end();
        reject(error);
      }
    };

    connection.on('error', (error) => fail(new Error(`Erro de conexão SSH: ${error.message}`)));
    connection.on('ready', () => {
      connection.exec(command, (error, stream) => {
        if (error) return fail(new Error(`Falha ao executar ação SSH: ${error.message}`));
        stream.on('data', (data) => { stdout += data.toString(); });
        stream.stderr.on('data', (data) => { stderr += data.toString(); });
        stream.on('close', (exitCode) => {
          if (!settled) {
            settled = true;
            connection.end();
            resolve({ output: stdout.trim() || '(sem saída)', stderr: stderr.trim() || null, exitCode });
          }
        });
      });
    });
    connection.connect({
      ...hostConnectionOptions(equipment, credentials),
      hostVerifier: (hostKey, callback) => {
        validateConfirmedHostKey(equipment.id, hostKey)
          .then(() => callback(true))
          .catch((error) => {
            callback(false);
            fail(error);
          });
      },
    });
  });
}

async function runRegisteredAction(equipment, action) {
  let credentials = decryptCredentials(equipment.encryptedCredentials, equipment.iv, equipment.authTag);
  try {
    return await runSshAction(equipment, credentials, action.command);
  } finally {
    credentials = null;
  }
}

module.exports = {
  captureHostFingerprint,
  deriveFingerprint,
  runRegisteredAction,
};
