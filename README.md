# Contrail — gra o zarządzaniu linią lotniczą

Przeglądarkowa gra strategiczna (desktop). Zaczynasz z jednym lotniskiem, jednym samolotem i niewielkim budżetem, a potem rozbudowujesz sieć połączeń: budujesz kolejne lotniska, rysujesz trasy, kupujesz samoloty, rozbudowujesz terminale i odblokowujesz nowe regiony świata. Na mapie jest 281 miast — od lokalnych lotnisk po największe metropolie i porty przesiadkowe — a zegar gry wyznacza płynny cykl dnia i nocy.

## Uruchomienie

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # wersja produkcyjna w dist/ (podgląd: npm run preview)
npm run build:single  # cała gra w jednym pliku dist-single/index.html (otwierany dwuklikiem)
npm test           # testy silnika (vitest)
npm run balance    # raport balansu: bot gra 40 dni z każdego miasta startowego → balance-report.txt
```

Gra działa w całości lokalnie, bez serwera. Postęp zapisuje się automatycznie w `localStorage`.

## Jak grać

1. **Zbuduj drugie lotnisko** — kliknij miasto z pustym kółkiem i wybierz „Zbuduj lotnisko”. Budowa trwa kilka dni gry; postęp i czas do otwarcia widać na mapie i w panelu miasta.
2. **Narysuj trasę** — przytrzymaj lotnisko i przeciągnij linię do innego lotniska (albo użyj przycisku „Nowa trasa”).
3. **Przypisz samolot** — kliknij trasę i przypisz maszynę z hangaru lub kup nową.
4. Samoloty kursują same tam i z powrotem. Każde lotnisko z obsługiwanymi trasami generuje pasażerów do wszystkich osiągalnych miast. Pasażerowie przesiadają się w węzłach, więc dobrze połączone lotniska stają się hubami.
5. **Pilnuj terminali** — pierścień wokół lotniska pokazuje zapełnienie. Przepełniony terminal oznacza rezygnacje i spadek reputacji (a reputacja wpływa na popyt).
6. **Rozwijaj się** — rozbudowa lotniska daje więcej slotów na trasy, większy terminal i popyt. Poziom linii (za przewiezionych pasażerów) odblokowuje większe samoloty i licencje regionalne.

Sterowanie: `Spacja` — pauza, `1` `2` `3` — prędkość, `Esc` — anuluj/zamknij, kółko myszy — zoom, przeciąganie tła — przesuwanie mapy, prawy przycisk — anuluj rysowanie trasy.

### Zasady w skrócie

| Element | Działanie |
| --- | --- |
| Bilet | `80 $ + 0,20 $/km` za każdy odcinek (przesiadkowicz płaci za każdy lot) |
| Koszt lotu | stały koszt startu + koszt za km, niezależnie od obłożenia |
| Koszty stałe | dzienne utrzymanie samolotów i lotnisk (pobierane o północy) |
| Popyt | √populacji × poziom lotniska × reputacja × efekt sieci × wzrost rynku × wydarzenia |
| Reputacja | dąży do wartości wynikającej z odsetka obsłużonych vs. rezygnujących pasażerów |
| Bankructwo | 3 dni z rzędu z ujemnym saldem |
| Budowa lotniska | ok. 1,5–3,5 dnia gry, dłużej w większych miastach |

### Wydarzenia

76 typów wydarzeń w 6 kategoriach (gospodarka, inwestorzy, konkurencja, wydarzenia lokalne, sytuacja międzynarodowa, infrastruktura i pogoda), łącznie 208 wariantów tekstu. Cel (miasto lub region z Twojej sieci), wariant i wartości są losowane przy każdym wystąpieniu, a kwoty skalują się do średniego dziennego przychodu linii — oferta inwestora dla małej linii to setki tysięcy, dla dużej miliony.

| Ważność | Jak się pojawia | Przykłady |
| --- | --- | --- |
| Drobne (42) | powiadomienie w rogu, skutki od razu | festiwal, burza, tańsze paliwo, wojna cenowa |
| Ważne (29) | panel na środku ekranu, czas zatrzymany | oferta inwestora, kredyt, nowa linia konkurencji, igrzyska, modernizacja terminalu |
| Krytyczne (5) | panel na środku z czerwonym oznaczeniem | światowa recesja, konflikt zbrojny, embargo naftowe, erupcja wulkanu, wrogie przejęcie |

29 wydarzeń wymaga decyzji — każda opcja ma inne, policzone konsekwencje widoczne przed wyborem (klawisze 1–3). Skutki mogą być natychmiastowe (gotówka, reputacja, kredyt z ratami, umorzenie długu, darmowy samolot, rozbudowa lotniska) albo czasowe (popyt w mieście/regionie/świecie, ceny biletów, koszty paliwa, koszty utrzymania, udział inwestora w przychodach, czas obsługi samolotów, zamknięcie lotniska lub całego regionu). Ważne wydarzenia pojawiają się najwyżej co 2–3,5 dnia gry, żeby nie przerywać rozgrywki zbyt często.

Kod: katalog `src/data/events.ts`, silnik `src/engine/events.ts`, agregacja modyfikatorów `src/engine/modifiers.ts`, panel `src/ui/EventModal.tsx`.

### Miasta

Każde miasto ma kategorię wyliczaną z populacji (`engine/cities.ts`), która decyduje o jego roli:

| Kategoria | Populacja | Lotnisko na start | Maks. poziom |
| --- | --- | --- | --- |
| Lotnisko lokalne | < 1 mln | 1 | 2 |
| Ośrodek regionalny | 1–4 mln | 1 | 3 |
| Duże miasto | 4–12 mln | 2 | 4 |
| Metropolia | > 12 mln | 2 | 5 |

Porty przesiadkowe (`hub`, np. Dubaj, Frankfurt, Singapur) startują o poziom wyżej i można je rozbudować do 5. Kierunki turystyczne (`tourism`, np. Malediwy, Phuket, Queenstown) przyciągają więcej pasażerów, niż wynika z populacji. Panel miasta pokazuje kategorię, potencjał pasażerów na dobę, poziom infrastruktury, limit rozbudowy i czas budowy — duże miasta dają więcej pasażerów, ale są droższe i dłużej się je buduje.

### Dzień i noc

Pora dnia w grze zmienia wygląd mapy i całego interfejsu. Zmierzch trwa od 16:30 do 21:30, świt od 3:30 do 7:30 czasu gry. Przez pierwszą połowę wieczoru jasny motyw powoli przygasa (tekst pozostaje ciemny i czytelny), potem w ok. 1,2 s czasu rzeczywistego zamienia się w ciemny, który dalej stopniowo się pogłębia — dzięki temu nie ma momentu, w którym tło i tekst zlewają się w jedną szarość. Nocą lotniska delikatnie świecą. W menu można wybrać tryb „Pora dnia” (domyślny), stały jasny albo stały ciemny. Palety: `src/render/theme.ts` (mapa) i `src/theme/cssPalette.ts` (interfejs), mieszanie: `src/theme/dayNight.ts`.

## Stack

- **Vite + React 19 + TypeScript** — UI paneli,
- **Canvas 2D** — mapa, trasy po ortodromach i animowane samoloty (60 fps, bez re-renderów Reacta),
- **d3-geo + topojson-client + world-atlas** — rzut Natural Earth i kontury lądów,
- **lucide-react** — ikony (w grze nie ma emoji), **Inter** — krój pisma.

### Wygląd

Jasna, stonowana mapa z delikatnymi granicami państw jest głównym ekranem. Interfejs to pływające, zaokrąglone panele z subtelnymi cieniami: górny pasek (środki, samoloty, obsługiwane miasta, pasażerowie, poziom, reputacja, czas) i panel boczny (zakup samolotów, trasy, zarządzanie lotniskami, regiony). Paleta jest celowo ograniczona: atrament dla elementów gracza, jeden niebieski akcent dla zaznaczeń i kolory statusu tylko tam, gdzie niosą informację (zapełnienie terminali, zysk/strata). Tokeny kolorów: `src/styles/tokens.css` (HTML) i `src/render/theme.ts` (mapa).

## Architektura

```
src/
  data/          statyczne definicje — tu dodaje się treść gry
    cities.ts        miasta (współrzędne, populacja, region, kod lotniska), miasta startowe
    regions.ts       regiony świata
    aircraft.ts      typy samolotów (miejsca, zasięg, prędkość, koszty, wymagania)
    airportLevels.ts poziomy rozbudowy lotnisk
    events.ts        wydarzenia losowe (deklaratywne efekty)
    goals.ts         cele / kamienie milowe z nagrodami
  engine/        czysta logika gry — bez Reacta i DOM-u, w pełni testowalna w Node
    types.ts         model danych; cały GameState to zwykły JSON (zapis/odczyt)
    config.ts        wszystkie pokrętła balansu w jednym miejscu
    simulation.ts    pętla: pasażerowie → samoloty → reputacja → wydarzenia → koniec dnia → cele
    passengers.ts    generowanie popytu, terminale, rezygnacje, reputacja
    flights.ts       obsługa naziemna, wsiadanie, loty, przyloty, przychody
    network.ts       graf obsługiwanych tras i najkrótsze ścieżki (kara za przesiadkę)
    actions.ts       akcje gracza: check*() zwraca powód blokady dla UI, akcja mutuje stan
    economy.ts       ceny, koszty, poziomy linii
    events.ts        losowanie wydarzeń i agregacja ich modyfikatorów
    progression.ts   cele i awanse
    setup.ts / save.ts / rng.ts (deterministyczny generator zapisany w stanie)
  game/          kontroler: pętla requestAnimationFrame, prędkość, zaznaczenie, powiadomienia
  render/        renderer mapy na canvasie (kamera, wejście myszy, rysowanie tras i samolotów)
  ui/            panele React (przegląd, trasy, flota, regiony, miasto, trasa), modale, ekran startowy
