import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — last line of defense.
 * Without it, a single render-time exception unmounts the ENTIRE React tree,
 * leaving a blank/black page (this is exactly what happened with the
 * "对家出牌后整页变黑" crash). Now we show a readable fallback instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] 渲染崩溃：', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: '#0d1b2a',
            color: '#e0d5c0',
            fontFamily: "'Noto Serif SC', serif",
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40 }}>🀄</div>
          <h2 style={{ color: '#c9a94e', margin: 0 }}>游戏出错了</h2>
          <p style={{ maxWidth: 480, fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
            界面渲染时发生异常，已被错误边界拦截（避免整页黑屏）。
            错误信息：{this.state.error.message}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 6,
              background: 'rgba(201,169,78,0.7)',
              color: '#0a1628',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
