# Etapa 10 — Auditoria, Secrets e Segurança

## Auditoria

Todo evento relevante cria `audit_event`.

Eventos mínimos:
- login;
- enrollment;
- agent revoke;
- permission change;
- secret create/read/use/rotate;
- action requested;
- AI interpretation;
- policy decision;
- approval;
- execution start;
- execution result;
- config change.

## Hash chain

Para cada tenant ou stream de auditoria:

```text
event_hash = SHA256(
  canonical_event_payload +
  previous_hash
)
```

Usar serialização canônica determinística.

Hash chain detecta adulteração; não chamá-la de blockchain.

## Outputs

`stdout`/`stderr` grandes:
- S3/MinIO;
- criptografia;
- hash SHA-256;
- retenção configurável.

Nunca colocar token/senha em output.

## Secret model

Nunca persistir secret em plaintext.

MVP:
- criptografia authenticated encryption;
- AES-256-GCM;
- master key fora do PostgreSQL;
- key version;
- nonce único;
- metadata sem segredo.

Modelo:

```text
id
tenant_id
name
type
ciphertext
nonce
key_version
created_at
rotated_at
last_used_at
```

## Secret access

Código de domínio pede referência:
`secretId`.

Só módulo Secrets descriptografa.

Não retornar secret para frontend depois da criação.

## Proxmox

Tokens dedicados.
Preferir token read-only e token operacional separados.

## Virtualizor

API key/password armazenados via Secrets.

## Agent

Credenciais locais com permissões restritas.

## Sudo

PROIBIDO:

```text
infraops ALL=(ALL) NOPASSWD: ALL
```

Se action exigir root:
- helper específico;
- argumentos restritos;
- allowlist;
- sudoers específico.

## Security headers

Web/API:
- TLS;
- HSTS em produção;
- CSP;
- secure cookies;
- CSRF se aplicável à estratégia;
- rate limits.

## Data retention

Definir:
- audit: longo prazo;
- logs: configurável;
- job output: configurável;
- metrics: Prometheus retention.

## Critérios de aceite

- [ ] Secret não aparece em API/log.
- [ ] DB dump não revela secrets.
- [ ] Audit hash chain verificado por comando/teste.
- [ ] `sudo ALL` inexistente.
- [ ] Security test detecta secret redaction.
