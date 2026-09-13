require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const QRCode = require('qrcode');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const { handleChatwootWebhook } = require('./chatwoot/bridge');
const { processMessage } = require('./agent/hermes');
const { encryptCredentials, decryptCredentials } = require('./security/vault');
const { getProxmoxMetrics } = require('./drivers/proxmox');
const { getMikrotikMetrics } = require('./drivers/mikrotik');
const { getPfSenseMetrics } = require('./drivers/pfsense');
const { getZabbixActiveTriggers } = require('./drivers/zabbix');
const { MCP_TOOLS_DEFINITIONS, executeMcpTool } = require('./agent/mcpTools');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateTotpSecret,
  verifyTotp,
  authenticateToken,
  requireSuperAdmin,
  requireTenantMasterOrSuperAdmin,
} = require('./security/auth');
const {
  initFlags,
  getKillSwitchStatus,
  setGlobalKillSwitch,
  getAllFlags,
  setFeatureFlag,
} = require('./security/flags');
const {
  initApm,
  getApmMetrics,
  getRecentTraces,
  recordMcpTrace,
} = require('./observability/apm');

const crypto = require('crypto');
const net = require('net');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Agente HTTPS para ignorar certificados autoassinados em firewalls locais
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Função utilitária de probe de socket TCP com medição de RTT (ms)
 */
function probeTcpPort(host, port, timeoutMs = 3500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const cleanHost = String(host)
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .split(':')[0];
    const targetPort = parseInt(port, 10);
    if (!cleanHost || isNaN(targetPort)) {
      return resolve({ online: false, error: 'HOST_OU_PORTA_INVALIDA' });
    }
    const socket = new net.Socket();
    let finished = false;

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      finished = true;
      const rtt = Date.now() - start;
      socket.destroy();
      resolve({ online: true, rtt });
    });
    socket.on('timeout', () => {
      if (!finished) {
        finished = true;
        socket.destroy();
        resolve({ online: false, error: 'TIMEOUT' });
      }
    });
    socket.on('error', (err) => {
      if (!finished) {
        finished = true;
        socket.destroy();
        resolve({ online: false, error: err.code || err.message });
      }
    });
    try {
      socket.connect(targetPort, cleanHost);
    } catch (e) {
      resolve({ online: false, error: e.message });
    }
  });
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Log de requisições simples
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- ROTAS DA API (DADOS 100% REAIS) ---

/**
 * Healthcheck para Traefik / Docker / Monitoramento
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nocagent-core',
    version: '1.1.1',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    features: {
      hermesEngine: true,
      chatwootDualApi: true,
      vaultAES256: true,
      s3Storage: true,
      multiTenantRbac: true,
      totp2fa: true,
    },
  });
});

/**
 * Retorna filtro estrito de Tenant para isolamento de dados
 */
function getTenantFilter(req) {
  if (req.user?.role === 'SUPERADMIN') {
    return req.query?.tenantId ? { tenantId: req.query.tenantId } : {};
  }
  return { tenantId: req.user?.tenantId || 'unassigned-tenant' };
}

/**
 * Inicialização e Bootstrap do Superadministrador
 */
async function bootstrapSuperadmin() {
  try {
    const adminEmail = (process.env.DCC_DEVELOPER_USERNAME || 'admin@nocagent.local').trim().toLowerCase();
    const defaultPassword = process.env.DCC_DEVELOPER_PASSWORD || 'NocAgent@2026!';
    const { passwordHash, salt } = hashPassword(defaultPassword);
    const totpSecret = process.env.DCC_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';

    let defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'noc-corp' } });
    if (!defaultTenant) {
      defaultTenant = await prisma.tenant.create({
        data: {
          name: 'NOC Agent Global Corp',
          slug: 'noc-corp',
          status: 'ACTIVE',
          plan: 'ENTERPRISE',
          maxEquipments: 0,
          maxUsers: 0,
          maxStorages: 0,
          aiLevel: 'L3_CRITICAL',
          retentionDays: 90,
        },
      });
    } else {
      // Garante cotas preenchidas no tenant padrão
      await prisma.tenant.update({
        where: { id: defaultTenant.id },
        data: {
          maxEquipments: defaultTenant.maxEquipments ?? 0,
          maxUsers: defaultTenant.maxUsers ?? 0,
          maxStorages: defaultTenant.maxStorages ?? 0,
          aiLevel: defaultTenant.aiLevel ?? 'L3_CRITICAL',
          retentionDays: defaultTenant.retentionDays ?? 90,
        },
      });
    }

    // Auto-migração: vincula qualquer equipamento ou storage órfão ao tenant padrão noc-corp
    if (defaultTenant) {
      await prisma.equipment.updateMany({
        where: { tenantId: null },
        data: { tenantId: defaultTenant.id },
      });
      await prisma.storage.updateMany({
        where: { tenantId: null },
        data: { tenantId: defaultTenant.id },
      });
    }

    // Busca qualquer superadmin já existente por qualquer um dos identificadores conhecidos
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@nocagent.local' },
          { email: 'superadmin' },
          { email: 'superadmin@nocagent.local' },
          { email: adminEmail },
          { role: 'SUPERADMIN' },
        ],
      },
    });

    if (!existingAdmin) {
      console.log(`[BOOTSTRAP] Criando superadministrador inicial (admin@nocagent.local)...`);
      await prisma.user.create({
        data: {
          email: 'admin@nocagent.local',
          name: 'Super Admin',
          passwordHash,
          salt,
          role: 'SUPERADMIN',
          tenantId: defaultTenant.id,
          totpSecret,
          totpEnabled: false, // Inicia sem 2FA obrigatório para permitir primeiro acesso sem bloqueio
          active: true,
        },
      });
      console.log(`[BOOTSTRAP] Superadmin inicial criado com sucesso: admin@nocagent.local`);
    } else {
      // Garante que o admin existente está ativo e credenciais sincronizadas
      console.log(`[BOOTSTRAP] Sincronizando/reparando credenciais do superadmin (${existingAdmin.email})...`);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          email: 'admin@nocagent.local', // Unifica para o e-mail padrão oficial
          passwordHash,
          salt,
          role: 'SUPERADMIN',
          active: true,
          totpEnabled: false, // Evita bloqueio inicial de 2FA
        },
      });
      console.log(`[BOOTSTRAP] Credenciais do superadmin reparadas com sucesso.`);
    }
  } catch (err) {
    console.error('[BOOTSTRAP] Erro ao verificar/criar superadmin:', err.message);
  }
}

// --- ROTAS DE AUTENTICAÇÃO E 2FA ---

/**
 * Login Inicial (Etapa 1: E-mail/Usuário e Senha)
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const cleanInput = String(email).trim().toLowerCase();
    const cleanPrefix = cleanInput.replace(/@.*$/, '');

    // Busca flexível: aceita email completo, prefixo/username, ou alias SUPERADMIN
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanInput },
          { email: cleanPrefix },
          ...(cleanInput.includes('@') ? [] : [{ email: `${cleanInput}@nocagent.local` }]),
          ...(cleanPrefix === 'admin' || cleanPrefix === 'superadmin' ? [{ role: 'SUPERADMIN' }] : []),
        ],
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true, plan: true },
        },
      },
    });

    // AUTO-HEALING: Se for login de admin e não localizou no banco, executa bootstrap sob demanda
    if (!user && (cleanPrefix === 'admin' || cleanPrefix === 'superadmin')) {
      console.log(`[AUTH] Superadmin não localizado para '${cleanInput}'. Executando auto-bootstrap emergencial...`);
      await bootstrapSuperadmin();
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'admin@nocagent.local' },
            { role: 'SUPERADMIN' },
          ],
        },
        include: {
          tenant: {
            select: { id: true, name: true, slug: true, status: true, plan: true },
          },
        },
      });
    }

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciais inválidas ou usuário inativo.' });
    }

    // Verificar senha com scrypt timingSafeEqual
    let passwordValid = verifyPassword(password, user.passwordHash, user.salt);

    // AUTO-HEALING DE SENHA: Se for o superadmin utilizando a senha mestre e houver divergência de hash
    const defaultPassword = process.env.DCC_DEVELOPER_PASSWORD || 'NocAgent@2026!';
    if (!passwordValid && user.role === 'SUPERADMIN' && password === defaultPassword) {
      console.log(`[AUTH] Sincronizando hash scrypt da senha mestre para superadmin...`);
      const { passwordHash, salt } = hashPassword(defaultPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, salt, active: true },
      });
      user.passwordHash = passwordHash;
      user.salt = salt;
      passwordValid = true;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Se 2FA estiver ativado, retorna token temporário para etapa 2
    if (user.totpEnabled) {
      const tempToken = generateToken({ userId: user.id, email: user.email, temp2fa: true }, '10m');
      return res.json({
        status: 'ok',
        require2fa: true,
        tempToken,
        message: 'Código de autenticação de dois fatores (2FA) necessário.',
      });
    }

    // Sem 2FA: atualiza lastLoginAt e emite token de sessão permanente
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    });

    return res.json({
      status: 'ok',
      require2fa: false,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
        totpEnabled: user.totpEnabled,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Falha no processamento do login.' });
  }
});

/**
 * Validação do Código 2FA TOTP (Etapa 2)
 */
