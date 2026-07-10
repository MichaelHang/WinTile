// Reproduction test: mount the real <App/> and drive a full game, asserting
// no React render error occurs (the "type is not an Object" crash).
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import App from '../../App';
import { useGameStore } from '../../store/gameStore';
import { resetTileIdCounter } from '../../engine/tile';

// Capturing boundary to record the component stack + error.
class CaptureBoundary extends (require('react').Component) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  componentDidCatch(error: any, info: any) {
    this.props.onCapture({ error, stack: info?.componentStack });
  }
  render() {
    return (this.props as any).children;
  }
}

describe('App render crash reproduction', () => {
  beforeEach(() => {
    resetTileIdCounter();
  });

  it('plays many rounds without a render exception', () => {
    let captured: { error: any; stack: string } | null = null;

    const { unmount } = render(
      <CaptureBoundary onCapture={(c: any) => { captured = c; }}>
        <App />
      </CaptureBoundary>
    );

    const getState = () => useGameStore.getState().gameState;

    act(() => {
      useGameStore.getState().newGame({ aiDifficulty: 'medium' });
    });

    for (let step = 0; step < 4000 && !captured; step++) {
      const st = getState();

      if (st.phase === 'idle') {
        act(() => useGameStore.getState().newGame({ aiDifficulty: 'medium' }));
        continue;
      }
      if (st.phase === 'round_over' || st.phase === 'declaring_win') {
        act(() => useGameStore.getState().nextRound());
        continue;
      }
      if (st.phase === 'player_turn' || st.phase === 'replacement_draw') {
        act(() => useGameStore.getState().drawTile());
        continue;
      }
      if (st.phase === 'awaiting_discard') {
        const p = st.players[st.currentPlayerIndex];
        act(() => useGameStore.getState().discardTile(p.hand[0].id));
        continue;
      }
      if (st.phase === 'awaiting_reactions') {
        act(() => useGameStore.getState().passReaction());
        continue;
      }
      break;
    }

    if (captured) {
      // eslint-disable-next-line no-console
      console.log('CAPTURED ERROR:', captured.error?.message);
      console.log('COMPONENT STACK:', captured.stack);
    }

    expect(captured).toBeNull();
    unmount();
  });
});
