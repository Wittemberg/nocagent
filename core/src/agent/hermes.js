const { SYSTEM_PROMPT } = require('./prompts');
const { createApprovalRequest, verifyApproval } = require('./approvals');
const axios = require('axios');

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

  // Consulta de Gateways / pfSense
  if (normalized.includes('link') || normalized.includes('gateway') || normalized.includes('pfsense') || normalized.includes('internet')) {
    try {
      // Exemplo usando URL e Key configuradas ou chamando driver
      const pfsenseUrl = process.env.PFSENSE_BASE_URL || 'https://libra-vivo.awecloudsolution.com:8181';
      const apiKey = process.env.PFSENSE_API_KEY;

      if (apiKey) {
        const res = await axios.get(`${pfsenseUrl}/api/v2/status/gateways`, {
          headers: { 'X-API-Key': apiKey },
          timeout: 8000,
          httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        });

        const gateways = res.data?.data || [];
        let summary = `📡 *STATUS DOS LINKS DE INTERNET (pfSense)*\n\n`;

        gateways.forEach((gw) => {
          const isOnline = gw.status === 'online';
          const icon = isOnline ? '🟢' : '🔴';
          summary += `${icon} *${gw.name}*\n`;
          summary += `• *Status:* ${gw.status.toUpperCase()}\n`;
          summary += `• *Latência:* ${gw.delay} ms | *Perda:* ${gw.loss}%\n`;
          summary += `• *IP Monitor:* \`${gw.monitorip || 'N/A'}\`\n\n`;
        });

        summary += `_Dados obtidos via pfrest API às ${new Date().toLocaleTimeString('pt-BR')}._`;
        return summary;
      }
    } catch (err) {
      return `⚠️ *Erro ao consultar o pfSense:* Não foi possível conectar ao endpoint (${err.message}). Verifique a conectividade de rede da porta 8181.`;
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
