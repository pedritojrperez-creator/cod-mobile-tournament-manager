import React, { useState, useEffect } from 'react';
import { PageView, Player, ImageSize, Team } from './types';
import { Button } from './components/Button';
import { ChatBot } from './components/ChatBot';
import { generateAvatar, editPlayerImage, analyzePlayerImage, quickAnalyzeText } from './services/geminiService';

function App() {
  const [view, setView] = useState<PageView>(PageView.HOME);
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  // App Logo State
  const [appLogo, setAppLogo] = useState<string>('');

  // Form States
  const [regName, setRegName] = useState('');
  const [regUid, setRegUid] = useState('');
  const [regImage, setRegImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [genPrompt, setGenPrompt] = useState('');
  const [genSize, setGenSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  
  // Edit & Database State
  const [isDbOpen, setIsDbOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Score Management States
  const [scorePlayerId, setScorePlayerId] = useState<string>('');
  const [scorePoints, setScorePoints] = useState<string>('');
  const [scoreMode, setScoreMode] = useState<'add' | 'subtract'>('add');
  const [scoreSearch, setScoreSearch] = useState(''); // Search filter for ranking dropdown

  // Tournament States
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [bracketState, setBracketState] = useState<{
    semi1Winner: Team | null,
    semi2Winner: Team | null,
    champion: Team | null
  }>({ semi1Winner: null, semi2Winner: null, champion: null });
  const [selectedTeamInfo, setSelectedTeamInfo] = useState<Team | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('codm_players');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure 'active' property exists
      const migrated = parsed.map((p: any) => ({
        ...p,
        active: p.active !== undefined ? p.active : true
      }));
      setPlayers(migrated);
    }

    const savedLogo = localStorage.getItem('codm_app_logo');
    if (savedLogo) {
      setAppLogo(savedLogo);
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('codm_players', JSON.stringify(players));
  }, [players]);

  // Message Timer (5 seconds)
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000); // 5 seconds as requested
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleAppLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        try {
            localStorage.setItem('codm_app_logo', result);
            setAppLogo(result);
            setMessage({ text: "Logo updated successfully", type: 'success' });
        } catch (err) {
            setMessage({ text: "Image too large to save", type: 'error' });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regUid) {
      setMessage({ text: "Faltan datos (Name or UID)", type: 'error' });
      return;
    }

    // If we are NOT editing, check max limit
    if (!editingId && players.length >= 30) {
      setMessage({ text: "Tournament full (30/30)", type: 'error' });
      return;
    }

    setIsProcessing(true);
    
    // Logic for Update vs Create
    if (editingId) {
       // Update existing
       setPlayers(players.map(p => {
          if (p.id === editingId) {
             return {
                ...p,
                name: regName,
                uid: regUid,
                image: regImage || p.image // Keep old image if regImage is empty (though regImage usually populated on load)
             };
          }
          return p;
       }));
       setMessage({ text: "Jugador actualizado con éxito", type: 'success' });
       setEditingId(null);
    } else {
        // Create new
        // Quick AI check using Flash Lite
        const checkJson = await quickAnalyzeText(regName);
        const check = JSON.parse(checkJson);
        if (check.valid === false) {
           setMessage({ text: `Invalid Name: ${check.reason}`, type: 'error' });
           setIsProcessing(false);
           return;
        }

        const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

        const newPlayer: Player = {
          id: Date.now().toString(),
          name: regName,
          uid: regUid,
          image: regImage || defaultImage,
          score: 0,
          active: true
        };
        setPlayers([...players, newPlayer]);
        setMessage({ text: "Registro completado con éxito", type: 'success' });
    }

    setRegName('');
    setRegUid('');
    setRegImage('');
    setEditPrompt('');
    setGenPrompt('');
    setIsProcessing(false);
  };

  const loadForEdit = (player: Player) => {
     setRegName(player.name);
     setRegUid(player.uid);
     setRegImage(player.image);
     setEditingId(player.id);
     setIsDbOpen(false); // Close modal
     setMessage({ text: `Editando a: ${player.name}`, type: 'info' });
  };

  const cancelEdit = () => {
     setRegName('');
     setRegUid('');
     setRegImage('');
     setEditingId(null);
  };

  const handleRemove = (id: string) => {
    const playerToRemove = players.find(p => p.id === id);
    if (playerToRemove) {
      setPlayers(players.filter(p => p.id !== id));
      setMessage({ text: `Jugador ${playerToRemove.name} fue dado de baja`, type: 'success' });
      setView(PageView.HOME);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!regImage) return;
    setIsProcessing(true);
    const result = await analyzePlayerImage(regImage.split(',')[1]);
    alert(result); 
    setIsProcessing(false);
  };

  const handleGenerateAvatar = async () => {
    if (!genPrompt) return;
    setIsProcessing(true);
    try {
      const img = await generateAvatar(genPrompt, genSize);
      if (img) setRegImage(img);
    } catch (e) {
      setMessage({ text: "Generation failed", type: 'error' });
    }
    setIsProcessing(false);
  };

  const handleEditAvatar = async () => {
    if (!editPrompt || !regImage) return;
    setIsProcessing(true);
    try {
      const img = await editPlayerImage(regImage, editPrompt);
      if (img) setRegImage(img);
    } catch (e) {
      setMessage({ text: "Edit failed", type: 'error' });
    }
    setIsProcessing(false);
  };

  const handleUpdateScore = () => {
    if (!scorePlayerId || !scorePoints) return;
    const points = parseInt(scorePoints);
    if (isNaN(points)) return;

    setPlayers(players.map(p => {
      if (p.id === scorePlayerId) {
        const newScore = scoreMode === 'add' ? p.score + points : p.score - points;
        return { ...p, score: newScore };
      }
      return p;
    }));
    setScorePoints('');
    setMessage({ text: "Datos Cargados", type: 'success' });
  };

  // Tournament Logic
  const togglePlayerActive = (id: string) => {
    setPlayers(players.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleRandomTeams = () => {
    const activePlayers = players.filter(p => p.active);
    
    if (activePlayers.length > 20) {
      setMessage({ text: "Excede el número máximo de jugadores (Max 20)", type: 'error' });
      return;
    }
    if (activePlayers.length < 20) {
      setMessage({ text: `Insuficientes jugadores habilitados (${activePlayers.length}/20)`, type: 'error' });
      return;
    }

    // Shuffle
    const shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
    
    const newTeams: Team[] = [
      { id: 't1', name: 'Alpha Squad', color: 'bg-red-600', members: shuffled.slice(0, 5) },
      { id: 't2', name: 'Bravo Six', color: 'bg-green-600', members: shuffled.slice(5, 10) },
      { id: 't3', name: 'Delta Force', color: 'bg-yellow-500', members: shuffled.slice(10, 15) },
      { id: 't4', name: 'Omega Protocol', color: 'bg-blue-600', members: shuffled.slice(15, 20) },
    ];

    setTeams(newTeams);
    setBracketState({ semi1Winner: null, semi2Winner: null, champion: null });
    setMessage({ text: "Equipos generados aleatoriamente", type: 'success' });
  };

  const updateTeamName = (id: string, newName: string) => {
    setTeams(teams.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const advanceTeam = (team: Team, stage: 'semi1' | 'semi2' | 'final') => {
    if (stage === 'semi1') setBracketState(prev => ({ ...prev, semi1Winner: team }));
    if (stage === 'semi2') setBracketState(prev => ({ ...prev, semi2Winner: team }));
    if (stage === 'final') setBracketState(prev => ({ ...prev, champion: team }));
  };

  // Sort players for Ranking
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Filter for Dropdown
  const filteredForDropdown = sortedPlayers.filter(p => 
      p.name.toLowerCase().includes(scoreSearch.toLowerCase())
  );

  // -------------------------------- VIEWS --------------------------------

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8 animate-fade-in relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
         <div className="absolute top-10 left-10 w-64 h-64 bg-yellow-500 rounded-full blur-[100px]"></div>
         <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-900 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-4xl flex flex-col items-center mb-4 z-10">
        <div className="w-full flex justify-center mb-8 relative">
           {/* LOGO CONTAINER - Square, Centered, Uploadable */}
           <div className="relative group w-64 h-64 border-4 border-cod-gold rounded-xl overflow-hidden bg-black shadow-[0_0_30px_rgba(234,179,8,0.3)] flex items-center justify-center cursor-pointer hover:border-white transition-colors">
              
              <img 
                src={appLogo || "/wolf-x8.png"} 
                alt="App Logo" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'; // Hide if missing
                }}
              />
              
              {/* Fallback if no logo and no default */}
              {!appLogo && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-700 pointer-events-none z-0" style={{display: appLogo ? 'none' : 'flex'}}>
                     {/* Hidden by img if src valid, but fallback if needed */}
                  </div>
              )}

              {/* Upload Overlay */}
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-white font-bold text-sm uppercase tracking-widest">Upload Logo</span>
              </div>

              {/* Hidden File Input */}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAppLogoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                title="Click to upload logo"
              />
           </div>
        </div>
        
        <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter uppercase italic drop-shadow-[0_4px_4px_rgba(0,0,0,1)] text-center leading-none mt-4">
          Xfinity-<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Esports</span>
        </h1>
        <div className="h-1 w-32 bg-yellow-500 mt-6 rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl z-10 px-4">
        <Button onClick={() => setView(PageView.REGISTER)} className="h-32 text-2xl border-b-4 border-yellow-700">
          Registro
        </Button>
        <Button 
          onClick={() => setView(PageView.TOURNAMENT)} 
          variant="ghost" 
          className="h-32 text-2xl bg-teal-900/80 border-2 border-teal-500 text-teal-300 hover:bg-teal-800 hover:text-white shadow-[0_0_20px_rgba(45,212,191,0.2)] backdrop-blur-sm"
        >
          Torneo
        </Button>
        <Button onClick={() => setView(PageView.RANKING)} variant="secondary" className="h-32 text-2xl border-cod-gold text-cod-gold border-b-4 border-yellow-900">
          Ranking
        </Button>
        <Button onClick={() => setView(PageView.REMOVE)} variant="danger" className="h-32 text-2xl border-b-4 border-red-900">
          Baja
        </Button>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="min-h-screen p-4 md:p-10 flex flex-col items-center">
       <div className="w-full max-w-2xl bg-cod-panel border-l-4 border-cod-gold p-8 shadow-2xl relative">
          <Button onClick={() => setView(PageView.HOME)} variant="ghost" className="absolute top-4 right-4 text-xs">
             BACK TO HQ
          </Button>

          {/* Database Button */}
          <div className="absolute top-4 left-4">
             <button 
                onClick={() => setIsDbOpen(true)}
                className="flex items-center gap-2 text-cod-gold text-xs font-bold uppercase border border-cod-gold px-3 py-1 hover:bg-cod-gold hover:text-black transition-colors"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                Base de Datos
             </button>
          </div>

          <h2 className="text-3xl font-bold text-white mb-6 uppercase border-b border-gray-700 pb-2 mt-8 text-center">
            {editingId ? "Editar Jugador" : "REGISTRO NUEVO JUGADOR"}
          </h2>

          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
               <div className="w-40 h-40 bg-black border-2 border-cod-gray flex-shrink-0 relative overflow-hidden">
                  {regImage ? (
                    <img src={regImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-600 text-xs text-center p-2">
                       NO SIGNAL
                    </div>
                  )}
               </div>
               
               <div className="flex-1 space-y-3">
                  <label className="block text-cod-gold text-xs font-bold uppercase tracking-widest">Profile Image (Optional)</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-xs file:font-semibold file:bg-cod-gold file:text-black hover:file:bg-yellow-400"/>
                  
                  <div className="grid grid-cols-1 gap-2 p-3 bg-black/30 border border-gray-700 mt-2">
                     <p className="text-xs text-cod-gray uppercase font-bold mb-1">AI Tools</p>
                     
                     <div className="flex gap-2">
                        <input 
                           type="text" 
                           placeholder="Describe avatar..." 
                           value={genPrompt}
                           onChange={(e) => setGenPrompt(e.target.value)}
                           className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-white"
                        />
                         <select 
                           value={genSize} 
                           onChange={(e) => setGenSize(e.target.value as ImageSize)}
                           className="bg-gray-900 border border-gray-700 text-xs text-white"
                        >
                           <option value={ImageSize.SIZE_1K}>1K</option>
                           <option value={ImageSize.SIZE_2K}>2K</option>
                           <option value={ImageSize.SIZE_4K}>4K</option>
                        </select>
                        <button onClick={handleGenerateAvatar} disabled={isProcessing} className="bg-blue-600 px-2 py-1 text-xs uppercase font-bold text-white hover:bg-blue-500 disabled:opacity-50">Gen</button>
                     </div>

                     <div className="flex gap-2">
                        <input 
                           type="text" 
                           placeholder="Edit (e.g., 'add retro filter')..." 
                           value={editPrompt}
                           onChange={(e) => setEditPrompt(e.target.value)}
                           disabled={!regImage}
                           className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-white disabled:opacity-30"
                        />
                        <button onClick={handleEditAvatar} disabled={!regImage || isProcessing} className="bg-purple-600 px-2 py-1 text-xs uppercase font-bold text-white hover:bg-purple-500 disabled:opacity-50">Edit</button>
                     </div>

                      <button onClick={handleAnalyzeImage} disabled={!regImage || isProcessing} className="w-full bg-green-900/50 text-green-400 border border-green-800 py-1 text-xs uppercase tracking-widest hover:bg-green-900 disabled:opacity-30">
                        Scan/Analyze Image
                      </button>
                  </div>
               </div>
            </div>

            <div>
              <label className="block text-cod-gold text-xs font-bold uppercase tracking-widest mb-1">Operator Name *</label>
              <input 
                type="text" 
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full bg-black border-b-2 border-gray-600 focus:border-cod-gold px-4 py-3 text-white outline-none font-mono"
                placeholder="ENTER NAME"
              />
            </div>

            <div>
              <label className="block text-cod-gold text-xs font-bold uppercase tracking-widest mb-1">UID *</label>
              <input 
                type="text" 
                value={regUid}
                onChange={(e) => setRegUid(e.target.value)}
                className="w-full bg-black border-b-2 border-gray-600 focus:border-cod-gold px-4 py-3 text-white outline-none font-mono"
                placeholder="ENTER UID"
              />
            </div>

            <div className="flex gap-4">
               {editingId && (
                  <Button onClick={cancelEdit} variant="secondary" className="flex-1">
                     CANCEL EDIT
                  </Button>
               )}
               <Button onClick={handleRegister} className="flex-1" disabled={isProcessing}>
                  {isProcessing ? 'PROCESSING...' : editingId ? 'UPDATE PLAYER' : 'COMPLETE REGISTRATION'}
               </Button>
            </div>
          </div>
       </div>

       {/* Database Modal */}
       {isDbOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
             <div className="w-full max-w-4xl bg-cod-panel border border-cod-gold h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 bg-black border-b border-gray-800 flex justify-between items-center">
                   <h3 className="text-xl font-bold text-white uppercase">Player Database</h3>
                   <button onClick={() => setIsDbOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="text-gray-500 text-xs font-bold uppercase border-b border-gray-700">
                            <th className="p-2">Avatar</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">UID</th>
                            <th className="p-2">Score</th>
                            <th className="p-2">Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {players.map(player => (
                            <tr key={player.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                               <td className="p-2">
                                  <img src={player.image} alt="av" className="w-10 h-10 rounded-full object-cover bg-black" />
                               </td>
                               <td className="p-2 font-bold text-white">{player.name}</td>
                               <td className="p-2 text-gray-400 font-mono text-sm">{player.uid}</td>
                               <td className="p-2 text-cod-gold font-mono">{player.score}</td>
                               <td className="p-2">
                                  <button 
                                    onClick={() => loadForEdit(player)}
                                    className="p-2 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800 transition-colors"
                                    title="Edit Player"
                                  >
                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                     </svg>
                                  </button>
                               </td>
                            </tr>
                         ))}
                         {players.length === 0 && (
                            <tr>
                               <td colSpan={5} className="p-8 text-center text-gray-500">No players registered.</td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       )}
    </div>
  );

  const renderRemove = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-cod-panel border border-red-900 p-8 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
        <h2 className="text-3xl font-bold text-red-500 mb-6 uppercase tracking-widest text-center">
           Discharge Operator
        </h2>
        
        <div className="mb-8">
           <label className="block text-gray-500 text-xs font-bold uppercase mb-2">Select Player to Remove</label>
           <select 
             className="w-full bg-black border border-gray-700 text-white p-3 outline-none focus:border-red-500"
             onChange={(e) => setScorePlayerId(e.target.value)} 
           >
             <option value="">-- SELECT TARGET --</option>
             {players.map(p => (
               <option key={p.id} value={p.id}>{p.name} (UID: {p.uid})</option>
             ))}
           </select>
        </div>

        <div className="flex gap-4">
           <Button variant="secondary" onClick={() => setView(PageView.HOME)} fullWidth>Cancel</Button>
           <Button variant="danger" onClick={() => handleRemove(scorePlayerId)} fullWidth disabled={!scorePlayerId}>
              BAJA
           </Button>
        </div>
      </div>
    </div>
  );

  const renderRanking = () => {
    // Max score is 500
    const fixedMaxScore = 500;
    
    // Ensure we render at least 10 slots
    const rankingDisplay = [...sortedPlayers];
    const placeholdersNeeded = Math.max(0, 10 - rankingDisplay.length);
    const placeholders = Array(placeholdersNeeded).fill(null);

    return (
      <div className="min-h-screen p-2 md:p-8 flex flex-col items-center bg-black">
        <div className="w-full max-w-6xl flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
           <div className="flex items-center gap-4">
              <button onClick={() => setView(PageView.HOME)} className="text-cod-gold hover:text-white transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                 </svg>
              </button>
              <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">
                 Live <span className="text-cod-gold">Ranking</span>
              </h2>
           </div>
           
           <div className="flex gap-4 items-center">
             <Button onClick={() => setView(PageView.BRACKET)} className="text-sm px-4 py-2 bg-blue-900 border-blue-500 text-blue-200">
               VER FLUJO (BRACKET)
             </Button>
             <div className="hidden md:block text-xs text-gray-500 font-mono">
                Server Time: {new Date().toLocaleTimeString()}
             </div>
           </div>
        </div>

        <div className="w-full max-w-6xl bg-cod-panel/50 p-6 rounded-lg mb-8 border border-gray-800 min-h-[60vh]">
             <div className="space-y-4">
               {[...rankingDisplay, ...placeholders].map((player, index) => {
                 if (!player) {
                   // Placeholder Slot
                   return (
                     <div key={`placeholder-${index}`} className="flex items-center gap-4 opacity-30">
                        <div className="w-8 text-2xl font-black italic text-right text-gray-700">{index + 1}</div>
                        <div className="w-12 h-12 rounded-full border-2 border-gray-800 bg-black"></div>
                        <div className="flex-1 h-12 bg-gray-900/20 border border-gray-800"></div>
                        <div className="w-32 h-4 bg-gray-900/50"></div>
                     </div>
                   );
                 }

                 // Calculate width based on 500 max points
                 const widthPercentage = Math.min((player.score / fixedMaxScore) * 100, 100);
                 const rankColor = index === 0 ? 'text-cod-gold' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-700' : 'text-gray-500';
                 
                 return (
                   <div key={player.id} className="flex items-center gap-4 animate-slide-in">
                      <div className={`w-8 text-2xl font-black italic text-right ${rankColor}`}>
                        {index + 1}
                      </div>

                      <div className="w-12 h-12 rounded-full border-2 border-gray-700 overflow-hidden flex-shrink-0 relative bg-black">
                         <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 h-12 bg-gray-900/50 relative overflow-hidden clip-path-slant">
                         <div 
                           className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 flex items-center justify-end pr-10 transition-all duration-1000 ease-out"
                           style={{ width: `${Math.max(widthPercentage, 1)}%`, clipPath: "polygon(0 0, 100% 0, 95% 100%, 0% 100%)" }}
                         >
                            <span className="font-black text-3xl italic text-black font-mono tracking-wider drop-shadow-sm">{player.score}</span>
                         </div>
                      </div>
                      
                      <div className="w-32 text-sm font-bold text-white uppercase truncate">
                         {player.name}
                      </div>
                   </div>
                 );
               })}
             </div>
        </div>

        <div className="w-full max-w-4xl bg-cod-panel border-t-4 border-cod-gold p-6">
           <h3 className="text-xl font-bold text-white uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-cod-gold inline-block"></span>
              Registro de Puntos
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                 <label className="block text-xs text-gray-400 font-bold mb-1">FILTER NAME</label>
                 <input 
                   type="text" 
                   value={scoreSearch}
                   onChange={(e) => setScoreSearch(e.target.value)}
                   className="w-full bg-black border border-gray-600 text-white p-2 text-sm mb-2"
                   placeholder="Type to find..."
                 />
                 <label className="block text-xs text-gray-400 font-bold mb-1">SELECT PLAYER</label>
                 <select 
                   value={scorePlayerId}
                   onChange={(e) => setScorePlayerId(e.target.value)}
                   className="w-full bg-black border border-gray-600 text-white p-2 text-sm"
                   size={5} // Show a few items since we have filtering now
                 >
                    {filteredForDropdown.map(p => (
                       <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {filteredForDropdown.length === 0 && <option disabled>No matches</option>}
                 </select>
              </div>

              <div className="md:col-span-2 flex gap-2">
                 <div className="flex-1">
                    <label className={`block text-xs font-bold mb-1 cursor-pointer ${scoreMode === 'add' ? 'text-green-400' : 'text-gray-600'}`} onClick={() => setScoreMode('add')}>
                       SUMA (+)
                    </label>
                    <input 
                      type="number" 
                      placeholder="0"
                      disabled={scoreMode !== 'add'}
                      value={scoreMode === 'add' ? scorePoints : ''}
                      onChange={(e) => { setScorePoints(e.target.value); setScoreMode('add'); }}
                      className={`w-full bg-black border p-2 text-white font-mono ${scoreMode === 'add' ? 'border-green-500' : 'border-gray-800 opacity-50'}`}
                    />
                 </div>
                 <div className="flex-1">
                    <label className={`block text-xs font-bold mb-1 cursor-pointer ${scoreMode === 'subtract' ? 'text-red-400' : 'text-gray-600'}`} onClick={() => setScoreMode('subtract')}>
                       RESTA (-)
                    </label>
                    <input 
                      type="number" 
                      placeholder="0"
                      disabled={scoreMode !== 'subtract'}
                      value={scoreMode === 'subtract' ? scorePoints : ''}
                      onChange={(e) => { setScorePoints(e.target.value); setScoreMode('subtract'); }}
                      className={`w-full bg-black border p-2 text-white font-mono ${scoreMode === 'subtract' ? 'border-red-500' : 'border-gray-800 opacity-50'}`}
                    />
                 </div>
              </div>

              <div className="md:col-span-1">
                 <Button onClick={handleUpdateScore} fullWidth className="text-sm h-[42px]">
                    Cargar Datos
                 </Button>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderTournament = () => {
    const activeCount = players.filter(p => p.active).length;
    const totalCount = players.length;
    // Updated Filter Logic: Search by Name OR UID
    const filteredPlayers = players.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.uid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="min-h-screen p-4 bg-black flex flex-col items-center">
        <div className="w-full max-w-5xl mb-6 flex justify-between items-center border-b border-purple-800 pb-4">
          <Button variant="ghost" onClick={() => setView(PageView.HOME)}>← HOME</Button>
          <h2 className="text-3xl font-black text-white uppercase italic">
            Tournament <span className="text-purple-500">Setup</span>
          </h2>
          <div className="flex gap-8 text-right">
             <div>
                <div className="text-xs text-gray-400">TOTAL PLAYERS</div>
                <div className="text-3xl font-mono font-bold text-blue-400">
                    {totalCount}
                </div>
             </div>
             <div>
                <div className="text-xs text-gray-400">PLAYERS READY</div>
                <div className={`text-3xl font-mono font-bold ${activeCount === 20 ? 'text-green-500 animate-pulse' : activeCount > 20 ? 'text-red-500' : 'text-yellow-500'}`}>
                    {activeCount}/20
                </div>
             </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="md:col-span-2 flex gap-4">
              <input 
                type="text" 
                placeholder="BUSCAR JUGADOR (Nombre o UID)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-cod-panel border border-gray-700 p-3 text-white uppercase tracking-wider focus:border-purple-500 outline-none"
              />
           </div>
           <div>
              <Button onClick={handleRandomTeams} fullWidth className="h-full bg-purple-700 hover:bg-purple-600 border border-purple-500">
                 RANDOM TEAM
              </Button>
           </div>
        </div>

        {/* Player List */}
        <div className="w-full max-w-5xl bg-cod-panel border border-gray-800 rounded h-96 overflow-y-auto mb-8 custom-scrollbar">
           <table className="w-full text-left border-collapse">
              <thead className="bg-black sticky top-0 z-10">
                 <tr>
                    <th className="p-4 text-gray-500 text-xs font-bold uppercase">Status</th>
                    <th className="p-4 text-gray-500 text-xs font-bold uppercase">Avatar</th>
                    <th className="p-4 text-gray-500 text-xs font-bold uppercase">Name</th>
                    <th className="p-4 text-gray-500 text-xs font-bold uppercase">UID</th>
                 </tr>
              </thead>
              <tbody>
                 {filteredPlayers.map(player => (
                    <tr key={player.id} className={`border-b border-gray-800 transition-colors ${player.active ? 'bg-gray-900/50' : 'bg-black opacity-40 grayscale'}`}>
                       <td className="p-4">
                          <button 
                            onClick={() => togglePlayerActive(player.id)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${player.active ? 'bg-green-600' : 'bg-red-900'}`}
                          >
                             <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${player.active ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </button>
                       </td>
                       <td className="p-4">
                          <img src={player.image} alt="av" className="w-10 h-10 rounded-full border border-gray-600" />
                       </td>
                       <td className="p-4 font-bold text-white uppercase">{player.name}</td>
                       <td className="p-4 font-mono text-gray-400 text-sm">{player.uid}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Generated Teams Preview */}
        {teams.length > 0 && (
           <div className="w-full max-w-5xl animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-4 uppercase">Squad Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 {teams.map((team, idx) => (
                    <div key={team.id} className={`p-4 border-t-4 ${team.color.replace('bg-', 'border-')} bg-cod-panel`}>
                       <input 
                         value={team.name}
                         onChange={(e) => updateTeamName(team.id, e.target.value)}
                         className="bg-transparent text-white font-black uppercase text-lg w-full mb-2 outline-none border-b border-transparent focus:border-white"
                       />
                       <div className="space-y-1">
                          {team.members.map(m => (
                             <div key={m.id} className="text-xs text-gray-400 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${team.color}`}></span>
                                {m.name}
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
              <div className="mt-8 flex justify-center">
                 <Button onClick={() => setView(PageView.BRACKET)} className="w-64 py-4 text-xl">
                    FLUJO (BRACKET)
                 </Button>
              </div>
           </div>
        )}
      </div>
    );
  };

  const renderBracket = () => {
    // Helper for popup
    const showTeamInfo = (team: Team) => {
      setSelectedTeamInfo(team);
    };

    return (
      <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
        {/* Nav */}
        <div className="absolute top-4 left-4 z-20">
           <Button variant="secondary" onClick={() => setView(PageView.RANKING)}>← RANKING</Button>
        </div>

        {/* Info Modal */}
        {selectedTeamInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
             <div className={`p-6 bg-cod-panel border-2 ${selectedTeamInfo.color.replace('bg-', 'border-')} max-w-sm w-full shadow-2xl`}>
                <h3 className="text-2xl font-black text-white uppercase mb-4">{selectedTeamInfo.name}</h3>
                <div className="space-y-2 mb-6">
                   {selectedTeamInfo.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2 bg-black/50 rounded">
                         <img src={m.image} className="w-8 h-8 rounded-full" />
                         <span className="font-bold text-gray-300 uppercase">{m.name}</span>
                      </div>
                   ))}
                </div>
                <Button fullWidth onClick={() => setSelectedTeamInfo(null)}>CLOSE INFO</Button>
             </div>
          </div>
        )}

        {/* Bracket Layout */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-10 relative">
           
           {/* Connecting Lines (Simplified visual) */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
              <path d="M 20% 25% L 40% 25% L 40% 45% L 50% 45%" stroke="white" strokeWidth="2" fill="none" />
              <path d="M 20% 75% L 40% 75% L 40% 55% L 50% 55%" stroke="white" strokeWidth="2" fill="none" />
              <path d="M 80% 25% L 60% 25% L 60% 45% L 50% 45%" stroke="white" strokeWidth="2" fill="none" />
              <path d="M 80% 75% L 60% 75% L 60% 55% L 50% 55%" stroke="white" strokeWidth="2" fill="none" />
           </svg>

           {/* SEMIFINALS - LEFT & RIGHT */}
           {teams.length === 4 && (
             <>
               {/* Team 1 (Top Left) */}
               <div className="absolute top-10 left-4 md:left-20 w-48 md:w-64">
                  <div className={`p-4 ${teams[0].color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative group`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[0].name}</h4>
                     <button onClick={() => showTeamInfo(teams[0])} className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[0], 'semi1')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* Team 2 (Bottom Left) */}
               <div className="absolute bottom-10 left-4 md:left-20 w-48 md:w-64">
                  <div className={`p-4 ${teams[1].color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[1].name}</h4>
                     <button onClick={() => showTeamInfo(teams[1])} className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[1], 'semi1')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* Team 3 (Top Right) */}
               <div className="absolute top-10 right-4 md:right-20 w-48 md:w-64 text-right">
                  <div className={`p-4 ${teams[2].color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[2].name}</h4>
                     <button onClick={() => showTeamInfo(teams[2])} className="absolute top-2 left-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[2], 'semi2')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* Team 4 (Bottom Right) */}
               <div className="absolute bottom-10 right-4 md:right-20 w-48 md:w-64 text-right">
                  <div className={`p-4 ${teams[3].color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[3].name}</h4>
                     <button onClick={() => showTeamInfo(teams[3])} className="absolute top-2 left-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[3], 'semi2')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>
             </>
           )}

           {/* FINALISTS - CENTER */}
           <div className="flex gap-10 items-center">
              {/* Finalist 1 */}
              <div className="flex flex-col items-center gap-4">
                 <div className={`w-56 h-32 flex items-center justify-center border-4 ${bracketState.semi1Winner ? bracketState.semi1Winner.color.replace('bg-', 'border-') + ' bg-black' : 'border-gray-800 bg-gray-900'} relative`}>
                    {bracketState.semi1Winner ? (
                       <span className="text-2xl font-black uppercase text-center text-white">{bracketState.semi1Winner.name}</span>
                    ) : (
                       <span className="text-gray-600 font-mono">TBD</span>
                    )}
                 </div>
                 {bracketState.semi1Winner && (
                    <Button onClick={() => advanceTeam(bracketState.semi1Winner!, 'final')} className="text-xs py-1 px-4">WIN FINAL</Button>
                 )}
              </div>

              <div className="text-cod-gold text-4xl font-black italic">VS</div>

              {/* Finalist 2 */}
              <div className="flex flex-col items-center gap-4">
                 <div className={`w-56 h-32 flex items-center justify-center border-4 ${bracketState.semi2Winner ? bracketState.semi2Winner.color.replace('bg-', 'border-') + ' bg-black' : 'border-gray-800 bg-gray-900'} relative`}>
                    {bracketState.semi2Winner ? (
                       <span className="text-2xl font-black uppercase text-center text-white">{bracketState.semi2Winner.name}</span>
                    ) : (
                       <span className="text-gray-600 font-mono">TBD</span>
                    )}
                 </div>
                 {bracketState.semi2Winner && (
                    <Button onClick={() => advanceTeam(bracketState.semi2Winner!, 'final')} className="text-xs py-1 px-4">WIN FINAL</Button>
                 )}
              </div>
           </div>

           {/* CHAMPION */}
           {bracketState.champion && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 animate-bounce-in">
                 <div className="bg-gradient-to-b from-yellow-300 to-yellow-600 p-8 rounded-xl shadow-[0_0_50px_rgba(255,215,0,0.8)] border-4 border-white text-center">
                    <h2 className="text-2xl font-bold text-black uppercase mb-2">TOURNAMENT CHAMPION</h2>
                    <h1 className="text-5xl font-black text-black uppercase">{bracketState.champion.name}</h1>
                 </div>
              </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-yellow-500 selection:text-black">
      {/* Global Message Toast */}
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded shadow-lg font-bold border-2 animate-bounce-in
           ${message.type === 'success' ? 'bg-green-900 border-green-500 text-white' : 
             message.type === 'error' ? 'bg-red-900 border-red-500 text-white' : 'bg-blue-900 border-blue-500'}`}>
           {message.text}
           <button onClick={() => setMessage(null)} className="ml-4 text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {view === PageView.HOME && renderHome()}
      {view === PageView.REGISTER && renderRegister()}
      {view === PageView.REMOVE && renderRemove()}
      {view === PageView.RANKING && renderRanking()}
      {view === PageView.TOURNAMENT && renderTournament()}
      {view === PageView.BRACKET && renderBracket()}

      <ChatBot />
    </div>
  );
}

export default App;