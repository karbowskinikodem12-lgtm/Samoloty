import { Globe, LayoutDashboard, Plane, Waypoints } from 'lucide-react';
import type { SideTab } from '../game/controller';
import { useGame } from '../game/useGame';
import { CityPanel } from './panels/CityPanel';
import { FleetPanel } from './panels/FleetPanel';
import { OverviewPanel } from './panels/OverviewPanel';
import { RegionsPanel } from './panels/RegionsPanel';
import { RoutePanel } from './panels/RoutePanel';
import { RoutesPanel } from './panels/RoutesPanel';

const TABS: { id: SideTab; label: string; icon: typeof Globe }[] = [
  { id: 'overview', label: 'Przegląd', icon: LayoutDashboard },
  { id: 'routes', label: 'Trasy', icon: Waypoints },
  { id: 'fleet', label: 'Flota', icon: Plane },
  { id: 'regions', label: 'Świat', icon: Globe },
];

export function SidePanel() {
  const c = useGame();
  const s = c.state!;
  const sel = c.selection;
  const idle = Object.values(s.planes).filter((p) => !p.routeId).length;

  let content;
  if (sel?.kind === 'city') content = <CityPanel cityId={sel.id} />;
  else if (sel?.kind === 'route' && s.routes[sel.id]) content = <RoutePanel routeId={sel.id} />;
  else if (c.tab === 'routes') content = <RoutesPanel />;
  else if (c.tab === 'fleet') content = <FleetPanel />;
  else if (c.tab === 'regions') content = <RegionsPanel />;
  else content = <OverviewPanel />;

  const activeTab = sel ? null : c.tab;

  return (
    <aside className="side">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${activeTab === t.id ? ' active' : ''}`} onClick={() => c.setTab(t.id)}>
            <t.icon size={16} />
            <span>{t.label}</span>
            {t.id === 'fleet' && idle > 0 && <span className="tab-badge">{idle}</span>}
          </button>
        ))}
      </nav>
      <div className="side-scroll">{content}</div>
    </aside>
  );
}
