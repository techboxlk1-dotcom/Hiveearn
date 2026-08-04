'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Gamepad2, Trophy, Clock } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { useUser } from '@/contexts/UserContext';
import { recordGameReward, getGameHighScore, getGameStatus } from '@/lib/api';
import { useAds } from '@/hooks/useAds';
import { useRewardPopup } from '@/components/ui/RewardPopup';
import { toast } from 'sonner';

type GameState = 'idle' | 'watching_ad' | 'playing' | 'ended';
type Tile = { id: number; value: number; revealed: boolean; matched: boolean };

const HIVE_VALUES = [1, 2, 3, 4, 5, 6];
const GAME_TIME_SECONDS = 40;

export default function MiniGame() {
  const { user, refreshUser } = useUser();
  const { showRandomAd } = useAds();
  const { showReward } = useRewardPopup();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME_SECONDS);
  const [highScore, setHighScore] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [gameStatus, setGameStatus] = useState<{ canPlay: boolean; hoursLeft: number }>({ canPlay: true, hoursLeft: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHigh = useCallback(async () => {
    if (!user) return;
    const hs = await getGameHighScore(user.id);
    setHighScore(hs);
    const gs = await getGameStatus(user.id);
    setGameStatus(gs);
  }, [user]);

  useEffect(() => { loadHigh(); }, [loadHigh]);

  const startGame = async () => {
    if (!user) return;
    if (!gameStatus.canPlay) {
      toast.error(`Come back in ${gameStatus.hoursLeft}h to play again`);
      return;
    }
    setGameState('watching_ad');
    const adResult = await showRandomAd();
    if (!adResult.success) {
      toast.error('You must watch the ad to play!');
      setGameState('idle');
      return;
    }

    const pairs = [...HIVE_VALUES, ...HIVE_VALUES];
    const shuffled = pairs.sort(() => Math.random() - 0.5);
    setTiles(shuffled.map((value, id) => ({ id, value, revealed: false, matched: false })));
    setFlipped([]);
    setScore(0);
    setMoves(0);
    setTimeLeft(GAME_TIME_SECONDS);
    setGameId(g => g + 1);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameState('ended');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, gameId]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const allMatched = tiles.length > 0 && tiles.every(t => t.matched);
    if (allMatched) {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('ended');
    }
  }, [tiles, gameState]);

  useEffect(() => {
    if (gameState !== 'ended' || !user) return;
    const pairs = tiles.filter(t => t.matched).length / 2;
    const timeBonus = timeLeft;
    const finalScore = pairs * 10 + timeBonus;
    // Server assigns random 5-20 reward
    recordGameReward(user.id, finalScore, 0).then(res => {
      if (res.success) {
        const match = res.message.match(/(\d+)/);
        const hiveEarned = match ? parseInt(match[1]) : 0;
        showReward(hiveEarned, 'Game Over!', `Score: ${finalScore} | +${hiveEarned} Hive`, '🎮');
        toast.success(`+${hiveEarned} Hive earned!`, { icon: '🎮' });
        refreshUser();
        loadHigh();
      } else {
        toast.error(res.message);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const handleTileClick = (id: number) => {
    if (gameState !== 'playing') return;
    if (flipped.length >= 2) return;
    const tile = tiles.find(t => t.id === id);
    if (!tile || tile.revealed || tile.matched) return;

    setTiles(prev => prev.map(t => t.id === id ? { ...t, revealed: true } : t));
    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = newFlipped;
      const tileA = tiles.find(t => t.id === a);
      const tileB = tiles.find(t => t.id === b);
      if (tileA && tileB && tileA.value === tileB.value) {
        setTimeout(() => {
          setTiles(prev => prev.map(t => (t.id === a || t.id === b) ? { ...t, matched: true } : t));
          setFlipped([]);
          setScore(s => s + 10);
        }, 500);
      } else {
        setTimeout(() => {
          setTiles(prev => prev.map(t => (t.id === a || t.id === b) ? { ...t, revealed: false } : t));
          setFlipped([]);
        }, 800);
      }
    }
  };

  return (
    <div className="space-y-5">
      <GlassCard gold glow className="p-5 text-center" animate={false}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Gamepad2 size={24} className="text-hive-gold" />
          <h2 className="text-white font-black text-xl">Memory Match</h2>
        </div>
        <p className="text-white/40 text-xs mb-4">Match pairs to earn 5-20 Hive! One game every 2 hours.</p>

        {highScore > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] rounded-full mb-4">
            <Trophy size={12} className="text-hive-gold" />
            <span className="text-white/40 text-xs">Best Score: <span className="text-hive-gold font-bold">{highScore}</span></span>
          </div>
        )}

        {gameState === 'idle' && !gameStatus.canPlay && (
          <div className="flex items-center justify-center gap-2 text-white/50 py-4">
            <Clock size={18} />
            <span className="font-semibold text-sm">Next game in {gameStatus.hoursLeft}h</span>
          </div>
        )}

        {gameState === 'idle' && gameStatus.canPlay && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={startGame} className="btn-hive w-full py-4 text-lg font-black rounded-2xl flex items-center justify-center gap-2">
            <Play size={20} /> Watch Ad & Play
          </motion.button>
        )}

        {gameState === 'watching_ad' && (
          <div className="py-4 text-white/50 text-sm flex items-center justify-center gap-2">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
            Loading ad...
          </div>
        )}

        {(gameState === 'playing' || gameState === 'ended') && (
          <>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="text-center">
                <p className="text-white/30 text-[10px] uppercase">Score</p>
                <p className="text-hive-gold font-black text-lg">{score}</p>
              </div>
              <div className="text-center">
                <p className="text-white/30 text-[10px] uppercase">Moves</p>
                <p className="text-white/70 font-bold text-lg">{moves}</p>
              </div>
              <div className="text-center">
                <p className="text-white/30 text-[10px] uppercase">Time</p>
                <p className={`font-black text-lg ${timeLeft <= 10 ? 'text-red-400' : 'text-white/70'}`}>
                  {timeLeft}s
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
              {tiles.map(tile => (
                <motion.button
                  key={tile.id}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleTileClick(tile.id)}
                  disabled={tile.matched || tile.revealed || gameState === 'ended'}
                  className="aspect-square rounded-xl flex items-center justify-center text-2xl font-black relative"
                  style={{
                    background: tile.matched
                      ? 'linear-gradient(135deg, #F5C518, #FFB300)'
                      : tile.revealed
                        ? 'rgba(245, 197, 24, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: tile.matched ? '1px solid rgba(245, 197, 24, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {tile.revealed || tile.matched ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={tile.matched ? 'text-black' : 'text-hive-gold'}>
                      {tile.value}
                    </motion.span>
                  ) : (
                    <span className="text-white/20 text-lg">?</span>
                  )}
                </motion.button>
              ))}
            </div>

            <AnimatePresence>
              {gameState === 'ended' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                  <div className="py-3 bg-white/[0.06] rounded-xl">
                    <p className="text-white font-bold text-lg">
                      {tiles.every(t => t.matched) ? 'Perfect! All matched!' : `Time's up! Score: ${score}`}
                    </p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={startGame} className="btn-hive w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2">
                    <Play size={16} /> Play Again
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </GlassCard>

      <GlassCard className="p-4" animate={false}>
        <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">How to Play</h3>
        <ul className="space-y-1.5 text-white/50 text-xs">
          <li>• Watch an ad to start the game</li>
          <li>• Flip cards to find matching Hive values</li>
          <li>• Match all pairs before time runs out</li>
          <li>• Earn 5-20 Hive per game (random reward)</li>
          <li>• One game every 2 hours</li>
        </ul>
      </GlassCard>
    </div>
  );
}
