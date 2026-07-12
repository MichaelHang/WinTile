import type { PlayerState, TileType } from '../../engine/types';
import { PlayerHand } from './PlayerHand';
import { MeldDisplay } from './MeldDisplay';
import { DiscardPool } from './DiscardPool';
import { useSettingsStore } from '../../store/settingsStore';
import { getAnimationDuration } from '../../hooks/useAnimations';

interface PlayerAreaProps {
  player: PlayerState;
  position: 'bottom' | 'top' | 'left' | 'right';
  isCurrentTurn: boolean;
  selectedTileId?: string | null;
  highlightedTileId?: string | null;
  onTileClick?: (tile: { id: string; type: TileType }) => void;
  isHuman: boolean;
  // Animation state (from parent GameScreen)
  drawAnimTileId?: string; // Tile being drawn into this player's hand
  discardAnimTileId?: string; // Tile being discarded by this player
  reactionAnimTileIds?: string[]; // Tiles involved in chi/pong/kong
  winAnimTileId?: string; // Tile that completed a win (win-flash highlight)
  drawnTileId?: string; // Tile just drawn (shown on the right side)
  isBreathing?: boolean; // Apply breathing animation to this player's hand
  // Auto-play toggle (only used for the human / bottom position)
  isTenpai?: boolean;
  isAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
}

