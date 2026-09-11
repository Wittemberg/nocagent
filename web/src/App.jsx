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
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

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

  const [equipments, setEquipments] = useState([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Modal de Cadastro no Cofre
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    type: 'PFSENSE',
    host: '',
    port: '',
    apiKey: '',
  });

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

  // Cria novo equipamento no Cofre (AES-256-GCM)
  const handleCreateEquipment = async (e) => {
    e.preventDefault();
    if (!newEquipment.name || !newEquipment.host || !newEquipment.apiKey) {
      setSaveError('Preencha todos os campos obrigatórios (Nome, Host e Chave/Credencial).');
      return;
    }

    setSavingEquipment(true);
    setSaveError(null);
    try {
      await axios.post('/api/equipments', {
        name: newEquipment.name,
        type: newEquipment.type,
        host: newEquipment.host,
        port: newEquipment.port ? parseInt(newEquipment.port, 10) : null,
        credentials: { apiKey: newEquipment.apiKey.trim() },
      });

      setIsModalOpen(false);
      setNewEquipment({
        name: '',
        type: 'PFSENSE',
        host: '',
        port: '',
        apiKey: '',
      });

      // Recarrega cofre e gateways
      await fetchEquipments();
      await fetchEquipmentsStatus();
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
  }, []);

  useEffect(() => {
    if (activeTab === 'vault') fetchEquipments();
    if (activeTab === 'backups') fetchBackups();
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

  // Identifica se há equipamentos ou itens monitorados caídos/degradados no momento
  const downEquipments = Array.isArray(equipmentList)
    ? equipmentList.filter(eq => eq.status === 'offline' || eq.status === 'error' || (eq.lastLossPercent != null && eq.lastLossPercent > 0))
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
        {/* BANNER DINÂMICO DE INCIDENTES (APENAS SE HOUVER QUEDA REAL) */}
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

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-400" />
                  Status dos Equipamentos
                </h2>
                <p className="text-xs text-slate-400">Visão operacional em tempo real dos ativos de rede gerenciados no Cofre.</p>
              </div>
              <button 
                onClick={fetchEquipmentsStatus}
                disabled={refreshing}
                className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition px-3 py-1.5 border border-slate-800 rounded-xl bg-slate-900/60"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar Dados
              </button>
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipmentList.map(eq => {
                  const isOnline = eq.status === 'online';
                  const isDegraded = eq.status === 'degraded';
                  const borderClass = isOnline 
                    ? 'border-emerald-900/60 hover:border-emerald-700/80 shadow-lg shadow-emerald-950/20' 
                    : isDegraded 
                    ? 'border-amber-900/60 hover:border-amber-700/80 shadow-lg shadow-amber-950/20' 
                    : 'border-red-900/60 hover:border-red-700/80 shadow-lg shadow-red-950/20';
                  const badgeClass = isOnline 
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800' 
                    : isDegraded 
                    ? 'bg-amber-950 text-amber-400 border-amber-800' 
                    : 'bg-red-950 text-red-400 border-red-800';
                  const dotClass = isOnline ? 'bg-emerald-400 animate-pulse' : isDegraded ? 'bg-amber-400 animate-pulse' : 'bg-red-500';

                  return (
                    <div 
                      key={eq.id} 
                      className={`p-5 rounded-2xl border bg-slate-900/70 transition-all duration-300 ${borderClass}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${dotClass}`} />
                          <h3 className="font-bold text-lg text-white">{eq.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-sky-400 border border-slate-700">
                            {eq.type}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${badgeClass}`}>
                            {eq.status}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3 font-mono text-slate-300 truncate">
                        <span className="text-slate-500 block text-[11px]">Endpoint / Host:</span>
                        {eq.host}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1 mb-2">
                        <div>
                          <span className="text-xs text-slate-400">Latência Média (RTT):</span>
                          <p className={`text-xl font-mono font-bold ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {eq.lastLatency != null && eq.lastLatency > 0 ? `${eq.lastLatency} ms` : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">Perda de Pacotes:</span>
                          <p className={`text-xl font-mono font-bold ${eq.lastLossPercent === 0 ? 'text-emerald-400' : eq.lastLossPercent > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {eq.lastLossPercent != null ? `${eq.lastLossPercent}%` : '0%'}
                          </p>
                        </div>
                      </div>

                      {eq.subItems && eq.subItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Links / Gateways Monitorados:</span>
                          <div className="space-y-1.5">
                            {eq.subItems.map((sub, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${sub.status === 'online' ? 'bg-emerald-400' : 'bg-red-500'}`} />
                                  <span className="font-semibold text-white">{sub.name}</span>
                                  <span className="text-slate-500 text-[11px]">({sub.srcip || sub.monitorip || 'WAN'})</span>
                                </div>
                                <div className="flex items-center gap-3 font-mono text-[11px]">
                                  <span className={sub.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>{(sub.status || 'UNKNOWN').toUpperCase()}</span>
                                  <span className="text-slate-400">{sub.delay ?? 0}ms</span>
                                  <span className={sub.loss === 0 ? 'text-slate-400' : 'text-red-400'}>{sub.loss ?? 0}% perda</span>
                                </div>
                              </div>
                            ))}
                          </div>
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
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {equipments.map(eq => (
                      <tr key={eq.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-5 py-4 font-semibold text-white">{eq.name}</td>
                        <td className="px-5 py-4 text-xs font-mono text-sky-400">{eq.type}</td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-300">{eq.host}</td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono text-[11px] inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            AES-256-GCM
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                            {eq.status || 'Ativo'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDeleteEquipment(eq.id, eq.name)}
                            title="Remover do Cofre"
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nome do Equipamento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: pfSense Matriz"
                    value={newEquipment.name}
                    onChange={e => setNewEquipment({ ...newEquipment, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Tipo de Equipamento *</label>
                    <select
                      value={newEquipment.type}
                      onChange={e => setNewEquipment({ ...newEquipment, type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="PFSENSE">pfSense Firewall</option>
                      <option value="MIKROTIK">Mikrotik RouterOS</option>
                      <option value="PROXMOX">Proxmox VE Cluster</option>
                      <option value="ZABBIX">Zabbix Server</option>
                      <option value="GENERIC_SNMP">SNMP Genérico</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Porta (Opcional)</label>
                    <input
                      type="number"
                      placeholder="Ex: 8181"
                      value={newEquipment.port}
                      onChange={e => setNewEquipment({ ...newEquipment, port: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Host / URL Base *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: https://pfsense.seudominio.com.br:8181"
                    value={newEquipment.host}
                    onChange={e => setNewEquipment({ ...newEquipment, host: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Chave de API / Token / Credencial *</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="Cole aqui a API Key ou token do equipamento"
                      value={newEquipment.apiKey}
                      onChange={e => setNewEquipment({ ...newEquipment, apiKey: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Esta chave será criptografada com AES-256-GCM antes de ser salva no PostgreSQL.
                  </p>
                </div>

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
