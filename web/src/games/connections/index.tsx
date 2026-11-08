import {
  CONNECTIONS_ID,
  GROUPS,
  connectionsShare,
  connectionsSummary,
} from '../../../../shared/games/connections';
import type { ConnectionsRevealedGroup } from '../../../../shared/types';
import { DailyGameFrame } from '../DailyGameFrame';
import { ConnectionsPlay, GroupBar, type ConnectionsPayload } from './ConnectionsPlay';
import './connections.css';

interface Stored {
  grid: number[][];
  groups: ConnectionsRevealedGroup[];
}

export default function ConnectionsGame() {
  return (
    <DailyGameFrame<ConnectionsPayload>
      gameId={CONNECTIONS_ID}
      title="Connections"
      play={(props) => <ConnectionsPlay {...props} />}
      summarize={(result) => {
        const { grid, groups } = result.payload as Stored;
        const { groups: solved, mistakes } = connectionsSummary(result.score);
        return {
          headline: `${solved} / ${GROUPS}`,
          detail: `${mistakes} ${mistakes === 1 ? 'Mistake' : 'Mistakes'}`,
          body: (
            <div className="cx cx-result" role="list" aria-label="Groups">
              {groups.map((g) => (
                <GroupBar key={g.level} group={g} />
              ))}
            </div>
          ),
          share: connectionsShare(result.date, result.score, grid),
        };
      }}
    />
  );
}
