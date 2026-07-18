import { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { 
  getOverallStats, 
  getLeaderboard, 
  getWinRate, 
  getAverageFan,
  clearAllStats,
  type PlayerStats,
  type GameRecord,
  type LeaderboardEntry
} from '../../store/statsStore';

interface StatsScreenProps {
  onBack: () => void;
}

export function StatsScreen({ onBack }: StatsScreenProps) {
  const { settings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'history'>('overview');
  
  const overallStats = getOverallStats();
  const leaderboard = getLeaderboard();
  const humanStats = overallStats.playerStats[settings.playerNames.human] || {
    totalGames: 0, wins: 0, losses: 0, selfDrawWins: 0, discardWins: 0,
    totalFan: 0, maxFan: 0, winForms: {}, fanTypes: {}
  };

  const handleClearStats = () => {
    if (window.confirm('确定要清除所有统计数据吗？此操作不可撤销。')) {
      clearAllStats();
      window.location.reload();
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f1a2e 50%, #0a101f 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gold/20">
        <button
          onClick={onBack}
          className="text-gold hover:text-gold-light transition-colors"
          style={{ fontSize: '14px' }}
        >
          ← 返回
        </button>
        <h1 className="text-xl font-bold text-gold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          战绩统计
        </h1>
        <button
          onClick={handleClearStats}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          清除数据
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gold/20">
        {[
          { key: 'overview', label: '总览' },
          { key: 'leaderboard', label: '排行榜' },
          { key: 'history', label: '历史记录' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key 
                ? 'text-gold border-b-2 border-gold bg-gold/5' 
                : 'text-ivory-dark/60 hover:text-ivory-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab stats={humanStats} />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab entries={leaderboard} />
        )}
        {activeTab === 'history' && (
          <HistoryTab games={overallStats.recentGames} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ stats }: { stats: PlayerStats }) {
  const winRate = getWinRate(stats);
  const avgFan = getAverageFan(stats);

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="总场次" value={stats.totalGames} suffix="场" />
        <StatCard label="胜率" value={winRate} suffix="%" highlight />
        <StatCard label="胜场" value={stats.wins} suffix="场" />
        <StatCard label="负场" value={stats.losses} suffix="场" />
        <StatCard label="自摸胡" value={stats.selfDrawWins} suffix="次" />
        <StatCard label="放铳胡" value={stats.discardWins} suffix="次" />
        <StatCard label="最大番数" value={stats.maxFan} suffix="番" />
        <StatCard label="平均番数" value={avgFan} suffix="番" />
      </div>

      {/* Win Form Distribution */}
      {Object.keys(stats.winForms).length > 0 && (
        <div className="bg-dark-card rounded-xl p-4 border border-gold/20">
          <h3 className="text-sm font-medium text-gold mb-3">胡牌类型分布</h3>
          <div className="space-y-2">
            {Object.entries(stats.winForms)
              .sort(([, a], [, b]) => b - a)
              .map(([form, count]) => (
                <div key={form} className="flex items-center justify-between">
                  <span className="text-sm text-ivory-dark">{form === 'sevenPairs' ? '七对' : '普通'}</span>
                  <span className="text-sm text-gold">{count}次</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Fan Type Distribution */}
      {Object.keys(stats.fanTypes).length > 0 && (
        <div className="bg-dark-card rounded-xl p-4 border border-gold/20">
          <h3 className="text-sm font-medium text-gold mb-3">番型分布</h3>
          <div className="space-y-2">
            {Object.entries(stats.fanTypes)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-ivory-dark">{type}</span>
                  <span className="text-sm text-gold">{count}次</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix, highlight }: { 
  label: string; 
  value: number; 
  suffix: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-dark-card rounded-xl p-4 border ${highlight ? 'border-gold/40 bg-gold/5' : 'border-gold/20'}`}>
      <div className="text-xs text-ivory-dark/60 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${highlight ? 'text-gold' : 'text-ivory-dark'}`}>
          {value}
        </span>
        <span className="text-xs text-ivory-dark/40">{suffix}</span>
      </div>
    </div>
  );
}

function LeaderboardTab({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-ivory-dark/40">
        暂无记录
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.playerName}
          className={`bg-dark-card rounded-xl p-4 border ${
            index < 3 ? 'border-gold/40' : 'border-gold/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${
                index === 0 ? 'text-yellow-400' : 
                index === 1 ? 'text-gray-300' : 
                index === 2 ? 'text-orange-400' : 'text-ivory-dark/40'
              }`}>
                #{index + 1}
              </span>
              <span className="text-ivory-dark font-medium">{entry.playerName}</span>
            </div>
            <span className="text-gold font-bold">{entry.highScore}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ games }: { games: GameRecord[] }) {
  if (games.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-ivory-dark/40">
        暂无历史记录
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {games.map((game, index) => (
        <div key={index} className="bg-dark-card rounded-xl p-4 border border-gold/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-gold font-medium">{game.winnerName}</span>
              <span className="text-xs text-ivory-dark/40">胡了</span>
            </div>
            <span className="text-xs text-ivory-dark/40">{formatDate(game.timestamp)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-ivory-dark/60">
                {game.winForm === 'sevenPairs' ? '七对' : '普通'}
              </span>
              <span className="text-gold">{game.fanType}</span>
              <span className="text-ivory-dark/40">{game.fanCount}番</span>
            </div>
            <span className="text-xs text-ivory-dark/40">
              {game.isSelfDraw ? '自摸' : '放铳'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-ivory-dark/40">
            {game.playerNames.map((name, i) => (
              <span key={i} className={i === game.winnerIndex ? 'text-gold' : ''}>
                {name}: {game.scores[i]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
