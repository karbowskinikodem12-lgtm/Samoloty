import type { CityDef } from '../engine/types';

/**
 * Miasta dostępne w grze. pop = populacja aglomeracji w milionach (wpływa na popyt
 * i koszt otwarcia lotniska). Współrzędne odpowiadają głównemu lotnisku.
 * Aby dodać miasto, wystarczy dopisać wpis — silnik i mapa obsłużą je automatycznie.
 */
export const CITIES: CityDef[] = [
  // Europa
  { id: 'london', name: 'Londyn', country: 'Wielka Brytania', code: 'LHR', region: 'europe', lat: 51.47, lon: -0.45, pop: 14.3 },
  { id: 'manchester', name: 'Manchester', country: 'Wielka Brytania', code: 'MAN', region: 'europe', lat: 53.35, lon: -2.27, pop: 2.8 },
  { id: 'dublin', name: 'Dublin', country: 'Irlandia', code: 'DUB', region: 'europe', lat: 53.42, lon: -6.27, pop: 2.0 },
  { id: 'paris', name: 'Paryż', country: 'Francja', code: 'CDG', region: 'europe', lat: 49.01, lon: 2.55, pop: 12.3 },
  { id: 'brussels', name: 'Bruksela', country: 'Belgia', code: 'BRU', region: 'europe', lat: 50.9, lon: 4.48, pop: 2.1 },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Holandia', code: 'AMS', region: 'europe', lat: 52.31, lon: 4.76, pop: 2.5 },
  { id: 'frankfurt', name: 'Frankfurt', country: 'Niemcy', code: 'FRA', region: 'europe', lat: 50.04, lon: 8.56, pop: 5.8 },
  { id: 'berlin', name: 'Berlin', country: 'Niemcy', code: 'BER', region: 'europe', lat: 52.37, lon: 13.5, pop: 4.6 },
  { id: 'munich', name: 'Monachium', country: 'Niemcy', code: 'MUC', region: 'europe', lat: 48.35, lon: 11.79, pop: 2.9 },
  { id: 'zurich', name: 'Zurych', country: 'Szwajcaria', code: 'ZRH', region: 'europe', lat: 47.46, lon: 8.55, pop: 1.4 },
  { id: 'madrid', name: 'Madryt', country: 'Hiszpania', code: 'MAD', region: 'europe', lat: 40.47, lon: -3.56, pop: 6.7 },
  { id: 'barcelona', name: 'Barcelona', country: 'Hiszpania', code: 'BCN', region: 'europe', lat: 41.3, lon: 2.08, pop: 5.6 },
  { id: 'lisbon', name: 'Lizbona', country: 'Portugalia', code: 'LIS', region: 'europe', lat: 38.77, lon: -9.13, pop: 2.9 },
  { id: 'rome', name: 'Rzym', country: 'Włochy', code: 'FCO', region: 'europe', lat: 41.8, lon: 12.25, pop: 4.3 },
  { id: 'milan', name: 'Mediolan', country: 'Włochy', code: 'MXP', region: 'europe', lat: 45.63, lon: 8.72, pop: 4.3 },
  { id: 'vienna', name: 'Wiedeń', country: 'Austria', code: 'VIE', region: 'europe', lat: 48.11, lon: 16.57, pop: 2.9 },
  { id: 'prague', name: 'Praga', country: 'Czechy', code: 'PRG', region: 'europe', lat: 50.1, lon: 14.26, pop: 2.2 },
  { id: 'warsaw', name: 'Warszawa', country: 'Polska', code: 'WAW', region: 'europe', lat: 52.17, lon: 20.97, pop: 3.1 },
  { id: 'krakow', name: 'Kraków', country: 'Polska', code: 'KRK', region: 'europe', lat: 50.08, lon: 19.78, pop: 1.4 },
  { id: 'gdansk', name: 'Gdańsk', country: 'Polska', code: 'GDN', region: 'europe', lat: 54.38, lon: 18.47, pop: 1.1 },
  { id: 'budapest', name: 'Budapeszt', country: 'Węgry', code: 'BUD', region: 'europe', lat: 47.44, lon: 19.26, pop: 3.0 },
  { id: 'bucharest', name: 'Bukareszt', country: 'Rumunia', code: 'OTP', region: 'europe', lat: 44.57, lon: 26.08, pop: 2.3 },
  { id: 'athens', name: 'Ateny', country: 'Grecja', code: 'ATH', region: 'europe', lat: 37.94, lon: 23.94, pop: 3.6 },
  { id: 'istanbul', name: 'Stambuł', country: 'Turcja', code: 'IST', region: 'europe', lat: 41.26, lon: 28.74, pop: 15.6 },
  { id: 'copenhagen', name: 'Kopenhaga', country: 'Dania', code: 'CPH', region: 'europe', lat: 55.62, lon: 12.65, pop: 2.1 },
  { id: 'oslo', name: 'Oslo', country: 'Norwegia', code: 'OSL', region: 'europe', lat: 60.19, lon: 11.1, pop: 1.6 },
  { id: 'stockholm', name: 'Sztokholm', country: 'Szwecja', code: 'ARN', region: 'europe', lat: 59.65, lon: 17.92, pop: 2.4 },
  { id: 'helsinki', name: 'Helsinki', country: 'Finlandia', code: 'HEL', region: 'europe', lat: 60.32, lon: 24.96, pop: 1.5 },

  // Ameryka Północna
  { id: 'new_york', name: 'Nowy Jork', country: 'USA', code: 'JFK', region: 'north_america', lat: 40.64, lon: -73.78, pop: 19.5 },
  { id: 'boston', name: 'Boston', country: 'USA', code: 'BOS', region: 'north_america', lat: 42.36, lon: -71.01, pop: 4.9 },
  { id: 'washington', name: 'Waszyngton', country: 'USA', code: 'IAD', region: 'north_america', lat: 38.95, lon: -77.46, pop: 6.3 },
  { id: 'toronto', name: 'Toronto', country: 'Kanada', code: 'YYZ', region: 'north_america', lat: 43.68, lon: -79.63, pop: 6.4 },
  { id: 'montreal', name: 'Montreal', country: 'Kanada', code: 'YUL', region: 'north_america', lat: 45.47, lon: -73.74, pop: 4.3 },
  { id: 'chicago', name: 'Chicago', country: 'USA', code: 'ORD', region: 'north_america', lat: 41.98, lon: -87.9, pop: 9.4 },
  { id: 'atlanta', name: 'Atlanta', country: 'USA', code: 'ATL', region: 'north_america', lat: 33.64, lon: -84.43, pop: 6.1 },
  { id: 'miami', name: 'Miami', country: 'USA', code: 'MIA', region: 'north_america', lat: 25.79, lon: -80.29, pop: 6.1 },
  { id: 'dallas', name: 'Dallas', country: 'USA', code: 'DFW', region: 'north_america', lat: 32.9, lon: -97.04, pop: 7.6 },
  { id: 'denver', name: 'Denver', country: 'USA', code: 'DEN', region: 'north_america', lat: 39.86, lon: -104.67, pop: 2.9 },
  { id: 'los_angeles', name: 'Los Angeles', country: 'USA', code: 'LAX', region: 'north_america', lat: 33.94, lon: -118.41, pop: 12.9 },
  { id: 'san_francisco', name: 'San Francisco', country: 'USA', code: 'SFO', region: 'north_america', lat: 37.62, lon: -122.38, pop: 4.7 },
  { id: 'seattle', name: 'Seattle', country: 'USA', code: 'SEA', region: 'north_america', lat: 47.45, lon: -122.31, pop: 4.0 },
  { id: 'vancouver', name: 'Vancouver', country: 'Kanada', code: 'YVR', region: 'north_america', lat: 49.19, lon: -123.18, pop: 2.6 },
  { id: 'mexico_city', name: 'Meksyk', country: 'Meksyk', code: 'MEX', region: 'north_america', lat: 19.44, lon: -99.07, pop: 21.8 },

  // Ameryka Południowa
  { id: 'bogota', name: 'Bogota', country: 'Kolumbia', code: 'BOG', region: 'south_america', lat: 4.7, lon: -74.15, pop: 11.3 },
  { id: 'lima', name: 'Lima', country: 'Peru', code: 'LIM', region: 'south_america', lat: -12.02, lon: -77.11, pop: 10.9 },
  { id: 'santiago', name: 'Santiago', country: 'Chile', code: 'SCL', region: 'south_america', lat: -33.39, lon: -70.79, pop: 6.8 },
  { id: 'buenos_aires', name: 'Buenos Aires', country: 'Argentyna', code: 'EZE', region: 'south_america', lat: -34.82, lon: -58.54, pop: 15.4 },
  { id: 'sao_paulo', name: 'São Paulo', country: 'Brazylia', code: 'GRU', region: 'south_america', lat: -23.43, lon: -46.47, pop: 22.4 },
  { id: 'rio', name: 'Rio de Janeiro', country: 'Brazylia', code: 'GIG', region: 'south_america', lat: -22.81, lon: -43.25, pop: 13.5 },

  // Bliski Wschód
  { id: 'tel_aviv', name: 'Tel Awiw', country: 'Izrael', code: 'TLV', region: 'middle_east', lat: 32.01, lon: 34.89, pop: 4.2 },
  { id: 'jeddah', name: 'Dżudda', country: 'Arabia Saudyjska', code: 'JED', region: 'middle_east', lat: 21.68, lon: 39.16, pop: 4.7 },
  { id: 'riyadh', name: 'Rijad', country: 'Arabia Saudyjska', code: 'RUH', region: 'middle_east', lat: 24.96, lon: 46.7, pop: 7.7 },
  { id: 'doha', name: 'Doha', country: 'Katar', code: 'DOH', region: 'middle_east', lat: 25.27, lon: 51.61, pop: 2.4 },
  { id: 'abu_dhabi', name: 'Abu Zabi', country: 'ZEA', code: 'AUH', region: 'middle_east', lat: 24.43, lon: 54.65, pop: 1.5 },
  { id: 'dubai', name: 'Dubaj', country: 'ZEA', code: 'DXB', region: 'middle_east', lat: 25.25, lon: 55.36, pop: 3.5 },
  { id: 'muscat', name: 'Maskat', country: 'Oman', code: 'MCT', region: 'middle_east', lat: 23.59, lon: 58.28, pop: 1.6 },

  // Afryka
  { id: 'casablanca', name: 'Casablanca', country: 'Maroko', code: 'CMN', region: 'africa', lat: 33.37, lon: -7.59, pop: 3.8 },
  { id: 'cairo', name: 'Kair', country: 'Egipt', code: 'CAI', region: 'africa', lat: 30.12, lon: 31.41, pop: 21.3 },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', code: 'LOS', region: 'africa', lat: 6.58, lon: 3.32, pop: 15.4 },
  { id: 'accra', name: 'Akra', country: 'Ghana', code: 'ACC', region: 'africa', lat: 5.61, lon: -0.17, pop: 2.6 },
  { id: 'addis_ababa', name: 'Addis Abeba', country: 'Etiopia', code: 'ADD', region: 'africa', lat: 8.98, lon: 38.8, pop: 5.2 },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenia', code: 'NBO', region: 'africa', lat: -1.32, lon: 36.93, pop: 5.1 },
  { id: 'johannesburg', name: 'Johannesburg', country: 'RPA', code: 'JNB', region: 'africa', lat: -26.14, lon: 28.25, pop: 10.0 },
  { id: 'cape_town', name: 'Kapsztad', country: 'RPA', code: 'CPT', region: 'africa', lat: -33.97, lon: 18.6, pop: 4.8 },

  // Azja
  { id: 'delhi', name: 'Delhi', country: 'Indie', code: 'DEL', region: 'asia', lat: 28.56, lon: 77.1, pop: 32.9 },
  { id: 'mumbai', name: 'Mumbaj', country: 'Indie', code: 'BOM', region: 'asia', lat: 19.09, lon: 72.87, pop: 21.3 },
  { id: 'bangkok', name: 'Bangkok', country: 'Tajlandia', code: 'BKK', region: 'asia', lat: 13.69, lon: 100.75, pop: 11.2 },
  { id: 'kuala_lumpur', name: 'Kuala Lumpur', country: 'Malezja', code: 'KUL', region: 'asia', lat: 2.74, lon: 101.71, pop: 8.4 },
  { id: 'singapore', name: 'Singapur', country: 'Singapur', code: 'SIN', region: 'asia', lat: 1.36, lon: 103.99, pop: 6.0 },
  { id: 'jakarta', name: 'Dżakarta', country: 'Indonezja', code: 'CGK', region: 'asia', lat: -6.13, lon: 106.66, pop: 11.2 },
  { id: 'manila', name: 'Manila', country: 'Filipiny', code: 'MNL', region: 'asia', lat: 14.51, lon: 121.02, pop: 14.4 },
  { id: 'hong_kong', name: 'Hongkong', country: 'Chiny', code: 'HKG', region: 'asia', lat: 22.31, lon: 113.91, pop: 7.5 },
  { id: 'taipei', name: 'Tajpej', country: 'Tajwan', code: 'TPE', region: 'asia', lat: 25.08, lon: 121.23, pop: 7.0 },
  { id: 'shanghai', name: 'Szanghaj', country: 'Chiny', code: 'PVG', region: 'asia', lat: 31.14, lon: 121.81, pop: 28.5 },
  { id: 'beijing', name: 'Pekin', country: 'Chiny', code: 'PEK', region: 'asia', lat: 40.08, lon: 116.58, pop: 21.5 },
  { id: 'seoul', name: 'Seul', country: 'Korea Płd.', code: 'ICN', region: 'asia', lat: 37.46, lon: 126.44, pop: 25.5 },
  { id: 'osaka', name: 'Osaka', country: 'Japonia', code: 'KIX', region: 'asia', lat: 34.43, lon: 135.23, pop: 19.0 },
  { id: 'tokyo', name: 'Tokio', country: 'Japonia', code: 'HND', region: 'asia', lat: 35.55, lon: 139.78, pop: 37.2 },

  // Oceania
  { id: 'perth', name: 'Perth', country: 'Australia', code: 'PER', region: 'oceania', lat: -31.94, lon: 115.97, pop: 2.2 },
  { id: 'brisbane', name: 'Brisbane', country: 'Australia', code: 'BNE', region: 'oceania', lat: -27.38, lon: 153.12, pop: 2.6 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', code: 'SYD', region: 'oceania', lat: -33.95, lon: 151.18, pop: 5.4 },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', code: 'MEL', region: 'oceania', lat: -37.67, lon: 144.84, pop: 5.2 },
  { id: 'auckland', name: 'Auckland', country: 'Nowa Zelandia', code: 'AKL', region: 'oceania', lat: -37.01, lon: 174.79, pop: 1.7 },
];

export const CITY_BY_ID: Record<string, CityDef> = Object.fromEntries(CITIES.map((c) => [c.id, c]));

/** Miasta, z których gracz może rozpocząć grę (duże regiony z wieloma połączeniami w zasięgu). */
export const START_CITIES = ['warsaw', 'london', 'frankfurt', 'madrid', 'new_york', 'chicago', 'singapore', 'tokyo'];