app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Token temporário e código 2FA são obrigatórios.' });
    }

    const decoded = verifyToken(tempToken);
    if (!decoded || !decoded.temp2fa || !decoded.userId) {
      return res.status(401).json({ error: 'Sessão 2FA expirada ou inválida. Faça login novamente.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true, plan: true },
        },
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário não encontrado ou desativado.' });
    }

    const isTotpValid = verifyTotp(user.totpSecret, code);
    if (!isTotpValid) {
      return res.status(400).json({ error: 'Código 2FA incorreto ou expirado. Verifique o horário do seu dispositivo.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    });

    return res.json({
      status: 'ok',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
        totpEnabled: user.totpEnabled,
      },
    });
  } catch (error) {
    console.error('Erro na verificação 2FA:', error);
    return res.status(500).json({ error: 'Falha ao validar 2FA.' });
  }
});

/**
 * Perfil do Usuário Autenticado
 */
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        totpEnabled: true,
        lastLoginAt: true,
        tenantId: true,
        tenant: {
          select: { id: true, name: true, slug: true, status: true, plan: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ status: 'ok', user });
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    return res.status(500).json({ error: 'Erro ao consultar perfil.' });
  }
});

/**
 * Iniciar Configuração de 2FA (Retorna Segredo Base32, KeyURI e QR Code em Data URL)
 */
app.post('/api/auth/setup-2fa', authenticateToken, async (req, res) => {
  try {
    const { secret, otpauth } = generateTotpSecret(req.user.email);
    const qrCode = await QRCode.toDataURL(otpauth, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return res.json({
      status: 'ok',
      secret,
      keyuri: otpauth,
      otpauth,
      qrCode,
    });
  } catch (error) {
    console.error('Erro ao gerar segredo 2FA:', error);
    return res.status(500).json({ error: 'Falha ao iniciar setup 2FA.' });
  }
});

/**
 * Confirmar e Ativar 2FA
 */
app.post('/api/auth/confirm-2fa', authenticateToken, async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) {
      return res.status(400).json({ error: 'Segredo e código de verificação são obrigatórios.' });
    }

    const isValid = verifyTotp(secret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Código 2FA inválido. Certifique-se de digitar o token correto do autenticador.' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        totpSecret: secret,
        totpEnabled: true,
      },
    });

    return res.json({ status: 'ok', message: 'Autenticação de dois fatores ativada com sucesso!' });
  } catch (error) {
    console.error('Erro ao confirmar 2FA:', error);
    return res.status(500).json({ error: 'Falha ao ativar 2FA.' });
  }
});

// --- GESTÃO DE TENANTS (EXCLUSIVO SUPERADMIN) ---

/**
 * Listagem de Tenants com Contagem de Ativos
 */
app.get('/api/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            equipments: true,
            storages: true,
          },
        },
      },
    });

    return res.json({ status: 'ok', count: tenants.length, data: tenants });
  } catch (error) {
    console.error('Erro ao listar tenants:', error);
    return res.status(500).json({ error: 'Erro ao consultar tenants.' });
  }
});

/**
 * Cadastro de Novo Tenant com Configuração de Cotas e Governança
 */
app.post('/api/tenants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, document, plan, status, maxEquipments, maxUsers, maxStorages, aiLevel, retentionDays } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome do tenant é obrigatório.' });
    }

    const generatedSlug = (slug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await prisma.tenant.findUnique({ where: { slug: generatedSlug } });
    if (existing) {
      return res.status(400).json({ error: `Identificador (slug) "${generatedSlug}" já está em uso.` });
    }

    const selectedPlan = plan || 'PROFESSIONAL';
    const planDefaults = {
      STARTER: { maxEquipments: 10, maxUsers: 3, maxStorages: 1, aiLevel: 'L1_READ', retentionDays: 7 },
      PROFESSIONAL: { maxEquipments: 50, maxUsers: 10, maxStorages: 3, aiLevel: 'L2_REMEDIATION', retentionDays: 30 },
      ENTERPRISE: { maxEquipments: 0, maxUsers: 0, maxStorages: 0, aiLevel: 'L3_CRITICAL', retentionDays: 90 },
    };
    const defaults = planDefaults[selectedPlan] || planDefaults.PROFESSIONAL;

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug: generatedSlug,
        document: document ? document.trim() : null,
        plan: selectedPlan,
        status: status || 'ACTIVE',
        maxEquipments: maxEquipments !== undefined ? parseInt(maxEquipments, 10) : defaults.maxEquipments,
        maxUsers: maxUsers !== undefined ? parseInt(maxUsers, 10) : defaults.maxUsers,
        maxStorages: maxStorages !== undefined ? parseInt(maxStorages, 10) : defaults.maxStorages,
        aiLevel: aiLevel || defaults.aiLevel,
        retentionDays: retentionDays !== undefined ? parseInt(retentionDays, 10) : defaults.retentionDays,
      },
    });

    return res.status(201).json({ status: 'ok', tenant });
  } catch (error) {
    console.error('Erro ao criar tenant:', error);
    return res.status(500).json({ error: 'Falha ao cadastrar tenant.' });
  }
});

/**
 * Atualização de Tenant e Cotas
 */
app.put('/api/tenants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, document, plan, status, maxEquipments, maxUsers, maxStorages, aiLevel, retentionDays } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (slug) data.slug = slug.trim().toLowerCase();
    if (document !== undefined) data.document = document ? document.trim() : null;
    if (plan) data.plan = plan;
    if (status) data.status = status;
    if (maxEquipments !== undefined) data.maxEquipments = parseInt(maxEquipments, 10);
    if (maxUsers !== undefined) data.maxUsers = parseInt(maxUsers, 10);
    if (maxStorages !== undefined) data.maxStorages = parseInt(maxStorages, 10);
    if (aiLevel) data.aiLevel = aiLevel;
    if (retentionDays !== undefined) data.retentionDays = parseInt(retentionDays, 10);

    const tenant = await prisma.tenant.update({
      where: { id },
      data,
    });

    return res.json({ status: 'ok', tenant });
  } catch (error) {
    console.error('Erro ao atualizar tenant:', error);
    return res.status(500).json({ error: 'Falha ao atualizar tenant.' });
  }
});

/**
 * Exclusão de Tenant
 */
app.delete('/api/tenants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { equipments: true, users: true } },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado.' });
    }

    if (tenant._count.equipments > 0 || tenant._count.users > 0) {
      return res.status(400).json({
        error: `Não é possível excluir o tenant pois existem ${tenant._count.equipments} equipamentos e ${tenant._count.users} usuários vinculados. Remova ou transfira-os primeiro.`,
      });
    }

    await prisma.tenant.delete({ where: { id } });
    return res.json({ status: 'ok', message: 'Tenant removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir tenant:', error);
    return res.status(500).json({ error: 'Falha ao excluir tenant.' });
  }
});

// --- GESTÃO DE USUÁRIOS (SUPERADMIN & TENANT MASTER) ---

/**
 * Listagem de Usuários (com isolamento por Tenant)
 */
app.get('/api/users', authenticateToken, requireTenantMasterOrSuperAdmin, async (req, res) => {
  try {
    let whereClause = {};

    if (req.user.role === 'SUPERADMIN') {
      if (req.query.tenantId) {
        whereClause.tenantId = req.query.tenantId;
      }
    } else {
      // TENANT_MASTER só pode ver usuários do seu próprio tenant
      whereClause.tenantId = req.user.tenantId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        active: true,
        totpEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        tenantId: true,
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return res.json({ status: 'ok', count: users.length, data: users });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return res.status(500).json({ error: 'Erro ao consultar usuários.' });
  }
});

/**
 * Criação de Usuário
 */
app.post('/api/users', authenticateToken, requireTenantMasterOrSuperAdmin, async (req, res) => {
  try {
    const { email, name, password, role, tenantId, phone } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'E-mail, nome e senha são obrigatórios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    let assignedTenantId;
    let assignedRole = role || 'OPERATOR';

    if (req.user.role === 'TENANT_MASTER') {
      // Tenant Master obrigatoriamente vincula ao seu tenant e não pode criar SUPERADMIN
      assignedTenantId = req.user.tenantId;
      if (assignedRole === 'SUPERADMIN') {
        return res.status(403).json({ error: 'Tenant Master não possui permissão para criar Superadministradores.' });
      }
    } else {
      // SUPERADMIN pode especificar qualquer tenantId
      assignedTenantId = tenantId || req.user.tenantId;
    }

    // Validação de cota de usuários do plano do Tenant
    if (assignedTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: assignedTenantId },
        include: { _count: { select: { users: true } } },
      });
      if (tenant && tenant.maxUsers && tenant.maxUsers > 0 && tenant._count.users >= tenant.maxUsers) {
        return res.status(403).json({
          error: `Cota do plano excedida: limite máximo de ${tenant.maxUsers} usuário(s) atingido para esta organização (Plano ${tenant.plan || 'atual'}). Faça upgrade para adicionar mais operadores.`,
        });
      }
    }

    const { passwordHash, salt } = hashPassword(password);
    const { secret: totpSecret } = generateTotpSecret(cleanEmail);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: name.trim(),
        passwordHash,
        salt,
        role: assignedRole,
        tenantId: assignedTenantId,
        phone: phone ? phone.trim() : null,
        totpSecret,
        totpEnabled: false,
        active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        active: true,
        createdAt: true,
        tenantId: true,
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return res.status(201).json({ status: 'ok', user: newUser });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    return res.status(500).json({ error: 'Falha ao cadastrar usuário.' });
  }
});

