import type { Tile } from '../../engine/types';
import { TileComponent } from './TileComponent';

interface DiscardPoolProps {
  discards: Tile[];
  position?: 'bottom' | 'top' | 'left' | 'right';
  rot?: number;
  // Animation: the most-recently-discarded tile id (lands with a pop-in)
  lastTileId?: string | null;
  landDuration?: number;
}

const COL_HEIGHT = 10; // max tiles per column (left/right)
const ROW_WIDTH = 10;  // max tiles per row (bottom/top)

export function DiscardPool({ discards, position, rot = 0, lastTileId, landDuration }: DiscardPoolProps) {
  if (discards.length === 0) return null;

  const horizontalTiles = Math.abs(rot) === 90;

  if (horizontalTiles) {
    // Left/right players: tiles rendered horizontally (landscape).
    // Discards laid out in columns.
    const colCount = Math.ceil(discards.length / COL_HEIGHT);
    const cols: Tile[][] = [];
    for (let c = 0; c < colCount; c++) {
      cols.push(discards.slice(c * COL_HEIGHT, (c + 1) * COL_HEIGHT));
    }

    // Direction logic (relative to table center):
    // - Right AI: discards on the LEFT (inner side). Col 0 closest to center.
    //   New columns grow rightward (away from center). → row (default)
    //   Tiles within column start from BOTTOM. → column-reverse
    //   Columns bottom-aligned so short cols don't float up. → alignItems: flex-end
    // - Left AI: discards on the RIGHT (inner side). Col 0 closest to center.
    //   New columns grow leftward (away from center). → row-reverse
    //   Tiles within column start from TOP. → column (default)
    //   Columns top-aligned. → alignItems: flex-start
    const reverseCols = position === 'left';
    const reverseTiles = position === 'right';

    return (
      <div style={{
        display: 'flex',
        flexDirection: reverseCols ? 'row-reverse' : 'row',
        gap: 1,
        alignItems: 'center',
        height: '100%',
      }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{
            display: 'flex',
            flexDirection: reverseTiles ? 'column-reverse' : 'column',
            gap: 0,
            ...(reverseTiles ? { height: '100%', justifyContent: 'flex-start' } : {}),
          }}>
            {col.map((tile, ti) => (
              <div key={tile.id} style={{ marginTop: ti > 0 ? -6 : 0 }}>
                <TileComponent
                  key={tile.id}
                  tile={tile}
                  faceUp
                  size="small"
                  rot={rot}
                  animating={tile.id === lastTileId ? 'land' : null}
                  animDuration={tile.id === lastTileId ? landDuration : undefined}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Bottom/top players: discards in rows, read left-to-right then top-to-bottom.
  const rows: Tile[][] = [];
  for (let i = 0; i < discards.length; i += ROW_WIDTH) {
    rows.push(discards.slice(i, i + ROW_WIDTH));
  }

  // Direction logic (relative to table center):
  // - Bottom player: discards ABOVE hand. Row 0 closest to center (top).
  //   New rows grow downward (away from center). → column (default)
  //   Tiles within row start from LEFT. → flex-start
  // - Top AI: discards BELOW hand. Row 0 closest to center (bottom).
  //   New rows grow upward (away from center). → column-reverse
  //   Tiles within row start from LEFT. → flex-start
  const reverseRows = position === 'top';

  return (
    <div style={{
      display: 'flex',
      flexDirection: reverseRows ? 'column-reverse' : 'column',
      gap: 1,
      alignItems: 'flex-start',
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 1, justifyContent: 'flex-start' }}>
          {row.map((tile) => (
            <TileComponent
              key={tile.id}
              tile={tile}
              faceUp
              size="small"
              rot={rot}
              animating={tile.id === lastTileId ? 'land' : null}
              animDuration={tile.id === lastTileId ? landDuration : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
