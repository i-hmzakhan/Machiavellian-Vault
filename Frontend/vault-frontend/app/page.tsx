"use client";

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Activity, ShieldAlert, Send, UserPlus, X, Cpu, Trash2, MessageSquare } from 'lucide-react';
import { getNetworkData, addNode, deleteNode, commitGlobalLog, getStrategicAdvice, getNodeHistory } from '../lib/api';

const NetworkGraph = dynamic(() => import('../components/NetworkGraph'), { ssr: false });

export default function VaultDashboard() {
  // --- AUTHENTICATION STATE ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [authError, setAuthError] = useState(false);
  
  // The master password for the UI (Will be set in Vercel later)
  const MASTER_UI_PASSWORD = process.env.NEXT_PUBLIC_UI_PASSWORD || "architect";

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Global Advisor States (NOW SPLIT INTO TWO)
  const [advisorMode, setAdvisorMode] = useState<'consult' | 'log'>('consult');
  const [advisorInput, setAdvisorInput] = useState("");
  const [consultChat, setConsultChat] = useState<{role: string, text: string}[]>([]);
  const [logChat, setLogChat] = useState<{role: string, text: string}[]>([]);

  // Derived state to determine which chat to display
  const activeChat = advisorMode === 'consult' ? consultChat : logChat;

  // --- INITIALIZATION ---
  const fetchMap = async () => {
    const data = await getNetworkData();
    setGraphData(data);
  };

  // Only fetch the map AFTER the vault is unlocked
  useEffect(() => {
    if (isUnlocked) {
      fetchMap();
    }
  }, [isUnlocked]);

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
      await addNode(newNodeName, newNodeVal, newBackstory); // Passed backstory here
      setIsAddingNode(false);
      setNewNodeName("");
      setNewBackstory(""); // Reset
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
      return result; // return result for UI updates in global chat
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

    if (advisorMode === 'log') {
      // Route specifically to the LOG chat array
      setLogChat(prev => [...prev, { role: "user", text: `[SYSTEM LOG]: ${userInput}` }]);
      try {
        const result = await executeCommit(userInput);
        setLogChat(prev => [...prev, { role: "ai", text: `Network dynamics recalculated. AI mapped ripple effects across ${result.data.length} node(s).` }]);
      } catch {
        setLogChat(prev => [...prev, { role: "ai", text: "Error logging event." }]);
      }
    } else {
      // Route specifically to the CONSULT chat array
      const currentHistory = [...consultChat]; // Capture the exact history before updating the UI
      
      setConsultChat(prev => [...prev, { role: "user", text: userInput }]);
      setConsultChat(prev => [...prev, { role: "ai", text: "Analyzing network variables..." }]);
      
      try {
        // Pass the captured history array to the backend
        const response = await getStrategicAdvice(userInput, currentHistory);
        
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
  };

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
        <div className="flex h-screen w-full bg-slate-950 text-slate-300 font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          
          {/* MAP CANVAS */}
          <div className="flex-1 relative border-r border-slate-800">
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <h1 className="text-2xl font-bold text-white tracking-widest drop-shadow-md">THE VAULT</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Machiavellian Protocol</p>
              <div className="space-y-2 bg-slate-950/60 p-3 rounded border border-slate-800/50 backdrop-blur-sm inline-block">
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-3 shadow-[0_0_8px_#ef4444]"></div><span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">High Threat</span></div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-orange-500 mr-3 shadow-[0_0_8px_#f97316]"></div><span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Warning</span></div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-indigo-500 mr-3 shadow-[0_0_8px_#4f46e5]"></div><span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Neutral</span></div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-[0_0_8px_#10b981]"></div><span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Secured</span></div>
              </div>
            </div>
            <div className="w-full h-full bg-slate-950">
              {graphData.nodes.length > 0 && (
                <NetworkGraph graphData={graphData} onNodeClick={handleNodeClick} />
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-[450px] bg-slate-900 flex flex-col shadow-2xl z-20">
            
            {/* HEADER */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
              <div className="flex items-center">
                {isAddingNode ? (
                  <h2 className="text-lg font-semibold text-white flex items-center"><UserPlus size={18} className="mr-2 text-indigo-400"/> Add Target</h2>
                ) : selectedNode ? (
                  <h2 className="text-lg font-semibold text-white flex items-center"><Activity size={18} className="mr-2 text-indigo-400"/> {selectedNode.name}</h2>
                ) : (
                  <h2 className="text-lg font-semibold text-white flex items-center"><Cpu size={18} className="mr-2 text-indigo-400"/> Command Center</h2>
                )}
              </div>
              <div className="flex space-x-2">
                 {!isAddingNode && !selectedNode && (
                   <button onClick={() => setIsAddingNode(true)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"><UserPlus size={16} /></button>
                 )}
                 {(isAddingNode || selectedNode) && (
                   <button onClick={() => { setIsAddingNode(false); setSelectedNode(null); }} className="p-2 bg-slate-800 hover:bg-red-900 text-slate-400 rounded transition-colors"><X size={16} /></button>
                 )}
              </div>
            </div>

            {/* STATE 3: ADD NODE */}
            {isAddingNode && (
              <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Target Name</label>
                  <input type="text" className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none focus:border-indigo-500" value={newNodeName} onChange={(e) => setNewNodeName(e.target.value)}/>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Base Value (1-10)</label>
                  <input type="number" className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none focus:border-indigo-500" value={newNodeVal} onChange={(e) => setNewNodeVal(parseInt(e.target.value))}/>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Genesis Archive (Backstory)</label>
                  <textarea 
                    className="w-full mt-1 h-32 bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-300 resize-none outline-none focus:border-indigo-500" 
                    placeholder="Detail past interactions, psychological traits, weaknesses, or historical context..."
                    value={newBackstory} 
                    onChange={(e) => setNewBackstory(e.target.value)}
                  />
                </div>
                <button onClick={handleAddNodeSubmit} disabled={isProcessing} className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm transition-colors">{isProcessing ? 'Initializing...' : 'Initialize Node'}</button>
              </div>
            )}

            {/* STATE 2: NODE INSPECTOR */}
            {!isAddingNode && selectedNode && (
              <div className="flex flex-col flex-1 overflow-hidden">
                
                {/* TABS */}
                <div className="flex border-b border-slate-800 bg-slate-950/30">
                  <button onClick={() => setActiveTab('log')} className={`flex-1 py-3 text-xs uppercase tracking-wider font-semibold transition-colors ${activeTab === 'log' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>Commit Log</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-xs uppercase tracking-wider font-semibold transition-colors ${activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>Timeline History</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {activeTab === 'log' ? (
                    <>
                      {lastExtraction && (
                        <div className="border border-indigo-900/50 bg-indigo-950/20 p-4 rounded animate-in fade-in zoom-in duration-200">
                          <h3 className="text-xs text-indigo-400 uppercase tracking-wider mb-3">Latest Network Shift</h3>
                          <p><span className="text-slate-500 text-sm">Mood:</span> <span className="text-white text-sm">{lastExtraction.mood}</span></p>
                          <p><span className="text-slate-500 text-sm">Leverage Delta:</span> <span className={`${lastExtraction.leverage_shift_score < 0 ? 'text-red-400' : 'text-green-400'} font-mono text-sm`}>{lastExtraction.leverage_shift_score}</span></p>
                          <p className="text-slate-300 mt-2 border-t border-slate-800 pt-2 text-sm">{lastExtraction.calculated_diff_summary}</p>
                        </div>
                      )}
                      <div className="text-sm text-slate-400 text-center mt-10">Use the terminal below to log an interaction. The Omni-Router will assess ripple effects across all targets.</div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      {nodeHistory.length === 0 ? <p className="text-sm text-slate-500 text-center">No telemetry recorded yet.</p> : 
                        nodeHistory.map((hist, i) => (
                          <div key={i} className="bg-slate-950 border border-slate-800 p-3 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs text-slate-500">{new Date(hist.created_at).toLocaleDateString()}</span>
                              <span className={`text-xs font-mono ${hist.calculated_diff < 0 ? 'text-red-400' : 'text-green-400'}`}>Shift: {hist.calculated_diff}</span>
                            </div>
                            <p className="text-sm text-slate-300">{hist.content_log}</p>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* PINNED BOTTOM INPUT (Only shows on Log Tab) */}
                {activeTab === 'log' && (
                  <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                    <textarea 
                      className="w-full h-24 bg-slate-900 border border-slate-700 rounded p-3 text-sm text-white resize-none outline-none focus:border-indigo-500 mb-3"
                      placeholder={`Detail interaction with ${selectedNode.name}...`}
                      value={nodeLogText}
                      onChange={(e) => setNodeLogText(e.target.value)}
                      disabled={isProcessing}
                    />
                    <button onClick={() => executeCommit(nodeLogText, selectedNode.name)} className="w-full py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-50 mb-2" disabled={isProcessing || !nodeLogText.trim()}>
                      {isProcessing ? 'Routing...' : <><ShieldAlert size={14} className="mr-2" /> Execute Protocol</>}
                    </button>
                    <button onClick={handleDeleteNode} disabled={isProcessing} className="w-full py-2 rounded text-xs border border-red-900/30 text-red-500 hover:bg-red-950/30 flex items-center justify-center">
                      <Trash2 size={12} className="mr-2" /> Terminate Record
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE 1: GLOBAL COMMAND CENTER */}
            {!isAddingNode && !selectedNode && (
              <div className="flex flex-col flex-1 overflow-hidden">
                
                {/* OMNI-TOGGLE */}
                <div className="flex border-b border-slate-800 bg-slate-950/30 p-2 space-x-2">
                  <button onClick={() => setAdvisorMode('consult')} className={`flex-1 py-2 text-xs uppercase tracking-wider font-semibold rounded transition-colors ${advisorMode === 'consult' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' : 'text-slate-500 hover:bg-slate-800'}`}>
                    <MessageSquare size={14} className="inline mr-2 mb-1"/> Strategic Consult
                  </button>
                  <button onClick={() => setAdvisorMode('log')} className={`flex-1 py-2 text-xs uppercase tracking-wider font-semibold rounded transition-colors ${advisorMode === 'log' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50' : 'text-slate-500 hover:bg-slate-800'}`}>
                    <ShieldAlert size={14} className="inline mr-2 mb-1"/> Global Log
                  </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                   {activeChat.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                       <Cpu size={48} className="opacity-20" />
                       <p className="text-sm text-center px-4">
                         {advisorMode === 'consult' ? "Query the matrix for synthesized strategy." : "Log a global event. The AI will map the ripple effects."}
                       </p>
                     </div>
                   ) : (
                     activeChat.map((msg, i) => (
                       <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[85%] p-3 rounded text-sm ${msg.role === 'user' ? (msg.text.includes('[SYSTEM LOG]') ? 'bg-emerald-900/50 text-emerald-100 border border-emerald-700' : 'bg-indigo-900 text-indigo-100') : 'bg-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed'}`}>
                           {msg.text}
                         </div>
                       </div>
                     ))
                   )}
                </div>
                
                <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                  <div className={`flex items-center bg-slate-900 border rounded overflow-hidden transition-colors ${advisorMode === 'log' ? 'border-emerald-700 focus-within:border-emerald-500' : 'border-slate-700 focus-within:border-indigo-500'}`}>
                    <input 
                      type="text" 
                      value={advisorInput}
                      onChange={(e) => setAdvisorInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdvisorSubmit()}
                      placeholder={advisorMode === 'consult' ? "Ask for strategy..." : "Describe the event..."} 
                      className="flex-1 bg-transparent p-3 text-sm text-white outline-none"
                      disabled={isProcessing}
                    />
                    <button onClick={handleAdvisorSubmit} disabled={isProcessing} className={`p-3 transition-colors ${advisorMode === 'log' ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-indigo-400'}`}>
                      {isProcessing ? <Activity size={18} className="animate-spin" /> : <Send size={18} />}
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