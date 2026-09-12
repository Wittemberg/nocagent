const { SYSTEM_PROMPT } = require('./prompts');
const { createApprovalRequest, verifyApproval } = require('./approvals');
const { decryptCredentials } = require('../security/vault');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Ferramentas disponíveis para a IA
const TOOLS_DEFINITIONS = [
  {
    name: 'consultar_gateways_pfsense',
    description: 'Consulta o status de todos os gateways de internet configurados no pfSense (latência, perda de pacotes, status online/down).',
    input_schema: {
      type: 'object',
      properties: {
        equipmentId: {
          type: 'string',
          description: 'ID ou nome do pfSense a ser consultado (opcional)',
        },
      },
    },
  },
  {
    name: 'auditar_backups_s3',
    description: 'Verifica a saúde dos backups de equipamentos (Proxmox, pfSense, Mikrotik) armazenados no Storage S3 e checa atrasos.',
    input_schema: {
      type: 'object',
      properties: {
        periodHours: {
          type: 'number',
          description: 'Janela de tempo em horas para auditoria (padrão: 24 horas)',
        },
      },
    },
  },
  {
    name: 'solicitar_acao_critica',
    description: 'Dispara a trava de segurança Human-in-the-Loop quando o operador pede reinicialização de VM, desligamento de roteador ou queda de link.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Nome da ação (ex: REINICIAR_VM, REINICIAR_ROTEADOR)' },
        target: { type: 'string', description: 'Alvo técnico da ação' },
      },
      required: ['action', 'target'],
    },
  },
];

/**
 * Processador principal de mensagens do Hermes AI Engine
 */
async function processMessage({ text, senderPhone, senderName }) {
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

  // 3. Ações de impacto solicitadas em linguagem natural (exige 2FA / aprovação humana)
  if (normalized.includes('reiniciar') || normalized.includes('desligar') || normalized.includes('reboot') || normalized.includes('derrubar')) {
    const action = 'REINICIAR_EQUIPAMENTO';
    const target = text;
    const approval = createApprovalRequest(action, target, { requestedBy: senderPhone }, senderPhone);
    return approval.challengeMessage;
  }

  // 4. Auditoria REAL de Backups nos Storages e Equipamentos (prioritário sobre consultas genéricas)
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

  // 5. Consulta geral de Status dos Equipamentos / Links / Conectividade
  if (
    normalized.includes('equipamento') ||
    normalized.includes('status') ||
    normalized.includes('link') ||
    normalized.includes('gateway') ||
    normalized.includes('pfsense') ||
    normalized.includes('mikrotik') ||
    normalized.includes('proxmox') ||
    normalized.includes('zabbix') ||
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

  // 6. Integração com LLM (Anthropic Claude ou OpenAI)
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

  // 7. Resposta padrão caso nenhuma LLM responda
  return (
    `🤖 *NOC-Agent operacional (Modo Resiliente)*\n\n` +
    `Olá, *${senderName || 'Operador'}*! Recebi sua solicitação:\n` +
    `> "${text}"\n\n` +
    `Você pode me perguntar:\n` +
    `• *"Como estão os links do pfSense?"*\n` +
    `• *"Auditar backups recentes dos equipamentos"*\n` +
    `• *"Qual é o status das VMs do Proxmox?"*`
  );
}

module.exports = {
  processMessage,
};
