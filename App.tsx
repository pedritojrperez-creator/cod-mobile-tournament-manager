import React, { useState, useEffect } from 'react';
import { PageView, Player, ImageSize, Team, VsMatch, ScannedMatchData, RankingHistoryEntry } from './types';
import { Button } from './components/Button';
import { generateAvatar, editPlayerImage, analyzePlayerImage, quickAnalyzeText, analyzeMatchScreenshot } from './services/geminiService';

function App() {
  const [view, setView] = useState<PageView>(PageView.HOME);
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  // App Logo State
  const [appLogo, setAppLogo] = useState<string>('');

  // Form States (Main DB)
  const [regName, setRegName] = useState('');
  const [regUid, setRegUid] = useState('');
  const [regImage, setRegImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [genPrompt, setGenPrompt] = useState('');
  const [genSize, setGenSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  
  // Independent VS Random Players State
  const [randomPlayers, setRandomPlayers] = useState<Player[]>([]);
  const [rndName, setRndName] = useState('');
  
  // Edit & Database State
  const [isDbOpen, setIsDbOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Score Management States
  const [scorePlayerId, setScorePlayerId] = useState<string>('');
  const [scorePoints, setScorePoints] = useState<string>('');
  const [scoreMode, setScoreMode] = useState<'add' | 'subtract'>('add');
  const [scoreSearch, setScoreSearch] = useState(''); // Search filter for ranking dropdown

  // --- AI SCANNER STATES ---
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedMatchData[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // Quick Register State for AI Scanner
  const [quickReg, setQuickReg] = useState<{ isOpen: boolean, tempId: string, name: string, uid: string } | null>(null);

  // --- HISTORY & SEASON STATES ---
  const [rankingHistory, setRankingHistory] = useState<RankingHistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<RankingHistoryEntry | null>(null);


  // Tournament States
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentMode, setTournamentMode] = useState<'STANDARD' | 'DUEL' | 'VS' | 'VS_RANDOM'>('STANDARD');
  
  // STANDARD (Team 20P) State
  const [bracketState, setBracketState] = useState<{
    semi1Winner: Team | null,
    semi2Winner: Team | null,
    champion: Team | null
  }>({ semi1Winner: null, semi2Winner: null, champion: null });

  // DUEL (Team 10P / Bo3) State
  const [bo3State, setBo3State] = useState<{
    match1Winner: string | null,
    match2Winner: string | null,
    match3Winner: string | null
  }>({ match1Winner: null, match2Winner: null, match3Winner: null });

  // VS (1v1 Dynamic Main DB) State
  const [vsMatches, setVsMatches] = useState<VsMatch[][]>([]);
  const [vsPlayInInfo, setVsPlayInInfo] = useState<{
    active: boolean;
    directCount: number;
    adjustmentMatches: number;
  }>({ active: false, directCount: 0, adjustmentMatches: 0 });

  // VS RANDOM (1v1 Dynamic Independent) State
  const [rndVsMatches, setRndVsMatches] = useState<VsMatch[][]>([]);
  const [rndVsPlayInInfo, setRndVsPlayInInfo] = useState<{
    active: boolean;
    directCount: number;
    adjustmentMatches: number;
  }>({ active: false, directCount: 0, adjustmentMatches: 0 });


  const [selectedTeamInfo, setSelectedTeamInfo] = useState<Team | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('codm_players');
    if (saved) {
      const parsed = JSON.parse(saved);
      const migrated = parsed.map((p: any) => ({
        ...p,
        active: p.active !== undefined ? p.active : true
      }));
      setPlayers(migrated);
    }

    const savedRandom = localStorage.getItem('codm_random_players');
    if (savedRandom) {
      setRandomPlayers(JSON.parse(savedRandom));
    }

    const savedLogo = localStorage.getItem('codm_app_logo');
    if (savedLogo) {
      setAppLogo(savedLogo);
    }

    const savedHistory = localStorage.getItem('codm_ranking_history');
    if (savedHistory) {
        setRankingHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('codm_players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('codm_random_players', JSON.stringify(randomPlayers));
  }, [randomPlayers]);

  useEffect(() => {
    localStorage.setItem('codm_ranking_history', JSON.stringify(rankingHistory));
  }, [rankingHistory]);

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

    // UPDATED LIMIT: 60 PLAYERS
    if (!editingId && players.length >= 60) {
      setMessage({ text: "Tournament full (60/60)", type: 'error' });
      return;
    }

    setIsProcessing(true);
    
    if (editingId) {
       // Update existing
       setPlayers(players.map(p => {
          if (p.id === editingId) {
             return {
                ...p,
                name: regName,
                uid: regUid,
                image: regImage || p.image 
             };
          }
          return p;
       }));
       setMessage({ text: "Jugador actualizado con éxito", type: 'success' });
       setEditingId(null);
    } else {
        // Create new
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

  // --- INDEPENDENT REGISTRATION FOR VS RANDOM ---
  const handleAddRandomPlayer = () => {
      if(!rndName.trim()) {
          setMessage({ text: "Ingresa un nombre para el jugador", type: 'error' });
          return;
      }
      
      const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234ADE80' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

      const newP: Player = {
          id: `rnd-${Date.now()}`,
          name: rndName,
          uid: 'N/A',
          image: defaultImage,
          score: 0,
          active: true
      };
      setRandomPlayers([...randomPlayers, newP]);
      setRndName('');
      setMessage({ text: `Jugador ${newP.name} agregado a lista independiente.`, type: 'success' });
  };

  const handleRemoveRandomPlayer = (id: string) => {
      setRandomPlayers(randomPlayers.filter(p => p.id !== id));
  };
  // ---------------------------------------------

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
      setScorePlayerId('');
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
    if (!scorePlayerId || !scorePoints) {
       setMessage({ text: "Selecciona un jugador y puntos", type: 'error' });
       return;
    }
    const points = parseInt(scorePoints);
    if (isNaN(points)) return;

    let playerName = '';
    let oldScore = 0;
    let newScore = 0;

    setPlayers(players.map(p => {
      if (p.id === scorePlayerId) {
        playerName = p.name;
        oldScore = p.score;
        newScore = scoreMode === 'add' ? p.score + points : p.score - points;
        return { ...p, score: newScore };
      }
      return p;
    }));
    setScorePoints('');
    setMessage({ text: `${playerName}: ${oldScore} -> ${newScore} Pts`, type: 'success' });
  };

  // --- HISTORY & RESET LOGIC ---
  const handleArchiveSeason = () => {
      if (players.length === 0) {
          setMessage({ text: "No players to archive.", type: 'error' });
          return;
      }
      const now = new Date();
      const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const label = `Week Ranking - ${dateStr}`;

      if (!window.confirm(`¿Archivar el ranking actual como "${label}"?`)) return;

      const newEntry: RankingHistoryEntry = {
          id: Date.now().toString(),
          date: dateStr,
          label: label,
          snapshot: [...players] // Clone current state
      };

      setRankingHistory([newEntry, ...rankingHistory]);
      setMessage({ text: "Ranking semanal archivado exitosamente.", type: 'success' });
  };

  const handleResetSeason = () => {
      if (!window.confirm("estas seguro qeu deseas borar el puntaje de todos los jugadores")) {
          return;
      }
      
      setPlayers(prev => prev.map(p => ({
          ...p,
          score: 0
      })));
      setMessage({ text: "Temporada reiniciada. Todos los puntajes están en 0.", type: 'info' });
  };

  const handleDeleteHistoryItem = (id: string) => {
      if(!window.confirm("¿Eliminar este registro del historial?")) return;
      setRankingHistory(rankingHistory.filter(h => h.id !== id));
      if (selectedHistoryItem?.id === id) setSelectedHistoryItem(null);
  };


  // --- AI SCANNER LOGIC ---

  const handleScannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = async () => {
          setIsScanning(true);
          const base64 = reader.result as string;
          
          try {
              const result = await analyzeMatchScreenshot(base64);
              // Process result into ScannedMatchData
              const processed: ScannedMatchData[] = result.map((item: any, idx: number) => {
                  // Fuzzy Match Logic
                  const lowerExtracted = item.extractedName.toLowerCase();
                  const exactMatch = players.find(p => p.name.toLowerCase() === lowerExtracted);
                  
                  return {
                      tempId: `scan-${idx}-${Date.now()}`,
                      extractedName: item.extractedName,
                      matchedPlayerId: exactMatch ? exactMatch.id : null,
                      teamResult: item.teamResult as 'WIN' | 'LOSS',
                      kills: item.kills,
                      isMvp: item.isMvp,
                      pointsKills: 0, // Will calc in effect
                      pointsTeam: 0,
                      pointsMvp: 0,
                      totalPoints: 0
                  };
              });
              setScannedData(calculateScannedPoints(processed));
          } catch (error) {
              setMessage({ text: "Error analizando la imagen.", type: 'error' });
          } finally {
              setIsScanning(false);
          }
      };
      reader.readAsDataURL(file);
  };

  const calculateScannedPoints = (data: ScannedMatchData[]): ScannedMatchData[] => {
      return data.map(d => {
          const pk = d.kills * 1; // 1 point per kill
          const pm = d.isMvp ? 4 : 0; // 4 points for MVP
          const pt = d.teamResult === 'WIN' ? 2 : 1; // 2 for Win, 1 for Loss
          return {
              ...d,
              pointsKills: pk,
              pointsMvp: pm,
              pointsTeam: pt,
              totalPoints: pk + pm + pt
          };
      });
  };

  const updateScannedRow = (tempId: string, field: keyof ScannedMatchData, value: any) => {
      const updated = scannedData.map(d => {
          if (d.tempId === tempId) {
              return { ...d, [field]: value };
          }
          return d;
      });
      setScannedData(calculateScannedPoints(updated));
  };

  const handleCommitScannedPoints = () => {
      let updatedCount = 0;
      const newPlayers = players.map(p => {
          const scanMatch = scannedData.find(s => s.matchedPlayerId === p.id);
          if (scanMatch) {
              updatedCount++;
              return { ...p, score: p.score + scanMatch.totalPoints };
          }
          return p;
      });
      
      setPlayers(newPlayers);
      setMessage({ text: `Datos cargados! Puntos actualizados para ${updatedCount} jugadores.`, type: 'success' });
      setScannedData([]);
      setIsScannerOpen(false);
  };

  // --- QUICK REGISTER LOGIC ---
  const initQuickRegister = (tempId: string, extractedName: string) => {
      setQuickReg({
          isOpen: true,
          tempId: tempId,
          name: extractedName,
          uid: '123'
      });
  };

  const saveQuickRegister = () => {
      if (!quickReg) return;
      
      if (!quickReg.name.trim()) {
          alert("El nombre es requerido");
          return;
      }

      const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
      const newId = Date.now().toString();

      const newPlayer: Player = {
          id: newId,
          name: quickReg.name,
          uid: quickReg.uid,
          image: defaultImage,
          score: 0,
          active: true
      };

      // 1. Add to main DB
      setPlayers(prev => [...prev, newPlayer]);

      // 2. Link to Scanned Row
      updateScannedRow(quickReg.tempId, 'matchedPlayerId', newId);

      // 3. Close
      setQuickReg(null);
      setMessage({ text: `Jugador ${quickReg.name} registrado y vinculado.`, type: 'success' });
  };

  // -------------------------

  // Tournament Logic
  const togglePlayerActive = (id: string) => {
    setPlayers(players.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  // Generic Reset
  const handleResetBracket = () => {
    if (tournamentMode === 'STANDARD') {
      setBracketState({ semi1Winner: null, semi2Winner: null, champion: null });
    } else if (tournamentMode === 'DUEL') {
      setBo3State({ match1Winner: null, match2Winner: null, match3Winner: null });
    } else if (tournamentMode === 'VS') {
      const hardReset = vsMatches.map((round) => round.map(m => ({...m, winner: null})));
      setVsMatches(hardReset);
    } else if (tournamentMode === 'VS_RANDOM') {
      const hardReset = rndVsMatches.map((round) => round.map(m => ({...m, winner: null})));
      setRndVsMatches(hardReset);
    }
    setMessage({ text: "Bracket/Match Progress Reset", type: 'info' });
  };

  // Helper to generate a Power of 2 Bracket with Play-Ins
  const generateBalancedBracket = (activePlayers: Player[]) => {
      const n = activePlayers.length;
      if (n < 2) return null;

      const targetSize = Math.pow(2, Math.floor(Math.log2(n))); 
      const adjustmentMatchesCount = n - targetSize;
      const isAdjustmentNeeded = adjustmentMatchesCount > 0;
      
      const shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
      const newBracket: VsMatch[][] = [];
      
      const numPlayInPlayers = adjustmentMatchesCount * 2;
      const playInPlayers = shuffled.slice(n - numPlayInPlayers);
      const directPlayers = shuffled.slice(0, n - numPlayInPlayers);

      const playInInfo = {
         active: isAdjustmentNeeded,
         directCount: directPlayers.length,
         adjustmentMatches: adjustmentMatchesCount
      };

      if (isAdjustmentNeeded) {
         const round0: VsMatch[] = [];
         for (let i = 0; i < adjustmentMatchesCount; i++) {
            round0.push({
               id: `r0-m${i}`,
               roundIndex: 0,
               matchIndex: i,
               p1: playInPlayers[i*2],
               p2: playInPlayers[i*2 + 1],
               winner: null
            });
         }
         newBracket.push(round0);
      }

      const mainRoundsCount = Math.log2(targetSize);
      const roundOffset = isAdjustmentNeeded ? 1 : 0;

      for (let r = 0; r < mainRoundsCount; r++) {
          const matchesInRound = targetSize / Math.pow(2, r + 1);
          const roundMatches: VsMatch[] = [];
          const currentRoundIndex = r + roundOffset;

          for (let m = 0; m < matchesInRound; m++) {
             if (r === 0) {
                let p1: Player | null = null;
                let p2: Player | null = null;

                if (isAdjustmentNeeded) {
                   const slot1Index = m * 2;
                   const slot2Index = m * 2 + 1;
                   if (slot1Index < directPlayers.length) p1 = directPlayers[slot1Index];
                   else p1 = null; 
                   if (slot2Index < directPlayers.length) p2 = directPlayers[slot2Index];
                   else p2 = null;
                } else {
                   p1 = shuffled[m * 2];
                   p2 = shuffled[m * 2 + 1];
                }

                roundMatches.push({
                   id: `r${currentRoundIndex}-m${m}`,
                   roundIndex: currentRoundIndex,
                   matchIndex: m,
                   p1: p1,
                   p2: p2,
                   winner: null
                });
             } else {
                roundMatches.push({
                   id: `r${currentRoundIndex}-m${m}`,
                   roundIndex: currentRoundIndex,
                   matchIndex: m,
                   p1: null,
                   p2: null,
                   winner: null
                });
             }
          }
          newBracket.push(roundMatches);
      }
      
      return { bracket: newBracket, info: playInInfo };
  };


  const handleRandomTeams = () => {
    // Logic for VS Mode (Dynamic) using MAIN DB
    if (tournamentMode === 'VS') {
        const activePlayers = players.filter(p => p.active);
        const result = generateBalancedBracket(activePlayers);
        if (!result) {
            setMessage({ text: "Need at least 2 players for VS Mode", type: 'error' });
            return;
        }
        setVsMatches(result.bracket);
        setVsPlayInInfo(result.info);
        setTeams([]); 
        
        if (result.info.active) {
           setMessage({ 
              text: `Torneo generado: ${result.info.directCount} Pases Directos, ${result.info.adjustmentMatches} Partidas de Ajuste.`, 
              type: 'info' 
           });
        } else {
           setMessage({ text: `Bracket perfecto de ${activePlayers.length} jugadores generado.`, type: 'success' });
        }
        return;
    }

    // Logic for VS RANDOM (Independent DB)
    if (tournamentMode === 'VS_RANDOM') {
        const result = generateBalancedBracket(randomPlayers); // Use all random players
        if (!result) {
            setMessage({ text: "Need at least 2 players in Random List", type: 'error' });
            return;
        }
        setRndVsMatches(result.bracket);
        setRndVsPlayInInfo(result.info);
        setTeams([]);
        setMessage({ text: "Independent Random Tournament Generated!", type: 'success' });
        return;
    }

    // Logic for Standard/Duel
    const activePlayers = players.filter(p => p.active);
    const requiredPlayers = tournamentMode === 'STANDARD' ? 20 : 10;
    
    if (activePlayers.length > requiredPlayers) {
      setMessage({ text: `Excede el número máximo de jugadores (Max ${requiredPlayers})`, type: 'error' });
      return;
    }
    if (activePlayers.length < requiredPlayers) {
      setMessage({ text: `Insuficientes jugadores habilitados (${activePlayers.length}/${requiredPlayers})`, type: 'error' });
      return;
    }

    // Shuffle
    const shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
    
    let newTeams: Team[] = [];

    if (tournamentMode === 'STANDARD') {
        newTeams = [
          { id: 't1', name: 'Alpha Squad', color: 'bg-red-600', members: shuffled.slice(0, 5) },
          { id: 't2', name: 'Bravo Six', color: 'bg-green-600', members: shuffled.slice(5, 10) },
          { id: 't3', name: 'Delta Force', color: 'bg-yellow-500', members: shuffled.slice(10, 15) },
          { id: 't4', name: 'Omega Protocol', color: 'bg-blue-600', members: shuffled.slice(15, 20) },
        ];
    } else {
        // Duel / 10 Players
        newTeams = [
            { id: 't1', name: 'Team Alpha', color: 'bg-red-600', members: shuffled.slice(0, 5) },
            { id: 't2', name: 'Team Bravo', color: 'bg-blue-600', members: shuffled.slice(5, 10) },
        ];
    }

    setTeams(newTeams);
    setBracketState({ semi1Winner: null, semi2Winner: null, champion: null });
    setBo3State({ match1Winner: null, match2Winner: null, match3Winner: null });
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

  const recordBo3Win = (matchId: 'match1Winner' | 'match2Winner' | 'match3Winner', teamId: string) => {
     setBo3State(prev => ({ ...prev, [matchId]: teamId }));
  };

  // VS Mode Logic: Advance Winner (Handles both VS and VS_RANDOM)
  const advanceVsMatch = (roundIndex: number, matchIndex: number, winner: Player, isRandomMode: boolean) => {
     const currentBracket = isRandomMode ? [...rndVsMatches] : [...vsMatches];
     const currentPlayIn = isRandomMode ? rndVsPlayInInfo : vsPlayInInfo;
     
     // 1. Set Winner for current match
     currentBracket[roundIndex][matchIndex].winner = winner;

     // 2. Logic to move to next round
     if (currentPlayIn.active && roundIndex === 0) {
         // Adjustment Round -> Round 1
         const targetGlobalSlot = currentPlayIn.directCount + matchIndex;
         const nextRoundIndex = 1;
         const nextMatchIndex = Math.floor(targetGlobalSlot / 2);
         const isPlayer1Slot = targetGlobalSlot % 2 === 0;

         if (currentBracket[nextRoundIndex] && currentBracket[nextRoundIndex][nextMatchIndex]) {
             const nextMatch = currentBracket[nextRoundIndex][nextMatchIndex];
             if (isPlayer1Slot) nextMatch.p1 = winner;
             else nextMatch.p2 = winner;
             nextMatch.winner = null; 
         }
     } else {
         // Standard Binary Tree Logic
         const nextRoundIndex = roundIndex + 1;
         if (nextRoundIndex < currentBracket.length) {
             const nextMatchIndex = Math.floor(matchIndex / 2);
             const isPlayer1Slot = matchIndex % 2 === 0;
             const nextMatch = currentBracket[nextRoundIndex][nextMatchIndex];
             if (isPlayer1Slot) nextMatch.p1 = winner;
             else nextMatch.p2 = winner;
             nextMatch.winner = null;
         }
     }

     if (isRandomMode) setRndVsMatches(currentBracket);
     else setVsMatches(currentBracket);
  };

  // Check for Bo3 Champion
  const getBo3Champion = () => {
     if (teams.length < 2) return null;
     const t1 = teams[0].id;
     const t2 = teams[1].id;
     let t1Wins = 0;
     let t2Wins = 0;
     
     if (bo3State.match1Winner === t1) t1Wins++;
     if (bo3State.match1Winner === t2) t2Wins++;
     if (bo3State.match2Winner === t1) t1Wins++;
     if (bo3State.match2Winner === t2) t2Wins++;
     if (bo3State.match3Winner === t1) t1Wins++;
     if (bo3State.match3Winner === t2) t2Wins++;

     if (t1Wins >= 2) return teams[0];
     if (t2Wins >= 2) return teams[1];
     return null;
  };

  // Sort players for Ranking - FILTERED BY ACTIVE STATUS
  const sortedPlayers = players
    .filter(p => p.active)
    .sort((a, b) => b.score - a.score);

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
           <div className="relative group w-64 h-64 border-4 border-cod-gold rounded-xl overflow-hidden bg-black shadow-[0_0_30px_rgba(234,179,8,0.3)] flex items-center justify-center cursor-pointer hover:border-white transition-colors">
              <img 
                src={appLogo || "/wolf-x8.png"} 
                alt="App Logo" 
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white font-bold text-sm uppercase tracking-widest">Upload Logo</span>
              </div>
              <input type="file" accept="image/*" onChange={handleAppLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
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
        <Button onClick={() => setView(PageView.TOURNAMENT)} variant="ghost" className="h-32 text-2xl bg-teal-900/80 border-2 border-teal-500 text-teal-300 hover:bg-teal-800 hover:text-white shadow-[0_0_20px_rgba(45,212,191,0.2)] backdrop-blur-sm">
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

          <div className="absolute top-4 left-4">
             <button 
                onClick={() => setIsDbOpen(true)}
                className="flex items-center gap-2 text-cod-gold text-xs font-bold uppercase border border-cod-gold px-3 py-1 hover:bg-cod-gold hover:text-black transition-colors"
             >
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
                    <div className="flex items-center justify-center h-full text-gray-600 text-xs text-center p-2">NO SIGNAL</div>
                  )}
               </div>
               
               <div className="flex-1 space-y-3">
                  <label className="block text-cod-gold text-xs font-bold uppercase tracking-widest">Profile Image (Optional)</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-xs file:font-semibold file:bg-cod-gold file:text-black hover:file:bg-yellow-400"/>
                  
                  <div className="grid grid-cols-1 gap-2 p-3 bg-black/30 border border-gray-700 mt-2">
                     <p className="text-xs text-cod-gray uppercase font-bold mb-1">AI Tools</p>
                     <div className="flex gap-2">
                        <input type="text" placeholder="Describe avatar..." value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-white"/>
                         <select value={genSize} onChange={(e) => setGenSize(e.target.value as ImageSize)} className="bg-gray-900 border border-gray-700 text-xs text-white">
                           <option value={ImageSize.SIZE_1K}>1K</option>
                           <option value={ImageSize.SIZE_2K}>2K</option>
                           <option value={ImageSize.SIZE_4K}>4K</option>
                        </select>
                        <button onClick={handleGenerateAvatar} disabled={isProcessing} className="bg-blue-600 px-2 py-1 text-xs uppercase font-bold text-white hover:bg-blue-500 disabled:opacity-50">Gen</button>
                     </div>
                     <div className="flex gap-2">
                        <input type="text" placeholder="Edit..." value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} disabled={!regImage} className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-white disabled:opacity-30"/>
                        <button onClick={handleEditAvatar} disabled={!regImage || isProcessing} className="bg-purple-600 px-2 py-1 text-xs uppercase font-bold text-white hover:bg-purple-500 disabled:opacity-50">Edit</button>
                     </div>
                  </div>
               </div>
            </div>

            <div>
              <label className="block text-cod-gold text-xs font-bold uppercase tracking-widest mb-1">Operator Name *</label>
              <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full bg-black border-b-2 border-gray-600 focus:border-cod-gold px-4 py-3 text-white outline-none font-mono" placeholder="ENTER NAME"/>
            </div>

            <div>
              <label className="block text-cod-gold text-xs font-bold uppercase tracking-widest mb-1">UID *</label>
              <input type="text" value={regUid} onChange={(e) => setRegUid(e.target.value)} className="w-full bg-black border-b-2 border-gray-600 focus:border-cod-gold px-4 py-3 text-white outline-none font-mono" placeholder="ENTER UID"/>
            </div>

            <div className="flex gap-4">
               {editingId && (
                  <Button onClick={cancelEdit} variant="secondary" className="flex-1">CANCEL EDIT</Button>
               )}
               <Button onClick={handleRegister} className="flex-1" disabled={isProcessing}>
                  {isProcessing ? 'PROCESSING...' : editingId ? 'UPDATE PLAYER' : 'COMPLETE REGISTRATION'}
               </Button>
            </div>
          </div>
       </div>

       {isDbOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
             <div className="w-full max-w-4xl bg-cod-panel border border-cod-gold h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 bg-black border-b border-gray-800 flex justify-between items-center">
                   <h3 className="text-xl font-bold text-white uppercase">Player Database (Limit 60)</h3>
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
                                  <button onClick={() => loadForEdit(player)} className="p-2 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800 transition-colors">Edit</button>
                               </td>
                            </tr>
                         ))}
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
        <h2 className="text-3xl font-bold text-red-500 mb-6 uppercase tracking-widest text-center">Discharge Operator</h2>
        <div className="mb-8">
           <label className="block text-gray-500 text-xs font-bold uppercase mb-2">Select Player to Remove</label>
           <select className="w-full bg-black border border-gray-700 text-white p-3 outline-none focus:border-red-500" onChange={(e) => setScorePlayerId(e.target.value)} value={scorePlayerId}>
             <option value="">-- SELECT TARGET --</option>
             {players.map(p => (
               <option key={p.id} value={p.id}>{p.name} (UID: {p.uid})</option>
             ))}
           </select>
        </div>
        <div className="flex gap-4">
           <Button variant="secondary" onClick={() => setView(PageView.HOME)} fullWidth>Cancel</Button>
           <Button variant="danger" onClick={() => handleRemove(scorePlayerId)} fullWidth disabled={!scorePlayerId}>BAJA</Button>
        </div>
      </div>
    </div>
  );

  const renderRanking = () => {
    // UPDATED MAX SCORE FOR BETTER VISUAL SCALING
    const fixedMaxScore = 150;
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
           </div>
        </div>

        <div className="w-full max-w-6xl bg-cod-panel/50 p-6 rounded-lg mb-8 border border-gray-800 h-[500px] overflow-y-auto pr-4">
             <div className="space-y-4">
               {[...rankingDisplay, ...placeholders].map((player, index) => {
                 if (!player) {
                   return (
                     <div key={`placeholder-${index}`} className="flex items-center gap-4 opacity-30">
                        <div className="w-8 text-2xl font-black italic text-right text-gray-700">{index + 1}</div>
                        <div className="w-12 h-12 rounded-full border-2 border-gray-800 bg-black"></div>
                        <div className="flex-1 h-12 bg-gray-900/20 border border-gray-800"></div>
                        <div className="w-32 h-4 bg-gray-900/50"></div>
                     </div>
                   );
                 }
                 const widthPercentage = Math.min((player.score / fixedMaxScore) * 100, 100);
                 const rankColor = index === 0 ? 'text-cod-gold' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-700' : 'text-gray-500';
                 const minWidth = player.score > 0 ? '4rem' : '0';

                 return (
                   <div key={player.id} className="flex items-center gap-4 animate-slide-in">
                      <div className={`w-8 text-2xl font-black italic text-right ${rankColor}`}>{index + 1}</div>
                      <div className="w-12 h-12 rounded-full border-2 border-gray-700 overflow-hidden flex-shrink-0 relative bg-black">
                         <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 h-12 bg-gray-900/50 relative overflow-hidden clip-path-slant">
                         {/* CHANGED ALIGNMENT TO LEFT (justify-start pl-4) TO PREVENT TEXT CLIPPING */}
                         <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 flex items-center justify-start pl-4 transition-all duration-1000 ease-out" style={{ width: `${Math.max(widthPercentage, 0)}%`, minWidth: minWidth, clipPath: "polygon(0 0, 100% 0, 95% 100%, 0% 100%)" }}>
                            <span className="font-black text-3xl italic text-black font-mono tracking-wider drop-shadow-sm">{player.score}</span>
                         </div>
                      </div>
                      <div className="w-32 text-sm font-bold text-white uppercase truncate">{player.name}</div>
                   </div>
                 );
               })}
             </div>
        </div>

        <div className="w-full max-w-6xl bg-cod-panel border-t-4 border-cod-gold p-6 relative">
            <div className="absolute top-0 right-0 p-4">
                 <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-800 to-blue-900 px-4 py-2 border border-purple-500 rounded hover:from-purple-700 hover:to-blue-800 transition-colors shadow-lg"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span className="font-bold text-sm uppercase text-white">CARGA IA</span>
                 </button>
            </div>

           <h3 className="text-xl font-bold text-white uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-cod-gold inline-block"></span>
              Registro de Puntos Manual
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
              <div className="md:col-span-1">
                 <label className="block text-xs text-gray-400 font-bold mb-1">FILTER NAME</label>
                 <input type="text" value={scoreSearch} onChange={(e) => setScoreSearch(e.target.value)} className="w-full bg-black border border-gray-600 text-white p-2 text-sm mb-2" placeholder="Type to find..."/>
                 <label className="block text-xs text-gray-400 font-bold mb-1">SELECT PLAYER</label>
                 <div className="w-full h-32 bg-black border border-gray-600 overflow-y-auto custom-scrollbar p-1">
                    {filteredForDropdown.map(p => {
                      const isSelected = scorePlayerId === p.id;
                      return (
                        <div key={p.id} onClick={() => { if (isSelected) { setScorePlayerId(''); setMessage(null); } else { setScorePlayerId(p.id); setMessage({ text: `Jugador seleccionado: ${p.name}`, type: 'info' }); }}} className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-800 transition-colors ${isSelected ? 'bg-gray-800' : ''}`}>
                          <div className={`w-4 h-4 border border-gray-400 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-cod-gold border-cod-gold' : ''}`}>
                             {isSelected && <div className="w-2 h-2 bg-black"></div>}
                          </div>
                          <span className={`text-sm truncate ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>{p.name}</span>
                        </div>
                      );
                    })}
                 </div>
              </div>

              <div className="md:col-span-2 flex gap-2">
                 <div className="flex-1">
                    <label className={`block text-xs font-bold mb-1 cursor-pointer ${scoreMode === 'add' ? 'text-green-400' : 'text-gray-600'}`} onClick={() => setScoreMode('add')}>SUMA (+)</label>
                    <input type="number" placeholder="0" onFocus={() => setScoreMode('add')} value={scoreMode === 'add' ? scorePoints : ''} onChange={(e) => { setScorePoints(e.target.value); setScoreMode('add'); }} className={`w-full bg-black border p-2 text-white font-mono ${scoreMode === 'add' ? 'border-green-500' : 'border-gray-800 opacity-50'}`}/>
                 </div>
                 <div className="flex-1">
                    <label className={`block text-xs font-bold mb-1 cursor-pointer ${scoreMode === 'subtract' ? 'text-red-400' : 'text-gray-600'}`} onClick={() => setScoreMode('subtract')}>RESTA (-)</label>
                    <input type="number" placeholder="0" onFocus={() => setScoreMode('subtract')} value={scoreMode === 'subtract' ? scorePoints : ''} onChange={(e) => { setScorePoints(e.target.value); setScoreMode('subtract'); }} className={`w-full bg-black border p-2 text-white font-mono ${scoreMode === 'subtract' ? 'border-red-500' : 'border-gray-800 opacity-50'}`}/>
                 </div>
              </div>
              <div className="md:col-span-1">
                 <Button onClick={handleUpdateScore} fullWidth className="text-sm h-[42px]">Cargar Datos</Button>
              </div>
           </div>

           {/* --- SEASON CONTROLS (NEW) --- */}
           <div className="border-t border-gray-800 pt-4 mt-4">
              <h4 className="text-xs text-gray-500 font-bold uppercase mb-2">Season Management</h4>
              <div className="flex flex-wrap gap-4">
                   <Button 
                       variant="primary" 
                       className="text-xs bg-green-700 hover:bg-green-600 border-green-500 text-white shadow-none"
                       onClick={handleArchiveSeason}
                   >
                       Archive Week
                   </Button>
                   <Button 
                       variant="secondary" 
                       className="text-xs"
                       onClick={() => setIsHistoryOpen(true)}
                   >
                       View History
                   </Button>
                   <div className="flex-1"></div>
                   <Button 
                       variant="danger" 
                       className="text-xs bg-red-900/50 border border-red-700 hover:bg-red-800"
                       onClick={handleResetSeason}
                   >
                       RESET ALL SCORES
                   </Button>
              </div>
           </div>

        </div>
        
        {/* --- AI SCANNER MODAL --- */}
        {isScannerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
                 <div className="w-full max-w-6xl bg-gray-900 border border-purple-500 shadow-2xl flex flex-col max-h-[90vh] relative">
                     {/* Header */}
                     <div className="bg-purple-900/50 p-4 border-b border-purple-700 flex justify-between items-center">
                         <h3 className="text-xl font-bold text-white uppercase flex items-center gap-2">
                             <span className="animate-pulse w-2 h-2 bg-purple-400 rounded-full"></span>
                             AI Match Analysis
                         </h3>
                         <button onClick={() => {setIsScannerOpen(false); setScannedData([]);}} className="text-gray-400 hover:text-white text-2xl">✕</button>
                     </div>

                     {/* Body */}
                     <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                         {scannedData.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-700 rounded-xl bg-black/50">
                                 {isScanning ? (
                                     <div className="text-purple-400 animate-pulse font-bold text-xl uppercase">Analizando Imagen...</div>
                                 ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-gray-500 mb-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                        <p className="text-gray-400 mb-4 uppercase font-bold text-sm">Upload Scoreboard Screenshot</p>
                                        <input 
                                           type="file" 
                                           accept="image/*" 
                                           onChange={handleScannerUpload} 
                                           className="block w-64 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                                        />
                                    </>
                                 )}
                             </div>
                         ) : (
                             <div className="space-y-4">
                                 <div className="bg-blue-900/20 p-3 border-l-4 border-blue-500 text-xs text-blue-200">
                                     <span className="font-bold">VERIFICATION REQUIRED:</span> Please check the data below. Select the correct registered player for any "Not Identified" rows. 
                                     Scoring Rules applied: Win=2, Loss=1, Kill=1, MVP=4.
                                 </div>
                                 <table className="w-full text-left border-collapse">
                                     <thead className="bg-black text-xs text-gray-400 uppercase font-bold sticky top-0">
                                         <tr>
                                             <th className="p-3">Detected Name</th>
                                             <th className="p-3">Matched Player (DB)</th>
                                             <th className="p-3">Team</th>
                                             <th className="p-3">Kills</th>
                                             <th className="p-3">MVP?</th>
                                             <th className="p-3 text-center">Pts (Kill)</th>
                                             <th className="p-3 text-center">Pts (Team)</th>
                                             <th className="p-3 text-center">Pts (MVP)</th>
                                             <th className="p-3 text-right text-cod-gold">TOTAL</th>
                                         </tr>
                                     </thead>
                                     <tbody className="text-sm">
                                         {scannedData.map((row) => (
                                             <tr key={row.tempId} className="border-b border-gray-800 hover:bg-gray-800/50">
                                                 <td className="p-3 font-mono text-gray-300">{row.extractedName}</td>
                                                 <td className="p-3 flex items-center gap-2">
                                                     <select 
                                                         value={row.matchedPlayerId || ""} 
                                                         onChange={(e) => updateScannedRow(row.tempId, 'matchedPlayerId', e.target.value || null)}
                                                         className={`bg-black border p-1 rounded w-40 outline-none ${!row.matchedPlayerId ? 'border-red-500 text-red-400 font-bold' : 'border-gray-700 text-white'}`}
                                                     >
                                                         <option value="">-- NOT IDENTIFIED --</option>
                                                         {sortedPlayers.map(p => (
                                                             <option key={p.id} value={p.id}>{p.name}</option>
                                                         ))}
                                                     </select>
                                                     {!row.matchedPlayerId && (
                                                         <button 
                                                            onClick={() => initQuickRegister(row.tempId, row.extractedName)}
                                                            className="bg-green-600 hover:bg-green-500 text-white p-1 rounded font-bold w-6 h-6 flex items-center justify-center text-xs"
                                                            title="Register New Player"
                                                         >
                                                             +
                                                         </button>
                                                     )}
                                                 </td>
                                                 <td className="p-3">
                                                     <select 
                                                         value={row.teamResult} 
                                                         onChange={(e) => updateScannedRow(row.tempId, 'teamResult', e.target.value)}
                                                         className={`bg-black border border-gray-700 p-1 rounded font-bold text-xs ${row.teamResult === 'WIN' ? 'text-green-400' : 'text-red-400'}`}
                                                     >
                                                         <option value="WIN">WIN (5 Rounds)</option>
                                                         <option value="LOSS">LOSS</option>
                                                     </select>
                                                 </td>
                                                 <td className="p-3">
                                                     <input 
                                                         type="number" 
                                                         value={row.kills} 
                                                         onChange={(e) => updateScannedRow(row.tempId, 'kills', parseInt(e.target.value) || 0)}
                                                         className="bg-black border border-gray-700 p-1 w-16 text-center text-white"
                                                     />
                                                 </td>
                                                 <td className="p-3">
                                                     <input 
                                                         type="checkbox" 
                                                         checked={row.isMvp} 
                                                         onChange={(e) => updateScannedRow(row.tempId, 'isMvp', e.target.checked)}
                                                         className="w-4 h-4 accent-cod-gold"
                                                     />
                                                 </td>
                                                 <td className="p-3 text-center text-gray-500">+{row.pointsKills}</td>
                                                 <td className="p-3 text-center text-gray-500">+{row.pointsTeam}</td>
                                                 <td className="p-3 text-center text-gray-500">+{row.pointsMvp}</td>
                                                 <td className="p-3 text-right font-black text-xl text-cod-gold">{row.totalPoints}</td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                         )}
                     </div>

                     {/* --- QUICK REGISTER OVERLAY MODAL --- */}
                     {quickReg && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[60]">
                           <div className="bg-cod-panel border border-green-500 p-6 shadow-2xl w-96 animate-fade-in">
                              <h4 className="text-green-400 font-bold uppercase mb-4 text-lg border-b border-green-900 pb-2">Quick Register</h4>
                              
                              <div className="mb-4">
                                  <label className="block text-gray-500 text-xs font-bold uppercase mb-1">Detected Name</label>
                                  <input 
                                     type="text" 
                                     value={quickReg.name} 
                                     onChange={(e) => setQuickReg({...quickReg, name: e.target.value})}
                                     className="w-full bg-black border border-gray-700 p-2 text-white font-bold"
                                  />
                              </div>

                              <div className="mb-6">
                                  <label className="block text-gray-500 text-xs font-bold uppercase mb-1">Assign UID</label>
                                  <input 
                                     type="text" 
                                     value={quickReg.uid} 
                                     onChange={(e) => setQuickReg({...quickReg, uid: e.target.value})}
                                     className="w-full bg-black border border-gray-700 p-2 text-white font-mono"
                                  />
                              </div>

                              <div className="flex gap-3">
                                  <button onClick={() => setQuickReg(null)} className="flex-1 bg-gray-800 text-gray-300 py-2 font-bold text-xs uppercase hover:bg-gray-700">Cancel</button>
                                  <button onClick={saveQuickRegister} className="flex-1 bg-green-600 text-white py-2 font-bold text-xs uppercase hover:bg-green-500">Confirm & Link</button>
                              </div>
                           </div>
                        </div>
                     )}
                 </div>
            </div>
        )}

        {/* --- HISTORY MODAL --- */}
        {isHistoryOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
                <div className="w-full max-w-5xl bg-gray-900 border border-cod-gold flex h-[80vh] shadow-[0_0_50px_rgba(234,179,8,0.1)]">
                    {/* LEFT: LIST OF WEEKS */}
                    <div className="w-1/3 border-r border-gray-700 flex flex-col bg-black">
                        <div className="p-4 border-b border-gray-800 bg-cod-panel">
                            <h3 className="text-white font-bold uppercase tracking-wider">Ranking History</h3>
                            <p className="text-xs text-gray-500">Weekly Snapshots</p>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {rankingHistory.length === 0 ? (
                                <div className="p-4 text-gray-500 text-sm italic">No history saved.</div>
                            ) : (
                                rankingHistory.map(entry => (
                                    <div 
                                        key={entry.id} 
                                        onClick={() => setSelectedHistoryItem(entry)}
                                        className={`p-4 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-900 ${selectedHistoryItem?.id === entry.id ? 'bg-gray-800 border-l-4 border-l-cod-gold' : ''}`}
                                    >
                                        <div className="text-white font-bold text-sm mb-1">{entry.label}</div>
                                        <div className="text-gray-500 text-xs">{entry.snapshot.length} Players Recorded</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-800">
                           <Button variant="ghost" fullWidth onClick={() => {setIsHistoryOpen(false); setSelectedHistoryItem(null);}}>CLOSE</Button>
                        </div>
                    </div>

                    {/* RIGHT: DETAILS */}
                    <div className="w-2/3 flex flex-col bg-gray-900 relative">
                        {selectedHistoryItem ? (
                            <>
                                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-cod-panel">
                                    <div>
                                        <h3 className="text-xl font-black text-cod-gold uppercase">{selectedHistoryItem.label}</h3>
                                        <span className="text-xs text-gray-400">Snapshot ID: {selectedHistoryItem.id}</span>
                                    </div>
                                    <button onClick={() => handleDeleteHistoryItem(selectedHistoryItem.id)} className="text-red-500 text-xs font-bold uppercase hover:text-red-400">Delete Entry</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-gray-500 text-xs border-b border-gray-700">
                                                <th className="p-2">#</th>
                                                <th className="p-2">Player</th>
                                                <th className="p-2 text-right">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedHistoryItem.snapshot.sort((a,b) => b.score - a.score).map((p, idx) => (
                                                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800">
                                                    <td className="p-2 font-mono text-cod-gold font-bold">{idx + 1}</td>
                                                    <td className="p-2 flex items-center gap-2">
                                                        <img src={p.image} className="w-6 h-6 rounded-full" alt="" />
                                                        <span className="text-white text-sm">{p.name}</span>
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-white">{p.score}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="uppercase font-bold text-sm">Select a week to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  };

  const renderTournament = () => {
    const activeCount = players.filter(p => p.active).length;
    const totalCount = players.length;
    const filteredPlayers = players.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.uid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const requiredPlayers = tournamentMode === 'STANDARD' ? 20 : (tournamentMode === 'DUEL' ? 10 : 2);
    const isRandomMode = tournamentMode === 'VS_RANDOM';

    return (
      <div className="min-h-screen p-4 bg-black flex flex-col items-center">
        <div className="w-full max-w-5xl mb-6 flex justify-between items-center border-b border-purple-800 pb-4">
          <Button variant="ghost" onClick={() => setView(PageView.HOME)}>← HOME</Button>
          <h2 className="text-3xl font-black text-white uppercase italic">
            Tournament <span className="text-purple-500">Setup</span>
          </h2>
          {!isRandomMode && (
              <div className="flex gap-8 text-right">
                 <div>
                    <div className="text-xs text-gray-400">TOTAL PLAYERS</div>
                    <div className="text-3xl font-mono font-bold text-blue-400">{totalCount}</div>
                 </div>
                 <div>
                    <div className="text-xs text-gray-400">PLAYERS READY</div>
                    <div className={`text-3xl font-mono font-bold ${activeCount >= requiredPlayers ? 'text-green-500 animate-pulse' : 'text-yellow-500'}`}>
                        {activeCount}/{tournamentMode === 'VS' ? 'Any (>1)' : requiredPlayers}
                    </div>
                 </div>
              </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="md:col-span-2 space-y-4">
              {!isRandomMode && (
                  <div className="flex gap-4">
                      <input type="text" placeholder="BUSCAR JUGADOR (Nombre o UID)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-cod-panel border border-gray-700 p-3 text-white uppercase tracking-wider focus:border-purple-500 outline-none"/>
                  </div>
              )}
              <div className="flex gap-2 items-center flex-wrap">
                 <span className="text-xs font-bold text-gray-500 uppercase">Mode:</span>
                 <button onClick={() => setTournamentMode('STANDARD')} className={`px-2 py-2 border text-xs font-bold uppercase transition-colors ${tournamentMode === 'STANDARD' ? 'bg-purple-900 border-purple-500 text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                   Team (20P)
                 </button>
                 <button onClick={() => setTournamentMode('DUEL')} className={`px-2 py-2 border text-xs font-bold uppercase transition-colors ${tournamentMode === 'DUEL' ? 'bg-blue-900 border-blue-500 text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                   Team (10P)
                 </button>
                 <button onClick={() => setTournamentMode('VS')} className={`px-2 py-2 border text-xs font-bold uppercase transition-colors ${tournamentMode === 'VS' ? 'bg-orange-900 border-orange-500 text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                   VS X8
                 </button>
                 <button onClick={() => setTournamentMode('VS_RANDOM')} className={`px-2 py-2 border text-xs font-bold uppercase transition-colors ${tournamentMode === 'VS_RANDOM' ? 'bg-cyan-900 border-cyan-500 text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                   VS RndmPlayers
                 </button>
              </div>
           </div>
           <div>
              <Button onClick={handleRandomTeams} fullWidth className="h-full bg-purple-700 hover:bg-purple-600 border border-purple-500">
                 {tournamentMode === 'VS' || tournamentMode === 'VS_RANDOM' ? 'GENERATE BRACKET' : 'RANDOM TEAMS'}
              </Button>
           </div>
        </div>

        {/* --- MAIN PLAYER LIST --- */}
        {!isRandomMode && (
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
                              <button onClick={() => togglePlayerActive(player.id)} className={`w-12 h-6 rounded-full p-1 transition-colors ${player.active ? 'bg-green-600' : 'bg-red-900'}`}>
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
        )}

        {/* --- INDEPENDENT RANDOM PLAYERS UI --- */}
        {isRandomMode && (
            <div className="w-full max-w-5xl bg-cyan-950/20 border border-cyan-800 p-6 rounded mb-8 animate-fade-in">
                 <h3 className="text-cyan-400 font-bold uppercase mb-4 text-xl">Independent VS Registration</h3>
                 <div className="flex gap-4 mb-6">
                      <input 
                         type="text" 
                         value={rndName}
                         onChange={(e) => setRndName(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleAddRandomPlayer()}
                         placeholder="Enter Player Name..."
                         className="flex-1 bg-black border border-cyan-700 text-white px-4 py-2 outline-none focus:border-cyan-400"
                      />
                      <button onClick={handleAddRandomPlayer} className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-6 uppercase">ADD</button>
                 </div>

                 <div className="h-64 overflow-y-auto custom-scrollbar border-t border-cyan-900 bg-black/50">
                     {randomPlayers.length === 0 && <div className="p-4 text-gray-500 italic">No independent players added yet.</div>}
                     {randomPlayers.map(p => (
                         <div key={p.id} className="flex items-center justify-between p-3 border-b border-gray-800 hover:bg-gray-800">
                              <div className="flex items-center gap-3">
                                  <img src={p.image} className="w-8 h-8 rounded-full border border-cyan-500" />
                                  <span className="font-bold text-white">{p.name}</span>
                              </div>
                              <button onClick={() => handleRemoveRandomPlayer(p.id)} className="text-red-500 hover:text-red-300 text-xs uppercase font-bold">Remove</button>
                         </div>
                     ))}
                 </div>
                 <div className="mt-2 text-right text-xs text-cyan-600">Total: {randomPlayers.length} Players</div>
            </div>
        )}

        {/* Generated Teams Preview (Only Standard/Duel) */}
        {teams.length > 0 && !isRandomMode && tournamentMode !== 'VS' && (
           <div className="w-full max-w-5xl animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-4 uppercase">Squad Preview</h3>
              <div className={`grid grid-cols-1 ${teams.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
                 {teams.map((team, idx) => (
                    <div key={team.id} className={`p-4 border-t-4 ${team.color.replace('bg-', 'border-')} bg-cod-panel`}>
                       <input value={team.name} onChange={(e) => updateTeamName(team.id, e.target.value)} className="bg-transparent text-white font-black uppercase text-lg w-full mb-2 outline-none border-b border-transparent focus:border-white"/>
                       <div className="space-y-1">
                          {team.members.map(m => (
                             <div key={m.id} className="text-xs text-gray-400 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${team.color}`}></span>{m.name}
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
              <div className="mt-8 flex justify-center">
                 <Button onClick={() => setView(PageView.BRACKET)} className="w-64 py-4 text-xl">FLUJO (BRACKET)</Button>
              </div>
           </div>
        )}
        
        {/* Generated VS Bracket Preview Link (VS Main) */}
        {tournamentMode === 'VS' && vsMatches.length > 0 && (
             <div className="w-full max-w-5xl animate-fade-in mt-8 flex justify-center">
                 <Button onClick={() => setView(PageView.BRACKET)} className="w-64 py-4 text-xl bg-orange-600 hover:bg-orange-500 border border-orange-400">START VS BRACKET</Button>
             </div>
        )}

        {/* Generated VS Bracket Preview Link (VS Random) */}
        {tournamentMode === 'VS_RANDOM' && rndVsMatches.length > 0 && (
             <div className="w-full max-w-5xl animate-fade-in mt-8 flex justify-center">
                 <Button onClick={() => setView(PageView.BRACKET)} className="w-64 py-4 text-xl bg-cyan-600 hover:bg-cyan-500 border border-cyan-400 text-black">START RNDM BRACKET</Button>
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

    const bo3Champion = getBo3Champion();
    const isRandomMode = tournamentMode === 'VS_RANDOM';
    
    // Determine Champion for VS modes
    const currentVsMatches = isRandomMode ? rndVsMatches : vsMatches;
    const vsChampion = currentVsMatches.length > 0 && currentVsMatches[currentVsMatches.length - 1][0].winner ? currentVsMatches[currentVsMatches.length - 1][0].winner : null;

    return (
      <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
        {/* Navigation & Reset Header */}
        <div className="absolute top-4 left-0 right-0 z-40 px-6 flex justify-between items-start pointer-events-none">
           <div className="pointer-events-auto flex gap-2">
              <Button variant="secondary" onClick={() => setView(PageView.TOURNAMENT)} className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                 </svg>
                 BACK TO SETUP
              </Button>
              {(tournamentMode === 'STANDARD' || tournamentMode === 'DUEL') && (
                  <Button variant="ghost" onClick={() => setView(PageView.RANKING)} className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700 text-yellow-500 hover:text-white">
                      GO TO RANKING
                  </Button>
              )}
           </div>
           
           <div className="pointer-events-auto">
              <button 
                 onClick={handleResetBracket}
                 className="group flex flex-col items-center justify-center bg-gray-900 border border-gray-700 text-gray-400 hover:text-white w-16 h-16 rounded-full hover:border-red-500 transition-all shadow-lg"
                 title="Reset Bracket Progress"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase mt-1">Reset</span>
              </button>
           </div>
        </div>

        {/* Info Modal */}
        {selectedTeamInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
             <div className={`p-6 bg-cod-panel border-2 ${selectedTeamInfo.color.replace('bg-', 'border-') + ' bg-black'} max-w-sm w-full shadow-2xl`}>
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

        {/* Bracket Content - Conditional Render based on mode */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-10 relative mt-16">
           
           {/* STANDARD MODE (4 Teams Bracket) */}
           {tournamentMode === 'STANDARD' && (
             <>
                {/* Connecting Lines (Simplified visual) */}
               <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                  <path d="M 20% 25% L 40% 25% L 40% 45% L 50% 45%" stroke="white" strokeWidth="2" fill="none" />
                  <path d="M 20% 75% L 40% 75% L 40% 55% L 50% 55%" stroke="white" strokeWidth="2" fill="none" />
                  <path d="M 80% 25% L 60% 25% L 60% 45% L 50% 45%" stroke="white" strokeWidth="2" fill="none" />
                  <path d="M 80% 75% L 60% 75% L 60% 55% L 50% 55%" stroke="white" strokeWidth="2" fill="none" />
               </svg>

               {/* Team 1 (Top Left) */}
               <div className="absolute top-10 left-4 md:left-20 w-48 md:w-64">
                  <div className={`p-4 ${teams[0]?.color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative group`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[0]?.name}</h4>
                     <button onClick={() => showTeamInfo(teams[0])} className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[0], 'semi1')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* Team 2 (Bottom Left) */}
               <div className="absolute bottom-10 left-4 md:left-20 w-48 md:w-64">
                  <div className={`p-4 ${teams[1]?.color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[1]?.name}</h4>
                     <button onClick={() => showTeamInfo(teams[1])} className="absolute top-2 right-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[1], 'semi1')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* Team 3 (Top Right) */}
               <div className="absolute top-10 right-4 md:right-20 w-48 md:w-64 text-right">
                  <div className={`p-4 ${teams[2]?.color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[2]?.name}</h4>
                     <button onClick={() => showTeamInfo(teams[2])} className="absolute top-2 left-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[2], 'semi2')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* Team 4 (Bottom Right) */}
               <div className="absolute bottom-10 right-4 md:right-20 w-48 md:w-64 text-right">
                  <div className={`p-4 ${teams[3]?.color} shadow-[0_0_15px_rgba(255,255,255,0.2)] relative`}>
                     <h4 className="font-black text-white uppercase text-lg">{teams[3]?.name}</h4>
                     <button onClick={() => showTeamInfo(teams[3])} className="absolute top-2 left-2 w-5 h-5 bg-black/50 text-xs flex items-center justify-center rounded hover:bg-black text-white">i</button>
                  </div>
                  <button onClick={() => advanceTeam(teams[3], 'semi2')} className="mt-2 w-full bg-gray-800 text-xs py-1 hover:bg-green-700 uppercase font-bold text-gray-400 hover:text-white transition-colors">
                     WINNER
                  </button>
               </div>

               {/* FINALISTS - CENTER */}
               <div className="flex gap-10 items-center">
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
             </>
           )}

           {/* DUEL MODE (2 Teams - Best of 3) */}
           {tournamentMode === 'DUEL' && teams.length === 2 && (
             <div className="w-full max-w-4xl flex flex-col items-center">
                <h2 className="text-4xl font-black text-white italic uppercase mb-12">BEST OF <span className="text-cod-gold">THREE</span></h2>
                
                <div className="flex justify-between w-full mb-12 items-center">
                   {/* Team 1 */}
                   <div className="flex flex-col items-center">
                      <div className={`p-6 ${teams[0].color} w-64 text-center shadow-[0_0_20px_rgba(255,0,0,0.4)] relative`}>
                          <h3 className="text-2xl font-black uppercase">{teams[0].name}</h3>
                          <button onClick={() => showTeamInfo(teams[0])} className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded hover:bg-black text-xs">i</button>
                      </div>
                   </div>

                   <div className="text-6xl font-black text-gray-700 italic">VS</div>

                   {/* Team 2 */}
                   <div className="flex flex-col items-center">
                      <div className={`p-6 ${teams[1].color} w-64 text-center shadow-[0_0_20px_rgba(0,0,255,0.4)] relative`}>
                          <h3 className="text-2xl font-black uppercase">{teams[1].name}</h3>
                          <button onClick={() => showTeamInfo(teams[1])} className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded hover:bg-black text-xs">i</button>
                      </div>
                   </div>
                </div>

                {/* Match Slots */}
                <div className="grid grid-cols-3 gap-8 w-full mb-8">
                   {[1, 2, 3].map((matchNum) => {
                      const matchKey = `match${matchNum}Winner` as 'match1Winner' | 'match2Winner' | 'match3Winner';
                      const winnerId = bo3State[matchKey];
                      const winnerTeam = teams.find(t => t.id === winnerId);
                      
                      return (
                         <div key={matchNum} className="flex flex-col items-center bg-gray-900 border border-gray-700 p-4 rounded">
                            <div className="text-gray-500 font-bold uppercase mb-4 tracking-widest">Match {matchNum}</div>
                            <div className={`w-full h-24 mb-4 flex items-center justify-center border-2 ${winnerTeam ? winnerTeam.color.replace('bg-', 'border-') + ' bg-black' : 'border-gray-800'}`}>
                               {winnerTeam ? (
                                  <span className="font-black uppercase text-xl">{winnerTeam.name}</span>
                               ) : (
                                  <span className="text-gray-600 text-sm">PENDING</span>
                               )}
                            </div>
                            {!bo3Champion && (
                               <div className="flex gap-2 w-full">
                                  <button onClick={() => recordBo3Win(matchKey, teams[0].id)} className={`flex-1 py-1 text-xs font-bold uppercase ${teams[0].color} hover:opacity-80`}>{teams[0].name}</button>
                                  <button onClick={() => recordBo3Win(matchKey, teams[1].id)} className={`flex-1 py-1 text-xs font-bold uppercase ${teams[1].color} hover:opacity-80`}>{teams[1].name}</button>
                               </div>
                            )}
                         </div>
                      )
                   })}
                </div>
             </div>
           )}

           {/* VS MODE (Dynamic Bracket) - Handles both VS and VS_RANDOM */}
           {(tournamentMode === 'VS' || tournamentMode === 'VS_RANDOM') && (
               <div className="flex flex-nowrap gap-8 overflow-x-auto p-4 w-full h-[80vh] items-center custom-scrollbar">
                   {currentVsMatches.map((round, rIndex) => {
                       const currentPlayIn = isRandomMode ? rndVsPlayInInfo : vsPlayInInfo;
                       let roundTitle = `ROUND ${rIndex + 1}`;
                       if (currentPlayIn.active) {
                          if (rIndex === 0) roundTitle = "PLAY-IN / AJUSTE";
                          else if (rIndex === currentVsMatches.length - 1) roundTitle = "GRAND FINAL";
                          else roundTitle = `MAIN ROUND ${rIndex}`;
                       } else {
                          if (rIndex === currentVsMatches.length - 1) roundTitle = "GRAND FINAL";
                       }
                       const isPlayInRound = currentPlayIn.active && rIndex === 0;

                       return (
                           <div key={rIndex} className={`flex flex-col justify-around h-full min-w-[250px] ${isPlayInRound ? 'bg-orange-900/10 border-r border-orange-800 border-dashed pr-4' : ''}`}>
                               <div className={`text-center font-bold mb-4 uppercase tracking-widest ${isPlayInRound ? 'text-orange-400' : 'text-blue-500'}`}>
                                   {roundTitle}
                               </div>
                               {round.map((match, mIndex) => (
                                   <div key={match.id} className="relative bg-cod-panel border border-gray-700 p-2 rounded mb-4">
                                       <div className="text-xs text-gray-600 absolute -top-2 left-2 bg-black px-1">Match {match.matchIndex + 1}</div>
                                       
                                       {/* Player 1 */}
                                       <div className={`flex items-center justify-between p-2 mb-1 border-b border-gray-800 ${match.winner && match.winner.id === match.p1?.id ? 'bg-green-900/30' : ''}`}>
                                           <div className="flex items-center gap-2">
                                               {match.p1 ? <img src={match.p1.image} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-800 rounded-full"></div>}
                                               <span className={`text-sm font-bold ${match.p1 ? 'text-white' : 'text-gray-600'}`}>
                                                   {match.p1 ? match.p1.name : (isPlayInRound ? 'TBD' : 'WAITING...')}
                                               </span>
                                           </div>
                                           {match.p1 && !match.winner && (match.p2 || !match.p2) && (
                                                <button onClick={() => advanceVsMatch(rIndex, mIndex, match.p1!, isRandomMode)} className="text-[10px] bg-gray-700 hover:bg-orange-500 px-2 py-1 rounded text-white">WIN</button>
                                           )}
                                           {match.winner && match.winner.id === match.p1?.id && <span className="text-green-500">✓</span>}
                                       </div>

                                       {/* Player 2 */}
                                       <div className={`flex items-center justify-between p-2 ${match.winner && match.winner.id === match.p2?.id ? 'bg-green-900/30' : ''}`}>
                                           <div className="flex items-center gap-2">
                                               {match.p2 ? <img src={match.p2.image} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-gray-800 rounded-full opacity-50"></div>}
                                               <span className={`text-sm font-bold ${match.p2 ? 'text-white' : 'text-gray-600 italic'}`}>
                                                   {match.p2 ? match.p2.name : (isPlayInRound ? 'TBD' : 'WAITING...')}
                                               </span>
                                           </div>
                                           {match.p2 && !match.winner && match.p1 && (
                                                <button onClick={() => advanceVsMatch(rIndex, mIndex, match.p2!, isRandomMode)} className="text-[10px] bg-gray-700 hover:bg-orange-500 px-2 py-1 rounded text-white">WIN</button>
                                           )}
                                            {match.winner && match.winner.id === match.p2?.id && <span className="text-green-500">✓</span>}
                                       </div>
                                   </div>
                               ))}
                           </div>
                       )
                   })}
               </div>
           )}

           {/* CHAMPION DISPLAY */}
           {(bracketState.champion || bo3Champion || vsChampion) && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 animate-bounce-in pointer-events-none">
                 <div className="bg-gradient-to-b from-yellow-300 to-yellow-600 p-8 rounded-xl shadow-[0_0_50px_rgba(255,215,0,0.8)] border-4 border-white text-center pointer-events-auto">
                    <h2 className="text-2xl font-bold text-black uppercase mb-2">TOURNAMENT CHAMPION</h2>
                    <h1 className="text-5xl font-black text-black uppercase">
                        {bracketState.champion?.name || bo3Champion?.name || vsChampion?.name}
                    </h1>
                    <Button onClick={handleResetBracket} className="mt-4 bg-black text-white border border-white hover:bg-gray-900 text-sm">
                        PLAY AGAIN
                    </Button>
                 </div>
              </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-yellow-500 selection:text-black">
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded shadow-lg font-bold border-2 animate-bounce-in ${message.type === 'success' ? 'bg-green-900 border-green-500 text-white' : message.type === 'error' ? 'bg-red-900 border-red-500 text-white' : 'bg-blue-900 border-blue-500'}`}>
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
    </div>
  );
}

export default App;
