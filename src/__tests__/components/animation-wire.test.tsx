// ============================================================
// 回归测试：牌面动画接线
// - 弃牌池最新一张牌挂 tile-anim-land（落点弹出）
// - 吃碰杠副露牌组挂 tile-anim-meld（弹出）
// 防止后续重构把这些入口动画弄丢。
// ============================================================

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DiscardPool } from '../../components/Game/DiscardPool';
import { MeldDisplay } from '../../components/Game/MeldDisplay';
import { createTile } from '../../engine/tile';
import type { Meld } from '../../engine/types';

describe('tile animation wiring', () => {
  it('applies tile-anim-land only to the most recently discarded tile', () => {
    const t1 = createTile({ suit: 'wan', rank: 1 });
    const t2 = createTile({ suit: 'wan', rank: 2 });
    const { container } = render(
      <DiscardPool
        discards={[t1, t2]}
        position="bottom"
        lastTileId={t2.id}
        landDuration={300}
      />
    );
    // Exactly one tile (the newest) should carry the land animation class.
    expect(container.querySelectorAll('.tile-anim-land').length).toBe(1);
  });

  it('does not animate older discarded tiles', () => {
    const t1 = createTile({ suit: 'wan', rank: 1 });
    const t2 = createTile({ suit: 'wan', rank: 2 });
    const { container } = render(
      <DiscardPool discards={[t1, t2]} position="bottom" lastTileId={t2.id} />
    );
    // Only the last tile lands; the rest stay static.
    expect(container.querySelectorAll('.tile-anim-land').length).toBe(1);
  });

  it('applies tile-anim-meld to each formed meld', () => {
    const meldTiles = [
      createTile({ suit: 'tong', rank: 3 }),
      createTile({ suit: 'tong', rank: 3 }),
      createTile({ suit: 'tong', rank: 3 }),
    ];
    const melds: Meld[] = [{ kind: 'pong', tiles: meldTiles }];
    const { container } = render(<MeldDisplay melds={melds} position="bottom" />);
    expect(container.querySelectorAll('.tile-anim-meld').length).toBeGreaterThanOrEqual(1);
  });
});
