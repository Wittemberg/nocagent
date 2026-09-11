const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM

/**
 * Obtém a chave mestra de 32 bytes a partir da variável de ambiente VAULT_MASTER_KEY
 */
function getMasterKey() {
  const masterKeyHex = process.env.VAULT_MASTER_KEY;
  if (!masterKeyHex) {
    throw new Error('FATAL: VAULT_MASTER_KEY não configurada no ambiente. O cofre não pode operar sem chave mestra.');
  }

  // Se a chave estiver em hex (64 chars), converte para buffer de 32 bytes
  if (masterKeyHex.length === 64) {
    return Buffer.from(masterKeyHex, 'hex');
  }

  // Fallback: deriva 32 bytes via SHA-256 se for uma string arbitrária
  return crypto.createHash('sha256').update(masterKeyHex).digest();
}

/**
 * Cifra um objeto ou string de credenciais com AES-256-GCM
 * @param {Object|string} data - Objeto de credenciais (ex: { apiKey: "...", user: "...", pass: "..." })
 * @returns {{ encryptedCredentials: string, iv: string, authTag: string }}
 */
function encryptCredentials(data) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const textToEncrypt = typeof data === 'object' ? JSON.stringify(data) : String(data);
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedCredentials: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag,
  };
}

/**
 * Descriptografa as credenciais estritamente em memória RAM e retorna o objeto decodificado
 * @param {string} encryptedHex - Texto cifrado em hex
 * @param {string} ivHex - Vetor de inicialização em hex
 * @param {string} authTagHex - Tag de autenticação GCM em hex
 * @returns {Object} Dados decodificados originais
 */
function decryptCredentials(encryptedHex, ivHex, authTagHex) {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

module.exports = {
  encryptCredentials,
  decryptCredentials,
};
