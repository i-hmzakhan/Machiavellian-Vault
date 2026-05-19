"use client";

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Activity, ShieldAlert, Send, UserPlus, X, Cpu, Trash2, MessageSquare, Menu } from 'lucide-react';
import { getNetworkData, addNode, deleteNode, commitGlobalLog, getStrategicAdvice, getNodeHistory } from '../lib/api';

const NetworkGraph = dynamic(() => import('../components/NetworkGraph'), { ssr: false });

export default function VaultDashboard() {
  // --- AUTHENTICATION STATE ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [authError, setAuthError] = useState(false);
  
  const MASTER_UI_PASSWORD = process.env.NEXT_PUBLIC_UI_PASSWORD || "architect";

  // --- CORE STATE ---
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // NEW: UI State for the Bottom Sheet / Floating Panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Map Data
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);

  // Add Node State
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeVal, setNewNodeVal] = useState(5);
  const [newBackstory, setNewBackstory] = useState("");

  // Node Inspector States
  const [nodeLogText, setNodeLogText] = useState("");
  const [nodeHistory, setNodeHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [lastExtraction, setLastExtraction] = useState<any>(null); 

  // Global Advisor States
  const [advisorMode, setAdvisorMode] = useState<'consult' | 'log'>('consult');
  const [advisorInput, setAdvisorInput] = useState("");
  const [consultChat, setConsultChat] = useState<{role: string, text: string}[]>([]);
  const [logChat, setLogChat] = useState<{role: string, text: string}[]>([]);
  
  // --- DAILY FUEL GAUGE STATES ---
  const MAX_DAILY_REQUESTS = 1500;
  const MAX_DAILY_TOKENS = 1000000;
  const [requestsSpent, setRequestsSpent] = useState(0);
  const [tokensSpent, setTokensSpent] = useState(0);
  const [isMemoryLoaded, setIsMemoryLoaded] = useState(false);

  const activeChat = advisorMode === 'consult' ? consultChat : logChat;

  // --- INITIALIZATION ---
  const fetchMap = async () => {
    const data = await getNetworkData();
    setGraphData(data);
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchMap();
    }
  }, [isUnlocked]);

  // --- PERSISTENT MEMORY & MIDNIGHT RESET ---
  useEffect(() => {
    if (!isUnlocked) return;
    
    const today = new Date().toLocaleDateString();
    const savedDate = localStorage.getItem('vault_date');
    const savedReqs = localStorage.getItem('vault_requests');
    const savedTokens = localStorage.getItem('vault_tokens');

    // If it is a new day, wipe the slate clean
    if (savedDate !== today) {
      localStorage.setItem('vault_date', today);
      localStorage.setItem('vault_requests', '0');
      localStorage.setItem('vault_tokens', '0');
      setRequestsSpent(0);
      setTokensSpent(0);
    } else {
      // If same day, load current fuel levels
      if (savedReqs) setRequestsSpent(parseInt(savedReqs, 10));
      if (savedTokens) setTokensSpent(parseInt(savedTokens, 10));
    }
    
    // Disengage the safety lock only AFTER loading is complete
    setIsMemoryLoaded(true);
  }, [isUnlocked]);

  // Save to memory immediately upon any change (BUT ONLY AFTER LOADED)
  useEffect(() => {
    if (!isMemoryLoaded) return; // The Safety Lock prevents overwriting with 0 on refresh
    
    localStorage.setItem('vault_requests', requestsSpent.toString());
    localStorage.setItem('vault_tokens', tokensSpent.toString());
  }, [requestsSpent, tokensSpent, isMemoryLoaded]);

  // --- HANDLERS ---
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkeyInput === MASTER_UI_PASSWORD) {
      setIsUnlocked(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setPasskeyInput("");
    }
  };

  const handleNodeClick = async (node: any) => {
    if (node.id === "11111111-1111-1111-1111-111111111111") return; 
    
    setSelectedNode(node);
    setIsAddingNode(false);
    setActiveTab('log');
    setLastExtraction(null);
    setNodeLogText("");
    setIsPanelOpen(true); // Auto-open panel on mobile when node clicked
    
    try {
      const histData = await getNodeHistory(node.id);
      setNodeHistory(histData.history || []);
    } catch (e) {
      console.error("History fetch failed");
    }
  };

  const handleAddNodeSubmit = async () => {
    if (!newNodeName.trim()) return;
    setIsProcessing(true);
    try {
      await addNode(newNodeName, newNodeVal, newBackstory);
      setIsAddingNode(false);
      setNewNodeName("");
      setNewBackstory(""); 
      fetchMap(); 
    } catch (error) {
      alert("Failed to initialize target.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    const confirmed = window.confirm(`Terminate [${selectedNode.name}] permanently?`);
    if (confirmed) {
      setIsProcessing(true);
      try {
        await deleteNode(selectedNode.id);
        setSelectedNode(null);
        fetchMap();
      } catch (error) {
        alert("Termination failed.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const executeCommit = async (logText: string, specificTargetName: string | null = null) => {
    setIsProcessing(true);
    if (requestsSpent >= MAX_DAILY_REQUESTS) {
      alert("CRITICAL: Daily API uplink quota exceeded. Reset occurs at midnight.");
      setIsProcessing(false);
      return;
    }
    setRequestsSpent(prev => prev + 1);
    setTokensSpent(prev => prev + 150); // Estimated tokens for a commit
    const finalLog = specificTargetName ? `Focusing on ${specificTargetName}: ${logText}` : logText;
    
    try {
      const result = await commitGlobalLog(finalLog);
      
      if (specificTargetName && selectedNode) {
        const thisNodeResult = result.data.find((n: any) => n.entity_id === selectedNode.id);
        if (thisNodeResult) setLastExtraction(thisNodeResult);
        
        const histData = await getNodeHistory(selectedNode.id);
        setNodeHistory(histData.history || []);
      }
      
      setNodeLogText("");
      fetchMap(); 
      return result; 
    } catch (error) {
      alert("Failed to commit log.");
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdvisorSubmit = async () => {
    if (!advisorInput.trim()) return;
    const userInput = advisorInput;
    setAdvisorInput("");
    if (requestsSpent >= MAX_DAILY_REQUESTS) {
      alert("CRITICAL: Daily API uplink quota exceeded. Reset occurs at midnight.");
      return;
    }
    setRequestsSpent(prev => prev + 1);
    // Consultations use more tokens due to history context
    setTokensSpent(prev => prev + (advisorMode === 'consult' ? 350 : 150));

    if (advisorMode === 'log') {
      setLogChat(prev => [...prev, { role: "user", text: `[SYSTEM LOG]: ${userInput}` }]);
      try {
        const result = await executeCommit(userInput);
        setLogChat(prev => [...prev, { role: "ai", text: `Network dynamics recalculated. AI mapped ripple effects across ${result.data.length} node(s).` }]);
      } catch {
        setLogChat(prev => [...prev, { role: "ai", text: "Error logging event." }]);
      }
    } else {
      const currentHistory = [...consultChat]; 
      setConsultChat(prev => [...prev, { role: "user", text: userInput }]);
      setConsultChat(prev => [...prev, { role: "ai", text: "Compiling multi-node dossiers..." }]);
      
      // --- THE DEEP CONTEXT SCANNER ---
      // 1. Scan the input against all known nodes
      const involvedNodeIds = graphData.nodes
        .filter((node: any) => userInput.toLowerCase().includes(node.name.toLowerCase()))
        .map((node: any) => node.id);

      // 2. Always include the currently selected node (if any), avoiding duplicates
      if (selectedNode && !involvedNodeIds.includes(selectedNode.id)) {
        involvedNodeIds.push(selectedNode.id);
      }

      try {
        // 3. Send the query, history, AND the involved IDs to the backend
        const response = await getStrategicAdvice(userInput, currentHistory, involvedNodeIds);
        setConsultChat(prev => {
          const newChat = [...prev];
          newChat[newChat.length - 1] = { role: "ai", text: response.advice };
          return newChat;
        });
      } catch (e) {
        setConsultChat(prev => {
          const newChat = [...prev];
          newChat[newChat.length - 1] = { role: "ai", text: "Error connecting to strategic matrix." };
          return newChat;
        });
      }
    }
  }; // <-- FIXED: THIS BRACKET WAS MISSING!

  return (
    <>
      {/* THE LOCK SCREEN */}
      {!isUnlocked && (
        <div className="flex h-screen w-full bg-slate-950 items-center justify-center font-sans">
          <div className="max-w-md w-full p-8 border border-slate-800 bg-slate-900 rounded shadow-2xl flex flex-col items-center">
            <ShieldAlert size={48} className="text-indigo-600 mb-6" />
            <h1 className="text-2xl font-bold text-white tracking-widest uppercase mb-2">The Vault</h1>
            <p className="text-slate-500 text-sm mb-8">Encrypted Machiavellian Matrix</p>
            
            <form onSubmit={handleUnlock} className="w-full">
              <input 
                type="password" 
                autoFocus
                className={`w-full bg-slate-950 border ${authError ? 'border-red-500' : 'border-slate-700'} rounded p-4 text-center text-white tracking-widest outline-none focus:border-indigo-500 transition-colors mb-4`}
                placeholder="ENTER MASTER KEY"
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
              />
              <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm tracking-widest uppercase rounded transition-colors">
                Decrypt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* THE DASHBOARD */}
      {isUnlocked && (
        <div className="relative h-[100dvh] w-full bg-slate-950 text-slate-300 font-sans overflow-hidden animate-in fade-in duration-700">
          
          {/* FULL BLEED MAP CANVAS */}
          <div className="absolute inset-0 z-0 bg-slate-950">
            {graphData.nodes.length > 0 && (
              <NetworkGraph graphData={graphData} onNodeClick={handleNodeClick} />
            )}
          </div>

          {/* FLOATING HUD (Top Left) - No background box */}
          <div className="absolute top-8 left-6 z-10 pointer-events-none drop-shadow-lg">
            <h1 className="text-2xl font-bold text-slate-100 tracking-[0.2em] uppercase">The Vault</h1>
            <p className="text-[10px] text-indigo-400 font-semibold tracking-[0.2em] uppercase mt-1 mb-6">Machiavellian Protocol</p>
            
            <div className="space-y-3">
              <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-red-500 mr-4 shadow-[0_0_10px_#ef4444]"></div><span className="text-xs text-slate-300 uppercase tracking-widest font-semibold drop-shadow-md">High Threat</span></div>
              <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-4 shadow-[0_0_10px_#f97316]"></div><span className="text-xs text-slate-300 uppercase tracking-widest font-semibold drop-shadow-md">Warning</span></div>
              <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-4 shadow-[0_0_10px_#4f46e5]"></div><span className="text-xs text-slate-300 uppercase tracking-widest font-semibold drop-shadow-md">Neutral</span></div>
              <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-4 shadow-[0_0_10px_#10b981]"></div><span className="text-xs text-slate-300 uppercase tracking-widest font-semibold drop-shadow-md">Secured</span></div>
            </div>
          </div>

          {/* FLOATING ACTION BUTTON (Bottom Right) */}
          {!isPanelOpen && (
            <button 
              onClick={() => setIsPanelOpen(true)} 
              className="absolute bottom-8 right-6 z-20 w-14 h-14 rounded-2xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] flex justify-center items-center text-indigo-400 hover:text-indigo-300 transition-all active:scale-95 animate-in slide-in-from-bottom-5 duration-300"
            >
              <Cpu size={24} />
            </button>
          )}

          {/* GLASSMORPHIC COMMAND CENTER (Bottom Sheet on Mobile, Floating Panel on Desktop) */}
          <div 
            className={`absolute z-30 transition-transform duration-400 cubic-bezier(0.32, 0.72, 0, 1) 
              ${isPanelOpen ? 'translate-y-0' : 'translate-y-[120%]'} 
              lg:translate-y-0 bottom-0 left-0 w-full h-[75dvh] lg:h-[calc(100vh-64px)] lg:top-8 lg:bottom-auto lg:left-auto lg:right-8 lg:w-[420px] 
              bg-[#0a0f1c]/85 backdrop-blur-2xl border-t lg:border border-slate-800/80 rounded-t-3xl lg:rounded-2xl flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)] lg:shadow-2xl
              ${!isPanelOpen && 'lg:opacity-0 lg:pointer-events-none lg:transition-opacity lg:duration-300'}
            `}
          >
            {/* Mobile Swipe Indicator */}
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden shrink-0 cursor-pointer" onClick={() => setIsPanelOpen(false)}>
              <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
            </div>

            {/* HEADER */}
            <div className="px-6 pb-4 pt-2 lg:pt-6 flex justify-between items-center shrink-0">
              <div className="flex items-center">
                {isAddingNode ? (
                  <h2 className="text-xs font-bold text-slate-300 tracking-[0.2em] flex items-center uppercase"><UserPlus size={14} className="mr-2 text-indigo-400"/> Add Target</h2>
                ) : selectedNode ? (
                  <h2 className="text-xs font-bold text-slate-300 tracking-[0.2em] flex items-center uppercase"><Activity size={14} className="mr-2 text-indigo-400"/> {selectedNode.name}</h2>
                ) : (
                  <h2 className="text-xs font-bold text-slate-300 tracking-[0.2em] flex items-center uppercase"><Cpu size={14} className="mr-2 text-indigo-400"/> Command Center</h2>
                )}
              </div>
              <div className="flex items-center space-x-1">
                {/* Tactical Add Target Icon (Only visible in global view) */}
                {!isAddingNode && !selectedNode && (
                  <button 
                    onClick={() => setIsAddingNode(true)} 
                    className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md transition-colors" 
                    title="Initialize New Target"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
                <button onClick={() => { setIsPanelOpen(false); setIsAddingNode(false); setSelectedNode(null); }} className="p-2 -mr-2 text-slate-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent shrink-0"></div>

            {/* DAILY FUEL GAUGES */}
            <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-950/60 shrink-0 space-y-3">
              
              {/* Requests Gauge */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[8px] text-slate-500 uppercase tracking-[0.2em] font-bold">Daily Requests</span>
                  <span className="text-[9px] font-mono tracking-widest font-bold text-indigo-400">
                    {MAX_DAILY_REQUESTS - requestsSpent} / {MAX_DAILY_REQUESTS}
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full transition-all duration-500 bg-indigo-500 shadow-[0_0_8px_#4f46e5] ${requestsSpent > (MAX_DAILY_REQUESTS * 0.9) ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : ''}`}
                    style={{ width: `${Math.max(0, 100 - (requestsSpent / MAX_DAILY_REQUESTS) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Tokens Gauge */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[8px] text-slate-500 uppercase tracking-[0.2em] font-bold">Daily Tokens (Est)</span>
                  <span className="text-[9px] font-mono tracking-widest font-bold text-emerald-400">
                    {((MAX_DAILY_TOKENS - tokensSpent) / 1000).toFixed(1)}k / {(MAX_DAILY_TOKENS / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full transition-all duration-500 bg-emerald-500 shadow-[0_0_8px_#10b981] ${tokensSpent > (MAX_DAILY_TOKENS * 0.9) ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : ''}`}
                    style={{ width: `${Math.max(0, 100 - (tokensSpent / MAX_DAILY_TOKENS) * 100)}%` }}
                  ></div>
                </div>
              </div>

            </div>
            {/* STATE 3: ADD NODE */}
            {isAddingNode && (
              <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                <div>
                  <label className="text-[10px] text-slate-500 tracking-[0.1em] uppercase font-semibold">Target Name</label>
                  <input type="text" className="w-full mt-2 bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-indigo-500/70 transition-colors" value={newNodeName} onChange={(e) => setNewNodeName(e.target.value)}/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 tracking-[0.1em] uppercase font-semibold">Base Value (1-10)</label>
                  <input type="number" className="w-full mt-2 bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-indigo-500/70 transition-colors" value={newNodeVal} onChange={(e) => setNewNodeVal(parseInt(e.target.value))}/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 tracking-[0.1em] uppercase font-semibold">Genesis Archive (Backstory)</label>
                  <textarea 
                    className="w-full mt-2 h-32 bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 resize-none outline-none focus:border-indigo-500/70 transition-colors" 
                    placeholder="Psychological traits, history..."
                    value={newBackstory} 
                    onChange={(e) => setNewBackstory(e.target.value)}
                  />
                </div>
                <button onClick={handleAddNodeSubmit} disabled={isProcessing} className="w-full py-4 mt-2 bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold tracking-widest uppercase rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]">{isProcessing ? 'Initializing...' : 'Initialize Node'}</button>
              </div>
            )}

            {/* STATE 2: NODE INSPECTOR */}
            {!isAddingNode && selectedNode && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex border-b border-slate-800/50">
                  <button onClick={() => setActiveTab('log')} className={`flex-1 py-4 text-[10px] uppercase tracking-[0.15em] font-bold transition-colors ${activeTab === 'log' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-600 hover:text-slate-400'}`}>Commit Log</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 text-[10px] uppercase tracking-[0.15em] font-bold transition-colors ${activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-600 hover:text-slate-400'}`}>Timeline</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {activeTab === 'log' ? (
                    <>
                      {lastExtraction && (
                        <div className="border border-indigo-500/30 bg-indigo-500/5 p-4 rounded-xl animate-in fade-in duration-300">
                          <h3 className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold mb-3">Latest Shift</h3>
                          <p><span className="text-slate-500 text-sm">Mood:</span> <span className="text-slate-200 text-sm ml-2">{lastExtraction.mood}</span></p>
                          <p><span className="text-slate-500 text-sm">Delta:</span> <span className={`${lastExtraction.leverage_shift_score < 0 ? 'text-red-400' : 'text-emerald-400'} font-mono text-sm ml-2`}>{lastExtraction.leverage_shift_score > 0 ? '+' : ''}{lastExtraction.leverage_shift_score}</span></p>
                          <p className="text-slate-400 mt-3 border-t border-slate-800/50 pt-3 text-xs leading-relaxed">{lastExtraction.calculated_diff_summary}</p>
                        </div>
                      )}
                      <div className="text-xs text-slate-500 text-center mt-8 italic">Awaiting interaction telemetry.</div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      {nodeHistory.length === 0 ? <p className="text-xs text-slate-500 text-center italic">No telemetry recorded.</p> : 
                        nodeHistory.map((hist, i) => (
                          <div key={i} className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] text-slate-500 tracking-wider">{new Date(hist.created_at).toLocaleDateString()}</span>
                              <span className={`text-[10px] font-mono tracking-wider font-bold ${hist.calculated_diff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>DELTA {hist.calculated_diff}</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">{hist.content_log}</p>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {activeTab === 'log' && (
                  <div className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/50 shrink-0">
                    <textarea 
                      className="w-full h-20 bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-sm text-white resize-none outline-none focus:border-indigo-500/50 mb-3 transition-colors"
                      placeholder={`Detail interaction with ${selectedNode.name}...`}
                      value={nodeLogText}
                      onChange={(e) => setNodeLogText(e.target.value)}
                      disabled={isProcessing}
                    />
                    <div className="flex space-x-2">
                      <button onClick={handleDeleteNode} disabled={isProcessing} className="p-3 rounded-lg border border-red-900/30 text-red-500 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={16} />
                      </button>
                      <button onClick={() => executeCommit(nodeLogText, selectedNode.name)} className="flex-1 py-3 rounded-lg text-xs tracking-widest font-bold uppercase bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-50 transition-colors" disabled={isProcessing || !nodeLogText.trim()}>
                        {isProcessing ? 'Routing...' : 'Execute'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STATE 1: GLOBAL COMMAND CENTER */}
            {!isAddingNode && !selectedNode && (
              <div className="flex flex-col flex-1 overflow-hidden">
                
               
                <div className="flex border-b border-slate-800/50 px-6 space-x-4 shrink-0">
                  <button onClick={() => setAdvisorMode('consult')} className={`py-4 text-[10px] uppercase tracking-[0.15em] font-bold transition-colors ${advisorMode === 'consult' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-600 hover:text-slate-400'}`}>Consult</button>
                  <button onClick={() => setAdvisorMode('log')} className={`py-4 text-[10px] uppercase tracking-[0.15em] font-bold transition-colors ${advisorMode === 'log' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-600 hover:text-slate-400'}`}>Global Log</button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                   {activeChat.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                       <Cpu size={32} className="opacity-30" />
                       <p className="text-xs tracking-wider text-center uppercase">
                         {advisorMode === 'consult' ? "Query for strategy." : "Log global event."}
                       </p>
                     </div>
                   ) : (
                     activeChat.map((msg, i) => (
                       <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? (msg.text.includes('[SYSTEM LOG]') ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20 rounded-tr-sm' : 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/20 rounded-tr-sm') : 'bg-slate-800/50 text-slate-300 border border-slate-700/30 rounded-tl-sm whitespace-pre-wrap'}`}>
                           {msg.text}
                         </div>
                       </div>
                     ))
                   )}
                </div>
                
                <div className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/50 shrink-0 pb-6 lg:pb-4">
                  <div className={`flex items-center bg-slate-900/80 border rounded-xl overflow-hidden transition-colors ${advisorMode === 'log' ? 'border-emerald-500/30 focus-within:border-emerald-500/70' : 'border-indigo-500/30 focus-within:border-indigo-500/70'}`}>
                    <input 
                      type="text" 
                      value={advisorInput}
                      onChange={(e) => setAdvisorInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdvisorSubmit()}
                      placeholder={advisorMode === 'consult' ? "Ask for strategy..." : "Describe the event..."} 
                      className="flex-1 bg-transparent px-4 py-3.5 text-xs text-white outline-none tracking-wide"
                      disabled={isProcessing}
                    />
                    <button onClick={handleAdvisorSubmit} disabled={isProcessing} className={`p-4 transition-colors ${advisorMode === 'log' ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-indigo-400 hover:bg-indigo-500/10'}`}>
                      {isProcessing ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}