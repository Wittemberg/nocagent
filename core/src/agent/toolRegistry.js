const fs = require('fs');
const path = require('path');
const { isGlobalKillSwitchActive } = require('../security/flags');
const { recordMcpTrace } = require('../observability/apm');

const toolsDir = path.join(__dirname, 'tools');
const toolModules = {};
const MCP_TOOLS_DEFINITIONS = [];

// Auto-discovery of tools
if (fs.existsSync(toolsDir)) {
  const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const tool = require(path.join(toolsDir, file));
      if (tool.definition && tool.handler) {
        toolModules[tool.definition.name] = tool;
        MCP_TOOLS_DEFINITIONS.push(tool.definition);
      } else {
        console.warn(`[ToolRegistry] O arquivo ${file} não exporta definition e handler válidos.`);
      }
    } catch (err) {
      console.error(`[ToolRegistry] Erro ao carregar tool ${file}:`, err);
    }
  }
}

/**
 * Executor unificado de chamadas MCP com medição APM e trava de segurança Kill-Switch
 */
async function executeMcpTool(toolName, args = {}, context = {}) {
  // Trava de segurança imediata: Se Kill-Switch estiver ativo, bloquear ações ativas/destrutivas
  if (isGlobalKillSwitchActive()) {
    if (toolName === 'proxmox_restart_vm' || toolName.includes('reboot') || toolName.includes('restart') || toolName.includes('delete')) {
      throw new Error('🚨 Ação MCP bloqueada: Emergency Kill-Switch Global está ATIVADO. Nenhuma ação modificadora permitida.');
    }
  }

  const tool = toolModules[toolName];
  if (!tool) {
    throw new Error(`Ferramenta MCP desconhecida ou não registrada: ${toolName}`);
  }

  const startTime = Date.now();
  let driver = 'GENERIC';
  if (toolName.startsWith('proxmox_')) driver = 'PROXMOX';
  else if (toolName.startsWith('mikrotik_')) driver = 'MIKROTIK';
  else if (toolName.startsWith('pfsense_')) driver = 'PFSENSE';
  else if (toolName.startsWith('zabbix_')) driver = 'ZABBIX';

  let statusCode = 200;
  let errorMsg = null;
  let result = null;

  try {
    result = await tool.handler(args, context);
    return result;
  } catch (err) {
    statusCode = err.response?.status || 500;
    errorMsg = err.message || String(err);
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    recordMcpTrace({
      driver,
      equipmentId: args.equipmentId || null,
      method: 'MCP_CALL',
      endpoint: toolName,
      durationMs,
      statusCode,
      error: errorMsg,
    }).catch(() => {});
  }
}

module.exports = {
  MCP_TOOLS_DEFINITIONS,
  executeMcpTool,
};
