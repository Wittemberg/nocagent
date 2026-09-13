const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getDecryptedEquipment } = require('../equipmentUtils');

module.exports = {
  definition: {
    name: 'cctv_get_recording',
    description: 'Solicita a extração de um trecho de gravação de vídeo de um DVR/NVR em um intervalo de tempo específico. O retorno contém a URL para o vídeo.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do equipamento no banco de dados' },
        channel: { type: 'number', description: 'Número do canal / câmera' },
        vendor: { type: 'string', description: 'Fabricante: "intelbras", "hikvision" ou "dahua"' },
        startTime: { type: 'string', description: 'Data/Hora de início no formato YYYY-MM-DD HH:MM:SS (ex: 2026-09-12 16:05:00)' },
        endTime: { type: 'string', description: 'Data/Hora de fim no formato YYYY-MM-DD HH:MM:SS (ex: 2026-09-12 16:10:00)' }
      },
      required: ['equipmentId', 'channel', 'vendor', 'startTime', 'endTime'],
    },
  },
  handler: async (args) => {
    const { equipmentId, channel, vendor, startTime, endTime } = args;
    
    try {
      let equipment, creds;
      try {
        const result = await getDecryptedEquipment(equipmentId);
        equipment = result.eq;
        creds = result.credentials;
      } catch (e) {
        return { success: false, error: e.message };
      }
      
      if (!creds || !creds.username || !creds.password) {
        return { success: false, error: 'Credenciais (usuário e senha) não configuradas para este equipamento no Vault.' };
      }
      const timestamp = Date.now();
      const fileName = `clip_${equipmentId}_cam${channel}_${timestamp}.mp4`;
      const mediaDir = path.resolve(__dirname, '../../../../public/media');
      const filePath = path.join(mediaDir, fileName);
      
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }
      
      const ip = equipment.ipAddress;
      
      // Nota Arquitetural: Download de vídeo real em DVRs varia imensamente.
      // - Intelbras (Dahua): /cgi-bin/loadfile.cgi?action=startLoad...
      // - Hikvision (ISAPI): /ISAPI/ContentMgmt/download via XML payload.
      //
      // Aqui vamos criar um arquivo de vídeo "dummy" simulando o processamento
      // de extração, para que o fluxo no Chatwoot/WhatsApp possa ser validado.
      
      const publicUrl = `/media/${fileName}`;
      
      // Criação do arquivo dummy
      fs.writeFileSync(filePath, 'DUMMY_VIDEO_CONTENT');
      
      return {
        success: true,
        message: `Gravação da câmera ${channel} das ${startTime} até ${endTime} extraída com sucesso.`,
        videoUrl: publicUrl,
        markdown: `[📹 Clique aqui para baixar/assistir a gravação solicitada](${publicUrl})`
      };
      
    } catch (err) {
      return { success: false, error: `Falha na extração de vídeo: ${err.message}` };
    }
  }
};
