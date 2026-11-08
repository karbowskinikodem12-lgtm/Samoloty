import { ArrowUpRight, Building, Lock, Plus, Route as RouteIcon, X } from 'lucide-react';
import type { CityDef } from '../../engine/types';
import { buildDays, buildProgress, cityTier, maxLevel, potentialPerDay, startLevel, TIER_NAMES } from '../../engine/cities';
import { AIRPORT_LEVELS, airportLevel, MAX_AIRPORT_LEVEL } from '../../data/airportLevels';
import { CITY_BY_ID } from '../../data/cities';
import { REGION_BY_ID } from '../../data/regions';
import { checkOpenAirport, checkUpgradeAirport, freeSlots, openAirport, planesOnRoute, upgradeAirport } from '../../engine/actions';
import { airportOpenCost } from '../../engine/economy';
import { getModifiers } from '../../engine/events';
import { cityDistance } from '../../engine/geo';
import { getNetwork, routesOf } from '../../engine/network';
import { demandPerHour, waitingTotal } from '../../engine/passengers';
import { useGame } from '../../game/useGame';
import { ActionButton, Button, Empty, KV, Meter, Pill, Section } from '../common';
import { clock, dayNumber, hoursLeft, km, money, num, pct, timeLeft } from '../format';

/** Krótka charakterystyka miasta: kategoria, potencjał pasażerów i infrastruktura lotniska. */
function CityFacts({ city, opened }: { city: CityDef; opened: boolean }) {
  const tier = cityTier(city);
  const tourism = city.tourism ?? 1;
  return (
    <>
      <div className="city-tags">
        <Pill>{TIER_NAMES[tier]}</Pill>
        {city.hub && <Pill tone="accent">Port przesiadkowy</Pill>}
        {tourism >= 1.5 && <Pill>Kierunek turystyczny</Pill>}
      </div>
      <div className="grid2">
        <KV label="Populacja" value={`${city.pop.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mln`} />
        <KV label="Potencjał pasażerów" value={`ok. ${num(potentialPerDay(city))} / dzień`} />
        {!opened && <KV label="Lotnisko po otwarciu" value={`poziom ${startLevel(city)}`} />}
        <KV label="Maks. rozbudowa" value={`poziom ${maxLevel(city)}`} />
        {!opened && <KV label="Czas budowy" value={`${buildDays(city).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} dnia`} />}
      </div>
    </>
  );
}

