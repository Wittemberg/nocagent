const { getDecryptedEquipment } = require('../equipmentUtils');
const { getMikrotikMetrics } = require('../../drivers/mikrotik');

module.exports = {
  definition: {
    name: 'mikrotik_get_status',
    description: `Consulta métricas em tempo real de um Mikrotik RouterOS (compatível com v6.x e v7.x).
Retorna:
 - latency_ms: tempo de ida e volta (RTT) de uma conexão TCP entre ESTE SERVIDOR e o Mikrotik (em milissegundos). Quanto menor, melhor. Não é a velocidade do link de internet do cliente.
 - version: versão do RouterOS instalada no equipamento
 - cpu_load: percentual de uso da CPU do roteador
 - memory: uso de memória RAM do roteador
 - wan_links: lista de links WAN/Internet detectados, com status (ACTIVE/STANDBY/DOWN), tráfego acumulado e se é o link padrão ativo
 - active_wan: nome do link de internet ativo no momento
 - api_error: se preenchido, significa que o dispositivo está online (responde ping/TCP) mas a coleta de métricas falhou (credenciais inválidas, API desabilitada ou versão incompatível)`,
    parameters: {
      type: 'object',
      properties: {
        equipmentId: {
          type: 'string',
          description: 'ID ou Nome do Mikrotik cadastrado no cofre (opcional — se omitido, lista todos)',
        },
      },
    },
  },

  handler: async (args) => {
    const { eq, credentials } = await getDecryptedEquipment(args.equipmentId, 'MIKROTIK');
    const metrics = await getMikrotikMetrics(eq.host, credentials, eq.port);

    // Resumo compacto dos links WAN para o agente interpretar
    const wanSummary = (metrics.wanLinks || []).map(w => ({
      interface: w.name,
      label: w.comment || w.name,
      status: w.status,
      isActive: w.isActive,
      rx: w.formattedRx,
      tx: w.formattedTx,
    }));

    return {
      equipment: eq.name,
      host: eq.host,
      status: metrics.status,
      // Latência TCP RTT entre o servidor NOC e o equipamento
      latency_ms: metrics.lastLatency ?? null,
      latency_note: 'RTT TCP entre o servidor NOC-Agent e o Mikrotik. Não representa a velocidade do link de internet do cliente.',
      loss_percent: metrics.lastLossPercent ?? null,
      version: metrics.version || 'RouterOS (versão não detectada)',
      board: metrics.boardName || null,
      uptime: metrics.uptime || null,
      cpu_load: metrics.cpuLoadPercent != null ? `${metrics.cpuLoadPercent}%` : 'N/A',
      memory: metrics.memory
        ? {
            used_percent: `${metrics.memory.usedPercent}%`,
            free_mb: metrics.memory.freeBytes
              ? `${Math.round(metrics.memory.freeBytes / 1024 / 1024)} MB`
              : 'N/A',
            total_mb: metrics.memory.totalBytes
              ? `${Math.round(metrics.memory.totalBytes / 1024 / 1024)} MB`
              : 'N/A',
          }
        : null,
      active_wan: metrics.activeWanName || null,
      wan_links: wanSummary,
      api_error: metrics.apiError || null,
      api_note: metrics.apiError
        ? 'Dispositivo acessível na rede mas API indisponível. Verifique credenciais no cofre ou se a API RouterOS está habilitada (/ip/service).'
        : null,
    };
  },
};
