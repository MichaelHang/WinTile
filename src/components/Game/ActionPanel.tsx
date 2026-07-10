import type { Reaction, Tile, GameState } from '../../engine/types';
import { TileComponent } from './TileComponent';
import { tileTypeToCode } from '../../engine/tile';
import { playClick } from '../../audio/soundManager';

interface ActionPanelProps {
  reactions: Reaction[];
  // NOTE: this is the discard EVENT ({ tile, playerIndex }), NOT a Tile.
  lastDiscard?: GameState['lastDiscard'];
  hand?: Tile[]; // Human player's hand for pong/kong preview
  onChi: (chiOptionIndex: number) => void;
  onPong: () => void;
  onKong: () => void;
  onHu: () => void;
  onPass: () => void;
  disabled?: boolean;
}

export function ActionPanel({ reactions, lastDiscard, hand, onChi, onPong, onKong, onHu, onPass, disabled }: ActionPanelProps) {
  const hr = reactions.filter((r) => r.playerIndex === 0);
  if (hr.length === 0) return null;

  const canHu = hr.some(r => r.kind === 'hu');
  const canPong = hr.some(r => r.kind === 'pong');
  const canKong = hr.some(r => r.kind === 'kong');
  const chiR = hr.find(r => r.kind === 'chi');

  // Compute tiles for pong/kong preview
  const pongPreviewTiles: Tile[] = canPong && lastDiscard && hand
    ? hand.filter(t => tileTypeToCode(t.type) === tileTypeToCode(lastDiscard.tile.type)).slice(0, 2)
    : [];

  const kongPreviewTiles: Tile[] = canKong && lastDiscard && hand
    ? hand.filter(t => tileTypeToCode(t.type) === tileTypeToCode(lastDiscard.tile.type)).slice(0, 3)
    : [];

  const btnStyle = (bg: string): React.CSSProperties => ({
    padding: '14px 26px',
    fontSize: '22px',
    fontWeight: 700,
    borderRadius: '8px',
    background: bg,
    color: '#fff',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    minWidth: '80px',
    boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const previewBoxStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    padding: '4px 10px',
    background: 'rgba(201,169,78,0.14)',
    borderRadius: '6px',
    border: '1px solid rgba(201,169,78,0.45)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };

  // Render a tile preview with optional highlighting
  const renderTile = (tile: Tile, highlight: boolean = false, key?: string) => (
    <div key={key} style={{ position: 'relative' }}>
      <TileComponent
        tile={tile}
        faceUp
        size="small"
        selected={highlight}
        highlighted={highlight}
        animating={null}
        animDuration={0}
      />
    </div>
  );

  // Split chi options: first one goes into the fixed bottom row,
  // any extras (吃2, 吃3…) stack vertically ABOVE so they never cover the hand.
  const firstChi = chiR?.chiOptions?.[0] ? 0 : undefined;
  const extraChis = chiR?.chiOptions
    ?.map((_, i) => i)
    .filter((i) => i > 0) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {/* Extra chi options stacked above the main row */}
      {extraChis.map((i) => (
        <div key={`ex-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={previewBoxStyle}>
            {lastDiscard && renderTile(lastDiscard.tile, false, `chi-ex-discard-${i}`)}
            {chiR!.chiOptions![i].tiles.map((t, ti) => renderTile(t, true, `chi-ex-${i}-${ti}`))}
          </div>
          <button onClick={() => { playClick(); onChi(i); }} disabled={disabled} style={btnStyle('#16a34a')}>
            吃{i + 1}
          </button>
        </div>
      ))}

      {/* Fixed bottom row: 胡 | 杠 | 碰 | 吃1 | 过 — positions never shift */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'flex-start' }}>
        {canHu && <button onClick={() => { playClick(); onHu(); }} disabled={disabled} style={btnStyle('#c41e3a')}>胡</button>}

        {canKong && lastDiscard && kongPreviewTiles.length >= 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={previewBoxStyle}>
              {renderTile(lastDiscard.tile, false, 'kong-discard')}
              {kongPreviewTiles.map((t, i) => renderTile(t, true, `kong-${i}`))}
            </div>
            <button onClick={() => { playClick(); onKong(); }} disabled={disabled} style={btnStyle('#b45309')}>杠</button>
          </div>
        )}

        {canPong && lastDiscard && pongPreviewTiles.length >= 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={previewBoxStyle}>
              {renderTile(lastDiscard.tile, false, 'pong-discard')}
              {pongPreviewTiles.map((t, i) => renderTile(t, true, `pong-${i}`))}
            </div>
            <button onClick={() => { playClick(); onPong(); }} disabled={disabled} style={btnStyle('#2563eb')}>碰</button>
          </div>
        )}

        {firstChi !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={previewBoxStyle}>
              {lastDiscard && renderTile(lastDiscard.tile, false, 'chi-0-discard')}
              {chiR!.chiOptions![0].tiles.map((t, i) => renderTile(t, true, `chi-0-${i}`))}
            </div>
            <button onClick={() => { playClick(); onChi(0); }} disabled={disabled} style={btnStyle('#16a34a')}>
              吃{chiR!.chiOptions!.length > 1 ? 1 : ''}
            </button>
          </div>
        )}

        <button onClick={() => { playClick(); onPass(); }} disabled={disabled} style={btnStyle('#4b5563')}>过</button>
      </div>
    </div>
  );
}
