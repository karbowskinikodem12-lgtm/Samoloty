import { airportLevel } from './airportLevels';
import { CITY_BY_ID } from './cities';
import { maxLevelFor } from '../engine/cities';
import { randRange } from '../engine/rng';
import type { Amount, EventDef, EventVariant, GameState } from '../engine/types';

/**
 * Katalog wydarzeń losowych.
 *
 * Każde wydarzenie ma kategorię, poziom ważności (minor = powiadomienie w rogu, major/critical = panel
 * na środku ekranu z pauzą), cel (miasto / region / świat), kilka wariantów tekstu oraz skutki albo
 * decyzje. Wartości w nawiasach [min, max] są losowane przy każdym wystąpieniu, a kwoty `scaled(...)`
 * rosną razem z linią (wielokrotność średniego dziennego przychodu).
 *
 * Nowe wydarzenie = nowy obiekt na liście. Nowy rodzaj skutku: EffectSpec w engine/types.ts,
 * obsługa w engine/events.ts (resolve, describe, apply) i ewentualnie w engine/modifiers.ts.
 */

const v = (title: string, text: string): EventVariant => ({ title, text });

/** Kwota jako wielokrotność skali gospodarki gracza (losowana z przedziału). */
const scaled = (min: number, max = min): Amount => (s, ctx) => ctx.scale * randRange(s, min, max);
const negScaled = (min: number, max = min): Amount => (s, ctx) => -ctx.scale * randRange(s, min, max);

// Warunki pomocnicze
const openCount = (s: GameState) => Object.values(s.airports).filter((a) => a.buildEnd === undefined).length;
const day = (n: number) => (s: GameState) => s.time >= n * 1440;
const level = (n: number) => (s: GameState) => s.level >= n;
const planes = (n: number) => (s: GameState) => Object.keys(s.planes).length >= n;
const airports = (n: number) => (s: GameState) => openCount(s) >= n;
const all =
  (...fs: ((s: GameState) => boolean)[]) =>
  (s: GameState) =>
    fs.every((f) => f(s));
const bigCity = (min: number) => (_s: GameState, id: string) => CITY_BY_ID[id].pop >= min;
const upgradeable = (s: GameState, id: string) => {
  const ap = s.airports[id];
  return !!ap && ap.level < maxLevelFor(s, id);
};
const upgradeCost = (share: number): Amount => (s, ctx) => {
  const ap = ctx.targetId ? s.airports[ctx.targetId] : undefined;
  return -(ap ? airportLevel(ap.level + 1).upgradeCost : 200_000) * share;
};

