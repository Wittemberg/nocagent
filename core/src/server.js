require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const { handleChatwootWebhook } = require('./chatwoot/bridge');
const { processMessage } = require('./agent/hermes');
const { encryptCredentials, decryptCredentials } = require('./security/vault');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Agente HTTPS para ignorar certificados autoassinados em firewalls locais
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

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
    },
  });
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
 * Endpoint de Chat Direto (para o Dashboard Web interativo)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, senderName } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Campo "message" obrigatório.' });
    }

    const reply = await processMessage({
      text: message,
      senderPhone: 'web-dashboard',
      senderName: senderName || 'Operador Web',
    });

    return res.json({ reply, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erro no chat web:', error);
    return res.status(500).json({ error: 'Erro interno ao processar mensagem.' });
  }
});

/**
 * Status REAL dos Gateways da Rede consultados no pfSense cadastrado no Cofre
 */
app.get('/api/gateways', async (req, res) => {
  try {
    // 1. Busca o primeiro pfSense ativo cadastrado no Cofre Criptográfico
    const pfsense = await prisma.equipment.findFirst({
      where: {
        type: 'PFSENSE',
        active: true,
      },
    });

    if (!pfsense) {
      return res.json({
        status: 'no_equipment',
        message: 'Nenhum firewall pfSense cadastrado no Cofre de Equipamentos.',
        data: [],
      });
    }

    // 2. Decifra a credencial estritamente em memória
    let apiKey = '';
    try {
      const creds = decryptCredentials(pfsense.encryptedCredentials, pfsense.iv, pfsense.authTag);
      apiKey = typeof creds === 'object' ? (creds.apiKey || creds.key || creds.token || '') : String(creds);
    } catch (decErr) {
      console.error(`Erro ao decifrar credenciais do equipamento ${pfsense.name}:`, decErr.message);
      return res.status(500).json({
        status: 'error',
        message: `Falha ao descriptografar credenciais do equipamento ${pfsense.name} no cofre.`,
        data: [],
      });
    }

    if (!apiKey) {
      return res.json({
        status: 'no_key',
        message: `Equipamento ${pfsense.name} não possui API Key válida armazenada no cofre.`,
        data: [],
      });
    }

    // 3. Consulta o endpoint oficial do pfSense REST API
    const targetUrl = pfsense.host.replace(/\/+$/, '');
    let response;
    try {
      response = await axios.get(`${targetUrl}/api/v2/status/gateways`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 8000,
        httpsAgent,
      });
    } catch (firstErr) {
      // Fallback para rota singular caso versão do pacote seja diferente
      response = await axios.get(`${targetUrl}/api/v2/status/gateway`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 8000,
        httpsAgent,
      });
    }

    const gateways = response.data?.data || [];

    // 4. Atualiza timestamp da última verificação no banco
    prisma.equipment.update({
      where: { id: pfsense.id },
      data: { status: 'online', lastCheck: new Date() },
    }).catch(e => console.warn('Aviso: falha ao atualizar lastCheck:', e.message));

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
    console.error('Erro ao consultar pfSense via cofre:', error.message);
    return res.status(502).json({
      status: 'error',
      message: `Falha na comunicação com o pfSense: ${error.message}`,
      data: [],
    });
  }
});

/**
 * Lista REAL de Equipamentos Cadastrados no Cofre (sem dados fictícios)
 */
app.get('/api/equipments', async (req, res) => {
  try {
    const equipments = await prisma.equipment.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        host: true,
        port: true,
        status: true,
        lastLatency: true,
        lastLossPercent: true,
        lastCheck: true,
        active: true,
        createdAt: true,
        // Credenciais NUNCA retornadas em texto puro para a web
      },
    });

    return res.json({
      status: 'ok',
      count: equipments.length,
      data: equipments,
    });
  } catch (error) {
    console.error('Erro ao listar equipamentos:', error);
    return res.status(500).json({ error: 'Erro ao consultar cofre de equipamentos.' });
  }
});

/**
 * Cadastro de NOVO Equipamento no Cofre com Criptografia AES-256-GCM
 */
app.post('/api/equipments', async (req, res) => {
  try {
    const { name, type, host, port, credentials } = req.body;

    if (!name || !type || !host || !credentials) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes: name, type, host e credentials.',
      });
    }

    const validTypes = ['PFSENSE', 'MIKROTIK', 'PROXMOX', 'ZABBIX', 'GENERIC_SNMP'];
    const upperType = String(type).toUpperCase();
    if (!validTypes.includes(upperType)) {
      return res.status(400).json({
        error: `Tipo de equipamento inválido. Tipos aceitos: ${validTypes.join(', ')}`,
      });
    }

    // Normaliza credenciais: se string, converte em objeto
    const credsObj = typeof credentials === 'object' ? credentials : { apiKey: String(credentials).trim() };

    // Criptografa estritamente com a chave mestra AES-256-GCM
    const { encryptedCredentials, iv, authTag } = encryptCredentials(credsObj);

    const created = await prisma.equipment.create({
      data: {
        name: String(name).trim(),
        type: upperType,
        host: String(host).trim(),
        port: port ? parseInt(port, 10) : null,
        encryptedCredentials,
        iv,
        authTag,
        status: 'online',
        active: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        host: true,
        port: true,
        status: true,
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
          details: { equipmentId: created.id, host: created.host },
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
 * Remoção de Equipamento do Cofre
 */
app.delete('/api/equipments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.equipment.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Equipamento não encontrado no cofre.' });
    }

    await prisma.equipment.delete({ where: { id } });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'REMOVER_EQUIPAMENTO',
          target: `${existing.name} (${existing.type})`,
          status: 'SUCCESS',
          source: 'WEB_DASHBOARD',
          details: { equipmentId: id },
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
 * Auditoria REAL de Backups salvos no Storage S3 (sem dados fictícios)
 */
app.get('/api/backups', async (req, res) => {
  try {
    const audits = await prisma.backupAudit.findMany({
      orderBy: { verifiedAt: 'desc' },
      take: 20,
      include: {
        equipment: {
          select: { name: true, type: true },
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
 * Lista REAL de Logs de Auditoria (Audit Trail)
 */
app.get('/api/audit-logs', async (req, res) => {
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

// Inicialização do Servidor HTTP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 NOC-Agent Core Runtime rodando na porta ${PORT}`);
  console.log(`🌐 Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chatwoot Webhook: http://localhost:${PORT}/api/webhooks/chatwoot`);
  console.log(`📡 Endpoints reais: /api/gateways, /api/equipments, /api/backups`);
  console.log(`====================================================`);
});
