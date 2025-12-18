import React, { useState, useEffect } from 'react';
import { PageView, Player, ImageSize, Team, VsMatch, ScannedMatchData, RankingHistoryEntry } from './types';
import { Button } from './components/Button';
import { generateAvatar, editPlayerImage, analyzePlayerImage, quickAnalyzeText, analyzeMatchScreenshot } from './services/geminiService';

// Added helper function to generate balanced tournament brackets
const generateBalancedBracket = (players: Player[]): VsMatch[][] | null => {
  if (players.length < 2) return null;

  const shuffled = [...players].sort(() => 0.5 - Math.random());
  const numPlayers = shuffled.length;
  // Calculate power of 2 for the bracket size
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  const rounds = Math.log2(bracketSize);

  const bracket: VsMatch[][] = [];

  // Initialize all rounds with placeholders
  for (let r = 0; r < rounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1);
    const roundMatches: VsMatch[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        id: `r${r}-m${m}`,
        roundIndex: r,
        matchIndex: m,
        p1: null,
        p2: null,
        winner: null,
      });
    }
    bracket.push(roundMatches);
  }

  // Populate first round with players and handle byes
  const firstRound = bracket[0];
  let playerIdx = 0;
  for (let i = 0; i < firstRound.length; i++) {
    firstRound[i].p1 = shuffled[playerIdx++] || null;
    firstRound[i].p2 = shuffled[playerIdx++] || null;

    // Auto-advance if it's a bye (p2 is null)
    if (firstRound[i].p1 && !firstRound[i].p2) {
      const winner = firstRound[i].p1!;
      firstRound[i].winner = winner;
      const nextRoundIdx = 1;
      if (nextRoundIdx < bracket.length) {
        const nextMatchIdx = Math.floor(i / 2);
        if (i % 2 === 0) bracket[nextRoundIdx][nextMatchIdx].p1 = winner;
        else bracket[nextRoundIdx][nextMatchIdx].p2 = winner;
      }
    }
  }

  return bracket;
};

