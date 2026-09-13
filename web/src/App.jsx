import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Server, 
  Database, 
  HardDrive, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Send, 
  Radio, 
  Clock, 
  RefreshCw, 
  Info, 
  Plus, 
  Trash2, 
  Key, 
  X, 
  AlertCircle, 
  Pencil, 
  Copy, 
  Check, 
  Terminal, 
  Cpu, 
  Layers, 
  Filter, 
  BellOff, 
  Building2, 
  Store, 
  Tag, 
  Users, 
  UserPlus, 
  ShieldAlert, 
  KeyRound, 
  LogOut, 
  QrCode, 
  Smartphone, 
  UserCheck, 
  Shield, 
  AlertOctagon, 
  Sliders, 
  Zap, 
  Gauge, 
  GripVertical, 
  Unlock, 
  RotateCcw,
  Upload,
  FileText,
} from 'lucide-react';
import axios from 'axios';
import QRCodeLib from 'qrcode';

// Interceptor global do Axios para autenticação Bearer Token
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('noc_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
}, (error) => Promise.reject(error));

// Interceptor global para expiração de sessão (401)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/api/auth/')) {
      try {
        localStorage.removeItem('noc_auth_token');
        localStorage.removeItem('noc_current_user');
      } catch {}
    }
    return Promise.reject(error);
  }
);

function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const initialEquipmentForm = {
  name: '',
  type: 'PFSENSE',
  host: '',
  port: '',
  group: 'Geral',
  subgroup: '',
  tags: '',
  connectionMode: 'DIRECT',
  backupStorageId: '',
  backupSchedule: 'DAILY',
  apiKey: '',
  username: '',
  password: '',
  authMethod: 'KEY',
  privateKey: '',
  tokenId: '',
  tokenSecret: '',
  realm: 'pam',
};

const PLAN_PRESETS = {
  STARTER: {
    maxEquipments: 10,
    maxUsers: 3,
    maxStorages: 1,
    aiLevel: 'L1_READ',
    retentionDays: 7,
  },
  PROFESSIONAL: {
    maxEquipments: 50,
    maxUsers: 10,
    maxStorages: 3,
    aiLevel: 'L2_REMEDIATION',
    retentionDays: 30,
  },
  ENTERPRISE: {
    maxEquipments: 0,
    maxUsers: 0,
    maxStorages: 0,
    aiLevel: 'L3_CRITICAL',
    retentionDays: 90,
  },
};

