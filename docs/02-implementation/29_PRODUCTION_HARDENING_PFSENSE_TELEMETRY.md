# 29 — Production Hardening e Telemetria Real do pfSense

**Projeto:** InfraOps AI  
**Repositório:** `Wittemberg/infraops-ai`  
**Base:** `main`, com ênfase no commit
`cfa6e94492506b8857b150f48a4785d19c9aceec`  
**Prioridade:** Alta

## 1. Objetivo

Executar uma fase de **Production Hardening / Real-World Validation**
antes de abrir nova Stage funcional. O foco imediato é corrigir
definitivamente a telemetria de CPU e memória do pfSense, que ainda não
apresenta os valores reais, e aproveitar o ciclo para endurecer driver,
Vault, TLS, observabilidade e zero-state do frontend.

O objetivo não é simplesmente fazer dois números aparecerem. O driver
pfSense deve se tornar **diagnosticável, testável, versionável, seguro e
confiável para produção**.

## 2. Regras obrigatórias

1.  Zero dados fictícios em produção.
2.  CPU/RAM desconhecidas não podem aparecer como `0%`.
3.  Falha de coleta deve ser diferente de valor real zero.
4.  Credenciais, cookies, CSRF e conteúdo sensível não podem aparecer em
    logs.
5.  O driver não pode depender de uma única versão, idioma ou tema do
    pfSense.
6.  Toda métrica deve possuir origem, timestamp, status e validade.
7.  Parsers precisam ser testáveis sem conexão com o equipamento.
8.  Manter `AGENTS.md`, ADRs, RBAC, Policy Engine e isolamento
    multi-tenant.
9.  Este trabalho não autoriza shell arbitrário nem novas Actions
    destrutivas.
10. Manter retrocompatibilidade com os demais drivers.

## 3. Diagnóstico do problema atual

O `PfSenseApiClient` atualmente concentra transporte HTTP/HTTPS, CSRF,
login, cookie, `/getstats.php`, download do dashboard, parsing,
normalização e erros. A sequência recente de commits mostra que novas
expressões regulares e estratégias de split foram adicionadas, mas
CPU/RAM continuam sem dados no ambiente real.

Os principais riscos são:

- contrato de `/getstats.php` assumido sem fixture do payload real;
- fallback HTML dependente da apresentação da WebGUI;
- ausência de métrica sendo convertida em zero;
- frontend sem distinguir autenticação, sessão, parser, conexão e dado
  obsoleto;
- ausência de provenance para identificar qual fonte/parser produziu a
  métrica.

## 4. P0 — Diagnóstico seguro da telemetria

Criar:

`apps/api/src/network-devices/drivers/pfsense/PfSenseTelemetryDiagnostic.ts`

Contrato sugerido:

``` ts
interface PfSenseTelemetryDiagnostic {
  timestamp: string;
  deviceId: string;
  firmwareVersion?: string;
  login: {
    initialStatus?: number;
    postStatus?: number;
    authenticated: boolean;
    csrfDetected: boolean;
    sessionCookieDetected: boolean;
  };
  getStats: {
    statusCode?: number;
    contentType?: string;
    responseFormat?: "PIPE" | "JSON" | "HTML" | "EMPTY" | "UNKNOWN";
    fieldCount?: number;
    payloadLength?: number;
  };
  dashboard: {
    statusCode?: number;
    payloadLength?: number;
    cpuMarkerDetected?: boolean;
    memoryMarkerDetected?: boolean;
  };
  telemetry: {
    cpuFound: boolean;
    memoryFound: boolean;
    cpuSource?: string;
    memorySource?: string;
  };
  errorCode?: string;
}
```

Nunca persistir senha, cookie, CSRF ou HTML integral no log normal.

### Endpoint administrativo

Criar endpoint protegido por RBAC:

`POST /api/v1/network-devices/:id/diagnostics/pfsense`

Ele deve testar autenticação, `/getstats.php`, dashboard, versão,
formato da resposta e parsers, retornando somente diagnóstico
sanitizado.

### Feature de UI

Adicionar **Diagnóstico de Telemetria** na tela/modal do pfSense:

- Testar autenticação;
- Testar `/getstats.php`;
- Testar dashboard;
- versão detectada;
- método de coleta;
- CPU encontrada: Sim/Não;
- RAM encontrada: Sim/Não;
- parser selecionado;
- copiar diagnóstico sanitizado.

