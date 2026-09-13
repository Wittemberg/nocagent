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
    name: 'cctv_get_snapshot',
    description: 'Captura uma foto instantânea (snapshot) de um canal (câmera) específico de um DVR/NVR e retorna a URL da imagem para ser exibida no chat.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: { type: 'string', description: 'ID do equipamento (ex: ID do DVR no banco de dados)' },
        channel: { type: 'number', description: 'Número do canal / câmera (ex: 12)' },
        vendor: { type: 'string', description: 'Fabricante do equipamento: "intelbras", "hikvision" ou "dahua"' }
      },
      required: ['equipmentId', 'channel', 'vendor'],
    },
  },
  handler: async (args) => {
    const { equipmentId, channel, vendor } = args;
    
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
      
      // 2. Preparar diretório de mídia pública
      const timestamp = Date.now();
      const fileName = `snapshot_${equipmentId}_cam${channel}_${timestamp}.jpg`;
      const mediaDir = path.resolve(__dirname, '../../../../public/media');
      const filePath = path.join(mediaDir, fileName);
      
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }
      
      // 3. Montar a requisição cURL baseado no vendor
      let url = '';
      const ip = equipment.port ? `${equipment.host}:${equipment.port}` : equipment.host;
      
      if (vendor.toLowerCase() === 'hikvision') {
        // ISAPI Hikvision: /ISAPI/Streaming/channels/101/picture (canal 1, stream principal)
        const isapiChannel = `${channel}01`;
        url = `http://${ip}/ISAPI/Streaming/channels/${isapiChannel}/picture`;
      } else if (vendor.toLowerCase() === 'intelbras' || vendor.toLowerCase() === 'dahua') {
        // CGI Dahua/Intelbras: /cgi-bin/snapshot.cgi?channel=1
        url = `http://${ip}/cgi-bin/snapshot.cgi?channel=${channel}`;
      } else {
        return { success: false, error: 'Fabricante não suportado nativamente para snapshots via API HTTP.' };
      }
      
      // 4. Executar CURL com Digest Auth que salva direto no arquivo
      // --anyauth negocia Basic ou Digest automaticamente
      const cmd = `curl -s -f -g --anyauth -u "${creds.username}:${creds.password}" "${url}" -o "${filePath}"`;
      
      try {
        await execPromise(cmd, { timeout: 10000 }); // 10s timeout
      } catch (curlError) {
        console.error('Falha real ao buscar snapshot:', curlError.message);
        return { 
          success: false, 
          error: `Falha de comunicação com o DVR via HTTP. Verifique se a porta configurada no cofre é a porta HTTP (padrão 80) e não a porta de serviço (37777). Erro: ${curlError.message}`
        };
      }
      
      // 5. Retornar URL Pública
      // Assumindo que o frontend/dashboard sirva a pasta public via webserver na mesma porta ou nginx
      const publicUrl = `/api/media/${fileName}`; // URL Relativa
      
      return {
        success: true,
        message: 'Snapshot capturado com sucesso.',
        channel,
        imageUrl: publicUrl,
        markdown: `![Foto da Câmera ${channel}](${publicUrl})\n\n[🔗 Abrir imagem em nova aba](${publicUrl})`
      };
      
    } catch (err) {
      return { success: false, error: `Falha interna na ferramenta: ${err.message}` };
    }
  }
};