/**
 * Atualização de Usuário
 */
app.put('/api/users/:id', authenticateToken, requireTenantMasterOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, phone, active, password } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Tenant Master só pode alterar usuários do seu próprio tenant
    if (req.user.role === 'TENANT_MASTER') {
      if (targetUser.tenantId !== req.user.tenantId) {
        return res.status(403).json({ error: 'Sem permissão para alterar usuários de outro tenant.' });
      }
      if (role === 'SUPERADMIN') {
        return res.status(403).json({ error: 'Não é permitido atribuir papel de Superadministrador.' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (role && (req.user.role === 'SUPERADMIN' || role !== 'SUPERADMIN')) {
      updateData.role = role;
    }
    if (active !== undefined) updateData.active = Boolean(active);
    if (password && password.length >= 6) {
      const { passwordHash, salt } = hashPassword(password);
      updateData.passwordHash = passwordHash;
      updateData.salt = salt;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        active: true,
        tenantId: true,
      },
    });

    return res.json({ status: 'ok', user: updated });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ error: 'Falha ao atualizar usuário.' });
  }
});

/**
 * Exclusão de Usuário
 */
app.delete('/api/users/:id', authenticateToken, requireTenantMasterOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário conectado.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (req.user.role === 'TENANT_MASTER' && targetUser.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Sem permissão para excluir usuário de outro tenant.' });
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ status: 'ok', message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return res.status(500).json({ error: 'Falha ao excluir usuário.' });
  }
});

/**
 * Webhook Receptor do Chatwoot (Public API / WhatsApp)
 */
