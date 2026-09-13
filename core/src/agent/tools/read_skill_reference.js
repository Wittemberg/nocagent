const fs = require('fs');
const path = require('path');

const skillsDir = path.resolve(__dirname, '../skills');

module.exports = {
  definition: {
    name: 'read_skill_reference',
    description: 'Lê um arquivo de referência específico (ex: routeros-v6-vs-v7.md) dentro da pasta references/ de uma skill.',
    parameters: {
      type: 'object',
      properties: {
        skillName: { type: 'string', description: 'O nome da skill (ex: mikrotik-ops)' },
        fileName: { type: 'string', description: 'O nome do arquivo de referência listado no availableReferences' },
      },
      required: ['skillName', 'fileName'],
    },
  },
  handler: async (args) => {
    const { skillName, fileName } = args;
    
    // Proteção contra path traversal
    const safeSkillName = path.basename(skillName);
    const safeFileName = path.basename(fileName);
    const refPath = path.join(skillsDir, safeSkillName, 'references', safeFileName);
    
    if (!fs.existsSync(refPath)) {
      return {
        success: false,
        error: `O arquivo de referência '${safeFileName}' não foi encontrado na skill '${safeSkillName}'.`,
      };
    }

    try {
      const content = fs.readFileSync(refPath, 'utf8');
      return {
        success: true,
        skill: safeSkillName,
        reference: safeFileName,
        content: content,
      };
    } catch (err) {
      return { success: false, error: `Falha ao ler a referência: ${err.message}` };
    }
  }
};
