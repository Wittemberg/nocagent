const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM

/**
 * Obtém a chave mestra de 32 bytes (256 bits) a partir da variável de ambiente VAULT_MASTER_KEY.
 * Garante compatibilidade estrita com chaves hexadecimais, UTF-8 diretas ou passphrases.
 */
function getMasterKey() {
  const rawKey = (process.env.VAULT_MASTER_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!rawKey) {
    throw new Error('FATAL: VAULT_MASTER_KEY não configurada no ambiente. O cofre não pode operar sem chave mestra.');
  }

  // Se for uma sequência de 64 caracteres hexadecimais válidos
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    const hexBuf = Buffer.from(rawKey, 'hex');
    if (hexBuf.length === 32) {
      return hexBuf;
    }
  }

  // Se já for uma string UTF-8 de exatamente 32 bytes
  const utf8Buf = Buffer.from(rawKey, 'utf8');
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  // Fallback universal e determinístico: deriva 32 bytes exatos (256 bits) via SHA-256
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
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
