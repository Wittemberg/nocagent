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
 * Status REAL dos Equipamentos da Rede consultados via Cofre Criptográfico
 */
app.get('/api/equipments/status', async (req, res) => {
  try {
    const equipments = await prisma.equipment.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (equipments.length === 0) {
      return res.json({
        status: 'empty',
        message: 'Nenhum equipamento cadastrado no cofre.',
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
              // 1. Tenta X-API-Key + Authorization: Bearer
              // 2. Se falhar com 401, tenta Basic Auth (admin:apiKey ou apiKey)
              // 3. Tenta X-API-Key individual
              const authAttempts = [
                { 'X-API-Key': apiKey, 'Authorization': apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}` },
                { 'Authorization': `Basic ${Buffer.from(apiKey.includes(':') ? apiKey : `admin:${apiKey}`).toString('base64')}` },
                { 'X-API-Key': apiKey }
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
                } catch (firstErr) {
                  if (firstErr.response?.status === 401) {
                    continue;
                  }
                  try {
                    gwRes = await axios.get(`${targetUrl}/api/v2/status/gateway`, {
                      headers,
                      timeout: 6000,
                      httpsAgent,
                    });
                    authSuccess = true;
                    break;
                  } catch (secondErr) {
                    if (secondErr.response?.status === 401) {
                      continue;
                    }
                    throw secondErr;
                  }
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
                item.status = onlineGws.length > 0 ? (onlineGws.length === gws.length ? 'online' : 'degraded') : 'degraded';
                const totalDelay = gws.reduce((acc, g) => acc + (parseFloat(g.delay) || 0), 0);
                const totalLoss = gws.reduce((acc, g) => acc + (parseFloat(g.loss) || 0), 0);
                item.lastLatency = Math.round((totalDelay / gws.length) * 10) / 10;
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
 * Status REAL dos Gateways da Rede (Compatibilidade com endpoints legados)
 */
app.get('/api/gateways', async (req, res) => {
  try {
    const pfsense = await prisma.equipment.findFirst({
      where: {
        type: 'PFSENSE',
        active: true,
      },
    });

    if (!pfsense) {
      return res.json({
        status: 'empty',
        message: 'Nenhum equipamento cadastrado no cofre.',
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
 * Edição / Atualização de Equipamento no Cofre
 */
app.put('/api/equipments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, host, port, credentials, backupStorageId, backupSchedule } = req.body;

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Equipamento não encontrado no cofre.' });
    }

    const updateData = {};
    if (name) updateData.name = String(name).trim();
    if (type) {
      const validTypes = ['PFSENSE', 'MIKROTIK', 'PROXMOX', 'ZABBIX', 'GENERIC_SNMP'];
      const upperType = String(type).toUpperCase();
      if (!validTypes.includes(upperType)) {
        return res.status(400).json({ error: `Tipo inválido. Aceitos: ${validTypes.join(', ')}` });
      }
      updateData.type = upperType;
    }
    if (host) updateData.host = String(host).trim();
    if (port !== undefined) updateData.port = port ? parseInt(port, 10) : null;
    if (backupStorageId !== undefined) updateData.backupStorageId = backupStorageId || null;
    if (backupSchedule !== undefined) updateData.backupSchedule = backupSchedule;

    // Se forneceu novas credenciais, recriptografa no cofre AES-256-GCM
    if (credentials && String(credentials).trim() !== '') {
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
          details: { equipmentId: updated.id, host: updated.host, changedFields: Object.keys(updateData) },
        },
      });
    } catch (auditErr) {
      console.warn('Aviso ao registrar log de auditoria:', auditErr.message);
    }

    return res.json({
      status: 'updated',
      data: updated,
    });
  } catch (error) {
    console.error('Erro ao atualizar equipamento no cofre:', error);
    return res.status(500).json({ error: `Falha ao atualizar no cofre: ${error.message}` });
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