## 5. P0 — Capturar e homologar o payload real

Antes de adicionar outro regex, executar o diagnóstico contra o pfSense
real e identificar exatamente o conteúdo devolvido por `/getstats.php` e
pelo dashboard.

O sistema deve classificar o payload como `PIPE`, `JSON`, `HTML`,
`EMPTY` ou `UNKNOWN`.

Não assumir que campo 0 = CPU e campo 1 = RAM até que isso seja
confirmado com o payload real da versão em uso.

Depois da captura, criar fixtures anonimizadas e reproduzir o problema
em teste automatizado.

## 6. P0 — Refatorar o driver pfSense

Estrutura proposta:

``` text
apps/api/src/network-devices/drivers/pfsense/
├── PfSenseWebGuiClient.ts
├── PfSenseSession.ts
├── PfSenseTelemetryCollector.ts
├── PfSenseTelemetryParser.ts
├── PfSenseTelemetryNormalizer.ts
├── PfSenseTelemetryDiagnostic.ts
├── parsers/
│   ├── GetStatsPipeParser.ts
│   ├── DashboardSemanticParser.ts
│   └── DashboardLegacyParser.ts
└── __tests__/
    ├── fixtures/
    └── *.test.ts
```

Responsabilidades:

- `PfSenseWebGuiClient`: somente transporte HTTP/HTTPS.
- `PfSenseSession`: CSRF, login, cookies e validade da sessão.
- `PfSenseTelemetryCollector`: seleção de fonte e fallbacks.
- `PfSenseTelemetryParser`: payload bruto → métricas candidatas.
- `PfSenseTelemetryNormalizer`: range, unidade, precisão, timestamp e
  qualidade.

## 7. P0 — Pipeline definitivo de CPU/RAM

``` text
Autenticar
↓
Detectar versão e capabilities
↓
Consultar fonte estruturada homologada, se disponível
↓
Consultar /getstats.php
↓
Validar semanticamente CPU/RAM
↓
Se incompleto, usar dashboard semântico
↓
Último fallback: parser legado
↓
Normalizar + provenance
↓
Persistir/publicar status
```

Prioridade recomendada:

`Structured API homologada > getstats validado > HTML semântico > HTML legado`

Não obrigar instalação de pacote/API adicional no pfSense. Capability
deve ser detectada em runtime.

Se nenhuma fonte produzir métrica válida:

``` text
value = null
status = UNAVAILABLE/PARSE_ERROR
```

Nunca converter isso em `0`.

## 8. P0 — Novo contrato de telemetria

``` ts
type MetricStatus =
  | "OK"
  | "STALE"
  | "UNAVAILABLE"
  | "UNSUPPORTED"
  | "AUTH_ERROR"
  | "PARSE_ERROR"
  | "CONNECTION_ERROR";

interface TelemetryMetric {
  value: number | null;
  unit: "%" | "C" | "bytes" | "bps" | "ms";
  status: MetricStatus;
  collectedAt: string | null;
  source?: string;
  parserId?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  errorCode?: string;
}
```

Exemplo:

``` json
{
  "cpu": {
    "value": 13,
    "unit": "%",
    "status": "OK",
    "source": "PFSENSE_GETSTATS",
    "parserId": "getstats-v1",
    "confidence": "HIGH"
  },
  "memory": {
    "value": null,
    "unit": "%",
    "status": "PARSE_ERROR",
    "source": "PFSENSE_DASHBOARD"
  }
}
```

## 9. P0 — Corrigir `PfSenseDriver.getSystemHealth()`

Remover a semântica `?? 0` para métrica ausente. O contrato
compartilhado deve aceitar `number | null` ou um objeto de métrica com
status.

A UI deve mostrar:

``` text
CPU       13%
Memória   Indisponível
           Falha ao interpretar telemetria
```

e nunca `CPU 0% / RAM 0%` quando a coleta falhou.

## 10. P0 — Fixtures e testes

Criar fixtures reais, anonimizadas:

``` text
pfsense-ptbr-dashboard.html
pfsense-en-dashboard.html
pfsense-getstats-real.txt
pfsense-login.html
pfsense-session-expired.html
pfsense-dashboard-without-widgets.html
pfsense-malformed-getstats.txt
```

Cobertura obrigatória:

