#!/bin/bash
set -e

echo "=== Atualizando NOC-Agent ==="

# Puxa as imagens mais recentes do GHCR
docker pull ghcr.io/wittemberg/nocagent-core:latest
docker pull ghcr.io/wittemberg/nocagent-web:latest

# Aplica a stack com as novas imagens no Swarm / Portainer
docker stack deploy -c /root/nocagent/docker-compose.yml noc-agent

# Aguarda status dos servicos
echo "Aguardando subida dos servicos..."
sleep 5
docker service ls | grep noc-agent

echo "=== Deploy concluido com sucesso! ==="
