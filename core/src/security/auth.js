const crypto = require('crypto');
const { authenticator } = require('otplib');

// Configuração de janela de tolerância para o TOTP (1 ciclo antes/depois para compensar relógio)
authenticator.options = { window: 1 };

// Segredo para assinatura de tokens de sessão
const JWT_SECRET = process.env.JWT_SECRET || process.env.VAULT_MASTER_KEY || 'nocagent-session-signing-key-fallback-2026';

/**
 * Hash seguro de senha usando scrypt nativo do Node.js com salt aleatório
 */
function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Senha inválida para geração de hash.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { passwordHash, salt };
}

/**
 * Verificação de senha em tempo constante para mitigar timing attacks
 */
function verifyPassword(password, passwordHash, salt) {
  if (!password || !passwordHash || !salt) return false;
  try {
    const hashToVerify = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(passwordHash, 'hex'),
      Buffer.from(hashToVerify, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Emite Token de Sessão assinado com HMAC-SHA256 (Padrão JWT leve com 0 deps extras)
 */
function generateToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Date.now() + expiresInMs;
  const fullPayload = { ...payload, exp };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Valida o Token de Sessão e retorna o payload decodificado
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token não fornecido');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token inválido');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    throw new Error('Assinatura do token inválida');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return payload;
}

/**
 * Gera Segredo Base32 e URI para aplicativo autenticador 2FA (Google Authenticator, Authy)
 */
function generateTotpSecret(email) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'NOC-Agent', secret);
  return { secret, otpauth };
}

/**
 * Valida código 2FA TOTP de 6 dígitos
 */
function verifyTotp(token, secret) {
  if (!token || !secret) return false;
  const cleanToken = String(token).replace(/\s+/g, '');
  return authenticator.check(cleanToken, secret);
}

/**
 * Middleware: Autenticação obrigatória via Bearer Token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acesso não autorizado. Token de autenticação ausente.',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: err.message || 'Sessão inválida ou expirada.',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Middleware: Apenas SUPERADMIN
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({
      error: 'Acesso negado. Ação restrita exclusivamente ao Superadmin.',
      code: 'FORBIDDEN_SUPERADMIN_ONLY',
    });
  }
  next();
}

/**
 * Middleware: SUPERADMIN ou TENANT_MASTER do respectivo tenant
 */
function requireTenantMasterOrSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' });
  }

  if (req.user.role === 'SUPERADMIN') {
    return next();
  }

  if (req.user.role === 'TENANT_MASTER') {
    return next();
  }

  return res.status(403).json({
    error: 'Acesso negado. Requer permissão de Master do Tenant ou Superadmin.',
    code: 'FORBIDDEN_MASTER_OR_SUPERADMIN',
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateTotpSecret,
  verifyTotp,
  authenticateToken,
  requireSuperAdmin,
  requireTenantMasterOrSuperAdmin,
};
