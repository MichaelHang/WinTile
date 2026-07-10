import { useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { useGameLoop } from './hooks/useGameLoop';
import { useSoundEffects } from './hooks/useSoundEffects';
import { usePlayerActions } from './hooks/usePlayerActions';
import { useCallback } from 'react';
import { StartScreen } from './components/Screens/StartScreen';
import { WinScreen } from './components/Screens/WinScreen';
import { DrawScreen } from './components/Screens/DrawScreen';
import { GameScreen } from './components/Screens/GameScreen';
import './App.css';

function App() {
  // Drive the game state machine (side-effect hook, no return value)
  useGameLoop();
  // Play synthesized sound effects on game events (gated by mute setting)
  useSoundEffects();
  // Human player derived state + handlers (must be called unconditionally)
  const player = usePlayerActions();
  const { settings } = useSettingsStore();

  const gameState = useGameStore((s) => s.gameState);
  const newGame = useGameStore((s) => s.newGame);
  const nextRound = useGameStore((s) => s.nextRound);
  
  // New game with confirmation
  const handleNewGame = useCallback(() => {
    if (window.confirm('确定要重新开始吗？这将重置所有积分。')) {
      newGame();
    }
  }, [newGame]);

  // ── Start screen ──
  if (gameState.phase === 'idle') {
    return (
      <StartScreen
        onStart={(partialSettings) => newGame({ ...settings, ...partialSettings })}
      />
    );
  }

  // ── Win screen ──
  if (gameState.phase === 'declaring_win') {
    return (
      <WinScreen gameState={gameState} onNextRound={nextRound} onNewGame={handleNewGame} />
    );
  }

  // ── Draw (流局) screen ──
  if (gameState.phase === 'round_over') {
    return <DrawScreen gameState={gameState} onNextRound={nextRound} onNewGame={handleNewGame} />;
  }

  // ── Game screen ──
  return (
    <GameScreen
      gameState={gameState}
      selectedTileId={player.selectedTileId}
      isMyDiscard={player.isMyDiscard}
      isMyReaction={player.isMyReaction}
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
