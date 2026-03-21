'use client';

import { useState, useEffect, useCallback } from 'react';
import { questions as defaultQuestions } from '@/data/questions';
import { type GameState, type Team, type GuessResult } from '@/types/game';

const API_BASE = 'https://ducksurfer.com/api/office-feud';

// Sound FX class
class SoundFX {
  private ctx: AudioContext | null = null;
  private getCtx() { 
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }
  play(f: number, d: number, type: OscillatorType = 'square') {
    try {
      const c = this.getCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + d);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + d);
    } catch {}
  }
  correct() { this.play(523, 0.15, 'sine'); setTimeout(() => this.play(659, 0.15, 'sine'), 100); setTimeout(() => this.play(784, 0.3, 'sine'), 200); }
  strike() { this.play(220, 0.5, 'square'); }
  roundEnd() { this.play(392, 0.15, 'sine'); setTimeout(() => this.play(523, 0.15, 'sine'), 150); setTimeout(() => this.play(659, 0.15, 'sine'), 300); setTimeout(() => this.play(784, 0.4, 'sine'), 450); }
  gameStart() { this.play(400, 0.3, 'sawtooth'); setTimeout(() => this.play(300, 0.5, 'sawtooth'), 200); }
  intro() { try { const c = this.getCtx(); if (c.state === 'suspended') c.resume(); } catch {} const n = [{f:392,d:0.15},{f:523,d:0.15},{f:659,d:0.15},{f:784,d:0.15},{f:659,d:0.15},{f:523,d:0.15},{f:392,d:0.3}]; let t = 0; n.forEach((x,i) => { setTimeout(() => this.play(x.f, x.d, 'square'), t*1000); t += x.d * 0.9; }); }
  streak() { this.play(523, 0.1, 'sine'); setTimeout(() => this.play(659, 0.1, 'sine'), 80); setTimeout(() => this.play(784, 0.1, 'sine'), 160); }
  tick() { this.play(800, 0.05, 'square'); }
  timesUp() { this.play(200, 0.6, 'sawtooth'); }
}
const sfx = new SoundFX();
const genPin = () => Math.floor(1000 + Math.random() * 9000).toString();

