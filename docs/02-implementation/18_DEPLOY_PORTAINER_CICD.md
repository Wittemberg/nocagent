# Etapa 18 — Deploy com Docker/Portainer e CI/CD

## Objetivo

Publicar a central sem containerizar o Agent Linux.

## Serviços

```text
infraops-web
infraops-api
infraops-worker
postgres
redis
prometheus
alertmanager
grafana (opcional operacional)
minio (se não usar S3 externo)
otel-collector
```

Loki posterior.

## Redes

Separar:
- edge/public;
- app internal;
- data internal.

PostgreSQL/Redis não expostos publicamente.

## Volumes

Persistentes:
- postgres;
- redis conforme estratégia;
- prometheus;
- minio;
- alertmanager config/data conforme necessidade.

## Reverse proxy

TLS obrigatório.

Rotas:
- `infraops.dominio`
- API preferencialmente mesmo domínio `/api`;
- agent endpoint pode ser `agent.infraops.dominio` ou `/api/v1/agent`.

## Portainer

Criar stack declarativa versionada no Git.

Nunca editar produção manualmente sem refletir no repositório.

## CI/CD

Pipeline:
1. test;
2. build;
3. security scan;
4. image;
5. push registry;
6. trigger/deploy Portainer;
7. health check.

Tag:
- commit SHA;
- release semantic version.

Evitar `latest` como única referência de produção.

## Migrations

Executar migration controlada antes/na subida da API.
Prever rollback de aplicação compatível.

## Backup da plataforma

InfraOps também precisa de backup:
- PostgreSQL;
- object storage metadata/artifacts críticos;
- configs;
- secrets encrypted;
- restore test.

## Critérios de aceite

- [ ] Stack reproduzível por Git.
- [ ] Postgres/Redis não públicos.
- [ ] HTTPS.
- [ ] Imagens versionadas.
- [ ] Health check pós-deploy.
- [ ] Backup/restore da própria plataforma documentado.
