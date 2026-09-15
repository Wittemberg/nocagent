/**
 * execute_equipment_command.js — Ferramenta MCP do Porteiro Blindado
 *
 * Esta é a única interface que a IA tem para executar comandos em equipamentos.
 * Ela NUNCA expõe credenciais. Apenas recebe um bilhete (equipmentId + command)
 * e devolve o resultado via proxy.js.
 */

'use strict';

const { runCommand } = require('../../security/proxy');

module.exports = {
  definition: {
    name: 'execute_equipment_command',
    description:
      'Executa um comando remoto em um equipamento cadastrado no cofre. ' +
      'As credenciais são gerenciadas internamente pelo Porteiro Blindado (Zero-Trust Proxy) — ' +
      'NUNCA tente ler senhas diretamente do banco. Use sempre esta ferramenta para acessar equipamentos via SSH. ' +
      'Na primeira conexão, o fingerprint SSH é registrado automaticamente (TOFU). ' +
      'Se o fingerprint mudar em conexões futuras, a ação é BLOQUEADA e um alerta Anti-MitM é emitido.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: {
          type: 'string',
          description: 'ID ou nome exato do equipamento no cofre (ex: "ROUTER-FILIAL-01" ou o UUID do banco)',
        },
        command: {
          type: 'string',
          description: 'Comando a ser executado remotamente no equipamento via SSH (ex: "show version", "ping 8.8.8.8 count=4")',
        },
      },
      required: ['equipmentId', 'command'],
    },
  },

  handler: async ({ equipmentId, command }) => {
    if (!equipmentId || !command) {
      return { success: false, error: 'equipmentId e command são obrigatórios.' };
    }

    // Bloqueia comandos potencialmente destrutivos sem aprovação explícita
    const BLOCKED_PATTERNS = [
      /rm\s+-rf/i,
      /format\s+/i,
      /shutdown\s+/i,
      /:\s*\(\s*\)\s*\{/,   // fork bomb
      />\s*\/dev\//i,
    ];

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return {
          success: false,
          error: `🚫 Comando bloqueado por política de segurança do Porteiro Blindado. ` +
                 `Comandos destrutivos requerem aprovação explícita de operador L2/L3.`,
        };
      }
    }

    const result = await runCommand(equipmentId, command);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        markdown: `❌ **Falha no Porteiro Blindado:**\n\n> ${result.error}`,
      };
    }

    const lines = result.output?.split('\n').length ?? 0;
    const preview = lines > 50
      ? result.output.split('\n').slice(0, 50).join('\n') + `\n\n_(saída truncada: ${lines} linhas total)_`
      : result.output;

    return {
      success: true,
      output: result.output,
      exitCode: result.exitCode,
      tofuMessage: result.tofuMessage,
      markdown:
        `${result.tofuMessage}\n\n` +
        `**Saída do equipamento \`${equipmentId}\`:**\n\`\`\`\n${preview}\n\`\`\``,
    };
  },
};