type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export default function Home() {
  useEffect(() => { window.onerror = (msg, url, line) => { setError(`Error: ${msg} at line ${line}`); return true; }; }, []);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'menu'|'join'|'setup'|'team-select'|'coin-toss'|'game'>('menu');
  const [pin, setPin] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [blueName, setBlueName] = useState('Blue Team');
  const [redName, setRedName] = useState('Red Team');
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<GuessResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [streak, setStreak] = useState(0);
  const [timerOn, setTimerOn] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [bonus, setBonus] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const bgImages = ['/images/photo1.jpg', '/images/photo2.jpg', '/images/photo3.jpg', '/images/photo4.jpg', '/images/photo5.jpg', '/images/photo6.jpg'];
  const [coinResult, setCoinResult] = useState<'heads'|'tails'|null>(null);
  const [selectedCall, setSelectedCall] = useState<'heads'|'tails'|null>(null);
  const [flipping, setFlipping] = useState(false);
  const [customQs, setCustomQs] = useState<any[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => { const s = localStorage.getItem('office-feud-custom-questions'); if (s) setCustomQs(JSON.parse(s)); }, []);

  // Poll for game state updates
  useEffect(() => {
    if (!gameId) return;
    const fetchGame = async () => {
      try {
        const res = await fetch(API_BASE + '/game/' + gameId);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
          setTimeLeft(data.timeLeft || 30);
          // Sync team names
          if (data.blueTeam?.name) setBlueName(data.blueTeam.name);
          if (data.redTeam?.name) setRedName(data.redTeam.name);
          // Track my team
          if (playerId && data.players && Array.isArray(data.players)) {
            const me = data.players.find((p: any) => p.id === playerId);
            if (me) setMyTeam(me.team);
          }
          // Auto-advance to game when host starts
          if (data.phase === 'question' && phase === 'team-select') {
            setPhase('game');
          }
        }
      } catch {}
    };
    fetchGame();
    const interval = setInterval(fetchGame, 1000); // Poll every 1 second
    return () => clearInterval(interval);
  }, [gameId]);
  const allQs = [...defaultQuestions, ...customQs];
  const getQ = () => allQs[Math.floor(Math.random() * allQs.length)];

  useEffect(() => { if (result && phase === 'game') { const t = setTimeout(() => setResult(null), 2000); return () => clearTimeout(t); } }, [result, phase]);
  useEffect(() => { const int = setInterval(() => setBgIndex(i => (i+1)%6), 10000); return () => clearInterval(int); }, []);
  const PolaroidBg = () => { const visible = bgImages.map((_, i) => { const diff = (i - bgIndex + 6) % 6; return diff < 4; }); const positions = [{ top: '12%', left: '10%' }, { top: '12%', left: '55%' }, { top: '60%', left: '10%' }, { top: '60%', left: '55%' }, { top: '12%', left: '32%' }, { top: '60%', left: '32%' }]; return <div className="fixed inset-0 bg-cyan-950 overflow-hidden pointer-events-none">{bgImages.map((img, i) => <div key={i} className="absolute transition-opacity duration-[2000ms]" style={{backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', width: '220px', height: '270px', top: positions[i].top, left: positions[i].left, transform: `rotate(${-3 + (i*1.5)}deg)`, opacity: visible[i] ? 0.95 : 0, boxShadow: '5px 5px 20px rgba(0,0,0,0.7)', border: '6px solid white', padding: '4px', backgroundColor: 'white', zIndex: visible[i] ? 10 - Math.abs(i - bgIndex) : 0}} />)}<div className="absolute inset-0 bg-cyan-950/40" /></div>; };

  const assignPlayer = async (playerId: string, team: string) => {
    if (!gameId) return;
    try {
      await fetch(API_BASE + '/game/' + gameId + '/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, team })
      });
    } catch {}
  };

  const startGame = async () => { 
    if (!isHost || !gameId) {
      setError('Only the host can start the game.');
      return;
    }

    const players = ((gameState as any)?.players || []) as any[];
    const blueCount = players.filter((p: any) => p.team === 'blue').length;
    const redCount = players.filter((p: any) => p.team === 'red').length;
    if (blueCount === 0 || redCount === 0) {
      setError('Assign at least one player to each team before starting.');
      return;
    }

    try {
      setStartingGame(true);
      const res = await fetch(API_BASE + '/game/' + gameId + '/start', { method: 'POST' });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Start failed (${res.status})`);
      }
      setCoinResult(null);
      setSelectedCall(null);
      setPhase('coin-toss');
    } catch (e: any) {
      setError(`Could not start game: ${String(e?.message || 'unknown error')}`);
    } finally {
      setStartingGame(false);
    }
  };
  
  const flip = async (call: 'heads'|'tails') => {
    if (!gameId) return;
    setSelectedCall(call);
    setFlipping(true);
    sfx.correct();
    setTimeout(() => {
      const r: 'heads'|'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
      setCoinResult(r);
      setFlipping(false);
      setTimeout(async () => {
        const q = getQ();
        const w: Team = r === call ? 'blue' : 'red';
        const newState: any = {
          phase: 'question', currentQuestionId: 1, question: q.question,
          answers: q.answers.map((a: any) => ({...a, revealed: false})),
          currentTeam: w, round: (gameState?.round || 0) + 1,
          blueTeam: { name: blueName, score: gameState?.blueTeam?.score || 0, strikes: 0, correctGuesses: [] },
          redTeam: { name: redName, score: gameState?.redTeam?.score || 0, strikes: 0, correctGuesses: [] },
          totalPossiblePoints: 0
        };
        setGameState({...gameState, ...newState});
        setPhase('game');
        sfx.gameStart();
        setTimeLeft(30);
        setStreak(0);
        // Sync to server
        try {
          await fetch(API_BASE + '/game/' + gameId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newState)
          });
        } catch {}
      }, 2000);
    }, 1500);
  };

  const submit = async () => {
    if (!gameState || !guess.trim() || !gameId) return;
    const g = guess.toLowerCase().trim();
    const i = gameState?.answers.findIndex(a => a.text.toLowerCase() === g && !a.revealed);
    if (i >= 0) {
      sfx.correct();
      const a = [...gameState?.answers];
      a[i] = {...a[i], revealed: true};
      const pts = a[i].points;
      const ns = streak + 1;
      const bn = ns >= 3 ? Math.floor(pts * 0.5) : 0;
      const tp = pts + bn;
      if (bn > 0) { setBonus(true); sfx.streak(); setTimeout(() => setBonus(false), 1500); }
      const ts = gameState?.currentTeam === 'blue' ? gameState?.blueTeam.score + tp : gameState?.redTeam.score + tp;
      const all = a.every(x => x.revealed);
      const newState: any = {
        answers: a,
        blueTeam: {...gameState?.blueTeam, score: gameState?.currentTeam === 'blue' ? ts : gameState?.blueTeam.score},
        redTeam: {...gameState?.redTeam, score: gameState?.currentTeam === 'red' ? ts : gameState?.redTeam.score},
        phase: all ? 'round-end' : 'question'
      };
      setGameState({...gameState, ...newState});
      setResult({ correct: true, answer: a[i].text, points: tp, blueScore: gameState?.currentTeam === 'blue' ? ts : gameState?.blueTeam.score, redScore: gameState?.currentTeam === 'red' ? ts : gameState?.redTeam.score });
      setStreak(ns);
      setTimeLeft(30);
      if (all) setTimeout(() => sfx.roundEnd(), 500);
      // Sync to server
      try {
        await fetch(API_BASE + '/game/' + gameId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newState)
        });
      } catch {}
    } else {
      sfx.strike();
      setStreak(0);
      const ns = gameState?.currentTeam === 'blue' ? gameState?.blueTeam.strikes + 1 : gameState?.redTeam.strikes + 1;
      let newState: any = {};
      if (ns >= 3) {
        const o = gameState?.currentTeam === 'blue' ? 'red' : 'blue';
        newState = {
          currentTeam: o,
          blueTeam: {...gameState?.blueTeam, strikes: gameState?.currentTeam === 'blue' ? ns : gameState?.blueTeam.strikes},
          redTeam: {...gameState?.redTeam, strikes: gameState?.currentTeam === 'red' ? ns : gameState?.redTeam.strikes}
        };
      } else {
        newState = {
          blueTeam: {...gameState?.blueTeam, strikes: gameState?.currentTeam === 'blue' ? ns : gameState?.blueTeam.strikes},
          redTeam: {...gameState?.redTeam, strikes: gameState?.currentTeam === 'red' ? ns : gameState?.redTeam.strikes}
        };
      }
      setGameState({...gameState, ...newState});
      setResult({ correct: false, strike: true });
      // Sync to server
      try {
        await fetch(API_BASE + '/game/' + gameId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newState)
        });
      } catch {}
    }
    setGuess('');
  };

  const createGame = async () => {
    try {
      const res = await fetch(API_BASE + '/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: 'Host' })
      });
      const data = await res.json();
      setPin(data.pin);
      setIsHost(true);
      setGameId(data.gameId);
      setPhase('team-select');
    } catch (e) {
      console.error('Failed to create game:', e);
      // Fallback to local
      const p = genPin();
      setPin(p);
      setIsHost(true);
      const q = getQ();
      setGameState({
        phase: 'question', currentQuestionId: 1, question: q.question,
        answers: q.answers.map((a: any) => ({...a, revealed: false})),
        currentTeam: 'blue', round: 1,
        blueTeam: { name: 'Blue Team', score: 0, strikes: 0, correctGuesses: [] },
        redTeam: { name: 'Red Team', score: 0, strikes: 0, correctGuesses: [] },
        totalPossiblePoints: 0
      });
      setPhase('team-select');
    }
  };

  // Render Menu
  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl bg-slate-900/60 border border-cyan-500/30 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-sm">
          <h1 className="text-5xl md:text-7xl font-black text-cyan-400 mb-3 text-center" style={{textShadow: '4px 4px 0 #000'}}>OFFICE FEUD</h1>
          <p className="text-center text-cyan-100/80 mb-10 text-lg">Build teams. Battle rounds. Office glory.</p>
          <div className="space-y-4 max-w-md mx-auto">
            <button onClick={() => { setIsHost(true); setPhase('setup'); }} className="w-full bg-cyan-500 hover:bg-cyan-400 transition text-black font-black text-2xl px-8 py-5 rounded-xl" style={{boxShadow: '6px 6px 0 #000'}}>HOST GAME</button>
            <button onClick={() => { const p = prompt('Enter PIN'); if (p) { setPin(p); setIsHost(false); setPhase('join'); }}} className="w-full bg-green-600 hover:bg-green-500 transition text-white font-bold text-xl px-8 py-4 rounded-xl">JOIN GAME</button>
          </div>
        </div>
      </div>
    );
  }

  // Render Host Setup
  if (phase === 'setup') {
    const handleStart = async () => {
      if (!playerName.trim() || !playerEmail.trim()) return;
      try {
        const res = await fetch(API_BASE + '/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostName: playerName.trim(), hostEmail: playerEmail.trim(), blueName: 'Blue Team', redName: 'Red Team' })
        });
        const data = await res.json();
        setPin(data.pin);
        setGameId(data.gameId);
        setPlayerId(data.playerId);
        setMyTeam(null); // host not assigned yet
        setPhase('team-select');
      } catch (e) {
        console.error('Create failed:', e);
      }
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-8 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-black text-cyan-400 mb-8">SET UP GAME</h1>
        <div className="bg-slate-900/70 border border-cyan-500/25 p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Your Nickname" className="w-full bg-gray-800 border border-gray-600 text-white text-xl p-3 rounded-xl mb-3" />
          <input value={playerEmail} onChange={e => setPlayerEmail(e.target.value)} placeholder="Your Email" type="email" className="w-full bg-gray-800 border border-gray-600 text-white text-xl p-3 rounded-xl mb-4" />
          <button onClick={handleStart} disabled={!playerName.trim() || !playerEmail.trim()} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 transition text-black font-bold text-xl px-8 py-4 rounded-xl w-full">CREATE GAME</button>
        </div>
        <button onClick={() => setPhase('menu')} className="mt-4 text-gray-400 hover:text-white transition">Back</button>
      </div>
    );
  }

  // Render Join
  if (phase === 'join') {
    const [email, setEmail] = useState('');
    const [playerName, setPlayerName] = useState('');
    const handleJoin = async () => {
      if (!playerName.trim() || !email.trim()) return;
      try {
        const res = await fetch(API_BASE + '/game/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, playerName: playerName.trim(), email: email.trim() })
        });
        const data = await res.json();
        if (data.gameId) {
          setGameId(data.gameId);
          setPlayerId(data.playerId);
          setMyTeam(null);
          setPhase('team-select');
        }
      } catch (e) {
        console.error('Join failed:', e);
        setPhase('team-select');
      }
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-8 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-black text-green-400 mb-8">JOIN GAME</h1>
        <div className="bg-slate-900/70 border border-green-500/30 p-8 rounded-2xl text-center w-full max-w-md shadow-2xl">
          <p className="text-white mb-4 text-lg">PIN: <span className="font-black text-green-300">{pin}</span></p>
          <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Your Nickname" className="w-full bg-gray-800 border border-gray-600 text-white text-xl p-3 rounded-xl mb-3" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your Email" type="email" className="w-full bg-gray-800 border border-gray-600 text-white text-xl p-3 rounded-xl mb-4" />
          <button onClick={handleJoin} disabled={!playerName.trim() || !email.trim()} className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 transition text-white font-bold text-xl px-8 py-4 rounded-xl w-full">JOIN</button>
        </div>
      </div>
    );
  }

  // Render Team Select
  if (phase === 'team-select') {
    const gs: any = gameState || {};
    const players: any[] = (gs && gs.players) || [];
    const unassigned = players.filter((p: any) => !p.team);
    const bluePlayers = players.filter((p: any) => p.team === 'blue');
    const redPlayers = players.filter((p: any) => p.team === 'red');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-8">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setPhase('menu')} className="text-gray-400">Back</button>
          <h1 className="text-3xl font-black text-cyan-400">TEAM SELECT</h1>
          {pin && <div className="bg-green-600 px-4 py-2 rounded-lg"><p className="text-xs text-green-200">GAME PIN</p><p className="text-2xl font-black text-white">{pin}</p></div>}
        </div>
        
        {/* Unassigned Players */}
        {unassigned.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <h3 className="text-white font-bold mb-2">👥 Players Waiting</h3>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded-lg">
                  <span className="text-white">{p.name}</span>
                  {isHost && (
                    <div className="flex gap-1">
                      <button onClick={() => assignPlayer(p.id, 'blue')} className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Blue</button>
                      <button onClick={() => assignPlayer(p.id, 'red')} className="bg-red-500 text-white text-xs px-2 py-1 rounded">Red</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Blue Team */}
          <div className="bg-blue-600 rounded-xl p-6">
            <input value={blueName} onChange={async e => { setBlueName(e.target.value); if (isHost && gameId) { try { await fetch(API_BASE + '/game/' + gameId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blueTeam: { ...gameState?.blueTeam, name: e.target.value } }) }); } catch {} } }} className="w-full bg-blue-700 text-white text-2xl font-bold text-center p-3 rounded-lg mb-3" />
            <div className="flex flex-wrap gap-2">
              {bluePlayers.map((p: any) => (
                <span key={p.id} className="bg-blue-800 text-white px-3 py-1 rounded-full text-sm">{p.name}</span>
              ))}
            </div>
          </div>
          
          {/* Red Team */}
          <div className="bg-red-600 rounded-xl p-6">
            <input value={redName} onChange={async e => { setRedName(e.target.value); if (isHost && gameId) { try { await fetch(API_BASE + '/game/' + gameId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redTeam: { ...gameState?.redTeam, name: e.target.value } }) }); } catch {} } }} className="w-full bg-red-700 text-white text-2xl font-bold text-center p-3 rounded-lg mb-3" />
            <div className="flex flex-wrap gap-2">
              {redPlayers.map((p: any) => (
                <span key={p.id} className="bg-red-800 text-white px-3 py-1 rounded-full text-sm">{p.name}</span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="text-center space-y-4">
          <button onClick={() => sfx.intro()} className="bg-cyan-600 text-white font-bold text-xl px-8 py-3 rounded-lg">Play Intro</button>
          <div className="flex items-center justify-center gap-3"><span className="text-white font-bold">Timer</span><button onClick={async () => { setTimerOn(!timerOn); if (isHost && gameId) { try { await fetch(API_BASE + '/game/' + gameId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timerEnabled: !timerOn }) }); } catch {} } }} className={`w-14 h-8 rounded-full ${timerOn ? 'bg-green-500' : 'bg-gray-600'}`}><div className={`w-6 h-6 bg-white rounded-full transform ${timerOn ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
          <br />
          <button onClick={startGame} disabled={startingGame} className="bg-cyan-500 disabled:bg-gray-600 text-black font-black text-3xl px-16 py-6 rounded-lg" style={{boxShadow: '6px 6px 0 #000'}}>{startingGame ? 'STARTING...' : 'START GAME'}</button>
        </div>
      </div>
    );
  }

  // Render Coin Toss
  if (phase === 'coin-toss') {
    const coinClass = coinResult === 'heads' ? 'bg-cyan-500' : 'bg-gray-600';
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-8 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-black text-cyan-400 mb-12">COIN TOSS</h1>
        <div className="mb-12">
          {flipping ? <div className="w-40 h-40 bg-cyan-500 rounded-full flex items-center justify-center text-6xl animate-spin">?</div> :
           coinResult ? <div className={`w-40 h-40 rounded-full flex items-center justify-center text-6xl font-black ${coinClass}`}>{coinResult === 'heads' ? 'H' : 'T'}</div> :
           <div className="w-40 h-40 bg-gray-700 rounded-full flex items-center justify-center text-6xl">?</div>}
        </div>
        {coinResult && <p className="text-2xl font-bold text-white mb-8">{coinResult.toUpperCase()}! {coinResult === selectedCall ? <span className="text-green-400">{blueName} starts!</span> : <span className="text-red-400">{redName} starts!</span>}</p>}
        {!coinResult && !flipping && <div className="flex gap-8"><button onClick={() => flip('heads')} className="bg-cyan-500 text-black font-black text-2xl px-8 py-4 rounded-lg">HEADS</button><button onClick={() => flip('tails')} className="bg-gray-400 text-black font-black text-2xl px-8 py-4 rounded-lg">TAILS</button></div>}
      </div>
    );
  }

  // Render Game
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-8">
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => setPhase('menu')} className="text-gray-400">Quit</button>
        <div className="text-center">
          {pin && <div className="bg-green-600 px-3 py-1 rounded mb-2"><p className="text-xs text-green-200">PIN: {pin}</p></div>}
          <p className="text-gray-400">ROUND {gameState?.round || 1}</p>
          {timerOn && gameState?.phase === 'question' && <div className={`text-4xl font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-cyan-400'}`}>{timeLeft}</div>}
          {streak > 0 && <div className="text-xl font-bold text-green-400">{streak} STREAK!</div>}
        </div>
      </div>
      <div className="flex justify-between items-center mb-8">
        <div className={`text-center ${gameState?.currentTeam === 'blue' ? 'ring-4 ring-blue-400' : ''} bg-blue-600 p-4 rounded-lg`}>
          <h2 className="text-white font-bold text-xl">{gameState?.blueTeam.name || blueName}</h2>
          <p className="text-4xl font-black text-white">{gameState?.blueTeam.score || 0}</p>
          <div className="flex gap-1 mt-2">{[0,1,2].map(i => <span key={i} className={`text-2xl ${i < (gameState?.blueTeam.strikes || 0) ? 'text-red-500' : 'text-gray-600'}`}>X</span>)}</div>
        </div>
        <div className="text-center"><h1 className="text-2xl font-black text-cyan-400">{gameState?.currentTeam?.toUpperCase() || 'BLUE'} TEAM</h1></div>
        <div className={`text-center ${gameState?.currentTeam === 'red' ? 'ring-4 ring-red-400' : ''} bg-red-600 p-4 rounded-lg`}>
          <h2 className="text-white font-bold text-xl">{gameState?.redTeam.name || redName}</h2>
          <p className="text-4xl font-black text-white">{gameState?.redTeam.score || 0}</p>
          <div className="flex gap-1 mt-2">{[0,1,2].map(i => <span key={i} className={`text-2xl ${i < (gameState?.redTeam.strikes || 0) ? 'text-red-500' : 'text-gray-600'}`}>X</span>)}</div>
        </div>
      </div>
      <div className="bg-black border-4 border-cyan-400 rounded-lg p-6 mb-8 text-center">
        <p className="text-white text-2xl font-bold">{gameState?.question || 'Loading...'}</p>
      </div>
      <div className="max-w-4xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-2 gap-3">
        {gameState?.answers.map((a, i) => (
          <div key={i} className={`flex items-center justify-between p-4 rounded-lg font-bold ${a.revealed ? (i % 2 === 0 ? 'bg-blue-600' : 'bg-red-600') : 'bg-gray-800 border-2 border-gray-600'}`}>
            <span className="flex items-center gap-3"><span className="bg-black text-white w-10 h-10 flex items-center justify-center rounded">{i+1}</span><span className={a.revealed ? 'text-white' : 'text-gray-500'}>{a.revealed ? a.text : '****'}</span></span>
            {a.revealed && <span className="text-3xl font-black text-cyan-300">{a.points}</span>}
          </div>
        ))}
      </div>
      {gameState?.phase === 'question' && myTeam === gameState?.currentTeam && <div className="max-w-2xl mx-auto flex gap-4"><input value={guess} onChange={e => setGuess(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Type guess..." className="flex-1 bg-gray-800 border-4 border-gray-600 text-white text-xl p-4 rounded-lg" autoFocus /><button onClick={submit} className="bg-cyan-500 text-black font-black text-xl px-8 py-4 rounded-lg">GUESS</button></div>}
      {gameState?.phase === 'question' && myTeam !== gameState?.currentTeam && <p className="text-center text-gray-400">{gameState?.currentTeam === 'blue' ? blueName : redName}'s turn to guess!</p>}
      {gameState?.phase === 'question' && !myTeam && <p className="text-center text-gray-400">Ask host to assign you to a team!</p>}
      {result && <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50"><div className={`text-center p-12 rounded-xl ${result.correct ? 'bg-green-600' : 'bg-red-600'} ${!result.correct ? 'animate-pulse' : ''}`}>{result.correct ? (<><p className="text-6xl">OK</p><p className="text-white text-3xl font-bold">{result.answer}</p><p className="text-cyan-300 text-4xl font-black">+{result.points}</p>{bonus && streak >= 3 && <p className="text-orange-300 text-2xl">BONUS!</p>}</>) : (<><p className="text-9xl">X</p><p className="text-white text-3xl font-bold">STRIKE!</p></>)}</div></div>}
    </div>
  );
}