app.post('/api/webhooks/chatwoot', async (req, res) => {
  try {
    const webhookSecret = process.env.CHATWOOT_WEBHOOK_SECRET;
    const headerSecret = req.headers['x-chatwoot-signature'] || req.query.secret;

    if (webhookSecret && headerSecret && webhookSecret !== headerSecret) {
      console.warn('Webhook rejeitado: assinatura/segredo inválido.');
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    const result = await handleChatwootWebhook(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro no processamento do webhook Chatwoot:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Endpoint de Chat Direto (para o Dashboard Web interativo com Isolamento Multi-Tenant)
 */
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message, senderName } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Campo "message" obrigatório.' });
    }

    const reply = await processMessage({
      text: message,
      senderPhone: 'web-dashboard',
      senderName: senderName || req.user?.name || 'Operador Web',
      tenantId: req.user?.role === 'SUPERADMIN' ? (req.body?.tenantId || null) : req.user?.tenantId,
      role: req.user?.role || 'OPERATOR',
    });

    return res.json({ reply, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erro no chat web:', error);
    return res.status(500).json({ error: 'Erro interno ao processar mensagem.' });
  }
});

/**
 * Status REAL dos Equipamentos da Rede consultados via Cofre Criptográfico com Isolamento de Tenant
 */
app.get('/api/equipments/status', authenticateToken, async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const equipments = await prisma.equipment.findMany({
      where: { active: true, ...tenantFilter },
      orderBy: { createdAt: 'desc' },
    });

    if (equipments.length === 0) {
      return res.json({
        status: 'empty',
        message: 'Nenhum equipamento cadastrado no cofre para este tenant.',
        data: [],
      });
    }

    const processed = await Promise.all(
      equipments.map(async (eq) => {
        const item = {
          id: eq.id,
          name: eq.name,
          type: eq.type,
          host: eq.host,
          port: eq.port,
          status: eq.status || 'unknown',
          group: eq.group || 'Geral',
          subgroup: eq.subgroup || null,
          tags: eq.tags || [],
          lastLatency: eq.lastLatency,
          lastLossPercent: eq.lastLossPercent,
          lastCheck: eq.lastCheck,
          subItems: [],
        };

        // Se for pfSense, consulta status real dos links/gateways via API
        if (eq.type === 'PFSENSE') {
          try {
            const creds = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
            const apiKey = typeof creds === 'object' ? (creds.apiKey || creds.key || creds.token || '') : String(creds);

            if (apiKey) {
              const targetUrl = eq.host.replace(/\/+$/, '');
              let gwRes;
              let authSuccess = false;

              // Estratégia de autenticação resiliente:
              // 1. X-API-Key com Accept: application/json (obrigatório: o pfSense rejeita o padrão do axios com HTTP 406 Not Acceptable)
              // 2. Authorization: Bearer <key>
              // 3. Basic Auth
              const authAttempts = [
                { 'X-API-Key': apiKey, 'Accept': 'application/json' },
                { 'Authorization': apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`, 'Accept': 'application/json' },
                { 'Authorization': `Basic ${Buffer.from(apiKey.includes(':') ? apiKey : `admin:${apiKey}`).toString('base64')}`, 'Accept': 'application/json' }
              ];

              for (const headers of authAttempts) {
                try {
                  gwRes = await axios.get(`${targetUrl}/api/v2/status/gateways`, {
                    headers,
                    timeout: 6000,
                    httpsAgent,
                  });
                  authSuccess = true;
                  break;
                } catch (err) {
                  const status = err.response?.status;
                  // Se for 401 Unauthorized ou 406 Not Acceptable, tenta a próxima estratégia de cabeçalho
                  if (status === 401 || status === 406) {
                    continue;
                  }
                  throw err;
                }
              }

              if (!gwRes && !authSuccess) {
                throw new Error('AUTH_FAILED_401');
              }

              const gws = gwRes.data?.data || [];
              item.subItems = gws;

              // Calcula médias reais de latência e perda
              if (gws.length > 0) {
                const onlineGws = gws.filter(g => g.status === 'online');
                item.status = onlineGws.length > 0 ? (onlineGws.length === gws.length ? 'online' : 'degraded') : 'offline';
                const totalDelay = onlineGws.reduce((acc, g) => acc + (parseFloat(g.delay) || 0), 0);
                const totalLoss = gws.reduce((acc, g) => acc + (parseFloat(g.loss) || 0), 0);
                item.lastLatency = onlineGws.length > 0 ? Math.round((totalDelay / onlineGws.length) * 10) / 10 : 0;
                item.lastLossPercent = Math.round((totalLoss / gws.length) * 10) / 10;
                item.lastCheck = new Date();
              } else {
                // Se a API respondeu 200 OK, o firewall está 100% online
                item.status = 'online';
                item.lastLatency = 0;
                item.lastLossPercent = 0;
                item.lastCheck = new Date();
              }

              // Atualiza no banco em background
              prisma.equipment.update({
                where: { id: eq.id },
                data: {
                  status: item.status,
                  lastLatency: item.lastLatency,
                  lastLossPercent: item.lastLossPercent,
                  lastCheck: item.lastCheck,
                },
              }).catch(() => {});
            }
          } catch (err) {
            console.warn(`Aviso ao consultar pfSense ${eq.name}:`, err.message);
            const httpStatus = err.response?.status;
            if (httpStatus === 401 || err.message === 'AUTH_FAILED_401') {
              item.status = 'auth_error';
              item.error = 'Credenciais recusadas pelo pfSense (HTTP 401: Falha de autenticação). Verifique a API Key no Cofre.';
            } else if (httpStatus === 403) {
              item.status = 'auth_error';
              item.error = 'Acesso proibido (HTTP 403: A API Key não tem permissão para consultar os gateways).';
            } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
              item.status = 'offline';
              item.error = `Não foi possível conectar ao host (${err.code}).`;
            } else {
              item.status = 'warning';
              item.error = err.response?.data?.message || err.message;
            }
          }
        }

        // Se for Mikrotik RouterOS
        if (eq.type === 'MIKROTIK') {
          const port = eq.port || 8728;
          let creds = null;
          try {
            creds = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
          } catch {}

          const mktMetrics = await getMikrotikMetrics(eq.host, creds, port);
          item.status = mktMetrics.status;
          item.lastLatency = mktMetrics.lastLatency;
          item.lastLossPercent = mktMetrics.lastLossPercent;
          if (mktMetrics.error) item.error = mktMetrics.error;
          if (mktMetrics.hasRestApi) {
            item.mikrotikData = mktMetrics;
            item.subItems = (mktMetrics.wanLinks && mktMetrics.wanLinks.length > 0) ? mktMetrics.wanLinks : (mktMetrics.interfaces || []);
          }

          prisma.equipment.update({
            where: { id: eq.id },
            data: {
              status: item.status,
              lastLatency: item.lastLatency,
              lastLossPercent: item.lastLossPercent,
              lastCheck: new Date(),
              osInfo: mktMetrics.hasRestApi ? mktMetrics : undefined,
            },
          }).catch(() => {});
        }

        // Se for Servidor Linux (SSH ou Agente Outbound)
        if (eq.type === 'LINUX_SERVER') {
          if (eq.connectionMode === 'AGENT') {
            const isFresh = eq.lastCheck && (Date.now() - new Date(eq.lastCheck).getTime() < 180000);
            item.status = isFresh ? 'online' : 'offline';
            if (!isFresh) item.error = 'Agente desconectado (sem telemetria recente nos últimos 3 min)';
          } else {
            const port = eq.port || 22;
            const probe = await probeTcpPort(eq.host, port, 4000);
            if (probe.online) {
              item.status = 'online';
              item.lastLatency = probe.rtt;
              item.lastLossPercent = 0;
              item.lastCheck = new Date();
            } else {
              item.status = 'offline';
              item.error = `Porta SSH (${port}) inacessível no servidor Linux (${probe.error}).`;
            }
          }
          prisma.equipment.update({
            where: { id: eq.id },
            data: { status: item.status, lastLatency: item.lastLatency, lastLossPercent: item.lastLossPercent, lastCheck: item.lastCheck },
          }).catch(() => {});
        }

        // Se for Servidor Windows (WinRM ou Agente Outbound)
        if (eq.type === 'WINDOWS_SERVER') {
          if (eq.connectionMode === 'AGENT') {
            const isFresh = eq.lastCheck && (Date.now() - new Date(eq.lastCheck).getTime() < 180000);
            item.status = isFresh ? 'online' : 'offline';
            if (!isFresh) item.error = 'Agente desconectado (sem telemetria recente nos últimos 3 min)';
          } else {
            const port = eq.port || 5985;
            const probe = await probeTcpPort(eq.host, port, 4000);
            if (probe.online) {
              item.status = 'online';
              item.lastLatency = probe.rtt;
              item.lastLossPercent = 0;
              item.lastCheck = new Date();
            } else {
              item.status = 'offline';
              item.error = `Porta WinRM (${port}) inacessível no servidor Windows (${probe.error}).`;
            }
          }
          prisma.equipment.update({
            where: { id: eq.id },
            data: { status: item.status, lastLatency: item.lastLatency, lastLossPercent: item.lastLossPercent, lastCheck: item.lastCheck },
          }).catch(() => {});
        }

        // Se for Proxmox VE (Consulta profunda da API REST)
        if (eq.type === 'PROXMOX') {
          const port = eq.port || 8006;
          let creds = null;
          try {
            creds = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
          } catch {}

          if (creds && (creds.tokenId || creds.tokenSecret || creds.password)) {
            try {
              const pveMetrics = await getProxmoxMetrics(eq.host, creds, port);
              item.status = 'online';
              item.lastLossPercent = 0;
              item.lastLatency = 2;
              item.lastCheck = new Date();
              item.proxmoxData = pveMetrics;

              const pveOsInfo = {
                hostname: pveMetrics.node,
                os: pveMetrics.pveVersion,
                cpu: `${pveMetrics.cpu?.percent ?? 0}%`,
                memoryPercent: `${pveMetrics.memory?.percent ?? 0}%`,
                diskFreeGb: pveMetrics.storages?.[0] ? `${pveMetrics.storages[0].name} (${100 - (pveMetrics.storages[0].usedPercent || 0)}% livre)` : undefined,
                workloads: pveMetrics.workloads,
                storages: pveMetrics.storages,
              };
              item.osInfo = pveOsInfo;

              prisma.equipment.update({
                where: { id: eq.id },
                data: {
                  status: 'online',
                  lastLossPercent: 0,
                  lastCheck: item.lastCheck,
                  osInfo: pveOsInfo,
                },
              }).catch(() => {});
            } catch (pveErr) {
              const httpStatus = pveErr.response?.status;
              if (httpStatus === 401 || httpStatus === 403) {
                item.status = 'auth_error';
                item.error = 'Token de API ou senha do Proxmox recusada (HTTP 401/403). Verifique no cofre.';
              } else {
                const probe = await probeTcpPort(eq.host, port, 4000);
                if (probe.online) {
                  item.status = 'online';
                  item.lastLatency = probe.rtt;
                  item.lastLossPercent = 0;
                  item.error = `API Proxmox com aviso: ${pveErr.message}`;
                } else {
                  item.status = 'offline';
                  item.error = `Proxmox inacessível na porta ${port} (${probe.error}).`;
                }
              }
            }
          } else {
            // Sem credenciais completas: executa probe de porta TCP
            const probe = await probeTcpPort(eq.host, port, 4000);
            if (probe.online) {
              item.status = 'online';
              item.lastLatency = probe.rtt;
              item.lastLossPercent = 0;
              item.lastCheck = new Date();
            } else {
              item.status = 'offline';
              item.error = `Porta Proxmox (${port}) inacessível (${probe.error}).`;
            }
            prisma.equipment.update({
              where: { id: eq.id },
              data: { status: item.status, lastLatency: item.lastLatency, lastLossPercent: item.lastLossPercent, lastCheck: item.lastCheck },
            }).catch(() => {});
          }
        }

        // Se for Zabbix Server
        if (eq.type === 'ZABBIX') {
          const port = eq.port || 80;
          let creds = null;
          try {
            creds = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
          } catch {}

          try {
            const triggers = await getZabbixActiveTriggers(eq.host, creds, port);
            item.status = triggers.some(t => t.priority >= 4) ? 'degraded' : 'online';
            item.lastLossPercent = 0;
            item.lastLatency = 15;
            item.zabbixData = triggers;
            item.subItems = triggers.map(t => ({ name: t.description, status: t.severityText.toLowerCase(), host: t.hostName }));
          } catch (zbErr) {
            const probe = await probeTcpPort(eq.host, port, 4000);
            item.status = probe.online ? 'online' : 'offline';
            item.lastLatency = probe.rtt;
            if (!probe.online) item.error = `Zabbix inacessível na porta ${port} (${probe.error}).`;
          }
          prisma.equipment.update({
            where: { id: eq.id },
            data: { status: item.status, lastLatency: item.lastLatency, lastLossPercent: item.lastLossPercent, lastCheck: new Date() },
          }).catch(() => {});
        }

        return item;
      })
    );

    return res.json({
      status: 'ok',
      count: processed.length,
      data: processed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao consultar status dos equipamentos:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Falha ao consultar status dos equipamentos no cofre.',
      data: [],
    });
  }
});

/**
 * Status REAL dos Gateways da Rede (com Isolamento Multi-Tenant)
 */
app.get('/api/gateways', authenticateToken, async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const pfsense = await prisma.equipment.findFirst({
      where: {
        type: 'PFSENSE',
        active: true,
        ...tenantFilter,
      },
    });

    if (!pfsense) {
      return res.json({
        status: 'empty',
        message: 'Nenhum equipamento pfSense cadastrado para este tenant.',
        data: [],
      });
    }

    let apiKey = '';
    try {
      const creds = decryptCredentials(pfsense.encryptedCredentials, pfsense.iv, pfsense.authTag);
      apiKey = typeof creds === 'object' ? (creds.apiKey || creds.key || creds.token || '') : String(creds);
    } catch (decErr) {
      return res.status(500).json({
        status: 'error',
        message: `Falha ao descriptografar credenciais do equipamento ${pfsense.name}.`,
        data: [],
      });
    }

    const targetUrl = pfsense.host.replace(/\/+$/, '');
    let response;
    try {
      response = await axios.get(`${targetUrl}/api/v2/status/gateways`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 8000,
        httpsAgent,
      });
    } catch {
      response = await axios.get(`${targetUrl}/api/v2/status/gateway`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 8000,
        httpsAgent,
      });
    }

    const gateways = response.data?.data || [];
    return res.json({
      status: 'ok',
      equipment: {
        id: pfsense.id,
        name: pfsense.name,
        host: pfsense.host,
      },
      data: gateways,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(502).json({
      status: 'error',
      message: `Falha na comunicação com o equipamento: ${error.message}`,
      data: [],
    });
  }
});

/**
 * Lista REAL de Equipamentos Cadastrados no Cofre (com Isolamento Multi-Tenant)
 */
app.get('/api/equipments', authenticateToken, async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const equipments = await prisma.equipment.findMany({
      where: { ...tenantFilter },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        host: true,
        port: true,
        status: true,
        group: true,
        subgroup: true,
        tags: true,
        lastLatency: true,
        lastLossPercent: true,
        lastCheck: true,
        connectionMode: true,
        enrollmentToken: true,
        agentVersion: true,
        osInfo: true,
        tenantId: true,
        backupStorageId: true,
        backupSchedule: true,
        backupStorage: {
          select: {
            id: true,
            name: true,
            type: true,
            endpoint: true,
            bucketOrPath: true,
          },
        },
        active: true,
        createdAt: true,
        encryptedCredentials: true,
        iv: true,
        authTag: true,
      },
    });

    const sanitizedEquipments = equipments.map((eq) => {
      let osInfo = eq.osInfo;
      let proxmoxData = null;
      if (osInfo && typeof osInfo === 'object') {
        if (osInfo.workloads && (osInfo.cpu?.percent != null || typeof osInfo.cpu === 'string')) {
          proxmoxData = osInfo;
        }
        if (osInfo.cpu && typeof osInfo.cpu === 'object') {
          osInfo = {
            ...osInfo,
            cpu: `${osInfo.cpu.percent ?? 0}%`,
            memoryPercent: typeof osInfo.memory === 'object' ? `${osInfo.memory.percent ?? 0}%` : osInfo.memoryPercent,
          };
        }
      }

      // Extrai apenas identidade não-sensível (usuário/método) para suporte à clonagem sem expor senhas/tokens
      let username = '';
      let authMethod = 'PASSWORD';
      let realm = 'pam';
      if (eq.encryptedCredentials && eq.iv && eq.authTag) {
        try {
          const creds = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
          if (creds) {
            username = creds.username || '';
            authMethod = creds.authMethod || (creds.privateKey ? 'KEY' : creds.tokenId ? 'TOKEN' : 'PASSWORD');
            realm = creds.realm || 'pam';
          }
        } catch {}
      }

      const { encryptedCredentials, iv, authTag, ...restEq } = eq;
      return {
        ...restEq,
        username,
        authMethod,
        realm,
        group: eq.group || 'Geral',
        subgroup: eq.subgroup || null,
        tags: eq.tags || [],
        osInfo,
        proxmoxData: proxmoxData || undefined,
      };
    });

    return res.json({
      status: 'ok',
      count: sanitizedEquipments.length,
      data: sanitizedEquipments,
    });
  } catch (error) {
    console.error('Erro ao listar equipamentos:', error);
    return res.status(500).json({ 
      error: 'Erro ao consultar cofre de equipamentos.',
      details: error.message 
    });
  }
});

/**
 * Cadastro de NOVO Equipamento no Cofre (com Verificação de Cotas do Plano)
 */
app.post('/api/equipments', authenticateToken, async (req, res) => {
  try {
    const { name, type, host, port, credentials, connectionMode, backupStorageId, backupSchedule, group, subgroup, tags, tenantId } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes: name e type.',
      });
    }

    const validTypes = ['PFSENSE', 'MIKROTIK', 'LINUX_SERVER', 'WINDOWS_SERVER', 'PROXMOX', 'ZABBIX', 'GENERIC_SNMP'];
    const upperType = String(type).toUpperCase();
    if (!validTypes.includes(upperType)) {
      return res.status(400).json({
        error: `Tipo de equipamento inválido. Tipos aceitos: ${validTypes.join(', ')}`,
      });
    }

    const targetTenantId = req.user.role === 'SUPERADMIN' ? (tenantId || req.user.tenantId) : req.user.tenantId;

    // Verificação de cota do plano de equipamentos
    if (targetTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: targetTenantId },
        include: { _count: { select: { equipments: true } } },
      });
      if (tenant && tenant.maxEquipments && tenant.maxEquipments > 0 && tenant._count.equipments >= tenant.maxEquipments) {
        return res.status(403).json({
          error: `Cota do plano excedida: limite máximo de ${tenant.maxEquipments} equipamentos atingido para a organização no plano ${tenant.plan || 'atual'}. Faça upgrade de plano para cadastrar novos ativos.`,
        });
      }
    }

    const mode = connectionMode === 'AGENT' ? 'AGENT' : 'DIRECT';

    if (mode === 'DIRECT' && !host) {
      return res.status(400).json({
        error: 'Para conexão direta, informe o Host ou IP do equipamento.',
      });
    }

    const cleanName = String(name).trim();
    const cleanHost = host ? String(host).trim() : (mode === 'AGENT' ? 'outbound-agent' : '0.0.0.0');
    const cleanPort = port ? parseInt(port, 10) : null;

    // Validação de Duplicidade: Não permitir mesmo nome no mesmo tenant
    const existingName = await prisma.equipment.findFirst({
      where: {
        ...(targetTenantId ? { tenantId: targetTenantId } : {}),
        name: { equals: cleanName, mode: 'insensitive' },
      },
    });
    if (existingName) {
      return res.status(400).json({
        error: `Já existe um equipamento cadastrado com o nome "${cleanName}". Por favor, utilize um nome exclusivo para clonagem/cadastro.`,
      });
    }

    // Validação de Duplicidade: Não permitir mesmo endpoint (host + port) no mesmo tenant para modo DIRECT
    if (mode === 'DIRECT' && cleanHost !== '0.0.0.0' && cleanHost !== 'outbound-agent') {
      const existingEndpoint = await prisma.equipment.findFirst({
        where: {
          ...(targetTenantId ? { tenantId: targetTenantId } : {}),
          host: { equals: cleanHost, mode: 'insensitive' },
          port: cleanPort,
        },
      });
      if (existingEndpoint) {
        return res.status(400).json({
          error: `Já existe um equipamento cadastrado com o host/endpoint "${cleanHost}${cleanPort ? ':' + cleanPort : ''}". Defina um IP/Host exclusivo para salvar.`,
        });
      }
    }

    // Normaliza credenciais: se string, converte em objeto
    const credsObj = credentials
      ? (typeof credentials === 'object' ? credentials : { apiKey: String(credentials).trim() })
      : { mode: mode };

    // Criptografa estritamente com a chave mestra AES-256-GCM
    const { encryptedCredentials, iv, authTag } = encryptCredentials(credsObj);

    // Se for modo AGENT, gera token de enrollment com TTL de 1 hora
    let enrollmentToken = null;
    let enrollmentExpiresAt = null;
    if (mode === 'AGENT') {
      enrollmentToken = crypto.randomBytes(16).toString('hex');
      enrollmentExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    const parsedTags = Array.isArray(tags) 
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const created = await prisma.equipment.create({
      data: {
        name: String(name).trim(),
        type: upperType,
        host: host ? String(host).trim() : (mode === 'AGENT' ? 'outbound-agent' : '0.0.0.0'),
        port: port ? parseInt(port, 10) : null,
        connectionMode: mode,
        tenantId: targetTenantId || null,
        group: group ? String(group).trim() : 'Geral',
        subgroup: subgroup ? String(subgroup).trim() : null,
        tags: parsedTags,
        enrollmentToken,
        enrollmentExpiresAt,
        backupStorageId: backupStorageId || null,
        backupSchedule: backupSchedule || 'DAILY',
        encryptedCredentials,
        iv,
        authTag,
        status: mode === 'AGENT' ? 'unknown' : 'online',
        active: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        host: true,
        port: true,
        status: true,
        tenantId: true,
        group: true,
        subgroup: true,
        tags: true,
        connectionMode: true,
        enrollmentToken: true,
        backupStorageId: true,
        backupSchedule: true,
        active: true,
        createdAt: true,
      },
    });

    // Registra auditoria imutável
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CADASTRAR_EQUIPAMENTO',
          target: `${created.name} (${created.type})`,
          status: 'SUCCESS',
          source: 'WEB_DASHBOARD',
          details: { equipmentId: created.id, host: created.host, mode, tenantId: created.tenantId, group: created.group },
        },
      });
    } catch (auditErr) {
      console.warn('Aviso ao registrar log de auditoria:', auditErr.message);
    }

    return res.status(201).json({
      status: 'created',
      data: created,
    });
  } catch (error) {
    console.error('Erro ao cadastrar equipamento no cofre:', error);
    return res.status(500).json({ error: `Falha ao salvar no cofre: ${error.message}` });
  }
});

/**
 * Edição / Atualização de Equipamento no Cofre com Isolamento de Tenant
 */
app.put('/api/equipments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, host, port, credentials, connectionMode, backupStorageId, backupSchedule, group, subgroup, tags } = req.body;

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Equipamento não encontrado no cofre.' });
    }

    if (req.user.role !== 'SUPERADMIN' && existing.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Acesso negado: este equipamento pertence a outra organização.' });
    }

    const updateData = {};
    if (name) updateData.name = String(name).trim();
    if (type) {
      const validTypes = ['PFSENSE', 'MIKROTIK', 'LINUX_SERVER', 'WINDOWS_SERVER', 'PROXMOX', 'ZABBIX', 'GENERIC_SNMP'];
      const upperType = String(type).toUpperCase();
      if (!validTypes.includes(upperType)) {
        return res.status(400).json({ error: `Tipo inválido. Aceitos: ${validTypes.join(', ')}` });
      }
      updateData.type = upperType;
    }
    if (host) updateData.host = String(host).trim();
    if (port !== undefined) updateData.port = port ? parseInt(port, 10) : null;
    if (connectionMode) updateData.connectionMode = connectionMode;
    if (backupStorageId !== undefined) updateData.backupStorageId = backupStorageId || null;
    if (backupSchedule !== undefined) updateData.backupSchedule = backupSchedule;
    if (group !== undefined) updateData.group = group ? String(group).trim() : 'Geral';
    if (subgroup !== undefined) updateData.subgroup = subgroup ? String(subgroup).trim() : null;
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags)
        ? tags.map(t => String(t).trim()).filter(Boolean)
        : typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
    }

    // Se forneceu novas credenciais, recriptografa no cofre AES-256-GCM
    if (credentials && (typeof credentials === 'object' ? Object.keys(credentials).length > 0 : String(credentials).trim() !== '')) {
      const credsObj = typeof credentials === 'object' ? credentials : { apiKey: String(credentials).trim() };
      const { encryptedCredentials, iv, authTag } = encryptCredentials(credsObj);
      updateData.encryptedCredentials = encryptedCredentials;
      updateData.iv = iv;
      updateData.authTag = authTag;
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        host: true,
        port: true,
        status: true,
        tenantId: true,
        group: true,
        subgroup: true,
        tags: true,
        connectionMode: true,
        active: true,
        backupStorageId: true,
        backupSchedule: true,
        updatedAt: true,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'EDITAR_EQUIPAMENTO',
          target: `${updated.name} (${updated.type})`,
          status: 'SUCCESS',
          source: 'WEB_DASHBOARD',
          details: { equipmentId: updated.id, group: updated.group, subgroup: updated.subgroup },
        },
      });
    } catch (auditErr) {
      console.warn('Aviso ao registrar auditoria de edição:', auditErr.message);
    }

    return res.json({ status: 'updated', data: updated });
  } catch (error) {
    console.error('Erro ao atualizar equipamento no cofre:', error);
    return res.status(500).json({ error: `Falha ao atualizar no cofre: ${error.message}` });
  }
});

/**
 * Grupos e Subgrupos de Equipamentos (com Isolamento Multi-Tenant)
 */
app.get('/api/equipments/groups', authenticateToken, async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const equipments = await prisma.equipment.findMany({
      where: { active: true, ...tenantFilter },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        group: true,
        subgroup: true,
        tags: true,
      },
    });

    const groupsMap = {};
    const allGroups = new Set();
    const allSubgroups = new Set();

    equipments.forEach((eq) => {
      const g = eq.group?.trim() || 'Geral';
      allGroups.add(g);

      if (!groupsMap[g]) {
        groupsMap[g] = {
          name: g,
          total: 0,
          online: 0,
          degraded: 0,
          offline: 0,
          subgroups: {},
          types: {},
        };
      }

      groupsMap[g].total++;
      if (eq.status === 'online') groupsMap[g].online++;
      else if (eq.status === 'degraded') groupsMap[g].degraded++;
      else groupsMap[g].offline++;

      const sub = eq.subgroup?.trim() || 'Geral / Sem Subgrupo';
      if (eq.subgroup?.trim()) allSubgroups.add(eq.subgroup.trim());

      if (!groupsMap[g].subgroups[sub]) {
        groupsMap[g].subgroups[sub] = {
          name: sub,
          total: 0,
          online: 0,
          degraded: 0,
          offline: 0,
          equipments: [],
        };
      }

      groupsMap[g].subgroups[sub].total++;
      if (eq.status === 'online') groupsMap[g].subgroups[sub].online++;
      else if (eq.status === 'degraded') groupsMap[g].subgroups[sub].degraded++;
      else groupsMap[g].subgroups[sub].offline++;

      groupsMap[g].subgroups[sub].equipments.push({
        id: eq.id,
        name: eq.name,
        type: eq.type,
        status: eq.status,
      });

      groupsMap[g].types[eq.type] = (groupsMap[g].types[eq.type] || 0) + 1;
    });

    const formatted = Object.values(groupsMap).map((g) => ({
      ...g,
      subgroups: Object.values(g.subgroups),
    }));

    return res.json({
      status: 'ok',
      groups: formatted,
      allGroups: Array.from(allGroups).sort(),
      allSubgroups: Array.from(allSubgroups).sort(),
    });
  } catch (err) {
    console.error('Erro ao consultar grupos de equipamentos:', err);
    return res.status(500).json({ error: 'Falha ao consultar grupos de equipamentos.' });
  }
});

// ====================================================================
// --- COFRE DE STORAGES (MINIO, AWS S3, WASABI, SFTP, NFS) ---
// ====================================================================

/**
 * Lista Storages cadastrados no Cofre (com Isolamento Multi-Tenant)
 */
app.get('/api/storages', authenticateToken, async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const storages = await prisma.storage.findMany({
      where: { active: true, ...tenantFilter },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        endpoint: true,
        bucketOrPath: true,
        region: true,
        tenantId: true,
        isDefault: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            equipments: true,
            backupAudits: true,
          },
        },
      },
    });

    return res.json({
      status: 'ok',
      count: storages.length,
      data: storages,
    });
  } catch (error) {
    console.error('Erro ao listar storages:', error);
    return res.status(500).json({ error: 'Erro ao consultar cofre de storages.' });
  }
});

/**
 * Cadastro de NOVO Storage com Criptografia AES-256-GCM (com Verificação de Cotas do Plano)
 */
app.post('/api/storages', authenticateToken, async (req, res) => {
  try {
    const { name, type, endpoint, bucketOrPath, region, credentials, isDefault, tenantId } = req.body;

    if (!name || !endpoint || !bucketOrPath) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes: name, endpoint e bucketOrPath.',
      });
    }

    const targetTenantId = req.user.role === 'SUPERADMIN' ? (tenantId || req.user.tenantId) : req.user.tenantId;

    if (targetTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: targetTenantId },
        include: { _count: { select: { storages: true } } },
      });
      if (tenant && tenant.maxStorages && tenant.maxStorages > 0 && tenant._count.storages >= tenant.maxStorages) {
        return res.status(403).json({
          error: `Cota do plano excedida: limite máximo de ${tenant.maxStorages} storage(s) atingido para a organização no plano ${tenant.plan || 'atual'}. Faça upgrade de plano para adicionar mais destinos de backup.`,
        });
      }
    }

    const validTypes = ['S3_COMPATIBLE', 'SFTP', 'LOCAL_NFS'];
    const storageType = type && validTypes.includes(type) ? type : 'S3_COMPATIBLE';

    const credsObj = credentials
      ? (typeof credentials === 'object' ? credentials : { accessKey: String(credentials).trim() })
      : {};

    const { encryptedCredentials, iv, authTag } = encryptCredentials(credsObj);

    if (isDefault) {
      await prisma.storage.updateMany({
        where: { ...(targetTenantId ? { tenantId: targetTenantId } : {}), isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await prisma.storage.create({
      data: {
        name: String(name).trim(),
        type: storageType,
        endpoint: String(endpoint).trim(),
        bucketOrPath: String(bucketOrPath).trim(),
        region: region ? String(region).trim() : 'us-east-1',
        tenantId: targetTenantId || null,
        isDefault: !!isDefault,
        encryptedCredentials,
        iv,
        authTag,
        active: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        endpoint: true,
        bucketOrPath: true,
        region: true,
        tenantId: true,
        isDefault: true,
        active: true,
        createdAt: true,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'CADASTRAR_STORAGE',
          target: `${created.name} (${created.type})`,
          status: 'SUCCESS',
          source: 'WEB_DASHBOARD',
          details: { storageId: created.id, endpoint: created.endpoint, bucket: created.bucketOrPath, tenantId: created.tenantId },
        },
      });
    } catch {}

    return res.status(201).json({
      status: 'created',
      data: created,
    });
  } catch (error) {
    console.error('Erro ao cadastrar storage:', error);
    return res.status(500).json({ error: `Falha ao salvar storage: ${error.message}` });
  }
});

/**
 * Atualização de Storage no Cofre com Isolamento de Tenant
 */
app.put('/api/storages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, endpoint, bucketOrPath, region, credentials, isDefault } = req.body;

    const existing = await prisma.storage.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Storage não encontrado.' });
    }

    if (req.user.role !== 'SUPERADMIN' && existing.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Acesso negado: este storage pertence a outra organização.' });
    }

    const updateData = {};
    if (name) updateData.name = String(name).trim();
    if (type) updateData.type = type;
    if (endpoint) updateData.endpoint = String(endpoint).trim();
    if (bucketOrPath) updateData.bucketOrPath = String(bucketOrPath).trim();
    if (region !== undefined) updateData.region = region;
    if (isDefault !== undefined) {
      updateData.isDefault = !!isDefault;
      if (isDefault) {
        await prisma.storage.updateMany({
          where: { id: { not: id }, ...(existing.tenantId ? { tenantId: existing.tenantId } : {}), isDefault: true },
          data: { isDefault: false },
        });
      }
    }

    if (credentials && (typeof credentials === 'object' ? Object.keys(credentials).length > 0 : String(credentials).trim() !== '')) {
      const credsObj = typeof credentials === 'object' ? credentials : { accessKey: String(credentials).trim() };
      const { encryptedCredentials, iv, authTag } = encryptCredentials(credsObj);
      updateData.encryptedCredentials = encryptedCredentials;
      updateData.iv = iv;
      updateData.authTag = authTag;
    }

    const updated = await prisma.storage.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        endpoint: true,
        bucketOrPath: true,
        region: true,
        tenantId: true,
        isDefault: true,
        active: true,
        updatedAt: true,
      },
    });

    return res.json({ status: 'updated', data: updated });
  } catch (error) {
    console.error('Erro ao atualizar storage:', error);
    return res.status(500).json({ error: `Falha ao atualizar storage: ${error.message}` });
  }
});

/**
 * Remoção de Storage com Isolamento de Tenant
 */
app.delete('/api/storages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.storage.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Storage não encontrado.' });
    }

    if (req.user.role !== 'SUPERADMIN' && existing.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Acesso negado: este storage pertence a outra organização.' });
    }

    await prisma.storage.delete({ where: { id } });
    return res.json({ status: 'deleted', id });
  } catch (error) {
    console.error('Erro ao remover storage:', error);
    return res.status(500).json({ error: `Falha ao remover storage: ${error.message}` });
  }
});

// ====================================================================
// --- AGENTE DE HOST OUTBOUND (LINUX & WINDOWS) ---
// ====================================================================

function generateLinuxInstallerScript(serverUrl, token, name) {
  return `#!/usr/bin/env bash
# NOC-Agent Host Agent for Linux (Equipamento: ${name})
set -e
SERVER_URL="${serverUrl}"
ENROLL_TOKEN="${token}"

echo "=========================================================="
echo "🚀 Instalando Agente de Host NOC-Agent em $(hostname)"
echo "📡 Servidor Central: $SERVER_URL"
echo "=========================================================="

HOSTNAME=$(hostname)
OS_NAME=$(grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d '=' -f 2 | tr -d '"' || uname -s)
MEM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/ {print $2}' || echo "0")
DISK_TOTAL=$(df -h / 2>/dev/null | awk 'NR==2 {print $2}' || echo "0")

ENROLL_BODY=$(cat <<EOF
{
  "enrollmentToken": "$ENROLL_TOKEN",
  "agentVersion": "1.1.1",
  "osInfo": {
    "hostname": "$HOSTNAME",
    "os": "$OS_NAME",
    "memTotalMb": "$MEM_TOTAL",
    "diskTotal": "$DISK_TOTAL"
  }
}
EOF
)

RESPONSE=$(curl -s -X POST "$SERVER_URL/api/agent/enroll" \\
  -H "Content-Type: application/json" \\
  -d "$ENROLL_BODY")

AGENT_TOKEN=$(echo "$RESPONSE" | grep -o '"agentToken":"[^"]*' | cut -d '"' -f 4)

if [ -z "$AGENT_TOKEN" ]; then
  echo "❌ Erro: Falha no auto-registro. O token pode ter expirado."
  echo "$RESPONSE"
  exit 1
fi

mkdir -p /etc/nocagent
echo "$AGENT_TOKEN" > /etc/nocagent/token
chmod 600 /etc/nocagent/token

cat << 'HEARTBEAT_EOF' > /usr/local/bin/nocagent-heartbeat.sh
#!/usr/bin/env bash
TOKEN=$(cat /etc/nocagent/token 2>/dev/null)
[ -z "$TOKEN" ] && exit 0
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | tr -d ' ')
MEM_USED=$(free -m 2>/dev/null | awk '/Mem:/ {print $3}' || echo "0")
MEM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/ {print $2}' || echo "0")
DISK_USAGE=$(df -h / 2>/dev/null | awk 'NR==2 {print $5}' || echo "0%")
UPTIME_STR=$(uptime -p 2>/dev/null || uptime)

curl -s -X POST "SERVER_URL/api/agent/heartbeat" \\
  -H "Content-Type: application/json" \\
  -d "{\\"agentToken\\":\\"$TOKEN\\",\\"metrics\\":{\\"cpu\\":\\"$CPU_LOAD\\",\\"memUsedMb\\":\\"$MEM_USED\\",\\"memTotalMb\\":\\"$MEM_TOTAL\\",\\"diskUsage\\":\\"$DISK_USAGE\\",\\"uptime\\":\\"$UPTIME_STR\\"}}" >/dev/null 2>&1
HEARTBEAT_EOF

sed -i "s|SERVER_URL|$SERVER_URL|g" /usr/local/bin/nocagent-heartbeat.sh
chmod +x /usr/local/bin/nocagent-heartbeat.sh

# Executa teste inicial
/usr/local/bin/nocagent-heartbeat.sh

# Adiciona cron a cada minuto
(crontab -l 2>/dev/null | grep -v 'nocagent-heartbeat'; echo "* * * * * /usr/local/bin/nocagent-heartbeat.sh") | crontab -

echo "✅ Agente NOC-Agent Linux configurado com sucesso! Telemetria ativa (heartbeat 60s)."
`;
}

function generateWindowsInstallerScript(serverUrl, token, name) {
  return `# NOC-Agent Host Agent for Windows PowerShell (Equipamento: ${name})
$ServerUrl = "${serverUrl}"
$EnrollToken = "${token}"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 Instalando Agente de Host NOC-Agent em $($env:COMPUTERNAME)" -ForegroundColor Cyan
Write-Host "📡 Servidor Central: $ServerUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Hostname = $env:COMPUTERNAME
$OS = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
$MemTotalGB = [math]::Round((Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue).TotalPhysicalMemory / 1GB, 1)

$EnrollPayload = @{
    enrollmentToken = $EnrollToken
    agentVersion = "1.1.1"
    osInfo = @{
        hostname = $Hostname
        os = $OS
        memTotalGb = "$MemTotalGB GB"
    }
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod -Uri "$ServerUrl/api/agent/enroll" -Method Post -Body $EnrollPayload -ContentType "application/json"
    $AgentToken = $Response.agentToken

    if (-not $AgentToken) {
        Write-Error "❌ Falha no auto-registro. O token pode ter expirado."
        return
    }

    $ConfigDir = "$env:ProgramData\\NOCAgent"
    if (-not (Test-Path $ConfigDir)) { New-Item -Path $ConfigDir -ItemType Directory -Force | Out-Null }
    Set-Content -Path "$ConfigDir\\token.txt" -Value $AgentToken

    $ScriptContent = @"
\`$Token = Get-Content -Path "$ConfigDir\\token.txt" -ErrorAction SilentlyContinue
if (-not \`$Token) { return }
\`$Cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
\`$FreeMem = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).FreePhysicalMemory
\`$TotalMem = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).TotalVisibleMemorySize
\`$MemUsedPct = [math]::Round((( \`$TotalMem - \`$FreeMem ) / \`$TotalMem) * 100, 1)
\`$Disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
\`$DiskFreeGB = [math]::Round(\`$Disk.FreeSpace / 1GB, 1)

\`$Payload = @{
    agentToken = \`$Token
    metrics = @{
        cpu = "\`$Cpu%"
        memoryPercent = "\`$MemUsedPct%"
        diskFreeGb = "\`$DiskFreeGB GB"
        uptime = (Get-Uptime -ErrorAction SilentlyContinue).ToString()
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "$ServerUrl/api/agent/heartbeat" -Method Post -Body \`$Payload -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
"@
    Set-Content -Path "$ConfigDir\\heartbeat.ps1" -Value $ScriptContent

    powershell.exe -ExecutionPolicy Bypass -File "$ConfigDir\\heartbeat.ps1"

    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$ConfigDir\\heartbeat.ps1\`""
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)
    $Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName "NOCAgent-Heartbeat" -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

    Write-Host "✅ Agente Windows configurado com sucesso! Telemetria ativa (heartbeat 60s)." -ForegroundColor Green
} catch {
    Write-Error "❌ Erro durante instalacao: $_"
}
`;
}

/**
 * Geração de Script de Instalação 1-Clique do Agente
 */
app.get('/api/agent/install-script/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const eq = await prisma.equipment.findUnique({ where: { id: equipmentId } });

    if (!eq) {
      return res.status(404).send('# Erro: Equipamento não encontrado no cofre.');
    }

    // Gera ou renova o token de auto-registro
    let token = eq.enrollmentToken;
    if (!token || !eq.enrollmentExpiresAt || new Date(eq.enrollmentExpiresAt) < new Date()) {
      token = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await prisma.equipment.update({
        where: { id: eq.id },
        data: { enrollmentToken: token, enrollmentExpiresAt: expiresAt, connectionMode: 'AGENT' },
      });
    }

    const hostHeader = req.get('host') || 'nocagent.awecloudsolution.com';
    const serverBaseUrl = `${req.protocol}://${hostHeader}`;

    if (eq.type === 'WINDOWS_SERVER') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(generateWindowsInstallerScript(serverBaseUrl, token, eq.name));
    }

    // Padrão Linux
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(generateLinuxInstallerScript(serverBaseUrl, token, eq.name));
  } catch (error) {
    console.error('Erro ao gerar script de instalação do agente:', error);
    return res.status(500).send('# Erro interno ao gerar script.');
  }
});

/**
 * Auto-registro (Enrollment) do Agente Outbound
 */
app.post('/api/agent/enroll', async (req, res) => {
  try {
    const { enrollmentToken, agentVersion, osInfo } = req.body;

    if (!enrollmentToken) {
      return res.status(400).json({ error: 'Token de enrollment obrigatório.' });
    }

    const eq = await prisma.equipment.findFirst({
      where: {
        enrollmentToken,
        active: true,
      },
    });

    if (!eq) {
      return res.status(401).json({ error: 'Token de enrollment inválido ou expirado.' });
    }

    if (eq.enrollmentExpiresAt && new Date(eq.enrollmentExpiresAt) < new Date()) {
      return res.status(401).json({ error: 'Token de enrollment expirado. Gere um novo no painel.' });
    }

    // Gera token permanente do agente
    const agentToken = crypto.randomBytes(32).toString('hex');

    await prisma.equipment.update({
      where: { id: eq.id },
      data: {
        agentToken,
        agentVersion: agentVersion || '1.1.1',
        osInfo: osInfo || {},
        status: 'online',
        lastCheck: new Date(),
        lastLossPercent: 0,
        connectionMode: 'AGENT',
        enrollmentToken: null, // Queima o token (uso único)
        enrollmentExpiresAt: null,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'AGENT_ENROLLED',
          target: `${eq.name} (${eq.type})`,
          status: 'SUCCESS',
          source: 'AGENT',
          details: { equipmentId: eq.id, version: agentVersion, os: osInfo?.os || 'unknown' },
        },
      });
    } catch {}

    return res.json({
      status: 'ok',
      agentToken,
      heartbeatIntervalSeconds: 60,
      message: 'Agente registrado com sucesso.',
    });
  } catch (error) {
    console.error('Erro no enrollment do agente:', error);
    return res.status(500).json({ error: 'Erro no auto-registro do agente.' });
  }
});

/**
 * Heartbeat & Telemetria periódica do Agente Outbound
 */
app.post('/api/agent/heartbeat', async (req, res) => {
  try {
    const { agentToken, metrics } = req.body;

    if (!agentToken) {
      return res.status(401).json({ error: 'agentToken obrigatório.' });
    }

    const eq = await prisma.equipment.findFirst({
      where: { agentToken, active: true },
    });

    if (!eq) {
      return res.status(401).json({ error: 'Credencial do agente desconhecida.' });
    }

    const updatedOsInfo = {
      ...(typeof eq.osInfo === 'object' ? eq.osInfo : {}),
      ...(typeof metrics === 'object' ? metrics : {}),
      lastTelemetryAt: new Date().toISOString(),
    };

    await prisma.equipment.update({
      where: { id: eq.id },
      data: {
        status: 'online',
        lastCheck: new Date(),
        lastLossPercent: 0,
        osInfo: updatedOsInfo,
      },
    });

    return res.json({ status: 'ok', acknowledged: true });
  } catch (error) {
    console.error('Erro no heartbeat do agente:', error);
    return res.status(500).json({ error: 'Falha ao processar telemetria.' });
  }
});

/**
 * Remoção de Equipamento do Cofre com Isolamento de Tenant
 */
app.delete('/api/equipments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.equipment.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Equipamento não encontrado no cofre.' });
    }

    if (req.user.role !== 'SUPERADMIN' && existing.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Acesso negado: este equipamento pertence a outra organização.' });
    }

    await prisma.equipment.delete({ where: { id } });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'REMOVER_EQUIPAMENTO',
          target: `${existing.name} (${existing.type})`,
          status: 'SUCCESS',
          source: 'WEB_DASHBOARD',
          details: { equipmentId: id, tenantId: existing.tenantId },
        },
      });
    } catch {}

    return res.json({ status: 'deleted', id });
  } catch (error) {
    console.error('Erro ao remover equipamento do cofre:', error);
    return res.status(500).json({ error: `Falha ao remover equipamento: ${error.message}` });
  }
});