tests/           testy silnika, bot do testów balansu
```

Zasada: **silnik nie wie nic o UI**. Kontroler wywołuje `advance(state, minuty)` w każdej klatce, renderer czyta stan i rysuje mapę, a panele Reacta odświeżają się kilka razy na sekundę. Akcje gracza przechodzą przez `controller.act()`, które pokazuje komunikat, gdy akcja jest niedozwolona.

## Jak rozwijać

- **Nowe miasto** — dopisz wpis w `src/data/cities.ts` (opcjonalnie `hub: true` albo `tourism: 2`). Kategoria, infrastruktura, czas budowy, popyt, koszty i odległości liczą się automatycznie.
- **Nowy region** — wpis w `src/data/regions.ts` + miasta z tym `region`. Ewentualnie dodaj kolejny próg w `CONFIG.REGION_UNLOCK`.
- **Nowy samolot** — wpis w `src/data/aircraft.ts` (pojawi się w katalogu, panelach tras i zakupach).
- **Nowe wydarzenie** — obiekt w `src/data/events.ts`: kategoria, ważność, cel (`city` / `region` / `global`), warianty tekstu oraz `effects` albo `choices` (każda opcja z własnymi `effects`). Wartości można podać jako przedział `[min, max]`, a kwoty jako `scaled(min, max)` — wielokrotność dziennego przychodu.
- **Nowy rodzaj skutku** — pole w `EffectSpec` (`engine/types.ts`), obsługa w `resolveEffects` / `describeEffects` / `applyEffects` (`engine/events.ts`), a dla skutków czasowych agregacja w `engine/modifiers.ts`.
- **Nowy cel** — wpis w `src/data/goals.ts` z funkcją `progress(state)`.
- **Nowa mechanika** — pole w `GameState`, krok w `simulation.ts`, akcja w `actions.ts` (para `checkX` / `x`), panel w `ui/panels`. Po zmianie formatu zapisu podbij `SAVE_VERSION` w `engine/setup.ts`.
- **Balans** — `engine/config.ts`, potem `npm run balance` i lektura `balance-report.txt`.

W trybie deweloperskim kontroler i renderer są dostępne w konsoli przeglądarki jako `window.contrail` i `window.contrailMap`.

Pomysły na kolejne wersje: klasy biletów i własne ceny, konkurencyjne linie AI, sezonowość popytu, serwis i starzenie się floty, sojusze lotnicze, wydarzenia z decyzjami gracza.
