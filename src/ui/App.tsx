import { useEffect, useRef } from 'react';
import { useGame } from '../game/useGame';
import { MapRenderer } from '../render/MapRenderer';
import { GameOverModal, HelpModal, MenuModal } from './Modals';
import { Legend, Toasts, TutorialHint, ZoomControls } from './Overlays';
import { SidePanel } from './SidePanel';
import { StartScreen } from './StartScreen';
import { TopBar } from './TopBar';

export function App() {
  const c = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);

  // Mapa żyje przez cały czas działania aplikacji (także jako tło menu).
  useEffect(() => {
    const r = new MapRenderer(canvasRef.current!, c);
    rendererRef.current = r;
    return () => r.dispose();
  }, [c]);

  // Skróty klawiaturowe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!c.state || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        c.togglePause();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        c.setSpeed(Number(e.key));
      } else if (e.key === 'Escape') {
        if (c.helpOpen) c.setHelp(false);
        else if (c.menuOpen) c.setMenu(false);
        else if (c.routeFrom) c.cancelRoute();
        else c.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c]);

  const playing = !!c.state;

  return (
    <div className={`app${playing ? ' playing' : ''}`}>
      <canvas ref={canvasRef} className="map" />
      {!playing && <StartScreen />}
      {playing && (
        <>
          <TopBar />
          <SidePanel />
          <div className="map-overlay">
            <TutorialHint />
            {c.routeFrom && (
              <div className="mode-banner">
                Wskaż lotnisko docelowe <kbd>Esc</kbd> anuluje
              </div>
            )}
            {c.paused && !c.state!.gameOver && !c.helpOpen && !c.menuOpen && <div className="paused-badge">Pauza</div>}
          </div>
          <Toasts />
          <ZoomControls onZoom={(f) => rendererRef.current?.zoomBy(f)} />
          <Legend />
          <HelpModal />
          <MenuModal />
          <GameOverModal />
        </>
      )}
    </div>
  );
}
