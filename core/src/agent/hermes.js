const { SYSTEM_PROMPT } = require('./prompts');
const { createApprovalRequest, verifyApproval } = require('./approvals');
const { decryptCredentials } = require('../security/vault');
const { MCP_TOOLS_DEFINITIONS, executeMcpTool } = require('./mcpTools');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

/**
 * Processador principal de mensagens do Hermes AI Engine com suporte a MCP
 */
async function processMessage({ text, senderPhone, senderName }) {
  const normalized = (text || '').toLowerCase().trim();

  // 1. Checa se é uma resposta de aprovação humana (ex: "APROVAR 4821")
  if (/APROVAR\s+\d{4}/i.test(text)) {
    const verification = verifyApproval(text, senderPhone);
    if (verification.valid) {
      const { action, target } = verification.request;
      return `✅ *AÇÃO AUTORIZADA COM SUCESSO!*\n\n• *Operador:* ${senderName || 'Técnico'}\n• *Ação:* ${action}\n• *Alvo:* ${target}\n• *Horário:* ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\nO comando foi encaminhado para a API oficial do equipamento e gravado no *Audit Log*.`;
    } else {
      return `❌ *FALHA NA AUTORIZAÇÃO:*\n${verification.reason}`;
    }
  }

  // 2. Se for cancelamento explícito
  if (/^CANCELAR$/i.test(text.trim())) {
    return `🛑 *Ação cancelada pelo operador.* Nenhuma modificação foi realizada nos equipamentos de rede.`;
  }

  // 3. Ações de impacto solicitadas em linguagem natural (exige 2FA / aprovação humana L2)
  if (normalized.includes('reiniciar') || normalized.includes('desligar') || normalized.includes('reboot') || normalized.includes('derrubar')) {
    const action = 'REINICIAR_EQUIPAMENTO';
    const target = text;
    const approval = createApprovalRequest(action, target, { requestedBy: senderPhone }, senderPhone);
    return approval.challengeMessage;
  }

  // 4. Proxmox VE (Nós, CPU, RAM, VMs QEMU e Containers LXC via MCP)
  if (
    normalized.includes('proxmox') ||
    normalized.includes('hypervisor') ||
    normalized.includes('vm') ||
    normalized.includes('vms') ||
    normalized.includes('lxc') ||
    normalized.includes('qemu')
  ) {
    try {
      if (normalized.includes('vm') || normalized.includes('lxc') || normalized.includes('workload') || normalized.includes('maquina')) {
        const workloads = await executeMcpTool('proxmox_list_workloads');
        let msg = `🖥️ *INVENTÁRIO DE WORKLOADS PROXMOX VE*\n\n`;
        msg += `• *Servidor:* ${workloads.equipment} (Nó: \`${workloads.node}\`)\n`;
        msg += `• *VMs QEMU:* ${workloads.vms.running} ativas / ${workloads.vms.stopped} paradas (Total: ${workloads.vms.total})\n`;
        if (workloads.vms.list.length > 0) {
          workloads.vms.list.slice(0, 8).forEach((v) => {
            const icon = v.status === 'running' ? '🟢' : '⚪';
            msg += `  └ ${icon} *[VM ${v.vmid}] ${v.name}*: ${v.status.toUpperCase()} | CPU: ${v.cpuPercent}% | RAM: ${v.memUsedMB}MB\n`;
          });
        }
        msg += `\n• *Containers LXC:* ${workloads.lxcs.running} ativos / ${workloads.lxcs.stopped} parados (Total: ${workloads.lxcs.total})\n`;
        if (workloads.lxcs.list.length > 0) {
          workloads.lxcs.list.slice(0, 5).forEach((c) => {
            const icon = c.status === 'running' ? '🟢' : '⚪';
            msg += `  └ ${icon} *[CT ${c.vmid}] ${c.name}*: ${c.status.toUpperCase()}\n`;
          });
        }
        return msg;
      }

      const nodeStatus = await executeMcpTool('proxmox_get_node_status');
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
    } catch (pveErr) {
      return `⚠️ *Aviso Proxmox:* ${pveErr.message}`;
    }
  }

  // 5. Mikrotik RouterOS (Interfaces, CPU, RTT via MCP)
  if (normalized.includes('mikrotik') || normalized.includes('routeros')) {
    try {
      const mkt = await executeMcpTool('mikrotik_get_status');
      let msg = `📶 *STATUS MIKROTIK ROUTEROS*\n\n`;
      msg += `• *Equipamento:* ${mkt.equipment}\n`;
      msg += `• *Status da Conexão:* ${mkt.status.toUpperCase()}\n`;
      msg += `• *Latência RTT:* ${mkt.latency}\n`;
      msg += `• *Uso de CPU:* ${mkt.cpuLoad}\n`;
      if (mkt.version) msg += `• *RouterOS:* ${mkt.version}\n`;
      if (mkt.interfaces && mkt.interfaces.length > 0) {
        msg += `\n🔌 *Interfaces Principais:*\n`;
        mkt.interfaces.slice(0, 6).forEach((iface) => {
          const icon = iface.running ? '🟢' : '⚪';
          msg += `  └ ${icon} *${iface.name}* (${iface.type}): ${iface.running ? 'LINK UP' : 'DOWN'}\n`;
        });
      }
      return msg;
    } catch (mktErr) {
      return `⚠️ *Aviso Mikrotik:* ${mktErr.message}`;
    }
  }

  // 6. Zabbix (Alarmes e Triggers via MCP)
  if (normalized.includes('zabbix') || normalized.includes('alarme') || normalized.includes('trigger')) {
    try {
      const zbx = await executeMcpTool('zabbix_get_active_triggers');
      let msg = `🚨 *ALARMES CRÍTICOS DO ZABBIX*\n\n`;
      msg += `• *Servidor:* ${zbx.equipment}\n`;
      msg += `• *Total de Incidentes Ativos:* ${zbx.count}\n\n`;
      if (zbx.triggers && zbx.triggers.length > 0) {
        zbx.triggers.slice(0, 6).forEach((trig) => {
          const icon = trig.priority === 'DISASTER' ? '🔥' : '⚠️';
          msg += `${icon} *[${trig.priority}] ${trig.host}:* ${trig.description}\n`;
        });
      } else {
        msg += `✅ Nenhum incidente crítico ou desastre ativo no Zabbix no momento!`;
      }
      return msg;
    } catch (zbxErr) {
      return `⚠️ *Aviso Zabbix:* ${zbxErr.message}`;
    }
  }

  // 7. Auditoria REAL de Backups nos Storages e Equipamentos
  if (
    normalized.includes('backup') ||
    normalized.includes('auditar') ||
    normalized.includes('auditoria') ||
    normalized.includes('snapshot')
  ) {
    try {
      const tzBrasilia = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' };
      const [equipments, audits, storages] = await Promise.all([
        prisma.equipment.findMany({
          where: { active: true },
          include: { backupStorage: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.backupAudit.findMany({
          take: 10,
          orderBy: { verifiedAt: 'desc' },
          include: {
            equipment: { select: { name: true, type: true } },
            storage: { select: { name: true, type: true } },
          },
        }),
        prisma.storage.findMany({
          where: { active: true },
        }),
      ]);

      if (equipments.length === 0) {
        return `ℹ️ *Nenhum equipamento cadastrado no Cofre:*\nCadastre os equipamentos na aba *Cofre de Equipamentos* para habilitar a auditoria e gestão de backups.`;
      }

      let summary = `💾 *AUDITORIA DE BACKUPS DOS EQUIPAMENTOS*\n\n`;

      if (audits.length > 0) {
        summary += `📋 *Últimos Backups Auditados no Storage:*\n`;
        audits.forEach((aud) => {
          const statusIcon = aud.status === 'SUCCESS' ? '🟢' : aud.status === 'FAILED' ? '🔴' : '🟡';
          const eqName = aud.equipment?.name || 'Equipamento';
          const stName = aud.storage?.name || aud.storageBucket || 'Storage';
          const sizeKb = aud.sizeBytes ? `${Math.round(Number(aud.sizeBytes) / 1024)} KB` : 'N/A';
          const dataHora = new Date(aud.verifiedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          summary += `${statusIcon} *${eqName}:* \`${aud.backupFile}\` (${sizeKb})\n`;
          summary += `  └ *Storage:* ${stName} | *Auditado em:* ${dataHora}\n`;
        });
      } else {
        summary += `📋 *Status de Backup por Equipamento:*\n`;
        equipments.forEach((eq) => {
          const hasStorage = !!eq.backupStorage;
          const storageName = hasStorage ? eq.backupStorage.name : 'Nenhum Storage vinculado';
          const schedule = eq.backupSchedule || 'MANUAL';
          summary += `• *${eq.name}* (${eq.type}):\n`;
          summary += `  └ *Storage Destino:* ${storageName}\n`;
          summary += `  └ *Rotina Agendada:* ${schedule}\n`;
          summary += `  └ *Último Arquivo:* Nenhum backup auditado registrado no banco ainda.\n`;
        });

        summary += `\nℹ️ *Storages Cadastrados:* ${storages.length > 0 ? storages.map((s) => s.name).join(', ') : 'Nenhum storage cadastrado (configure MinIO, S3 ou SFTP no Cofre de Storages)'}.\n`;
      }

      summary += `\n_Auditoria consultada no Cofre às ${new Date().toLocaleTimeString('pt-BR', tzBrasilia)}._`;
      return summary;
    } catch (err) {
      console.error('Erro ao auditar backups no Hermes:', err);
      return `⚠️ *Erro ao consultar auditoria de backups:* Não foi possível conectar ao banco (${err.message}).`;
    }
  }

  // 8. Consulta geral de Status dos Equipamentos / Links / Conectividade
  if (
    normalized.includes('equipamento') ||
    normalized.includes('status') ||
    normalized.includes('link') ||
    normalized.includes('gateway') ||
    normalized.includes('pfsense') ||
    normalized.includes('rede') ||
    normalized.includes('internet') ||
    normalized.includes('conectividade')
  ) {
    try {
      const equipments = await prisma.equipment.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
      });

      if (equipments.length === 0) {
        return `ℹ️ *Nenhum equipamento cadastrado no cofre:*\nPara que eu possa monitorar a infraestrutura em tempo real, cadastre os equipamentos (pfSense, Mikrotik, Proxmox, Zabbix) na aba *Cofre de Equipamentos* no painel web.`;
      }

      const tzBrasilia = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' };
      let summary = `📡 *STATUS DOS EQUIPAMENTOS DA REDE*\n\n`;

      for (const eq of equipments) {
        const icon = eq.status === 'online' ? '🟢' : eq.status === 'degraded' ? '🟡' : '🔴';
        summary += `${icon} *${eq.name}* (${eq.type})\n`;
        summary += `• *Host:* \`${eq.host}\`\n`;
        summary += `• *Status:* ${(eq.status || 'Ativo').toUpperCase()}\n`;

        // Se for pfSense, detalha gateways de internet
        if (eq.type === 'PFSENSE') {
          try {
            const creds = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
            const apiKey = typeof creds === 'object' ? (creds.apiKey || creds.key || creds.token || '') : String(creds);
            if (apiKey) {
              const targetUrl = eq.host.replace(/\/+$/, '');
              const res = await axios.get(`${targetUrl}/api/v2/status/gateways`, {
                headers: {
                  'X-API-Key': apiKey,
                  'Accept': 'application/json',
                },
                timeout: 6000,
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
              });
              const gateways = res.data?.data || [];
              if (gateways.length > 0) {
                const onlineCount = gateways.filter((g) => g.status === 'online').length;
                const dynamicStatus = onlineCount === gateways.length ? 'ONLINE (100% dos links ativos)' : onlineCount > 0 ? 'DEGRADADO (link redundante em falha)' : 'OFFLINE';
                summary += `• *Links de Internet:* ${dynamicStatus}\n`;
                gateways.forEach((gw) => {
                  const gwIcon = gw.status === 'online' ? '🟢' : '🔴';
                  summary += `  └ ${gwIcon} *${gw.name}:* ${gw.status.toUpperCase()} | RTT: ${gw.delay}ms | Perda: ${gw.loss}%\n`;
                });
              }
            }
          } catch (pfsenseErr) {
            console.warn('Erro ao consultar gateways pfSense no Hermes:', pfsenseErr.message);
          }
        }
        summary += `\n`;
      }

      summary += `_Dados consultados no Cofre às ${new Date().toLocaleTimeString('pt-BR', tzBrasilia)}._`;
      return summary;
    } catch (err) {
      return `⚠️ *Erro ao consultar status dos equipamentos:* Não foi possível conectar ao cofre (${err.message}).`;
    }
  }

  // 9. Integração com LLM (Anthropic Claude ou OpenAI) com MCP Tools
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.startsWith('sk-ant')) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: anthropicKey });

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      });

      return response.content[0]?.text || 'NOC-Agent operacional.';
    } catch (llmErr) {
      console.error('Erro na chamada Anthropic:', llmErr.message);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.startsWith('sk-')) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openaiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 1024,
      });

      return response.choices[0]?.message?.content || 'NOC-Agent operacional.';
    } catch (llmErr) {
      console.error('Erro na chamada OpenAI:', llmErr.message);
    }
  }

  // 10. Resposta padrão caso nenhuma LLM responda
  return (
    `🤖 *NOC-Agent operacional (Modo Resiliente)*\n\n` +
    `Olá, *${senderName || 'Operador'}*! Recebi sua solicitação:\n` +
    `> "${text}"\n\n` +
    `Você pode consultar via MCP:\n` +
    `• *"Qual é o status do Proxmox e uso de CPU/RAM?"*\n` +
    `• *"Listar VMs e containers do Proxmox"*\n` +
    `• *"Como estão as interfaces e CPU do Mikrotik?"*\n` +
    `• *"Como estão os gateways do pfSense?"*\n` +
    `• *"Auditar backups recentes dos equipamentos"*\n` +
    `• *"Listar alarmes ativos do Zabbix"*`
  );
}

module.exports = {
  processMessage,
};
