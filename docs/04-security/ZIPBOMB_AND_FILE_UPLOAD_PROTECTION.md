# Proteção contra Zip Bombs e Validação Segura de Arquivos

> **Documento:** `docs/04-security/ZIPBOMB_AND_FILE_UPLOAD_PROTECTION.md`  
> **Sistema:** NOC-Agent  
> **Status:** Ativo e Obrigatório (Frontend & Backend)  
> **Público-alvo:** Engenharia de Software, Segurança da Informação e Operadores de NOC  

---

## 1. Visão Geral da Ameaça (Zip Bombs & Decompression Bombs)

Um **Zip Bomb** (ou *Bomba de Descompressão*) é um arquivo compactado maliciosamente construído que parece inofensivo pelo tamanho pequeno em disco (de poucos kilobytes a alguns megabytes), mas que se expande para gigabytes, terabytes ou até petabytes de dados quando descompactado ou lido na memória.

### Formas de Ataque Comuns:
1. **Bombas de Alta Taxa (Flat Bombs):** Arquivos que utilizam sequências repetitivas de bytes maximamente comprimíveis (ex: gigabytes de zeros que ocupam poucos KB compactados).
2. **Bombas Recursivas (Nested Archives):** Arquivos ZIP dentro de ZIPs em múltiplos níveis (ex: o clássico `42.zip`, que possui 42 KB compactados e expande para 4,5 Petabytes).
3. **Disfarce de Extensão (Extension Spoofing):** Arquivos compactados renomeados com extensões aparentemente legítimas (ex: `chave_ssh.pem`, `id_rsa.txt`, `cert.key`), enviados para interfaces de *Drag & Drop* ou upload.
4. **Exaustão de Heap (DoS do Navegador/Servidor):** Ao tentar ler ou alocar arquivos gigantescos ou de descompressão massiva na thread JavaScript (`FileReader.readAsText()` no navegador ou `Buffer` no Node.js), a memória estoura (`JavaScript heap out of memory`), congelando o navegador do operador ou derrubando o processo do servidor.

---

## 2. Arquitetura de Defesa em Dupla Camada (Defense-in-Depth)

O NOC-Agent implementa uma arquitetura de defesa estrita em duas camadas independentes: **Pre-Flight no Navegador (Cliente)** e **Deep Guard na API (Servidor)**.

