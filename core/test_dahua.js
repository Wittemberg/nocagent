require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { decryptCredentials } = require('./src/security/vault');

const prisma = new PrismaClient();

async function runTest() {
  console.log("Consultando Telemetria do DVR...");
  
  const equipment = await prisma.equipment.findFirst({
    where: { host: '179.184.227.189' }
  });
  
  if (!equipment) {
    console.log("Equipamento não encontrado");
    return;
  }
  
  const creds = await decryptCredentials(equipment.id);
  const baseUrl = `http://${equipment.host}:${equipment.port || 80}/cgi-bin`;
  const curlOpts = `-s -g --anyauth -u "${creds.username}:${creds.password}"`;

  const commands = [
    { name: 'Storage', url: `${baseUrl}/devStorage.cgi?action=factory.instance` },
    { name: 'VideoLoss', url: `${baseUrl}/devVideoInput.cgi?action=getSystemInfo` }, // Might not exist, we'll try
    { name: 'Uptime', url: `${baseUrl}/magicBox.cgi?action=getSystemInfo` },
  ];
  
  for (const cmd of commands) {
    console.log(`\n--- Testando ${cmd.name} ---`);
    try {
      const curlWithTimeout = `curl -m 5 --connect-timeout 3 ${curlOpts} "${cmd.url}"`;
      console.log(`Executando: ${curlWithTimeout.replace(creds.password, '***')}`);
      const out = execSync(curlWithTimeout, { encoding: 'utf8', timeout: 6000 });
      console.log(out.substring(0, 500));
    } catch (e) {
      console.log(`Erro no ${cmd.name}:`, e.message);
    }
  }
  
  process.exit(0);
}

runTest().finally(() => prisma.$disconnect());
