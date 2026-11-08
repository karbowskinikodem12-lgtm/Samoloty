import { ArrowRight, MapPin, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CITIES, CITY_BY_ID, START_CITIES } from '../data/cities';
import { REGION_BY_ID } from '../data/regions';
import { cityDistance } from '../engine/geo';
import { clearSave, loadGame } from '../engine/save';
import { newGame } from '../engine/setup';
import { useGame } from '../game/useGame';
import { Button } from './common';
import { dayNumber, money } from './format';
import { Logo } from './TopBar';

export function StartScreen() {
  const c = useGame();
  const saved = useMemo(() => loadGame(), []);
  const [city, setCity] = useState('warsaw');
  const [name, setName] = useState('Contrail');

  const begin = () => {
    clearSave();
    c.start(newGame(city, Math.floor(Math.random() * 2_000_000_000), name.trim() || 'Contrail'));
  };

  return (
    <div className="start">
      <div className="start-card">
        <div className="start-brand">
          <Logo size={34} />
          <div>
            <h1>Contrail</h1>
            <p>Zbuduj własną sieć połączeń lotniczych</p>
          </div>
        </div>

        {saved && (
          <div className="continue">
            <div>
              <strong>{saved.airlineName}</strong>
              <span className="dim">
                Dzień {dayNumber(saved.time)} · {CITY_BY_ID[saved.startCity].name} · {money(saved.money)} · poziom {saved.level}
              </span>
            </div>
            <Button variant="primary" icon={Play} onClick={() => c.start(saved)}>
              Kontynuuj
            </Button>
          </div>
        )}

        <label className="field">
          <span>Nazwa linii</span>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="field">
          <span>Lotnisko bazowe</span>
          <div className="city-grid">
            {START_CITIES.map((id) => {
              const ct = CITY_BY_ID[id];
              const nearby = CITIES.filter((o) => o.id !== id && o.region === ct.region && cityDistance(id, o.id) < 1800).length;
              return (
                <button key={id} className={`city-card${city === id ? ' active' : ''}`} onClick={() => setCity(id)}>
                  <span className="city-code">{ct.code}</span>
                  <span className="city-name">{ct.name}</span>
                  <span className="dim">
                    {REGION_BY_ID[ct.region].name} · {nearby} miast w zasięgu
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Button variant="primary" icon={ArrowRight} block onClick={begin}>
          {saved ? 'Rozpocznij nową grę' : 'Rozpocznij'}
        </Button>
        <p className="start-note">
          <MapPin size={12} /> Startujesz z jednym lotniskiem, jednym samolotem i budżetem 800 tys. $ — postęp zapisuje się automatycznie.
        </p>
      </div>
    </div>
  );
}
