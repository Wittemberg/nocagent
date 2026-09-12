require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const { handleChatwootWebhook } = require('./chatwoot/bridge');
const { processMessage } = require('./agent/hermes');
const { encryptCredentials, decryptCredentials } = require('./security/vault');

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
          const probe = await probeTcpPort(eq.host, port, 4000);
          if (probe.online) {
            item.status = 'online';
            item.lastLatency = probe.rtt;
            item.lastLossPercent = 0;
            item.lastCheck = new Date();
          } else {
            item.status = 'offline';
            item.error = `Não foi possível conectar na porta ${port} do Mikrotik (${probe.error}).`;
          }
          prisma.equipment.update({
            where: { id: eq.id },
            data: { status: item.status, lastLatency: item.lastLatency, lastLossPercent: item.lastLossPercent, lastCheck: item.lastCheck },
          }).catch(() => {});
        }

        // Se for Servidor Linux (SSH ou Agente Outbound)
        if (eq.type === 'LINUX_SERVER') {
          if (eq.connectionMode === 'AGENT') {
            const isFresh = eq.lastCheck && (Date.now() - new Date(eq.lastCheck).getTime() < 180000);
            item.status = isFresh ? 'online' : 'offline';
            if (!isFresh) item.error = 'Agente desconectado (sem telemetria recente nos últimos 3 min)';
            item.subItems = eq.osInfo ? [eq.osInfo] : [];
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
            item.subItems = eq.osInfo ? [eq.osInfo] : [];
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

        // Se for Proxmox VE
        if (eq.type === 'PROXMOX') {
          const port = eq.port || 8006;
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
        connectionMode: true,
        enrollmentToken: true,
        agentVersion: true,
        osInfo: true,
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
    const { name, type, host, port, credentials, connectionMode, backupStorageId, backupSchedule } = req.body;

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

    const mode = connectionMode === 'AGENT' ? 'AGENT' : 'DIRECT';

    if (mode === 'DIRECT' && !host) {
      return res.status(400).json({
        error: 'Para conexão direta, informe o Host ou IP do equipamento.',
      });
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

    const created = await prisma.equipment.create({
      data: {
        name: String(name).trim(),
        type: upperType,
        host: host ? String(host).trim() : (mode === 'AGENT' ? 'outbound-agent' : '0.0.0.0'),
        port: port ? parseInt(port, 10) : null,
        connectionMode: mode,
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
          details: { equipmentId: created.id, host: created.host, mode },
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
    const { name, type, host, port, credentials, connectionMode, backupStorageId, backupSchedule } = req.body;

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Equipamento não encontrado no cofre.' });
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

// ====================================================================
// --- COFRE DE STORAGES (MINIO, AWS S3, WASABI, SFTP, NFS) ---
// ====================================================================

/**
 * Lista Storages cadastrados no Cofre
 */
app.get('/api/storages', async (req, res) => {
  try {
    const storages = await prisma.storage.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        endpoint: true,
        bucketOrPath: true,
        region: true,
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
 * Cadastro de NOVO Storage com Criptografia AES-256-GCM
 */
app.post('/api/storages', async (req, res) => {
  try {
    const { name, type, endpoint, bucketOrPath, region, credentials, isDefault } = req.body;

    if (!name || !endpoint || !bucketOrPath) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes: name, endpoint e bucketOrPath.',
      });
    }

    const validTypes = ['S3_COMPATIBLE', 'SFTP', 'LOCAL_NFS'];
    const storageType = type && validTypes.includes(type) ? type : 'S3_COMPATIBLE';

    const credsObj = credentials
      ? (typeof credentials === 'object' ? credentials : { accessKey: String(credentials).trim() })
      : {};

    const { encryptedCredentials, iv, authTag } = encryptCredentials(credsObj);

    if (isDefault) {
      await prisma.storage.updateMany({
        where: { isDefault: true },
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
          details: { storageId: created.id, endpoint: created.endpoint, bucket: created.bucketOrPath },
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
 * Atualização de Storage no Cofre
 */
app.put('/api/storages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, endpoint, bucketOrPath, region, credentials, isDefault } = req.body;

    const existing = await prisma.storage.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Storage não encontrado.' });
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
          where: { id: { not: id }, isDefault: true },
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
 * Remoção de Storage
 */
app.delete('/api/storages/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
