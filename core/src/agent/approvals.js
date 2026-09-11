const crypto = require('crypto');

// Memória local efêmera de aprovações pendentes (5 minutos de TTL)
const pendingApprovals = new Map();

/**
 * Cria uma nova solicitação de aprovação Human-in-the-Loop
 * @param {string} action - Nome da ação (ex: "REINICIAR_VM", "ALTERAR_ROTA")
 * @param {string} target - Alvo da ação (ex: "VM 105 no Proxmox")
 * @param {Object} payload - Parâmetros técnicos para execução posterior
 * @param {string} operatorPhone - Telefone do operador solicitante
 * @returns {{ code: string, expiresAt: Date, challengeMessage: string }}
 */
function createApprovalRequest(action, target, payload, operatorPhone) {
  // Gera código aleatório de 4 dígitos entre 1000 e 9999
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

  const request = {
    code,
    action,
    target,
    payload,
    operatorPhone,
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt,
  };

  pendingApprovals.set(code, request);

  const challengeMessage = 
`⚠️ *AÇÃO CRÍTICA SOLICITADA*
• *Ação:* ${action}
• *Alvo:* ${target}
• *Impacto:* Pode causar interrupção temporária de serviços de rede/TI.

👉 Para autorizar esta ação com segurança nos próximos 5 minutos, responda exatamente:
*APROVAR ${code}*

(Para cancelar ou abortar, digite *CANCELAR*)`;

  return {
    code,
    expiresAt,
    challengeMessage,
  };
}

/**
 * Verifica e consome um código de aprovação
 * @param {string} text - Texto enviado pelo operador
 * @param {string} operatorPhone - Telefone do operador
 * @returns {{ valid: boolean, request?: Object, reason?: string }}
 */
function verifyApproval(text, operatorPhone) {
  const match = text.trim().match(/APROVAR\s+(\d{4})/i);
  if (!match) {
    return { valid: false, reason: 'Formato não reconhecido como aprovação' };
  }

  const code = match[1];
  const request = pendingApprovals.get(code);

  if (!request) {
    return { valid: false, reason: 'Código de aprovação não encontrado ou já expirado.' };
  }

  if (Date.now() > request.expiresAt.getTime()) {
    pendingApprovals.delete(code);
    return { valid: false, reason: 'Código expirado. O tempo limite de 5 minutos foi ultrapassado.' };
  }

  // Consome a aprovação para que não possa ser reutilizada
  pendingApprovals.delete(code);
  request.status = 'APPROVED';

  return {
    valid: true,
    request,
  };
}

module.exports = {
  createApprovalRequest,
  verifyApproval,
};
