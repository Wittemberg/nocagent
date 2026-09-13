const fs = require('fs');
const path = require('path');

const skillsDir = path.resolve(__dirname, '../skills');

module.exports = {
  definition: {
    name: 'read_skill',
    description: 'Lê a documentação principal (SKILL.md) de uma skill técnica de infraestrutura. Use esta ferramenta ANTES de responder a perguntas sobre roteadores, switches, OLTs, servidores ou sistemas para absorver o conhecimento correto.',
    parameters: {
      type: 'object',
      properties: {
        skillName: { type: 'string', description: 'O nome da skill (nome exato da pasta, ex: mikrotik-ops)' },
      },
      required: ['skillName'],
    },
  },
  handler: async (args) => {
    const { skillName } = args;
    
    // Proteção contra path traversal
    const safeSkillName = path.basename(skillName);
    const skillPath = path.join(skillsDir, safeSkillName, 'SKILL.md');
    
    if (!fs.existsSync(skillPath)) {
      return {
        success: false,
        error: `A skill '${safeSkillName}' não foi encontrada ou não possui um SKILL.md.`,
      };
    }

    try {
      const content = fs.readFileSync(skillPath, 'utf8');
      
      // Verifica se existem referências
      const refPath = path.join(skillsDir, safeSkillName, 'references');
      let references = [];
      if (fs.existsSync(refPath)) {
        references = fs.readdirSync(refPath).filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.rsc'));
      }
      
      return {
        success: true,
        skill: safeSkillName,
        content: content,
        availableReferences: references,
        message: references.length > 0 ? `Existem arquivos de referência disponíveis. Se necessário, use read_skill_reference passando o nome do arquivo para acessá-los.` : 'Leitura da skill concluída.'
      };
    } catch (err) {
      return { success: false, error: `Falha ao ler a skill: ${err.message}` };
    }
  }
};
