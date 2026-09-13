/**
 * @file fileSecurity.js
 * @description Módulo de segurança para upload e Drag & Drop com proteção ativa contra Zip Bombs,
 * descompressão maliciosa, estouro de memória e arquivos binários disfarçados.
 */

export const MAX_SSH_KEY_SIZE_BYTES = 131072; // 128 KB limite estrito

export const FORBIDDEN_ARCHIVE_EXTENSIONS = [
  '.zip', '.gz', '.gzip', '.tgz', '.bz2', '.tbz2', '.xz', '.txz', 
  '.7z', '.rar', '.tar', '.z', '.iso', '.dmg', '.pkg', '.apk', 
  '.jar', '.war', '.ear', '.bin', '.exe', '.dll', '.so', '.dylib'
];

/**
 * Assinaturas binárias (Magic Bytes) de arquivos compactados e containers.
 * Detecta arquivos compactados mesmo se renomeados como .pem, .key, .txt ou sem extensão.
 */
export const ARCHIVE_MAGIC_SIGNATURES = [
  // ZIP: PK\x03\x04, PK\x05\x06, PK\x07\x08
  { name: 'ZIP / Zip Bomb', bytes: [0x50, 0x4B, 0x03, 0x04] },
  { name: 'ZIP / Zip Bomb (Spanned/Empty)', bytes: [0x50, 0x4B, 0x05, 0x06] },
  { name: 'ZIP / Zip Bomb (Spanned)', bytes: [0x50, 0x4B, 0x07, 0x08] },
  // GZIP: \x1f\x8b
  { name: 'GZIP Archive', bytes: [0x1F, 0x8B] },
  // BZIP2: BZh
  { name: 'BZIP2 Archive', bytes: [0x42, 0x5A, 0x68] },
  // 7-Zip: 7z\xbc\xaf'\x1c
  { name: '7-Zip Archive', bytes: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] },
  // RAR: Rar!\x1a\x07
  { name: 'RAR Archive', bytes: [0x52, 0x61, 0x72, 0x21] },
  // XZ: \xfd7zXZ\x00
  { name: 'XZ Archive', bytes: [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00] },
  // Zstandard: \x28\xb5/\xfd
  { name: 'Zstandard (ZSTD)', bytes: [0x28, 0xB5, 0x2F, 0xFD] },
  // Unix Compress (LZW)
  { name: 'Unix Compress (LZW)', bytes: [0x1F, 0x9D] },
  { name: 'Unix Compress (LZW)', bytes: [0x1F, 0xA0] },
];

/**
 * Inspeciona o cabeçalho binário (Magic Bytes) para detectar formatos compactados.
 * Lê apenas os primeiros 512 bytes em memória para prevenir congelamento da interface.
 * @param {File|Blob} file 
 * @returns {Promise<{ isArchive: boolean, format?: string }>}
 */
export async function detectArchiveMagicBytes(file) {
  const slice = file.slice(0, 512);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 1. Checagem contra assinaturas conhecidas no início do arquivo
  for (const sig of ARCHIVE_MAGIC_SIGNATURES) {
    if (bytes.length >= sig.bytes.length) {
      const match = sig.bytes.every((b, i) => bytes[i] === b);
      if (match) {
        return { isArchive: true, format: sig.name };
      }
    }
  }

  // 2. Checagem de cabeçalho TAR (magic 'ustar' no offset 257)
  if (bytes.length >= 262) {
    const ustar = [0x75, 0x73, 0x74, 0x61, 0x72]; // 'ustar'
    const isTar = ustar.every((b, i) => bytes[257 + i] === b);
    if (isTar) {
      return { isArchive: true, format: 'TAR Archive / TarBomb' };
    }
  }

  return { isArchive: false };
}

/**
 * Validação rigorosa de arquivo de chave SSH (Drop ou File Picker).
 * Garante proteção contra Zip Bombs, arquivos gigantes e injeção de binários.
 * @param {File} file 
 * @returns {Promise<{ valid: boolean, error?: string, content?: string }>}
 */
export async function validateSshKeyFile(file) {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo fornecido.' };
  }

  // 1. Verificação prévia de tamanho (Pre-Read Check)
  if (file.size > MAX_SSH_KEY_SIZE_BYTES) {
    return { 
      valid: false, 
      error: `Arquivo bloqueado: O tamanho (${(file.size / 1024).toFixed(1)} KB) excede o limite seguro máximo de 128 KB para chaves SSH.` 
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'O arquivo selecionado está vazio (0 bytes).' };
  }

  // 2. Verificação de extensão proibida
  const lowerName = file.name.toLowerCase();
  for (const ext of FORBIDDEN_ARCHIVE_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return { 
        valid: false, 
        error: `Arquivo bloqueado: Extensões compactadas (${ext}) não são permitidas. Proteção Anti-ZipBomb ativa.` 
      };
    }
  }

  // 3. Inspeção de Magic Bytes (Deep Binary Header Inspection)
  const magicResult = await detectArchiveMagicBytes(file);
  if (magicResult.isArchive) {
    return {
      valid: false,
      error: `Ameaça de Zip Bomb bloqueada: O arquivo possui cabeçalho binário de arquivo compactado (${magicResult.format}) e foi rejeitado por segurança.`
    };
  }

  // 4. Verificação de Bytes Nulos (Detecção de Binário disfarçado)
  const slice = file.slice(0, 512);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x00) {
      return {
        valid: false,
        error: 'Arquivo bloqueado: O arquivo contém bytes nulos (formato binário incompatível com chave de texto ASCII/PEM).'
      };
    }
  }

  // 5. Leitura segura do conteúdo de texto
  const text = await file.text();
  const trimmed = text.trim();

  // Validação de estrutura esperada de chave SSH
  const hasValidHeader = 
    trimmed.includes('-----BEGIN') || 
    trimmed.startsWith('ssh-rsa') || 
    trimmed.startsWith('ssh-ed25519') || 
    trimmed.startsWith('ecdsa-sha2-') ||
    trimmed.includes('PRIVATE KEY-----');

  if (!hasValidHeader) {
    return {
      valid: false,
      error: 'Formato de chave não reconhecido: O arquivo deve conter um cabeçalho válido (ex: "-----BEGIN ... PRIVATE KEY-----" ou "ssh-rsa").'
    };
  }

  return { valid: true, content: trimmed };
}
