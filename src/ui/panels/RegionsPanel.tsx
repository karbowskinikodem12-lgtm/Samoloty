import { CircleCheck, Lock, LockOpen } from 'lucide-react';
import { CITIES } from '../../data/cities';
import { REGIONS } from '../../data/regions';
import { checkUnlockRegion, unlockRegion } from '../../engine/actions';
import { regionUnlockInfo } from '../../engine/economy';
import { useGame } from '../../game/useGame';
import { Button, Section } from '../common';
import { money } from '../format';

export function RegionsPanel() {
  const c = useGame();
  const s = c.state!;
  const info = regionUnlockInfo(s);

  return (
    <div className="panel-body">
      <Section title="Licencje regionalne">
        <p className="hint">
          Każdy region wymaga licencji. Kolejne licencje są coraz droższe i wymagają wyższego poziomu linii.
          {info ? ` Następna: ${money(info.cost)}, poziom ${info.level}.` : ' Masz wszystkie licencje.'}
        </p>
        <ul className="region-list">
          {REGIONS.map((r) => {
            const cities = CITIES.filter((ct) => ct.region === r.id);
            const owned = cities.filter((ct) => s.airports[ct.id]).length;
            const unlocked = s.unlockedRegions.includes(r.id);
            const reason = unlocked ? null : checkUnlockRegion(s, r.id);
            return (
              <li key={r.id} className={`region-card${unlocked ? ' unlocked' : ''}`}>
                <button className="region-main" onClick={() => c.requestFocus(cities.map((ct) => ct.id))} title="Pokaż na mapie">
                  <span className="region-icon">{unlocked ? <CircleCheck size={16} /> : <Lock size={16} />}</span>
                  <span>
                    <strong>{r.name}</strong>
                    <span className="dim">
                      {cities.length} miast{unlocked ? ` · lotniska: ${owned}` : ''}
                    </span>
                  </span>
                </button>
                {!unlocked && info && (
                  <div className="region-action">
                    <Button small variant="primary" icon={LockOpen} disabled={!!reason} onClick={() => c.act((st) => unlockRegion(st, r.id))}>
                      {money(info.cost)}
                    </Button>
                    {reason && <span className="action-reason">{reason}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
