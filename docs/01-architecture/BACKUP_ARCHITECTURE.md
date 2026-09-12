# Etapa 14 — Backup Engine: Expectativa, Retenção e Validação

## Objetivo

Ser o núcleo funcional do produto.

## Princípio

Não basta perguntar "existe backup?".

Perguntas corretas:
- era esperado?
- ocorreu na janela?
- terminou com sucesso?
- artefato existe?
- tamanho é plausível?
- retenção é suficiente?
- integridade foi validada?
- restore já foi testado?

## Estados de backup

```text
discovered
running
succeeded
failed
missing
expired
invalid
unknown
```

## Integridade

```text
not_checked
valid
invalid
warning
```

## Backup Policy

Campos:
- schedule;
- expected frequency;
- max age;
- retention;
- minimum valid copies;
- acceptable window;
- integrity required;
- size deviation threshold.

## Expectation Engine

Gerar expectativas para workload/policy.

Exemplo:
diário 01:00-05:00.

Se nenhuma cópia válida satisfaz janela:
`missing`.

## Size anomaly

Calcular baseline de backups válidos anteriores.

MVP:
- mediana dos últimos N;
- diferença percentual.

Não usar ML inicialmente.

Exemplo:
mediana 100 GB;
backup atual 12 GB;
threshold 50%;
alerta.

## Cleanup

Processo obrigatório:

```text
Discover candidates
↓
Apply policy
↓
Protect minimum copies
↓
Protect latest valid backup
↓
Dry run
↓
Present plan
↓
Approval
↓
Delete using provider-specific executor
↓
Re-discover
↓
Validate retention
```

Nunca usar simples:
`find /backup -mtime +4 -delete`
como lógica de negócio central.

## Restore testing

Fase futura:
- selecionar backup;
- restaurar em target isolado;
- boot/check;
- destruir target;
- guardar evidência.

## Alertas

Tipos:
- backup_failed;
- backup_missing;
- backup_too_old;
- backup_size_anomaly;
- retention_violation;
- integrity_failed;
- backup_storage_pressure.

## Critérios de aceite

- [ ] Missing backup detectado.
- [ ] Último backup válido protegido.
- [ ] Minimum copies respeitado.
- [ ] Dry-run retorna bytes/candidatos.
- [ ] Cleanup pós-valida retenção.
- [ ] Anomalia simples de tamanho funciona.