export function PlayerArea({
  player, position, isCurrentTurn, selectedTileId, onTileClick, isHuman,
  drawAnimTileId,
  discardAnimTileId,
  reactionAnimTileIds = [],
  isBreathing = false,
  drawnTileId,
  winAnimTileId,
  isTenpai,
  isAutoPlay,
  onToggleAutoPlay,
}: PlayerAreaProps) {
  const { settings } = useSettingsStore();
  const drawDuration = getAnimationDuration('draw', settings.animationSpeed);
  const discardDuration = getAnimationDuration('discard', settings.animationSpeed);
  const reactionDuration = getAnimationDuration('reaction', settings.animationSpeed);

  // Live cumulative score (跨局战绩): shown for every player during play.
  // AI players get name + score; the human gets a compact score chip.
  const label = isHuman ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px',
        background: 'rgba(201,169,78,0.18)', color: '#c9a94e', whiteSpace: 'nowrap',
      }}>💰 {player.score}</span>
    </div>
  ) : (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 4, 
      flexShrink: 0,
      animation: isCurrentTurn ? `breathe ${getAnimationDuration('breathe', settings.animationSpeed)}ms ease-in-out infinite` : 'none',
    }}>
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
        background: player.isDealer ? 'rgba(196,30,58,0.8)' : 'rgba(255,255,255,0.15)',
        color: player.isDealer ? '#fff' : 'rgba(255,255,255,0.75)',
        whiteSpace: 'nowrap',
      }}>{player.isDealer ? '庄' : ''}{player.name}</span>
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px',
        background: 'rgba(201,169,78,0.18)', color: '#c9a94e', whiteSpace: 'nowrap',
      }}>💰 {player.score}</span>
      {isCurrentTurn && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c9a94e', boxShadow: '0 0 6px #c9a94e' }} />}
    </div>
  );

  // ---- BOTTOM (Human) ----
  // Layout: [discards above] then [melds | hand | buttons] in a row
  // Drawn tile is rendered inside PlayerHand on the right side.
  if (position === 'bottom') {
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '2px 4px 14px', gap: 2 }}>
        {/* Discards above the hand, block centered but rows left-aligned within */}
        <div style={{ minHeight: 18, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <DiscardPool discards={player.discards} position="bottom" lastTileId={player.discards.at(-1)?.id ?? null} landDuration={discardDuration} />
        </div>
        {/* Main row: the hand+label column is the only normal-flow child and stays centered.
            Melds are anchored to the hand's LEFT edge (right:100%) and right-aligned, so they
            start right beside the hand and extend leftward into the empty space. Buttons live
            outside this row (top-right of the area) so they never shift the hand. */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', overflow: 'visible' }}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {/* Melds: right edge sits at the hand column's left edge, content packed right
                so the nearest meld touches the hand and extras grow toward the left. */}
            <div style={{ position: 'absolute', right: '100%', bottom: 0, marginRight: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: '40vw' }}>
              <MeldDisplay melds={player.melds} position="bottom" />
            </div>
            {label}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 80, paddingTop: 6, paddingBottom: 6 }}>
              <PlayerHand tiles={player.hand} faceUp={isHuman} position="bottom"
                selectedTileId={selectedTileId} onTileClick={onTileClick} compact={false} vertical={false}
                anchor="start"
                breathing={isBreathing}
                drawAnimTileId={drawAnimTileId}
                drawAnimDuration={drawDuration}
                discardAnimTileId={discardAnimTileId}
                discardAnimDuration={discardDuration}
                reactionAnimTileIds={reactionAnimTileIds}
                reactionAnimDuration={reactionDuration}
                drawnTileId={drawnTileId}
                winAnimTileId={winAnimTileId}
              />
              {/* Auto-play toggle — beside the hand on the right */}
              {isTenpai && onToggleAutoPlay && (
                <button
                  onClick={onToggleAutoPlay}
                  style={{
                    padding: '6px 14px',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    background: isAutoPlay
                      ? 'linear-gradient(135deg, #e8d48b, #c9a94e)'
                      : 'rgba(201,169,78,0.15)',
                    color: isAutoPlay ? '#0a1628' : 'rgba(201,169,78,0.85)',
                    border: isAutoPlay
                      ? '1px solid #c9a94e'
                      : '1px solid rgba(201,169,78,0.35)',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                >
                  {isAutoPlay ? '托管中' : '托管'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- TOP (AI) ----
  // Layout: label → [hand | melds] → discards (facing center, below the hand)
  // Melds go to the RIGHT of the hand (mirroring bottom player where melds are on the left).
  // Discards grow upward (away from center) when exceeding one row.
  if (position === 'top') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 4px', gap: 1, overflow: 'visible' }}>
        <div style={{ flexShrink: 0 }}>{label}</div>
        {/* Hand + melds in a row: melds on the right with more gap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <PlayerHand tiles={player.hand} faceUp={false} position="top" compact vertical={false}
            drawAnimTileId={drawAnimTileId}
            drawAnimDuration={drawDuration}
            discardAnimTileId={discardAnimTileId}
            discardAnimDuration={discardDuration}
            reactionAnimTileIds={reactionAnimTileIds}
            reactionAnimDuration={reactionDuration}
            winAnimTileId={winAnimTileId}
          />
          <div style={{ marginLeft: 4 }}>
            <MeldDisplay melds={player.melds} position="top" />
          </div>
        </div>
        {/* Discards below, facing center, starting from the left */}
        <div style={{ flexShrink: 0, overflow: 'visible', position: 'relative', zIndex: 1, alignSelf: 'flex-start' }}>
          <DiscardPool discards={player.discards} position="top" lastTileId={player.discards.at(-1)?.id ?? null} landDuration={discardDuration} />
        </div>
      </div>
    );
  }

  // ---- LEFT / RIGHT (AI) ----
  // Hand is vertical (top-to-bottom stack of rotated tiles). Per user request, the
  // hand and melds are placed SIDE BY SIDE (horizontally) inside the edge column,
  // which makes the block SHORTER (height = max(hand, melds) instead of the sum) and
  // leaves more vertical room. Discards stay in a SEPARATE column that vertically
  // centers itself (DiscardPool: height:100% + alignItems:center), independent of the
  // hand. The label sits at the VERY TOP of the block, directly above the tiles — never
  // overlapping. No clipping, no zIndex — space is sufficient per user.
  // Mirror layout: hand hugs the OUTER edge (player's seat), melds sit next to the hand,
  // discards are on the CENTER side. No divider — the two tile columns read as one block.
  const isLeft = position === 'left';
  const rot = isLeft ? 90 : -90;

  // Edge column: hand + melds side by side (two vertical columns), TOP-aligned so the
  // tiles always start directly below the label and only overflow DOWNWARD when too tall
  // — never upward into the label (which would happen with center alignment on short screens).
  const edgeColumn = (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 10, overflow: 'visible' }}>
      {isLeft ? (
        <>
          <PlayerHand tiles={player.hand} faceUp={false} position={position} compact={true} vertical={true} rot={rot}
            drawAnimTileId={drawAnimTileId}
            drawAnimDuration={drawDuration}
            discardAnimTileId={discardAnimTileId}
            discardAnimDuration={discardDuration}
            reactionAnimTileIds={reactionAnimTileIds}
            reactionAnimDuration={reactionDuration}
            winAnimTileId={winAnimTileId}
          />
          <MeldDisplay melds={player.melds} position={position} rot={rot} />
        </>
      ) : (
        <>
          <MeldDisplay melds={player.melds} position={position} rot={rot} />
          <PlayerHand tiles={player.hand} faceUp={false} position={position} compact={true} vertical={true} rot={rot}
            drawAnimTileId={drawAnimTileId}
            drawAnimDuration={drawDuration}
            discardAnimTileId={discardAnimTileId}
            discardAnimDuration={discardDuration}
            reactionAnimTileIds={reactionAnimTileIds}
            reactionAnimDuration={reactionDuration}
            winAnimTileId={winAnimTileId}
          />
        </>
      )}
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isLeft ? 'flex-start' : 'flex-end',
      justifyContent: 'flex-start',
      height: '100%',
      width: '100%',
      padding: isLeft ? '4px 8px 4px 10px' : '4px 10px 4px 8px',
      gap: 4,
      overflow: 'visible',
    }}>
      {/* Label at the top of the block — always above the tiles, never overlapping. */}
      <div style={{ flexShrink: 0 }}>{label}</div>
      {/* Two-column row fills the remaining height so the discards column can center itself. */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', flex: 1, minHeight: 0, justifyContent: isLeft ? 'flex-start' : 'flex-end', gap: 6, overflow: 'visible' }}>
        {isLeft ? (
          // Left AI: [hand | melds] (outer/edge, side by side) then [discards] (inner/center).
          <>
            {edgeColumn}
            <DiscardPool discards={player.discards} position={position} rot={rot} lastTileId={player.discards.at(-1)?.id ?? null} landDuration={discardDuration} />
          </>
        ) : (
          // Right AI (ai东): mirror — [discards] (inner/center) then [melds | hand] (outer/edge, side by side).
          <>
            <DiscardPool discards={player.discards} position={position} rot={rot} lastTileId={player.discards.at(-1)?.id ?? null} landDuration={discardDuration} />
            {edgeColumn}
          </>
        )}
      </div>
    </div>
  );
}
