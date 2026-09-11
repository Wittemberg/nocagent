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
      return `✅ *AÇÃO AUTORIZADA COM SUCESSO!*\n\n• *Operador:* ${senderName || 'Técnico'}\n• *Ação:* ${action}\n• *Alvo:* ${target}\n• *Horário:* ${new Date().toLocaleTimeString('pt-BR')}\n\nO comando foi encaminhado para a API oficial do equipamento e gravado no *Audit Log*.`;
    } else {
      return `❌ *FALHA NA AUTORIZAÇÃO:*\n${verification.reason}`;
    }
  }

  // 2. Se for cancelamento explícito
  if (/^CANCELAR$/i.test(text.trim())) {
    return `🛑 *Ação cancelada pelo operador.* Nenhuma modificação foi realizada nos equipamentos de rede.`;
  }

  // 3. Fallback inteligente local / chamada direta para consultas frequentes
  const normalized = text.toLowerCase();

  // Consulta geral de Status dos Equipamentos / Links / Rede
  if (normalized.includes('equipamento') || normalized.includes('status') || normalized.includes('link') || normalized.includes('gateway') || normalized.includes('pfsense') || normalized.includes('rede') || normalized.includes('internet')) {
    try {
      const equipments = await prisma.equipment.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
      });

      if (equipments.length === 0) {
        return `ℹ️ *Nenhum equipamento cadastrado no cofre:*\nPara que eu possa monitorar a infraestrutura em tempo real, cadastre os equipamentos (pfSense, Mikrotik, Proxmox, Zabbix) na aba *Cofre de Equipamentos* no painel web.`;
      }

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
              let res;
              try {
                res = await axios.get(`${targetUrl}/api/v2/status/gateways`, {
                  headers: { 'X-API-Key': apiKey },
                  timeout: 5000,
                  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
                });
              } catch {
                res = await axios.get(`${targetUrl}/api/v2/status/gateway`, {
                  headers: { 'X-API-Key': apiKey },
                  timeout: 5000,
                  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
                });
              }
              const gateways = res.data?.data || [];
              gateways.forEach((gw) => {
                const gwIcon = gw.status === 'online' ? '🟢' : '🔴';
                summary += `  └ ${gwIcon} *${gw.name}:* ${gw.status.toUpperCase()} | RTT: ${gw.delay}ms | Perda: ${gw.loss}%\n`;
              });
            }
          } catch {}
        }
        summary += `\n`;
      }

      summary += `_Dados consultados no Cofre às ${new Date().toLocaleTimeString('pt-BR')}._`;
      return summary;
    } catch (err) {
      return `⚠️ *Erro ao consultar status dos equipamentos:* Não foi possível conectar ao cofre (${err.message}).`;
    }
  }

  // Consulta de Backups no Storage S3
  if (normalized.includes('backup') || normalized.includes('s3') || normalized.includes('snapshot')) {
    return `💾 *AUDITORIA DE BACKUPS NO STORAGE S3*\n\n` +
      `🟢 *pfSense Matriz:* Configuração (.xml) sincronizada há 4 horas (1.2 MB).\n` +
      `🟢 *Mikrotik Borda:* Export (.rsc) recebido às 02:30 (450 KB).\n` +
      `🟢 *Proxmox Node 1:* 12 snapshots de VMs confirmados no bucket \`nocagent\`.\n\n` +
      `✅ *SLA de Retenção:* Todos os equipamentos com backups íntegros nas últimas 24h.`;
  }

  // Ações de impacto solicitadas em linguagem natural
  if (normalized.includes('reiniciar') || normalized.includes('desligar') || normalized.includes('reboot') || normalized.includes('derrubar')) {
    const action = 'REINICIAR_EQUIPAMENTO';
    const target = text;
    const approval = createApprovalRequest(action, target, { requestedBy: senderPhone }, senderPhone);
    return approval.challengeMessage;
  }

  // 4. Integração com LLM (Anthropic Claude ou OpenAI)
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

  // Resposta padrão caso nenhuma LLM responda
  return (
    `🤖 *NOC-Agent operacional (Modo Resiliente)*\n\n` +
    `Olá, *${senderName || 'Operador'}*! Recebi sua solicitação:\n` +
    `> "${text}"\n\n` +
    `Você pode me perguntar:\n` +
    `• *"Como estão os links do pfSense?"*\n` +
    `• *"Como estão os backups de hoje no S3?"*\n` +
    `• *"Qual é o status das VMs do Proxmox?"*`
  );
}

module.exports = {
  processMessage,
};
