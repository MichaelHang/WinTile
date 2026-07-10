import { describe, it, expect } from 'vitest';
import { act, Component } from 'react';
import type { ErrorInfo } from 'react';
import { render } from '@testing-library/react';
import App from '../../App';
import { useGameStore } from '../../store/gameStore';
import { resetTileIdCounter } from '../../engine/tile';

interface CaptureBoundaryProps {
  onCapture: (error: Error, stack: string | undefined) => void;
  children: React.ReactNode;
}

interface CaptureBoundaryState {
  hasError: boolean;
}

class CaptureBoundary extends Component<CaptureBoundaryProps, CaptureBoundaryState> {
  constructor(props: CaptureBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): CaptureBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onCapture(error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

describe('App render crash reproduction', () => {
  it('plays many rounds without a render exception', () => {
    resetTileIdCounter();
    let capturedError: Error | null = null;
    let capturedStack: string | null = null;

    const { unmount } = render(
      <CaptureBoundary onCapture={(error, stack) => {
        capturedError = error;
        capturedStack = stack;
      }}>
        <App />
      </CaptureBoundary>
    );

    const getState = () => useGameStore.getState().gameState;

    act(() => {
      useGameStore.getState().newGame({ aiDifficulty: 'medium' });
    });

    for (let step = 0; step < 4000 && !capturedError; step++) {
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
        if (p.hand.length > 0) {
          act(() => useGameStore.getState().discardTile(p.hand[0].id));
        }
        continue;
      }
      if (st.phase === 'awaiting_reactions') {
        act(() => useGameStore.getState().passReaction());
        continue;
      }
      break;
    }

    if (capturedError) {
      console.log('CAPTURED ERROR:', capturedError.message);
      console.log('COMPONENT STACK:', capturedStack);
    }

    expect(capturedError).toBeNull();
    unmount();
  });
});