function EquipmentCredentialInputs({ form, setForm, storages = [], isEdit = false, existingGroups = [], existingSubgroups = [], allEquipments = [] }) {
  // Lista unificada de grupos existentes
  const availableGroups = useMemo(() => {
    const set = new Set(existingGroups.filter(Boolean));
    set.add('Geral');
    if (form.group && form.group.trim()) set.add(form.group.trim());
    return Array.from(set).sort();
  }, [existingGroups, form.group]);

  // Controle de digitação de novo grupo vs seleção em dropdown
  const [isNewGroup, setIsNewGroup] = useState(() => {
    return form.group && !existingGroups.includes(form.group) && form.group !== 'Geral';
  });

  // Lista de subgrupos existentes ESPECÍFICOS para o grupo selecionado
  const currentGroupSubgroups = useMemo(() => {
    const currentGroup = form.group?.trim() || 'Geral';
    return Array.from(
      new Set(
        allEquipments
          .filter(e => (e.group?.trim() || 'Geral') === currentGroup)
          .map(e => e.subgroup?.trim())
          .filter(Boolean)
      )
    ).sort();
  }, [allEquipments, form.group]);

  // Controle de digitação de nova unidade/subgrupo vs seleção em dropdown
  const [isNewSubgroup, setIsNewSubgroup] = useState(() => {
    return form.subgroup && !currentGroupSubgroups.includes(form.subgroup);
  });

  // Estados e manipuladores para Upload / Drag & Drop de Chave SSH
  const [isDraggingKey, setIsDraggingKey] = useState(false);
  const [keyFileName, setKeyFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleKeyFileSelected = (file) => {
    if (!file) return;
    setKeyFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result || '';
      setForm((prev) => ({ ...prev, privateKey: content }));
    };
    reader.readAsText(file);
  };

  const handleKeyDrop = (e) => {
    e.preventDefault();
    setIsDraggingKey(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleKeyFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleKeyDragOver = (e) => {
    e.preventDefault();
    setIsDraggingKey(true);
  };

  const handleKeyDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingKey(false);
  };

  return (
    <>
      <div>
        <label className="block text-slate-300 font-medium mb-1">Nome do Equipamento *</label>
        <input
          type="text"
          required
          placeholder="Ex: pfSense Matriz, Mikrotik Borda, Proxmox Cluster"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* HIERARQUIA MULTI-TENANT: GRUPO & SUBGRUPO */}
      <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-sky-400" />
            Organização Multi-Tenant & Localidade
          </label>
          <span className="text-[10px] text-slate-500 font-mono">Filtros & Correlação NOC</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* CAMPO: GRUPO / CLIENTE (TENANT) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-[11px] font-medium">Grupo / Cliente (Tenant)</label>
              <button
                type="button"
                onClick={() => {
                  if (isNewGroup) {
                    setIsNewGroup(false);
                    if (!availableGroups.includes(form.group)) {
                      setForm({ ...form, group: availableGroups[0] || 'Geral' });
                    }
                  } else {
                    setIsNewGroup(true);
                  }
                }}
                className="text-[10px] text-sky-400 hover:text-sky-300 transition underline font-medium"
              >
                {isNewGroup ? '↩ Escolher da Lista' : '+ Novo Grupo'}
              </button>
            </div>

            {isNewGroup ? (
              <input
                type="text"
                autoFocus
                placeholder="Ex: Matriz, Filial Norte, Datacenter"
                value={form.group || ''}
                onChange={e => setForm({ ...form, group: e.target.value })}
                className="w-full bg-slate-900 border border-sky-500/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-400"
              />
            ) : (
              <select
                value={form.group || 'Geral'}
                onChange={e => {
                  if (e.target.value === '__NEW__') {
                    setIsNewGroup(true);
                    setForm({ ...form, group: '' });
                  } else {
                    setForm({ ...form, group: e.target.value });
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {availableGroups.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__NEW__" className="text-sky-400 font-semibold bg-slate-950">
                  + Digitar Novo Grupo...
                </option>
              </select>
            )}
          </div>

          {/* CAMPO: SUBGRUPO / UNIDADE / FILIAL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 text-[11px] font-medium">Subgrupo / Unidade / Filial</label>
              <button
                type="button"
                onClick={() => {
                  if (isNewSubgroup) {
                    setIsNewSubgroup(false);
                  } else {
                    setIsNewSubgroup(true);
                  }
                }}
                className="text-[10px] text-sky-400 hover:text-sky-300 transition underline font-medium"
              >
                {isNewSubgroup 
                  ? (currentGroupSubgroups.length > 0 ? '↩ Escolher da Lista' : '') 
                  : '+ Nova Unidade'}
              </button>
            </div>

            {isNewSubgroup || currentGroupSubgroups.length === 0 ? (
              <input
                type="text"
                placeholder={currentGroupSubgroups.length === 0 ? "Ex: Loja 01, CD, VMs" : "Nova Unidade / Loja..."}
                value={form.subgroup || ''}
                onChange={e => setForm({ ...form, subgroup: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
            ) : (
              <select
                value={form.subgroup || ''}
                onChange={e => {
                  if (e.target.value === '__NEW__') {
                    setIsNewSubgroup(true);
                    setForm({ ...form, subgroup: '' });
                  } else {
                    setForm({ ...form, subgroup: e.target.value });
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="">— Sem subgrupo (Raiz do Grupo) —</option>
                {currentGroupSubgroups.map(sg => (
                  <option key={sg} value={sg}>
                    {sg}
                  </option>
                ))}
                <option value="__NEW__" className="text-sky-400 font-semibold bg-slate-950">
                  + Digitar Nova Unidade...
                </option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-[11px] font-medium mb-1">Tags / Etiquetas (Opcional, separadas por vírgula)</label>
          <input
            type="text"
            placeholder="Ex: borda, pdv, mikrotik, producao"
            value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags || ''}
            onChange={e => setForm({ ...form, tags: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-300 font-medium mb-1">Tipo de Equipamento *</label>
          <select
            value={form.type}
            onChange={e => {
              const nextType = e.target.value;
              let defaultPort = form.port;
              let defaultMode = form.connectionMode;
              if (nextType === 'MIKROTIK') { defaultPort = defaultPort || '8728'; defaultMode = 'DIRECT'; }
              if (nextType === 'LINUX_SERVER') { defaultPort = defaultPort || '22'; defaultMode = 'AGENT'; }
              if (nextType === 'WINDOWS_SERVER') { defaultPort = defaultPort || '5985'; defaultMode = 'AGENT'; }
              if (nextType === 'PROXMOX') { defaultPort = defaultPort || '8006'; defaultMode = 'DIRECT'; }
              if (nextType === 'PFSENSE') { defaultMode = 'DIRECT'; }
              setForm({ ...form, type: nextType, port: defaultPort, connectionMode: defaultMode });
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
          >
            <option value="PFSENSE">pfSense Firewall (REST API)</option>
            <option value="MIKROTIK">Mikrotik RouterOS (API)</option>
            <option value="LINUX_SERVER">Servidor Linux (SSH / Agente)</option>
            <option value="WINDOWS_SERVER">Servidor Windows (WinRM / Agente)</option>
            <option value="PROXMOX">Proxmox VE Cluster</option>
            <option value="ZABBIX">Zabbix Server</option>
            <option value="GENERIC_SNMP">SNMP Genérico</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-300 font-medium mb-1">Porta (Opcional)</label>
          <input
            type="number"
            placeholder={
              form.type === 'MIKROTIK' ? '8728' :
              form.type === 'LINUX_SERVER' ? '22' :
              form.type === 'WINDOWS_SERVER' ? '5985' :
              form.type === 'PROXMOX' ? '8006' :
              form.type === 'PFSENSE' ? '443' : 'Porta'
            }
            value={form.port}
            onChange={e => setForm({ ...form, port: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {(form.type === 'LINUX_SERVER' || form.type === 'WINDOWS_SERVER') && (
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
          <label className="block text-slate-300 font-medium text-xs">Modo de Conexão com o Servidor:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, connectionMode: 'AGENT' })}
              className={`p-2.5 rounded-lg border text-left transition ${
                form.connectionMode === 'AGENT'
                  ? 'bg-sky-950/90 border-sky-500 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                Agente Outbound (1-Clique)
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Zero portas de entrada abertas. Auto-instalação e telemetria 60s.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, connectionMode: 'DIRECT' })}
              className={`p-2.5 rounded-lg border text-left transition ${
                form.connectionMode === 'DIRECT'
                  ? 'bg-sky-950/90 border-sky-500 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Conexão Direta ({form.type === 'LINUX_SERVER' ? 'SSH' : 'WinRM'})
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Requer IP alcançável e credenciais cifradas no cofre.
              </p>
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-slate-300 font-medium mb-1">
          {form.connectionMode === 'AGENT' ? 'Host / Identificador de Rede (Opcional)' : 'Host / IP / URL Base *'}
        </label>
        <input
          type="text"
          required={form.connectionMode === 'DIRECT'}
          placeholder={
            form.type === 'PFSENSE' ? 'Ex: https://pfsense.seudominio.com.br:8181' :
            form.type === 'PROXMOX' ? 'Ex: https://pve.seudominio.com.br:8006' :
            form.type === 'MIKROTIK' ? 'Ex: 192.168.88.1 ou vpn.mikrotik.com' :
            'Ex: 192.168.1.100 ou srv-app.local'
          }
          value={form.host}
          onChange={e => setForm({ ...form, host: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
        />
      </div>

      {/* CREDENCIAIS DINÂMICAS BASEADAS NO TIPO */}
      {form.connectionMode === 'AGENT' ? (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-200 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <Terminal className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold block">Instalação 1-Clique com Agente Outbound</span>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                Nenhuma senha precisa trafegar ou ser armazenada. Ao clicar em <strong>Salvar & Copiar Comando</strong>, o token único é gerado e o comando pronto é copiado automaticamente para sua área de transferência para colar no servidor.
              </p>
            </div>
          </div>
          <div className="p-2 bg-slate-950/80 rounded border border-emerald-900/50 font-mono text-[10.5px] text-emerald-300/90 flex items-center justify-between gap-2">
            <span className="truncate">
              {form.type === 'WINDOWS_SERVER' 
                ? 'irm <servidor>/api/agent/install-script/:id | iex' 
                : 'curl -fsSL <servidor>/api/agent/install-script/:id | sudo bash'}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-900/80 text-emerald-300 rounded font-sans font-semibold flex-shrink-0">
              Cópia automática ao salvar
            </span>
          </div>
        </div>
      ) : form.type === 'MIKROTIK' ? (
        <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            Credenciais da API RouterOS (Mikrotik)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Usuário *</label>
              <input
                type="text"
                required={!isEdit}
                placeholder="Ex: api-noc ou admin"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Senha *</label>
              <input
                type="password"
                required={!isEdit}
                placeholder={isEdit ? 'Deixe em branco para manter' : 'Senha do RouterOS'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      ) : form.type === 'LINUX_SERVER' ? (
        <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-sky-400 font-medium flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Autenticação SSH Linux
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, authMethod: 'KEY' })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  form.authMethod === 'KEY'
                    ? 'bg-sky-950 border-sky-600 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Chave SSH (.pem)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, authMethod: 'PASSWORD' })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  form.authMethod === 'PASSWORD'
                    ? 'bg-sky-950 border-sky-600 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Senha SSH
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Usuário SSH *</label>
            <input
              type="text"
              required={!isEdit}
              placeholder="Ex: root ou ubuntu"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>

          {form.authMethod === 'KEY' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-slate-300 font-medium">Chave Privada SSH (.pem / id_rsa) *</label>
                {keyFileName && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {keyFileName}
                  </span>
                )}
              </div>

              {/* ZONA DE ARRASTAR OU CLICAR PARA SELECIONAR ARQUIVO */}
              <div
                onDrop={handleKeyDrop}
                onDragOver={handleKeyDragOver}
                onDragLeave={handleKeyDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center ${
                  isDraggingKey
                    ? 'border-sky-400 bg-sky-950/60 shadow-lg shadow-sky-950/50'
                    : form.privateKey
                    ? 'border-emerald-700/60 bg-emerald-950/20 hover:border-emerald-600'
                    : 'border-slate-700/70 bg-slate-950/40 hover:border-sky-600 hover:bg-slate-900/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleKeyFileSelected(e.target.files[0]);
                    }
                  }}
                  accept=".pem,.key,.rsa,.txt,id_rsa,id_ecdsa,id_ed25519"
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${form.privateKey ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold text-slate-200">
                      {keyFileName ? `Arquivo carregado: ${keyFileName}` : 'Arraste o arquivo da chave aqui ou clique para selecionar'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Suporta .pem, .key, id_rsa, id_ed25519 ou arquivo de texto
                    </p>
                  </div>
                </div>
              </div>

              {/* ÁREA PARA COLAR OU EDITAR O CÓDIGO DA CHAVE */}
              <div className="relative">
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-sky-400" />
                    Conteúdo da Chave (ou cole diretamente abaixo):
                  </span>
                  {form.privateKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, privateKey: '' }));
                        setKeyFileName('');
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 transition"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <textarea
                  rows={4}
                  required={!isEdit}
                  placeholder={isEdit ? 'Deixe em branco para manter a chave atual' : '-----BEGIN RSA/OPENSSH PRIVATE KEY-----\n...\n-----END RSA/OPENSSH PRIVATE KEY-----'}
                  value={form.privateKey}
                  onChange={e => {
                    setForm(prev => ({ ...prev, privateKey: e.target.value }));
                    if (!e.target.value) setKeyFileName('');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500 transition"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Senha SSH *</label>
              <input
                type="password"
                required={!isEdit}
                placeholder={isEdit ? 'Deixe em branco para manter a senha' : 'Senha do usuário SSH'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
            </div>
          )}
        </div>
      ) : form.type === 'WINDOWS_SERVER' ? (
        <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
            <Server className="w-3.5 h-3.5" />
            Autenticação WinRM Windows
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Usuário *</label>
              <input
                type="text"
                required={!isEdit}
                placeholder="Ex: Administrator"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Senha *</label>
              <input
                type="password"
                required={!isEdit}
                placeholder={isEdit ? 'Deixe em branco para manter' : 'Senha do Windows'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      ) : form.type === 'PROXMOX' ? (
        <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-sky-400 font-medium flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Autenticação Proxmox VE
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, authMethod: 'TOKEN' })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  form.authMethod === 'TOKEN'
                    ? 'bg-sky-950 border-sky-600 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                API Token
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, authMethod: 'USER_PASS' })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  form.authMethod === 'USER_PASS'
                    ? 'bg-sky-950 border-sky-600 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Usuário / Senha
              </button>
            </div>
          </div>

          {form.authMethod === 'TOKEN' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Token ID *</label>
                <input
                  type="text"
                  required={!isEdit}
                  placeholder="Ex: root@pam!nocagent"
                  value={form.tokenId}
                  onChange={e => setForm({ ...form, tokenId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Token Secret *</label>
                <input
                  type="password"
                  required={!isEdit}
                  placeholder={isEdit ? 'Deixe em branco para manter' : 'Secret UUID'}
                  value={form.tokenSecret}
                  onChange={e => setForm({ ...form, tokenSecret: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Usuário *</label>
                <input
                  type="text"
                  required={!isEdit}
                  placeholder="root"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Senha *</label>
                <input
                  type="password"
                  required={!isEdit}
                  placeholder={isEdit ? 'Manter' : 'Senha'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Realm</label>
                <select
                  value={form.realm || 'pam'}
                  onChange={e => setForm({ ...form, realm: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="pam">Linux PAM (pam)</option>
                  <option value="pve">Proxmox VE (pve)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-slate-300 font-medium mb-1">Chave de API / Token *</label>
          <input
            type="password"
            required={!isEdit}
            placeholder={isEdit ? 'Deixe em branco para manter a chave atual' : 'Cole a API Key ou Token'}
            value={form.apiKey}
            onChange={e => setForm({ ...form, apiKey: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
          />
          <p className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Criptografia AES-256-GCM antes de gravar no PostgreSQL.
          </p>
        </div>
      )}

      {/* VÍNCULO COM STORAGE DE BACKUP */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        <div>
          <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
            <Database className="w-3 h-3 text-sky-400" />
            Storage de Backup
          </label>
          <select
            value={form.backupStorageId || ''}
            onChange={e => setForm({ ...form, backupStorageId: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
          >
            <option value="">Nenhum storage vinculado</option>
            {storages.map(st => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-emerald-400" />
            Rotina de Backup
          </label>
          <select
            value={form.backupSchedule || 'DAILY'}
            onChange={e => setForm({ ...form, backupSchedule: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
          >
            <option value="DAILY">Diário às 00:00</option>
            <option value="WEEKLY">Semanal aos Domingos</option>
            <option value="HOURLY">A cada 6 horas</option>
          </select>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  // --- AUTENTICAÇÃO E SESSÃO ---
  const [authToken, setAuthToken] = useState(() => {
    try {
      return localStorage.getItem('noc_auth_token') || '';
    } catch {
      return '';
    }
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('noc_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Formulário de Login & 2FA
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [login2faCode, setLogin2faCode] = useState('');
  const [loginTempToken, setLoginTempToken] = useState('');
  const [loginStep, setLoginStep] = useState('CREDENTIALS'); // 'CREDENTIALS' | '2FA'
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Setup de 2FA
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [setup2faSecret, setSetup2faSecret] = useState('');
  const [setup2faKeyuri, setSetup2faKeyuri] = useState('');
  const [setup2faQrCode, setSetup2faQrCode] = useState('');
  const [setup2faCode, setSetup2faCode] = useState('');
  const [setup2faLoading, setSetup2faLoading] = useState(false);
  const [setup2faError, setSetup2faError] = useState(null);
  const [setup2faSuccess, setSetup2faSuccess] = useState(null);

  // Gestão de Tenants (Exclusivo SUPERADMIN)
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [tenantForm, setTenantForm] = useState({
    name: '',
    slug: '',
    document: '',
    plan: 'PROFESSIONAL',
    status: 'ACTIVE',
    maxEquipments: 50,
    maxUsers: 10,
    maxStorages: 3,
    aiLevel: 'L2_REMEDIATION',
    retentionDays: 30,
  });
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantError, setTenantError] = useState(null);

  // Gestão de Usuários (SUPERADMIN & TENANT_MASTER)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userTenantFilter, setUserTenantFilter] = useState('ALL');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'OPERATOR',
    tenantId: '',
    phone: '',
    active: true,
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState(null);

  // Validação periódica ou de inicialização da sessão
  useEffect(() => {
    if (authToken) {
      axios.get('/api/auth/me')
        .then((res) => {
          if (res.data?.user) {
            setCurrentUser(res.data.user);
            try {
              localStorage.setItem('noc_current_user', JSON.stringify(res.data.user));
            } catch {}
          }
        })
        .catch(() => {
          handleLogout();
        });
    }
  }, [authToken]);

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    try {
      localStorage.removeItem('noc_auth_token');
      localStorage.removeItem('noc_current_user');
    } catch {}
    setLoginStep('CREDENTIALS');
    setLoginEmail('');
    setLoginPassword('');
    setLogin2faCode('');
    setLoginTempToken('');
    setLoginError(null);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await axios.post('/api/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });

      if (res.data.require2fa) {
        setLoginTempToken(res.data.tempToken);
        setLoginStep('2FA');
        setLogin2faCode('');
      } else {
        const token = res.data.token;
        const user = res.data.user;
        setAuthToken(token);
        setCurrentUser(user);
        try {
          localStorage.setItem('noc_auth_token', token);
          localStorage.setItem('noc_current_user', JSON.stringify(user));
        } catch {}
        setLoginPassword('');
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Erro ao realizar login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerify2faSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await axios.post('/api/auth/verify-2fa', {
        tempToken: loginTempToken,
        code: login2faCode.trim(),
      });

      const token = res.data.token;
      const user = res.data.user;
      setAuthToken(token);
      setCurrentUser(user);
      try {
        localStorage.setItem('noc_auth_token', token);
        localStorage.setItem('noc_current_user', JSON.stringify(user));
      } catch {}
      setLoginPassword('');
      setLogin2faCode('');
      setLoginTempToken('');
      setLoginStep('CREDENTIALS');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Código 2FA incorreto ou expirado.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleStartSetup2fa = async () => {
    setSetup2faLoading(true);
    setSetup2faError(null);
    setSetup2faSuccess(null);
    setSetup2faCode('');
    setSetup2faQrCode('');
    try {
      const res = await axios.post('/api/auth/setup-2fa');
      const secret = res.data.secret;
      const keyuri = res.data.keyuri || res.data.otpauth || `otpauth://totp/NOC-Agent:${currentUser?.email || 'admin@nocagent.local'}?secret=${secret}&issuer=NOC-Agent`;
      setSetup2faSecret(secret);
      setSetup2faKeyuri(keyuri);

      if (res.data.qrCode) {
        setSetup2faQrCode(res.data.qrCode);
      } else {
        // Fallback: renderiza QR Code no próprio cliente caso a API retorne apenas a URI
        try {
          const clientQr = await QRCodeLib.toDataURL(keyuri, {
            margin: 2,
            width: 240,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
          setSetup2faQrCode(clientQr);
        } catch (e) {
          console.error('Erro ao gerar QR Code localmente:', e);
        }
      }

      setIs2faModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao iniciar configuração do 2FA.');
    } finally {
      setSetup2faLoading(false);
    }
  };

  const handleConfirm2fa = async (e) => {
    e.preventDefault();
    setSetup2faLoading(true);
    setSetup2faError(null);
    try {
      await axios.post('/api/auth/confirm-2fa', {
        secret: setup2faSecret,
        code: setup2faCode.trim(),
      });
      setSetup2faSuccess('Autenticação em Dois Fatores ativada com sucesso!');
      setCurrentUser((prev) => ({ ...prev, totpEnabled: true }));
      setTimeout(() => {
        setIs2faModalOpen(false);
        setSetup2faSuccess(null);
      }, 1500);
    } catch (err) {
      setSetup2faError(err.response?.data?.error || 'Código 2FA incorreto.');
    } finally {
      setSetup2faLoading(false);
    }
  };

  // Funções de Tenants
  const fetchTenants = async () => {
    if (currentUser?.role !== 'SUPERADMIN') return;
    setLoadingTenants(true);
    try {
      const res = await axios.get('/api/tenants');
      setTenants(res.data.data || []);
    } catch (err) {
      console.error('Erro ao listar tenants:', err);
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    setTenantSaving(true);
    setTenantError(null);
    try {
      if (editingTenant) {
        await axios.put(`/api/tenants/${editingTenant.id}`, tenantForm);
      } else {
        await axios.post('/api/tenants', tenantForm);
      }
      setIsTenantModalOpen(false);
      setEditingTenant(null);
      setTenantForm({
        name: '',
        slug: '',
        document: '',
        plan: 'PROFESSIONAL',
        status: 'ACTIVE',
        maxEquipments: 50,
        maxUsers: 10,
        maxStorages: 3,
        aiLevel: 'L2_REMEDIATION',
        retentionDays: 30,
      });
      fetchTenants();
    } catch (err) {
      setTenantError(err.response?.data?.error || 'Erro ao salvar tenant.');
    } finally {
      setTenantSaving(false);
    }
  };

  const handleDeleteTenant = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja remover o tenant "${name}"?`)) return;
    try {
      await axios.delete(`/api/tenants/${id}`);
      fetchTenants();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir tenant.');
    }
  };

  // Funções de Usuários
  const fetchUsers = async () => {
    if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'TENANT_MASTER') return;
    setLoadingUsers(true);
    try {
      const params = userTenantFilter !== 'ALL' && currentUser?.role === 'SUPERADMIN' ? { tenantId: userTenantFilter } : {};
      const res = await axios.get('/api/users', { params });
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserSaving(true);
    setUserError(null);
    try {
      if (editingUser) {
        const payload = {
          name: userForm.name,
          role: userForm.role,
          phone: userForm.phone,
          active: userForm.active,
        };
        if (userForm.password) payload.password = userForm.password;
        await axios.put(`/api/users/${editingUser.id}`, payload);
      } else {
        await axios.post('/api/users', userForm);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserForm({
        name: '',
        email: '',
        password: '',
        role: 'OPERATOR',
        tenantId: '',
        phone: '',
        active: true,
      });
      fetchUsers();
    } catch (err) {
      setUserError(err.response?.data?.error || 'Erro ao salvar usuário.');
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja remover o usuário "${name}"?`)) return;
    try {
      await axios.delete(`/api/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir usuário.');
    }
  };

  // --- GOVERNANÇA, FEATURE FLAGS & APM ---
  const [flagsData, setFlagsData] = useState({ killSwitch: { active: false }, flags: [] });
  const [apmMetrics, setApmMetrics] = useState(null);
  const [mcpTraces, setMcpTraces] = useState([]);
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [loadingApm, setLoadingApm] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState('');
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [traceFilter, setTraceFilter] = useState('ALL');
  const [governanceTenantFilter, setGovernanceTenantFilter] = useState('ALL');

  const fetchFlags = async () => {
    setLoadingFlags(true);
    try {
      const url = governanceTenantFilter && governanceTenantFilter !== 'ALL'
        ? `/api/flags?tenantId=${governanceTenantFilter}`
        : '/api/flags';
      const res = await axios.get(url);
      setFlagsData(res.data);
    } catch (err) {
      console.error('Erro ao buscar flags:', err);
    } finally {
      setLoadingFlags(false);
    }
  };

  const fetchApm = async () => {
    setLoadingApm(true);
    try {
      const [apmRes, tracesRes] = await Promise.all([
        axios.get('/api/observability/apm').catch(() => ({ data: { apm: null } })),
        axios.get('/api/observability/traces?limit=60').catch(() => ({ data: { traces: [] } })),
      ]);
      if (apmRes.data?.apm) setApmMetrics(apmRes.data.apm);
      if (apmRes.data?.killSwitch) {
        setFlagsData((prev) => ({ ...prev, killSwitch: apmRes.data.killSwitch }));
      }
      if (tracesRes.data?.traces) setMcpTraces(tracesRes.data.traces);
    } catch (err) {
      console.error('Erro ao carregar APM:', err);
    } finally {
      setLoadingApm(false);
    }
  };

  const handleToggleKillSwitch = async (activate) => {
    try {
      const res = await axios.post('/api/flags/kill-switch', {
        active: activate,
        reason: activate ? (killSwitchReason || 'Acionamento manual de emergência') : 'Retomada de operação',
      });
      setFlagsData((prev) => ({ ...prev, killSwitch: res.data.killSwitch }));
      setIsKillSwitchModalOpen(false);
      setKillSwitchReason('');
      fetchApm();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alternar Kill-Switch.');
    }
  };

  const handleToggleFlag = async (key, currentEnabled, currentValue) => {
    try {
      await axios.post(`/api/flags/${key}/toggle`, {
        enabled: !currentEnabled,
        value: currentValue,
        tenantId: governanceTenantFilter !== 'ALL' ? governanceTenantFilter : null,
      });
      fetchFlags();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar flag.');
    }
  };

  useEffect(() => {
    if (activeTab === 'tenants' && currentUser?.role === 'SUPERADMIN') {
      fetchTenants();
    }
    if (activeTab === 'users' && (currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'TENANT_MASTER')) {
      fetchUsers();
      if (currentUser?.role === 'SUPERADMIN') {
        fetchTenants();
      }
    }
    if (activeTab === 'observability' && currentUser?.role === 'SUPERADMIN') {
      fetchFlags();
      fetchApm();
      fetchTenants();
      const interval = setInterval(() => {
        fetchApm();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab, currentUser, userTenantFilter, governanceTenantFilter]);

  // Checagem periódica global de status do Kill-Switch
  useEffect(() => {
    if (authToken && currentUser) {
      axios.get('/api/flags')
        .then((res) => {
          if (res.data?.killSwitch) {
            setFlagsData((prev) => ({ ...prev, killSwitch: res.data.killSwitch }));
          }
        })
        .catch(() => {});
    }
  }, [authToken, currentUser]);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: '👋 Olá! Sou o **NOC-Agent**, seu Engenheiro de Operações 24/7. Como posso ajudar com a infraestrutura hoje?',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Estados de Dados 100% Reais
  const [equipmentList, setEquipmentList] = useState([]);
  const [noEquipment, setNoEquipment] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState(null);

  // Filtros hierárquicos multi-tenant na visão geral (Cliente / Unidade / Tipo)
  const [overviewTypeFilter, setOverviewTypeFilter] = useState('ALL');
  const [overviewGroupFilter, setOverviewGroupFilter] = useState('ALL');
  const [overviewSubgroupFilter, setOverviewSubgroupFilter] = useState('ALL');
  const [groupByUnit, setGroupByUnit] = useState(false);

  // Listas distintas de Grupos e Subgrupos calculadas dinamicamente
  const distinctGroups = Array.from(
    new Set(equipmentList.map((e) => e.group?.trim() || 'Geral'))
  ).sort();

  const distinctSubgroups = Array.from(
    new Set(
      equipmentList
        .filter((e) => overviewGroupFilter === 'ALL' || (e.group?.trim() || 'Geral') === overviewGroupFilter)
        .map((e) => e.subgroup?.trim())
        .filter(Boolean)
    )
  ).sort();

  // Lista filtrada final considerando Tipo, Grupo (Tenant) e Subgrupo (Unidade)
  const filteredEquipments = equipmentList.filter((eq) => {
    const matchType = overviewTypeFilter === 'ALL' || eq.type === overviewTypeFilter;
    const matchGroup = overviewGroupFilter === 'ALL' || (eq.group?.trim() || 'Geral') === overviewGroupFilter;
    const matchSubgroup = overviewSubgroupFilter === 'ALL' || (eq.subgroup?.trim() || '') === overviewSubgroupFilter;
    return matchType && matchGroup && matchSubgroup;
  });

  // Ordenação personalizada de cards por Drag & Drop vinculada ao usuário logado
  const [customCardOrder, setCustomCardOrder] = useState(() => {
    try {
      const uid = currentUser?.id || currentUser?.email || 'default';
      const saved = localStorage.getItem(`noc_card_order_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sincroniza ordenação personalizada sempre que o usuário ativo mudar
  useEffect(() => {
    try {
      const uid = currentUser?.id || currentUser?.email || 'default';
      const saved = localStorage.getItem(`noc_card_order_${uid}`);
      setCustomCardOrder(saved ? JSON.parse(saved) : []);
    } catch {
      setCustomCardOrder([]);
    }
  }, [currentUser?.id, currentUser?.email]);

  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragOverCardId, setDragOverCardId] = useState(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);

  // Aplica ordenação personalizada por usuário aos equipamentos filtrados
  const orderedEquipments = useMemo(() => {
    if (!customCardOrder || customCardOrder.length === 0) {
      return filteredEquipments;
    }
    const orderMap = new Map();
    customCardOrder.forEach((id, index) => {
      orderMap.set(String(id), index);
    });
    return [...filteredEquipments].sort((a, b) => {
      const indexA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : 999999;
      const indexB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : 999999;
      if (indexA !== indexB) return indexA - indexB;
      return 0;
    });
  }, [filteredEquipments, customCardOrder]);

  const handleDragStart = (e, id) => {
    if (isLayoutLocked) return;
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(id));
    } catch {}
  };

  const handleDragOver = (e, id) => {
    if (isLayoutLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCardId !== id) {
      setDragOverCardId(id);
    }
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (isLayoutLocked) return;
    if (!draggedCardId || String(draggedCardId) === String(targetId)) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }

    const currentIds = orderedEquipments.map((eq) => String(eq.id));
    const fromIndex = currentIds.indexOf(String(draggedCardId));
    const toIndex = currentIds.indexOf(String(targetId));

    if (fromIndex !== -1 && toIndex !== -1) {
      const newIds = [...currentIds];
      const [moved] = newIds.splice(fromIndex, 1);
      newIds.splice(toIndex, 0, moved);

      // Preserva outros IDs existentes que não estavam no filtro ativo
      const allKnownIds = [...new Set([...newIds, ...customCardOrder.map(String)])];
      setCustomCardOrder(allKnownIds);

      try {
        const uid = currentUser?.id || currentUser?.email || 'default';
        localStorage.setItem(`noc_card_order_${uid}`, JSON.stringify(allKnownIds));
      } catch {}
    }

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleResetCardOrder = () => {
    setCustomCardOrder([]);
    try {
      const uid = currentUser?.id || currentUser?.email || 'default';
      localStorage.removeItem(`noc_card_order_${uid}`);
    } catch {}
  };

  // Silenciamento de alertas com persistência em localStorage
  const [snoozeAlertUntil, setSnoozeAlertUntil] = useState(() => {
    try {
      const saved = localStorage.getItem('noc_snooze_alert_until');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isSnoozeMenuOpen, setIsSnoozeMenuOpen] = useState(false);

  const handleSnoozeAlert = (minutes) => {
    const until = Date.now() + minutes * 60 * 1000;
    setSnoozeAlertUntil(until);
    try {
      localStorage.setItem('noc_snooze_alert_until', String(until));
    } catch {}
    setIsSnoozeMenuOpen(false);
  };

  const handleClearSnooze = () => {
    setSnoozeAlertUntil(0);
    try {
      localStorage.removeItem('noc_snooze_alert_until');
    } catch {}
  };

  const isAlertSnoozed = snoozeAlertUntil > Date.now();
  const snoozeRemainingMinutes = Math.max(1, Math.round((snoozeAlertUntil - Date.now()) / 60000));

  const [equipments, setEquipments] = useState([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  // Cofre de Storages (MinIO, S3, Wasabi, SFTP, NFS)
  const [storages, setStorages] = useState([]);
  const [loadingStorages, setLoadingStorages] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [savingStorage, setSavingStorage] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [storageForm, setStorageForm] = useState({
    id: '',
    name: '',
    type: 'S3_COMPATIBLE',
    endpoint: '',
    bucketOrPath: '',
    region: 'us-east-1',
    isDefault: false,
    accessKey: '',
    secretKey: '',
    username: '',
    password: '',
  });

  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Modal de Cadastro no Cofre
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [newEquipment, setNewEquipment] = useState({ ...initialEquipmentForm });

  // Modal de Edição no Cofre
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editEquipment, setEditEquipment] = useState({ id: '', ...initialEquipmentForm });

  // Modal de Instalação do Agente 1-Clique
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [selectedAgentEq, setSelectedAgentEq] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Helper para serializar credenciais por tipo de dispositivo
  const buildCredentials = (form) => {
    if (form.connectionMode === 'AGENT') {
      return { mode: 'AGENT' };
    }
    switch (form.type) {
      case 'MIKROTIK':
        return { username: form.username.trim(), password: form.password };
      case 'LINUX_SERVER':
        if (form.authMethod === 'KEY') {
          return { username: form.username.trim(), privateKey: form.privateKey.trim(), password: form.password || '' };
        }
        return { username: form.username.trim(), password: form.password };
      case 'WINDOWS_SERVER':
        return { username: form.username.trim(), password: form.password };
      case 'PROXMOX':
        if (form.authMethod === 'TOKEN') {
          return { tokenId: form.tokenId.trim(), tokenSecret: form.tokenSecret.trim() };
        }
        return { username: form.username.trim(), password: form.password, realm: form.realm || 'pam' };
      case 'PFSENSE':
      case 'ZABBIX':
      default:
        return { apiKey: form.apiKey.trim() };
    }
  };

  const handleCloneEquipment = (eq) => {
    setSaveError(null);
    setNewEquipment({
      ...initialEquipmentForm,
      name: `${eq.name} (Clone)`,
      type: eq.type,
      host: '', // Limpa o host para exigir a definição do IP do novo ativo e evitar duplicidade
      port: eq.port != null ? String(eq.port) : '',
      connectionMode: eq.connectionMode || 'DIRECT',
      backupStorageId: eq.backupStorageId || '',
      backupSchedule: eq.backupSchedule || 'DAILY',
      group: eq.group || 'Geral',
      subgroup: eq.subgroup || '',
      tags: Array.isArray(eq.tags) ? eq.tags.join(', ') : eq.tags || '',
      username: eq.username || '',
      authMethod: eq.authMethod || 'KEY',
      realm: eq.realm || 'pam',
      password: '',
      apiKey: '',
      privateKey: '',
      tokenId: '',
      tokenSecret: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (eq) => {
    setEditError(null);
    setEditEquipment({
      id: eq.id,
      name: eq.name,
      type: eq.type,
      host: eq.host,
      port: eq.port != null ? String(eq.port) : '',
      connectionMode: eq.connectionMode || 'DIRECT',
      backupStorageId: eq.backupStorageId || '',
      backupSchedule: eq.backupSchedule || 'DAILY',
      group: eq.group || 'Geral',
      subgroup: eq.subgroup || '',
      tags: Array.isArray(eq.tags) ? eq.tags.join(', ') : eq.tags || '',
      apiKey: '',
      username: '',
      password: '',
      authMethod: 'KEY',
      privateKey: '',
      tokenId: '',
      tokenSecret: '',
      realm: 'pam',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAgentModal = (eq) => {
    setSelectedAgentEq(eq);
    setCopySuccess(false);
    setIsAgentModalOpen(true);
  };

  const handleUpdateEquipment = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);
    try {
      const payload = {
        name: editEquipment.name.trim(),
        type: editEquipment.type,
        host: editEquipment.host.trim(),
        port: editEquipment.port ? parseInt(editEquipment.port, 10) : null,
        connectionMode: editEquipment.connectionMode,
        backupStorageId: editEquipment.backupStorageId || null,
        backupSchedule: editEquipment.backupSchedule,
        group: editEquipment.group ? editEquipment.group.trim() : 'Geral',
        subgroup: editEquipment.subgroup ? editEquipment.subgroup.trim() : null,
        tags: editEquipment.tags,
      };
      
      const creds = buildCredentials(editEquipment);
      if (Object.values(creds).some(v => v !== '')) {
        payload.credentials = creds;
      }

      await axios.put(`/api/equipments/${editEquipment.id}`, payload);
      setIsEditModalOpen(false);
      await fetchEquipments();
      await fetchEquipmentsStatus();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Erro ao atualizar equipamento no cofre.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Busca status real de todos os equipamentos cadastrados no Cofre
  const fetchEquipmentsStatus = async () => {
    setRefreshing(true);
    setStatusError(null);
    setNoEquipment(false);
    try {
      const res = await axios.get('/api/equipments/status');
      if (res.data?.status === 'ok') {
        const list = res.data.data || [];
        setEquipmentList(list);
        setNoEquipment(list.length === 0);
      } else if (res.data?.status === 'empty') {
        setNoEquipment(true);
        setEquipmentList([]);
      } else {
        setStatusError(res.data?.message || 'Falha ao consultar status dos equipamentos.');
        setEquipmentList([]);
      }
    } catch (err) {
      try {
        const fallbackRes = await axios.get('/api/equipments');
        const eqData = fallbackRes.data?.data || [];
        setEquipmentList(eqData);
        setNoEquipment(eqData.length === 0);
      } catch {
        setStatusError(err.response?.data?.message || 'Falha ao conectar com o serviço do NOC-Agent.');
      }
    } finally {
      setLoadingStatus(false);
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Busca lista real do cofre de equipamentos
  const fetchEquipments = async () => {
    setLoadingEquipments(true);
    try {
      const res = await axios.get('/api/equipments');
      setEquipments(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar equipamentos:', err);
    } finally {
      setLoadingEquipments(false);
    }
  };

  // Busca storages cadastrados no cofre
  const fetchStorages = async () => {
    setLoadingStorages(true);
    try {
      const res = await axios.get('/api/storages');
      setStorages(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar storages:', err);
    } finally {
      setLoadingStorages(false);
    }
  };

  // Cria ou atualiza storage no Cofre
  const handleSaveStorage = async (e) => {
    e.preventDefault();
    setSavingStorage(true);
    setStorageError(null);
    try {
      const payload = {
        name: storageForm.name.trim(),
        type: storageForm.type,
        endpoint: storageForm.endpoint.trim(),
        bucketOrPath: storageForm.bucketOrPath.trim(),
        region: storageForm.region || 'us-east-1',
        isDefault: storageForm.isDefault,
      };

      if (storageForm.type === 'S3_COMPATIBLE') {
        if (storageForm.accessKey || storageForm.secretKey) {
          payload.credentials = {
            accessKey: storageForm.accessKey.trim(),
            secretKey: storageForm.secretKey.trim(),
          };
        }
      } else if (storageForm.type === 'SFTP') {
        if (storageForm.username || storageForm.password) {
          payload.credentials = {
            username: storageForm.username.trim(),
            password: storageForm.password,
          };
        }
      }

      if (storageForm.id) {
        await axios.put(`/api/storages/${storageForm.id}`, payload);
      } else {
        await axios.post('/api/storages', payload);
      }

      setIsStorageModalOpen(false);
      setStorageForm({
        id: '',
        name: '',
        type: 'S3_COMPATIBLE',
        endpoint: '',
        bucketOrPath: '',
        region: 'us-east-1',
        isDefault: false,
        accessKey: '',
        secretKey: '',
        username: '',
        password: '',
      });
      await fetchStorages();
    } catch (err) {
      setStorageError(err.response?.data?.error || 'Erro ao salvar storage no cofre.');
    } finally {
      setSavingStorage(false);
    }
  };

  const handleDeleteStorage = async (id, name) => {
    if (!window.confirm(`Deseja realmente excluir o storage "${name}" do cofre?`)) return;
    try {
      await axios.delete(`/api/storages/${id}`);
      await fetchStorages();
    } catch (err) {
      alert(`Falha ao remover storage: ${err.response?.data?.error || err.message}`);
    }
  };

  // Cria novo equipamento no Cofre (AES-256-GCM)
  const handleCreateEquipment = async (e) => {
    e.preventDefault();
    if (!newEquipment.name) {
      setSaveError('Informe o nome do equipamento.');
      return;
    }
    if (newEquipment.connectionMode === 'DIRECT' && !newEquipment.host) {
      setSaveError('Para conexão direta, informe o Host ou IP do equipamento.');
      return;
    }

    const trimmedName = newEquipment.name.trim();
    const trimmedHost = newEquipment.host ? newEquipment.host.trim() : '';

    const nameExists = equipments.some(eq => eq.name?.trim().toLowerCase() === trimmedName.toLowerCase());
    if (nameExists) {
      setSaveError(`Já existe um equipamento cadastrado com o nome "${trimmedName}". Por favor, utilize um nome exclusivo.`);
      return;
    }

    if (newEquipment.connectionMode === 'DIRECT' && trimmedHost) {
      const hostExists = equipments.some(eq => {
        if (!eq.host) return false;
        const sameHost = eq.host.trim().toLowerCase() === trimmedHost.toLowerCase();
        const eqPort = eq.port != null ? String(eq.port) : '';
        const newPort = newEquipment.port != null ? String(newEquipment.port).trim() : '';
        return sameHost && (eqPort === newPort || (!eqPort && !newPort));
      });
      if (hostExists) {
        setSaveError(`Já existe um equipamento cadastrado com o host/endpoint "${trimmedHost}${newEquipment.port ? ':' + newEquipment.port : ''}". Por favor, defina um endpoint exclusivo.`);
        return;
      }
    }

    setSavingEquipment(true);
    setSaveError(null);
    try {
      const payload = {
        name: newEquipment.name.trim(),
        type: newEquipment.type,
        host: newEquipment.host.trim(),
        port: newEquipment.port ? parseInt(newEquipment.port, 10) : null,
        connectionMode: newEquipment.connectionMode,
        backupStorageId: newEquipment.backupStorageId || null,
        backupSchedule: newEquipment.backupSchedule,
        group: newEquipment.group ? newEquipment.group.trim() : 'Geral',
        subgroup: newEquipment.subgroup ? newEquipment.subgroup.trim() : null,
        tags: newEquipment.tags,
        credentials: buildCredentials(newEquipment),
      };

      const res = await axios.post('/api/equipments', payload);
      const createdEq = res.data?.data;

      setIsModalOpen(false);
      setNewEquipment({ ...initialEquipmentForm });

      await fetchEquipments();
      await fetchEquipmentsStatus();

      // Se for modo AGENT, copia automaticamente o comando de instalação para o clipboard e abre o modal
      if (newEquipment.connectionMode === 'AGENT' && createdEq) {
        const cmd = createdEq.type === 'WINDOWS_SERVER'
          ? `irm ${window.location.origin}/api/agent/install-script/${createdEq.id} | iex`
          : `curl -fsSL ${window.location.origin}/api/agent/install-script/${createdEq.id} | sudo bash`;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(cmd);
            setCopySuccess(true);
          }
        } catch {}
        handleOpenAgentModal(createdEq);
      }
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Erro ao cadastrar equipamento no cofre.');
    } finally {
      setSavingEquipment(false);
    }
  };

  // Remove equipamento do Cofre
  const handleDeleteEquipment = async (id, name) => {
    if (!window.confirm(`Deseja realmente remover o equipamento "${name}" do cofre criptográfico?`)) {
      return;
    }

    try {
      await axios.delete(`/api/equipments/${id}`);
      await fetchEquipments();
      await fetchEquipmentsStatus();
    } catch (err) {
      alert(`Falha ao remover: ${err.response?.data?.error || err.message}`);
    }
  };

  // Busca auditoria real de backups
  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await axios.get('/api/backups');
      setBackups(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchEquipmentsStatus();
    fetchStorages();

    // Atualização automática a cada 30 segundos
    const timer = setInterval(() => {
      fetchEquipmentsStatus();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'vault') {
      fetchEquipments();
      fetchStorages();
    }
    if (activeTab === 'storages') fetchStorages();
    if (activeTab === 'backups') {
      fetchBackups();
      fetchStorages();
    }
  }, [activeTab]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg;
    setInputMsg('');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setChatMessages(prev => [...prev, { sender: 'user', text: userText, time }]);
    setLoadingChat(true);

    try {
      const res = await axios.post('/api/chat', { message: userText, senderName: 'Operador Web' });
      const botReply = res.data?.reply || 'Comando processado com sucesso.';
      setChatMessages(prev => [...prev, { 
        sender: 'bot', 
        text: botReply, 
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        sender: 'bot', 
        text: '⚠️ Não foi possível conectar ao Core local. Verifique os logs do container.', 
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Identifica se há equipamentos caídos, links degradados ou com erro de autenticação
  const downEquipments = Array.isArray(equipmentList)
    ? equipmentList.filter(eq => eq.status === 'offline')
    : [];
  const degradedEquipments = Array.isArray(equipmentList)
    ? equipmentList.filter(eq => eq.status === 'degraded')
    : [];
  const authErrorEquipments = Array.isArray(equipmentList)
    ? equipmentList.filter(eq => eq.status === 'auth_error')
    : [];

  const renderEquipmentCard = (eq) => {
    const isOnline = eq.status === 'online';
    const isDegraded = eq.status === 'degraded';
    const isAuthError = eq.status === 'auth_error';
    const pveData = eq.proxmoxData || (eq.type === 'PROXMOX' && eq.osInfo?.workloads ? eq.osInfo : null);

    const borderClass = isOnline 
      ? 'border-emerald-500/30 hover:border-emerald-500/60 shadow-md shadow-emerald-950/20' 
      : isDegraded 
      ? 'border-amber-500/30 hover:border-amber-500/60 shadow-md shadow-amber-950/20' 
      : isAuthError 
      ? 'border-amber-600/40 hover:border-amber-600/70 shadow-md shadow-amber-950/30' 
      : 'border-slate-800 hover:border-slate-700';

    const dotClass = isOnline 
      ? 'bg-emerald-400 animate-pulse' 
      : isDegraded 
      ? 'bg-amber-400' 
      : isAuthError 
      ? 'bg-amber-400 animate-pulse' 
      : 'bg-red-400';

    const statusBadgeClass = isOnline 
      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80' 
      : isDegraded 
      ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' 
      : isAuthError 
      ? 'bg-amber-900/60 text-amber-200 border-amber-700' 
      : 'bg-red-950/70 text-red-300 border-red-800/80';

    const statusText = isOnline 
      ? 'ONLINE' 
      : isDegraded 
      ? 'DEGRADADO' 
      : isAuthError 
      ? 'AUTH 401' 
      : 'OFFLINE';

    return (
      <div 
        key={eq.id} 
        draggable={!isLayoutLocked}
        onDragStart={(e) => handleDragStart(e, eq.id)}
        onDragOver={(e) => handleDragOver(e, eq.id)}
        onDrop={(e) => handleDrop(e, eq.id)}
        onDragEnd={handleDragEnd}
        className={`p-3.5 rounded-xl border bg-slate-900/80 hover:bg-slate-900 transition-all duration-200 flex flex-col justify-between ${borderClass} ${
          draggedCardId === eq.id ? 'opacity-30 scale-95 border-dashed border-sky-400' : ''
        } ${
          dragOverCardId === eq.id && draggedCardId !== eq.id
            ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950 scale-[1.02] border-sky-500 shadow-xl shadow-sky-950/60'
            : ''
        } ${!isLayoutLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* CABEÇALHO COMPACTO: Nome, Tipo, Host e Status */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {!isLayoutLocked && (
                  <GripVertical className="w-3.5 h-3.5 text-slate-500 hover:text-sky-300 flex-shrink-0 cursor-grab active:cursor-grabbing" title="Arraste para reorganizar o card" />
                )}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                <h3 className="font-bold text-sm text-white truncate" title={eq.name}>
                  {eq.name}
                </h3>
                {eq.connectionMode === 'AGENT' && (
                  <span className="text-[10px] text-sky-400 font-mono flex items-center gap-0.5" title="Conexão via Agente Outbound">
                    <Terminal className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                <span className="text-sky-400 font-semibold">{eq.type}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 truncate max-w-[160px]" title={eq.host || 'Agente'}>
                  {eq.host || (eq.connectionMode === 'AGENT' ? 'Agente Outbound' : '—')}
                </span>
              </div>
              {/* BADGES HIERÁRQUICAS: GRUPO & SUBGRUPO */}
              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                <span className="px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/70 text-[9px] font-semibold flex items-center gap-1" title="Grupo / Tenant">
                  <Building2 className="w-2.5 h-2.5" />
                  {eq.group || 'Geral'}
                </span>
                {eq.subgroup && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 text-[9px] font-medium flex items-center gap-1" title="Subgrupo / Unidade">
                    <Store className="w-2.5 h-2.5 text-amber-400/80" />
                    {eq.subgroup}
                  </span>
                )}
                {eq.tags && Array.isArray(eq.tags) && eq.tags.length > 0 && (
                  eq.tags.slice(0, 2).map((tg, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[9px] font-mono">
                      #{tg}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleCloneEquipment(eq)}
                title="Clonar Equipamento (Cadastro Rápido)"
                className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-sky-300 border border-slate-700/60 transition"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleOpenEditModal(eq)}
                title="Editar Credenciais no Cofre"
                className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${statusBadgeClass}`}>
                {statusText}
              </span>
            </div>
          </div>

          {/* ALERTA DE ERRO COMPACTO */}
          {eq.error && (
            <div className="mb-2.5 p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">{eq.error}</span>
              </div>
              {isAuthError && (
                <button
                  onClick={() => handleOpenEditModal(eq)}
                  className="px-2 py-0.5 bg-amber-900/80 hover:bg-amber-800 border border-amber-700 rounded text-[10px] font-semibold text-amber-200 transition whitespace-nowrap flex items-center gap-1"
                >
                  <Key className="w-2.5 h-2.5" />
                  Ajustar
                </button>
              )}
            </div>
          )}

          {/* CORPO DO CARD CONFORME TIPO */}
          {eq.type === 'PROXMOX' ? (
            <div className="space-y-2 text-xs">
              {pveData ? (
                <>
                  {/* CPU e RAM em barras compactas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Cpu className="w-3 h-3 text-sky-400" />
                          CPU
                        </span>
                        <span className="font-mono text-sky-400 font-bold">{pveData.cpu?.percent ?? 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-sky-500 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(pveData.cpu?.percent ?? 0, 100)}%` }} 
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-1 truncate">
                        {pveData.cpu?.cores ? `${pveData.cpu.cores} vCPUs` : `Nó: ${pveData.node || 'pve'}`}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Layers className="w-3 h-3 text-amber-400" />
                          RAM
                        </span>
                        <span className="font-mono text-amber-400 font-bold">{pveData.memory?.percent ?? 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(pveData.memory?.percent ?? 0, 100)}%` }} 
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-1 truncate">
                        {pveData.memory?.usedGB != null ? `${pveData.memory.usedGB}/${pveData.memory.totalGB}GB` : 'RAM'}
                      </span>
                    </div>
                  </div>

                  {/* Resumo de VMs e Informações do Nó */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {pveData.workloads && (
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                        🖥️ <strong className="text-emerald-400">{pveData.workloads.runningVMs ?? 0}</strong>/{pveData.workloads.totalVMs ?? 0} VMs
                      </span>
                    )}
                    {pveData.workloads?.runningLXCs > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                        📦 <strong className="text-sky-400">{pveData.workloads.runningLXCs}</strong> CTs
                      </span>
                    )}
                    {pveData.node && (
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                        🏷️ Nó: <strong className="text-slate-200">{pveData.node}</strong>
                      </span>
                    )}
                  </div>

                  {/* Storages / Discos do Proxmox */}
                  {pveData.storages && pveData.storages.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                        <span className="flex items-center gap-1 text-slate-300">
                          <HardDrive className="w-3 h-3 text-purple-400" />
                          Armazenamento ({pveData.storages.length} {pveData.storages.length === 1 ? 'Pool' : 'Pools'})
                        </span>
                      </div>

                      <div className="space-y-1 max-h-[160px] overflow-y-auto pr-0.5">
                        {pveData.storages.map((st, idx) => {
                          const isHigh = st.usedPercent >= 85;
                          const isMed = st.usedPercent >= 70 && st.usedPercent < 85;
                          const barColor = isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-purple-500';
                          const textColor = isHigh ? 'text-rose-400' : isMed ? 'text-amber-400' : 'text-purple-300';
                          const hasBytes = st.totalBytes > 0;

                          return (
                            <div 
                              key={idx} 
                              className="px-2 py-1 rounded-md bg-slate-950/50 border border-slate-800/60 flex items-center justify-between gap-2 text-[10.5px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isHigh ? 'bg-rose-400' : 'bg-purple-400'}`} />
                                <span className="font-mono font-medium text-slate-200 truncate" title={st.name}>
                                  {st.name}
                                </span>
                                {st.type && (
                                  <span className="text-[9px] text-slate-500 uppercase font-mono hidden xs:inline">
                                    {st.type}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {hasBytes && (
                                  <span className="text-[9.5px] font-mono text-slate-400">
                                    {formatBytes(st.usedBytes)} / {formatBytes(st.totalBytes)}
                                  </span>
                                )}
                                <div className="w-12 bg-slate-800 h-1 rounded-full overflow-hidden hidden sm:block">
                                  <div 
                                    className={`h-full rounded-full transition-all ${barColor}`} 
                                    style={{ width: `${Math.min(st.usedPercent ?? 0, 100)}%` }} 
                                  />
                                </div>
                                <span className={`font-mono text-[10px] font-bold ${textColor}`}>
                                  {st.usedPercent ?? 0}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500 text-[11px] italic">Cluster Proxmox VE ativo (Sem métricas detalhadas).</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/70">
                <span className="text-slate-400 text-[11px]">Latência (RTT):</span>
                <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                  {eq.lastLatency != null ? `${eq.lastLatency} ms` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/70">
                <span className="text-slate-400 text-[11px]">Perda de Pacotes:</span>
                <span className={`font-mono font-semibold text-[11px] ${eq.lastLossPercent > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {eq.lastLossPercent != null ? `${eq.lastLossPercent}%` : '0%'}
                </span>
              </div>
            </div>
          )}

          {/* TELEMETRIA DO AGENTE HOST */}
          {eq.osInfo && eq.type !== 'PROXMOX' && eq.type !== 'MIKROTIK' && (
            <div className="mt-2 pt-2 border-t border-slate-800/60 grid grid-cols-3 gap-1.5 text-center text-[9px] font-mono">
              {eq.osInfo.cpu != null && (
                <div className="bg-slate-950/50 p-1 rounded border border-slate-800/50">
                  <span className="text-slate-500 block">CPU</span>
                  <span className="text-sky-400 font-bold">
                    {typeof eq.osInfo.cpu === 'object' ? `${eq.osInfo.cpu.percent ?? 0}%` : String(eq.osInfo.cpu)}
                  </span>
                </div>
              )}
              {eq.osInfo.memoryPercent != null && (
                <div className="bg-slate-950/50 p-1 rounded border border-slate-800/50">
                  <span className="text-slate-500 block">RAM</span>
                  <span className="text-amber-400 font-bold">
                    {typeof eq.osInfo.memoryPercent === 'object' ? `${eq.osInfo.memoryPercent.percent ?? 0}%` : String(eq.osInfo.memoryPercent)}
                  </span>
                </div>
              )}
              {(eq.osInfo.diskFreeGb != null || eq.osInfo.diskFreePct != null) && (
                <div className="bg-slate-950/50 p-1 rounded border border-slate-800/50">
                  <span className="text-slate-500 block">Disco</span>
                  <span className="text-emerald-400 font-bold">
                    {typeof eq.osInfo.diskFreeGb === 'object' ? '' : String(eq.osInfo.diskFreeGb || eq.osInfo.diskFreePct)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* LINKS DE INTERNET / WAN MONITORADAS (MIKROTIK) */}
          {eq.type === 'MIKROTIK' && (
            <div className="mt-2 pt-1.5 border-t border-slate-800/60 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-0.5 mb-1">
                <span className="flex items-center gap-1 text-sky-400 font-medium">
                  <Radio className="w-3 h-3 text-sky-400" />
                  Links WAN / Failover
                </span>
                {eq.mikrotikData?.activeWanName && (
                  <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-600/50 truncate max-w-[170px]" title={`Link Ativo: ${eq.mikrotikData.activeWanName}`}>
                    ● Ativo: {eq.mikrotikData.activeWanName}
                  </span>
                )}
              </div>

              {eq.subItems && eq.subItems.length > 0 ? (
                eq.subItems.map((wan, idx) => {
                  const isActive = wan.isActive || wan.isDefaultRoute || wan.status === 'ACTIVE';
                  const isStandby = wan.running && !isActive;

                  return (
                    <div 
                      key={idx} 
                      className={`px-2 py-1 rounded-md border text-[11px] flex items-center justify-between gap-1.5 transition-colors ${
                        isActive 
                          ? 'bg-emerald-950/35 border-emerald-600/50 border-l-2 border-l-emerald-400 text-slate-100 shadow-[0_0_10px_rgba(16,185,129,0.08)]'
                          : isStandby
                          ? 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:border-slate-700/80'
                          : 'bg-rose-950/15 border-rose-900/30 text-slate-400 opacity-70'
                      }`}
                    >
                      {/* Lado Esquerdo: Ponto de status + Interface + Comentário sutil */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : isStandby ? 'bg-amber-400' : 'bg-rose-500'
                        }`} />
                        
                        <span className={`font-mono text-[10.5px] font-semibold flex-shrink-0 ${isActive ? 'text-emerald-300' : 'text-slate-200'}`}>
                          {wan.name}
                        </span>

                        {wan.comment && (
                          <span 
                            className="text-[9.5px] text-slate-400 truncate max-w-[120px] font-normal"
                            title={wan.comment}
                          >
                            • {wan.comment}
                          </span>
                        )}
                      </div>

                      {/* Lado Direito: Tráfego compacto (RX/TX) + Badge simplificado */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 font-mono text-[9px]">
                        {(wan.formattedRx || wan.formattedTx || wan.rxBytes != null) && (
                          <span 
                            className="text-slate-400 tracking-tight flex items-center gap-0.5" 
                            title={`Download: ${wan.formattedRx || formatBytes(wan.rxBytes)} | Upload: ${wan.formattedTx || formatBytes(wan.txBytes)}`}
                          >
                            <span className="text-sky-400 font-bold">↓</span>{(wan.formattedRx || formatBytes(wan.rxBytes)).replace(' ', '')}
                            <span className="text-emerald-400 font-bold ml-0.5">↑</span>{(wan.formattedTx || formatBytes(wan.txBytes)).replace(' ', '')}
                          </span>
                        )}

                        <span className={`px-1 py-0.2 rounded text-[8.5px] font-bold tracking-wider uppercase border flex-shrink-0 ${
                          isActive
                            ? 'bg-emerald-900/60 text-emerald-300 border-emerald-500/60 shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                            : isStandby
                            ? 'bg-amber-950/30 text-amber-300/80 border-amber-700/40'
                            : 'bg-rose-950/30 text-rose-300/70 border-rose-800/30'
                        }`}>
                          {isActive ? 'ATIVA' : isStandby ? 'BKP' : 'DOWN'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-1.5 bg-slate-950/40 rounded border border-slate-800/50 text-[10px] text-slate-400">
                  <p className="flex items-center gap-1.5 text-slate-300">
                    <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span>
                      Habilite a API no RouterOS (<strong>IP → Services → api</strong> na porta {eq.port || '8728'}) para telemetria dos links em tempo real.
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* GATEWAYS MONITORADOS (PFSENSE / OUTROS) */}
          {eq.type !== 'MIKROTIK' && eq.subItems && eq.subItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1">
              {eq.subItems.slice(0, 3).map((sub, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] bg-slate-950/40 px-2 py-1 rounded border border-slate-800/50">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sub.status === 'online' ? 'bg-emerald-400' : 'bg-red-500'}`} />
                    <span className="font-medium text-white truncate">{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px] flex-shrink-0">
                    <span className={sub.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>{(sub.status || 'OFF').toUpperCase()}</span>
                    <span className="text-slate-400">{sub.delay ?? 0}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTÃO DO AGENTE OUTBOUND */}
        {eq.connectionMode === 'AGENT' && (
          <div className="mt-2 pt-2 flex items-center justify-between border-t border-slate-800/80 text-[10px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Terminal className="w-2.5 h-2.5 text-sky-400" />
              Agente Host
            </span>
            <button
              onClick={() => handleOpenAgentModal(eq)}
              className="px-2 py-0.5 bg-sky-950 hover:bg-sky-900 border border-sky-800 rounded text-sky-300 font-semibold flex items-center gap-1 transition"
            >
              <Terminal className="w-2.5 h-2.5" />
              Script 1-Clique
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* HEADER SUPERIOR */}
      <header className="border-b border-slate-800 bg-[#0d1322]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">NOC-Agent</h1>
                <span className="bg-emerald-950/80 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-800/80 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  SISTEMA ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400">nocagent.awecloudsolution.com • IA Operacional 24/7 (v1.3.0)</p>
            </div>
          </div>

          {/* STATUS DOS MÓDULOS & USUÁRIO CONECTADO */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300">Cofre AES-256</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">Storage</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Chatwoot WhatsApp</span>
            </div>

            {currentUser && (
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
                {/* STATUS INDICATOR DO KILL-SWITCH DE EMERGÊNCIA */}
                {flagsData.killSwitch?.active ? (
                  <button
                    onClick={() => setActiveTab('observability')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/90 border border-red-500 text-red-300 text-xs font-bold animate-pulse hover:bg-red-900 transition shadow-lg shadow-red-950/50 mr-1"
                    title="Emergency Kill-Switch ATIVADO! Clique para abrir Governança"
                  >
                    <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                    <span>KILL-SWITCH ATIVO</span>
                  </button>
                ) : (
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-medium mr-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>IA: Operação Normal</span>
                  </div>
                )}

                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-medium text-xs">{currentUser.name}</span>
                    <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded uppercase tracking-wider ${
                      currentUser.role === 'SUPERADMIN' 
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                        : currentUser.role === 'TENANT_MASTER'
                        ? 'bg-sky-950/80 text-sky-300 border border-sky-800/80'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                    }`}>
                      {currentUser.role === 'SUPERADMIN' ? 'Superadmin' : currentUser.role === 'TENANT_MASTER' ? 'Tenant Master' : 'Operador'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    {currentUser.tenant?.name ? (
                      <span className="text-sky-400 font-medium">{currentUser.tenant.name}</span>
                    ) : (
                      <span>{currentUser.email}</span>
                    )}
                    {currentUser.totpEnabled ? (
                      <span className="text-emerald-400 flex items-center gap-0.5 ml-1 font-semibold" title="2FA TOTP Ativo">
                        • <ShieldCheck className="w-3 h-3 text-emerald-400" /> 2FA
                      </span>
                    ) : (
                      <button 
                        onClick={handleStartSetup2fa}
                        disabled={setup2faLoading}
                        className="text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-0.5 ml-1"
                        title="Configurar aplicativo autenticador 2FA"
                      >
                        • Ativar 2FA
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Encerrar Sessão"
                  className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-red-950/60 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* NAVEGAÇÃO POR TABS */}
        <div className="w-full border-t border-slate-800/60 bg-slate-950/40">
          <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto text-xs lg:text-sm py-1.5 scrollbar-none">
            {[
              { id: 'overview', label: 'Visão Geral', fullLabel: 'Visão Geral (NOC)', icon: Activity },
              { id: 'chat', label: 'Terminal IA', fullLabel: 'Terminal IA (Chat)', icon: MessageSquare },
              { id: 'vault', label: 'Equipamentos', fullLabel: 'Cofre de Equipamentos', icon: Lock },
              { id: 'storages', label: 'Storages', fullLabel: 'Cofre de Storages', icon: Database },
              { id: 'backups', label: 'Backups', fullLabel: 'Auditoria de Backups', icon: HardDrive },
              ...(currentUser?.role === 'SUPERADMIN' ? [{ id: 'tenants', label: 'Tenants', fullLabel: 'Gestão de Tenants', icon: Building2 }] : []),
              ...(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'TENANT_MASTER' ? [{ id: 'users', label: 'Usuários', fullLabel: 'Gestão de Usuários', icon: Users }] : []),
              ...(currentUser?.role === 'SUPERADMIN' ? [{ id: 'observability', label: 'Governança & APM', fullLabel: 'Governança & APM (Disjuntor / Traces)', icon: Gauge }] : []),
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.fullLabel}
                  className={`py-2 px-3 lg:px-3.5 font-medium flex items-center gap-2 rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    active 
                      ? 'text-sky-400 bg-sky-500/15 shadow-sm shadow-sky-500/10 font-semibold' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {(!authToken || !currentUser) ? (
          <div className="min-h-[65vh] flex items-center justify-center py-12 px-4">
            <div className="w-full max-w-md bg-[#0d1322] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent"></div>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-sky-500/20">
                  <ShieldCheck className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">NOC-Agent Security</h2>
                <p className="text-xs text-slate-400 mt-1">Acesso Restrito • Monitoramento e Automação 24/7</p>
              </div>

              {loginError && (
                <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>{loginError}</div>
                </div>
              )}

              {loginStep === 'CREDENTIALS' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">E-mail ou Usuário Corporativo</label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="admin@nocagent.local ou superadmin"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">Senha</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 font-bold text-white text-sm shadow-lg shadow-sky-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loginLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Validando credenciais...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Acessar Console
                      </>
                    )}
                  </button>

                  <div className="pt-4 border-t border-slate-800/80 text-center">
                    <span className="text-[11px] text-slate-500">
                      Autenticação com criptografia Scrypt + 2FA TOTP.
                    </span>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerify2faSubmit} className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-800/60 flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sky-200 text-xs">Verificação em Duas Etapas</h4>
                      <p className="text-[11px] text-sky-400/80 mt-0.5">
                        Abra o Google Authenticator ou Authy e digite o código de 6 dígitos gerado.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold text-center mb-2">Código 2FA (6 Dígitos)</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="000000"
                      value={login2faCode}
                      onChange={(e) => setLogin2faCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950 border border-sky-500/60 rounded-2xl px-4 py-3 text-center text-3xl font-mono tracking-[0.4em] text-sky-300 placeholder:text-slate-700 focus:outline-none focus:border-sky-400 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading || login2faCode.length < 6}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 font-bold text-white text-sm shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loginLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Validando token 2FA...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirmar e Acessar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('CREDENTIALS');
                      setLogin2faCode('');
                      setLoginError(null);
                    }}
                    className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs transition"
                  >
                    ← Voltar para login com senha
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* BANNER DINÂMICO DE INCIDENTES REAIS (QUEDA FÍSICA / PACOTES) */}
        {downEquipments.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-900/80 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-900/50 text-red-400 border border-red-700/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-red-200 text-sm">
                  🚨 INCIDENTE REAL ATIVO: {downEquipments.map(e => e.name).join(', ')}
                </h3>
                <p className="text-xs text-red-300/80 mt-0.5">
                  {downEquipments.map(e => `Equipamento ${e.name} (${e.host || e.type}) status: ${e.status || 'indisponível'}${e.lastLossPercent != null ? ` com ${e.lastLossPercent}% de perda` : ''}.`).join(' • ')}
                </p>
              </div>
            </div>
            <button 
              onClick={fetchEquipmentsStatus}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 border border-red-700/60 text-xs font-medium text-red-200 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Revalidar
            </button>
          </div>
        )}
 
        {/* BANNER DE ALERTA DE LINK REDUNDANTE DEGRADADO */}
        {degradedEquipments.length > 0 && downEquipments.length === 0 && (
          isAlertSnoozed ? (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <BellOff className="w-4 h-4 text-amber-400/80 flex-shrink-0" />
                <span>
                  Alerta de redundância/contingência silenciado por mais <strong className="text-amber-300 font-mono font-semibold">{snoozeRemainingMinutes} min</strong> ({degradedEquipments.map(e => e.name).join(', ')}).
                </span>
              </div>
              <button
                onClick={handleClearSnooze}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline transition ml-3 whitespace-nowrap"
              >
                Reexibir Alerta
              </button>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-900/80 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-900/50 text-amber-400 border border-amber-700/50">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-200 text-sm">
                    ⚠️ ALERTA DE REDUNDÂNCIA DE LINK: {degradedEquipments.map(e => e.name).join(', ')}
                  </h3>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    {degradedEquipments.map(e => `Equipamento ${e.name} está online, mas possui 1 ou mais links com perda de pacotes ou inativos (${e.lastLossPercent != null ? `${e.lastLossPercent}% de perda média` : 'link inativo'}).`).join(' • ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative">
                <button 
                  onClick={fetchEquipmentsStatus}
                  disabled={refreshing}
                  className="px-3 py-1.5 rounded-lg bg-amber-900/40 hover:bg-amber-900/70 border border-amber-700/60 text-xs font-medium text-amber-200 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Revalidar
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsSnoozeMenuOpen(!isSnoozeMenuOpen)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition"
                    title="Silenciar notificação deste incidente temporariamente"
                  >
                    <BellOff className="w-3.5 h-3.5 text-slate-400" />
                    Ocultar Alerta
                  </button>
                  {isSnoozeMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl py-1 z-30 text-xs">
                      <span className="block px-3 py-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Ocultar por:</span>
                      <button onClick={() => handleSnoozeAlert(15)} className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition">15 minutos</button>
                      <button onClick={() => handleSnoozeAlert(30)} className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition">30 minutos</button>
                      <button onClick={() => handleSnoozeAlert(60)} className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition">1 hora</button>
                      <button onClick={() => handleSnoozeAlert(240)} className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition">4 horas</button>
                      <button onClick={() => handleSnoozeAlert(1440)} className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition">24 horas</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* BANNER DE ALERTA DE AUTENTICAÇÃO NA API (EQUIPAMENTO ONLINE MAS CHAVE RECUSADA) */}
        {authErrorEquipments.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-900/80 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-900/50 text-amber-400 border border-amber-700/50">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-200 text-sm">
                  🔐 ALERTA DE CREDENCIAL: {authErrorEquipments.map(e => e.name).join(', ')}
                </h3>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  {authErrorEquipments.map(e => `${e.name} está online na porta informada, mas a chave de API foi recusada (HTTP 401). Verifique a credencial cadastrada no Cofre.`).join(' • ')}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                const eq = equipmentList.find(e => e.status === 'auth_error') || equipments[0];
                if (eq) handleOpenEditModal(eq);
                else setActiveTab('vault');
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-900/40 hover:bg-amber-900/70 border border-amber-700/60 text-xs font-medium text-amber-200 flex items-center gap-1.5 transition"
            >
              <Key className="w-3.5 h-3.5" />
              Editar Chave no Cofre
            </button>
          </div>
        )}

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-400" />
                  Status dos Equipamentos
                </h2>
                <p className="text-xs text-slate-400">Visão operacional em tempo real dos ativos de rede gerenciados no Cofre.</p>
              </div>

              {/* FILTROS MULTI-TENANT (GRUPO / SUBGRUPO / TIPO) E ATUALIZAÇÃO */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* FILTRO DE CLIENTE / GRUPO */}
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-sm">
                  <Building2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <select
                    value={overviewGroupFilter}
                    onChange={(e) => {
                      setOverviewGroupFilter(e.target.value);
                      setOverviewSubgroupFilter('ALL');
                    }}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1 font-medium"
                  >
                    <option value="ALL" className="bg-slate-900 text-slate-200">Todos os Clientes / Grupos</option>
                    {distinctGroups.map((g) => (
                      <option key={g} value={g} className="bg-slate-900 text-slate-200">{g}</option>
                    ))}
                  </select>
                </div>

                {/* FILTRO DE SUBGRUPO / UNIDADE (SE HOUVER SUBGRUPOS) */}
                {distinctSubgroups.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-sm">
                    <Store className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <select
                      value={overviewSubgroupFilter}
                      onChange={(e) => setOverviewSubgroupFilter(e.target.value)}
                      className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1 font-medium"
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">Todas as Unidades / Lojas</option>
                      {distinctSubgroups.map((sg) => (
                        <option key={sg} value={sg} className="bg-slate-900 text-slate-200">{sg}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* FILTRO DE TIPO DE ATIVO */}
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <select
                    value={overviewTypeFilter}
                    onChange={(e) => setOverviewTypeFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1 font-medium"
                  >
                    <option value="ALL" className="bg-slate-900 text-slate-200">Todos os Tipos ({equipmentList.length})</option>
                    <option value="PFSENSE" className="bg-slate-900 text-slate-200">pfSense Firewall (REST API)</option>
                    <option value="MIKROTIK" className="bg-slate-900 text-slate-200">Mikrotik RouterOS (API)</option>
                    <option value="PROXMOX" className="bg-slate-900 text-slate-200">Proxmox VE Cluster</option>
                    <option value="LINUX_SERVER" className="bg-slate-900 text-slate-200">Servidor Linux (SSH / Agente)</option>
                    <option value="WINDOWS_SERVER" className="bg-slate-900 text-slate-200">Servidor Windows (WinRM / Agente)</option>
                    <option value="ZABBIX" className="bg-slate-900 text-slate-200">Zabbix Server</option>
                    <option value="GENERIC_SNMP" className="bg-slate-900 text-slate-200">SNMP Genérico</option>
                  </select>
                </div>

                {/* TOGGLE AGRUPAR POR UNIDADE */}
                <button
                  onClick={() => setGroupByUnit(!groupByUnit)}
                  title={groupByUnit ? "Alternar para grade contínua" : "Agrupar cards por Unidade / Loja"}
                  className={`text-xs flex items-center gap-1.5 transition px-2.5 py-1 border rounded-xl shadow-sm ${
                    groupByUnit
                      ? 'bg-sky-950/90 border-sky-500 text-sky-300 font-semibold'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {groupByUnit ? 'Por Unidade' : 'Grade'}
                </button>

                {/* CONTROLES DE ARRASTE (DRAG & DROP) */}
                <button
                  onClick={() => setIsLayoutLocked(!isLayoutLocked)}
                  title={isLayoutLocked ? "Destravar para reorganizar os cards por arraste" : "Travar layout contra arrastes acidentais"}
                  className={`text-xs flex items-center gap-1.5 transition px-2.5 py-1 border rounded-xl shadow-sm ${
                    isLayoutLocked
                      ? 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300 font-semibold shadow-emerald-950/30'
                  }`}
                >
                  {isLayoutLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Travado
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      Arraste Livre
                    </>
                  )}
                </button>

                {customCardOrder.length > 0 && (
                  <button
                    onClick={handleResetCardOrder}
                    title="Restaurar ordenação padrão do sistema"
                    className="text-xs flex items-center gap-1 transition px-2.5 py-1 border border-slate-800 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-300 shadow-sm"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    Resetar Ordem
                  </button>
                )}

                <button 
                  onClick={fetchEquipmentsStatus}
                  disabled={refreshing}
                  className="text-xs text-slate-300 hover:text-sky-400 flex items-center gap-1.5 transition px-3 py-1.5 border border-slate-800 rounded-xl bg-slate-900/90 hover:bg-slate-800 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {loadingStatus ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Consultando status dos equipamentos via Cofre...</p>
              </div>
            ) : noEquipment ? (
              <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
                <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">Nenhum equipamento cadastrado no cofre.</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                  Cadastre seus equipamentos (Mikrotik, pfSense, Proxmox, Zabbix) no Cofre de Equipamentos para habilitar o monitoramento e ações autônomas do NOC-Agent.
                </p>
                <button
                  onClick={() => {
                    setActiveTab('vault');
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-950/30 transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Equipamento no Cofre
                </button>
              </div>
            ) : statusError ? (
              <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/70 text-amber-200 text-xs flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{statusError}</p>
                    <p className="text-amber-300/80 mt-0.5">O container ou a conexão com o banco pode estar sincronizando.</p>
                  </div>
                </div>
                <button
                  onClick={fetchEquipmentsStatus}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Tentar Novamente
                </button>
              </div>
            ) : equipmentList.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum equipamento retornado pelo cofre.
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                <p>Nenhum equipamento encontrado com os filtros atuais (Grupo: <strong>{overviewGroupFilter}</strong>, Subgrupo: <strong>{overviewSubgroupFilter}</strong>, Tipo: <strong>{overviewTypeFilter}</strong>).</p>
                <button
                  onClick={() => {
                    setOverviewTypeFilter('ALL');
                    setOverviewGroupFilter('ALL');
                    setOverviewSubgroupFilter('ALL');
                  }}
                  className="mt-3 px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/40 rounded-lg text-xs font-semibold transition"
                >
                  Limpar Todos os Filtros
                </button>
              </div>
            ) : groupByUnit ? (
              /* MODO AGRUPADO POR UNIDADE / CLIENTE */
              <div className="space-y-6">
                {Object.entries(
                  orderedEquipments.reduce((acc, eq) => {
                    const groupKey = eq.subgroup 
                      ? `${eq.group || 'Geral'} • ${eq.subgroup}` 
                      : (eq.group || 'Geral');
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(eq);
                    return acc;
                  }, {})
                ).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="space-y-3 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/70">
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-400" />
                        <h3 className="text-sm font-semibold text-white tracking-wide">{groupTitle}</h3>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
                        {items.length} {items.length === 1 ? 'ativo' : 'ativos'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                      {items.map(eq => renderEquipmentCard(eq))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* MODO GRID PADRÃO */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                {orderedEquipments.map(eq => renderEquipmentCard(eq))}
              </div>
            )}

            {/* SEÇÃO DE AÇÕES */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Ações Rápidas no NOC</h3>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => { setActiveTab('chat'); setInputMsg('como estão os gateways do pfsense?'); }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/30 transition"
                >
                  📡 Testar Conectividade via Chat
                </button>
                <button 
                  onClick={() => { setActiveTab('chat'); setInputMsg('auditar backups recentes dos equipamentos'); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  💾 Consultar Backups via Chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TERMINAL IA (CHAT) */}
        {activeTab === 'chat' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col h-[650px] shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Console Operacional do NOC-Agent</h3>
                  <p className="text-xs text-slate-400">Interaja com os roteadores e backups em linguagem natural</p>
                </div>
              </div>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                Hermes Engine Ativo
              </span>
            </div>

            {/* MENSAGENS */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-tr-none shadow-md shadow-sky-600/20'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none whitespace-pre-wrap'
                  }`}>
                    {msg.text}
                    <span className="block text-[10px] text-slate-300/70 mt-1.5 text-right font-mono">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
              {loadingChat && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]"></span>
                    Consultando ferramentas de rede...
                  </div>
                </div>
              )}
            </div>

            {/* FORMULÁRIO DE ENVIO */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/40 rounded-b-2xl flex gap-2">
              <input 
                type="text" 
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                placeholder="Ex: 'como estão os gateways do pfsense?' ou 'auditar backups de hoje'"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
              <button 
                type="submit"
                disabled={loadingChat || !inputMsg.trim()}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-sm flex items-center gap-2 transition"
              >
                <span>Enviar</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: COFRE DE EQUIPAMENTOS (DADOS REAIS DO BANCO) */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Cofre Criptográfico de Equipamentos
                </h2>
                <p className="text-xs text-slate-400">Tokens e chaves protegidos com AES-256-GCM no PostgreSQL. Nenhuma credencial trafega desprotegida.</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setSaveError(null);
                    setIsModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-950/20 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Equipamento
                </button>
                <button 
                  onClick={fetchEquipments}
                  disabled={loadingEquipments}
                  className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition px-2.5 py-1.5 border border-slate-800 rounded-xl bg-slate-900/60"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingEquipments ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {loadingEquipments ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Carregando ativos do cofre...
              </div>
            ) : equipments.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <Lock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum equipamento cadastrado no cofre ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Cadastre seu firewall pfSense, roteador Mikrotik ou nó Proxmox. As credenciais serão armazenadas com criptografia AES-256-GCM no PostgreSQL.
                </p>
                <button
                  onClick={() => {
                    setSaveError(null);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Equipamento
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Equipamento</th>
                      <th className="px-5 py-3.5">Driver / Tipo</th>
                      <th className="px-5 py-3.5">Host / Endpoint</th>
                      <th className="px-5 py-3.5">Cofre de Credenciais</th>
                      <th className="px-5 py-3.5">Storage de Backup</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {equipments.map(eq => (
                      <tr key={eq.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-5 py-4 font-semibold text-white">
                          <div>{eq.name}</div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-400 border border-sky-800/60 text-[10px] font-medium flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              {eq.group || 'Geral'}
                            </span>
                            {eq.subgroup && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 text-[10px] font-medium flex items-center gap-1">
                                <Store className="w-2.5 h-2.5 text-amber-400" />
                                {eq.subgroup}
                              </span>
                            )}
                          </div>
                          {eq.connectionMode === 'AGENT' && (
                            <span className="text-[10px] text-sky-400 font-mono flex items-center gap-1 mt-1">
                              <Terminal className="w-2.5 h-2.5" />
                              Agente Outbound
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-sky-400">{eq.type}</td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-300">
                          {eq.host || (eq.connectionMode === 'AGENT' ? 'Conexão via Agente' : '—')}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-[11px] inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            AES-256-GCM
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {eq.backupStorage ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <Database className="w-3 h-3" />
                              {eq.backupStorage.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                            {eq.status || 'Ativo'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {eq.connectionMode === 'AGENT' && (
                              <button
                                onClick={() => handleOpenAgentModal(eq)}
                                title="Script 1-Clique do Agente"
                                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-950/40 rounded-lg transition"
                              >
                                <Terminal className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleCloneEquipment(eq)}
                              title="Clonar Equipamento (Cadastro Rápido)"
                              className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-sky-950/40 rounded-lg transition"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(eq)}
                              title="Editar Equipamento no Cofre"
                              className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-950/40 rounded-lg transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEquipment(eq.id, eq.name)}
                              title="Remover do Cofre"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: COFRE DE STORAGES (MINIO, AWS S3, WASABI, SFTP, NFS) */}
        {activeTab === 'storages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-400" />
                  Cofre de Storages & Destinos de Backup
                </h2>
                <p className="text-xs text-slate-400">
                  Repositórios de armazenamento MinIO, AWS S3, Wasabi, SFTP e NFS onde os backups dos equipamentos são gravados e auditados.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setStorageError(null);
                    setStorageForm({
                      id: '',
                      name: '',
                      type: 'S3_COMPATIBLE',
                      endpoint: '',
                      bucketOrPath: '',
                      region: 'us-east-1',
                      isDefault: false,
                      accessKey: '',
                      secretKey: '',
                      username: '',
                      password: '',
                    });
                    setIsStorageModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-950/20 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Storage
                </button>
                <button
                  onClick={fetchStorages}
                  disabled={loadingStorages}
                  className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition px-2.5 py-1.5 border border-slate-800 rounded-xl bg-slate-900/60"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingStorages ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {loadingStorages ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Carregando repositórios de storage do cofre...
              </div>
            ) : storages.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum repositório de storage cadastrado ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Cadastre seu bucket MinIO, AWS S3, Wasabi ou servidor SFTP/NFS para vincular aos equipamentos e receber as rotinas automáticas de backup.
                </p>
                <button
                  onClick={() => {
                    setStorageError(null);
                    setIsStorageModalOpen(true);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Storage
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Nome do Storage</th>
                      <th className="px-5 py-3.5">Provedor / Tipo</th>
                      <th className="px-5 py-3.5">Endpoint / Host</th>
                      <th className="px-5 py-3.5">Bucket / Caminho</th>
                      <th className="px-5 py-3.5">Equipamentos Vinculados</th>
                      <th className="px-5 py-3.5">Cofre de Credenciais</th>
                      <th className="px-5 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {storages.map(st => (
                      <tr key={st.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-5 py-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{st.name}</span>
                            {st.isDefault && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950 text-sky-400 border border-sky-800 font-semibold">
                                Padrão
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-sky-400">{st.type}</td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-300">{st.endpoint}</td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-300">{st.bucketOrPath}</td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                            {st._count?.equipments || 0} equipamentos
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-[11px] inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            AES-256-GCM
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDeleteStorage(st.id, st.name)}
                              title="Excluir Storage"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL DE CADASTRO NO COFRE */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-950 text-sky-400 rounded-xl border border-sky-800">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Cadastrar no Cofre Criptográfico</h3>
                    <p className="text-xs text-slate-400">Credenciais cifradas com chave AES-256 antes da gravação.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {saveError && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <form onSubmit={handleCreateEquipment} className="space-y-3.5 text-xs">
                <EquipmentCredentialInputs
                  form={newEquipment}
                  setForm={setNewEquipment}
                  storages={storages}
                  isEdit={false}
                  existingGroups={distinctGroups}
                  existingSubgroups={distinctSubgroups}
                  allEquipments={equipmentList.length > 0 ? equipmentList : equipments}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEquipment}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-950/30 transition flex items-center gap-1.5"
                  >
                    {savingEquipment ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Criptografando...
                      </>
                    ) : newEquipment.connectionMode === 'AGENT' ? (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Salvar & Copiar Comando</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Salvar no Cofre</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE EDIÇÃO NO COFRE */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-950 text-sky-400 rounded-xl border border-sky-800">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Editar Equipamento no Cofre</h3>
                    <p className="text-xs text-slate-400">Altere parâmetros ou redefina a chave criptografada.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateEquipment} className="space-y-3.5 text-xs">
                <EquipmentCredentialInputs
                  form={editEquipment}
                  setForm={setEditEquipment}
                  storages={storages}
                  isEdit={true}
                  existingGroups={distinctGroups}
                  existingSubgroups={distinctSubgroups}
                  allEquipments={equipmentList.length > 0 ? equipmentList : equipments}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-950/30 transition flex items-center gap-1.5"
                  >
                    {savingEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Salvando Alterações...
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CADASTRO DE STORAGE */}
        {isStorageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-950 text-sky-400 rounded-xl border border-sky-800">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Cadastrar Repositório de Storage</h3>
                    <p className="text-xs text-slate-400">Destino seguro de backup com credenciais cifradas via AES-256-GCM.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsStorageModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {storageError && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{storageError}</span>
                </div>
              )}

              <form onSubmit={handleSaveStorage} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nome do Storage *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: MinIO Central, Wasabi S3 Primário, SFTP Backup"
                    value={storageForm.name}
                    onChange={e => setStorageForm({ ...storageForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Tipo de Storage *</label>
                    <select
                      value={storageForm.type}
                      onChange={e => setStorageForm({ ...storageForm, type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="S3_COMPATIBLE">S3 Compatível (MinIO / Wasabi)</option>
                      <option value="AWS_S3">AWS S3 Oficial</option>
                      <option value="SFTP">Servidor SFTP / SSH</option>
                      <option value="NFS">NFS Network Share</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Região (S3)</label>
                    <input
                      type="text"
                      placeholder="Ex: us-east-1 ou sa-east-1"
                      value={storageForm.region}
                      onChange={e => setStorageForm({ ...storageForm, region: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Endpoint (URL ou Host) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: https://s3.wasabisys.com ou https://minio.empresa.com:9000 ou 192.168.1.10"
                    value={storageForm.endpoint}
                    onChange={e => setStorageForm({ ...storageForm, endpoint: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bucket ou Pasta de Destino *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: nocagent-backups ou /srv/backups"
                    value={storageForm.bucketOrPath}
                    onChange={e => setStorageForm({ ...storageForm, bucketOrPath: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
                  />
                </div>

                {storageForm.type === 'SFTP' || storageForm.type === 'NFS' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Usuário</label>
                      <input
                        type="text"
                        placeholder="Ex: backupuser"
                        value={storageForm.username}
                        onChange={e => setStorageForm({ ...storageForm, username: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Senha</label>
                      <input
                        type="password"
                        placeholder="Senha do usuário"
                        value={storageForm.password}
                        onChange={e => setStorageForm({ ...storageForm, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Access Key *</label>
                      <input
                        type="text"
                        placeholder="Chave de acesso S3 / MinIO"
                        value={storageForm.accessKey}
                        onChange={e => setStorageForm({ ...storageForm, accessKey: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Secret Key *</label>
                      <input
                        type="password"
                        placeholder="Chave secreta"
                        value={storageForm.secretKey}
                        onChange={e => setStorageForm({ ...storageForm, secretKey: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="storageDefault"
                    checked={storageForm.isDefault}
                    onChange={e => setStorageForm({ ...storageForm, isDefault: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500 focus:ring-0"
                  />
                  <label htmlFor="storageDefault" className="text-slate-300 text-xs">
                    Definir este storage como repositório padrão para novos equipamentos
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsStorageModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingStorage}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-950/30 transition flex items-center gap-1.5"
                  >
                    {savingStorage ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Gravando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Salvar Storage no Cofre
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DO INSTALADOR 1-CLIQUE DO AGENTE DE HOST (LINUX / WINDOWS) */}
        {isAgentModalOpen && selectedAgentEq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Instalador 1-Clique do Agente de Host</h3>
                    <p className="text-xs text-slate-400">
                      Instalação autônoma outbound para {selectedAgentEq.name} ({selectedAgentEq.type})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAgentModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  Execute o comando abaixo como Administrador/Root no servidor de destino. O agente se registrará automaticamente via conexão de saída segura (Outbound) e enviará telemetria a cada 60 segundos.
                </p>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-mono flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      {selectedAgentEq.type === 'WINDOWS_SERVER' ? 'PowerShell (Executar como Administrador)' : 'Bash / Terminal Linux (Root ou Sudo)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cmd = selectedAgentEq.type === 'WINDOWS_SERVER'
                          ? `irm ${window.location.origin}/api/agent/install-script/${selectedAgentEq.id} | iex`
                          : `curl -fsSL ${window.location.origin}/api/agent/install-script/${selectedAgentEq.id} | sudo bash`;
                        navigator.clipboard.writeText(cmd);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 3000);
                      }}
                      className="px-2.5 py-1 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      {copySuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Comando</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs break-all select-all">
                    {selectedAgentEq.type === 'WINDOWS_SERVER'
                      ? `irm ${window.location.origin}/api/agent/install-script/${selectedAgentEq.id} | iex`
                      : `curl -fsSL ${window.location.origin}/api/agent/install-script/${selectedAgentEq.id} | sudo bash`}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                  <div className="font-semibold text-slate-300">Como funciona a segurança do Agente:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong className="text-slate-200">Zero Inbound:</strong> Não precisa abrir nenhuma porta no firewall do servidor nem ter IP público.</li>
                    <li><strong className="text-slate-200">Token de Auto-Registro Único:</strong> O token expira em 1 hora e é queimado após o primeiro contato.</li>
                    <li><strong className="text-slate-200">Telemetria Leve:</strong> Coleta periódica de CPU, memória, disco livre e tempo de atividade (uptime).</li>
                    <li><strong className="text-slate-200">Persistente:</strong> Configura serviço systemd (Linux) ou Tarefa Agendada oculta (Windows).</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDITORIA DE BACKUPS (DADOS REAIS) */}
        {activeTab === 'backups' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Auditoria e Histórico de Backups
                </h2>
                <p className="text-xs text-slate-400">Verificação contínua de rotinas diárias e retenção nos repositórios de storage configurados.</p>
              </div>
              <button 
                onClick={fetchBackups}
                disabled={loadingBackups}
                className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${loadingBackups ? 'animate-spin' : ''}`} />
                Atualizar Backups
              </button>
            </div>

            {loadingBackups ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Consultando registros de backups nos storages...
              </div>
            ) : backups.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum snapshot ou backup catalogado ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  As rotinas de backup dos equipamentos gerenciados (Mikrotik, pfSense, Proxmox) registrarão os metadados e status de auditoria neste painel.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Registros de Backups Auditados</h3>
                <div className="space-y-2 text-xs">
                  {backups.map(bk => (
                    <div key={bk.id} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="font-semibold text-white">{bk.backupFile}</span>
                          <span className="block text-slate-400 text-[11px]">
                            {bk.equipment?.name || 'Equipamento'} • Bucket: {bk.storageBucket}
                          </span>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-medium">{bk.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GESTÃO DE TENANTS (EXCLUSIVO SUPERADMIN) */}
        {activeTab === 'tenants' && currentUser?.role === 'SUPERADMIN' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  Gestão de Tenants (Organizações Multi-Tenant)
                </h2>
                <p className="text-xs text-slate-400">
                  Gerenciamento global de clientes, isolamento de dados, planos e cotas de infraestrutura.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTenants}
                  disabled={loadingTenants}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTenants ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button
                  onClick={() => {
                    setEditingTenant(null);
                    setTenantForm({
                      name: '',
                      slug: '',
                      document: '',
                      plan: 'PROFESSIONAL',
                      status: 'ACTIVE',
                      maxEquipments: 50,
                      maxUsers: 10,
                      maxStorages: 3,
                      aiLevel: 'L2_REMEDIATION',
                      retentionDays: 30,
                    });
                    setTenantError(null);
                    setIsTenantModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg shadow-sky-600/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  Novo Tenant
                </button>
              </div>
            </div>

            {loadingTenants ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Carregando lista de tenants...
              </div>
            ) : tenants.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum tenant cadastrado ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Cadastre o primeiro cliente da plataforma para vincular usuários e equipamentos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((t) => {
                  const eqCount = t._count?.equipments ?? 0;
                  const maxEq = t.maxEquipments ?? (t.plan === 'STARTER' ? 10 : t.plan === 'ENTERPRISE' ? 0 : 50);
                  const eqPct = maxEq > 0 ? Math.min(Math.round((eqCount / maxEq) * 100), 100) : 0;

                  const userCount = t._count?.users ?? 0;
                  const maxU = t.maxUsers ?? (t.plan === 'STARTER' ? 3 : t.plan === 'ENTERPRISE' ? 0 : 10);
                  const uPct = maxU > 0 ? Math.min(Math.round((userCount / maxU) * 100), 100) : 0;

                  const storageCount = t._count?.storages ?? 0;
                  const maxS = t.maxStorages ?? (t.plan === 'STARTER' ? 1 : t.plan === 'ENTERPRISE' ? 0 : 3);
                  const sPct = maxS > 0 ? Math.min(Math.round((storageCount / maxS) * 100), 100) : 0;

                  return (
                    <div key={t.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              {t.name}
                              {t.slug === 'noc-corp' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-950 text-sky-400 border border-sky-800">
                                  Default
                                </span>
                              )}
                            </h3>
                            <span className="text-[11px] font-mono text-slate-400">slug: {t.slug}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                              : t.status === 'SUSPENDED'
                              ? 'bg-rose-950/80 text-rose-400 border-rose-800/80'
                              : 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                          }`}>
                            {t.status === 'ACTIVE' ? 'Ativo' : t.status === 'SUSPENDED' ? 'Suspenso' : 'Trial'}
                          </span>
                        </div>

                        {t.document && (
                          <p className="text-xs text-slate-400 mb-2">
                            <span className="text-slate-500 font-medium">CNPJ/CPF:</span> {t.document}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            t.plan === 'ENTERPRISE'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                              : t.plan === 'STARTER'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : 'bg-slate-800 text-sky-300 border-slate-700'
                          }`}>
                            Plano {t.plan}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-amber-300 border border-amber-900/50 font-mono">
                            IA: {t.aiLevel || 'L2_REMEDIATION'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-400 border border-slate-800 font-mono">
                            {t.retentionDays || 30}d retenção
                          </span>
                        </div>

                        {/* Monitoramento de Cotas e Consumo */}
                        <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
                          {/* Equipamentos */}
                          <div>
                            <div className="flex justify-between items-center text-[11px] mb-1">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Server className="w-3 h-3 text-sky-400" />
                                Equipamentos
                              </span>
                              <span className="font-semibold text-slate-200">
                                {eqCount} <span className="text-slate-500 font-normal">/ {maxEq > 0 ? maxEq : '∞'}</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  maxEq > 0 && eqCount >= maxEq
                                    ? 'bg-rose-500'
                                    : maxEq > 0 && eqPct >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-sky-500'
                                }`}
                                style={{ width: maxEq > 0 ? `${eqPct}%` : '20%' }}
                              />
                            </div>
                          </div>

                          {/* Usuários */}
                          <div>
                            <div className="flex justify-between items-center text-[11px] mb-1">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Users className="w-3 h-3 text-emerald-400" />
                                Usuários
                              </span>
                              <span className="font-semibold text-slate-200">
                                {userCount} <span className="text-slate-500 font-normal">/ {maxU > 0 ? maxU : '∞'}</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  maxU > 0 && userCount >= maxU
                                    ? 'bg-rose-500'
                                    : maxU > 0 && uPct >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: maxU > 0 ? `${uPct}%` : '20%' }}
                              />
                            </div>
                          </div>

                          {/* Storages */}
                          <div>
                            <div className="flex justify-between items-center text-[11px] mb-1">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Database className="w-3 h-3 text-purple-400" />
                                Storages / Repositórios
                              </span>
                              <span className="font-semibold text-slate-200">
                                {storageCount} <span className="text-slate-500 font-normal">/ {maxS > 0 ? maxS : '∞'}</span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  maxS > 0 && storageCount >= maxS
                                    ? 'bg-rose-500'
                                    : maxS > 0 && sPct >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-purple-500'
                                }`}
                                style={{ width: maxS > 0 ? `${sPct}%` : '20%' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => {
                            setEditingTenant(t);
                            setTenantForm({
                              name: t.name,
                              slug: t.slug,
                              document: t.document || '',
                              plan: t.plan || 'PROFESSIONAL',
                              status: t.status || 'ACTIVE',
                              maxEquipments: t.maxEquipments ?? (t.plan === 'STARTER' ? 10 : t.plan === 'ENTERPRISE' ? 0 : 50),
                              maxUsers: t.maxUsers ?? (t.plan === 'STARTER' ? 3 : t.plan === 'ENTERPRISE' ? 0 : 10),
                              maxStorages: t.maxStorages ?? (t.plan === 'STARTER' ? 1 : t.plan === 'ENTERPRISE' ? 0 : 3),
                              aiLevel: t.aiLevel || (t.plan === 'STARTER' ? 'L1_READ' : t.plan === 'ENTERPRISE' ? 'L3_CRITICAL' : 'L2_REMEDIATION'),
                              retentionDays: t.retentionDays ?? (t.plan === 'STARTER' ? 7 : t.plan === 'ENTERPRISE' ? 90 : 30),
                            });
                            setTenantError(null);
                            setIsTenantModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(t.id, t.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-medium flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: GESTÃO DE USUÁRIOS (SUPERADMIN & TENANT_MASTER) */}
        {activeTab === 'users' && (currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'TENANT_MASTER') && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Gestão de Usuários e Permissões (RBAC)
                </h2>
                <p className="text-xs text-slate-400">
                  {currentUser.role === 'SUPERADMIN'
                    ? 'Visualização e gestão global de operadores e gestores de todos os tenants.'
                    : `Gestão exclusiva de operadores e acessos da organização ${currentUser.tenant?.name || ''}.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {currentUser.role === 'SUPERADMIN' && (
                  <select
                    value={userTenantFilter}
                    onChange={(e) => setUserTenantFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="ALL">Todos os Tenants</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>

                <button
                  onClick={() => {
                    setEditingUser(null);
                    setUserForm({
                      name: '',
                      email: '',
                      password: '',
                      role: 'OPERATOR',
                      tenantId: currentUser.role === 'TENANT_MASTER' ? currentUser.tenantId : (tenants[0]?.id || ''),
                      phone: '',
                      active: true,
                    });
                    setUserError(null);
                    setIsUserModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Novo Usuário
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Carregando catálogo de usuários...
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum usuário localizado</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Cadastre operadores ou técnicos para compartilhar o acesso ao monitoramento.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm border border-slate-700">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{u.name}</span>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'SUPERADMIN'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                              : u.role === 'TENANT_MASTER'
                              ? 'bg-sky-950/80 text-sky-300 border border-sky-800/80'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          }`}>
                            {u.role}
                          </span>
                          {!u.active && (
                            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 text-[10px] rounded border border-slate-700">
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400 mt-0.5">
                          <span>{u.email}</span>
                          {u.phone && <span>• Tel: {u.phone}</span>}
                          {u.tenant?.name && (
                            <span className="text-sky-400 font-medium">
                              • Org: {u.tenant.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex flex-col items-end text-right">
                        <div className="flex items-center gap-1.5">
                          {u.totpEnabled ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-medium text-[11px] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              2FA Ativo
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 font-medium text-[11px] bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              2FA Inativo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">
                          {u.lastLoginAt ? `Último login: ${new Date(u.lastLoginAt).toLocaleString('pt-BR')}` : 'Nunca acessou'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setUserForm({
                              name: u.name,
                              email: u.email,
                              password: '',
                              role: u.role,
                              tenantId: u.tenantId || '',
                              phone: u.phone || '',
                              active: u.active,
                            });
                            setUserError(null);
                            setIsUserModalOpen(true);
                          }}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Editar Usuário"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 transition"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: GOVERNANÇA, FEATURE FLAGS & APM (EXCLUSIVO SUPERADMIN) */}
        {activeTab === 'observability' && currentUser?.role === 'SUPERADMIN' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* CABEÇALHO DA ABA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-sky-400" />
                  Governança, Autonomia de IA & Observabilidade (APM)
                </h2>
                <p className="text-xs text-slate-400">
                  Gerenciamento de autonomia (L1/L2/L3), Emergency Kill-Switch global, métricas de latência dos drivers MCP e inspeção em tempo real.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={governanceTenantFilter}
                  onChange={(e) => setGovernanceTenantFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">Visualização Global (Todos)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => { fetchFlags(); fetchApm(); }}
                  disabled={loadingApm || loadingFlags}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-1.5 transition"
                  title="Atualizar métricas agora"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingApm || loadingFlags ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* CARD 1: EMERGENCY KILL-SWITCH GLOBAL */}
            <div className={`p-6 rounded-2xl border transition-all duration-300 shadow-xl ${
              flagsData.killSwitch?.active
                ? 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-red-500/80 shadow-red-950/40'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`p-3 rounded-2xl border flex-shrink-0 ${
                    flagsData.killSwitch?.active
                      ? 'bg-red-500/20 text-red-300 border-red-400 animate-bounce'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {flagsData.killSwitch?.active
                          ? '🚨 EMERGENCY KILL-SWITCH GLOBAL ATIVADO'
                          : 'Emergency Kill-Switch Global (Disjuntor de Segurança da IA)'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        flagsData.killSwitch?.active
                          ? 'bg-red-900/80 text-red-200 border-red-500 animate-pulse'
                          : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                      }`}>
                        {flagsData.killSwitch?.active ? 'Ações da IA Bloqueadas' : 'Operação Normal'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {flagsData.killSwitch?.active ? (
                        <div>
                          <span className="font-semibold text-red-200">Motivo:</span> {flagsData.killSwitch.reason || 'Segurança Operacional'} •{' '}
                          <span className="font-semibold text-red-200">Acionado por:</span> {flagsData.killSwitch.triggeredBy || 'Superadmin'} •{' '}
                          <span className="font-semibold text-red-200">Horário:</span> {flagsData.killSwitch.triggeredAt ? new Date(flagsData.killSwitch.triggeredAt).toLocaleString('pt-BR') : 'Recentemente'}.
                          <span className="block text-red-300 mt-0.5 font-medium">
                            Comandos de escrita, reinício de nós e remediações autônomas estão 100% interrompidos. Consultas passivas continuam ativas.
                          </span>
                        </div>
                      ) : (
                        <span>Permite cortar instantaneamente e em tempo real toda e qualquer ação ativa, remediação ou execução de comandos da IA sem necessidade de novo deploy ou reinício dos containers.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {flagsData.killSwitch?.active ? (
                    <button
                      onClick={() => handleToggleKillSwitch(false)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Liberar Kill-Switch (Retomar IA)
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsKillSwitchModalOpen(true)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-red-950/60 hover:bg-red-900 border border-red-700/80 text-red-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
                    >
                      <AlertOctagon className="w-4 h-4 text-red-400" />
                      Acionar Kill-Switch de Emergência
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 2: MATRIZ DE AUTONOMIA DA IA & FEATURE FLAGS */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    Matriz de Autonomia da IA & Feature Flags (Pennant Engine)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Controle granular de autonomia operacional (L1, L2, L3) e liberação controlada de recursos por tenant.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  {flagsData.flags?.length || 0} flags ativas
                </span>
              </div>

              {loadingFlags ? (
                <div className="p-8 text-center text-xs text-slate-500">Carregando catálogo de feature flags...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(flagsData.flags || []).map((f) => {
                    const isAutonomousFlag = f.key.startsWith('ai-autonomous-');
                    const isL3 = f.key.includes('l3');
                    return (
                      <div
                        key={f.id || f.key}
                        className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                          f.enabled
                            ? isL3 
                              ? 'bg-amber-950/20 border-amber-800/60' 
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/30 border-slate-800/40 opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-mono text-xs font-bold text-sky-300 break-all">{f.key}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              f.enabled
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {f.enabled ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {f.description || 'Configuração de comportamento do sistema.'}
                          </p>

                          {f.tenant && (
                            <div className="mt-2 text-[10px] text-sky-400 font-medium">
                              🏢 Tenant: {f.tenant.name}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">
                            Tipo: {f.type || 'BOOLEAN'}
                          </span>
                          <button
                            onClick={() => handleToggleFlag(f.key, f.enabled, f.value)}
                            disabled={flagsData.killSwitch?.active && isAutonomousFlag}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                              f.enabled
                                ? 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50'
                            } ${flagsData.killSwitch?.active && isAutonomousFlag ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={flagsData.killSwitch?.active && isAutonomousFlag ? 'Bloqueado pelo Kill-Switch' : 'Alternar status da flag'}
                          >
                            {f.enabled ? 'Desativar' : 'Habilitar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CARD 3: MÉTRICAS APM DE BAIXA LATÊNCIA & PULSE DASHBOARD */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Telemetria APM dos Drivers MCP & Servidores (Pulse Engine)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Monitoramento contínuo de latência RTT em Proxmox, Mikrotik, pfSense, Zabbix e modelos de IA.
                  </p>
                </div>
                {apmMetrics?.server && (
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span>Uptime: {Math.floor(apmMetrics.server.uptimeSeconds / 3600)}h {Math.floor((apmMetrics.server.uptimeSeconds % 3600) / 60)}m</span>
                    <span>•</span>
                    <span>RAM Heap: {apmMetrics.server.memoryHeapUsedMb} MB</span>
                    <span>•</span>
                    <span>Load 1m: {apmMetrics.server.systemLoad1m}</span>
                  </div>
                )}
              </div>

              {/* CARDS DE DRIVERS MCP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { key: 'PROXMOX', name: 'Proxmox VE (8006)', icon: Server },
                  { key: 'PFSENSE', name: 'pfSense REST (8181)', icon: Shield },
                  { key: 'MIKROTIK', name: 'Mikrotik RouterOS', icon: Radio },
                  { key: 'LLM', name: 'Provedores LLM', icon: Zap },
                  { key: 'ZABBIX', name: 'Zabbix Server', icon: Activity },
                ].map((item) => {
                  const driverData = apmMetrics?.drivers?.[item.key] || {
                    totalCalls: 0,
                    avgLatencyMs: 0,
                    errorRatePercent: 0,
                    status: 'IDLE',
                  };
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-sky-400" />
                          <span className="text-xs font-bold text-white">{item.name}</span>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${
                          driverData.status === 'HEALTHY'
                            ? 'bg-emerald-400 animate-pulse'
                            : driverData.status === 'DEGRADED'
                            ? 'bg-rose-500 animate-ping'
                            : 'bg-slate-600'
                        }`} title={`Status: ${driverData.status}`} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-slate-500">Latência Média:</span>
                          <span className={`text-base font-extrabold font-mono ${
                            driverData.avgLatencyMs < 300
                              ? 'text-emerald-400'
                              : driverData.avgLatencyMs < 1000
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}>
                            {driverData.avgLatencyMs > 0 ? `${driverData.avgLatencyMs} ms` : '0 ms'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-[11px] text-slate-400">
                          <span>Total Chamadas:</span>
                          <span className="font-mono font-medium text-slate-200">{driverData.totalCalls}</span>
                        </div>
                        <div className="flex items-baseline justify-between text-[11px] text-slate-400">
                          <span>Taxa de Erro:</span>
                          <span className={`font-mono font-medium ${driverData.errorRatePercent > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {driverData.errorRatePercent}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            driverData.avgLatencyMs < 300
                              ? 'bg-emerald-500'
                              : driverData.avgLatencyMs < 1000
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(Math.max((driverData.avgLatencyMs / 1000) * 100, 5), 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CARD 4: INSPETOR DE CHAMADAS MCP & WEBHOOKS (TELESCOPE ENGINE) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-sky-400" />
                    Inspetor de Chamadas MCP & Traces em Tempo Real (Telescope)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Histórico ponta a ponta de requisições disparadas para equipamentos com status code, duração e diagnóstico.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {['ALL', 'PROXMOX', 'PFSENSE', 'MIKROTIK', 'LLM', 'ERRORS'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setTraceFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        traceFilter === f
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {f === 'ALL' ? 'Todos' : f === 'ERRORS' ? 'Apenas Erros' : f}
                    </button>
                  ))}
                </div>
              </div>

              {/* TABELA DE TRACES */}
              {mcpTraces.length === 0 ? (
                <div className="p-12 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
                  <Terminal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhum trace de execução capturado ainda.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Conforme o Hermes AI Engine e as sondas realizarem chamadas ao Proxmox, Mikrotik ou pfSense, os traces surgirão automaticamente aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                        <th className="p-3">Horário</th>
                        <th className="p-3">Driver</th>
                        <th className="p-3">Ferramenta / Endpoint</th>
                        <th className="p-3">Duração</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Diagnóstico / Erro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/30 font-sans">
                      {mcpTraces
                        .filter((t) => {
                          if (traceFilter === 'ALL') return true;
                          if (traceFilter === 'ERRORS') return t.error || (t.statusCode && t.statusCode >= 400);
                          return t.driver === traceFilter;
                        })
                        .slice(0, 40)
                        .map((t) => {
                          const hasError = t.error || (t.statusCode && t.statusCode >= 400);
                          return (
                            <tr key={t.id} className="hover:bg-slate-900/50 transition">
                              <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                {new Date(t.createdAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  t.driver === 'PROXMOX'
                                    ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                    : t.driver === 'PFSENSE'
                                    ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                                    : t.driver === 'MIKROTIK'
                                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                                    : t.driver === 'LLM'
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  {t.driver}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-200 text-xs max-w-xs truncate" title={t.endpoint}>
                                {t.endpoint}
                              </td>
                              <td className="p-3 font-mono text-xs whitespace-nowrap">
                                <span className={`font-semibold ${
                                  t.durationMs < 300
                                    ? 'text-emerald-400'
                                    : t.durationMs < 1000
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}>
                                  {t.durationMs} ms
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  hasError
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                }`}>
                                  {t.statusCode || 200}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 text-xs max-w-sm truncate">
                                {hasError ? (
                                  <span className="text-rose-400 font-mono text-[11px]" title={t.error}>
                                    {t.error}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[11px]">OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO DO EMERGENCY KILL-SWITCH */}
        {isKillSwitchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-red-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-950 text-red-400 rounded-xl border border-red-800 animate-pulse">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Acionar Kill-Switch de Emergência</h3>
                    <p className="text-xs text-red-300">Corte imediato de ações ativas da IA</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsKillSwitchModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-200 leading-relaxed">
                ⚠️ <span className="font-bold">Atenção:</span> Esta ação suspende instantaneamente qualquer comando, reinício de nós ou remediação automática disparada pelo NOC-Agent em todos os clientes e equipamentos.
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Justificativa / Motivo do Acionamento (Gravado em Audit Log)
                </label>
                <textarea
                  rows={3}
                  value={killSwitchReason}
                  onChange={(e) => setKillSwitchReason(e.target.value)}
                  placeholder="Ex: Anomalia detectada em enlace de borda, janela emergencial de manutenção física..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsKillSwitchModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleKillSwitch(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition"
                >
                  <AlertOctagon className="w-4 h-4" />
                  Confirmar e Ativar Kill-Switch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CADASTRO / EDIÇÃO DE TENANT */}
        {isTenantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-950 text-sky-400 rounded-xl border border-sky-800">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {editingTenant ? 'Editar Tenant' : 'Cadastrar Novo Tenant'}
                    </h3>
                    <p className="text-xs text-slate-400">Organização isolada para gestão de infraestrutura e usuários.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTenantModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {tenantError && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{tenantError}</span>
                </div>
              )}

              <form onSubmit={handleSaveTenant} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nome da Organização *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Minha Empresa, Hospital Central"
                    value={tenantForm.name}
                    onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Identificador (Slug)</label>
                    <input
                      type="text"
                      placeholder="minha-empresa (auto se vazio)"
                      value={tenantForm.slug}
                      onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">CNPJ ou Documento</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={tenantForm.document}
                      onChange={(e) => setTenantForm({ ...tenantForm, document: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Plano Base</label>
                    <select
                      value={tenantForm.plan}
                      onChange={(e) => {
                        const newPlan = e.target.value;
                        const preset = PLAN_PRESETS[newPlan];
                        if (preset) {
                          setTenantForm({
                            ...tenantForm,
                            plan: newPlan,
                            maxEquipments: preset.maxEquipments,
                            maxUsers: preset.maxUsers,
                            maxStorages: preset.maxStorages,
                            aiLevel: preset.aiLevel,
                            retentionDays: preset.retentionDays,
                          });
                        } else {
                          setTenantForm({ ...tenantForm, plan: newPlan });
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="STARTER">Starter</option>
                      <option value="PROFESSIONAL">Professional</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Status</label>
                    <select
                      value={tenantForm.status}
                      onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="ACTIVE">Ativo</option>
                      <option value="SUSPENDED">Suspenso</option>
                      <option value="TRIAL">Trial</option>
                    </select>
                  </div>
                </div>

                {/* Painel Visual de Cotas e Capacidades do Plano */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-sky-400" />
                      Cotas e Limites Operacionais
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      0 = Ilimitado
                    </span>
                  </div>

                  {/* Preset Quick Badges */}
                  <div className="grid grid-cols-3 gap-2">
                    {['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const preset = PLAN_PRESETS[p];
                          setTenantForm({
                            ...tenantForm,
                            plan: p,
                            maxEquipments: preset.maxEquipments,
                            maxUsers: preset.maxUsers,
                            maxStorages: preset.maxStorages,
                            aiLevel: preset.aiLevel,
                            retentionDays: preset.retentionDays,
                          });
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition text-center ${
                          tenantForm.plan === p
                            ? 'bg-sky-600/30 border-sky-500 text-sky-200 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        Carregar Preset {p}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] font-medium mb-1">Max Equipamentos</label>
                      <input
                        type="number"
                        min="0"
                        value={tenantForm.maxEquipments}
                        onChange={(e) => setTenantForm({ ...tenantForm, maxEquipments: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] font-medium mb-1">Max Usuários</label>
                      <input
                        type="number"
                        min="0"
                        value={tenantForm.maxUsers}
                        onChange={(e) => setTenantForm({ ...tenantForm, maxUsers: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] font-medium mb-1">Max Storages</label>
                      <input
                        type="number"
                        min="0"
                        value={tenantForm.maxStorages}
                        onChange={(e) => setTenantForm({ ...tenantForm, maxStorages: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] font-medium mb-1">Nível de Autonomia IA</label>
                      <select
                        value={tenantForm.aiLevel}
                        onChange={(e) => setTenantForm({ ...tenantForm, aiLevel: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs"
                      >
                        <option value="L1_READ">L1 - Diagnóstico & Leitura</option>
                        <option value="L2_REMEDIATION">L2 - Remediação Assistida</option>
                        <option value="L3_CRITICAL">L3 - Autônomo & Crítico</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] font-medium mb-1">Retenção de Dados (Dias)</label>
                      <input
                        type="number"
                        min="1"
                        value={tenantForm.retentionDays}
                        onChange={(e) => setTenantForm({ ...tenantForm, retentionDays: parseInt(e.target.value, 10) || 1 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTenantModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={tenantSaving}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-lg shadow-sky-600/20 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {tenantSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Tenant'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CADASTRO / EDIÇÃO DE USUÁRIO */}
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
                    </h3>
                    <p className="text-xs text-slate-400">Controle de acesso e privilégios operacionais.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsUserModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {userError && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{userError}</span>
                </div>
              )}

              <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Silva, Ana Engenharia"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">E-mail de Acesso *</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      placeholder="operador@empresa.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {editingUser ? 'Alterar Senha (deixe em branco para manter)' : 'Senha Inicial *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder={editingUser ? '••••••••••••' : 'Mínimo 6 caracteres'}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Função / Papel *</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      {currentUser?.role === 'SUPERADMIN' && (
                        <option value="SUPERADMIN">Superadmin (Global)</option>
                      )}
                      <option value="TENANT_MASTER">Tenant Master (Gestor do Tenant)</option>
                      <option value="OPERATOR">Operador (Técnico NOC)</option>
                      <option value="VIEWER">Visualizador (Somente Leitura)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Tenant (Organização)</label>
                    {currentUser?.role === 'SUPERADMIN' ? (
                      <select
                        value={userForm.tenantId}
                        onChange={(e) => setUserForm({ ...userForm, tenantId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                      >
                        <option value="">Selecione o Tenant...</option>
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={currentUser?.tenant?.name || 'Seu Tenant'}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-400 opacity-60"
                      />
                    )}
                  </div>
                </div>

                {editingUser && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="userActiveCheck"
                      checked={userForm.active}
                      onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <label htmlFor="userActiveCheck" className="text-slate-300 font-medium cursor-pointer">
                      Usuário Ativo (acesso permitido ao sistema)
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={userSaving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {userSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Usuário'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIGURAÇÃO DE 2FA TOTP */}
        {is2faModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-950 text-sky-400 rounded-xl border border-sky-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Configurar 2FA (TOTP)</h3>
                    <p className="text-xs text-slate-400">Google Authenticator, Authy ou 1Password.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIs2faModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {setup2faSuccess ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-200">{setup2faSuccess}</h4>
                  <p className="text-xs text-emerald-400/80">Sua conta agora está protegida com autenticação em dois fatores.</p>
                </div>
              ) : (
                <form onSubmit={handleConfirm2fa} className="space-y-4 text-xs">
                  {setup2faError && (
                    <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{setup2faError}</span>
                    </div>
                  )}

                  {/* QR CODE PARA ESCANEAR COM SMARTPHONE */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                    {setup2faQrCode ? (
                      <div className="p-2.5 bg-white rounded-xl shadow-xl shadow-sky-500/10 border border-slate-700/60 inline-block">
                        <img 
                          src={setup2faQrCode} 
                          alt="QR Code Autenticador 2FA" 
                          className="w-44 h-44 object-contain rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-44 h-44 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
                      </div>
                    )}
                    
                    <div className="text-center space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-950/80 border border-sky-800 text-sky-300 text-[11px] font-semibold">
                        <QrCode className="w-3.5 h-3.5" />
                        Aponte a câmera do autenticador
                      </span>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        Abra o <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong> e escaneie a imagem acima.
                      </p>
                    </div>
                  </div>

                  {/* CHAVE SECRETA BASE32 MANUAL COMO ALTERNATIVA */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="block text-slate-400 text-[11px]">Não consegue escanear? Digite a chave manual:</span>
                    <div className="flex items-center justify-between bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-sky-300 font-bold tracking-wider text-xs">
                      <span className="truncate select-all">{setup2faSecret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(setup2faSecret);
                          alert('Chave secreta copiada para a área de transferência!');
                        }}
                        className="text-slate-400 hover:text-sky-300 p-1 transition"
                        title="Copiar Chave Secreta"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* INPUT DO CÓDIGO DE 6 DÍGITOS */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 text-center">
                      Código de Validação (6 Dígitos):
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="000000"
                      value={setup2faCode}
                      onChange={(e) => setSetup2faCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950 border border-sky-500/60 rounded-xl px-4 py-2.5 text-center text-2xl font-mono tracking-[0.3em] text-sky-300 placeholder:text-slate-700 focus:outline-none focus:border-sky-400 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIs2faModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={setup2faLoading || setup2faCode.length < 6}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-lg shadow-sky-600/20 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {setup2faLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        'Ativar 2FA'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>NOC-Agent • AWE Cloud Solution • Arquitetura Segura com Hermes Agent & Chatwoot Dual-API</p>
      </footer>
    </div>
  );
}