function App() {
  const [view, setView] = useState<PageView>(PageView.HOME);
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appLogo, setAppLogo] = useState<string>('');

  // Player Details Modal State
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState<Player | null>(null);

  // Gallery / Image Deposit State
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [matchGalleries, setMatchGalleries] = useState<Record<string, string[]>>({});

  // Form States (Main DB)
  const [regName, setRegName] = useState('');
  const [regUid, setRegUid] = useState('');
  const [regImage, setRegImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [genPrompt, setGenPrompt] = useState('');
  const [genSize, setGenSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  
  // VS Mode States
  const [randomPlayers, setRandomPlayers] = useState<Player[]>([]);
  const [rndName, setRndName] = useState('');
  const [isDbOpen, setIsDbOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Score Management
  const [scorePlayerId, setScorePlayerId] = useState<string>('');
  const [scorePoints, setScorePoints] = useState<string>('');
  const [scoreMode, setScoreMode] = useState<'add' | 'subtract'>('add');
  const [scoreSearch, setScoreSearch] = useState(''); 

  // Scanner States (Kept in state but UI removed as per request)
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedMatchData[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const [rankingHistory, setRankingHistory] = useState<RankingHistoryEntry[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<RankingHistoryEntry | null>(null);

  // Tournament States
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentMode, setTournamentMode] = useState<'STANDARD' | 'DUEL' | 'VS' | 'VS_RANDOM'>('STANDARD');
  const [bracketState, setBracketState] = useState<{
    semi1Winner: Team | null,
    semi2Winner: Team | null,
    champion: Team | null
  }>({ semi1Winner: null, semi2Winner: null, champion: null });

  const [bo3State, setBo3State] = useState<{
    match1Winner: string | null,
    match2Winner: string | null,
    match3Winner: string | null
  }>({ match1Winner: null, match2Winner: null, match3Winner: null });

  const [vsMatches, setVsMatches] = useState<VsMatch[][]>([]);
  const [rndVsMatches, setRndVsMatches] = useState<VsMatch[][]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('codm_players');
    if (saved) setPlayers(JSON.parse(saved));
    const savedRandom = localStorage.getItem('codm_random_players');
    if (savedRandom) setRandomPlayers(JSON.parse(savedRandom));
    const savedLogo = localStorage.getItem('codm_app_logo');
    if (savedLogo) setAppLogo(savedLogo);
    const savedHistory = localStorage.getItem('codm_ranking_history');
    if (savedHistory) setRankingHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => { localStorage.setItem('codm_players', JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem('codm_random_players', JSON.stringify(randomPlayers)); }, [randomPlayers]);
  useEffect(() => { localStorage.setItem('codm_ranking_history', JSON.stringify(rankingHistory)); }, [rankingHistory]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
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
        } catch (err: any) { setErrorMessage("Image too large to save"); }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!regName || !regUid) { setMessage({ text: "Faltan datos", type: 'error' }); return; }
    setIsProcessing(true);
    try {
        if (editingId) {
           setPlayers(players.map(p => p.id === editingId ? { ...p, name: regName, uid: regUid, image: regImage || p.image } : p));
           setEditingId(null);
        } else {
            const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
            const newPlayer: Player = { id: Date.now().toString(), name: regName, uid: regUid, image: regImage || defaultImage, score: 0, active: true };
            setPlayers([...players, newPlayer]);
        }
        setRegName(''); setRegUid(''); setRegImage('');
    } catch (err: any) { setErrorMessage(String(err)); } finally { setIsProcessing(false); }
  };

  const loadForEdit = (player: Player) => {
     setRegName(player.name); setRegUid(player.uid); setRegImage(player.image);
     setEditingId(player.id); setIsDbOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setRegImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryUpload = (matchKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMatchGalleries(prev => ({
          ...prev,
          [matchKey]: [...(prev[matchKey] || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!genPrompt) return;
    setIsProcessing(true);
    try {
      const img = await generateAvatar(genPrompt, genSize);
      if (img) setRegImage(img);
    } catch (e: any) { setErrorMessage(String(e)); } finally { setIsProcessing(false); }
  };

  const handleUpdateScore = () => {
    if (!scorePlayerId || !scorePoints) return;
    const points = parseInt(scorePoints);
    setPlayers(players.map(p => p.id === scorePlayerId ? { ...p, score: scoreMode === 'add' ? p.score + points : p.score - points } : p));
    setScorePoints('');
  };

  const togglePlayerActive = (id: string) => {
    setPlayers(players.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleRandomTeams = (): boolean => {
    setErrorMessage(null);
    const activePlayers = players.filter(p => p.active);

    if (tournamentMode === 'VS') {
        const bracket = generateBalancedBracket(activePlayers);
        if (!bracket) { setErrorMessage("Mínimo 2 jugadores."); return false; }
        setVsMatches(bracket); 
        setTeams([ { id: 'dummy', name: 'VS Tournament', members: activePlayers, color: '' } ]); 
        return true;
    }
    if (tournamentMode === 'VS_RANDOM') {
        if (randomPlayers.length < 2) { setErrorMessage("Agrega al menos 2 nombres."); return false; }
        const bracket = generateBalancedBracket(randomPlayers);
        if (!bracket) return false;
        setRndVsMatches(bracket); 
        setTeams([ { id: 'dummy_rnd', name: 'Random VS', members: randomPlayers, color: '' } ]); 
        return true;
    }

    const required = tournamentMode === 'STANDARD' ? 20 : 10;
    if (activePlayers.length !== required) { 
        setErrorMessage(`Error: Se requieren exactamente ${required} jugadores activos. Tienes ${activePlayers.length}.`); 
        return false; 
    }

    const shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
    setBracketState({ semi1Winner: null, semi2Winner: null, champion: null });
    setBo3State({ match1Winner: null, match2Winner: null, match3Winner: null });
    setMatchGalleries({});

    if (tournamentMode === 'STANDARD') {
        setTeams([
          { id: 't1', name: 'Alpha Squad', color: 'bg-red-600', members: shuffled.slice(0, 5) },
          { id: 't2', name: 'Bravo Six', color: 'bg-green-600', members: shuffled.slice(5, 10) },
          { id: 't3', name: 'Delta Force', color: 'bg-yellow-500', members: shuffled.slice(10, 15) },
          { id: 't4', name: 'Omega Protocol', color: 'bg-blue-600', members: shuffled.slice(15, 20) },
        ]);
    } else {
        setTeams([
            { id: 't1', name: 'Team Alpha', color: 'bg-red-600', members: shuffled.slice(0, 5) },
            { id: 't2', name: 'Team Bravo', color: 'bg-blue-600', members: shuffled.slice(5, 10) },
        ]);
    }
    return true;
  };

  const advanceTeam = (team: Team, stage: 'semi1' | 'semi2' | 'final') => {
    if (stage === 'semi1') setBracketState(prev => ({ ...prev, semi1Winner: team }));
    if (stage === 'semi2') setBracketState(prev => ({ ...prev, semi2Winner: team }));
    if (stage === 'final') setBracketState(prev => ({ ...prev, champion: team }));
  };

  const handleBo3Win = (matchKey: 'match1Winner' | 'match2Winner' | 'match3Winner', teamId: string) => {
    setBo3State(prev => ({ ...prev, [matchKey]: teamId }));
  };

  const advanceVsMatch = (roundIndex: number, matchIndex: number, winner: Player, isRandom: boolean) => {
     const current = isRandom ? [...rndVsMatches] : [...vsMatches];
     current[roundIndex][matchIndex].winner = winner;
     const nextRound = roundIndex + 1;
     if (nextRound < current.length) {
         const nextMatchIndex = Math.floor(matchIndex / 2);
         const isP1 = matchIndex % 2 === 0;
         if (isP1) current[nextRound][nextMatchIndex].p1 = winner;
         else current[nextRound][nextMatchIndex].p2 = winner;
     }
     if (isRandom) setRndVsMatches(current); else setVsMatches(current);
  };

  const handleResetBracket = () => {
    if (tournamentMode === 'STANDARD') setBracketState({ semi1Winner: null, semi2Winner: null, champion: null });
    else if (tournamentMode === 'DUEL') setBo3State({ match1Winner: null, match2Winner: null, match3Winner: null });
    else if (tournamentMode === 'VS') setVsMatches(prev => prev.map(r => r.map(m => ({ ...m, winner: null }))));
    else if (tournamentMode === 'VS_RANDOM') setRndVsMatches(prev => prev.map(r => r.map(m => ({ ...m, winner: null }))));
  };

  const sortedPlayers = players.filter(p => p.active).sort((a, b) => b.score - a.score);

  const renderPlayerDetails = () => selectedPlayerInfo && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-fade-in">
      <div className="bg-cod-panel border-t-4 border-cod-gold p-8 w-full max-w-sm relative shadow-2xl">
        <button onClick={() => setSelectedPlayerInfo(null)} className="absolute top-2 right-2 text-gray-400 text-2xl font-mono hover:text-white">X</button>
        <div className="flex flex-col items-center">
            <img src={selectedPlayerInfo.image} className="w-32 h-32 rounded-full border-4 border-cod-gold mb-4 bg-black object-cover shadow-[0_0_20px_rgba(234,179,8,0.3)]" alt=""/>
            <h3 className="text-3xl font-black italic uppercase text-white mb-2 tracking-wide">{selectedPlayerInfo.name}</h3>
            <div className="text-cod-gold font-mono mb-4 text-sm bg-black/40 px-2 py-1 rounded border border-gray-800">UID: {selectedPlayerInfo.uid}</div>
            <div className="w-full bg-gradient-to-r from-gray-900 to-black border border-gray-700 p-4 text-center">
               <span className="block text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Total Score</span>
               <span className="text-5xl font-black text-white italic drop-shadow-md">{selectedPlayerInfo.score}</span>
            </div>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.15),transparent_70%)]"></div>
      <div className="z-10 text-center">
        <div className="w-full flex justify-center mb-8">
           <div className="relative group w-64 h-64 border-4 border-cod-gold rounded-xl overflow-hidden bg-black shadow-[0_0_40px_rgba(234,179,8,0.3)] flex items-center justify-center cursor-pointer transition-all hover:shadow-[0_0_60px_rgba(234,179,8,0.5)]">
              <img src={appLogo || "/wolf-x8.png"} alt="App Logo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-cod-gold font-bold uppercase tracking-widest text-sm border border-cod-gold px-3 py-1">Change Logo</span>
              </div>
              <input type="file" accept="image/*" onChange={handleAppLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
           </div>
        </div>
        <h1 className="text-6xl md:text-8xl font-black italic uppercase text-white tracking-tighter mb-12 drop-shadow-2xl">Xfinity-<span className="text-cod-gold">Esports</span></h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl z-10 px-4">
          <Button onClick={() => setView(PageView.REGISTER)} className="h-32 text-2xl border-b-4 border-yellow-700 bg-gradient-to-br from-yellow-600 to-yellow-800 text-black hover:from-yellow-500 hover:to-yellow-700">Registro</Button>
          <Button onClick={() => setView(PageView.TOURNAMENT)} variant="ghost" className="h-32 text-2xl bg-teal-900/40 border-2 border-teal-500 text-teal-300 hover:bg-teal-900/60 shadow-[0_0_20px_rgba(45,212,191,0.2)]">Torneo</Button>
          <Button onClick={() => setView(PageView.RANKING)} variant="secondary" className="h-32 text-2xl border-cod-gold text-cod-gold border-b-4 border-yellow-900 bg-gray-900 hover:bg-gray-800">Ranking</Button>
          <Button onClick={() => setView(PageView.REMOVE)} variant="danger" className="h-32 text-2xl border-b-4 border-red-900 bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800">Baja</Button>
        </div>
      </div>
    </div>
  );

  const renderTournament = () => {
     const activeCount = players.filter(p => p.active).length;
     let requiredCount = 0;
     if (tournamentMode === 'STANDARD') requiredCount = 20;
     else if (tournamentMode === 'DUEL') requiredCount = 10;
     const isReady = (tournamentMode === 'STANDARD' || tournamentMode === 'DUEL') ? activeCount === requiredCount : true;
     const counterColor = activeCount === requiredCount ? 'text-green-500' : 'text-red-500';

     return (
        <div className="min-h-screen p-8 bg-black flex flex-col items-center">
           <div className="w-full max-w-4xl bg-cod-panel border-t-4 border-teal-500 p-8 shadow-2xl relative">
              <div className="flex justify-between items-center mb-6 border-b border-teal-900 pb-4">
                  <h2 className="text-3xl font-black text-teal-400 uppercase tracking-widest italic">Tournament Setup</h2>
                  <Button variant="ghost" onClick={() => setView(PageView.HOME)}>EXIT</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <label className="block text-teal-500 text-xs font-bold uppercase mb-2">Select Mode</label>
                    {['STANDARD', 'DUEL', 'VS', 'VS_RANDOM'].map(m => (
                        <div key={m} onClick={() => setTournamentMode(m as any)} className={`p-4 border cursor-pointer font-bold transition-all ${tournamentMode === m ? 'bg-teal-900/50 border-teal-400 text-white shadow-[0_0_15px_rgba(45,212,191,0.3)] translate-x-2' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}>
                            {m === 'STANDARD' ? 'STANDARD SQUAD (20P)' : m === 'DUEL' ? 'DUEL (10P) - Bo3' : m === 'VS' ? '1v1 RANKED (MAIN DB)' : '1v1 QUICK PLAY (RANDOM)'}
                        </div>
                    ))}
                    {(tournamentMode === 'STANDARD' || tournamentMode === 'DUEL') && (
                        <div className="bg-black border border-gray-800 p-6 mt-4 text-center rounded-lg shadow-inner">
                           <div className="text-xs text-gray-500 uppercase font-bold mb-2">Active Players Required</div>
                           <div className="text-4xl font-black font-mono">
                              <span className={counterColor}>{activeCount}</span> <span className="text-gray-700 text-2xl align-top">/ {requiredCount}</span>
                           </div>
                        </div>
                    )}
                 </div>
                 <div className="bg-black/40 p-4 border border-gray-800 h-96 overflow-y-auto custom-scrollbar relative">
                    <div className="sticky top-0 bg-black/90 border-b border-gray-700 p-2 mb-2 flex justify-between items-center z-10">
                        <span className="text-xs text-gray-400 font-bold uppercase">Roster</span>
                        <span className="text-xs text-cod-gold font-bold">{players.length} Total</span>
                    </div>
                    {tournamentMode === 'VS_RANDOM' ? (
                       <div className="space-y-4">
                          <div className="flex gap-2"><input type="text" value={rndName} onChange={(e) => setRndName(e.target.value)} className="flex-1 bg-black border border-gray-700 p-2 text-white" placeholder="Add Name..."/><Button onClick={() => { if(rndName) { setRandomPlayers([...randomPlayers, { id: Date.now().toString(), name: rndName, uid: 'N/A', image: '/wolf-x8.png', score: 0, active: true }]); setRndName(''); } }} className="px-4 py-2">+</Button></div>
                          {randomPlayers.map(p => <div key={p.id} className="flex justify-between border-b border-gray-800 py-2 text-sm"><span>{p.name}</span><button onClick={() => setRandomPlayers(randomPlayers.filter(x => x.id !== p.id))} className="text-red-500 font-bold hover:text-red-400">REMOVE</button></div>)}
                       </div>
                    ) : players.map(p => (
                      <div key={p.id} className={`flex justify-between items-center py-2 border-b border-gray-800 transition-colors ${p.active ? 'bg-green-900/10' : ''}`}>
                        <span className={`text-sm font-bold ${p.active ? 'text-white' : 'text-gray-500'}`}>{p.name}</span>
                        <button onClick={() => togglePlayerActive(p.id)} className={`text-[10px] px-2 py-1 border font-bold uppercase w-16 text-center transition-all ${p.active ? 'bg-green-900/30 border-green-600 text-green-400 hover:bg-green-900/50' : 'bg-red-900/30 border-red-600 text-red-400 hover:bg-red-900/50'}`}>{p.active ? 'Active' : 'Bench'}</button>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="mt-8 pt-6 border-t border-teal-900">
                  <Button onClick={() => { if (handleRandomTeams()) setView(PageView.BRACKET); }} fullWidth className={`transition-all ${isReady ? 'bg-teal-600 hover:bg-teal-500 text-black shadow-[0_0_20px_rgba(45,212,191,0.4)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>INITIALIZE BRACKET SYSTEM</Button>
              </div>
           </div>
        </div>
     );
  };

  const renderBracket = () => {
    const isVS = tournamentMode === 'VS' || tournamentMode === 'VS_RANDOM';
    const currentMatches = tournamentMode === 'VS_RANDOM' ? rndVsMatches : vsMatches;
    
    return (
        <div className="min-h-screen p-4 md:p-8 bg-black overflow-x-auto">
            <div className="w-full max-w-7xl mx-auto flex justify-between items-center mb-12 sticky left-0 z-50 bg-black/80 backdrop-blur-md p-4 rounded-xl border-b border-white/10 shadow-lg">
                <h2 className="text-3xl font-black italic text-white uppercase italic tracking-tighter shadow-black drop-shadow-lg">{tournamentMode.replace('_',' ')} <span className="text-cod-gold">TOURNAMENT</span></h2>
                <div className="flex gap-4">
                    <Button variant="secondary" onClick={() => setIsGalleryOpen(true)} className="text-xs bg-teal-900 border-teal-600 text-teal-300">Depósito Fotos</Button>
                    <Button onClick={() => setView(PageView.RANKING)} className="text-xs bg-blue-900 border-blue-500 text-blue-100">Ir a Ranking</Button>
                    <Button variant="ghost" onClick={handleResetBracket} className="text-xs">Reset</Button>
                    <Button onClick={() => setView(PageView.TOURNAMENT)} className="text-xs bg-gray-800 text-white">Back</Button>
                </div>
            </div>

            {isVS ? (
                <div className="flex gap-24 p-10 min-w-max pb-20">
                   {currentMatches.map((round, rIdx) =>