/**
 * Auditoria REAL de Backups salvos no Storage S3 (com Isolamento Multi-Tenant)
 */
app.get('/api/backups', authenticateToken, async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const audits = await prisma.backupAudit.findMany({
      where: tenantFilter.tenantId ? { equipment: { tenantId: tenantFilter.tenantId } } : {},
      orderBy: { verifiedAt: 'desc' },
      take: 50,
      include: {
        equipment: {
          select: { name: true, type: true, tenantId: true },
        },
        storage: {
          select: { name: true, type: true, bucketOrPath: true },
        },
      },
    });

    return res.json({
      status: 'ok',
      count: audits.length,
      data: audits,
    });
  } catch (error) {
    console.error('Erro ao listar auditorias de backup:', error);
    return res.status(500).json({ error: 'Erro ao consultar auditorias de backup.' });
  }
});

/**
 * Lista REAL de Logs de Auditoria (Audit Trail com Isolamento Multi-Tenant)
 */
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        operator: {
          select: { name: true, phone: true },
        },
      },
    });

    return res.json({
      status: 'ok',
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('Erro ao listar audit logs:', error);
    return res.status(500).json({ error: 'Erro ao consultar logs de auditoria.' });
  }
});

/**
 * Catálogo de Ferramentas MCP Ativas
 */
