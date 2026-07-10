import type { Tile } from '../../engine/types';
import { TileComponent } from './TileComponent';

interface PlayerHandProps {
  tiles: Tile[];
  faceUp?: boolean;
  selectedTileId?: string | null;
  highlightedTileId?: string | null;
  onTileClick?: (tile: Tile) => void;
  position?: string;
  compact?: boolean;
  vertical?: boolean;
  rot?: number; // tile rotation: 0 (default), 90 (left), -90 (right)
  anchor?: 'start' | 'end'; // alignment anchor: 'start' (outer) or 'end' (inner/center)
  // Animation props
  breathing?: boolean; // Apply breathing animation to all tiles (current player)
  drawnTileId?: string; // Tile ID just drawn (shown on the right side)
  drawAnimTileId?: string; // Tile ID being drawn (animate with draw animation)
  drawAnimDuration?: number;
  discardAnimTileId?: string; // Tile ID being discarded (animate with discard animation)
  discardAnimDuration?: number;
  reactionAnimTileIds?: string[]; // Tile IDs for reaction animation
  reactionAnimDuration?: number;
  winAnimTileId?: string; // Tile that completed a win (win-flash highlight)
}

export function PlayerHand({
  tiles, faceUp = true, selectedTileId, highlightedTileId, onTileClick, compact = false, vertical = false, rot = 0,
  anchor = 'start',
  breathing = false,
  drawnTileId,
  drawAnimTileId,
  drawAnimDuration = 400,
  discardAnimTileId,
  discardAnimDuration = 300,
  reactionAnimTileIds = [],
  reactionAnimDuration = 300,
  winAnimTileId,
}: PlayerHandProps) {
  const tileSize = (compact || !faceUp) ? ('small' as const) : ('normal' as const);
  // Match the SIZES in TileComponent.tsx
  const SIZE_DIMS = tileSize === 'small'
    ? { w: 42, h: 60 }
    : { w: 60, h: 80 };
  const TILE_W = SIZE_DIMS.w;
  const TILE_H = SIZE_DIMS.h;
  const DRAWN_TILE_GAP = 20; // gap between hand and drawn tile

  if (tiles.length === 0) {
    return <div style={{ fontSize: '10px', color: 'rgba(224,213,193,0.3)', fontStyle: 'italic' }}>{faceUp ? '手中无牌' : ''}</div>;
  }

  // Helper to get animation type for a tile
  const getTileAnim = (tileId: string): 'draw' | 'discard' | 'reaction' | 'win' | 'breathe' | null => {
    if (drawAnimTileId === tileId) return 'draw';
    if (discardAnimTileId === tileId) return 'discard';
    if (reactionAnimTileIds.includes(tileId)) return 'reaction';
    if (winAnimTileId === tileId) return 'win';
    if (breathing) return 'breathe';
    return null;
  };

  if (vertical) {
    // Vertical stack (left/right AI). When rotated, the tile's visual width = original height.
    const rotated = rot !== 0;
    const visW = rotated ? TILE_H : TILE_W; // visual width of each tile in the stack
    const visH = rotated ? TILE_W : TILE_H; // visual height (stacking direction)
    // compact (left/right AI) overlap 16 so a 14-tile vertical hand stays ~380px
    // tall. Melds now sit BESIDE the hand (not above), so the block height ≈ hand
    // height. Table root overflow:hidden is the only hard backstop if it ever exceeds.
    const vOverlap = compact ? 16 : 10;
    const vStep = visH - vOverlap;

    return (
      <div style={{ position: 'relative', width: visW + 8, height: tiles.length * vStep + vOverlap, overflow: 'visible' }}>
        {tiles.map((tile, i) => {
          const isSelected = selectedTileId === tile.id;
          const tileAnim = getTileAnim(tile.id);
          const animDuration = tileAnim === 'draw' ? drawAnimDuration : 
                               tileAnim === 'discard' ? discardAnimDuration :
                               tileAnim === 'reaction' ? reactionAnimDuration : 0;
          return (
            <div key={tile.id} style={{
              position: 'absolute',
              top: i * vStep,
              left: isSelected ? 0 : 2,
              zIndex: isSelected ? 100 : i,
              transition: 'top 0.2s ease, left 0.15s ease',
            }}>
              <TileComponent 
                tile={tile} 
                faceUp={faceUp} 
                size={tileSize} 
                rot={rot}
                selected={isSelected} 
                highlighted={highlightedTileId === tile.id}
                onClick={faceUp && onTileClick ? () => onTileClick(tile) : undefined}
                animating={tileAnim}
                animDuration={animDuration}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal row (bottom/top)
  // Use fixed container width so the hand doesn't shift when tiles are removed.
  const hOverlap = compact ? 7 : 10;
  const H_STEP = TILE_W - hOverlap;
  const MAX_TILES = 14;
  const fixedWidth = MAX_TILES * H_STEP + hOverlap;

  if (anchor === 'end') {
    // Anchor to inner side: tiles stack from right to left.
    return (
      <div style={{ position: 'relative', width: fixedWidth, height: TILE_H + 12, overflow: 'visible' }}>
        {tiles.map((tile, i) => {
          const isSelected = selectedTileId === tile.id;
          const offset = (tiles.length - 1 - i) * H_STEP;
          const tileAnim = getTileAnim(tile.id);
          const animDuration = tileAnim === 'draw' ? drawAnimDuration : 
                               tileAnim === 'discard' ? discardAnimDuration :
                               tileAnim === 'reaction' ? reactionAnimDuration : 0;
          return (
            <div key={tile.id} style={{
              position: 'absolute',
              right: offset,
              top: isSelected ? 0 : 6,
              zIndex: isSelected ? 100 : i,
              transition: 'right 0.2s ease, top 0.15s ease',
            }}>
              <TileComponent 
                tile={tile} 
                faceUp={faceUp} 
                size={tileSize} 
                rot={rot}
                selected={isSelected} 
                highlighted={highlightedTileId === tile.id}
                onClick={faceUp && onTileClick ? () => onTileClick(tile) : undefined}
                animating={tileAnim}
                animDuration={animDuration}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // anchor='start' (default): anchor to outer side, tiles extend inward.
  // Drawn tile appears on the right side with a gap, NOT in the hand.
  const hasDrawnTile = !!drawnTileId;
  // Filter out the drawn tile from the hand rendering — it's shown separately on the right.
  const handTiles = hasDrawnTile ? tiles.filter((t) => t.id !== drawnTileId) : tiles;
  const hStep = TILE_W - hOverlap;
  const baseWidth = handTiles.length * hStep + (handTiles.length > 0 ? hOverlap : 0);

  return (
    <div style={{ position: 'relative', width: baseWidth + (hasDrawnTile ? DRAWN_TILE_GAP + TILE_W : 0), height: TILE_H + 12, overflow: 'visible' }}>
      {handTiles.map((tile, i) => {
        const isSelected = selectedTileId === tile.id;
        const tileAnim = getTileAnim(tile.id);
        const animDuration = tileAnim === 'draw' ? drawAnimDuration :
                             tileAnim === 'discard' ? discardAnimDuration :
                             tileAnim === 'reaction' ? reactionAnimDuration : 0;
        return (
          <div key={tile.id} style={{
            position: 'absolute',
            left: i * hStep,
            top: isSelected ? 0 : 6,
            zIndex: isSelected ? 100 : i,
            transition: 'left 0.2s ease, top 0.15s ease',
          }}>
            <TileComponent
              tile={tile}
              faceUp={faceUp}
              size={tileSize}
              rot={rot}
              selected={isSelected}
              highlighted={highlightedTileId === tile.id}
              onClick={faceUp && onTileClick ? () => onTileClick(tile) : undefined}
              animating={tileAnim}
              animDuration={animDuration}
            />
          </div>
        );
      })}

      {/* Drawn tile on the right side, separated by a gap */}
      {(() => {
        const drawnTile = drawnTileId ? tiles.find((t) => t.id === drawnTileId) : null;
        if (!hasDrawnTile || !drawnTile) return null;
        return (
          <div
            key={`drawn-${drawnTileId}`}
            style={{
              position: 'absolute',
              left: baseWidth + DRAWN_TILE_GAP,
              top: selectedTileId === drawnTileId ? 0 : 6,
              zIndex: 1000,
              transition: 'all 0.2s ease',
            }}
          >
            <TileComponent
              tile={drawnTile}
              faceUp={faceUp}
              size={tileSize}
              rot={rot}
              selected={selectedTileId === drawnTileId}
              onClick={faceUp && onTileClick ? () => onTileClick(drawnTile) : undefined}
            />
          </div>
        );
      })()}
    </div>
  );
}