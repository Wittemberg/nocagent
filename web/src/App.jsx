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
  Info
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
  const [gateways, setGateways] = useState([]);
  const [loadingGateways, setLoadingGateways] = useState(true);
  const [gatewaysError, setGatewaysError] = useState(null);

  const [equipments, setEquipments] = useState([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Busca dados reais dos Gateways
  const fetchGateways = async () => {
    setRefreshing(true);
    setGatewaysError(null);
    try {
      const res = await axios.get('/api/gateways');
      if (res.data?.status === 'ok') {
        setGateways(res.data.data || []);
      } else if (res.data?.status === 'unconfigured') {
        setGatewaysError(res.data.message || 'PFSENSE_API_KEY não configurada.');
        setGateways([]);
      }
    } catch (err) {
      setGatewaysError(err.response?.data?.message || 'Falha ao conectar com o serviço do pfSense.');
    } finally {
      setLoadingGateways(false);
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
    fetchGateways();
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

  // Identifica se há gateways caídos no momento
  const downGateways = gateways.filter(gw => gw.status !== 'online');

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
              <p className="text-xs text-slate-400">nocagent.awecloudsolution.com • IA Operacional 24/7</p>
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
              <span className="text-slate-300">Storage S3</span>
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
            { id: 'backups', label: 'Auditoria de Backups S3', icon: HardDrive },
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
        {downGateways.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-900/80 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-900/50 text-red-400 border border-red-700/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-red-200 text-sm">
                  🚨 INCIDENTE REAL ATIVO: {downGateways.map(g => g.name).join(', ')} com Perda de Pacotes
                </h3>
                <p className="text-xs text-red-300/80 mt-0.5">
                  {downGateways.map(g => `Gateway ${g.name} (${g.srcip}) monitorando ${g.monitorip} está com ${g.loss}% de perda.`).join(' • ')}
                </p>
              </div>
            </div>
            <button 
              onClick={fetchGateways}
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
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-400" />
                Status dos Gateways de Internet (pfSense Oficial)
              </h2>
              <button 
                onClick={fetchGateways}
                disabled={refreshing}
                className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar Dados
              </button>
            </div>

            {loadingGateways ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Consultando status dos gateways no pfSense via REST API...</p>
              </div>
            ) : gatewaysError ? (
              <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{gatewaysError}</p>
                  <p className="text-amber-300/80 mt-0.5">Certifique-se de que a variável PFSENSE_API_KEY está configurada no .env do servidor.</p>
                </div>
              </div>
            ) : gateways.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum gateway retornado pelo pfSense.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gateways.map(gw => {
                  const isOnline = gw.status === 'online';
                  return (
                    <div 
                      key={gw.id} 
                      className={`p-5 rounded-2xl border transition-all duration-300 ${
                        isOnline 
                          ? 'bg-slate-900/70 border-emerald-900/60 hover:border-emerald-700/80 shadow-lg shadow-emerald-950/20' 
                          : 'bg-slate-900/70 border-red-900/60 hover:border-red-700/80 shadow-lg shadow-red-950/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                          <h3 className="font-bold text-lg text-white">{gw.name}</h3>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                          isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                        }`}>
                          {gw.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3">
                        <div>
                          <span className="text-slate-400 block">IP da Interface:</span>
                          <span className="font-mono text-slate-200 font-semibold">{gw.srcip || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">IP de Teste (Monitor):</span>
                          <span className="font-mono text-slate-200 font-semibold">{gw.monitorip || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <span className="text-xs text-slate-400">Latência (RTT):</span>
                          <p className={`text-xl font-mono font-bold ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {gw.delay > 0 ? `${gw.delay} ms` : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">Perda de Pacotes:</span>
                          <p className={`text-xl font-mono font-bold ${gw.loss === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {gw.loss}%
                          </p>
                        </div>
                      </div>
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
                  onClick={() => { setActiveTab('chat'); setInputMsg('auditar backups de hoje no S3'); }}
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Cofre Criptográfico de Equipamentos
                </h2>
                <p className="text-xs text-slate-400">Tokens e senhas protegidos com padrão AES-256-GCM. Dados reais gravados no banco PostgreSQL.</p>
              </div>
              <button 
                onClick={fetchEquipments}
                disabled={loadingEquipments}
                className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${loadingEquipments ? 'animate-spin' : ''}`} />
                Atualizar Cofre
              </button>
            </div>

            {loadingEquipments ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Carregando ativos do cofre...
              </div>
            ) : equipments.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <Lock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum equipamento cadastrado no cofre ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Os equipamentos cadastrados pelo painel ou sincronizados via drivers aparecerão aqui de forma protegida com criptografia militar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Equipamento</th>
                      <th className="px-5 py-3.5">Driver / Tipo</th>
                      <th className="px-5 py-3.5">Host / Endpoint</th>
                      <th className="px-5 py-3.5">Credencial no Cofre</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {equipments.map(eq => (
                      <tr key={eq.id} className="hover:bg-slate-800/30">
                        <td className="px-5 py-4 font-semibold text-white">{eq.name}</td>
                        <td className="px-5 py-4 text-xs font-mono text-sky-400">{eq.type}</td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-300">{eq.host}</td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-500">•••••••••••••••• (AES-256)</td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                            {eq.status || 'Ativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUDITORIA DE BACKUPS S3 (DADOS REAIS) */}
        {activeTab === 'backups' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Auditoria de Backups e Snapshots no Storage S3
                </h2>
                <p className="text-xs text-slate-400">Verificação contínua de rotinas diárias e retenção no bucket S3 `nocagent`.</p>
              </div>
              <button 
                onClick={fetchBackups}
                disabled={loadingBackups}
                className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${loadingBackups ? 'animate-spin' : ''}`} />
                Atualizar S3
              </button>
            </div>

            {loadingBackups ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
                Consultando bucket de backups no S3...
              </div>
            ) : backups.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
                <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">Nenhum snapshot catalogado no Storage S3 ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  As rotinas de backup diárias dos nós Proxmox, Mikrotik e pfSense gravarão os metadados de auditoria neste painel.
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
