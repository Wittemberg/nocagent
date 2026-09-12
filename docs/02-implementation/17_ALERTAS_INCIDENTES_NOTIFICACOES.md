# Etapa 17 — Alertas, Incidentes e Notificações

## Alert versus Incident

Alert:
condição detectada.

Incident:
agrupamento que representa problema operacional.

## Severidade

```text
info
warning
high
critical
```

## Deduplicação

Gerar fingerprint estável por:
- tenant;
- target;
- alert type;
- relevant dimension.

Atualizar `last_seen_at` em vez de criar milhares.

## Correlação inicial

Regras simples.

Exemplo:
- backup failed;
- storage > 95%;
- mesmo node/storage;
=> incidente "Backup falhando por pressão de storage".

Não usar IA como única forma de correlação.

## Maintenance

Alertas durante maintenance:
- continuar medindo;
- marcar/silenciar notificações conforme policy;
- não perder histórico.

## Notification channels

MVP:
- email;
- webhook.

Posterior:
- WhatsApp;
- Telegram;
- Slack;
- outros.

## Routing

Policy:
- critical => imediato;
- warning => configurable;
- info => dashboard/digest.

## Alertmanager

Usar para alerts de métricas.
Importar/webhookar eventos relevantes para módulo Alert do InfraOps.

## Critérios de aceite

- [ ] Alert dedup.
- [ ] Resolve status.
- [ ] Maintenance silence.
- [ ] Webhook receiver.
- [ ] Incidente correlaciona casos simples.