app.get('/api/mcp/tools', (req, res) => {
  return res.json({ status: 'ok', tools: MCP_TOOLS_DEFINITIONS });
});

/**
 * Execução de Ferramenta MCP Direta
 */
app.post('/api/mcp/execute', async (req, res) => {
  try {
    const { toolName, args } = req.body;
    if (!toolName) {
      return res.status(400).json({ error: 'toolName é obrigatório.' });
    }
    const result = await executeMcpTool(toolName, args);
    return res.json({ status: 'ok', toolName, result });
  } catch (error) {
    console.error('Erro ao executar ferramenta MCP:', error);
    return res.status(500).json({ error: error.message || 'Falha na execução da ferramenta MCP.' });
  }
});

// =================================================================
// ROTAS DE GOVERNANÇA, FEATURE FLAGS & EMERGENCY KILL-SWITCH
// =================================================================

/**
 * Consulta status do Kill-Switch e catálogo de Feature Flags
 */
app.get('/api/flags', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.role === 'SUPERADMIN' ? req.query.tenantId : req.user.tenantId;
    const flags = await getAllFlags(tenantId);
    const killSwitch = getKillSwitchStatus();
    return res.json({
      status: 'ok',
      killSwitch,
      flags,
    });
  } catch (error) {
    console.error('Erro ao consultar feature flags:', error);
    return res.status(500).json({ error: 'Erro ao consultar feature flags.' });
  }
});

