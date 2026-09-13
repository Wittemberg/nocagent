const { PrismaClient } = require('@prisma/client');
const { decryptCredentials } = require('../security/vault');

const prisma = new PrismaClient();

/**
 * Localiza equipamento no cofre e decifra suas credenciais com segurança
 */
async function getDecryptedEquipment(equipmentId, fallbackType = null) {
  let eq = null;
  if (equipmentId) {
    eq = await prisma.equipment.findFirst({
      where: {
        OR: [
          { id: equipmentId },
          { name: { contains: equipmentId, mode: 'insensitive' } },
        ],
        active: true,
      },
    });
  }

  if (!eq && fallbackType) {
    eq = await prisma.equipment.findFirst({
      where: { type: fallbackType, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!eq) {
    throw new Error(`Equipamento ${fallbackType || equipmentId || ''} não encontrado no cofre.`);
  }

  const credentials = decryptCredentials(eq.encryptedCredentials, eq.iv, eq.authTag);
  return { eq, credentials };
}

module.exports = {
  getDecryptedEquipment,
};
