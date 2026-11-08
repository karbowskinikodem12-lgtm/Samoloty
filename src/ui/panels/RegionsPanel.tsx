import { CircleCheck, Compass, Lock, LockOpen } from 'lucide-react';
import { CITIES } from '../../data/cities';
import { REGIONS } from '../../data/regions';
import { checkUnlockRegion, unlockRegion } from '../../engine/actions';
import {
  checkExpedition, COUNTRIES, discoveredPlayable, discoveryRadius, distanceToCountry, expeditionCost, expeditionDays,
  PLAYABLE_COUNTRIES, startExpedition,
} from '../../engine/countries';
import { regionUnlockInfo } from '../../engine/economy';
import { useGame } from '../../game/useGame';
import { Button, Empty, Meter, Section } from '../common';
import { km, money, num, timeLeft } from '../format';

const LIST_LIMIT = 8;

export function RegionsPanel() {
  const c = useGame();
  const s = c.state!;
  const info = regionUnlockInfo(s);
  const discovered = new Set(s.discovered);
  const found = discoveredPlayable(s);
  const total = PLAYABLE_COUNTRIES.length;
  const openLevels = Object.values(s.airports).filter((a) => a.buildEnd === undefined).map((a) => a.level);
  const bestRadius = discoveryRadius(Math.max(1, ...openLevels));

  // Najbliższe nieodkryte kraje w regionach z licencją (tam odkrycie od razu daje nowe kierunki).
  const candidates = PLAYABLE_COUNTRIES.filter((ct) => !discovered.has(ct.id) && ct.region && s.unlockedRegions.includes(ct.region))
    .map((ct) => ({ ct, d: distanceToCountry(s, ct.id) }))
    .sort((a, b) => a.d - b.d);

  return (
    <div className="panel-body">
      <Section title="Odkrywanie krajów" aside={`${found} / ${total}`}>
        <Meter value={found / total} tone="accent" />
        <p className="hint">
          Kraje odkrywają się same w zasięgu Twoich lotnisk (obecnie do {km(bestRadius)} od lotniska najwyższego poziomu). Każde nowe lotnisko i każda rozbudowa
          poszerza zasięg. Dalsze kraje zbadasz misją rozpoznawczą.
        </p>
      </Section>

      {s.expeditions.length > 0 && (
        <Section title="Misje w toku">
          <ul className="list">
            {s.expeditions.map((e) => {
              const ratio = (s.time - e.start) / Math.max(1, e.end - e.start);
              return (
                <li key={e.id} className="plane-row column">
                  <div className="plane-row-top">
                    <span className="plane-name">{COUNTRIES[e.countryId].name}</span>
                    <span className="plane-status">{timeLeft(e.end - s.time)}</span>
                  </div>
                  <Meter value={ratio} tone="accent" thin />
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Najbliższe nieodkryte kraje" aside={candidates.length ? `${candidates.length}` : undefined}>
        {candidates.length === 0 ? (
          <Empty>Wszystkie kraje w Twoich regionach są odkryte. Kup licencję na kolejny region.</Empty>
        ) : (
          <ul className="list">
            {candidates.slice(0, LIST_LIMIT).map(({ ct, d }) => {
              const reason = checkExpedition(s, ct.id);
              const running = s.expeditions.some((e) => e.countryId === ct.id);
              return (
                <li key={ct.id} className="buy-row">
                  <button className="country-main" onClick={() => c.requestFocus(ct.cityIds)} title="Pokaż na mapie">
                    <span className="plane-name">{ct.name}</span>
                    <span className="plane-status">
                      {ct.cityIds.length} {ct.cityIds.length === 1 ? 'miasto' : ct.cityIds.length < 5 ? 'miasta' : 'miast'} · {num(d)} km
                    </span>
                  </button>
                  <Button
                    small
                    icon={Compass}
                    disabled={!!reason}
                    title={reason ?? `Misja potrwa ok. ${expeditionDays(s, ct.id).toLocaleString('pl-PL')} dnia`}
                    onClick={() => c.act((st) => startExpedition(st, ct.id), `Misja rozpoznawcza: ${ct.name}`)}
                  >
                    {running ? 'W toku' : money(expeditionCost(s, ct.id))}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Licencje regionalne">
        <p className="hint">
          Każdy region wymaga licencji. Kolejne licencje są coraz droższe i wymagają wyższego poziomu linii.
          {info ? ` Następna: ${money(info.cost)}, poziom ${info.level}.` : ' Masz wszystkie licencje.'}
        </p>
        <ul className="region-list">
          {REGIONS.map((r) => {
            const cities = CITIES.filter((ct) => ct.region === r.id);
            const owned = cities.filter((ct) => s.airports[ct.id]).length;
            const countries = PLAYABLE_COUNTRIES.filter((ct) => ct.region === r.id);
            const known = countries.filter((ct) => discovered.has(ct.id)).length;
            const unlocked = s.unlockedRegions.includes(r.id);
            const reason = unlocked ? null : checkUnlockRegion(s, r.id);
            return (
              <li key={r.id} className={`region-card${unlocked ? ' unlocked' : ''}`}>
                <button className="region-main" onClick={() => c.requestFocus(cities.map((ct) => ct.id))} title="Pokaż na mapie">
                  <span className="region-icon">{unlocked ? <CircleCheck size={16} /> : <Lock size={16} />}</span>
                  <span>
                    <strong>{r.name}</strong>
                    <span className="dim">
                      kraje {known}/{countries.length}
                      {unlocked ? ` · lotniska ${owned}` : ` · ${cities.length} miast`}
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