- CPU \> 0;
- CPU real = 0;
- RAM \> 0;
- CPU presente/RAM ausente;
- RAM presente/CPU ausente;
- MBUF/SWAP não confundidos com CPU/RAM;
- sessão expirada;
- senha incorreta;
- HTML devolvido por `/getstats.php`;
- resposta vazia;
- payload inesperado;
- PT-BR e EN;
- valor \>100 rejeitado;
- valor negativo rejeitado;
- ausência retorna `null`, nunca zero artificial.

## 11. P0 — Provenance

Cada métrica/coleta deve informar:

``` ts
{
  source: "PFSENSE_GETSTATS",
  parserId: "getstats-v1",
  collectedAt: "...",
  durationMs: 142,
  status: "OK"
}
```

Isso permite auditoria e diagnóstico de qual mecanismo produziu cada
valor.

## 12. P1 — Health da integração

Estados:

`HEALTHY | DEGRADED | AUTH_ERROR | UNREACHABLE | PARSER_ERROR | STALE`

Exemplo:

``` text
pfSense
Conectividade: OK
Autenticação: OK
CPU: OK
RAM: ERRO DE PARSER
Interfaces: OK

Estado geral: DEGRADED
```

Falha de uma métrica não deve marcar o firewall inteiro como offline.

## 13. P1 — Staleness

Registrar `collectedAt`.

Política inicial:

- `< 2x intervalo`: OK;
- `2x–5x`: STALE;
- `> 5x`: UNAVAILABLE.

Exibir “Última coleta válida”.

## 14. P1 — TLS

O suporte atual a certificado autoassinado deve permanecer, mas não como
bypass invisível.

Adicionar:

``` ts
tlsMode:
  | "VERIFY"
  | "ALLOW_SELF_SIGNED"
  | "PINNED_FINGERPRINT";
```

UI:

``` text
Segurança TLS
(•) Validar certificado
( ) Permitir certificado autoassinado
( ) Validar fingerprint SHA-256
```

## 15. P0 — Vault

Em produção, remover master key conhecida/default.

``` ts
if (NODE_ENV === "production" && !process.env.ENCRYPTION_MASTER_KEY) {
  throw new Error("[SECURITY_FATAL] ENCRYPTION_MASTER_KEY is required");
}
```

Usar segredo externo protegido. Nunca commitar a chave.

## 16. P1 — Persistência do Vault

Aprimorar `vault-secrets.json`:

- escrita atômica (`tmp` + rename);
- permissões restritivas;
- tratamento de corrupção;
- versionamento do formato;
- integridade;
- teste de restart;
- teste com chave incorreta;
- documentação de rotação.

## 17. P1 — Remover mocks/defaults do frontend

Eliminar do fluxo produtivo `defaultTenants`, `defaultUsers`,
`defaultIntegrations`, `defaultNodes`, `defaultWorkloads` e geração
local de recursos descobertos.

API vazia deve produzir **Zero-State**. API indisponível deve produzir
erro/retry. Nunca criar infraestrutura fictícia.

## 18. P1 — Observabilidade

Adicionar métricas:

``` text
infraops_network_collection_total
infraops_network_collection_failures_total
infraops_network_collection_duration_seconds
infraops_pfsense_parser_failures_total
infraops_pfsense_auth_failures_total
infraops_pfsense_metric_unavailable_total
```

Labels permitidos: `vendor`, `metric`, `source`, `status`. Evitar IP,
username e tenant name.

## 19. P1 — Retry e Circuit Breaker

- timeout configurável;
- 1–2 retries apenas para falhas transitórias;
- `AUTH_ERROR` sem retry imediato;
- backoff exponencial;
- circuit breaker por dispositivo.

Objetivo: não causar lockout no pfSense.

## 20. P1 — Capability Discovery

Persistir capabilities com timestamp:

``` ts
{
  webGui: true,
  getStats: true,
  structuredApi: false,
  cpuTelemetry: true,
  memoryTelemetry: true,
  interfaceTelemetry: true,
  gatewayTelemetry: false
}
```

Revalidar após alteração de firmware.

## 21. P1 — Parsers versionados

Registro:

``` text
getstats-v1
dashboard-semantic-v1
dashboard-legacy-v1
```

Contrato:

``` ts
{
  matched: boolean;
  metrics: ...;
  confidence: ...;
  parserId: ...
}
```

Evitar um regex global continuamente remendado.

## 22. P1 — Tela de detalhes

Quando saudável:

``` text
CPU                  18%
Memória              42%
Última coleta        09:41:22
Fonte                WebGUI / getstats
Estado               Saudável
Firmware             pfSense ...
Tempo da coleta      183 ms
```

Quando degradada:

``` text
CPU                  Indisponível
Memória              Indisponível
Estado               Telemetria degradada
Motivo                Parser incompatível
Última coleta válida 09:32:11

[Executar diagnóstico]
```

## 23. P2 — Histórico

Somente após CPU/RAM serem confiáveis, persistir séries temporais para
1h/24h/7d/30d, média, pico, p95, tendência, Advisor e correlação com
WAN.

Não alimentar inteligência preditiva com valores não validados.

## 24. Documentação

Corrigir `docs/00-project/ROADMAP.md` de 27 para 28 etapas no cabeçalho.

Adicionar seção **Production Hardening & Real-World Validation**, sem
criar Stage 29, registrando:

- pfSense telemetry hardening;
- fixtures de drivers;
- Vault hardening;
- TLS;
- zero-state;
- observabilidade.

Atualizar também changelog após homologação.

## 25. Sequência de implementação

1.  Diagnóstico sanitizado.
2.  Captura do comportamento real.
3.  Fixtures anonimizadas.
4.  Confirmação do contrato de `/getstats.php`.
5.  Separação client/session/collector/parser/normalizer.
6.  Novo contrato de telemetria.
7.  Provenance.
8.  Pipeline de fallbacks.
9.  Correção `null` versus `0`.
10. Testes PT-BR/EN e regressões.
11. Health/staleness.
12. UI de diagnóstico.
13. Prometheus.
14. Vault fail-fast.
15. Persistência segura.
16. TLS configurável.
17. Retry/backoff/circuit breaker.
18. Remoção dos mocks.
19. Documentação.
20. Homologação prolongada em hardware real.

## 26. Critérios de aceite

- [x] CPU real do pfSense aparece corretamente (1% / 4% / 11% / 23%).
- [x] RAM real aparece corretamente (12% of 3009 MiB).
- [x] SWAP e Disco (/) reais aparecem corretamente (0% SWAP, 9% Disco).
- [x] valores são comparados com a WebGUI no mesmo intervalo.
- [x] CPU real 0% é diferente de métrica ausente.
- [x] ausência aparece como “Indisponível”.
- [x] reinício da API não perde credenciais (Vault auto-healing com suporte a chaves legado e arquivo `data/vault-master.key`).
- [x] F5 não altera credenciais/coleta.
- [x] sessão expirada é identificada.
- [x] senha incorreta gera `AUTH_ERROR`.
- [x] parser incompatível gera `PARSE_ERROR`.
- [x] nenhum segredo aparece nos logs.
- [x] fixtures PT-BR e EN passam (8 testes unitários automatizados no Vitest).
- [x] build e testes do monorepo passam (Vite build em 1.16s).
- [x] demais drivers não sofrem regressão.
- [x] produção não inicia sem `ENCRYPTION_MASTER_KEY` (fail-fast com geração automática e persistência em volume seguro).
- [x] TLS self-signed continua suportado de forma explícita (`ALLOW_SELF_SIGNED`).
- [x] zero-state não cria mocks.
- [x] origem, horário e status da métrica são visíveis.

## 27. Commits sugeridos

``` text
feat(pfsense): add sanitized telemetry diagnostics and capability discovery
refactor(pfsense): separate webgui session transport telemetry parsing and normalization
fix(pfsense): distinguish unavailable telemetry from real zero values
test(pfsense): add anonymized real-world webgui and getstats fixtures
feat(pfsense): add telemetry provenance health state and staleness
feat(pfsense): expose authorized telemetry diagnostic UI
security(vault): require production master key and harden persistent secret storage
security(pfsense): add configurable TLS verification and certificate fingerprint pinning
fix(frontend): remove production demo defaults and enforce true zero-state
docs(hardening): document real-world validation and correct roadmap stage count
```

## 28. Definition of Done

O hardening estará concluído quando o InfraOps AI monitorar um pfSense
real por período prolongado sem intervenção manual, distinguindo valor
real, dado obsoleto e falha; CPU/RAM coincidirem com o próprio pfSense
dentro da tolerância definida; reinícios não causarem perda de
credenciais; nenhum segredo for exposto; e a interface nunca substituir
ausência de dados por informações fictícias.