export function CityPanel({ cityId }: { cityId: string }) {
  const c = useGame();
  const s = c.state!;
  const city = CITY_BY_ID[cityId];
  const ap = s.airports[cityId];
  const unlocked = s.unlockedRegions.includes(city.region);
  const region = REGION_BY_ID[city.region];

  const header = (
    <header className="panel-head">
      <div className="code-badge">{city.code}</div>
      <div className="panel-title">
        <h2>{city.name}</h2>
        <div className="panel-sub">
          {city.country} · {region.name}
        </div>
      </div>
      <button className="icon-btn" onClick={() => c.select(null)} title="Zamknij (Esc)">
        <X size={18} />
      </button>
    </header>
  );

  if (!unlocked && !ap) {
    return (
      <div className="panel-body">
        {header}
        <div className="callout">
          <Lock size={16} />
          <div>
            <strong>Region zablokowany</strong>
            <p>Aby otwierać lotniska w regionie {region.name}, kup licencję w zakładce Regiony.</p>
          </div>
        </div>
        <Button onClick={() => c.setTab('regions')} icon={ArrowUpRight} block>
          Przejdź do regionów
        </Button>
      </div>
    );
  }

  if (!ap) {
    const own = Object.keys(s.airports);
    const nearest = own
      .map((id) => ({ id, d: cityDistance(id, cityId) }))
      .sort((a, b) => a.d - b.d)[0];
    return (
      <div className="panel-body">
        {header}
        <Section title="Miasto">
          <CityFacts city={city} opened={false} />
          {nearest && <KV label="Najbliższe Twoje lotnisko" value={`${CITY_BY_ID[nearest.id].name}, ${km(nearest.d)}`} />}
        </Section>
        <ActionButton
          label="Zbuduj lotnisko"
          cost={money(airportOpenCost(cityId))}
          icon={Building}
          reason={checkOpenAirport(s, cityId)}
          onClick={() => {
            const res = c.act((st) => openAirport(st, cityId), `Rozpoczęto budowę: ${city.name}`);
            if (res.ok) c.select({ kind: 'city', id: cityId });
          }}
        />
        <p className="hint">Budowa trwa kilka dni gry. Po otwarciu połącz lotnisko trasą — przeciągnij linię z innego lotniska na mapie.</p>
      </div>
    );
  }

  if (ap.buildEnd !== undefined) {
    const { ratio, left } = buildProgress(s, ap);
    return (
      <div className="panel-body">
        {header}
        <Section title="Budowa lotniska" aside={pct(ratio)}>
          <Meter value={ratio} tone="accent" />
          <div className="grid2">
            <KV label="Pozostało" value={timeLeft(left)} />
            <KV label="Otwarcie" value={`dzień ${dayNumber(ap.buildEnd)}, ${clock(ap.buildEnd)}`} />
          </div>
          <p className="hint">Lotnisko ruszy na poziomie {ap.level}. Przyspiesz czas, jeśli nie chcesz czekać.</p>
        </Section>
        <Section title="Miasto">
          <CityFacts city={city} opened />
        </Section>
      </div>
    );
  }

  const lvl = airportLevel(ap.level);
  const waiting = waitingTotal(s, cityId);
  const routes = routesOf(s, cityId);
  const slotsFree = freeSlots(s, cityId);
  const demand = demandPerHour(s, cityId);
  const mods = getModifiers(s);
  const closed = mods.closed.has(cityId);
  const events = s.events.filter((e) => e.targetId === cityId || e.targetId === city.region);
  const hops = getNetwork(s).nextHop[cityId] ?? {};
  const topWaiting = Object.entries(ap.waiting)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const cityMax = Math.min(MAX_AIRPORT_LEVEL, maxLevel(city));
  const next = ap.level < cityMax ? AIRPORT_LEVELS[ap.level] : null;

  return (
    <div className="panel-body">
      {header}
      <div className="level-row">
        <span className="level-label">Poziom {ap.level}</span>
        <div className="level-pips">
          {AIRPORT_LEVELS.map((l) => (
            <span
              key={l.level}
              className={l.level <= ap.level ? 'pip on' : l.level > cityMax ? 'pip capped' : 'pip'}
              title={l.level > cityMax ? 'Poziom niedostępny w tym mieście' : undefined}
            />
          ))}
        </div>
        {cityId === s.startCity && <Pill tone="warn">Baza</Pill>}
        {closed && <Pill tone="bad">Zamknięte</Pill>}
      </div>

      <Section title="Terminal" aside={`${num(waiting)} / ${num(lvl.capacity)}`}>
        <Meter value={waiting / lvl.capacity} />
        <div className="grid2">
          <KV label="Popyt" value={demand > 0 ? `${num(demand)} pas./h` : 'brak tras'} tone={demand > 0 ? undefined : 'dim'} />
          <KV label="Sloty tras" value={`${routes.length} / ${lvl.slots}`} tone={slotsFree <= 0 ? 'warn' : undefined} />
          <KV label="Odprawieni wczoraj" value={num(ap.yesterday.departed)} />
          <KV label="Rezygnacje wczoraj" value={num(ap.yesterday.lost)} tone={ap.yesterday.lost > 0 ? 'bad' : 'dim'} />
        </div>
        {waiting / lvl.capacity > 0.8 && (
          <p className="hint tone-bad">Terminal jest prawie pełny — dodaj samoloty na trasach albo rozbuduj lotnisko.</p>
        )}
      </Section>

      {topWaiting.length > 0 && (
        <Section title="Czekający pasażerowie">
          <ul className="list compact">
            {topWaiting.map(([dest, n]) => (
              <li key={dest} className="list-row">
                <span>
                  {CITY_BY_ID[dest].name}
                  {hops[dest] && hops[dest] !== dest && <span className="dim"> przez {CITY_BY_ID[hops[dest]].code}</span>}
                </span>
                <span className="num">{num(n)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Trasy" aside={slotsFree > 0 ? `${slotsFree} wolne` : 'brak slotów'}>
        {routes.length === 0 ? (
          <Empty>Brak tras. Przeciągnij linię z tego lotniska do innego na mapie.</Empty>
        ) : (
          <ul className="list">
            {routes.map((r) => {
              const other = r.a === cityId ? r.b : r.a;
              const n = planesOnRoute(s, r.id).length;
              return (
                <li key={r.id}>
                  <button className="list-row clickable" onClick={() => c.select({ kind: 'route', id: r.id })}>
                    <span>
                      <RouteIcon size={14} className="dim" /> {CITY_BY_ID[other].name}
                    </span>
                    <span className="dim">{km(r.distance)}</span>
                    <span className={n === 0 ? 'tone-warn' : 'num'}>{n === 0 ? 'bez samolotu' : `${n} szt.`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          icon={Plus}
          block
          disabled={slotsFree <= 0 || Object.keys(s.airports).length < 2}
          onClick={() => c.beginRoute(cityId)}
          title={slotsFree <= 0 ? 'Brak wolnych slotów' : 'Kliknij lotnisko docelowe na mapie'}
        >
          {c.routeFrom === cityId ? 'Wskaż lotnisko docelowe na mapie…' : 'Nowa trasa'}
        </Button>
      </Section>

      <Section title="Rozbudowa">
        {next ? (
          <>
            <div className="upgrade-diff">
              <KV label="Sloty tras" value={`${lvl.slots} → ${next.slots}`} />
              <KV label="Pojemność terminalu" value={`${lvl.capacity} → ${next.capacity}`} />
              <KV label="Popyt" value={`${pct(lvl.demand)} → ${pct(next.demand)}`} />
              <KV label="Obsługa samolotu" value={`${lvl.turnaround} → ${next.turnaround} min`} />
              <KV label="Utrzymanie dzienne" value={`${money(lvl.upkeep)} → ${money(next.upkeep)}`} tone="dim" />
            </div>
            <ActionButton
              label={`Rozbuduj do poziomu ${next.level}`}
              cost={money(next.upgradeCost)}
              icon={ArrowUpRight}
              reason={checkUpgradeAirport(s, cityId)}
              onClick={() => c.act((st) => upgradeAirport(st, cityId), `${city.name}: poziom ${next.level}`)}
            />
          </>
        ) : (
          <Empty>
            {cityMax < MAX_AIRPORT_LEVEL
              ? `To najwyższy poziom dla tego miasta (${TIER_NAMES[cityTier(city)].toLowerCase()}).`
              : 'Lotnisko osiągnęło maksymalny poziom.'}
          </Empty>
        )}
      </Section>

      {events.length > 0 && (
        <Section title="Wydarzenia">
          {events.map((e) => (
            <div key={e.uid} className={`event-card tone-${e.tone}`}>
              <strong>{e.title}</strong>
              <span className="dim">jeszcze {hoursLeft(e.end - s.time)}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Miasto">
        <CityFacts city={city} opened />
      </Section>
    </div>
  );
}
