import React, { useState, useEffect } from 'react';
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
  BellOff
} from 'lucide-react';
import axios from 'axios';

const initialEquipmentForm = {
  name: '',
  type: 'PFSENSE',
  host: '',
  port: '',
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

function EquipmentCredentialInputs({ form, setForm, storages = [], isEdit = false }) {
  return (
    <>
      <div>
        <label className="block text-slate-300 font-medium mb-1">Nome do Equipamento *</label>
        <input
          type="text"
          required
          placeholder="Ex: pfSense Matriz, Mikrotik Core, Servidor Linux Produção"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
        />
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
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-200 text-xs flex items-start gap-2.5">
          <Terminal className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold block">Instalação 1-Clique com Agente Outbound</span>
            <p className="text-[11px] text-emerald-300/80 mt-0.5">
              Nenhuma senha precisa trafegar ou ser armazenada. Ao salvar, um comando de auto-registro ({form.type === 'WINDOWS_SERVER' ? 'PowerShell' : 'Bash / curl'}) com token criptográfico de uso único será gerado.
            </p>
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
            <div>
              <label className="block text-slate-300 font-medium mb-1">Chave Privada SSH (.pem / id_rsa) *</label>
              <textarea
                rows={4}
                required={!isEdit}
                placeholder={isEdit ? 'Deixe em branco para manter a chave atual' : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                value={form.privateKey}
                onChange={e => setForm({ ...form, privateKey: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
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

  // Filtro de tipos na visão geral (conforme dropdown de cadastro)
  const [overviewTypeFilter, setOverviewTypeFilter] = useState('ALL');

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
        credentials: buildCredentials(newEquipment),
      };

      const res = await axios.post('/api/equipments', payload);
      const createdEq = res.data?.data;

      setIsModalOpen(false);
      setNewEquipment({ ...initialEquipmentForm });

      await fetchEquipments();
      await fetchEquipmentsStatus();

      // Se for modo AGENT, abre imediatamente o modal com o comando de instalação 1-clique
      if (newEquipment.connectionMode === 'AGENT' && createdEq) {
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
              <p className="text-xs text-slate-400">nocagent.awecloudsolution.com • IA Operacional 24/7 (v1.1.1)</p>
            </div>
          </div>

          {/* STATUS DOS MÓDULOS */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300">Cofre AES-256</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">Storage</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Chatwoot WhatsApp</span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO POR TABS */}
        <div className="max-w-7xl mx-auto px-4 flex gap-2 border-t border-slate-800/60 overflow-x-auto text-sm">
          {[
            { id: 'overview', label: 'Visão Geral (NOC)', icon: Activity },
            { id: 'chat', label: 'Terminal IA (Chat)', icon: MessageSquare },
            { id: 'vault', label: 'Cofre de Equipamentos', icon: Lock },
            { id: 'storages', label: 'Cofre de Storages', icon: Database },
            { id: 'backups', label: 'Auditoria de Backups', icon: HardDrive },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-4 font-medium flex items-center gap-2 border-b-2 transition-all duration-200 whitespace-nowrap ${
                  active 
                    ? 'border-sky-500 text-sky-400 bg-sky-500/10' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
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

              {/* FILTROS DE TIPO E ATUALIZAÇÃO */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <select
                    value={overviewTypeFilter}
                    onChange={(e) => setOverviewTypeFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1 font-medium"
                  >
                    <option value="ALL" className="bg-slate-900 text-slate-200">Todos os Ativos ({equipmentList.length})</option>
                    <option value="PFSENSE" className="bg-slate-900 text-slate-200">pfSense Firewall (REST API)</option>
                    <option value="MIKROTIK" className="bg-slate-900 text-slate-200">Mikrotik RouterOS (API)</option>
                    <option value="PROXMOX" className="bg-slate-900 text-slate-200">Proxmox VE Cluster</option>
                    <option value="LINUX_SERVER" className="bg-slate-900 text-slate-200">Servidor Linux (SSH / Agente)</option>
                    <option value="WINDOWS_SERVER" className="bg-slate-900 text-slate-200">Servidor Windows (WinRM / Agente)</option>
                    <option value="ZABBIX" className="bg-slate-900 text-slate-200">Zabbix Server</option>
                    <option value="GENERIC_SNMP" className="bg-slate-900 text-slate-200">SNMP Genérico</option>
                  </select>
                </div>

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
              <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{statusError}</p>
                  <p className="text-amber-300/80 mt-0.5">Verifique a conectividade com o banco ou com os equipamentos no Cofre.</p>
                </div>
              </div>
            ) : equipmentList.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum equipamento retornado pelo cofre.
              </div>
            ) : equipmentList.filter(eq => overviewTypeFilter === 'ALL' || eq.type === overviewTypeFilter).length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                <p>Nenhum equipamento do tipo selecionado (<strong>{overviewTypeFilter}</strong>) encontrado.</p>
                <button
                  onClick={() => setOverviewTypeFilter('ALL')}
                  className="mt-3 px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/40 rounded-lg text-xs font-semibold transition"
                >
                  Limpar Filtro e Exibir Todos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                {equipmentList
                  .filter(eq => overviewTypeFilter === 'ALL' || eq.type === overviewTypeFilter)
                  .map(eq => {
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
                      className={`p-3.5 rounded-xl border bg-slate-900/80 hover:bg-slate-900 transition-all duration-200 flex flex-col justify-between ${borderClass}`}
                    >
                      {/* CABEÇALHO COMPACTO: Nome, Tipo, Host e Status */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
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
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                                        <HardDrive className="w-3 h-3 text-amber-400" />
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
                                    <span className="text-[9px] text-slate-400 font-mono block mt-1 truncate">
                                      {pveData.memory?.usedGB || '0'} / {pveData.memory?.totalGB || '0'} GB
                                    </span>
                                  </div>
                                </div>

                                {/* Workloads & Versão compactos */}
                                <div className="bg-slate-950/50 px-2 py-1.5 rounded-lg border border-slate-800/60 flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 font-medium">VMs:</span>
                                    <span className="text-emerald-400 font-bold font-mono">{pveData.workloads?.runningVMs ?? 0} on</span>
                                    <span className="text-slate-600">/</span>
                                    <span className="text-slate-400 font-mono">{pveData.workloads?.stoppedVMs ?? 0} off</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                                    <span className="truncate max-w-[120px]" title={pveData.pveVersion}>{pveData.pveVersion || 'PVE'}</span>
                                  </div>
                                </div>

                                {/* Storages em mini badges */}
                                {pveData.storages && pveData.storages.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {pveData.storages.slice(0, 3).map((st, idx) => (
                                      <span key={idx} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                                        {st.name}: <strong className={st.usedPercent > 85 ? 'text-red-400' : 'text-emerald-400'}>{st.usedPercent}%</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-center text-slate-400 text-[11px]">
                                <span>{isOnline ? 'Sincronizando métricas do nó...' : 'Proxmox offline'}</span>
                              </div>
                            )}
                          </div>
                        ) : eq.type === 'MIKROTIK' && eq.mikrotikData ? (
                          <div className="space-y-1.5 text-xs">
                            <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Latência RTT:</span>
                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                  {eq.lastLatency != null && eq.lastLatency > 0 ? `${eq.lastLatency} ms` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">CPU RouterOS:</span>
                                <span className="font-mono font-bold text-sky-400 text-sm">
                                  {eq.mikrotikData.cpuLoadPercent != null ? `${eq.mikrotikData.cpuLoadPercent}%` : '—'}
                                </span>
                              </div>
                            </div>
                            {eq.mikrotikData.version && (
                              <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between bg-slate-950/40 px-2 py-1 rounded border border-slate-800/50">
                                <span>RouterOS {eq.mikrotikData.version}</span>
                                {eq.mikrotikData.boardName && <span>{eq.mikrotikData.boardName}</span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 text-xs">
                            <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Latência (RTT):</span>
                                <span className={`font-mono font-bold text-sm ${isOnline ? 'text-emerald-400' : isDegraded ? 'text-amber-400' : 'text-slate-500'}`}>
                                  {eq.lastLatency != null && eq.lastLatency > 0 ? `${eq.lastLatency} ms` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Perda de Pacotes:</span>
                                <span className={`font-mono font-bold text-sm ${eq.lastLossPercent === 0 ? 'text-emerald-400' : eq.lastLossPercent > 0 && eq.lastLossPercent < 100 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {eq.lastLossPercent != null ? `${eq.lastLossPercent}%` : '0%'}
                                </span>
                              </div>
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

                        {/* GATEWAYS MONITORADOS (PFSENSE) */}
                        {eq.subItems && eq.subItems.length > 0 && (
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
                })}
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
                          {eq.connectionMode === 'AGENT' && (
                            <span className="text-[10px] text-sky-400 font-mono flex items-center gap-1 mt-0.5">
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
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Salvar no Cofre
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
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>NOC-Agent • AWE Cloud Solution • Arquitetura Segura com Hermes Agent & Chatwoot Dual-API</p>
      </footer>
    </div>
  );
}
