const os = require('os');

let prisma = null;
const traceBuffer = [];
const MAX_BUFFER_SIZE = 200;

// Histórico de latências para cálculo de médias móveis
const latencyStats = {
  PROXMOX: { count: 0, totalMs: 0, errors: 0, lastSeen: null },
  MIKROTIK: { count: 0, totalMs: 0, errors: 0, lastSeen: null },
  PFSENSE: { count: 0, totalMs: 0, errors: 0, lastSeen: null },
  ZABBIX: { count: 0, totalMs: 0, errors: 0, lastSeen: null },
  LLM: { count: 0, totalMs: 0, errors: 0, lastSeen: null },
  HOST_AGENT: { count: 0, totalMs: 0, errors: 0, lastSeen: null },
};

/**
 * Inicializa o módulo APM e agenda o flush periódico para o PostgreSQL
 */
function initApm(prismaInstance) {
  prisma = prismaInstance;

  // Flush assíncrono a cada 30 segundos
  setInterval(flushTracesToDatabase, 30 * 1000);
  console.log('✅ [APM] Módulo de Observabilidade e Métricas de Drivers inicializado.');
}

/**
 * Registra um trace de execução de driver MCP ou chamada externa
 */
async function recordMcpTrace({
  driver = 'GENERIC',
  equipmentId = null,
  method = 'GET',
  endpoint = '',
  durationMs = 0,
  statusCode = 200,
  error = null,
}) {
  const normDriver = String(driver).toUpperCase();
  const trace = {
    id: `tr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    driver: normDriver,
    equipmentId,
    method,
    endpoint: String(endpoint).substring(0, 255),
    durationMs: Math.round(durationMs * 10) / 10,
    statusCode: statusCode ? parseInt(statusCode, 10) : null,
    error: error ? String(error).substring(0, 255) : null,
    createdAt: new Date(),
  };

  // Atualizar estatísticas em memória
  if (!latencyStats[normDriver]) {
    latencyStats[normDriver] = { count: 0, totalMs: 0, errors: 0, lastSeen: null };
  }
  latencyStats[normDriver].count += 1;
  latencyStats[normDriver].totalMs += trace.durationMs;
  if (error || (statusCode && statusCode >= 400)) {
    latencyStats[normDriver].errors += 1;
  }
  latencyStats[normDriver].lastSeen = trace.createdAt;

  // Adicionar ao ring buffer em memória
  traceBuffer.unshift(trace);
  if (traceBuffer.length > MAX_BUFFER_SIZE) {
    traceBuffer.pop();
  }

  return trace;
}

/**
 * Executa uma função com medição automática de latência e gravação de trace
 */
async function wrapDriverCall(driver, equipmentId, method, endpoint, fn) {
  const start = process.hrtime();
  let statusCode = 200;
  let error = null;
  let result = null;

  try {
    result = await fn();
    return result;
  } catch (err) {
    error = err.message || String(err);
    statusCode = err.response?.status || 500;
    throw err;
  } finally {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1000 + diff[1] / 1e6;
    recordMcpTrace({
      driver,
      equipmentId,
      method,
      endpoint,
      durationMs,
      statusCode,
      error,
    }).catch(() => {});
  }
}

/**
 * Grava em lote os traces acumulados no PostgreSQL
 */
async function flushTracesToDatabase() {
  if (!prisma || traceBuffer.length === 0) return;

  try {
    // Coletar itens ainda não persistidos (ex: últimos 20)
    const itemsToSave = traceBuffer.slice(0, 30).map((t) => ({
      driver: t.driver,
      equipmentId: t.equipmentId,
      method: t.method,
      endpoint: t.endpoint,
      durationMs: t.durationMs,
      statusCode: t.statusCode,
      error: t.error,
      createdAt: t.createdAt,
    }));

    if (itemsToSave.length > 0) {
      await prisma.mcpTrace.createMany({
        data: itemsToSave,
        skipDuplicates: true,
      });
    }

    // Purga automática de traces com mais de 7 dias
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.mcpTrace.deleteMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
    });
  } catch (err) {
    // Silencioso para não poluir logs operacionais
  }
}

/**
 * Retorna métricas agregadas de desempenho e saúde do servidor
 */
function getApmMetrics() {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const load = os.loadavg();

  // Calcular médias de latência e taxas de erro por driver
  const drivers = {};
  for (const [key, stats] of Object.entries(latencyStats)) {
    const avgLatency = stats.count > 0 ? Math.round((stats.totalMs / stats.count) * 10) / 10 : 0;
    const errorRate = stats.count > 0 ? Math.round((stats.errors / stats.count) * 100) : 0;
    drivers[key] = {
      totalCalls: stats.count,
      avgLatencyMs: avgLatency,
      errorRatePercent: errorRate,
      lastSeen: stats.lastSeen,
      status: errorRate > 20 ? 'DEGRADED' : stats.count === 0 ? 'IDLE' : 'HEALTHY',
    };
  }

  return {
    server: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
      memoryHeapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      systemLoad1m: Math.round(load[0] * 100) / 100,
      cpuCores: cpus.length,
      nodeVersion: process.version,
    },
    drivers,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Retorna os traces mais recentes com suporte a filtros
 */
async function getRecentTraces(limit = 50, filter = {}) {
  // Se houver prisma, tentar buscar os mais recentes com equipamento
  if (prisma) {
    try {
      const traces = await prisma.mcpTrace.findMany({
        take: Math.min(limit, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          equipment: {
            select: { id: true, name: true, type: true, host: true },
          },
        },
      });
      if (traces.length > 0) return traces;
    } catch (e) {
      // Fallback para buffer local
    }
  }

  return traceBuffer.slice(0, limit);
}

module.exports = {
  initApm,
  recordMcpTrace,
  wrapDriverCall,
  getApmMetrics,
  getRecentTraces,
};