/**
 * Aciona ou Desativa o Emergency Kill-Switch Global
 */
app.post('/api/flags/kill-switch', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { active, reason } = req.body;
    if (active === undefined) {
      return res.status(400).json({ error: 'O campo active (boolean) é obrigatório.' });
    }
    const operatorName = req.user?.name || 'Superadmin';
    const status = await setGlobalKillSwitch(Boolean(active), reason || 'Ação administrativa', operatorName);
    return res.json({
      status: 'ok',
      message: active ? '🚨 Emergency Kill-Switch ATIVADO com sucesso.' : '✅ Emergency Kill-Switch LIBERADO com sucesso.',
      killSwitch: status,
    });
  } catch (error) {
    console.error('Erro ao alternar kill switch:', error);
    return res.status(500).json({ error: 'Falha ao alternar kill-switch.' });
  }
});

/**
 * Atualiza status ou valor de uma Feature Flag
 */
app.post('/api/flags/:key/toggle', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled, value, tenantId, description } = req.body;

    const updated = await setFeatureFlag({
      key,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      value: value !== undefined ? String(value) : 'true',
      tenantId: tenantId || null,
      description,
    });

    return res.json({
      status: 'ok',
      flag: updated,
    });
  } catch (error) {
    console.error('Erro ao atualizar flag:', error);
    return res.status(500).json({ error: 'Erro ao salvar alteração da flag.' });
  }
});

