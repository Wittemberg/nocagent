# Etapa 26 — Infrastructure Source of Truth & Physical Topology

## Visão
Criar um inventário operacional nativo, confiável e fácil de usar para pequenas/médias redes.

O produto deve responder:
- O que este cliente possui?
- Onde está?
- Qual patrimônio/serial/MAC/IP?
- Em qual rack/U está?
- O que está conectado a cada porta?
- Quais equipamentos estão sem garantia?
- O que depende de um switch/firewall/node?
- O que devo verificar na próxima visita?

## Fontes e confiança
Todo dado deve registrar:
- `MANUAL`: informado pelo usuário;
- `DISCOVERED`: descoberto automaticamente;
- `VERIFIED`: confirmado.

Descoberta não confirmada nunca deve sobrescrever silenciosamente informação verificada.

## Modelo funcional
Tenant → Site → Location → Rack → Asset → Interface → Connection.

Recursos lógicos existentes (Proxmox/Virtualizor/Agent) devem ser vinculados ao Asset físico, nunca duplicados.

## Asset mínimo
name, assetTag, category, manufacturer, model, serialNumber, hostname, managementIp, primaryMac, status, criticality, purchaseDate, purchaseValue, warrantyUntil, supplier, notes, source, verificationStatus.

Categorias iniciais:
SERVER, HYPERVISOR, SWITCH, FIREWALL, ROUTER, ACCESS_POINT, STORAGE, NAS, UPS, PDU, PATCH_PANEL, MODEM, ONT, NVR, CAMERA, PRINTER, APPLIANCE, OTHER.

## Cadastro rápido
A experiência padrão deve permitir cadastrar equipamento em poucos campos e poucos segundos. Campos avançados ficam recolhidos.

## Rack
heightU, widthMm, depthMm, maxWeightKg; posição frontal/traseira; `startU + heightU`; impedir sobreposição.

## Interfaces e portas
Interfaces genéricas para todos os assets. Switches podem gerar N portas automaticamente por template simples.

## Connection
Relaciona interface A ↔ interface B. É a base da topologia.

## Network Basics
VLAN, Subnet, IPAddress e WanCircuit simples. IPAM é operacional, não pretende competir com suites enterprise.

## Asset Timeline
Registrar instalação, movimentação, manutenção, firmware, incidentes, ações InfraOps AI e aposentadoria.

## QR Code
Cada asset pode gerar QR Code para abrir ficha responsiva autenticada.

## Tenant Infrastructure Book
Visão consolidada com quantidade de assets, nodes, VMs, switches, firewalls, APs, UPS, links, backups, riscos e pendências.

## IA
Tools read-only iniciais:
- inventory.listAssets
- inventory.getAsset
- inventory.findBySerial
- inventory.findByMac
- rack.getLayout
- network.getInterfaces
- network.getConnections
- network.findPort
- network.getTopology
- ipam.findIp
- ipam.findAvailableIp

## Advisor
Usar topologia física como evidência para SPOF e recomendações. Nunca inferir conexão inexistente como fato.

## Segurança
Tenant isolation, RBAC, secrets por referência, audit trail, attachments protegidos, discovery explicitamente autorizado e rate-limited.
