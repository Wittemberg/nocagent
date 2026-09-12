# Plano de Backup e Recuperação de Desastres da Plataforma InfraOps AI

## 1. Visão Geral

Este documento especifica o procedimento operacional padronizado para backup e recuperação da própria plataforma **InfraOps AI** (banco de dados PostgreSQL, artefatos MinIO/S3, chaves mestras do Cofre de Segredos e configurações).

## 2. Componentes Críticos para Backup

| Componente | Conteúdo | Estratégia de Backup | Frequência |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | Schemas, Tenants, Usuários, Jobs, Políticas, Auditoria, Entidades | `pg_dump` lógico compactado | Diário (Retenção: 30 dias) |
| **Secret Vault Master Key** | Chave de Criptografia AES-256-GCM (`ENCRYPTION_MASTER_KEY`) | Armazenamento off-site seguro/vault | Em cada rotação |
| **MinIO / S3 Storage** | Artefatos de resultado de Jobs > 10KB e evidências | Replicação S3 bucket / rsync | Diário |
| **Configurações Stack** | `docker-stack.yml`, `.env` e regras Traefik | Git Repository | Contínuo / CI/CD |

## 3. Procedimento de Backup do PostgreSQL

Executado no nó manager do Docker Swarm:

```bash
# Exportar banco de dados infraops_db
docker exec -t $(docker ps -q -f name=postgres) pg_dump -U infraops_app -d infraops_db -F c -b -v -f /tmp/infraops_db_$(date +%Y%m%m_%H%M%S).dump

# Copiar dump para diretório de backup externo
cp /tmp/infraops_db_*.dump /var/backups/infraops/db/
```

## 4. Procedimento de Restauração em Caso de Desastre (Disaster Recovery)

1. **Subir a infraestrutura base:**
   Asegurar que a rede Docker overlay `interna` e os contêineres `postgres`, `redis` e `minio` estão em execução.

2. **Restaurar o banco de dados:**
   ```bash
   docker exec -i $(docker ps -q -f name=postgres) pg_restore -U infraops_app -d infraops_db --clean --if-exists /tmp/infraops_db_latest.dump
   ```

3. **Injetar a chave mestre do Secret Vault (`ENCRYPTION_MASTER_KEY`):**
   Verificar no Portainer / `.env` que a chave mestre AES-256-GCM corresponde à chave usada na criação dos segredos.

4. **Acionar a Stack do Portainer:**
   Subir os serviços `infraops-web`, `infraops-api` e `infraops-worker` via Portainer webhook ou `docker stack deploy -c docker-stack.yml infraops-ai`.

5. **Verificar os endpoints de saúde:**
   ```bash
   curl -i https://infraopsai.awecloudsolution.com/api/v1/health/ready
   ```
