# Etapa 06 — Agent Go: Enrollment, Identidade e Heartbeat

## Objetivo

Criar o primeiro agent funcional e seguro.

## Instalação

Destino:

```text
/usr/local/bin/infraops-agent
/etc/infraops-agent/config.yaml
/var/lib/infraops-agent/
/var/log/infraops-agent/
```

Serviço:
`infraops-agent.service`

## Privilégio

O processo principal deve rodar com usuário dedicado sempre que possível:

```text
infraops
```

Actions privilegiadas devem usar executores específicos e controlados; não conceder `NOPASSWD: ALL`.

## Enrollment

### Fluxo

1. Admin cria Node na plataforma.
2. API gera enrollment token:
   - randômico;
   - hash persistido;
   - TTL padrão 15 min;
   - single use;
   - ligado ao node.
3. Operador instala agent.
4. Agent gera chave local.
5. Agent chama:
   `POST /api/v1/agent/enroll`
6. Envia token + fingerprint/host facts mínimos.
7. Central valida.
8. Central entrega credencial/certificado.
9. Token é marcado como consumido.
10. Agent salva credencial com permissão de filesystem restrita.
11. Heartbeat inicia.

## Endpoint enroll

Request exemplo:

```json
{
  "enrollmentToken": "...",
  "agentVersion": "0.1.0",
  "hostname": "pve01",
  "machineIdHash": "...",
  "publicKey": "..."
}
```

Response:

```json
{
  "agentId": "...",
  "nodeId": "...",
  "apiBaseUrl": "...",
  "certificate": "...",
  "caCertificate": "...",
  "heartbeatIntervalSeconds": 30
}
```

Nunca devolver segredo reutilizável do enrollment.

## Heartbeat

Endpoint:
`POST /api/v1/agent/heartbeat`

Payload mínimo:

```json
{
  "agentId": "...",
  "agentVersion": "0.1.0",
  "timestamp": "...",
  "uptimeSeconds": 123456,
  "capabilities": [
    "node.health:v1",
    "node.inventory:v1"
  ]
}
```

## Estado offline

Worker periódico:
- online: heartbeat dentro do threshold;
- degraded: heartbeat atrasado;
- offline: excedeu threshold;
- maintenance: policy sobrepõe alerta.

Exemplo:
- intervalo 30 s;
- degraded > 90 s;
- offline > 180 s.

Os valores devem ser configuráveis.

## Inventory inicial

Coletar:
- hostname;
- OS;
- distro;
- kernel;
- arquitetura;
- CPU model/count;
- RAM;
- filesystems;
- interfaces;
- uptime;
- machine-id hash.

Não transmitir secrets encontrados no host.

## Auto-update do agent

Não implementar na primeira iteração. Apenas:
- registrar versão;
- detectar versão antiga.

## Segurança local

- config 0600;
- diretório de estado 0700/0750 conforme usuário;
- logs sem credenciais;
- limitar output.

## Critérios de aceite

- [ ] Token expira.
- [ ] Token não pode ser usado duas vezes.
- [ ] Agent registrado aparece online.
- [ ] Revogação bloqueia heartbeat.
- [ ] Node passa a offline após timeout.
- [ ] Agent não roda como root sem necessidade explícita documentada.
