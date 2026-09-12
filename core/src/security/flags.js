const Redis = require('ioredis');

// Chaves no Redis
const REDIS_PREFIX = process.env.REDIS_KEY_PREFIX || 'nocagent:';
const KILL_SWITCH_KEY = `${REDIS_PREFIX}flags:global_kill_switch`;
const FLAGS_HASH_KEY = `${REDIS_PREFIX}flags:active`;

let prisma = null;
let redis = null;
let redisConnected = false;

// Cache local em memória como fallback resiliente
const localMemoryFlags = new Map();
let localKillSwitch = {
  active: false,
  reason: null,
  triggeredBy: null,
  triggeredAt: null,
};

// Flags padrão do NOC-Agent com descrições e níveis de segurança
const DEFAULT_SYSTEM_FLAGS = [
  {
    key: 'ai-autonomous-l1-read',
    description: 'Nível L1: Leitura autônoma contínua de métricas e diagnósticos sem aprovação prévia.',
    type: 'BOOLEAN',
    value: 'true',
    enabled: true,
  },
  {
    key: 'ai-autonomous-l2-remediation',
    description: 'Nível L2: Execução de remediações não-destrutivas (limpar rotas ARP, reiniciar serviços locais).',
    type: 'BOOLEAN',
    value: 'true',
    enabled: true,
  },
  {
    key: 'ai-autonomous-l3-critical',
    description: 'Nível L3: Ações críticas de alto impacto (reboot de nós Proxmox, regras pfSense). Requer aprovação L3.',
    type: 'BOOLEAN',
    value: 'false',
    enabled: false,
  },
  {
    key: 'driver-canary-rollout',
    description: 'Canary Release: Rollout experimental para novos drivers de rede (ex: Mikrotik v7 REST / Proxmox SDN).',
    type: 'PERCENTAGE',
    value: '20',
    enabled: false,
  },
  {
    key: 'apm-detailed-tracing',
    description: 'Observabilidade: Coleta detalhada de latência de drivers MCP e payloads para auditoria.',
    type: 'BOOLEAN',
    value: 'true',
    enabled: true,
  },
];

/**
 * Inicializa o cliente Redis e sincroniza as flags com o banco de dados
 */
function initFlags(prismaInstance) {
  prisma = prismaInstance;

  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379/0';
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 3) return null; // Não travar se Redis estiver offline
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    redis.connect().then(() => {
      redisConnected = true;
      console.log('✅ [Flags] Conexão com Redis estabelecida com sucesso.');
      syncFlagsFromDatabase();
    }).catch((err) => {
      console.warn('⚠️ [Flags] Redis não disponível, operando em modo fallback local:', err.message);
      syncFlagsFromDatabase();
    });

    redis.on('error', (err) => {
      redisConnected = false;
    });
  } catch (err) {
    console.warn('⚠️ [Flags] Erro ao instanciar Redis, fallback local:', err.message);
    syncFlagsFromDatabase();
  }
}

/**
 * Sincroniza as flags do PostgreSQL para a memória/Redis e popula flags padrão
 */
async function syncFlagsFromDatabase() {
  if (!prisma) return;

  try {
    // Garantir que as flags do sistema existam no banco
    for (const def of DEFAULT_SYSTEM_FLAGS) {
      const existing = await prisma.featureFlag.findFirst({
        where: { key: def.key, tenantId: null },
      });

      if (!existing) {
        await prisma.featureFlag.create({
          data: {
            key: def.key,
            description: def.description,
            type: def.type,
            value: def.value,
            enabled: def.enabled,
          },
        });
      }
    }

    // Carregar todas as flags ativas
    const allFlags = await prisma.featureFlag.findMany();
    for (const flag of allFlags) {
      const cacheKey = flag.tenantId ? `${flag.tenantId}:${flag.key}` : flag.key;
      localMemoryFlags.set(cacheKey, {
        enabled: flag.enabled,
        value: flag.value,
        type: flag.type,
      });

      if (redisConnected && redis) {
        await redis.hset(FLAGS_HASH_KEY, cacheKey, JSON.stringify({
          enabled: flag.enabled,
          value: flag.value,
          type: flag.type,
        }));
      }
    }

    // Carregar status do kill-switch do Redis se disponível
    if (redisConnected && redis) {
      const ksRaw = await redis.get(KILL_SWITCH_KEY);
      if (ksRaw) {
        localKillSwitch = JSON.parse(ksRaw);
      }
    }
  } catch (error) {
    console.error('❌ [Flags] Erro ao sincronizar flags do banco:', error.message);
  }
}

/**
 * Consulta se o Kill-Switch de Emergência está ativo
 */
function isGlobalKillSwitchActive() {
  return localKillSwitch.active;
}

/**
 * Retorna os detalhes completos do status do Kill-Switch
 */
function getKillSwitchStatus() {
  return { ...localKillSwitch };
}

/**
 * Ativa ou Desativa o Kill-Switch de Emergência Global
 */
