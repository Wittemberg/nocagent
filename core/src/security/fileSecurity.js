/**
 * @file fileSecurity.js
 * @description Módulo de segurança backend para proteção contra Zip Bombs,
 * exaustão de memória e injeção de arquivos binários em payloads de credenciais.
 */

const ARCHIVE_MAGIC_BUFFERS = [
  // ZIP
  { name: 'ZIP / Zip Bomb', buf: Buffer.from([0x50, 0x4B, 0x03, 0x04]) },
  { name: 'ZIP Spanned / Empty', buf: Buffer.from([0x50, 0x4B, 0x05, 0x06]) },
  { name: 'ZIP Spanned', buf: Buffer.from([0x50, 0x4B, 0x07, 0x08]) },
  // GZIP
  { name: 'GZIP', buf: Buffer.from([0x1F, 0x8B]) },
  // BZIP2
  { name: 'BZIP2', buf: Buffer.from([0x42, 0x5A, 0x68]) },
  // 7-Zip
  { name: '7-Zip', buf: Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) },
  // RAR
  { name: 'RAR', buf: Buffer.from([0x52, 0x61, 0x72, 0x21]) },
  // XZ
  { name: 'XZ', buf: Buffer.from([0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00]) },
  // ZSTD
  { name: 'ZSTD', buf: Buffer.from([0x28, 0xB5, 0x2F, 0xFD]) },
  // LZW
  { name: 'Unix Compress (LZW)', buf: Buffer.from([0x1F, 0x9D]) },
  { name: 'Unix Compress (LZW)', buf: Buffer.from([0x1F, 0xA0]) },
];

const MAX_KEY_PAYLOAD_SIZE = 131072; // 128 KB máximo permitido para chave SSH

/**
 * Inspeciona se uma string de credencial possui assinatura de arquivo compactado ou Zip Bomb.
 * @param {string} keyString 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateKeySecurity(keyString) {
  if (!keyString || typeof keyString !== 'string') {
    return { valid: true };
  }

  // 1. Verificação de tamanho em bytes
  const byteLen = Buffer.byteLength(keyString, 'utf8');
  if (byteLen > MAX_KEY_PAYLOAD_SIZE) {
    return {
      valid: false,
      error: `Tamanho de chave excede o limite máximo permitido de 128 KB (${(byteLen / 1024).toFixed(1)} KB recebidos). Bloqueado por segurança.`
    };
  }

  const rawBuf = Buffer.from(keyString, 'binary');

  // 2. Checagem de Magic Bytes de arquivo compactado / Zip Bomb
  for (const sig of ARCHIVE_MAGIC_BUFFERS) {
    if (rawBuf.length >= sig.buf.length && rawBuf.subarray(0, sig.buf.length).equals(sig.buf)) {
      return {
        valid: false,
        error: `Payload com assinatura de arquivo compactado (${sig.name}) bloqueado por proteção Anti-ZipBomb.`
      };
    }
  }

  // 3. Checagem de cabeçalho TAR no offset 257 ('ustar')
  if (rawBuf.length >= 262) {
    const tarMagic = Buffer.from([0x75, 0x73, 0x74, 0x61, 0x72]);
    if (rawBuf.subarray(257, 262).equals(tarMagic)) {
      return {
        valid: false,
        error: 'Payload com cabeçalho de arquivo TAR/TarBomb bloqueado por proteção Anti-ZipBomb.'
      };
    }
  }

  // 4. Checagem de bytes nulos (\0)
  if (keyString.includes('\0')) {
    return {
      valid: false,
      error: 'Chave contém caracteres nulos ou dados binários incompatíveis com credencial de texto.'
    };
  }

  return { valid: true };
}

module.exports = {
  validateKeySecurity,
  MAX_KEY_PAYLOAD_SIZE
};
