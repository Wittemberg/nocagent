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
      
      const ip = equipment.port ? `${equipment.host}:${equipment.port}` : equipment.host;
      
      // Formatação de datas para a API da Dahua/Intelbras
      // NOTA: Dahua C parser não gosta de URL encode agressivo (%3A para :).
      // Ele espera o formato exato: YYYY-MM-DD%20HH:MM:SS
      const stUrl = startTime.trim().replace(/ /g, '%20');
      const etUrl = endTime.trim().replace(/ /g, '%20');
      
      let url = '';
      if (vendor.toLowerCase() === 'intelbras' || vendor.toLowerCase() === 'dahua') {
        // CGI Dahua/Intelbras: /cgi-bin/loadfile.cgi?action=startLoad...
        url = `http://${ip}/cgi-bin/loadfile.cgi?action=startLoad&channel=${channel}&startTime=${stUrl}&endTime=${etUrl}`;
      } else {
        return { success: false, error: 'Download de gravação só suportado atualmente para Intelbras/Dahua.' };
      }
      
      const publicUrl = `/api/media/${fileName}`;
      
      // Executar CURL com Digest Auth que salva direto no arquivo
      const cmd = `curl -s -g -w "%{http_code}" --anyauth -u "${creds.username}:${creds.password}" "${url}" -o "${filePath}"`;
      
      try {
        // 120 segundos de timeout para dar tempo de baixar trechos pesados em links remotos
        const { stdout } = await execPromise(cmd, { timeout: 120000 }); 
        const httpCode = stdout.trim();
        
        if (httpCode && httpCode !== "200") {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return { success: false, error: `DVR retornou código HTTP ${httpCode}. A porta HTTP está correta, mas a requisição falhou (401=Senha Incorreta, 404=URL Inválida, 400=Erro de Parâmetro).` };
        }
      } catch (curlError) {
        console.error('Falha real ao baixar gravação:', curlError.message);
        return { success: false, error: `Falha de rede com o DVR ao baixar vídeo: ${curlError.message}` };
      }
      
      return {
        success: true,
        message: 'Gravação obtida com sucesso.',
        videoUrl: publicUrl,
        markdown: `🎥 [Gravação Câmera ${channel}](${publicUrl})\n\n[🔗 Abrir vídeo em nova aba](${publicUrl})`
      };
      
    } catch (err) {
      return { success: false, error: `Falha na extração de vídeo: ${err.message}` };
    }
  }
};
