/**
 * proxy.js — O Porteiro Blindado (Zero-Trust Execution Proxy)
 *
 * A IA nunca recebe credenciais. Ela envia apenas um "bilhete" com o ID do
 * equipamento e o comando desejado. Este módulo busca a credencial no cofre
 * criptografado, valida o fingerprint do host (TOFU), executa o comando e
 * devolve apenas a saída — nunca a senha.
 *
 * Fluxo:
 *   IA → execute_equipment_command(equipmentId, command)
 *        → proxy.runCommand()
 *              → decryptCredentials() em RAM
 *              → validateTofu()         [bloqueia se fingerprint mudou]
 *              → executa via SSH/API
 *              → retorna stdout/result  [senha descartada]
 */

'use strict';

const { Client: SshClient } = require('ssh2');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { decryptCredentials } = require('./vault');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// TOFU — Trust On First Use
// ─────────────────────────────────────────────

/**
 * Deriva um fingerprint curto e legível da chave pública SSH apresentada.
 * Usa SHA-256 em base64 (mesmo padrão do OpenSSH "fingerprint").
 */
function deriveFingerprint(hostKey) {
  return 'SHA256:' + crypto.createHash('sha256').update(hostKey).digest('base64');
}

/**
 * Valida o fingerprint do host no modelo TOFU.
 *
 * - Primeiro acesso  → registra o fingerprint automaticamente.
 * - Acessos seguintes → compara; se mudou, lança erro (possível MitM).
 * - Retorna { trusted: true } se passou, lança Error se rejeitado.
 */
async function validateTofu(equipmentId, hostKey) {
  const fingerprint = deriveFingerprint(hostKey);

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, name: true, knownHostKey: true },
  });

  if (!equipment) {
    throw new Error(`Equipamento ${equipmentId} não encontrado no cofre.`);
  }

  // Primeiro acesso: registra o fingerprint automaticamente (TOFU)
  if (!equipment.knownHostKey) {
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: { knownHostKey: fingerprint },
    });
    console.log(`[TOFU] Fingerprint registrado para "${equipment.name}": ${fingerprint}`);
    return { trusted: true, firstUse: true, fingerprint };
  }

  // Acessos seguintes: compara com segurança constante-time
  if (!crypto.timingSafeEqual(
    Buffer.from(equipment.knownHostKey),
    Buffer.from(fingerprint),
  )) {
    throw new Error(
      `🚨 ALERTA ANTI-MitM: O fingerprint SSH de "${equipment.name}" MUDOU!\n` +
      `Esperado: ${equipment.knownHostKey}\n` +
      `Recebido: ${fingerprint}\n` +
      `Acesso BLOQUEADO. Investigue antes de continuar. ` +
      `Se a troca foi legítima, um operador L2/L3 deve resetar o fingerprint via dashboard.`,
    );
  }

  return { trusted: true, firstUse: false, fingerprint };
}

// ─────────────────────────────────────────────
// Proxy SSH — executor isolado
// ─────────────────────────────────────────────

/**
 * Executa um comando remoto via SSH.
 * As credenciais são descriptografadas em RAM e descartadas após o uso.
 * A IA nunca vê a senha — apenas recebe o stdout/stderr.
 *
 * @param {Object} equipment   - Registro do equipamento (host, port, etc.)
 * @param {Object} credentials - Credenciais descriptografadas (username, password)
 * @param {string} command     - Comando a executar remotamente
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runSshCommand(equipment, credentials, command) {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let stdout = '';
    let stderr = '';
    let tofuResult = null;

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(new Error(`Falha ao executar comando SSH: ${err.message}`));
        }

        stream.on('close', (code) => {
          conn.end();
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code, tofu: tofuResult });
        });

        stream.on('data', (data) => { stdout += data.toString(); });
        stream.stderr.on('data', (data) => { stderr += data.toString(); });
      });
    });

    conn.on('error', (err) => reject(new Error(`Erro de conexão SSH: ${err.message}`)));

    // Extrai host limpo (remove protocolo se houver)
    const host = equipment.host.replace(/^https?:\/\//, '').split(':')[0];
    const port = equipment.port || 22;

    conn.connect({
      host,
      port,
      username: credentials.username || credentials.user,
      password: credentials.password || credentials.pass,
      readyTimeout: 15000,
      // TOFU: captura a chave pública do host na primeira conexão
      hostVerifier: (hostKey, callback) => {
        validateTofu(equipment.id, hostKey)
          .then((result) => {
            tofuResult = result;
            callback(true); // Permite a conexão (TOFU registrado/validado)
          })
          .catch((err) => {
            callback(false); // BLOQUEIA a conexão (fingerprint mudou)
            reject(err);
          });
      },
    });
  });
}

// ─────────────────────────────────────────────
// Interface pública do Proxy
// ─────────────────────────────────────────────

/**
 * Ponto de entrada principal do Porteiro Blindado.
 * Busca credencial, valida TOFU e executa o comando remotamente.
 * Retorna apenas stdout/result — nunca a senha.
 *
 * @param {string} equipmentId - ID ou nome do equipamento no cofre
 * @param {string} command     - Comando a executar remotamente
 * @returns {Promise<{success: boolean, output?: string, tofu?: Object, error?: string}>}
 */
async function runCommand(equipmentId, command) {
  // 1. Busca e descriptografa credenciais em RAM
  const equipment = await prisma.equipment.findFirst({
    where: {
      OR: [
        { id: equipmentId },
        { name: { contains: equipmentId, mode: 'insensitive' } },
      ],
      active: true,
    },
  });

  if (!equipment) {
    return { success: false, error: `Equipamento "${equipmentId}" não encontrado no cofre.` };
  }

  let credentials;
  try {
    credentials = decryptCredentials(equipment.encryptedCredentials, equipment.iv, equipment.authTag);
  } catch (e) {
    return { success: false, error: `Falha ao abrir o cofre de credenciais: ${e.message}` };
  }

  // 2. Executa via SSH com validação TOFU integrada
  try {
    const result = await runSshCommand(equipment, credentials, command);

    // Garante que credenciais saem do escopo imediatamente
    credentials = null;

    const tofuMsg = result.tofu?.firstUse
      ? `🔐 *Primeiro acesso:* fingerprint SSH registrado automaticamente (TOFU).`
      : `✅ Fingerprint SSH validado. Host confiável.`;

    return {
      success: true,
      output: result.stdout || '(sem saída)',
      stderr: result.stderr || null,
      exitCode: result.exitCode,
      tofuMessage: tofuMsg,
    };
  } catch (err) {
    credentials = null;
    return { success: false, error: err.message };
  }
}

/**
 * Reseta o fingerprint TOFU de um equipamento.
 * Deve ser chamado apenas por operadores L2/L3 via dashboard quando
 * a troca de chave SSH for legítima (ex: equipamento reformatado).
 *
 * @param {string} equipmentId
 * @returns {Promise<{success: boolean}>}
 */
async function resetTofu(equipmentId) {
  await prisma.equipment.update({
    where: { id: equipmentId },
    data: { knownHostKey: null },
  });
  console.log(`[TOFU] Fingerprint resetado para equipamento ${equipmentId} por operador autorizado.`);
  return { success: true };
}

module.exports = { runCommand, resetTofu, validateTofu, deriveFingerprint };
