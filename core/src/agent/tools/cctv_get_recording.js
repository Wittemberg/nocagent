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
      const fileName = `clip_${equipmentId}_cam${channel}_${timestamp}.dav`;
      const mediaDir = path.resolve(__dirname, '../../../../public/media');
      const filePath = path.join(mediaDir, fileName);
      
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }
      
      const ip = equipment.port ? `${equipment.host}:${equipment.port}` : equipment.host;
      
      // Formatação de datas para a API da Dahua/Intelbras
      const stUrl = startTime.trim().replace(/ /g, '%20');
      const etUrl = endTime.trim().replace(/ /g, '%20');
      
      let url = '';
      if (vendor.toLowerCase() === 'intelbras' || vendor.toLowerCase() === 'dahua') {
        url = `http://${ip}/cgi-bin/loadfile.cgi?action=startLoad&channel=${channel}&startTime=${stUrl}&endTime=${etUrl}`;
      } else {
        return { success: false, error: 'Download de gravação só suportado atualmente para Intelbras/Dahua.' };
      }
      
      const publicUrl = `/api/media/${fileName}`;
      
      // Executar CURL com Digest Auth que salva direto no arquivo
      const cmd = `curl -s -g -w "%{http_code}" --anyauth -u "${creds.username}:${creds.password}" "${url}" -o "${filePath}"`;
      
      try {
        const { stdout } = await execPromise(cmd, { timeout: 120000 }); 
        const httpCode = stdout.trim();
        
        if (httpCode && httpCode !== "200") {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          
          let errorMsg = `DVR retornou código HTTP ${httpCode}. A porta HTTP está correta, mas a requisição falhou.`;
          if (httpCode === "400") {
            errorMsg = `DVR retornou código HTTP 400 (Bad Request). Para equipamentos Intelbras/Dahua, isso geralmente significa que NÃO EXISTE GRAVAÇÃO no HD para o período ou canal solicitado. Verifique se o DVR realmente possui gravação no horário exato de ${startTime} a ${endTime}.`;
          } else if (httpCode === "401") {
            errorMsg = `DVR retornou código HTTP 401 (Unauthorized). Senha incorreta.`;
          }
          
          return { success: false, error: errorMsg };
        }
        
        // Verifica se o arquivo baixado é suspeitosamente pequeno
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.size < 100 * 1024) { 
            const snippet = fs.readFileSync(filePath, 'utf8').substring(0, 500);
            fs.unlinkSync(filePath);
            return { success: false, error: `O DVR fingiu que enviou o vídeo (HTTP 200), mas enviou um arquivo de apenas ${(stats.size / 1024).toFixed(2)} KB. Conteúdo recebido do DVR: "${snippet.trim()}". Isso indica que a API CGI recusou o comando de download silenciosamente.` };
          }
        } else {
           return { success: false, error: 'O comando de download terminou, mas o arquivo de vídeo não foi criado no disco.' };
        }
        
      } catch (curlError) {
        console.error('Falha real ao baixar gravação:', curlError.message);
        return { success: false, error: `Falha de rede com o DVR ao baixar vídeo: ${curlError.message}` };
      }
      
      return {
        success: true,
        message: 'Gravação obtida com sucesso.',
        videoUrl: publicUrl,
        markdown: `✅ Gravação baixada com sucesso (Formato Original: .dav)!\n\nO DVR envia o arquivo no formato bruto e proprietário da Intelbras (.dav). Como o navegador não consegue tocar esse formato nativamente, você precisa baixar o arquivo e usar o VLC Media Player ou o Intelbras SmartPlayer para assistir.\n\n[📥 Clique aqui para baixar o arquivo de vídeo (.dav)](${publicUrl})`
      };
      
    } catch (err) {
      return { success: false, error: `Falha na extração de vídeo: ${err.message}` };
    }
  }
};
