import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Crown, MousePointer2, Zap, User, Lock, LogOut, UserPlus, Keyboard, Info, X, Settings, RefreshCw, Minimize2, Map, Maximize, Palette, Eye, Shield } from 'lucide-react';
import { GameCanvas } from './components/GameCanvas';
import { Duck, ControlMode, GameMode, Skin, Theme } from './types';
import { SKINS } from './constants';

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER' | 'AUTH' | 'LOBBY';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [selectedLobbyId, setSelectedLobbyId] = useState<number | null>(null);
  const [controlMode, setControlMode] = useState<ControlMode>(
    (localStorage.getItem('duck_control_mode') as ControlMode) || 'FOLLOW'
  );
  const [isBoosting, setIsBoosting] = useState(false);
  const [playerName, setPlayerName] = useState('MamaDuck');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('duck_token'));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string, score: number }[]>([]);
  const [powerUps, setPowerUps] = useState({
    inventory: { SPEED: 0, VISION: 0, MAGNET: 0, SUPER: 0 },
    active: { SPEED: 0, VISION: 0, MAGNET: 0, SUPER: 0 }
  });
  const [powerUpToActivate, setPowerUpToActivate] = useState<'SPEED' | 'VISION' | 'MAGNET' | 'SUPER' | null>(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<{ name: string, score: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showControlMenu, setShowControlMenu] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [invertControls, setInvertControls] = useState(
    localStorage.getItem('duck_invert_controls') === 'true'
  );
  const [gameMode, setGameMode] = useState<GameMode>(
    (localStorage.getItem('duck_game_mode') as GameMode) || 'NORMAL'
  );
  const [showCostumes, setShowCostumes] = useState(false);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(['default']);
  const [currentSkinId, setCurrentSkinId] = useState<string>(
    localStorage.getItem('duck_current_skin') || 'default'
  );
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('duck_theme') as Theme) || 'NAVY'
  );
  const [showDropAlert, setShowDropAlert] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [infoClickCount, setInfoClickCount] = useState(0);
  const [devModeExitClickCount, setDevModeExitClickCount] = useState(0);

  const [showLeaderboardInPanel, setShowLeaderboardInPanel] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('duck_username');
    if (savedName) setPlayerName(savedName);
    
    const savedHighScore = localStorage.getItem('duck_highscore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore));

    fetchGlobalLeaderboard();
  }, []);

  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setGlobalLeaderboard(data);
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');

      if (!isRegistering) {
        setToken(data.token);
        setHighScore(data.highScore);
        if (data.skins) {
          const skins = data.skins.split(',');
          setUnlockedSkins(skins);
        }
        localStorage.setItem('duck_token', data.token);
        localStorage.setItem('duck_username', data.username);
        setGameState('MENU');
      } else {
        setIsRegistering(false);
        setError("Account created! Please login.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUnlockedSkins(['default']);
    setCurrentSkinId('default');
    localStorage.removeItem('duck_token');
    localStorage.removeItem('duck_username');
    localStorage.removeItem('duck_current_skin');
    // Revert to NAVY theme if current theme is locked
    if (theme === 'BLACK' || theme === 'PINK') {
      setTheme('NAVY');
      localStorage.setItem('duck_theme', 'NAVY');
    }
    setGameState('MENU');
  };

  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    if (newCount >= 20 && !unlockedSkins.includes('secret_red_white')) {
      unlockSkin('secret_red_white');
      alert("🎉 GİZLİ KOSTÜM AÇILDI: Kırmızı-Beyaz!");
    }
  };

  const unlockSkin = async (skinId: string) => {
    if (unlockedSkins.includes(skinId)) return;
    
    const newUnlocked = [...unlockedSkins, skinId];
    setUnlockedSkins(newUnlocked);
    
    if (token) {
      try {
        await fetch('/api/skins', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ skins: newUnlocked.join(',') }),
        });
      } catch (err) {
        console.error("Failed to sync skins", err);
      }
    }
  };

  const buySkin = (skin: Skin) => {
    if (highScore >= skin.price) {
      unlockSkin(skin.id);
    } else {
      alert(`Bu kostüm için ${skin.price} puana ihtiyacın var! (En yüksek puanın: ${highScore})`);
    }
  };

  const selectSkin = (skinId: string) => {
    setCurrentSkinId(skinId);
    localStorage.setItem('duck_current_skin', skinId);
  };

  const toggleControlMode = () => {
    const modes: ControlMode[] = ['FOLLOW', 'JOYSTICK', 'KEYBOARD'];
    const currentIndex = modes.indexOf(controlMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const newMode = modes[nextIndex];
    setControlMode(newMode);
    localStorage.setItem('duck_control_mode', newMode);
  };

  const selectControlMode = (mode: ControlMode) => {
    setControlMode(mode);
    localStorage.setItem('duck_control_mode', mode);
    setShowControlMenu(false);
  };

  const toggleInvertControls = () => {
    const newValue = !invertControls;
    setInvertControls(newValue);
    localStorage.setItem('duck_invert_controls', newValue.toString());
  };

  const changeTheme = (newTheme: Theme) => {
    if ((newTheme === 'BLACK' || newTheme === 'PINK') && !token && !devMode) {
      setError("Bu temayı kullanmak için giriş yapmalısın!");
      return;
    }
    setTheme(newTheme);
    localStorage.setItem('duck_theme', newTheme);
  };

  const handleDropSpawned = () => {
    setShowDropAlert(true);
    setTimeout(() => setShowDropAlert(false), 3000);
  };

  const selectGameMode = (mode: GameMode) => {
    setGameMode(mode);
    localStorage.setItem('duck_game_mode', mode);
  };

  const startLobby = (lobbyId: number) => {
    const lobby = [
      { id: 1, allowGuest: true },
      { id: 2, allowGuest: false },
      { id: 3, allowGuest: false }
    ].find(l => l.id === lobbyId);

    if (lobby && !lobby.allowGuest && !token) {
      setError("Bu lobiye girmek için giriş yapmalısın!");
      setGameState('AUTH');
      return;
    }

    setSelectedLobbyId(lobbyId);
    setScore(0);
    setGameState('PLAYING');
  };

  const startGame = () => {
    setGameState('LOBBY');
  };

  const handleGameOver = async (finalScore: number) => {
    setScore(finalScore);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('duck_highscore', finalScore.toString());
    }

    if (token) {
      try {
        await fetch('/api/scores', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ score: finalScore }),
        });
        fetchGlobalLeaderboard();
      } catch (err) {
        console.error("Failed to submit score", err);
      }
    }
    setGameState('GAMEOVER');
  };

  const getThemeBgClass = () => {
    switch (theme) {
      case 'BLACK': return 'bg-black';
      case 'WHITE': return 'bg-white';
      case 'PINK': return 'bg-[#fbcfe8]';
      default: return 'bg-[#083344]';
    }
  };

  const getOverlayBgClass = () => {
    switch (theme) {
      case 'BLACK': return 'bg-black/95';
      case 'WHITE': return 'bg-white/90';
      case 'PINK': return 'bg-pink-50/95';
      default: return 'bg-cyan-950/90';
    }
  };

  const getTextColorClass = () => {
    if (theme === 'PINK') return 'text-pink-950';
    return theme === 'WHITE' ? 'text-black' : 'text-white';
  };

  const getMutedTextColorClass = () => {
    if (theme === 'PINK') return 'text-pink-900/60';
    return theme === 'WHITE' ? 'text-black/60' : 'text-cyan-200/60';
  };

  return (
    <div className={`relative w-full h-screen overflow-hidden ${getThemeBgClass()} font-sans selection:bg-cyan-500/30`}>
      {devMode && (
        <div 
          className="absolute top-4 left-4 z-[200] cursor-pointer active:scale-95 transition-transform"
          onClick={() => {
            const newCount = devModeExitClickCount + 1;
            setDevModeExitClickCount(newCount);
            if (newCount >= 5) {
              setDevMode(false);
              setDevModeExitClickCount(0);
              setInfoClickCount(0);
              // Reset powerups to 0 on exit if they were 999
              setPowerUps({
                inventory: { SPEED: 0, VISION: 0, MAGNET: 0, SUPER: 0 },
                active: { SPEED: 0, VISION: 0, MAGNET: 0, SUPER: 0 }
              });
            }
          }}
        >
          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Test Modu Aktif</span>
          </div>
        </div>
      )}
      <AnimatePresence>
        {showDropAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="absolute top-20 left-1/2 z-[100] bg-yellow-400 text-cyan-900 px-6 py-3 rounded-full font-black uppercase tracking-widest shadow-2xl flex items-center gap-3"
          >
            <Palette className="w-6 h-6" />
            Hediye Kutusu Düştü!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {gameState === 'MENU' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`absolute inset-0 z-10 overflow-y-auto ${getOverlayBgClass()} backdrop-blur-sm custom-scrollbar`}
          >
            <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-6">
              <div className="max-w-5xl w-full flex flex-col md:flex-row gap-4 md:gap-8 items-stretch">
                {/* Left Side: Main Menu */}
                <div className={`flex-[1.2] space-y-4 md:space-y-6 ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/10 border-white/10'} backdrop-blur-md rounded-[1.5rem] md:rounded-[2.5rem] border p-4 md:p-8 relative overflow-hidden group`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-yellow-400 opacity-50" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-400 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl shadow-yellow-400/20 rotate-3 group-hover:rotate-6 transition-transform cursor-pointer" onClick={handleLogoClick}>
                      <Crown className="w-8 h-8 md:w-10 md:h-10 text-cyan-900 fill-current" />
                    </div>
                    <div className="text-left cursor-pointer select-none" onClick={handleLogoClick}>
                      <h1 className={`text-2xl md:text-4xl font-black ${getTextColorClass()} uppercase tracking-tighter leading-none italic`}>Duck.io</h1>
                      <p className={`${getMutedTextColorClass()} font-bold text-[10px] md:text-xs uppercase tracking-widest`}>The Ultimate Pond</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowThemeMenu(true)}
                      className={`p-2 md:p-3 bg-yellow-400 text-cyan-900 rounded-xl md:rounded-2xl border border-yellow-500 shadow-lg shadow-yellow-400/20 transition-all hover:scale-110 active:scale-95 group/theme`}
                      title="Temayı Değiştir"
                    >
                      <Palette className="w-5 h-5 md:w-6 md:h-6 group-hover/theme:rotate-12 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowSettings(true)}
                      className={`p-2 md:p-3 ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10 text-black/60 hover:text-black' : 'bg-white/5 border-white/5 text-white/60 hover:text-white'} rounded-xl md:rounded-2xl border transition-all hover:rotate-90`}
                    >
                      <Settings className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 md:space-y-4">
                  {token ? (
                    <div className="flex flex-col gap-3 md:gap-4">
                      <div className={`flex items-center justify-between ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'} p-3 md:p-4 rounded-xl md:rounded-2xl border`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-400/20 rounded-lg md:rounded-xl flex items-center justify-center">
                            <User className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                          </div>
                          <div className="text-left">
                            <div className="text-[8px] md:text-[10px] font-black text-cyan-400 uppercase tracking-widest">Player</div>
                            <div className={`text-sm md:text-lg font-black ${getTextColorClass()}`}>{playerName}</div>
                          </div>
                        </div>
                        <button onClick={handleLogout} className="p-2 hover:bg-red-500/20 rounded-lg md:rounded-xl text-red-400 transition-colors">
                          <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                      <button
                        onClick={startGame}
                        className="w-full bg-yellow-400 hover:bg-yellow-300 text-cyan-900 font-black py-4 md:py-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 shadow-xl shadow-yellow-400/20 text-lg md:text-xl uppercase tracking-tight"
                      >
                        <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                        Start Quacking
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <button
                        onClick={() => setGameState('AUTH')}
                        className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10 text-black' : 'bg-white/10 border-white/10 text-white'} hover:bg-opacity-20 font-black py-4 md:py-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 border text-base md:text-lg uppercase tracking-tight`}
                      >
                        <User className="w-4 h-4 md:w-5 md:h-5" />
                        Login
                      </button>
                      <button
                        onClick={startGame}
                        className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 font-black py-4 md:py-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 border border-yellow-400/20 text-base md:text-lg uppercase tracking-tight"
                      >
                        <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                        Guest
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'} p-3 md:p-4 rounded-xl md:rounded-2xl border`}>
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Your Best</div>
                    <div className={`text-xl md:text-2xl font-black ${getTextColorClass()}`}>{highScore}</div>
                  </div>
                  <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'} p-3 md:p-4 rounded-xl md:rounded-2xl border relative`}>
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Kostümler</div>
                    <button 
                      onClick={() => setShowCostumes(true)}
                      className={`w-full h-full flex items-center justify-center gap-2 ${getTextColorClass()} hover:text-yellow-400 transition-colors`}
                    >
                      <Palette className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="text-[10px] font-black uppercase">Seç</span>
                    </button>
                  </div>
                </div>

                <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'} p-3 md:p-4 rounded-xl md:rounded-2xl border space-y-2 md:space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Kontroller</div>
                    <div className="flex gap-1 md:gap-2">
                      {(['FOLLOW', 'JOYSTICK', 'KEYBOARD'] as ControlMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => selectControlMode(mode)}
                          className={`p-1.5 md:p-2 rounded-lg transition-all ${controlMode === mode ? 'bg-yellow-400 text-cyan-900' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black/40 hover:bg-black/10' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                          title={mode}
                        >
                          {mode === 'FOLLOW' && <MousePointer2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                          {mode === 'JOYSTICK' && <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                          {mode === 'KEYBOARD' && <Keyboard className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'} p-3 md:p-4 rounded-xl md:rounded-2xl border space-y-2 md:space-y-3`}>
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Harita Modu</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => selectGameMode('SMALL')}
                      className={`flex flex-col items-center justify-center gap-1 py-2 md:py-3 rounded-lg md:rounded-xl transition-all font-bold text-[8px] md:text-[10px] uppercase ${gameMode === 'SMALL' ? 'bg-yellow-400 text-cyan-900 shadow-lg shadow-yellow-400/20' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black/60 hover:bg-black/10' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                      <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      Küçük
                    </button>
                    <button
                      onClick={() => selectGameMode('NORMAL')}
                      className={`flex flex-col items-center justify-center gap-1 py-2 md:py-3 rounded-lg md:rounded-xl transition-all font-bold text-[8px] md:text-[10px] uppercase ${gameMode === 'NORMAL' ? 'bg-yellow-400 text-cyan-900 shadow-lg shadow-yellow-400/20' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black/60 hover:bg-black/10' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                      <Map className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      Normal
                    </button>
                    <button
                      onClick={() => selectGameMode('LARGE')}
                      className={`flex flex-col items-center justify-center gap-1 py-2 md:py-3 rounded-lg md:rounded-xl transition-all font-bold text-[8px] md:text-[10px] uppercase ${gameMode === 'LARGE' ? 'bg-yellow-400 text-cyan-900 shadow-lg shadow-yellow-400/20' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black/60 hover:bg-black/10' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                      <Maximize className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      Büyük
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowUpdates(true)}
                  className={`w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5 text-black/60 hover:text-black' : 'bg-white/5 border-white/5 text-white/60 hover:text-white'} py-2 md:py-3 rounded-xl md:rounded-2xl border flex items-center justify-center gap-2 transition-all text-[10px] md:text-xs font-bold uppercase tracking-widest relative`}
                >
                  <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Güncelleme Notları
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-cyan-900 text-[8px] px-1.5 py-0.5 rounded-full font-black animate-pulse">YENİ</span>
                </button>
              </div>

              {/* Right Side: Leaderboard or Mini Menu */}
              <div className={`flex-1 ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-black/20 border-white/10'} backdrop-blur-md rounded-[1.5rem] md:rounded-[2.5rem] border p-4 md:p-8 space-y-4 md:space-y-6 flex flex-col`}>
                {token ? (
                  <div className="flex flex-col h-full">
                    <div className={`flex items-center justify-between border-b ${(theme === 'WHITE' || theme === 'PINK') ? 'border-black/10' : 'border-white/10'} pb-3 md:pb-4 mb-4`}>
                      <div className="flex items-center gap-3">
                        {showLeaderboardInPanel ? <Trophy className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" /> : <User className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />}
                        <h2 className={`text-lg md:text-xl font-black ${getTextColorClass()} uppercase tracking-tight`}>
                          {showLeaderboardInPanel ? 'Global Sıralama' : 'Oyuncu Paneli'}
                        </h2>
                      </div>
                      <button 
                        onClick={() => setShowLeaderboardInPanel(!showLeaderboardInPanel)}
                        className={`p-2 rounded-lg transition-all ${(theme === 'WHITE' || theme === 'PINK') ? 'hover:bg-black/5 text-black/40' : 'hover:bg-white/10 text-white/40'}`}
                        title={showLeaderboardInPanel ? "Panele Dön" : "Sıralamayı Gör"}
                      >
                        {showLeaderboardInPanel ? <User className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {showLeaderboardInPanel ? (
                      <div className="space-y-2 md:space-y-3 overflow-y-auto max-h-[300px] md:max-h-[450px] pr-2 custom-scrollbar">
                        {globalLeaderboard.length > 0 ? globalLeaderboard.map((entry, i) => (
                          <div key={i} className={`flex items-center justify-between ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'} p-3 md:p-4 rounded-xl md:rounded-2xl border group hover:bg-opacity-10 transition-colors`}>
                            <div className="flex items-center gap-3 md:gap-4">
                              <span className={`w-5 md:w-6 text-xs md:text-sm font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : (theme === 'WHITE' || theme === 'PINK') ? 'text-black/20' : 'text-white/20'}`}>
                                {i + 1}
                              </span>
                              <span className={`text-sm md:text-base font-bold ${getTextColorClass()} group-hover:text-yellow-400 transition-colors truncate max-w-[100px] md:max-w-none`}>{entry.name}</span>
                            </div>
                            <span className={`text-xs md:text-sm font-black tabular-nums ${getMutedTextColorClass()}`}>{entry.score}</span>
                          </div>
                        )) : (
                          <div className={`text-center py-6 md:py-8 ${getMutedTextColorClass()} font-bold uppercase tracking-widest text-xs md:text-sm`}>
                            No scores yet
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5' : 'bg-white/5'} p-4 rounded-2xl border ${(theme === 'WHITE' || theme === 'PINK') ? 'border-black/5' : 'border-white/5'}`}>
                            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">En Yüksek</div>
                            <div className={`text-xl font-black ${getTextColorClass()}`}>{highScore}</div>
                          </div>
                          <div className={`${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5' : 'bg-white/5'} p-4 rounded-2xl border ${(theme === 'WHITE' || theme === 'PINK') ? 'border-black/5' : 'border-white/5'}`}>
                            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Sıralama</div>
                            <div className={`text-xl font-black ${getTextColorClass()}`}>
                              #{globalLeaderboard.findIndex(e => e.name === playerName) + 1 || '??'}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className={`text-[10px] font-bold ${getMutedTextColorClass()} uppercase tracking-widest ml-1`}>Hızlı Erişim</div>
                          <div className="grid grid-cols-1 gap-2">
                            <button 
                              onClick={() => setShowCostumes(true)}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5 hover:bg-black/10' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${getTextColorClass()} font-bold text-sm`}
                            >
                              <Palette className="w-4 h-4 text-yellow-400" />
                              Kostüm Mağazası
                            </button>
                            <button 
                              onClick={() => setShowThemeMenu(true)}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5 hover:bg-black/10' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${getTextColorClass()} font-bold text-sm`}
                            >
                              <RefreshCw className="w-4 h-4 text-cyan-400" />
                              Temayı Değiştir
                            </button>
                            <button 
                              onClick={() => setShowUpdates(true)}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5 hover:bg-black/10' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${getTextColorClass()} font-bold text-sm`}
                            >
                              <Info className="w-4 h-4 text-amber-400" />
                              Güncellemeler
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleLogout}
                      className={`mt-auto flex items-center justify-center gap-2 p-3 rounded-xl border border-red-500/20 text-red-400 font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 transition-all`}
                    >
                      <LogOut className="w-4 h-4" />
                      Oturumu Kapat
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={`flex items-center gap-3 border-b ${(theme === 'WHITE' || theme === 'PINK') ? 'border-black/10' : 'border-white/10'} pb-3 md:pb-4`}>
                      <Trophy className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                      <h2 className={`text-lg md:text-xl font-black ${getTextColorClass()} uppercase tracking-tight`}>Global Leaderboard</h2>
                    </div>
                    <div className="space-y-2 md:space-y-3 overflow-y-auto max-h-[250px] md:max-h-[400px] pr-2 custom-scrollbar">
                      {globalLeaderboard.length > 0 ? globalLeaderboard.map((entry, i) => (
                        <div key={i} className={`flex items-center justify-between ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'} p-3 md:p-4 rounded-xl md:rounded-2xl border group hover:bg-opacity-10 transition-colors`}>
                          <div className="flex items-center gap-3 md:gap-4">
                            <span className={`w-5 md:w-6 text-xs md:text-sm font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : (theme === 'WHITE' || theme === 'PINK') ? 'text-black/20' : 'text-white/20'}`}>
                              {i + 1}
                            </span>
                            <span className={`text-sm md:text-base font-bold ${getTextColorClass()} group-hover:text-yellow-400 transition-colors truncate max-w-[100px] md:max-w-none`}>{entry.name}</span>
                          </div>
                          <span className={`text-xs md:text-sm font-black tabular-nums ${getMutedTextColorClass()}`}>{entry.score}</span>
                        </div>
                      )) : (
                        <div className={`text-center py-6 md:py-8 ${getMutedTextColorClass()} font-bold uppercase tracking-widest text-xs md:text-sm`}>
                          No scores yet
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

        {gameState === 'AUTH' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute inset-0 z-20 overflow-y-auto ${getOverlayBgClass()} backdrop-blur-xl custom-scrollbar`}
          >
            <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-6">
              <div className={`max-w-md w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/10 border-white/10'} p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-2xl space-y-6 md:space-y-8`}>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-400 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-4 shadow-xl shadow-yellow-400/20">
                  {isRegistering ? <UserPlus className="w-6 h-6 md:w-8 md:h-8 text-cyan-900" /> : <Lock className="w-6 h-6 md:w-8 md:h-8 text-cyan-900" />}
                </div>
                <h2 className={`text-2xl md:text-3xl font-black ${getTextColorClass()} uppercase tracking-tight`}>
                  {isRegistering ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className={`${getMutedTextColorClass()} font-medium text-xs md:text-sm`}>
                  {isRegistering ? 'Join the pond and start competing!' : 'Login to sync your progress'}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 md:py-3 rounded-xl text-[10px] md:text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-3 md:space-y-4">
                <div className="space-y-1 md:space-y-2">
                  <label className={`text-[10px] font-bold ${(theme === 'WHITE' || theme === 'PINK') ? 'text-cyan-600' : 'text-cyan-300'} uppercase tracking-widest ml-2`}>Username</label>
                  <div className="relative">
                    <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 ${(theme === 'WHITE' || theme === 'PINK') ? 'text-black/30' : 'text-white/30'}`} />
                    <input
                      type="text"
                      required
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className={`w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10 text-black' : 'bg-white/5 border-white/10 text-white'} border-2 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 md:pr-6 py-3 md:py-4 focus:outline-none focus:border-yellow-400 transition-colors font-bold text-sm md:text-base`}
                      placeholder="Your duck name"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:space-y-2">
                  <label className={`text-[10px] font-bold ${(theme === 'WHITE' || theme === 'PINK') ? 'text-cyan-600' : 'text-cyan-300'} uppercase tracking-widest ml-2`}>Password</label>
                  <div className="relative">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 ${(theme === 'WHITE' || theme === 'PINK') ? 'text-black/30' : 'text-white/30'}`} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10 text-black' : 'bg-white/5 border-white/10 text-white'} border-2 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 md:pr-6 py-3 md:py-4 focus:outline-none focus:border-yellow-400 transition-colors font-bold text-sm md:text-base`}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-cyan-900 font-black py-4 md:py-5 rounded-xl md:rounded-2xl transition-all active:scale-95 shadow-xl shadow-yellow-400/20 text-lg md:text-xl uppercase tracking-tight mt-2 md:mt-4"
                >
                  {isRegistering ? 'Register' : 'Login'}
                </button>
              </form>

              <div className="text-center space-y-3 md:space-y-4">
                <button
                  onClick={() => setIsRegistering(!isRegistering)}
                  className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'text-cyan-600' : 'text-cyan-300'} hover:text-yellow-400 text-[10px] md:text-sm font-bold transition-colors`}
                >
                  {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
                </button>
                <div className="flex items-center gap-4">
                  <div className={`h-px ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/10' : 'bg-white/10'} flex-1`} />
                  <span className={`${getMutedTextColorClass()} text-[10px] font-bold uppercase`}>or</span>
                  <div className={`h-px ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/10' : 'bg-white/10'} flex-1`} />
                </div>
                <button
                  onClick={() => setGameState('MENU')}
                  className={`${getMutedTextColorClass()} hover:text-yellow-400 text-[10px] md:text-sm font-bold transition-colors uppercase tracking-widest`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

        {gameState === 'LOBBY' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute inset-0 z-20 overflow-y-auto ${getOverlayBgClass()} backdrop-blur-xl custom-scrollbar`}
          >
            <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-6">
              <div className={`max-w-2xl w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/10 border-white/10'} p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-2xl space-y-6 md:space-y-8`}>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-400 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-4 shadow-xl shadow-yellow-400/20">
                    <Map className="w-6 h-6 md:w-8 md:h-8 text-cyan-900" />
                  </div>
                  <h2 className={`text-2xl md:text-3xl font-black ${getTextColorClass()} uppercase tracking-tight`}>Lobi Seçimi</h2>
                  <p className={`${getMutedTextColorClass()} font-medium text-xs md:text-sm`}>Oynamak istediğin gölü seç</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 1, name: "Genel Göl", desc: "Herkes katılabilir. Botlar ve insanlar bir arada.", icon: <Eye className="w-5 h-5" />, badge: "HERKESE AÇIK" },
                    { id: 2, name: "Hesaplı Göl", desc: "Sadece kayıtlı üyeler. Botlar ve insanlar bir arada.", icon: <Lock className="w-5 h-5" />, badge: "HESAP GEREKLİ" },
                    { id: 3, name: "Sadece İnsanlar", desc: "Sadece kayıtlı üyeler. Bot yok, sadece gerçek oyuncular.", icon: <User className="w-5 h-5" />, badge: "HESAP GEREKLİ + BOT YOK" }
                  ].map((lobby) => (
                    <button
                      key={lobby.id}
                      onClick={() => startLobby(lobby.id)}
                      className={`group relative flex items-center gap-4 p-4 md:p-6 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                        (theme === 'WHITE' || theme === 'PINK') 
                          ? 'bg-white border-black/5 hover:border-yellow-400 hover:shadow-xl' 
                          : 'bg-white/5 border-white/5 hover:border-yellow-400 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-colors ${
                        (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black' : 'bg-white/10 text-white'
                      } group-hover:bg-yellow-400 group-hover:text-cyan-900`}>
                        {lobby.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-black uppercase tracking-tight ${getTextColorClass()}`}>{lobby.name}</h3>
                          <span className="text-[8px] font-black bg-cyan-400/20 text-cyan-400 px-1.5 py-0.5 rounded-md tracking-widest">{lobby.badge}</span>
                        </div>
                        <p className={`text-xs ${getMutedTextColorClass()} font-medium leading-relaxed`}>{lobby.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setGameState('MENU')}
                  className={`w-full ${getMutedTextColorClass()} hover:text-yellow-400 text-[10px] md:text-sm font-bold transition-colors uppercase tracking-widest text-center`}
                >
                  Geri Dön
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full"
          >
            <GameCanvas
              playerName={playerName}
              controlMode={controlMode}
              gameMode={gameMode}
              isBoosting={isBoosting}
              invertControls={invertControls}
              currentSkinId={currentSkinId}
              theme={theme}
              onGameOver={handleGameOver}
              onUpdateLeaderboard={setLeaderboard}
              onScoreUpdate={setScore}
              onPowerUpsUpdate={(inventory, active) => setPowerUps({ inventory, active })}
              activatePowerUp={powerUpToActivate}
              onSpecialDropSpawned={handleDropSpawned}
              devMode={devMode}
              lobbyId={selectedLobbyId || 1}
              token={token}
            />
            
            {/* HUD */}
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20 pointer-events-none flex flex-col gap-4">
              <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white/80 border-black/10 shadow-lg' : 'bg-black/40 border-white/10'} backdrop-blur-md border rounded-xl md:rounded-2xl p-2 md:p-4 flex items-center gap-2 md:gap-4 pointer-events-auto`}>
                <div className="w-8 h-8 md:w-12 md:h-12 bg-yellow-400 rounded-lg md:rounded-xl flex items-center justify-center text-xl md:text-2xl">
                  🦆
                </div>
                <div>
                  <div className={`text-[10px] md:text-xs font-bold ${getMutedTextColorClass()} uppercase tracking-widest`}>Score</div>
                  <div className={`text-lg md:text-2xl font-black ${getTextColorClass()} tabular-nums`}>{score}</div>
                </div>
              </div>

              {/* Power-ups UI */}
              {(devMode || powerUps.inventory.SPEED > 0 || powerUps.inventory.VISION > 0 || powerUps.inventory.MAGNET > 0 || powerUps.inventory.SUPER > 0 || powerUps.active.SPEED > 0 || powerUps.active.VISION > 0 || powerUps.active.MAGNET > 0 || powerUps.active.SUPER > 0) && (
                <div className="flex flex-col gap-2 md:gap-3 pointer-events-auto">
                  {/* Speed Power-up */}
                  {(devMode || powerUps.inventory.SPEED > 0 || powerUps.active.SPEED > 0) && (
                    <button 
                      onClick={() => {
                        setPowerUpToActivate('SPEED');
                        setTimeout(() => setPowerUpToActivate(null), 100);
                      }}
                      className={`bg-black/40 backdrop-blur-md border ${powerUps.active.SPEED > 0 ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-white/10'} rounded-xl md:rounded-2xl p-2 md:p-3 flex items-center gap-3 transition-all duration-300 text-left cursor-pointer hover:bg-black/60 active:scale-95`}
                    >
                      <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
                        {/* Progress Ring */}
                        {powerUps.active.SPEED > 0 && (
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="rgba(250,204,21,0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="#facc15"
                              strokeWidth="4"
                              strokeDasharray="100"
                              strokeDashoffset={100 - (powerUps.active.SPEED / 300) * 100}
                              strokeLinecap="round"
                              className="transition-all duration-100 ease-linear"
                            />
                          </svg>
                        )}
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${powerUps.active.SPEED > 0 ? 'bg-yellow-400 text-cyan-900' : 'bg-white/10 text-yellow-400'}`}>
                          <Zap className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] md:text-[10px] font-black text-yellow-400 uppercase tracking-widest leading-none mb-1">Speed Boost</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm md:text-lg font-black text-white">x{devMode ? '∞' : powerUps.inventory.SPEED}</span>
                          <span className="text-[8px] md:text-[10px] font-bold text-white/30 uppercase tracking-tighter">[1]</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Vision Power-up */}
                  {(devMode || powerUps.inventory.VISION > 0 || powerUps.active.VISION > 0) && (
                    <button 
                      onClick={() => {
                        setPowerUpToActivate('VISION');
                        setTimeout(() => setPowerUpToActivate(null), 100);
                      }}
                      className={`bg-black/40 backdrop-blur-md border ${powerUps.active.VISION > 0 ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'border-white/10'} rounded-xl md:rounded-2xl p-2 md:p-3 flex items-center gap-3 transition-all duration-300 text-left cursor-pointer hover:bg-black/60 active:scale-95`}
                    >
                      <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
                        {/* Progress Ring */}
                        {powerUps.active.VISION > 0 && (
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="rgba(34,211,238,0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="#22d3ee"
                              strokeWidth="4"
                              strokeDasharray="100"
                              strokeDashoffset={100 - (powerUps.active.VISION / 300) * 100}
                              strokeLinecap="round"
                              className="transition-all duration-100 ease-linear"
                            />
                          </svg>
                        )}
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${powerUps.active.VISION > 0 ? 'bg-cyan-400 text-cyan-900' : 'bg-white/10 text-cyan-400'}`}>
                          <Eye className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] md:text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none mb-1">Wide Vision</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm md:text-lg font-black text-white">x{devMode ? '∞' : powerUps.inventory.VISION}</span>
                          <span className="text-[8px] md:text-[10px] font-bold text-white/30 uppercase tracking-tighter">[2]</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Magnet Power-up */}
                  {(devMode || powerUps.inventory.MAGNET > 0 || powerUps.active.MAGNET > 0) && (
                    <button 
                      onClick={() => {
                        setPowerUpToActivate('MAGNET');
                        setTimeout(() => setPowerUpToActivate(null), 100);
                      }}
                      className={`bg-black/40 backdrop-blur-md border ${powerUps.active.MAGNET > 0 ? 'border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.3)]' : 'border-white/10'} rounded-xl md:rounded-2xl p-2 md:p-3 flex items-center gap-3 transition-all duration-300 text-left cursor-pointer hover:bg-black/60 active:scale-95`}
                    >
                      <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
                        {/* Progress Ring */}
                        {powerUps.active.MAGNET > 0 && (
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="rgba(192,132,252,0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="#c084fc"
                              strokeWidth="4"
                              strokeDasharray="100"
                              strokeDashoffset={100 - (powerUps.active.MAGNET / 300) * 100}
                              strokeLinecap="round"
                              className="transition-all duration-100 ease-linear"
                            />
                          </svg>
                        )}
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${powerUps.active.MAGNET > 0 ? 'bg-purple-400 text-cyan-900' : 'bg-white/10 text-purple-400'}`}>
                          <RefreshCw className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] md:text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none mb-1">Magnet</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm md:text-lg font-black text-white">x{devMode ? '∞' : powerUps.inventory.MAGNET}</span>
                          <span className="text-[8px] md:text-[10px] font-bold text-white/30 uppercase tracking-tighter">[3]</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Super Power-up */}
                  {(devMode || powerUps.inventory.SUPER > 0 || powerUps.active.SUPER > 0) && (
                    <button 
                      onClick={() => {
                        setPowerUpToActivate('SUPER');
                        setTimeout(() => setPowerUpToActivate(null), 100);
                      }}
                      className={`bg-black/40 backdrop-blur-md border ${powerUps.active.SUPER > 0 ? 'border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.3)]' : 'border-white/10'} rounded-xl md:rounded-2xl p-2 md:p-3 flex items-center gap-3 transition-all duration-300 text-left cursor-pointer hover:bg-black/60 active:scale-95`}
                    >
                      <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
                        {/* Progress Ring */}
                        {powerUps.active.SUPER > 0 && (
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="rgba(248,113,113,0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="#f87171"
                              strokeWidth="4"
                              strokeDasharray="100"
                              strokeDashoffset={100 - (powerUps.active.SUPER / 300) * 100}
                              strokeLinecap="round"
                              className="transition-all duration-100 ease-linear"
                            />
                          </svg>
                        )}
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${powerUps.active.SUPER > 0 ? 'bg-red-400 text-cyan-900' : 'bg-white/10 text-red-400'}`}>
                          <Shield className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] md:text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Super Mode</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm md:text-lg font-black text-white">x{devMode ? '∞' : powerUps.inventory.SUPER}</span>
                          <span className="text-[8px] md:text-[10px] font-bold text-white/30 uppercase tracking-tighter">[4]</span>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 pointer-events-none flex flex-col items-end gap-2 md:gap-4">
              <div className={`hidden sm:block ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white/80 border-black/10 shadow-lg' : 'bg-black/60 border-white/10'} backdrop-blur shadow-xl border rounded-2xl p-4 min-w-[200px] space-y-4 pointer-events-auto`}>
                <div className={`text-xs font-bold text-yellow-500 uppercase tracking-widest border-b ${(theme === 'WHITE' || theme === 'PINK') ? 'border-black/10' : 'border-white/10'} pb-2 flex items-center gap-2`}>
                  <Settings className="w-3 h-3" /> Ayarlar
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className={`flex items-center gap-2 ${getTextColorClass()} text-sm font-bold`}>
                    <RefreshCw className="w-4 h-4" /> Invert Keys
                  </div>
                  <button 
                    onClick={toggleInvertControls}
                    className={`w-12 h-6 rounded-full transition-colors relative ${invertControls ? 'bg-yellow-400' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/10' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: invertControls ? 24 : 4 }}
                      className={`absolute top-1 w-4 h-4 ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-cyan-900' : 'bg-white'} rounded-full shadow-sm`}
                    />
                  </button>
                </div>
              </div>

              <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white/80 border-black/10 shadow-lg' : 'bg-black/40 border-white/10'} backdrop-blur-md border rounded-xl md:rounded-2xl p-2 md:p-4 min-w-[120px] md:min-w-[160px] pointer-events-auto`}>
                <div className="text-[10px] md:text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-2">
                  <Trophy className="w-3 h-3" /> Leaderboard
                </div>
                <div className="space-y-0.5 md:space-y-1">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={i} className={`flex justify-between text-[10px] md:text-sm font-bold ${entry.name === playerName ? 'text-yellow-500' : getMutedTextColorClass()}`}>
                      <span className="truncate max-w-[80px] md:max-w-none">{i + 1}. {entry.name}</span>
                      <span>{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-lg px-4 md:px-6 flex flex-col items-center gap-2 md:gap-4">
              <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white/80 border-black/10 shadow-lg' : 'bg-black/40 border-white/10'} backdrop-blur-md border rounded-full px-4 md:px-6 py-2 md:py-3 flex items-center gap-4 md:gap-6 ${getTextColorClass()} text-[10px] md:text-sm font-medium pointer-events-auto relative`}>
                <button 
                  onClick={() => setShowControlMenu(!showControlMenu)}
                  className={`flex items-center gap-2 hover:text-yellow-500 transition-colors`}
                >
                  {controlMode === 'FOLLOW' && <MousePointer2 className="w-3 h-3 md:w-4 md:h-4" />}
                  {controlMode === 'JOYSTICK' && <Zap className="w-3 h-3 md:w-4 md:h-4" />}
                  {controlMode === 'KEYBOARD' && <Keyboard className="w-3 h-3 md:w-4 md:h-4" />}
                  <span className="hidden xs:inline">{controlMode.charAt(0) + controlMode.slice(1).toLowerCase()}</span>
                </button>

                <AnimatePresence>
                  {showControlMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full left-0 mb-4 bg-cyan-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl min-w-[160px]"
                    >
                      {(['FOLLOW', 'JOYSTICK', 'KEYBOARD'] as ControlMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => selectControlMode(mode)}
                          className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-colors ${controlMode === mode ? 'bg-yellow-400 text-cyan-900' : 'hover:bg-white/10 text-white'}`}
                        >
                          {mode === 'FOLLOW' && <MousePointer2 className="w-4 h-4" />}
                          {mode === 'JOYSTICK' && <Zap className="w-4 h-4" />}
                          {mode === 'KEYBOARD' && <Keyboard className="w-4 h-4" />}
                          <span className="text-xs font-black uppercase">{mode}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-1 h-1 bg-white/20 rounded-full" />
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" /> 
                  {controlMode === 'FOLLOW' && 'Click to Boost'}
                  {controlMode === 'JOYSTICK' && 'Hold Boost Button'}
                  {controlMode === 'KEYBOARD' && 'W / Space to Boost'}
                </div>
              </div>

              {controlMode === 'JOYSTICK' && (
                <div className="flex justify-end w-full pointer-events-none">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setIsBoosting(true); }}
                    onMouseUp={(e) => { e.preventDefault(); setIsBoosting(false); }}
                    onMouseLeave={() => setIsBoosting(false)}
                    onTouchStart={(e) => { e.preventDefault(); setIsBoosting(true); }}
                    onTouchEnd={(e) => { e.preventDefault(); setIsBoosting(false); }}
                    onTouchCancel={(e) => { e.preventDefault(); setIsBoosting(false); }}
                    className="w-16 h-16 md:w-20 md:h-20 bg-yellow-400/20 backdrop-blur-md border-4 border-yellow-400/40 rounded-full flex items-center justify-center pointer-events-auto active:scale-90 active:bg-yellow-400/40 transition-all"
                  >
                    <Zap className="w-8 h-8 md:w-10 md:h-10 text-yellow-400 fill-current" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute inset-0 z-30 overflow-y-auto ${theme === 'WHITE' ? 'bg-white/95' : theme === 'PINK' ? 'bg-pink-100/95' : 'bg-red-950/90'} backdrop-blur-md custom-scrollbar`}
          >
            <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-6">
              <div className="max-w-md w-full space-y-6 md:space-y-8 text-center">
              {/* Sad Duck Visual */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative inline-block mb-2"
              >
                <div className={`text-8xl md:text-9xl filter grayscale brightness-75 drop-shadow-2xl`}>🦆</div>
                <motion.div 
                  animate={{ 
                    y: [0, 15, 30], 
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.8]
                  }}
                  transition={{ 
                    duration: 2.5, 
                    repeat: Infinity, 
                    ease: "easeIn",
                    delay: 0.5
                  }}
                  className="absolute top-1/2 right-4 text-3xl md:text-4xl"
                >
                  💧
                </motion.div>
                <motion.div 
                  animate={{ 
                    y: [0, 15, 30], 
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.8]
                  }}
                  transition={{ 
                    duration: 2.5, 
                    repeat: Infinity, 
                    ease: "easeIn",
                    delay: 1.8
                  }}
                  className="absolute top-1/2 left-4 text-3xl md:text-4xl"
                >
                  💧
                </motion.div>
              </motion.div>

              <div className="space-y-2">
                <h2 className={`text-5xl md:text-7xl font-black ${getTextColorClass()} tracking-tighter uppercase italic`}>
                  Wasted!
                </h2>
                <p className={`${getMutedTextColorClass()} font-medium text-sm md:text-base`}>You hit a trail or the pond's edge!</p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/10 border-white/10'} p-4 md:p-6 rounded-2xl md:rounded-3xl border`}>
                  <div className={`text-[10px] md:text-xs font-bold ${(theme === 'WHITE' || theme === 'PINK') ? 'text-red-600' : 'text-red-300'} uppercase tracking-widest mb-1`}>Final Score</div>
                  <div className={`text-2xl md:text-4xl font-black ${getTextColorClass()}`}>{score}</div>
                </div>
                <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/10 border-white/10'} p-4 md:p-6 rounded-2xl md:rounded-3xl border`}>
                  <div className={`text-[10px] md:text-xs font-bold ${(theme === 'WHITE' || theme === 'PINK') ? 'text-red-600' : 'text-red-300'} uppercase tracking-widest mb-1`}>Best Score</div>
                  <div className={`text-2xl md:text-4xl font-black ${getTextColorClass()}`}>{highScore}</div>
                </div>
              </div>

              <button
                onClick={startGame}
                className={`w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black text-white' : 'bg-white text-red-950'} font-black py-4 md:py-5 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 shadow-xl text-lg md:text-xl uppercase tracking-tight`}
              >
                <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
                Try Again
              </button>

              <button
                onClick={() => setGameState('MENU')}
                className={`w-full bg-transparent border-2 ${(theme === 'WHITE' || theme === 'PINK') ? 'border-black/20 text-black hover:bg-black/5' : 'border-white/20 text-white hover:bg-white/10'} font-bold py-3 md:py-4 rounded-xl md:rounded-2xl transition-colors uppercase tracking-widest text-xs md:text-sm`}
              >
                Back to Menu
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Costume Modal */}
      <AnimatePresence>
        {showCostumes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-[120] overflow-y-auto ${getOverlayBgClass()} backdrop-blur-xl custom-scrollbar`}
          >
            <div className="min-h-full flex items-center justify-center p-6">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={`max-w-2xl w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white border-black/10 shadow-2xl' : 'bg-white/10 border-white/10'} border rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-2xl relative flex flex-col`}
              >
              <button 
                onClick={() => setShowCostumes(false)}
                className={`absolute top-4 right-4 md:top-6 md:right-6 p-2 ${(theme === 'WHITE' || theme === 'PINK') ? 'hover:bg-black/5 text-black/40 hover:text-black' : 'hover:bg-white/10 text-white/60 hover:text-white'} rounded-full transition-colors`}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <div className="flex items-center gap-3 mb-4 md:mb-8">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-400 rounded-lg md:rounded-xl flex items-center justify-center">
                  <Palette className="w-5 h-5 md:w-6 md:h-6 text-cyan-900" />
                </div>
                <h2 className={`text-xl md:text-2xl font-black ${getTextColorClass()} uppercase tracking-tight`}>Kostüm Mağazası</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 overflow-y-auto pr-2 custom-scrollbar pb-4">
                {SKINS.map((skin) => {
                  const isUnlocked = unlockedSkins.includes(skin.id);
                  const isSelected = currentSkinId === skin.id;
                  const canAfford = highScore >= skin.price;

                  if (skin.isSecret && !isUnlocked) return null;

                  return (
                    <div 
                      key={skin.id}
                      className={`relative p-3 md:p-4 rounded-2xl md:rounded-3xl border-2 transition-all flex flex-col items-center gap-2 md:gap-3 ${
                        isSelected 
                          ? 'border-yellow-400 bg-yellow-400/10' 
                          : (theme === 'WHITE' || theme === 'PINK') ? 'border-black/10 bg-black/5 hover:bg-black/10' : 'border-white/5 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div 
                        className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl shadow-lg flex items-center justify-center text-2xl md:text-3xl relative overflow-hidden"
                        style={{ backgroundColor: skin.color }}
                      >
                        {skin.pattern === 'STRIPES' && (
                          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `linear-gradient(45deg, ${skin.patternColor} 25%, transparent 25%, transparent 50%, ${skin.patternColor} 50%, ${skin.patternColor} 75%, transparent 75%, transparent)` , backgroundSize: '20px 20px' }} />
                        )}
                        🦆
                      </div>
                      
                      <div className="text-center">
                        <div className={`text-xs md:text-sm font-black ${getTextColorClass()} truncate max-w-[80px] md:max-w-none`}>{skin.name}</div>
                        {!isUnlocked && (
                          <div className={`text-[8px] md:text-[10px] font-bold uppercase tracking-widest ${canAfford ? 'text-cyan-500' : 'text-red-500'}`}>
                            {skin.price} Puan
                          </div>
                        )}
                      </div>

                      {isUnlocked ? (
                        <button
                          onClick={() => selectSkin(skin.id)}
                          className={`w-full py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-yellow-400 text-cyan-900' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/10 text-black/60 hover:bg-black/20' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                        >
                          {isSelected ? 'Seçildi' : 'Seç'}
                        </button>
                      ) : (
                        <button
                          onClick={() => buySkin(skin)}
                          className={`w-full py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${canAfford ? 'bg-cyan-500 text-white hover:bg-cyan-400' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black/20 cursor-not-allowed' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                        >
                          Aç
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className={`mt-4 md:mt-6 p-3 md:p-4 ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/5' : 'bg-black/20 border-white/5'} rounded-xl md:rounded-2xl border flex items-center justify-between`}>
                <div className={`text-[10px] md:text-xs font-bold ${getMutedTextColorClass()} uppercase tracking-widest`}>En Yüksek Puanın</div>
                <div className="text-lg md:text-xl font-black text-yellow-500">{highScore}</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-[110] overflow-y-auto ${getOverlayBgClass()} backdrop-blur-xl custom-scrollbar`}
          >
            <div className="min-h-full flex items-center justify-center p-6">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={`max-w-md w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white border-black/10 shadow-2xl' : 'bg-white/10 border-white/10'} border rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative`}
              >
              <button 
                onClick={() => setShowSettings(false)}
                className={`absolute top-4 right-4 md:top-6 md:right-6 p-2 ${(theme === 'WHITE' || theme === 'PINK') ? 'hover:bg-black/5 text-black/40 hover:text-black' : 'hover:bg-white/10 text-white/60 hover:text-white'} rounded-full transition-colors`}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <div className="flex items-center gap-3 mb-6 md:mb-8">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-400 rounded-lg md:rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 md:w-6 md:h-6 text-cyan-900" />
                </div>
                <h2 className={`text-xl md:text-2xl font-black ${getTextColorClass()} uppercase tracking-tight`}>Ayarlar</h2>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className={`${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'} rounded-xl md:rounded-2xl p-4 md:p-6 space-y-4`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className={`flex items-center gap-2 ${getTextColorClass()} font-bold text-sm md:text-base`}>
                        <RefreshCw className="w-4 h-4 text-yellow-400" /> Kontrolleri Ters Çevir
                      </div>
                      <p className={`text-[10px] md:text-xs ${getMutedTextColorClass()}`}>Klavye modunda sağ/sol yönlerini değiştirir.</p>
                    </div>
                    <button 
                      onClick={toggleInvertControls}
                      className={`w-12 h-6 md:w-14 md:h-7 rounded-full transition-colors relative flex-shrink-0 ${invertControls ? 'bg-yellow-400' : (theme === 'WHITE' || theme === 'PINK') ? 'bg-black/10' : 'bg-white/10'}`}
                    >
                      <motion.div 
                        animate={{ x: invertControls ? (window.innerWidth < 768 ? 24 : 30) : 4 }}
                        className={`absolute top-1 w-4 h-4 md:w-5 md:h-5 ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-cyan-900' : 'bg-white'} rounded-full shadow-lg`}
                      />
                    </button>
                  </div>
                </div>

                <div className={`${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 border-black/10' : 'bg-white/5 border-white/10'} rounded-xl md:rounded-2xl p-4 md:p-6`}>
                  <div className={`text-[10px] md:text-xs font-bold ${(theme === 'WHITE' || theme === 'PINK') ? 'text-cyan-600' : 'text-cyan-400'} uppercase tracking-widest mb-2 md:mb-4`}>Oyun Hakkında</div>
                  <div className={`space-y-1 md:space-y-2 text-xs md:text-sm ${getMutedTextColorClass()}`}>
                    <p>Duck.io v5.1.1</p>
                    <p>En büyük ördek ol ve göleti fethet!</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Version Tag */}
      <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white/80 border-black/10 text-black/40' : 'bg-black/40 border-white/10 text-white/40'} backdrop-blur-md border rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1`}>
          v5.1.1 <span className="text-yellow-500/60">Final</span>
        </div>
      </div>

      {/* Updates Modal */}
      <AnimatePresence>
        {showUpdates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-[100] overflow-y-auto ${getOverlayBgClass()} backdrop-blur-xl custom-scrollbar`}
          >
            <div className="min-h-full flex items-center justify-center p-6">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className={`max-w-lg w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white border-black/10 shadow-2xl' : 'bg-white/10 border-white/10'} border rounded-[2.5rem] p-8 shadow-2xl relative flex flex-col`}
              >
                <button 
                  onClick={() => setShowUpdates(false)}
                  className={`absolute top-6 right-6 p-2 ${(theme === 'WHITE' || theme === 'PINK') ? 'hover:bg-black/5 text-black/40 hover:text-black' : 'hover:bg-white/10 text-white/60 hover:text-white'} rounded-full transition-colors`}
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    onClick={() => {
                      const newCount = infoClickCount + 1;
                      setInfoClickCount(newCount);
                      if (newCount >= 15 && !devMode) {
                        setDevMode(true);
                        setHighScore(9999999);
                        setUnlockedSkins(SKINS.map(s => s.id));
                        setPowerUps({
                          inventory: { SPEED: 999, VISION: 999, MAGNET: 999, SUPER: 999 },
                          active: { SPEED: 0, VISION: 0, MAGNET: 0, SUPER: 0 }
                        });
                      }
                    }}
                  >
                    <Info className="w-6 h-6 text-cyan-900" />
                  </div>
                  <h2 className={`text-2xl font-black ${getTextColorClass()} uppercase tracking-tight`}>Güncellemeler</h2>
                </div>

              <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-yellow-400 text-cyan-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">v5.1.1</span>
                    <span className={`${getMutedTextColorClass()} text-[10px] font-bold`}>ŞİMDİ</span>
                  </div>
                  <ul className={`space-y-2 text-sm ${theme === 'WHITE' ? 'text-black/70' : theme === 'PINK' ? 'text-pink-900/70' : 'text-cyan-100/70'} font-medium list-disc pl-4`}>
                    <li>Yeni Tema Sistemi: Lacivert, Siyah, Beyaz ve Pembe modları eklendi.</li>
                    <li>Akıllı Yazı Renkleri: Yazı renkleri artık arka plan rengine göre otomatik olarak siyah veya beyaz olur.</li>
                    <li>Drop Bildirimleri: Hediye kutusu düştüğünde ekranın üst kısmında anlık uyarı mesajı görünür.</li>
                    <li>Gelişmiş Siyah Mod: OLED ekranlar için daha derin siyah tonları ve yüksek kontrastlı arayüz.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={` ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-black/5 text-black/60 border-black/10' : 'bg-white/10 text-white/60 border-white/10'} text-[10px] font-black px-2 py-0.5 rounded-full uppercase border`}>v0.4.1 Beta</span>
                  </div>
                  <ul className={`space-y-2 text-sm ${theme === 'WHITE' ? 'text-black/40' : theme === 'PINK' ? 'text-pink-900/40' : 'text-cyan-100/40'} font-medium list-disc pl-4`}>
                    <li>Küçük Harita Hatası Giderildi: Artık küçük haritada doğarken anında ölme sorunu yaşanmıyor.</li>
                    <li>Arayüz İyileştirmesi: Mini harita ve yetenek göstergelerinin çakışması önlendi.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-white/10">v0.3.1 Beta</span>
                  </div>
                  <ul className="space-y-2 text-sm text-cyan-100/40 font-medium list-disc pl-4">
                    <li>Ana menü tasarımı yenilendi: Daha kompakt ve yatay yerleşim.</li>
                    <li>Ayarlar menüsü sağ üstteki çark simgesine taşındı.</li>
                    <li>Yeni "Küçük" harita modu eklendi (1500x1500px).</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-white/10">v0.3.0 Beta</span>
                  </div>
                  <ul className="space-y-2 text-sm text-cyan-100/40 font-medium list-disc pl-4">
                    <li>Yeni Harita Modları eklendi: Normal ve Büyük.</li>
                    <li>Klavye kontrolleri yenilendi.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-white/10">v0.2.1 Beta</span>
                  </div>
                  <ul className="space-y-2 text-sm text-cyan-100/40 font-medium list-disc pl-4">
                    <li>Ayarlar paneli artık hem ana menüde hem de oyun içinde doğrudan görünür hale getirildi.</li>
                    <li>Klavye kontrolleri hızlandırıldı ve tepkisellik artırıldı.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-white/10">v0.2.0 Beta</span>
                  </div>
                  <ul className="space-y-2 text-sm text-cyan-100/40 font-medium list-disc pl-4">
                    <li>Klavye kontrol desteği eklendi (A/D, Yön Tuşları, W/Space).</li>
                    <li>Özel Drop sistemi yenilendi: Artık "Hediye Kutusu" olarak ara sıra (%45 şans) ve daha merkezi yerlere düşüyor.</li>
                    <li>Ekran dışı drop göstergeleri eklendi.</li>
                    <li>Sağ alt köşeye sürüm etiketi eklendi.</li>
                  </ul>
                </div>

                <div className="space-y-3 opacity-50">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/5 text-white/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-white/5">v0.1.0 Alpha</span>
                  </div>
                  <ul className="space-y-2 text-sm text-cyan-100/30 font-medium list-disc pl-4">
                    <li>Temel oyun mekanikleri: Ördek büyüme, kuyruk sistemi ve botlar.</li>
                    <li>Kayıt ve Giriş sistemi (Global Liderlik Tablosu).</li>
                    <li>Takip ve Joystick kontrol modları.</li>
                    <li>Mini harita ve lider göstergesi.</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setShowUpdates(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-black py-4 rounded-2xl transition-all active:scale-95 border border-white/10 text-sm uppercase tracking-widest mt-8"
              >
                Anladım
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}

      {showThemeMenu && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`absolute inset-0 z-[130] overflow-y-auto ${getOverlayBgClass()} backdrop-blur-xl custom-scrollbar`}
        >
          <div className="min-h-full flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`max-w-md w-full ${(theme === 'WHITE' || theme === 'PINK') ? 'bg-white border-black/10 shadow-2xl' : 'bg-white/10 border-white/10'} border rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative`}
            >
              <button 
                onClick={() => setShowThemeMenu(false)}
                className={`absolute top-4 right-4 md:top-6 md:right-6 p-2 ${(theme === 'WHITE' || theme === 'PINK') ? 'hover:bg-black/5 text-black/40' : 'hover:bg-white/10 text-white/60'} rounded-full transition-colors`}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <div className="flex items-center gap-3 mb-6 md:mb-8">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-400 rounded-lg md:rounded-xl flex items-center justify-center">
                  <Palette className="w-5 h-5 md:w-6 md:h-6 text-cyan-900" />
                </div>
                <h2 className={`text-xl md:text-2xl font-black ${getTextColorClass()} uppercase tracking-tight`}>Tema Seçimi</h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(['NAVY', 'BLACK', 'WHITE', 'PINK'] as Theme[]).map((t) => {
                  const isLocked = (t === 'BLACK' || t === 'PINK') && !token && !devMode;
                  const isSelected = theme === t;
                  
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        changeTheme(t);
                        if (!isLocked) setShowThemeMenu(false);
                      }}
                      className={`group relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        isSelected 
                          ? 'border-yellow-400 bg-yellow-400/10' 
                          : (theme === 'WHITE' || theme === 'PINK') ? 'border-black/5 bg-black/5 hover:bg-black/10' : 'border-white/5 bg-white/5 hover:bg-white/10'} ${isLocked ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className={`w-10 h-10 rounded-xl border-2 ${
                            t === 'NAVY' ? 'bg-[#083344] border-cyan-400' :
                            t === 'BLACK' ? 'bg-black border-gray-700' :
                            t === 'WHITE' ? 'bg-white border-gray-200' :
                            'bg-[#fbcfe8] border-pink-400'
                          }`}
                        />
                        <div className="text-left">
                          <div className={`text-sm font-black uppercase tracking-widest ${getTextColorClass()}`}>
                            {t === 'NAVY' ? 'Lacivert' : t === 'BLACK' ? 'Siyah' : t === 'WHITE' ? 'Beyaz' : 'Pembe'}
                          </div>
                          <div className={`text-[10px] font-bold ${getMutedTextColorClass()} uppercase`}>
                            {t === 'NAVY' ? 'Klasik Gölet' : t === 'BLACK' ? 'Gece Modu' : t === 'WHITE' ? 'Aydınlık' : 'Şeker Dünyası'}
                          </div>
                        </div>
                      </div>
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-red-400" />
                      ) : isSelected ? (
                        <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <p className={`mt-6 text-[10px] md:text-xs text-center font-bold uppercase tracking-widest ${getMutedTextColorClass()}`}>
                Siyah ve Pembe temalar için giriş yapmalısın.
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
