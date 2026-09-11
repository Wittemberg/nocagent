const axios = require('axios');
const { processMessage } = require('../agent/hermes');

const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL;
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const CHATWOOT_ACCOUNT_API_KEY = process.env.CHATWOOT_ACCOUNT_API_KEY;

/**
 * Envia uma mensagem de resposta para a conversa no Chatwoot via Account API
 * @param {number|string} conversationId - ID da conversa no Chatwoot
 * @param {string} content - Mensagem de texto formatada
 */
async function sendChatwootMessage(conversationId, content) {
  if (!CHATWOOT_BASE_URL || !CHATWOOT_ACCOUNT_ID || !CHATWOOT_ACCOUNT_API_KEY) {
    console.warn('Chatwoot API credentials não configuradas. Resposta simulada no console:\n', content);
    return;
  }

  const url = `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`;

  try {
    await axios.post(
      url,
      {
        content,
        message_type: 'outgoing',
        private: false,
      },
      {
        headers: {
          api_access_token: CHATWOOT_ACCOUNT_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error) {
    console.error(`Erro ao enviar mensagem no Chatwoot (Conversa #${conversationId}):`, error.response?.data || error.message);
  }
}

/**
 * Processa o webhook disparado pelo Chatwoot (evento 'message_created')
 * @param {Object} webhookPayload - Dados enviados pelo Chatwoot
 */
async function handleChatwootWebhook(webhookPayload) {
  const event = webhookPayload.event;
  if (event !== 'message_created') {
    return { ignored: true, reason: `Evento '${event}' ignorado.` };
  }

  const messageType = webhookPayload.message_type;
  // Ignora mensagens que o próprio bot enviou (outgoing) para evitar loops infinitos
  if (messageType !== 'incoming') {
    return { ignored: true, reason: 'Mensagem do tipo outgoing ignorada.' };
  }

  const content = webhookPayload.content;
  if (!content || typeof content !== 'string') {
    return { ignored: true, reason: 'Mensagem sem conteúdo textual.' };
  }

  const conversation = webhookPayload.conversation;
  const conversationId = conversation?.id;
  const sender = webhookPayload.sender || {};
  const senderPhone = sender.phone_number || '';
  const senderName = sender.name || 'Técnico';

  console.log(`[Chatwoot Webhook] Mensagem de ${senderName} (${senderPhone}): "${content}"`);

  // Processa a mensagem pelo cérebro do Hermes AI Engine
  const replyText = await processMessage({
    text: content,
    senderPhone,
    senderName,
  });

  // Envia de volta para o Chatwoot
  if (conversationId && replyText) {
    await sendChatwootMessage(conversationId, replyText);
  }

  return { success: true, conversationId, replyLength: replyText.length };
}

module.exports = {
  handleChatwootWebhook,
  sendChatwootMessage,
};