async function setGlobalKillSwitch(active, reason = 'Ação administrativa', triggeredBy = 'SUPERADMIN') {
  localKillSwitch = {
    active: Boolean(active),
    reason: active ? reason : null,
    triggeredBy,
    triggeredAt: active ? new Date().toISOString() : null,
  };

  if (redisConnected && redis) {
    try {
      if (active) {
        await redis.set(KILL_SWITCH_KEY, JSON.stringify(localKillSwitch));
      } else {
        await redis.del(KILL_SWITCH_KEY);
      }
    } catch (e) {
      console.warn('⚠️ [Flags] Falha ao persistir Kill-Switch no Redis:', e.message);
    }
  }

  // Registrar em log de auditoria
  if (prisma) {
    try {
      await prisma.auditLog.create({
        data: {
          action: active ? 'EMERGENCY_KILL_SWITCH_ENGAGED' : 'EMERGENCY_KILL_SWITCH_RELEASED',
          target: 'GLOBAL_AI_SYSTEM',
          status: 'SUCCESS',
          source: 'WEB_DASHBOARD',
          details: {
            reason,
            triggeredBy,
            active,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.error('Erro ao gravar audit log do kill switch:', e.message);
    }
  }

  return localKillSwitch;
}

/**
 * Avalia se uma flag está ativa para um dado tenant
 */
async function isFeatureEnabled(key, { tenantId = null } = {}) {
  // Se o Kill-Switch global estiver ativo, qualquer ação de IA autônoma é bloqueada
  if (localKillSwitch.active && key.startsWith('ai-autonomous-')) {
    return false;
  }

  // 1. Tentar override do Tenant
  if (tenantId) {
    const tenantKey = `${tenantId}:${key}`;
    if (localMemoryFlags.has(tenantKey)) {
      return localMemoryFlags.get(tenantKey).enabled;
    }
  }

  // 2. Verificar flag global no cache
  if (localMemoryFlags.has(key)) {
    return localMemoryFlags.get(key).enabled;
  }

  // 3. Fallback no Banco
  if (prisma) {
    try {
      const dbFlag = await prisma.featureFlag.findFirst({
        where: { key, tenantId: tenantId || null },
      });
      if (dbFlag) {
        localMemoryFlags.set(tenantId ? `${tenantId}:${key}` : key, {
          enabled: dbFlag.enabled,
          value: dbFlag.value,
          type: dbFlag.type,
        });
        return dbFlag.enabled;
      }
    } catch (e) {
      console.warn('⚠️ [Flags] Erro ao consultar flag no banco:', e.message);
    }
  }

  // Se não encontrada, buscar valor padrão se existir
  const def = DEFAULT_SYSTEM_FLAGS.find((f) => f.key === key);
  return def ? def.enabled : false;
}

/**
 * Retorna todas as flags cadastradas com informações de tenant e status
 */
async function getAllFlags(tenantId = null) {
  if (!prisma) return DEFAULT_SYSTEM_FLAGS;

  try {
    const where = tenantId ? { OR: [{ tenantId: null }, { tenantId }] } : {};
    const flags = await prisma.featureFlag.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ tenantId: 'asc' }, { key: 'asc' }],
    });

    return flags;
  } catch (e) {
    console.error('❌ [Flags] Erro ao listar flags:', e.message);
    return DEFAULT_SYSTEM_FLAGS;
  }
}

/**
 * Atualiza ou cria uma flag (com persistência no Postgres e sincronização no Redis)
 */
async function setFeatureFlag({ key, enabled, value = 'true', tenantId = null, description = null }) {
  if (!prisma) throw new Error('Prisma não inicializado');

  const flag = await prisma.featureFlag.upsert({
    where: {
      key_tenantId: {
        key,
        tenantId: tenantId || null,
      },
    },
    update: {
      enabled: Boolean(enabled),
      value: String(value),
      ...(description ? { description } : {}),
    },
    create: {
      key,
      enabled: Boolean(enabled),
      value: String(value),
      tenantId: tenantId || null,
      description: description || `Flag ${key}`,
    },
  });

  const cacheKey = tenantId ? `${tenantId}:${key}` : key;
  localMemoryFlags.set(cacheKey, {
    enabled: flag.enabled,
    value: flag.value,
    type: flag.type,
  });

  if (redisConnected && redis) {
    try {
      await redis.hset(FLAGS_HASH_KEY, cacheKey, JSON.stringify({
        enabled: flag.enabled,
        value: flag.value,
        type: flag.type,
      }));
    } catch (e) {
      console.warn('⚠️ [Flags] Erro ao atualizar cache no Redis:', e.message);
    }
  }

  return flag;
}

module.exports = {
  initFlags,
  isGlobalKillSwitchActive,
  getKillSwitchStatus,
  setGlobalKillSwitch,
  isFeatureEnabled,
  getAllFlags,
  setFeatureFlag,
  DEFAULT_SYSTEM_FLAGS,
};
