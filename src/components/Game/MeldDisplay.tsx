import type { Meld } from '../../engine/types';
import { TileComponent } from './TileComponent';

interface MeldDisplayProps {
  melds: Meld[];
  position: 'bottom' | 'top' | 'left' | 'right';
  rot?: number; // tile rotation for left/right players
}

export function MeldDisplay({ melds, position, rot = 0 }: MeldDisplayProps) {
  if (melds.length === 0) return null;

  const isLeftOrRight = position === 'left' || position === 'right';
  const horizontalTiles = Math.abs(rot) === 90;

  // For left/right AI: melds stack vertically (top-to-bottom), each meld's tiles read top-to-bottom.
  // Tiles within a meld overlap (like the hand) so a 3-tile pong stays short instead of 126px tall,
  // keeping the whole left/right block inside the table. GameTable overflow:hidden is the hard backstop.
  if (isLeftOrRight) {
    // Use same overlap as PlayerHand (16px) for consistency
    const MELD_TILE_OVERLAP = 16;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        {melds.map((meld, idx) => (
          <div key={idx} className="tile-anim-meld" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {meld.tiles.map((tile, tidx) => (
                <div key={`${idx}-${tidx}`} style={{ marginBottom: tidx < meld.tiles.length - 1 ? -MELD_TILE_OVERLAP : 0 }}>
                  <TileComponent
                    tile={tile}
                    faceUp={meld.kind !== 'ankong'}
                    size="small"
                    rot={rot}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Bottom/top players: melds in a row, each meld's tiles in a row.
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {melds.map((meld, idx) => (
        <div key={idx} className="tile-anim-meld" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 0 }}>
            {meld.tiles.map((tile, tidx) => (
              <TileComponent
                key={`${idx}-${tidx}`}
                tile={tile}
                faceUp={meld.kind !== 'ankong'}
                size="small"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