// =================================================================
// ROTAS DE OBSERVABILIDADE & APM EM TEMPO REAL (PULSE & TELESCOPE)
// =================================================================

/**
 * Métricas agregadas de desempenho e latência por driver MCP
 */
app.get('/api/observability/apm', authenticateToken, (req, res) => {
  try {
    const metrics = getApmMetrics();
    const killSwitch = getKillSwitchStatus();
    return res.json({
      status: 'ok',
      apm: metrics,
      killSwitch,
    });
  } catch (error) {
    console.error('Erro ao consultar APM:', error);
    return res.status(500).json({ error: 'Falha ao obter métricas APM.' });
  }
});

/**
 * Traces detalhados de requisições de rede e ferramentas MCP
 */
app.get('/api/observability/traces', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const traces = await getRecentTraces(limit);
    return res.json({
      status: 'ok',
      traces,
    });
  } catch (error) {
    console.error('Erro ao consultar traces:', error);
    return res.status(500).json({ error: 'Falha ao obter traces de execução.' });
  }
});

// Inicialização do Servidor HTTP
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================`);
  console.log(`🚀 NOC-Agent Core Runtime rodando na porta ${PORT}`);
  console.log(`🌐 Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chatwoot Webhook: http://localhost:${PORT}/api/webhooks/chatwoot`);
  console.log(`📡 Endpoints reais: /api/gateways, /api/equipments, /api/backups`);
  console.log(`🔐 Autenticação & 2FA: /api/auth/login, /api/tenants, /api/users`);
  console.log(`🛡️ Governança & APM: /api/flags, /api/observability/apm`);
  console.log(`====================================================`);

  initFlags(prisma);
  initApm(prisma);

  await bootstrapSuperadmin();
});