export const EVENTS: EventDef[] = [
  // =====================================================================
  // GOSPODARKA
  // =====================================================================
  {
    id: 'eco_region_crisis', category: 'economy', severity: 'major', tone: 'bad', weight: 5, target: 'region', cooldownH: 240,
    condition: all(level(3), day(4)),
    variants: [
      v('Kryzys gospodarczy: {region}', 'Banki w regionie {region} ograniczają kredyty, firmy tną budżety podróży. Analitycy przewidują kilka trudnych dni dla przewoźników.'),
      v('Recesja w regionie {region}', 'Spadek produkcji i rosnące bezrobocie sprawiają, że mieszkańcy regionu {region} rezygnują z podróży.'),
      v('Załamanie rynku w regionie {region}', 'Giełdy w regionie {region} tracą kilkanaście procent w tydzień. Rezerwacje lotów gwałtownie spadają.'),
    ],
    choices: [
      { label: 'Obniż ceny biletów', description: 'Utrzymasz większość pasażerów kosztem marży.', effects: { hours: [96, 120], demand: 0.9, fare: 0.85 } },
      { label: 'Przeczekaj kryzys', description: 'Bez kosztów, ale część klientów zrezygnuje z lotów.', effects: { hours: [96, 120], demand: [0.68, 0.75] } },
      { label: 'Kampania marketingowa', description: 'Kosztowna, ale skutecznie podtrzyma popyt.', effects: { hours: [96, 120], demand: 0.95, cash: negScaled(0.8, 1.1) } },
    ],
  },
  {
    id: 'eco_global_recession', category: 'economy', severity: 'critical', tone: 'bad', weight: 2, target: 'global', cooldownH: 480,
    condition: all(level(5), day(8)),
    variants: [
      v('Światowa recesja', 'Największe gospodarki świata jednocześnie wchodzą w recesję. Ruch lotniczy spada na wszystkich kontynentach.'),
      v('Globalny krach finansowy', 'Upadek dużego banku inwestycyjnego wywołał panikę na rynkach. Przewoźnicy przygotowują plany oszczędnościowe.'),
    ],
    choices: [
      { label: 'Program oszczędności', description: 'Niższe koszty stałe, ale pasażerowie odczują gorszą obsługę.', effects: { hours: [120, 168], demand: 0.75, upkeep: 0.82, reputation: -4 } },
      { label: 'Utrzymaj jakość usług', description: 'Pełne koszty, ale reputacja rośnie, gdy inni tną usługi.', effects: { hours: [120, 168], demand: 0.8, reputation: 5 } },
      { label: 'Kredyt ratunkowy', description: 'Zastrzyk gotówki na przetrwanie trudnego okresu.', effects: { hours: [120, 168], demand: 0.78, loan: { amount: scaled(4, 5), days: 20, rate: 0.18 } } },
    ],
  },
  {
    id: 'eco_inflation', category: 'economy', severity: 'minor', tone: 'bad', weight: 7, target: 'global', cooldownH: 96,
    variants: [
      v('Rosnąca inflacja', 'Ceny usług technicznych, ubezpieczeń i opłat lotniskowych idą w górę.'),
      v('Drożeją usługi lotniskowe', 'Operatorzy lotnisk podnoszą stawki za obsługę naziemną i postój.'),
      v('Wyższe koszty serwisu', 'Dostawcy części zamiennych podnieśli ceny w związku z inflacją.'),
      v('Podwyżki płac w branży', 'Związki zawodowe wywalczyły podwyżki dla personelu naziemnego.'),
    ],
    effects: { hours: [120, 168], upkeep: [1.1, 1.22] },
  },
  {
    id: 'eco_high_inflation', category: 'economy', severity: 'major', tone: 'bad', weight: 3, target: 'global', cooldownH: 240,
    condition: all(level(3), day(5)),
    variants: [
      v('Inflacja wymyka się spod kontroli', 'Banki centralne nie nadążają z podwyżkami stóp. Koszty działalności rosną z tygodnia na tydzień.'),
      v('Fala podwyżek', 'Niemal wszyscy dostawcy jednocześnie ogłosili podwyżki cen. Trzeba zdecydować, kto za to zapłaci.'),
    ],
    choices: [
      { label: 'Podnieś ceny biletów', description: 'Przerzucasz koszty na pasażerów — część zrezygnuje.', effects: { hours: [144, 192], upkeep: 1.3, fare: 1.1, demand: 0.9 } },
      { label: 'Pokryj koszty samodzielnie', description: 'Pasażerowie zostają, ale marże spadają.', effects: { hours: [144, 192], upkeep: 1.32, reputation: 2 } },
      { label: 'Renegocjuj kontrakty', description: 'Jednorazowy koszt prawników, ale mniejsze podwyżki.', effects: { hours: [144, 192], upkeep: 1.12, cash: negScaled(0.6, 0.9) } },
    ],
  },
  {
    id: 'eco_fuel_up', category: 'economy', severity: 'minor', tone: 'bad', weight: 8, target: 'global', cooldownH: 72,
    variants: [
      v('Wzrost cen paliwa', 'Ceny paliwa lotniczego skoczyły. Każdy lot kosztuje więcej.'),
      v('Decyzja kartelu naftowego', 'Producenci ropy ograniczyli wydobycie. Paliwo lotnicze drożeje.'),
      v('Awaria dużej rafinerii', 'Pożar w jednej z największych rafinerii zmniejszył podaż paliwa lotniczego.'),
      v('Mroźna zima podbija ceny', 'Wysoki popyt na paliwa grzewcze przekłada się na ceny paliwa lotniczego.'),
      v('Spekulacje na rynku ropy', 'Fundusze inwestycyjne windują ceny ropy. Przewoźnicy płacą więcej.'),
    ],
    effects: { hours: [48, 96], fuel: [1.18, 1.4] },
  },
  {
    id: 'eco_fuel_spike', category: 'economy', severity: 'major', tone: 'bad', weight: 3, target: 'global', cooldownH: 240,
    condition: all(day(4), planes(3)),
    variants: [
      v('Szok naftowy', 'Ceny ropy wzrosły o połowę w ciągu kilku dni. Linie lotnicze szukają sposobu na ograniczenie strat.'),
      v('Paliwo lotnicze rekordowo drogie', 'Notowania paliwa lotniczego osiągnęły najwyższy poziom od lat.'),
    ],
    choices: [
      { label: 'Kup kontrakt zabezpieczający', description: 'Płacisz teraz, ale zamrażasz cenę paliwa.', effects: { hours: [72, 96], fuel: 1.08, cash: negScaled(0.6, 0.8) } },
      { label: 'Lataj normalnie', description: 'Bez kosztów z góry — pełne ceny paliwa.', effects: { hours: [72, 96], fuel: [1.55, 1.7] } },
      { label: 'Ogranicz częstotliwość lotów', description: 'Dłuższa obsługa naziemna, mniej lotów, niższe koszty.', effects: { hours: [72, 96], fuel: 1.3, turnaround: 1.35 } },
    ],
  },
  {
    id: 'eco_fuel_down', category: 'economy', severity: 'minor', tone: 'good', weight: 8, target: 'global', cooldownH: 72,
    variants: [
      v('Tanie paliwo', 'Ceny ropy spadają — koszty operacyjne lotów są niższe.'),
      v('Nadpodaż ropy na rynku', 'Producenci zwiększyli wydobycie. Paliwo lotnicze tanieje.'),
      v('Nowa rafineria rusza z produkcją', 'Większa podaż paliwa obniża ceny w całej branży.'),
      v('Korzystny kurs walut', 'Mocna waluta sprawia, że paliwo kupowane w dolarach jest tańsze.'),
    ],
    effects: { hours: [48, 96], fuel: [0.72, 0.86] },
  },
  {
    id: 'eco_region_growth', category: 'economy', severity: 'minor', tone: 'good', weight: 7, target: 'region', cooldownH: 96,
    variants: [
      v('Wzrost gospodarczy: {region}', 'Gospodarka regionu {region} rośnie szybciej od prognoz. Firmy częściej wysyłają pracowników w podróże.'),
      v('Boom inwestycyjny w regionie {region}', 'Nowe fabryki i centra biurowe w regionie {region} napędzają ruch biznesowy.'),
      v('Rekordowa konsumpcja w regionie {region}', 'Mieszkańcy regionu {region} więcej wydają — także na podróże.'),
    ],
    effects: { hours: [96, 168], demand: [1.15, 1.32] },
  },
  {
    id: 'eco_global_boom', category: 'economy', severity: 'major', tone: 'good', weight: 2, target: 'global', cooldownH: 360,
    condition: day(6),
    variants: [
      v('Światowe ożywienie gospodarcze', 'Wszystkie główne gospodarki rosną jednocześnie. Popyt na podróże lotnicze bije rekordy.'),
      v('Złota era podróży', 'Niskie bezrobocie i rosnące płace sprawiają, że ludzie latają częściej niż kiedykolwiek.'),
    ],
    effects: { hours: [120, 168], demand: [1.22, 1.3] },
  },
  {
    id: 'eco_travel_slump', category: 'economy', severity: 'minor', tone: 'bad', weight: 6, target: 'global', cooldownH: 96,
    variants: [
      v('Spadek popytu na podróże', 'Badania pokazują, że ludzie odkładają wyjazdy na później.'),
      v('Pesymizm konsumentów', 'Nastroje konsumenckie spadły do najniższego poziomu od miesięcy. Mniej rezerwacji.'),
      v('Drogie hotele zniechęcają', 'Rekordowe ceny noclegów sprawiają, że turyści rezygnują z wyjazdów.'),
      v('Moda na urlop w domu', 'Media społecznościowe promują wypoczynek bez podróży. Linie notują mniej rezerwacji.'),
    ],
    effects: { hours: [48, 96], demand: [0.82, 0.92] },
  },
  {
    id: 'eco_strong_currency', category: 'economy', severity: 'minor', tone: 'good', weight: 4, target: 'region', cooldownH: 120,
    variants: [
      v('Silna waluta w regionie {region}', 'Mieszkańcy regionu {region} chętniej podróżują za granicę i akceptują wyższe ceny biletów.'),
      v('Korzystne kursy walut', 'Kurs waluty w regionie {region} sprzyja zagranicznym wyjazdom.'),
    ],
    effects: { hours: [96, 144], fare: [1.06, 1.12], demand: 1.05 },
  },
  {
    id: 'eco_aviation_tax', category: 'economy', severity: 'major', tone: 'bad', weight: 3, target: 'region', cooldownH: 360,
    condition: all(level(3), day(5)),
    variants: [
      v('Nowy podatek lotniczy: {region}', 'Rządy w regionie {region} wprowadzają opłatę klimatyczną od każdego biletu.'),
      v('Opłata ekologiczna od lotów', 'W regionie {region} każdy pasażer zapłaci dodatkową opłatę środowiskową.'),
    ],
    choices: [
      { label: 'Dolicz do ceny biletu', description: 'Pasażerowie zapłacą więcej, część zrezygnuje.', effects: { hours: [144, 192], demand: 0.88 } },
      { label: 'Zapłać z własnej kieszeni', description: 'Jednorazowy koszt, popyt bez zmian.', effects: { cash: negScaled(1.0, 1.4) } },
      { label: 'Lobbing w parlamencie', description: 'Mniejszy koszt i łagodniejsze przepisy, ale gorszy wizerunek.', effects: { hours: [144, 192], demand: 0.95, cash: negScaled(0.4, 0.6), reputation: -3 } },
    ],
  },
  {
    id: 'eco_tourism_program', category: 'economy', severity: 'minor', tone: 'good', weight: 5, target: 'region', cooldownH: 120,
    variants: [
      v('Program wsparcia turystyki', 'Rządy w regionie {region} dopłacają do wyjazdów krajowych i zagranicznych.'),
      v('Bony turystyczne w regionie {region}', 'Mieszkańcy otrzymali bony na podróże. Rezerwacje rosną.'),
    ],
    effects: { hours: [96, 144], demand: [1.18, 1.28], cash: scaled(0.15, 0.25) },
  },
  {
    id: 'eco_interest', category: 'economy', severity: 'minor', tone: 'bad', weight: 4, target: 'global', cooldownH: 120,
    condition: (s) => s.loans.length > 0,
    variants: [
      v('Podwyżka stóp procentowych', 'Bank centralny podniósł stopy. Obsługa zadłużenia i leasing drożeją.'),
      v('Droższy pieniądz', 'Wyższe stopy procentowe zwiększają koszty finansowania floty.'),
    ],
    effects: { hours: [120, 168], upkeep: [1.06, 1.12] },
  },
  {
    id: 'eco_subsidy', category: 'economy', severity: 'minor', tone: 'good', weight: 4, target: 'global', cooldownH: 120,
    variants: [
      v('Dotacja na rozwój połączeń', 'Rząd wspiera rozwój lokalnych połączeń. Otrzymujesz jednorazową dotację.'),
      v('Fundusz rozwoju regionów', 'Twoja linia zakwalifikowała się do programu wsparcia połączeń regionalnych.'),
      v('Zwrot podatku', 'Urząd skarbowy uznał Twoje inwestycje we flotę za uprawnione do ulgi.'),
    ],
    effects: { cash: scaled(0.3, 0.6) },
  },

  // =====================================================================
  // INWESTORZY
  // =====================================================================
  {
    id: 'inv_fund_offer', category: 'investors', severity: 'major', tone: 'good', weight: 5, target: 'global', cooldownH: 240,
    condition: all(level(2), day(3)),
    variants: [
      v('Fundusz inwestycyjny oferuje kapitał', 'Duży fundusz private equity chce dokapitalizować Twoją linię w zamian za udział w przychodach.'),
      v('Oferta funduszu infrastrukturalnego', 'Fundusz specjalizujący się w transporcie proponuje zastrzyk gotówki. Warunki można negocjować.'),
      v('Inwestor z Zatoki Perskiej', 'Państwowy fundusz majątkowy jest zainteresowany Twoją linią i jej rozwojem.'),
    ],
    choices: [
      { label: 'Przyjmij ofertę', description: 'Duża kwota teraz, inwestor bierze część przychodów.', effects: { cash: scaled(6, 8), hours: 360, revenue: 0.9 } },
      { label: 'Negocjuj warunki', description: 'Mniej pieniędzy, ale mniejszy udział inwestora.', effects: { cash: scaled(3.5, 4.5), hours: 240, revenue: 0.95 } },
      { label: 'Odrzuć', description: 'Zachowujesz pełną kontrolę nad przychodami.', effects: {} },
    ],
  },
  {
    id: 'inv_angel', category: 'investors', severity: 'major', tone: 'good', weight: 4, target: 'global', cooldownH: 240,
    condition: all(day(2), (s) => s.level <= 4),
    variants: [
      v('Prywatny inwestor', 'Znany przedsiębiorca wierzy w Twoją linię i chce dołożyć kapitał na rozwój.'),
      v('Anioł biznesu', 'Były prezes dużego przewoźnika proponuje inwestycję i swoje doświadczenie.'),
    ],
    choices: [
      { label: 'Przyjmij kapitał i doradztwo', description: 'Gotówka i lepszy wizerunek, niewielki udział w przychodach.', effects: { cash: scaled(3, 4), reputation: 3, hours: 240, revenue: 0.94 } },
      { label: 'Tylko pożyczka', description: 'Gotówka na preferencyjnych warunkach, do spłaty w ratach.', effects: { loan: { amount: scaled(3, 4), days: 15, rate: 0.08 } } },
      { label: 'Podziękuj', effects: {} },
    ],
  },
  {
    id: 'inv_bank_loan', category: 'investors', severity: 'major', tone: 'neutral', weight: 4, target: 'global', cooldownH: 200,
    condition: day(3),
    variants: [
      v('Bank proponuje kredyt', 'Bank inwestycyjny oferuje finansowanie rozwoju floty. Do wyboru dwie opcje.'),
      v('Oferta linii kredytowej', 'Konsorcjum banków chce sfinansować Twoją ekspansję.'),
      v('Negocjacje finansowania', 'Bank przedstawił warunki kredytu. Możesz wybrać wariant lub zrezygnować.'),
    ],
    choices: [
      { label: 'Mniejszy kredyt, niskie odsetki', effects: { loan: { amount: scaled(4, 5), days: 20, rate: 0.12 } } },
      { label: 'Duży kredyt, wyższe odsetki', effects: { loan: { amount: scaled(9, 11), days: 30, rate: 0.25 } } },
      { label: 'Nie teraz', effects: {} },
    ],
  },
  {
    id: 'inv_growth', category: 'investors', severity: 'major', tone: 'good', weight: 4, target: 'city', cooldownH: 200,
    condition: all(level(2), day(3)), cityFilter: upgradeable,
    variants: [
      v('Inwestor finansuje rozbudowę: {city}', 'Fundusz infrastrukturalny chce sfinansować rozbudowę Twojego lotniska w mieście {city} w zamian za udział w przychodach.'),
      v('Partner do rozbudowy lotniska {city}', 'Lokalny deweloper zaproponował współfinansowanie nowego terminalu w mieście {city}.'),
    ],
    choices: [
      { label: 'Rozbuduj lotnisko', description: 'Darmowy nowy poziom lotniska, inwestor bierze część przychodów.', effects: { upgradeAirport: true, hours: 240, revenue: 0.95 } },
      { label: 'Weź gotówkę zamiast rozbudowy', effects: { cash: scaled(1.8, 2.4), hours: 240, revenue: 0.96 } },
      { label: 'Odrzuć', effects: {} },
    ],
  },
  {
    id: 'inv_acquire_carrier', category: 'investors', severity: 'major', tone: 'good', weight: 3, target: 'region', cooldownH: 300,
    condition: all(level(3), day(5)),
    variants: [
      v('Regionalny przewoźnik na sprzedaż', 'Mała linia z regionu {region} szuka kupca. W pakiecie samoloty i lojalni klienci.'),
      v('Okazja przejęcia w regionie {region}', 'Właściciele lokalnej linii chcą przejść na emeryturę i sprzedać firmę.'),
    ],
    choices: [
      { label: 'Przejmij przewoźnika', description: 'Dostajesz samolot i klientów konkurenta.', effects: { cash: negScaled(2.5, 3.2), grantPlane: 'rj100', hours: 240, demand: 1.15 } },
      { label: 'Kup tylko samolot', effects: { cash: negScaled(1.6, 2), grantPlane: 'rj100' } },
      { label: 'Zrezygnuj', effects: {} },
    ],
  },
  {
    id: 'inv_partnership', category: 'investors', severity: 'major', tone: 'good', weight: 4, target: 'region', cooldownH: 240,
    condition: all(level(2), day(4)),
    variants: [
      v('Propozycja partnerstwa', 'Duża linia z regionu {region} proponuje współdzielenie połączeń i programu lojalnościowego.'),
      v('Sojusz lotniczy zaprasza', 'Międzynarodowy sojusz chce, abyś obsługiwał połączenia w regionie {region} pod wspólną marką.'),
      v('Umowa codeshare', 'Przewoźnik z regionu {region} chce sprzedawać bilety na Twoje loty.'),
    ],
    choices: [
      { label: 'Pełne partnerstwo', description: 'Opłata wstępna, duży wzrost popytu.', effects: { cash: negScaled(0.8, 1.2), hours: 240, demand: 1.25 } },
      { label: 'Partnerstwo z podziałem przychodów', description: 'Bez opłaty, ale partner bierze prowizję.', effects: { hours: 240, demand: 1.18, revenue: 0.96 } },
      { label: 'Odrzuć', effects: {} },
    ],
  },
  {
    id: 'inv_hostile', category: 'investors', severity: 'critical', tone: 'bad', weight: 2, target: 'global', cooldownH: 480,
    condition: all(level(4), day(7)),
    variants: [
      v('Próba wrogiego przejęcia', 'Konkurencyjny koncern skupuje udziały Twojej linii i żąda miejsca w zarządzie.'),
      v('Atak na akcjonariat', 'Fundusz aktywistyczny chce przejąć kontrolę nad Twoją linią i wymusić sprzedaż aktywów.'),
    ],
    choices: [
      { label: 'Odkup udziały', description: 'Drogo, ale zachowujesz niezależność.', effects: { cash: negScaled(3.5, 4.5), reputation: 3 } },
      { label: 'Przyjmij warunki', description: 'Dostajesz gotówkę, ale tracisz część przychodów.', effects: { cash: scaled(2, 2.5), hours: 300, revenue: 0.85 } },
      { label: 'Walcz w mediach', description: 'Tania obrona, ale kosztuje wizerunkowo.', effects: { cash: negScaled(0.8, 1.2), reputation: -4 } },
    ],
  },
  {
    id: 'inv_debt_relief', category: 'investors', severity: 'major', tone: 'neutral', weight: 4, target: 'global', cooldownH: 240,
    condition: (s) => s.loans.reduce((a, l) => a + l.perDay * l.daysLeft, 0) > 200_000,
    variants: [
      v('Renegocjacja warunków finansowania', 'Bank proponuje umorzenie części długu w zamian za udział w przychodach.'),
      v('Restrukturyzacja zadłużenia', 'Wierzyciele są gotowi obniżyć raty, jeśli podzielisz się zyskami.'),
    ],
    choices: [
      { label: 'Umorzenie 30% długu', description: 'Niższe raty kosztem części przychodów.', effects: { debtRelief: 0.3, hours: 240, revenue: 0.93 } },
      { label: 'Umorzenie 15% długu', effects: { debtRelief: 0.15, hours: 168, revenue: 0.97 } },
      { label: 'Zostaw bez zmian', effects: {} },
    ],
  },
  {
    id: 'inv_reward', category: 'investors', severity: 'minor', tone: 'good', weight: 4, target: 'global', cooldownH: 168,
    condition: (s) => s.history.length > 0 && s.history[s.history.length - 1].revenue > s.history[s.history.length - 1].flightCost * 1.6,
    variants: [
      v('Inwestorzy nagradzają wyniki', 'Akcjonariusze docenili rentowność linii i dokapitalizowali spółkę.'),
      v('Premia od udziałowców', 'Dobre wyniki finansowe przyciągnęły dodatkowy kapitał.'),
    ],
    effects: { cash: scaled(0.6, 1) },
  },
  {
    id: 'inv_dividend', category: 'investors', severity: 'major', tone: 'neutral', weight: 3, target: 'global', cooldownH: 300,
    condition: (s) => s.money > 2_000_000,
    variants: [
      v('Akcjonariusze żądają dywidendy', 'Udziałowcy uważają, że linia ma za dużo gotówki i chcą wypłaty zysku.'),
      v('Spór o podział zysku', 'Rada nadzorcza naciska na wypłatę dywidendy zamiast inwestycji.'),
    ],
    choices: [
      { label: 'Wypłać dywidendę', description: 'Zadowoleni udziałowcy, mniej gotówki.', effects: { cash: (_s, ctx) => -ctx.scale * 2, reputation: 3 } },
      { label: 'Zainwestuj w rozwój', description: 'Gotówka zostaje, ale relacje z udziałowcami cierpią.', effects: { reputation: -3 } },
      { label: 'Kompromis', effects: { cash: (_s, ctx) => -ctx.scale, reputation: 1 } },
    ],
  },
  {
    id: 'inv_crowdfunding', category: 'investors', severity: 'minor', tone: 'good', weight: 3, target: 'global', cooldownH: 240,
    condition: level(2),
    variants: [
      v('Udana zbiórka społecznościowa', 'Pasażerowie kupili udziały w Twojej linii w ramach zbiórki internetowej.'),
      v('Akcje pracownicze', 'Pracownicy zainwestowali w firmę — rośnie gotówka i zaangażowanie.'),
    ],
    effects: { cash: scaled(0.4, 0.7), reputation: 2 },
  },

  // =====================================================================
  // KONKURENCJA
  // =====================================================================
  {
    id: 'comp_new_airline', category: 'competition', severity: 'major', tone: 'bad', weight: 5, target: 'region', cooldownH: 240,
    condition: all(level(2), day(3)),
    variants: [
      v('Nowa linia lotnicza: {region}', 'W regionie {region} startuje nowy przewoźnik z agresywnym cennikiem i nowoczesną flotą.'),
      v('Tani przewoźnik wchodzi do regionu {region}', 'Linia niskokosztowa otwiera bazę w regionie {region} i ogłasza bilety za ułamek ceny.'),
      v('Konkurent z kapitałem państwowym', 'Nowa linia z regionu {region} ma wsparcie rządu i nie musi przejmować się zyskiem.'),
    ],
    choices: [
      { label: 'Wojna cenowa', description: 'Obniżasz ceny i utrzymujesz pasażerów.', effects: { hours: [168, 216], fare: 0.85 } },
      { label: 'Postaw na jakość', description: 'Inwestujesz w obsługę — reputacja chroni popyt.', effects: { hours: [168, 216], demand: 0.92, cash: negScaled(0.8, 1.2), reputation: 4 } },
      { label: 'Zignoruj', description: 'Bez kosztów, ale konkurent przejmie część rynku.', effects: { hours: [168, 216], demand: [0.78, 0.84] } },
    ],
  },
  {
    id: 'comp_price_war', category: 'competition', severity: 'minor', tone: 'bad', weight: 6, target: 'global', cooldownH: 96,
    condition: level(2),
    variants: [
      v('Wojna cenowa', 'Konkurencja obniża ceny biletów. Musisz dopasować taryfy.'),
      v('Promocje konkurencji', 'Kilku przewoźników jednocześnie ogłosiło wyprzedaż biletów.'),
      v('Bitwa o pasażera', 'Agresywne obniżki u rywali zmuszają Cię do korekty cen.'),
    ],
    effects: { hours: [36, 72], fare: [0.84, 0.9] },
  },
  {
    id: 'comp_regional_price_war', category: 'competition', severity: 'minor', tone: 'bad', weight: 5, target: 'region', cooldownH: 120,
    condition: level(2),
    variants: [
      v('Wojna cenowa w regionie {region}', 'Przewoźnicy w regionie {region} prześcigają się w obniżkach.'),
      v('Wyprzedaż biletów: {region}', 'Konkurenci zalali rynek w regionie {region} tanimi biletami.'),
    ],
    effects: { hours: [72, 120], fare: [0.8, 0.88] },
  },
  {
    id: 'comp_market_grab', category: 'competition', severity: 'minor', tone: 'bad', weight: 5, target: 'region', cooldownH: 120,
    condition: day(3),
    variants: [
      v('Konkurent przejmuje rynek', 'Rywal zwiększył liczbę lotów w regionie {region} i odbiera Ci klientów.'),
      v('Ekspansja rywala w regionie {region}', 'Konkurencyjny przewoźnik otworzył kilkanaście nowych tras w regionie {region}.'),
      v('Agresywny program lojalnościowy', 'Konkurent w regionie {region} oferuje podwójne punkty za każdy lot.'),
    ],
    effects: { hours: [96, 144], demand: [0.8, 0.9] },
  },
  {
    id: 'comp_city_base', category: 'competition', severity: 'minor', tone: 'bad', weight: 5, target: 'city', cooldownH: 96,
    variants: [
      v('Konkurent otwiera bazę: {city}', 'Rywal ulokował kilka samolotów w mieście {city}. Pasażerowie mają większy wybór.'),
      v('Nowe połączenia rywala z miasta {city}', 'Konkurencja uruchomiła nowe trasy z lotniska {city}.'),
      v('Szybka kolej do miasta {city}', 'Nowa linia kolei dużych prędkości odbiera część pasażerów lotniczych w mieście {city}.'),
    ],
    effects: { hours: [96, 168], demand: [0.72, 0.85] },
  },
  {
    id: 'comp_bankrupt', category: 'competition', severity: 'major', tone: 'good', weight: 3, target: 'region', cooldownH: 300,
    condition: all(level(3), day(5)),
    variants: [
      v('Bankructwo konkurenta: {region}', 'Jeden z przewoźników w regionie {region} ogłosił upadłość. Tysiące pasażerów szukają alternatywy.'),
      v('Upadek rywala', 'Linia konkurencyjna w regionie {region} zawiesza wszystkie loty z powodu długów.'),
    ],
    choices: [
      { label: 'Przejmij samoloty i załogi', description: 'Tanio przejmujesz maszynę z masy upadłościowej.', effects: { cash: negScaled(1.2, 1.6), grantPlane: 'n180', hours: 168, demand: 1.3 } },
      { label: 'Przejmij pasażerów', description: 'Kampania dla klientów upadłej linii.', effects: { cash: negScaled(0.3, 0.5), hours: 192, demand: 1.4 } },
      { label: 'Nic nie rób', effects: { hours: 120, demand: 1.15 } },
    ],
  },
  {
    id: 'comp_strike', category: 'competition', severity: 'minor', tone: 'good', weight: 5, target: 'region', cooldownH: 96,
    variants: [
      v('Strajk u konkurencji', 'Piloci konkurencyjnej linii w regionie {region} strajkują. Pasażerowie przesiadają się na Twoje loty.'),
      v('Awaria systemu rezerwacji rywala', 'System sprzedaży biletów konkurenta w regionie {region} nie działa od rana.'),
      v('Uziemiona flota rywala', 'Nadzór lotniczy uziemił część floty konkurenta w regionie {region}.'),
    ],
    effects: { hours: [36, 72], demand: [1.18, 1.3] },
  },
  {
    id: 'comp_scandal', category: 'competition', severity: 'minor', tone: 'good', weight: 4, target: 'global', cooldownH: 168,
    variants: [
      v('Skandal u konkurenta', 'Media ujawniły zaniedbania w serwisie floty dużego rywala. Pasażerowie wybierają pewniejsze linie.'),
      v('Afera wokół rywala', 'Konkurent został przyłapany na ukrytych opłatach. Zyskujesz w oczach pasażerów.'),
    ],
    effects: { reputation: [3, 5], hours: 72, demand: 1.05 },
  },
  {
    id: 'comp_poaching', category: 'competition', severity: 'major', tone: 'bad', weight: 3, target: 'global', cooldownH: 300,
    condition: all(planes(4), day(4)),
    variants: [
      v('Konkurent podkupuje pilotów', 'Rywal oferuje Twoim pilotom pensje wyższe o jedną trzecią. Część już złożyła wypowiedzenia.'),
      v('Odpływ personelu', 'Doświadczeni mechanicy przechodzą do konkurencji. Trzeba zareagować.'),
    ],
    choices: [
      { label: 'Podnieś wynagrodzenia', description: 'Wyższe koszty stałe, obsługa bez zakłóceń.', effects: { hours: 240, upkeep: 1.12 } },
      { label: 'Zatrudnij nowych pracowników', description: 'Jednorazowy koszt szkoleń, chwilowe opóźnienia.', effects: { cash: negScaled(0.6, 0.9), hours: 72, turnaround: 1.2 } },
      { label: 'Pozwól odejść', description: 'Bez kosztów, ale długo potrwają opóźnienia.', effects: { hours: 144, turnaround: 1.4, reputation: -3 } },
    ],
  },
  {
    id: 'comp_codeshare', category: 'competition', severity: 'major', tone: 'neutral', weight: 3, target: 'global', cooldownH: 300,
    condition: all(level(3), day(5)),
    variants: [
      v('Konkurent proponuje współpracę', 'Rywal chce współdzielić rezerwacje zamiast walczyć ceną.'),
      v('Rozejm na rynku', 'Największy konkurent proponuje porozumienie o wspólnej sprzedaży biletów.'),
    ],
    choices: [
      { label: 'Przyjmij porozumienie', description: 'Więcej pasażerów, nieco niższe ceny.', effects: { hours: 240, demand: 1.12, fare: 0.96 } },
      { label: 'Odrzuć', effects: {} },
    ],
  },
  {
    id: 'comp_rival_growth', category: 'competition', severity: 'minor', tone: 'bad', weight: 4, target: 'global', cooldownH: 168,
    condition: level(4),
    variants: [
      v('Rywal zamawia setki samolotów', 'Największy konkurent ogłosił gigantyczne zamówienie floty. Rynek szykuje się na jego ekspansję.'),
      v('Fuzja dwóch konkurentów', 'Dwaj rywale łączą siły i tworzą jednego z największych przewoźników.'),
    ],
    effects: { hours: [96, 144], demand: [0.88, 0.94] },
  },

  // =====================================================================
  // WYDARZENIA LOKALNE
  // =====================================================================
  {
    id: 'loc_festival', category: 'local', severity: 'minor', tone: 'good', weight: 9, target: 'city', cooldownH: 36,
    variants: [
      v('Festiwal muzyczny w mieście {city}', 'Wielki festiwal w mieście {city} przyciąga tłumy podróżnych.'),
      v('Festiwal filmowy: {city}', 'Gwiazdy kina i tysiące widzów zjeżdżają do miasta {city}.'),
      v('Festiwal jazzowy w mieście {city}', 'Kilkudniowy festiwal jazzowy przyciąga fanów z całego świata.'),
      v('Festiwal kulinarny: {city}', 'Szefowie kuchni z całego świata gotują w mieście {city}. Smakosze rezerwują loty.'),
      v('Festiwal światła w mieście {city}', 'Iluminacje i pokazy przyciągają turystów do miasta {city}.'),
      v('Karnawał w mieście {city}', 'Barwne parady i zabawy uliczne ściągają turystów do miasta {city}.'),
      v('Festiwal muzyki elektronicznej: {city}', 'Największe sceny i didżeje świata grają w mieście {city}.'),
    ],
    effects: { hours: [30, 54], demand: [1.5, 1.9] },
  },
  {
    id: 'loc_concert', category: 'local', severity: 'minor', tone: 'good', weight: 7, target: 'city', cooldownH: 36,
    variants: [
      v('Koncert gwiazdy w mieście {city}', 'Światowa trasa koncertowa zawitała do miasta {city}. Bilety wyprzedane w minuty.'),
      v('Stadionowy koncert: {city}', 'Dwa wieczory koncertów na stadionie w mieście {city} — fani przylatują z daleka.'),
      v('Gala muzyczna w mieście {city}', 'Rozdanie nagród muzycznych odbywa się w mieście {city}.'),
      v('Pożegnalna trasa legendy', 'Ostatni koncert legendarnego zespołu odbędzie się w mieście {city}.'),
    ],
    effects: { hours: [16, 30], demand: [1.6, 2.0] },
  },
  {
    id: 'loc_sports', category: 'local', severity: 'minor', tone: 'good', weight: 7, target: 'city', cooldownH: 36,
    variants: [
      v('Finał mistrzostw w mieście {city}', 'Miasto {city} gości finał mistrzostw. Kibice rezerwują wszystkie wolne miejsca.'),
      v('Grand Prix: {city}', 'Wyścig samochodowy w mieście {city} przyciąga dziesiątki tysięcy fanów.'),
      v('Maraton w mieście {city}', 'Kilkadziesiąt tysięcy biegaczy z całego świata startuje w maratonie.'),
      v('Turniej tenisowy: {city}', 'Najlepsi tenisiści świata grają w mieście {city}.'),
      v('Derby w mieście {city}', 'Mecz sezonu w mieście {city}. Kibice gości przylatują masowo.'),
      v('Mistrzostwa lekkoatletyczne: {city}', 'Sportowcy i kibice z kilkudziesięciu krajów przylatują do miasta {city}.'),
    ],
    effects: { hours: [16, 30], demand: [1.8, 2.3] },
  },
  {
    id: 'loc_olympics', category: 'local', severity: 'major', tone: 'good', weight: 2, target: 'city', cooldownH: 480,
    condition: all(day(4), airports(3)), cityFilter: bigCity(2),
    variants: [
      v('Igrzyska sportowe w mieście {city}', 'Miasto {city} organizuje wielkie igrzyska. Przez kilka dni będzie centrum świata sportu.'),
      v('Mistrzostwa świata: {city}', 'Turniej o mistrzostwo świata zagości w mieście {city}. Organizatorzy szukają oficjalnego przewoźnika.'),
    ],
    choices: [
      { label: 'Zostań oficjalnym przewoźnikiem', description: 'Kosztowne sponsorowanie, największy wzrost ruchu i reputacji.', effects: { cash: negScaled(1.2, 1.6), hours: [120, 144], demand: 2.8, reputation: 5 } },
      { label: 'Specjalna oferta dla kibiców', description: 'Niewielki koszt promocji.', effects: { cash: negScaled(0.3, 0.4), hours: [120, 144], demand: 2.3 } },
      { label: 'Bez dodatkowych działań', effects: { hours: [120, 144], demand: 1.9 } },
    ],
  },
  {
    id: 'loc_trade_fair', category: 'local', severity: 'minor', tone: 'good', weight: 7, target: 'city', cooldownH: 36,
    variants: [
      v('Targi motoryzacyjne w mieście {city}', 'Producenci samochodów prezentują nowości. Do miasta {city} przylatują dziennikarze i handlowcy.'),
      v('Targi technologiczne: {city}', 'Firmy technologiczne z całego świata wystawiają się w mieście {city}.'),
      v('Międzynarodowe targi turystyczne', 'Branża turystyczna spotyka się w mieście {city}.'),
      v('Targi książki w mieście {city}', 'Wydawcy i autorzy z kilkudziesięciu krajów przyjeżdżają do miasta {city}.'),
      v('Targi spożywcze: {city}', 'Producenci żywności zawierają kontrakty w mieście {city}.'),
      v('Salon lotniczy w mieście {city}', 'Producenci samolotów i linie lotnicze spotykają się w mieście {city}.'),
      v('Targi medyczne: {city}', 'Lekarze i producenci sprzętu medycznego przylatują do miasta {city}.'),
    ],
    effects: { hours: [36, 60], demand: [1.4, 1.65] },
  },
  {
    id: 'loc_business', category: 'local', severity: 'minor', tone: 'good', weight: 6, target: 'city', cooldownH: 48,
    variants: [
      v('Szczyt gospodarczy w mieście {city}', 'Prezesi największych firm spotykają się w mieście {city}. Popyt na loty biznesowe rośnie.'),
      v('Międzynarodowy kongres: {city}', 'Do miasta {city} zjeżdżają delegaci z całego świata.'),
      v('Konferencja klimatyczna w mieście {city}', 'Delegacje rządowe i organizacje pozarządowe przylatują do miasta {city}.'),
      v('Nowa siedziba korporacji: {city}', 'Globalna firma przenosi centralę do miasta {city}. Rośnie ruch służbowy.'),
    ],
    effects: { hours: [24, 48], demand: [1.35, 1.6], fare: 1.05, scope: 'city' },
  },
  {
    id: 'loc_tourism_region', category: 'local', severity: 'minor', tone: 'good', weight: 6, target: 'region', cooldownH: 96,
    variants: [
      v('Szczyt sezonu turystycznego: {region}', 'Sezon wakacyjny w regionie {region}. Popyt we wszystkich miastach regionu rośnie.'),
      v('Wzrost turystyki w regionie {region}', 'Biura podróży notują rekordową sprzedaż wycieczek do regionu {region}.'),
      v('Ferie w regionie {region}', 'Rodziny z dziećmi ruszają w podróż. Lotniska w regionie {region} pękają w szwach.'),
      v('Region {region} modnym kierunkiem', 'Przewodniki turystyczne wskazały region {region} jako kierunek roku.'),
    ],
    effects: { hours: [96, 168], demand: [1.25, 1.4] },
  },
  {
    id: 'loc_viral', category: 'local', severity: 'minor', tone: 'good', weight: 5, target: 'city', cooldownH: 72,
    variants: [
      v('{city} hitem mediów społecznościowych', 'Filmy z miasta {city} zdobywają miliony wyświetleń. Turyści chcą to zobaczyć na własne oczy.'),
      v('Serial rozsławia miasto {city}', 'Popularny serial kręcony w mieście {city} przyciąga fanów z całego świata.'),
      v('Nowa atrakcja w mieście {city}', 'Otwarto spektakularne muzeum, o którym mówi cały świat.'),
    ],
    effects: { hours: [72, 120], demand: [1.35, 1.55] },
  },
  {
    id: 'loc_culture_capital', category: 'local', severity: 'major', tone: 'good', weight: 2, target: 'city', cooldownH: 480,
    condition: all(day(5), airports(3)),
    variants: [
      v('{city} Stolicą Kultury Roku', 'Miasto {city} otrzymało tytuł Stolicy Kultury. Władze szukają partnera do promocji.'),
      v('Wystawa światowa w mieście {city}', 'Miasto {city} gości wielką wystawę światową — miliony zwiedzających.'),
    ],
    choices: [
      { label: 'Zostań partnerem promocji', description: 'Opłata za partnerstwo, długi wzrost popytu i reputacji.', effects: { cash: negScaled(0.8, 1.1), hours: 240, demand: 1.6, reputation: 3 } },
      { label: 'Skorzystaj bez partnerstwa', effects: { hours: 240, demand: 1.35 } },
    ],
  },
  {
    id: 'loc_holiday', category: 'local', severity: 'minor', tone: 'good', weight: 6, target: 'global', cooldownH: 96,
    variants: [
      v('Długi weekend', 'Długi weekend w wielu krajach — wszyscy chcą gdzieś polecieć.'),
      v('Okres świąteczny', 'Ludzie odwiedzają rodziny. Ruch na lotniskach rośnie.'),
      v('Wakacje szkolne', 'Rozpoczęły się wakacje — rodziny ruszają w podróż.'),
    ],
    effects: { hours: [36, 60], demand: [1.22, 1.35] },
  },
  {
    id: 'loc_city_strike', category: 'local', severity: 'minor', tone: 'bad', weight: 4, target: 'city', cooldownH: 72,
    variants: [
      v('Strajk komunikacji w mieście {city}', 'Pasażerowie mają problem z dojazdem na lotnisko {city}.'),
      v('Protesty w centrum miasta {city}', 'Demonstracje sparaliżowały ruch w mieście {city}. Część podróżnych odwołuje wyjazdy.'),
      v('Remont drogi na lotnisko {city}', 'Korki na trasie do lotniska zniechęcają podróżnych.'),
    ],
    effects: { hours: [24, 48], demand: [0.75, 0.88] },
  },
  {
    id: 'loc_flu', category: 'local', severity: 'minor', tone: 'bad', weight: 3, target: 'region', cooldownH: 168,
    variants: [
      v('Sezon grypowy: {region}', 'Fala zachorowań w regionie {region} sprawia, że część osób rezygnuje z podróży.'),
      v('Upały zniechęcają turystów', 'Rekordowe temperatury w regionie {region} odstraszają część turystów.'),
    ],
    effects: { hours: [72, 120], demand: [0.84, 0.92] },
  },

  // =====================================================================
  // SYTUACJA MIĘDZYNARODOWA
  // =====================================================================
  {
    id: 'int_tension', category: 'international', severity: 'minor', tone: 'bad', weight: 5, target: 'region', cooldownH: 120,
    condition: day(3),
    variants: [
      v('Napięcia polityczne: {region}', 'Spór dyplomatyczny w regionie {region} zniechęca turystów i firmy.'),
      v('Kryzys rządowy w regionie {region}', 'Niestabilna sytuacja polityczna obniża liczbę rezerwacji.'),
      v('Ostrzeżenia dla podróżnych', 'Kilka państw wydało ostrzeżenia przed podróżami do regionu {region}.'),
    ],
    effects: { hours: [96, 144], demand: [0.8, 0.9] },
  },
  {
    id: 'int_conflict', category: 'international', severity: 'critical', tone: 'bad', weight: 2, target: 'region', cooldownH: 480,
    condition: all(level(3), day(6), airports(3)),
    variants: [
      v('Konflikt zbrojny: {region}', 'Walki przy granicy w regionie {region} wpływają na ruch lotniczy. Ubezpieczyciele podnoszą stawki.'),
      v('Eskalacja konfliktu w regionie {region}', 'Część przestrzeni powietrznej w regionie {region} jest niebezpieczna. Linie zmieniają trasy.'),
    ],
    choices: [
      { label: 'Zawieś loty w regionie', description: 'Bezpieczeństwo przede wszystkim — lotniska w regionie stoją.', effects: { closed: true, hours: [36, 48], reputation: 4 } },
      { label: 'Lataj z wyższym ubezpieczeniem', description: 'Loty trwają, ale drożej i z mniejszym popytem.', effects: { hours: [96, 120], upkeep: 1.25, demand: 0.7 } },
      { label: 'Omijaj strefę konfliktu', description: 'Dłuższe trasy — wyższe koszty paliwa.', effects: { hours: [96, 120], fuel: 1.3, demand: 0.8 } },
    ],
  },
  {
    id: 'int_airspace', category: 'international', severity: 'major', tone: 'bad', weight: 3, target: 'region', cooldownH: 240,
    condition: all(day(4), airports(3)),
    variants: [
      v('Zamknięta przestrzeń powietrzna: {region}', 'Władze w regionie {region} czasowo zamknęły przestrzeń powietrzną. Samoloty czekają na ziemi.'),
      v('Ćwiczenia wojskowe w regionie {region}', 'Duże manewry wojskowe wymusiły wstrzymanie lotów cywilnych.'),
      v('Incydent dyplomatyczny', 'Po incydencie na granicy loty w regionie {region} zostały wstrzymane do odwołania.'),
    ],
    effects: { closed: true, hours: [6, 14] },
  },
  {
    id: 'int_sanctions', category: 'international', severity: 'major', tone: 'bad', weight: 3, target: 'region', cooldownH: 300,
    condition: all(level(3), day(5)),
    variants: [
      v('Sankcje międzynarodowe: {region}', 'Nowe sankcje utrudniają handel i podróże w regionie {region}.'),
      v('Embargo handlowe w regionie {region}', 'Ograniczenia handlowe zmniejszają ruch biznesowy w regionie {region}.'),
    ],
    choices: [
      { label: 'Dostosuj się do sankcji', description: 'Mniej pasażerów i niższe ceny w regionie.', effects: { hours: [144, 192], demand: 0.78, fare: 0.92 } },
      { label: 'Wystąp o zwolnienie', description: 'Koszt prawników, łagodniejsze skutki.', effects: { cash: negScaled(0.8, 1.2), hours: [144, 192], demand: 0.9 } },
    ],
  },
  {
    id: 'int_thaw', category: 'international', severity: 'minor', tone: 'good', weight: 5, target: 'region', cooldownH: 168,
    variants: [
      v('Ocieplenie relacji: {region}', 'Porozumienie dyplomatyczne w regionie {region} otwiera nowe możliwości dla podróżnych.'),
      v('Ruch bezwizowy w regionie {region}', 'Zniesienie wiz zachęca do wyjazdów do regionu {region}.'),
      v('Umowa o otwartym niebie', 'Nowa umowa lotnicza w regionie {region} ułatwia uruchamianie połączeń.'),
    ],
    effects: { hours: [168, 240], demand: [1.2, 1.32] },
  },
  {
    id: 'int_border', category: 'international', severity: 'minor', tone: 'bad', weight: 4, target: 'region', cooldownH: 120,
    variants: [
      v('Nowe kontrole graniczne: {region}', 'Dodatkowe kontrole wydłużają odprawy w regionie {region}.'),
      v('Biometryczne kontrole paszportowe', 'Nowy system kontroli w regionie {region} na początku powoduje kolejki.'),
    ],
    effects: { hours: [48, 96], turnaround: [1.25, 1.4] },
  },
  {
    id: 'int_elections', category: 'international', severity: 'minor', tone: 'neutral', weight: 3, target: 'region', cooldownH: 168,
    variants: [
      v('Wybory w regionie {region}', 'Kampania wyborcza i niepewność wyniku lekko hamują podróże służbowe.'),
      v('Referendum w regionie {region}', 'Przed głosowaniem firmy wstrzymują część wyjazdów.'),
    ],
    effects: { hours: [36, 60], demand: 0.95 },
  },
  {
    id: 'int_peace', category: 'international', severity: 'major', tone: 'good', weight: 2, target: 'region', cooldownH: 480,
    condition: day(6),
    variants: [
      v('Porozumienie pokojowe: {region}', 'Historyczne porozumienie kończy wieloletni spór w regionie {region}. Turyści wracają.'),
      v('Nowa era współpracy w regionie {region}', 'Państwa regionu {region} podpisały umowę o wolnym przepływie osób.'),
    ],
    effects: { hours: 240, demand: [1.25, 1.35] },
  },
  {
    id: 'int_humanitarian', category: 'international', severity: 'major', tone: 'neutral', weight: 3, target: 'region', cooldownH: 300,
    condition: all(planes(3), day(4)),
    variants: [
      v('Prośba o loty humanitarne', 'Organizacje pomocowe proszą o przewiezienie ludzi i ładunków w regionie {region}.'),
      v('Ewakuacja obywateli', 'Rząd prosi przewoźników o pomoc w ewakuacji obywateli z regionu {region}.'),
    ],
    choices: [
      { label: 'Lataj bez opłat', description: 'Koszt operacji, duży wzrost reputacji.', effects: { cash: negScaled(0.4, 0.6), reputation: 8 } },
      { label: 'Lataj po kosztach', effects: { reputation: 3 } },
      { label: 'Lataj komercyjnie', description: 'Zarabiasz, ale opinia publiczna to zauważy.', effects: { cash: scaled(0.4, 0.6), reputation: -4 } },
    ],
  },
  {
    id: 'int_fuel_embargo', category: 'international', severity: 'critical', tone: 'bad', weight: 2, target: 'global', cooldownH: 480,
    condition: all(level(4), day(6)),
    variants: [
      v('Embargo naftowe', 'Główni eksporterzy ropy wstrzymali dostawy do kilku państw. Ceny paliwa lotniczego biją rekordy.'),
      v('Blokada szlaku tankowców', 'Zablokowana cieśnina odcięła część dostaw ropy. Rynek paliwa w panice.'),
    ],
    choices: [
      { label: 'Awaryjne zabezpieczenie cen', description: 'Drogi kontrakt, ale paliwo pod kontrolą.', effects: { cash: negScaled(1.8, 2.2), hours: 96, fuel: 1.25 } },
      { label: 'Dopłata paliwowa do biletów', description: 'Pasażerowie płacą więcej, część rezygnuje.', effects: { hours: 96, fuel: 1.8, fare: 1.15, demand: 0.85 } },
      { label: 'Ponieś koszty', effects: { hours: 96, fuel: [1.75, 1.9] } },
    ],
  },

  // =====================================================================
  // INFRASTRUKTURA I POGODA
  // =====================================================================
  {
    id: 'inf_airport_failure', category: 'infrastructure', severity: 'major', tone: 'bad', weight: 4, target: 'city', cooldownH: 168,
    condition: all(airports(3), day(3)),
    variants: [
      v('Awaria lotniska {city}', 'Awaria systemu odpraw sparaliżowała lotnisko {city}. Kolejki rosną z minuty na minutę.'),
      v('Awaria zasilania: {city}', 'Lotnisko {city} pracuje na zasilaniu awaryjnym. Większość operacji wstrzymano.'),
      v('Awaria systemu bagażowego', 'Taśmy bagażowe na lotnisku {city} stanęły. Odprawy trwają godzinami.'),
    ],
    choices: [
      { label: 'Opłać pilną naprawę', description: 'Szybki powrót do pracy.', effects: { cash: negScaled(0.3, 0.5), closed: true, hours: [2, 4] } },
      { label: 'Poczekaj na służby lotniska', description: 'Bez kosztów, ale długi przestój.', effects: { closed: true, hours: [10, 16] } },
    ],
  },
  {
    id: 'inf_power', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 4, target: 'city', cooldownH: 72,
    condition: airports(3),
    variants: [
      v('Przerwa w dostawie prądu: {city}', 'Lotnisko {city} chwilowo wstrzymało operacje.'),
      v('Awaria radaru: {city}', 'Kontrola lotów w mieście {city} czasowo ograniczyła ruch.'),
      v('Alarm bombowy: {city}', 'Ewakuacja terminalu w mieście {city}. Operacje wstrzymane na kilka godzin.'),
    ],
    effects: { closed: true, hours: [3, 7] },
  },
  {
    id: 'inf_modernization', category: 'infrastructure', severity: 'major', tone: 'good', weight: 4, target: 'city', cooldownH: 200,
    condition: all(day(3), level(2)), cityFilter: upgradeable,
    variants: [
      v('Modernizacja terminalu: {city}', 'Władze miasta {city} proponują współfinansowanie modernizacji Twojego terminalu.'),
      v('Program rozbudowy lotniska {city}', 'Rząd dopłaca do rozbudowy lotnisk regionalnych. Lotnisko {city} może skorzystać.'),
      v('Fundusze na infrastrukturę: {city}', 'Dostępna jest dotacja na nową płytę postojową i rękawy w mieście {city}.'),
    ],
    choices: [
      { label: 'Współfinansuj modernizację', description: 'Płacisz połowę kosztu rozbudowy, lotnisko zyskuje poziom.', effects: { cash: upgradeCost(0.5), upgradeAirport: true } },
      { label: 'Tylko nowe stanowiska odpraw', description: 'Taniej — szybsza obsługa samolotów przez kilka dni.', effects: { cash: upgradeCost(0.12), hours: 240, turnaround: 0.75 } },
      { label: 'Odmów', effects: {} },
    ],
  },
  {
    id: 'inf_runway', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 5, target: 'city', cooldownH: 96,
    variants: [
      v('Remont pasa startowego: {city}', 'Lotnisko {city} działa z jednym pasem. Obsługa samolotów trwa dłużej.'),
      v('Prace na płycie lotniska {city}', 'Część stanowisk postojowych w mieście {city} jest wyłączona z użytku.'),
      v('Braki kadrowe: {city}', 'Brakuje obsługi naziemnej na lotnisku {city}.'),
    ],
    effects: { hours: [48, 96], turnaround: [1.4, 1.7] },
  },
  {
    id: 'inf_new_systems', category: 'infrastructure', severity: 'minor', tone: 'good', weight: 4, target: 'city', cooldownH: 120,
    variants: [
      v('Nowy system odpraw: {city}', 'Automatyczne bramki na lotnisku {city} skracają obsługę pasażerów.'),
      v('Otwarcie nowej płyty: {city}', 'Więcej stanowisk postojowych w mieście {city} przyspiesza obsługę samolotów.'),
    ],
    effects: { hours: [120, 192], turnaround: [0.72, 0.85] },
  },
  {
    id: 'inf_storm', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 7, target: 'city', cooldownH: 36,
    condition: airports(3),
    variants: [
      v('Gwałtowne burze: {city}', 'Front burzowy nad miastem {city} wstrzymuje starty i lądowania.'),
      v('Nawałnica nad miastem {city}', 'Silny wiatr i ulewa zatrzymały samoloty na ziemi.'),
      v('Gradobicie: {city}', 'Grad uszkodził oznakowanie płyty lotniska. Przerwa w operacjach.'),
      v('Silny wiatr boczny: {city}', 'Wiatr przekracza normy dla lądowania na lotnisku {city}.'),
    ],
    effects: { closed: true, hours: [3, 8] },
  },
  {
    id: 'inf_fog', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 6, target: 'city', cooldownH: 36,
    variants: [
      v('Gęsta mgła: {city}', 'Ograniczona widoczność na lotnisku {city}. Starty odbywają się rzadziej.'),
      v('Zamieć śnieżna: {city}', 'Odladzanie samolotów w mieście {city} trwa dłużej niż zwykle.'),
      v('Smog nad miastem {city}', 'Słaba widoczność wydłuża obsługę ruchu.'),
    ],
    effects: { hours: [8, 18], turnaround: [1.6, 2.0] },
  },
  {
    id: 'inf_snowstorm', category: 'infrastructure', severity: 'major', tone: 'bad', weight: 3, target: 'region', cooldownH: 240,
    condition: all(day(3), airports(3)),
    variants: [
      v('Ekstremalna śnieżyca: {region}', 'Śnieżyca stulecia paraliżuje lotniska w regionie {region}.'),
      v('Fala mrozów w regionie {region}', 'Temperatury poniżej −30°C utrudniają obsługę samolotów.'),
    ],
    choices: [
      { label: 'Wynajmij dodatkowe odladzarki', description: 'Koszt sprzętu, niewielkie opóźnienia.', effects: { cash: negScaled(0.3, 0.5), hours: [36, 48], turnaround: 1.2 } },
      { label: 'Pracuj dostępnym sprzętem', effects: { hours: [36, 48], turnaround: [1.7, 1.9], demand: 0.9 } },
    ],
  },
  {
    id: 'inf_heatwave', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 4, target: 'region', cooldownH: 120,
    variants: [
      v('Fala upałów: {region}', 'W upale samoloty potrzebują więcej paliwa i dłuższej obsługi.'),
      v('Rekordowe temperatury w regionie {region}', 'Rozgrzane pasy startowe wymuszają ograniczenia masy startowej.'),
    ],
    effects: { hours: [48, 96], fuel: 1.08, turnaround: [1.12, 1.2] },
  },
  {
    id: 'inf_volcano', category: 'infrastructure', severity: 'critical', tone: 'bad', weight: 1, target: 'region', cooldownH: 600,
    condition: all(day(6), airports(4)),
    variants: [
      v('Erupcja wulkanu: {region}', 'Chmura pyłu wulkanicznego zamknęła przestrzeń powietrzną nad regionem {region}.'),
      v('Pył wulkaniczny nad regionem {region}', 'Popiół wulkaniczny zagraża silnikom. Wszystkie loty wstrzymane.'),
    ],
    effects: { closed: true, hours: [14, 24], reputation: 0 },
  },
  {
    id: 'inf_hurricane', category: 'infrastructure', severity: 'major', tone: 'bad', weight: 3, target: 'city', cooldownH: 240,
    condition: all(day(4), airports(3)),
    variants: [
      v('Huragan nad miastem {city}', 'Huragan zbliża się do miasta {city}. Lotnisko zostanie zamknięte na czas przejścia burzy.'),
      v('Tajfun: {city}', 'Służby meteorologiczne wydały najwyższy stopień ostrzeżenia dla miasta {city}.'),
      v('Powódź w mieście {city}', 'Rzeka wystąpiła z brzegów. Drogi do lotniska {city} są nieprzejezdne.'),
    ],
    effects: { closed: true, hours: [18, 30] },
  },
  {
    id: 'inf_atc_strike', category: 'infrastructure', severity: 'major', tone: 'bad', weight: 3, target: 'region', cooldownH: 240,
    condition: all(day(3), airports(3)),
    variants: [
      v('Strajk kontrolerów: {region}', 'Kontrolerzy ruchu lotniczego w regionie {region} ograniczyli pracę. Opóźnienia sięgają godzin.'),
      v('Spór płacowy w kontroli lotów', 'Kontrolerzy w regionie {region} prowadzą strajk włoski.'),
    ],
    choices: [
      { label: 'Odwołaj część lotów', description: 'Mniej lotów, ale pasażerowie poinformowani z wyprzedzeniem.', effects: { hours: [24, 36], turnaround: 1.8, reputation: 1 } },
      { label: 'Lataj mimo opóźnień', description: 'Wszystkie loty, ale ogromne opóźnienia i niezadowoleni pasażerowie.', effects: { hours: [24, 36], turnaround: 2.2, reputation: -3 } },
    ],
  },
  {
    id: 'inf_delays', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 5, target: 'global', cooldownH: 72,
    variants: [
      v('Opóźnienia w ruchu lotniczym', 'Przeciążone niebo — kontrola lotów wprowadza ograniczenia przepustowości.'),
      v('Awaria systemu planowania lotów', 'Centralny system kontroli przepływu ruchu działa z ograniczeniami.'),
      v('Ograniczenia lotów nocnych', 'Nowe przepisy hałasowe wydłużają obsługę na wielu lotniskach.'),
    ],
    effects: { hours: [18, 30], turnaround: [1.15, 1.3] },
  },
  {
    id: 'inf_it_outage', category: 'infrastructure', severity: 'major', tone: 'bad', weight: 3, target: 'global', cooldownH: 300,
    condition: all(planes(4), day(4)),
    variants: [
      v('Awaria systemów informatycznych', 'Globalna awaria oprogramowania sparaliżowała odprawy i rezerwacje. Pasażerowie czekają.'),
      v('Cyberatak na system rezerwacji', 'Hakerzy zablokowali Twój system rezerwacji. Odprawy odbywają się ręcznie.'),
    ],
    choices: [
      { label: 'Wypłać rekompensaty', description: 'Kosztowne, ale pasażerowie to docenią.', effects: { cash: negScaled(0.5, 0.7), hours: [10, 14], turnaround: 1.6, reputation: 2 } },
      { label: 'Bez rekompensat', effects: { hours: [10, 14], turnaround: 1.6, reputation: -5 } },
    ],
  },
  {
    id: 'inf_award', category: 'infrastructure', severity: 'minor', tone: 'good', weight: 4, target: 'global', cooldownH: 168,
    condition: (s) => s.totals.flights >= 40,
    variants: [
      v('Nagroda za punktualność', 'Twoja linia zdobyła wyróżnienie w rankingu punktualności.'),
      v('Nagroda za bezpieczeństwo', 'Niezależny audyt potwierdził najwyższe standardy bezpieczeństwa Twojej floty.'),
      v('Ranking zadowolenia pasażerów', 'Pasażerowie wybrali Twoją linię jedną z najlepszych w regionie.'),
    ],
    effects: { reputation: [4, 7] },
  },
  {
    id: 'inf_inspection', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 3, target: 'global', cooldownH: 168,
    condition: planes(3),
    variants: [
      v('Kontrola techniczna floty', 'Nadzór lotniczy zlecił dodatkowe przeglądy. Płacisz za nie z bieżącego budżetu.'),
      v('Wymiana części w całej flocie', 'Producent wezwał do wymiany wadliwego podzespołu.'),
    ],
    effects: { cash: (s) => -15_000 * Object.keys(s.planes).length },
  },
  {
    id: 'inf_bird', category: 'infrastructure', severity: 'minor', tone: 'bad', weight: 3, target: 'city', cooldownH: 96,
    variants: [
      v('Zderzenie z ptakami: {city}', 'Samolot po lądowaniu w mieście {city} wymaga przeglądu silnika.'),
      v('Uszkodzenie na płycie: {city}', 'Pojazd obsługi uszkodził samolot na lotnisku {city}.'),
    ],
    effects: { cash: negScaled(0.1, 0.2), hours: 12, turnaround: 1.3 },
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Łączna liczba wariantów tekstowych (do README i testów). */
export const EVENT_VARIANT_COUNT = EVENTS.reduce((a, e) => a + e.variants.length, 0);
