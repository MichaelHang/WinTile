import { useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { useGameLoop } from './hooks/useGameLoop';
import { useSoundEffects } from './hooks/useSoundEffects';
import { usePlayerActions } from './hooks/usePlayerActions';
import { useCallback, lazy, Suspense, useState } from 'react';
import { GameScreen } from './components/Screens/GameScreen';
import './App.css';

// Lazy-loaded screens — only fetched when their phase is active.
const StartScreen = lazy(() =>
  import('./components/Screens/StartScreen').then((m) => ({ default: m.StartScreen }))
);
const WinScreen = lazy(() =>
  import('./components/Screens/WinScreen').then((m) => ({ default: m.WinScreen }))
);
const DrawScreen = lazy(() =>
  import('./components/Screens/DrawScreen').then((m) => ({ default: m.DrawScreen }))
);
const StatsScreen = lazy(() =>
  import('./components/Screens/StatsScreen').then((m) => ({ default: m.StatsScreen }))
);

function App() {
  // Drive the game state machine (side-effect hook, no return value)
  useGameLoop();
  // Play synthesized sound effects on game events (gated by mute setting)
  useSoundEffects();
  // Human player derived state + handlers (must be called unconditionally)
  const player = usePlayerActions();
  const { settings } = useSettingsStore();

  const gameState = useGameStore((s) => s.gameState);
  const isAutoPlay = useGameStore((s) => s.isAutoPlay);
  const toggleAutoPlay = useGameStore((s) => s.toggleAutoPlay);
  const newGame = useGameStore((s) => s.newGame);
  const continueGame = useGameStore((s) => s.continueGame);
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const nextRound = useGameStore((s) => s.nextRound);
  
  const [showStats, setShowStats] = useState(false);
  
  // New game with confirmation
  const handleNewGame = useCallback(() => {
    if (window.confirm('确定要重新开始吗？这将重置所有积分。')) {
      newGame();
    }
  }, [newGame]);

  // Show stats screen
  if (showStats) {
    return (
      <Suspense fallback={null}>
        <StatsScreen onBack={() => setShowStats(false)} />
      </Suspense>
    );
  }

  // ── Start screen ──
  if (gameState.phase === 'idle') {
    return (
      <Suspense fallback={null}>
        <StartScreen
          onStart={(partialSettings) => newGame({ ...settings, ...partialSettings })}
          onContinue={continueGame}
          hasSavedGame={hasSavedGame}
          onShowStats={() => setShowStats(true)}
        />
      </Suspense>
    );
  }

  // ── Win screen ──
  if (gameState.phase === 'declaring_win') {
    return (
      <Suspense fallback={null}>
        <WinScreen gameState={gameState} onNextRound={nextRound} onNewGame={handleNewGame} />
      </Suspense>
    );
  }

  // ── Draw (流局) screen ──
  if (gameState.phase === 'round_over') {
    return (
      <Suspense fallback={null}>
        <DrawScreen gameState={gameState} onNextRound={nextRound} onNewGame={handleNewGame} />
      </Suspense>
    );
  }

  // ── Game screen ──
  return (
    <GameScreen
      gameState={gameState}
      selectedTileId={player.selectedTileId}
      isMyDiscard={player.isMyDiscard}
      isMyReaction={player.isMyReaction}
      isTenpai={player.isTenpai}
      isAutoPlay={isAutoPlay}
      onToggleAutoPlay={toggleAutoPlay}
      canSelfHu={player.canSelfHu}
      anKongOptions={player.anKongOptions}
      jiaGangOptions={player.jiaGangOptions}
      onTileClick={player.handleTileClick}
      onSelfHu={player.handleSelfHu}
      onAnKong={player.handleAnKong}
      onJiaGang={player.handleJiaGang}
      onChi={player.onChi}
      onPong={player.onPong}
      onKong={player.onKong}
      onHu={player.onHu}
      onPass={player.onPass}
      onNewGame={handleNewGame}
    />
  );
}

export default App;
