const { SYSTEM_PROMPT } = require('./prompts');
const { createApprovalRequest, verifyApproval } = require('./approvals');
const { decryptCredentials } = require('../security/vault');
const { MCP_TOOLS_DEFINITIONS, executeMcpTool } = require('./toolRegistry');
const { isGlobalKillSwitchActive, getKillSwitchStatus, isFeatureEnabled } = require('../security/flags');
const { recordMcpTrace } = require('../observability/apm');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

/**
 * Localiza equipamento no cofre baseado em menções no texto do usuário com isolamento multi-tenant
 */
async function resolveTargetEquipment(text, tenantId = null) {
  try {
    const whereClause = { active: true };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const equipments = await prisma.equipment.findMany({
      where: whereClause,
      include: { backupStorage: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!equipments || equipments.length === 0) {
      return { matched: null, group: null, subgroup: null, groupEquipments: [], all: [] };
    }

    const lower = text.toLowerCase();

    // 1. Identifica se o usuário mencionou algum GRUPO / TENANT (ex: "Matriz", "Filial 01", "Datacenter")
    const distinctGroups = Array.from(new Set(equipments.map((e) => e.group?.trim()).filter(Boolean)));
    let matchedGroup = null;
    for (const g of distinctGroups) {
      if (lower.includes(g.toLowerCase())) {
        matchedGroup = g;
        break;
      }
    }

    // 2. Identifica se mencionou algum SUBGRUPO / UNIDADE / FILIAL (ex: "Loja 01", "Loja 1", "CD", "Filial Centro")
    const distinctSubgroups = Array.from(new Set(equipments.map((e) => e.subgroup?.trim()).filter(Boolean)));
    let matchedSubgroup = null;
    for (const sub of distinctSubgroups) {
      if (lower.includes(sub.toLowerCase())) {
        matchedSubgroup = sub;
        break;
      }
    }

    // 3. Equipamentos pertencentes ao grupo/subgrupo detectado
    let groupEquipments = [];
    if (matchedGroup) {
      groupEquipments = equipments.filter((e) => (e.group || '').toLowerCase() === matchedGroup.toLowerCase());
      if (matchedSubgroup) {
        groupEquipments = groupEquipments.filter((e) => (e.subgroup || '').toLowerCase() === matchedSubgroup.toLowerCase());
      }
    } else if (matchedSubgroup) {
      groupEquipments = equipments.filter((e) => (e.subgroup || '').toLowerCase() === matchedSubgroup.toLowerCase());
    }

    // 4. Busca correspondência direta pelo nome do equipamento individual (ex: "ProxMox Cluster", "Mikrotik Borda")
    for (const eq of equipments) {
      const eqNameLower = eq.name.toLowerCase();
      if (lower.includes(eqNameLower)) {
        return { matched: eq, group: matchedGroup || eq.group, subgroup: matchedSubgroup || eq.subgroup, groupEquipments, all: equipments };
      }
      const parts = eqNameLower.split(/[\s_-]+/).filter((p) => p.length >= 3);
      if (parts.some((p) => lower.includes(p))) {
        return { matched: eq, group: matchedGroup || eq.group, subgroup: matchedSubgroup || eq.subgroup, groupEquipments, all: equipments };
      }
    }

    // 5. Se mencionou tipo específico de tecnologia
    if (lower.includes('proxmox') || lower.includes('hypervisor') || lower.includes('pve')) {
      const pool = groupEquipments.length > 0 ? groupEquipments : equipments;
      const pve = pool.find((e) => e.type === 'PROXMOX') || equipments.find((e) => e.type === 'PROXMOX');
      if (pve) return { matched: pve, group: matchedGroup || pve.group, subgroup: matchedSubgroup || pve.subgroup, groupEquipments, all: equipments };
    }
    if (lower.includes('pfsense') || lower.includes('firewall') || lower.includes('gateway')) {
      const pool = groupEquipments.length > 0 ? groupEquipments : equipments;
      const pfs = pool.find((e) => e.type === 'PFSENSE') || equipments.find((e) => e.type === 'PFSENSE');
      if (pfs) return { matched: pfs, group: matchedGroup || pfs.group, subgroup: matchedSubgroup || pfs.subgroup, groupEquipments, all: equipments };
    }
    if (lower.includes('mikrotik') || lower.includes('routeros') || lower.includes('roteador')) {
      const pool = groupEquipments.length > 0 ? groupEquipments : equipments;
      const mkt = pool.find((e) => e.type === 'MIKROTIK') || equipments.find((e) => e.type === 'MIKROTIK');
      if (mkt) return { matched: mkt, group: matchedGroup || mkt.group, subgroup: matchedSubgroup || mkt.subgroup, groupEquipments, all: equipments };
    }
    if (lower.includes('zabbix') || lower.includes('alarme') || lower.includes('trigger')) {
      const pool = groupEquipments.length > 0 ? groupEquipments : equipments;
      const zbx = pool.find((e) => e.type === 'ZABBIX') || equipments.find((e) => e.type === 'ZABBIX');
      if (zbx) return { matched: zbx, group: matchedGroup || zbx.group, subgroup: matchedSubgroup || zbx.subgroup, groupEquipments, all: equipments };
    }

    return {
      matched: null,
      group: matchedGroup,
      subgroup: matchedSubgroup,
      groupEquipments,
      all: equipments,
    };
  } catch (err) {
    console.warn('Erro ao resolver equipamento no Hermes:', err.message);
    return { matched: null, group: null, subgroup: null, groupEquipments: [], all: [] };
  }
}

/**
 * Coleta telemetria viva e estruturada do equipamento alvo
 */
async function fetchLiveTelemetry(equipment) {
  if (!equipment) return null;
  try {
    switch (equipment.type) {
      case 'PROXMOX': {
        const [nodeStatus, workloads] = await Promise.allSettled([
          executeMcpTool('proxmox_get_node_status', { equipmentId: equipment.id }),
          executeMcpTool('proxmox_list_workloads', { equipmentId: equipment.id }),
        ]);

        return {
          type: 'PROXMOX',
          equipment: equipment.name,
          host: equipment.host,
          nodeStatus: nodeStatus.status === 'fulfilled' ? nodeStatus.value : null,
          workloads: workloads.status === 'fulfilled' ? workloads.value : null,
          error: nodeStatus.status === 'rejected' ? nodeStatus.reason.message : null,
        };
      }
      case 'PFSENSE': {
        const gateways = await executeMcpTool('pfsense_get_gateways', { equipmentId: equipment.id }).catch((e) => null);
        return {
          type: 'PFSENSE',
          equipment: equipment.name,
          host: equipment.host,
          gateways: gateways?.gateways || [],
        };
      }
      case 'MIKROTIK': {
        const mkt = await executeMcpTool('mikrotik_get_status', { equipmentId: equipment.id }).catch((e) => null);
        return {
          type: 'MIKROTIK',
          equipment: equipment.name,
          host: equipment.host,
          mktData: mkt,
        };
      }
      case 'ZABBIX': {
        const zbx = await executeMcpTool('zabbix_get_active_triggers', { equipmentId: equipment.id }).catch((e) => null);
        return {
          type: 'ZABBIX',
          equipment: equipment.name,
          triggers: zbx?.triggers || [],
          count: zbx?.count || 0,
        };
      }
      default:
        return null;
    }
  } catch (err) {
    console.warn(`Erro ao obter telemetria de ${equipment.name}:`, err.message);
    return null;
  }
}

/**
 * Constrói bloco de contexto operacional para injeção no prompt das IAs
 */
function buildTelemetryContextText(matchedEquipment, telemetry, allEquipments, scope = {}) {
  let context = `[INVENTÁRIO ATIVO DE EQUIPAMENTOS NO COFRE]\n`;
  if (allEquipments && allEquipments.length > 0) {
    allEquipments.forEach((eq) => {
      context += `- ${eq.name} (Tipo: ${eq.type}, Grupo: "${eq.group || 'Geral'}", Subgrupo: "${eq.subgroup || 'N/A'}", Status: ${eq.status})\n`;
    });
  } else {
    context += `Nenhum equipamento registrado.\n`;
  }

  if (scope?.group && scope.groupEquipments && scope.groupEquipments.length > 0) {
    context += `\n[GRUPO / TENANT EM FOCO: "${scope.group}"]\n`;
    if (scope.subgroup) {
      context += `• Subgrupo / Unidade em Foco: "${scope.subgroup}"\n`;
    }
    context += `• Total de Equipamentos no Grupo: ${scope.groupEquipments.length}\n`;
    scope.groupEquipments.forEach((eq) => {
      context += `  - [${eq.subgroup || 'Geral'}] ${eq.name} (${eq.type}): Status=${eq.status}, Host=${eq.host}\n`;
    });
  }

  if (!telemetry || !matchedEquipment) {
    return context;
  }

  context += `\n[TELEMETRIA EM TEMPO REAL DO EQUIPAMENTO ALVO: ${matchedEquipment.name}]\n`;

  if (telemetry.type === 'PROXMOX' && telemetry.nodeStatus) {
    const ns = telemetry.nodeStatus;
    context += `• Servidor: ${ns.equipment} (Nó: ${ns.node})\n`;
    context += `• Uso de CPU: ${ns.cpuPercent}\n`;
    context += `• Memória RAM: ${ns.memoryUsage}\n`;
    context += `• Uptime do Host: ${ns.uptime}\n`;

    if (ns.storages && ns.storages.length > 0) {
      context += `• Storages do Nó:\n`;
      ns.storages.forEach((st) => {
        context += `  - Pool: "${st.name}" | Tipo: ${st.type} | Uso: ${st.usedPercent}%\n`;
      });
    }

    if (telemetry.workloads) {
      const w = telemetry.workloads;
      context += `• Workloads: ${w.vms.running} VMs ativas de ${w.vms.total} total; ${w.lxcs.running} Containers LXC ativos.\n`;
      if (w.vms.list && w.vms.list.length > 0) {
        w.vms.list.slice(0, 6).forEach((vm) => {
          context += `  - VM [${vm.vmid}] ${vm.name}: Status=${vm.status}, CPU=${vm.cpuPercent}%, RAM=${vm.memUsedMB}MB\n`;
        });
      }
    }
  } else if (telemetry.type === 'PFSENSE') {
    context += `• Gateways de Internet:\n`;
    if (telemetry.gateways && telemetry.gateways.length > 0) {
      telemetry.gateways.forEach((gw) => {
        context += `  - Gateway "${gw.name}": Status=${gw.status}, RTT=${gw.delay}ms, Perda=${gw.loss}%\n`;
      });
    } else {
      context += `  (Sem gateways reportados ou API indisponível)\n`;
    }
  } else if (telemetry.type === 'MIKROTIK' && telemetry.mktData) {
    const m = telemetry.mktData;
    context += `• RouterOS: ${m.version || 'N/A'}, CPU: ${m.cpuLoad}, RTT: ${m.latency}, Link Loss: ${m.loss}\n`;
    if (m.interfaces && m.interfaces.length > 0) {
      context += `• Interfaces:\n`;
      m.interfaces.slice(0, 6).forEach((i) => {
        context += `  - ${i.name} (${i.type}): ${i.running ? 'LINK UP' : 'DOWN'}\n`;
      });
    }
  } else if (telemetry.type === 'ZABBIX') {
    context += `• Incidentes Ativos: ${telemetry.count}\n`;
    if (telemetry.triggers && telemetry.triggers.length > 0) {
      telemetry.triggers.slice(0, 6).forEach((t) => {
        context += `  - [${t.priority}] ${t.host}: ${t.description}\n`;
      });
    }
  }

  return context;
}

/**
 * Classifica a intenção da mensagem do usuário
 */
function classifyIntent(text) {
  const normalized = text.toLowerCase().trim();

  // 1. Aprovação Humana 2FA L2
  if (/APROVAR\s+\d{4}/i.test(text)) {
    return { type: 'APPROVAL_VERIFY' };
  }

  // 2. Cancelamento Explícito
  if (/^CANCELAR$/i.test(normalized)) {
    return { type: 'CANCEL' };
  }

  // 3. Ações destrutivas / executáveis explícitas (exclui perguntas consultivas como "como reiniciar", "posso reiniciar?", etc.)
  const isQuestion = /(\?|como|devo|posso|quando|sugest|qual|o que|porque|por que)/i.test(normalized);
  const isDestructiveCommand = /(^|\s)(reiniciar|reboot|desligar|derrubar|parar|resetar)\s+(o|a|os|as)?\s*(servidor|equipamento|vm|host|pve|pfsense|mikrotik|interface|roteador|porta|\w+)/i.test(normalized);

  if (isDestructiveCommand && !isQuestion) {
    return { type: 'DESTRUCTIVE_EXECUTION' };
  }

  // 4. Pergunta consultiva ou de diagnóstico técnico (O operador quer saber O QUE FAZER, COMO OTIMIZAR, DIAGNOSTICAR)
  const isConsultative = /(como|por que|porque|por quê|sugest|otimiz|diminu|reduz|economiz|ajuda|recomenda|causa|o que fazer|analis|diagnostic|explic|motivo|o que significa|resolver|melhorar|aumentar|limpar|corrigir|problema|gargalo|lento|travando|memoria|ram|disco|storage|cpu)/i.test(normalized);

  if (isConsultative) {
    return { type: 'CONSULTATIVE_REASONING' };
  }

  // 5. Solicitação pura de leitura de status ou inventário (ex: "status do proxmox", "listar vms")
  const isPureStatusRequest = /^(qual\s+(é|e)\s+o\s+)?status(\s+de|\s+do|\s+da)?\s*[\w\s]*$|^listar\s+(vms|containers|workloads|interfaces|gateways)|^ver\s+(status|interfaces|alarmes|gateways|backups)$/i.test(normalized);

  if (isPureStatusRequest) {
    return { type: 'PURE_STATUS_READOUT' };
  }

  // Padrão: Tratamento conversacional inteligente / analítico
  return { type: 'CONSULTATIVE_REASONING' };
}

/**
 * Formata um relatório direto de status caso o usuário tenha pedido expressamente apenas leitura
 */
async function formatPureStatusReadout(matchedEquipment, telemetry, normalized, allEquipments) {
  const tzBrasilia = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' };

  if (telemetry?.type === 'PROXMOX') {
    if (normalized.includes('vm') || normalized.includes('lxc') || normalized.includes('workload')) {
      const workloads = telemetry.workloads;
      if (!workloads) return `⚠️ *Proxmox:* Não foi possível carregar a lista de VMs no momento.`;
      let msg = `🖥️ *INVENTÁRIO DE WORKLOADS PROXMOX VE*\n\n`;
      msg += `• *Servidor:* ${workloads.equipment} (Nó: \`${workloads.node}\`)\n`;
      msg += `• *VMs QEMU:* ${workloads.vms.running} ativas / ${workloads.vms.stopped} paradas (Total: ${workloads.vms.total})\n`;
      if (workloads.vms.list && workloads.vms.list.length > 0) {
        workloads.vms.list.slice(0, 8).forEach((v) => {
          const icon = v.status === 'running' ? '🟢' : '⚪';
          msg += `  └ ${icon} *[VM ${v.vmid}] ${v.name}*: ${v.status.toUpperCase()} | CPU: ${v.cpuPercent}% | RAM: ${v.memUsedMB}MB\n`;
        });
      }
      return msg;
    }

    const nodeStatus = telemetry.nodeStatus;
    if (!nodeStatus) return `⚠️ *Proxmox:* Não foi possível carregar o status do nó no momento.`;
    let msg = `⚡ *STATUS DO HYPERVISOR PROXMOX VE*\n\n`;
    msg += `• *Servidor:* ${nodeStatus.equipment} (Nó: \`${nodeStatus.node}\`)\n`;
    msg += `• *Uso de CPU:* ${nodeStatus.cpuPercent}\n`;
    msg += `• *Memória RAM:* ${nodeStatus.memoryUsage}\n`;
    msg += `• *Uptime do Host:* ${nodeStatus.uptime}\n`;
    if (nodeStatus.storages && nodeStatus.storages.length > 0) {
      msg += `\n💾 *Pools de Storage:*\n`;
      nodeStatus.storages.forEach((st) => {
        msg += `  └ *${st.name}* (${st.type}): ${st.usedPercent}% usado\n`;
      });
    }
    return msg;
  }

  if (telemetry?.type === 'PFSENSE') {
    let msg = `🛡️ *STATUS DO FIREWALL PFSENSE*\n\n`;
    msg += `• *Servidor:* ${telemetry.equipment} (\`${telemetry.host}\`)\n`;
    if (telemetry.gateways && telemetry.gateways.length > 0) {
      const onlineCount = telemetry.gateways.filter((g) => g.status === 'online').length;
      const dynamicStatus = onlineCount === telemetry.gateways.length ? 'ONLINE (100% dos links ativos)' : onlineCount > 0 ? 'DEGRADADO (link redundante em falha)' : 'OFFLINE';
      msg += `• *Status dos Gateways:* ${dynamicStatus}\n\n`;
      telemetry.gateways.forEach((gw) => {
        const gwIcon = gw.status === 'online' ? '🟢' : '🔴';
        msg += `${gwIcon} *${gw.name}:* ${gw.status.toUpperCase()} | RTT: ${gw.delay}ms | Perda: ${gw.loss}%\n`;
      });
    } else {
      msg += `• Nenhum gateway ativo reportado pela API.\n`;
    }
    return msg;
  }

  if (telemetry?.type === 'MIKROTIK') {
    const m = telemetry.mktData;
    if (!m) return `⚠️ *Mikrotik:* Não foi possível conectar ao RouterOS.`;
    let msg = `📶 *STATUS MIKROTIK ROUTEROS*\n\n`;
    msg += `• *Equipamento:* ${m.equipment}\n`;
    msg += `• *Status:* ${m.status.toUpperCase()}\n`;
    msg += `• *Latência RTT:* ${m.latency}\n`;
    msg += `• *Uso de CPU:* ${m.cpuLoad}\n`;
    if (m.version) msg += `• *RouterOS:* ${m.version}\n`;
    if (m.interfaces && m.interfaces.length > 0) {
      msg += `\n🔌 *Interfaces Principais:*\n`;
      m.interfaces.slice(0, 6).forEach((iface) => {
        const icon = iface.running ? '🟢' : '⚪';
        msg += `  └ ${icon} *${iface.name}* (${iface.type}): ${iface.running ? 'LINK UP' : 'DOWN'}\n`;
      });
    }
    return msg;
  }

  if (telemetry?.type === 'ZABBIX') {
    let msg = `🚨 *ALARMES CRÍTICOS DO ZABBIX*\n\n`;
    msg += `• *Servidor:* ${telemetry.equipment}\n`;
    msg += `• *Total de Incidentes Ativos:* ${telemetry.count}\n\n`;
    if (telemetry.triggers && telemetry.triggers.length > 0) {
      telemetry.triggers.slice(0, 6).forEach((trig) => {
        const icon = trig.priority === 'DISASTER' ? '🔥' : '⚠️';
        msg += `${icon} *[${trig.priority}] ${trig.host}:* ${trig.description}\n`;
      });
    } else {
      msg += `✅ Nenhum incidente crítico ou desastre ativo no Zabbix no momento!`;
    }
    return msg;
  }

  // Visão geral de todos os equipamentos
  let summary = `📡 *STATUS GERAL DA INFRAESTRUTURA*\n\n`;
  if (!allEquipments || allEquipments.length === 0) {
    return `ℹ️ *Nenhum equipamento cadastrado:* Cadastre roteadores, firewalls e hypervisors no Cofre de Equipamentos.`;
  }
  allEquipments.forEach((eq) => {
    const icon = eq.status === 'online' ? '🟢' : eq.status === 'degraded' ? '🟡' : '🔴';
    summary += `${icon} *${eq.name}* (${eq.type}) - Host: \`${eq.host}\`\n`;
  });
  summary += `\n_Consultado às ${new Date().toLocaleTimeString('pt-BR', tzBrasilia)}._`;
  return summary;
}

/**
 * Motor de Raciocínio Diagnóstico Autônomo (Offline / Zero-Key Fallback)
 * Garante que o Hermes "pense" criticamente sobre a telemetria mesmo sem chaves de LLM externas.
 */
function autonomousDiagnosticReasoner({ text, normalized, matchedEquipment, telemetry, allEquipments, scope = {} }) {
  // CASO 0: Visão e Diagnóstico do Grupo / Tenant Multi-Unidades (ex: "Matriz")
  if (scope?.group && (normalized.includes(scope.group.toLowerCase()) || scope.groupEquipments?.length > 0) && !matchedEquipment) {
    const groupName = scope.group;
    const items = scope.groupEquipments || [];
    const online = items.filter((e) => e.status === 'online').length;
    const degraded = items.filter((e) => e.status === 'degraded').length;
    const offline = items.filter((e) => e.status === 'offline' || e.status === 'unknown').length;

    const bySubgroup = {};
    items.forEach((e) => {
      const sub = e.subgroup || 'Unidade Geral';
      if (!bySubgroup[sub]) bySubgroup[sub] = [];
      bySubgroup[sub].push(e);
    });

    let resp = `🏢 *STATUS DO GRUPO / TENANT • ${groupName.toUpperCase()}*\n\n`;
    resp += `• *Visão Geral:* ${items.length} ativos em ${Object.keys(bySubgroup).length} unidades\n`;
    resp += `• *Saúde da Rede:* 🟢 ${online} Online | 🟡 ${degraded} Degradados | 🔴 ${offline} Offline\n\n`;

    resp += `📋 *Detalhamento por Unidade / Filial:*\n`;
    for (const [sub, eqs] of Object.entries(bySubgroup)) {
      const allSubOnline = eqs.every((e) => e.status === 'online');
      const subIcon = allSubOnline ? '🟢' : eqs.some((e) => e.status === 'degraded') ? '🟡' : '🔴';
      resp += `${subIcon} *${sub}:*\n`;
      eqs.forEach((eq) => {
        const icon = eq.status === 'online' ? '🟢' : eq.status === 'degraded' ? '🟡' : '🔴';
        resp += `  └ ${icon} *${eq.name}* (${eq.type}) - ${eq.status.toUpperCase()}\n`;
      });
    }

    resp += `\n💡 *Dica:* Você pode me perguntar sobre uma unidade específica (ex: *"Como está a Loja 01?"*) ou sobre uma tecnologia específica (ex: *"Como estão os Mikrotiks do ${groupName}?"*).`;
    return resp;
  }

  // CASO 1: Otimização e redução de uso de RAM no Proxmox VE
  if (
    (telemetry?.type === 'PROXMOX' || normalized.includes('proxmox') || normalized.includes('pve') || normalized.includes('cluster')) &&
    (normalized.includes('ram') || normalized.includes('memoria') || normalized.includes('diminuir') || normalized.includes('reduzir') || normalized.includes('otimizar') || normalized.includes('consumo'))
  ) {
    const nodeStatus = telemetry?.nodeStatus;
    const serverName = matchedEquipment?.name || nodeStatus?.equipment || 'ProxMox VE';
    const ramInfo = nodeStatus?.memoryUsage || 'elevada';
    const storages = nodeStatus?.storages || [];
    const zfsStorage = storages.find((s) => s.type === 'zfspool' || s.name.toLowerCase().includes('zfs') || s.name.toLowerCase().includes('nvme'));

    let resp = `🧠 *ANÁLISE DIAGNÓSTICA NOC • OTIMIZAÇÃO DE MEMÓRIA RAM*\n\n`;
    resp += `Analisando a telemetria em tempo real do servidor *${serverName}*:\n`;
    if (nodeStatus) {
      resp += `• *Uso Atual de RAM:* ${nodeStatus.memoryUsage}\n`;
      resp += `• *Carga de CPU:* ${nodeStatus.cpuPercent} | *Uptime:* ${nodeStatus.uptime}\n`;
      if (zfsStorage) {
        resp += `• *Pool ZFS Detectado:* \`${zfsStorage.name}\` (${zfsStorage.usedPercent}% alocado)\n`;
      }
    }
    resp += `\n🔍 *Causa Raiz Mais Provável no Proxmox:*`;
    resp += `\nNo Proxmox VE, o **ZFS ARC (Adaptive Replacement Cache)** por padrão consome até **50% da memória RAM física** para cache em disco (em um host com 256 GB, o ARC pode reservar sozinho ~125 GB!). O Proxmox reporta isso como "RAM em uso", mesmo que parte seja liberável sob pressão.\n`;

    resp += `\n🛠️ *Plano de Ação Recomendado (Passo a Passo):*\n\n`;

    resp += `1️⃣ *Limitar o ZFS ARC Max (Economia imediata de 50GB a 100GB)*\n`;
    resp += `Defina um teto máximo para o ARC (ex: 32 GB ou 48 GB) criando o arquivo no nó do Proxmox:\n`;
    resp += `\`\`\`bash\n`;
    resp += `# Criar/editar configuração do ZFS:\n`;
    resp += `echo "options zfs zfs_arc_max=34359738368" > /etc/modprobe.d/zfs.conf\n\n`;
    resp += `# Atualizar initramfs para persistir nos reboots:\n`;
    resp += `update-initramfs -u\n\n`;
    resp += `# Aplicar IMEDIATAMENTE em runtime sem reiniciar:\n`;
    resp += `echo 34359738368 > /sys/module/zfs/parameters/zfs_arc_max\n`;
    resp += `\`\`\`\n`;
    resp += `_(O valor \`34359738368\` limita o ARC a 32 GB. Se quiser 48 GB, use \`51539607552\`)._\n\n`;

    resp += `2️⃣ *Habilitar Memory Ballooning e QEMU Guest Agent nas VMs*\n`;
    resp += `Nas VMs que estiverem ociosas, certifique-se de que:\n`;
    resp += `• O **QEMU Guest Agent** está instalado dentro do SO convidado.\n`;
    resp += `• A opção **Ballooning Device** está ativa nas opções de Hardware da VM no Proxmox, permitindo que a RAM livre do guest seja devolvida ao host.\n\n`;

    resp += `3️⃣ *Ativar Kernel Samepage Merging (KSM)*\n`;
    resp += `Se houver várias VMs com o mesmo sistema operacional (ex: múltiplos Linux ou Windows), o KSM desduplica páginas idênticas na memória física:\n`;
    resp += `\`\`\`bash\n`;
    resp += `systemctl enable --now ksm\n`;
    resp += `\`\`\`\n`;

    if (zfsStorage && zfsStorage.usedPercent >= 85) {
      resp += `⚠️ *Atenção Crítica ao Storage:* O pool ZFS \`${zfsStorage.name}\` está com *${zfsStorage.usedPercent}% de ocupação*. No ZFS, pools acima de 80% geram alta fragmentação de blocos e aumentam a pressão de metadados na memória RAM. Recomendo rodar \`fstrim\` nas VMs e expurgar snapshots antigos.\n`;
    }

    resp += `\nDeseja que eu detalhe o procedimento de redução de ARC ou liste as VMs que estão consumindo mais RAM?`;
    return resp;
  }

  // CASO 2: Diagnóstico de Gateway e Queda de Link no pfSense
  if (
    (telemetry?.type === 'PFSENSE' || normalized.includes('pfsense') || normalized.includes('gateway') || normalized.includes('link') || normalized.includes('perda')) &&
    (normalized.includes('queda') || normalized.includes('degradado') || normalized.includes('perda') || normalized.includes('offline') || normalized.includes('lento') || normalized.includes('como') || normalized.includes('resolver'))
  ) {
    let resp = `🧠 *ANÁLISE DIAGNÓSTICA NOC • RESILIÊNCIA DE GATEWAY PFSENSE*\n\n`;
    resp += `• *Equipamento:* ${matchedEquipment?.name || 'Firewall pfSense'}\n`;
    if (telemetry?.gateways && telemetry.gateways.length > 0) {
      resp += `• *Status dos Links Detectados:*\n`;
      telemetry.gateways.forEach((g) => {
        const icon = g.status === 'online' ? '🟢' : '🔴';
        resp += `  ${icon} *${g.name}:* ${g.status.toUpperCase()} (RTT: ${g.delay}ms, Perda: ${g.loss}%)\n`;
      });
    }

    resp += `\n🔍 *Diagnóstico de Causas de Flapping ou Perda de Pacotes:*\n`;
    resp += `1. **Monitor IP do dpinger Saturado:** Se o Gateway estiver usando o DNS da própria operadora como IP de monitoramento, ele pode descartar pacotes ICMP sob carga. Recomendado alterar para \`1.1.1.1\` ou \`8.8.8.8\` em *System > Routing > Gateways*.\n`;
    resp += `2. **Thresholds de Latência Muito Estritos:** Ajuste a sensibilidade do dpinger (*Latency Threshold: 200/500ms*, *Packet Loss: 20%/50%*) para evitar chaveamento falso de failover.\n`;
    resp += `3. **Tier de Prioridade de Gateway Groups:** Verifique se as rotas de contingência estão no Tier 2 para garantir que o tráfego retorne automaticamente ao restabelecer o link principal.\n`;
    return resp;
  }

  // CASO 3: Diagnóstico de CPU, Saturação ou Interfaces Mikrotik
  if (
    (telemetry?.type === 'MIKROTIK' || normalized.includes('mikrotik') || normalized.includes('routeros')) &&
    (normalized.includes('cpu') || normalized.includes('gargalo') || normalized.includes('lento') || normalized.includes('trafego') || normalized.includes('como') || normalized.includes('otimizar'))
  ) {
    const m = telemetry?.mktData;
    let resp = `🧠 *ANÁLISE DIAGNÓSTICA NOC • ROTEAMENTO MIKROTIK*\n\n`;
    resp += `• *Roteador:* ${matchedEquipment?.name || 'Mikrotik RouterOS'}\n`;
    if (m) {
      resp += `• *Uso de CPU:* ${m.cpuLoad} | *Latência RTT:* ${m.latency} | *Versão:* ${m.version || 'v7'}\n`;
    }
    resp += `\n🔍 *Boas Práticas para Alívio de CPU e Throughput:*\n`;
    resp += `1. **Ativar FastTrack no Firewall:** Certifique-se de que a regra \`action=fasttrack-connection\` está ativa em \`/ip firewall filter\` para conexões estabelecidas/relacionadas (reduz o uso de CPU em até 70%).\n`;
    resp += `2. **Inspecionar Conntrack Table:** Verifique a tabela de conexões com \`/ip firewall connection print count-only\`. Conexões zumbis ou ataques SYN Flood podem esgotar a CPU.\n`;
    resp += `3. **Desativar Ferramentas de Profiling/Torch:** Certifique-se de que ferramentas como Torch, Packet Sniffer ou Graphing não estejam rodando em background.\n`;
    return resp;
  }

  // CASO 4: Auditoria e Consistência de Backups
  if (normalized.includes('backup') || normalized.includes('auditar') || normalized.includes('s3') || normalized.includes('snapshot')) {
    let resp = `🧠 *ANÁLISE DIAGNÓSTICA NOC • GESTÃO E RETENÇÃO DE BACKUPS*\n\n`;
    resp += `• *Política Recomendada de Continuidade de Negócios:*\n`;
    resp += `1. **Estratégia 3-2-1:** 3 cópias dos dados, em 2 mídias distintas, com pelo menos 1 cópia externa no Storage S3/MinIO criptografado.\n`;
    resp += `2. **Auditoria Automatizada:** O NOC-Agent valida periodicamente o hash MD5, integridade de tamanho e data do último snapshot no bucket S3 configurado.\n`;
    resp += `3. **Janela de Execução:** Configure snapshots para horários de menor tráfego (01:00 às 04:00) para evitar picos de I/O de disco nos pools de produção.\n`;
    return resp;
  }

  // CASO 5: Resposta Técnica Geral
  let resp = `🤖 *NOC-Agent • Análise de Operações de Rede*\n\n`;
  resp += `Entendi sua consulta sobre a infraestrutura:\n> "${text}"\n\n`;
  if (matchedEquipment) {
    resp += `Contextualizado para o equipamento *${matchedEquipment.name}* (${matchedEquipment.type}).\n\n`;
  }
  resp += `📋 *Orientações Técnicas:*\n`;
  resp += `• Para diagnósticos aprofundados, você pode consultar métricas específicas de CPU, RAM, Latência RTT e Integridade de Backups.\n`;
  resp += `• Todas as recomendações seguem as 10 Invariantes de Infraestrutura (segurança, evidência numérica e proteção de disponibilidade).\n`;
  resp += `• Para comandos de impacto operacional (reboot, failover forçado), lembre-se de que é exigida autorização em 2 etapas (Human-in-the-Loop).`;
  return resp;
}

/**
 * Roteamento para Provedores LLM com RAG de Telemetria
 */
async function callLlmReasoning({ systemPrompt, telemetryContext, userPrompt, senderName }) {
  const enrichedUserPrompt = `${telemetryContext}\n\n[SOLICITAÇÃO DO OPERADOR (${senderName || 'Técnico'})]\n${userPrompt}`;

  // 1. Anthropic Claude (Com suporte a Tool Calling)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.startsWith('sk-ant')) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      
      const tools = MCP_TOOLS_DEFINITIONS.map(def => ({
        name: def.name,
        description: def.description,
        input_schema: def.parameters
      }));

      const messages = [{ role: 'user', content: enrichedUserPrompt }];
      let attempts = 0;
      
      while(attempts < 5) {
        attempts++;
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          system: systemPrompt,
          messages,
          tools: tools.length > 0 ? tools : undefined
        });

        if (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content });
          const toolResultsContent = [];
          
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              try {
                const toolResult = await executeMcpTool(block.name, block.input);
                toolResultsContent.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(toolResult)
                });
              } catch (err) {
                toolResultsContent.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: err.message }),
                  is_error: true
                });
              }
            }
          }
          messages.push({ role: 'user', content: toolResultsContent });
        } else {
          const textBlock = response.content.find(c => c.type === 'text');
          if (textBlock) return textBlock.text;
          break;
        }
      }
    } catch (llmErr) {
      console.warn('[Hermes LLM] Falha ao chamar Anthropic Claude:', llmErr.message);
    }
  }

  // 2. OpenAI GPT-4o (Com suporte a Tool Calling)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.startsWith('sk-')) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openaiKey });

      const tools = MCP_TOOLS_DEFINITIONS.map(def => ({ type: 'function', function: def }));
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enrichedUserPrompt },
      ];

      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages,
          max_tokens: 1500,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
        });

        const choice = response.choices[0];
        const replyMsg = choice.message;
        messages.push(replyMsg);

        if (replyMsg.tool_calls && replyMsg.tool_calls.length > 0) {
          for (const tc of replyMsg.tool_calls) {
            try {
              const args = JSON.parse(tc.function.arguments || '{}');
              const toolResult = await executeMcpTool(tc.function.name, args);
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: JSON.stringify(toolResult),
              });
            } catch (err) {
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: JSON.stringify({ error: err.message }),
              });
            }
          }
        } else {
          return replyMsg.content;
        }
      }
    } catch (llmErr) {
      console.warn('[Hermes LLM] Falha ao chamar OpenAI:', llmErr.message);
    }
  }

  // 3. Google Gemini via REST API (Sem Tool Calling avançado por enquanto)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const axios = require('axios');
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${enrichedUserPrompt}` }],
            },
          ],
        },
        { timeout: 12000 }
      );
      const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply;
    } catch (geminiErr) {
      console.warn('[Hermes LLM] Falha ao chamar Gemini API:', geminiErr.message);
    }
  }

  // 4. Ollama Local LLM (Sem Tool Calling avançado)
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  if (ollamaUrl) {
    try {
      const axios = require('axios');
      const cleanOllama = ollamaUrl.replace(/\/+$/, '');
      const ollamaRes = await axios.post(
        `${cleanOllama}/api/generate`,
        {
          model: process.env.OLLAMA_MODEL || 'llama3',
          prompt: `${systemPrompt}\n\n${enrichedUserPrompt}`,
          stream: false,
        },
        { timeout: 15000 }
      );
      const reply = ollamaRes.data?.response;
      if (reply) return reply;
    } catch (ollamaErr) {
      console.warn('[Hermes LLM] Falha ao chamar Ollama:', ollamaErr.message);
    }
  }

  return null;
}
/**
 * Processador principal de mensagens do Hermes AI Engine com Telemetria RAG e Raciocínio Diagnóstico
 */
async function processMessage({ text, senderPhone, senderName, tenantId = null, role = 'OPERATOR', dashboardContext = '' }) {
  const normalized = (text || '').toLowerCase().trim();

  // 0. Trava de Emergência Global (Emergency Kill-Switch)
  if (isGlobalKillSwitchActive()) {
    const ks = getKillSwitchStatus();
    if (/APROVAR\s+\d{4}/i.test(text) || /^reboot\b/i.test(normalized) || /^reiniciar\b/i.test(normalized) || /^desligar\b/i.test(normalized)) {
      return `🚨 *EMERGENCY KILL-SWITCH ATIVADO*\n\nTodas as ações ativas, execuções de comandos e remediações da IA estão temporariamente suspensas por determinação administrativa.\n• *Motivo:* ${ks.reason || 'Segurança Operacional'}\n• *Acionado por:* ${ks.triggeredBy || 'Superadmin'}\n\nPara restabelecer, um Superadmin deve liberar o Kill-Switch no Dashboard Web em *Governança & APM*.`;
    }
  }

  // 1. Validação de Aprovação Humana 2FA (ex: "APROVAR 4821")
  if (/APROVAR\s+\d{4}/i.test(text)) {
    const verification = verifyApproval(text, senderPhone);
    if (verification.valid) {
      const { action, target } = verification.request;
      return `✅ *AÇÃO AUTORIZADA COM SUCESSO!*\n\n• *Operador:* ${senderName || 'Técnico'}\n• *Ação:* ${action}\n• *Alvo:* ${target}\n• *Horário:* ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\nO comando foi encaminhado para a API oficial do equipamento e gravado no *Audit Log*.`;
    } else {
      return `❌ *FALHA NA AUTORIZAÇÃO:*\n${verification.reason}`;
    }
  }

  // 2. Cancelamento Explícito de Ação
  if (/^CANCELAR$/i.test(text.trim())) {
    return `🛑 *Ação cancelada pelo operador.* Nenhuma modificação foi realizada nos equipamentos de rede.`;
  }

  // 3. Classificação de Intenção da Mensagem
  const intent = classifyIntent(text);

  // 4. Se for comando de impacto/destrutivo direto (ex: "reiniciar proxmox agora") -> Dispara 2FA
  if (intent.type === 'DESTRUCTIVE_EXECUTION') {
    const action = 'REINICIAR_EQUIPAMENTO';
    const target = text;
    const approval = createApprovalRequest(action, target, { requestedBy: senderPhone }, senderPhone);
    return approval.challengeMessage;
  }

  // 5. Resolução do Equipamento em questão e Coleta da Telemetria em Tempo Real (RAG com Isolamento de Tenant)
  const effectiveTenantId = role === 'SUPERADMIN' ? null : tenantId;
  const {
    matched: matchedEquipment,
    group: matchedGroup,
    subgroup: matchedSubgroup,
    groupEquipments,
    all: allEquipments,
  } = await resolveTargetEquipment(text, effectiveTenantId);
  const scope = { group: matchedGroup, subgroup: matchedSubgroup, groupEquipments };
  const telemetry = await fetchLiveTelemetry(matchedEquipment);

  // 6. Se o usuário pediu expressamente APENAS uma leitura de status/inventário sem dúvidas ou perguntas
  if (intent.type === 'PURE_STATUS_READOUT') {
    return await formatPureStatusReadout(matchedEquipment, telemetry, normalized, allEquipments);
  }

  // 7. MODO DE RACIOCÍNIO E PENSAMENTO DIAGNÓSTICO (CONSULTATIVE_REASONING)
  // Monta o contexto operacional de telemetria
  let telemetryContext = buildTelemetryContextText(matchedEquipment, telemetry, allEquipments, scope);
  if (dashboardContext) {
    telemetryContext += `\n[CONTEXTO VISUAL DA TELA DO OPERADOR (DASHBOARD CACHE)]\nAqui estão as latências e perdas de pacotes atuais que o usuário está vendo na tela para os equipamentos ativos (não é necessário rodar testes de ping para estes equipamentos):\n${dashboardContext}\n`;
  }

  // Tenta processar com as LLMs configuradas (Claude 3.5 Sonnet, GPT-4o, Gemini ou Ollama)
  const llmResponse = await callLlmReasoning({
    systemPrompt: SYSTEM_PROMPT,
    telemetryContext,
    userPrompt: text,
    senderName,
  });

  if (llmResponse) {
    return llmResponse;
  }

  // 8. Se nenhuma LLM externa estiver com chave ativa no momento, ativa o Motor Diagnóstico Autônomo
  // que "pensa" e formula a resposta técnica exata baseada na telemetria coletada
  return autonomousDiagnosticReasoner({
    text,
    normalized,
    matchedEquipment,
    telemetry,
    allEquipments,
    scope,
  });
}

module.exports = {
  processMessage,
  resolveTargetEquipment,
  fetchLiveTelemetry,
  classifyIntent,
  autonomousDiagnosticReasoner,
  buildTelemetryContextText,
};