```
[ ARQUIVO ARRASTADO / SELECIONADO PELO USUÁRIO ]
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. CAMADA FRONTEND (web/src/utils/fileSecurity.js)      │
│  a) Pre-Read Size Check: Bloqueio imediato se > 128 KB  │
│  b) Extensão: Rejeita .zip, .gz, .tar, .7z, .rar, etc.   │
│  c) Slicing de Magic Bytes: Lê apenas os 1ºs 512 bytes │
│  d) Scanner de Assinaturas: Bloqueia ZIP, GZ, BZ2, TAR  │
│  e) Null-Byte Check: Bloqueia binários mascarados       │
└────────────────────────────┬────────────────────────────┘
                             │ Se aprovado
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. CAMADA BACKEND (core/src/security/fileSecurity.js)   │
│  a) Payload Byte Length: Valida tamanho máximo <= 128KB │
│  b) Buffer Header Inspection: Valida Magic Bytes brutos │
│  c) Sanitização de Strings: Rejeita \0 e binários       │
│  d) Cofre Criptográfico: Cifra com AES-256-GCM          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Detalhamento Técnico das Camadas

### Camada 1: Frontend Pre-Flight Guard (`web/src/utils/fileSecurity.js`)

Ao soltar (*drag & drop*) ou selecionar um arquivo na interface web:

1. **Pre-Read Size Check (Zero Leitura em Memória):**
   * Antes de invocar qualquer leitura de stream ou conversão para texto, o atributo nativo `file.size` é inspecionado.
   * Chaves SSH legítimas (RSA, ECDSA, Ed25519) possuem entre 500 bytes e 4 KB.
   * O limite máximo estrito é fixado em **128 KB** (`131.072 bytes`).
   * Se o arquivo for maior, é **rejeitado instantaneamente**, sem consumir memória RAM do navegador.

2. **Inspeção de Cabeçalho Binário (Magic Bytes):**
   * Mesmo que um invasor renomeie um Zip Bomb para `id_rsa.pem`, os primeiros bytes do arquivo revelam sua verdadeira natureza.
   * O sistema realiza um slice não destrutivo de apenas 512 bytes (`file.slice(0, 512)`).
   * As assinaturas binárias conhecidas são confrontadas antes de qualquer processamento:

| Formato Detectado | Assinatura Binária (Hex) | Tipo de Ameaça |
| :--- | :--- | :--- |
| **ZIP / Zip Bomb** | `50 4B 03 04` / `50 4B 05 06` / `50 4B 07 08` | Descompressão recursiva / esgotamento de memória |
| **GZIP** | `1F 8B` | Bomba de compressão de bloco |
| **BZIP2** | `42 5A 68` (`BZh`) | Alta taxa de compressão |
| **7-Zip** | `37 7A BC AF 27 1C` | Compressão LZMA pesada |
| **RAR** | `52 61 72 21` (`Rar!`) | Container compactado |
| **XZ / LZMA** | `FD 37 7A 58 5A 00` | Compressão de dicionário pesado |
| **Zstandard (ZSTD)**| `28 B5 2F FD` | Stream compactado |
| **TAR / TarBomb** | Offset 257: `75 73 74 61 72` (`ustar`) | Arquivo de arquivo / Tar Bomb |
| **Unix Compress** | `1F 9D` / `1F A0` | Algoritmo LZW legado |

3. **Detecção de Bytes Nulos (`\0`):**
   * Chaves privadas SSH em formato PEM são puramente compostas por caracteres textuais imprimíveis (ASCII/UTF-8 base64 com delimitadores).
   * A presença de bytes nulos (`0x00`) indica arquivo executável compilado, imagem ou binário disfarçado, sendo bloqueado de imediato.

4. **Feedback Visual ao Operador:**
   * A zona de upload exibe o selo: `🛡️ Anti-ZipBomb Ativo`.
   * Caso um arquivo malicioso ou incompatível seja solto, um banner em vermelho com mensagem clara e detalhada informa o motivo do bloqueio e zera o estado do input.

---

### Camada 2: Backend API Guard (`core/src/security/fileSecurity.js`)

Para mitigar tentativas de envio direto via API REST (bypassing do frontend via `curl` ou Postman):

1. **Validação nos Endpoints `/api/equipments` (POST e PUT):**
   * Todo payload que contenha `credentials.privateKey` é interceptado por `validateKeySecurity(privateKey)`.
   * Verifica o tamanho em bytes reais no Buffer (`Buffer.byteLength(keyString, 'utf8') <= 128 KB`).
   * Inspeciona os Magic Bytes do buffer bruto decodificado.
   * Se violar qualquer regra, a requisição é abortada com **HTTP 400 Bad Request** antes de interagir com o Cofre ou o banco de dados.

---

## 4. Testes de Validação e Prova de Conceito

A rotina de proteção foi validada com os seguintes cenários de teste:

```
=== TESTES DE SEGURANÇA ANTI-ZIPBOMB ===
1. Chave legítima PEM: PASSED (Permitida)
2. Simulação Zip Bomb (PK\x03\x04): PASSED (Bloqueado: Payload com assinatura de arquivo compactado (ZIP / Zip Bomb))
3. Simulação GZIP (\x1F\x8B): PASSED (Bloqueado: Payload com assinatura de arquivo compactado (GZIP))
4. Simulação Tar Bomb (ustar @ 257): PASSED (Bloqueado: Payload com cabeçalho de arquivo TAR/TarBomb)
5. Payload gigante (> 128 KB): PASSED (Bloqueado: Tamanho de chave excede o limite máximo permitido de 128 KB)
6. Payload com null-bytes (\0): PASSED (Bloqueado: Chave contém caracteres nulos ou dados binários incompatíveis)
```

---

## 5. Boas Práticas para Futuras Novas Telas de Upload

Se novas funcionalidades de upload forem adicionadas no futuro (ex: upload de certificados TLS, firmwares, backups):
1. **Nunca descompacte arquivos automaticamente** sem verificar a taxa de compressão (*uncompressed size / compressed size <= 100*).
2. **Importe sempre `detectArchiveMagicBytes` ou `validateSecureUpload`** de `web/src/utils/fileSecurity.js`.
3. **Utilize cotas estritas de tamanho pré-leitura** (`file.size`) em qualquer manipulação de arquivos no navegador.
