// The place the prayer times are worked out for, and the built-in list of capital cities.

export type PlaceSource = 'location' | 'city' | 'coordinates';

export type Place = {
  /** Shown on the home page, in Settings and on the Qibla page. */
  name: string;
  /** Degrees: north and east are positive. */
  latitude: number;
  longitude: number;
  /** How it was chosen: the phone's position, the city list, or typed in. */
  source: PlaceSource;
};

export type City = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Other words that should find it in the search. */
  also?: string;
};

/** Is this a usable place (from storage or from the user)? */
export function cleanPlace(raw: unknown): Place | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Place>;
  const { latitude, longitude } = p;
  if (!isLatitude(latitude) || !isLongitude(longitude)) return null;
  const source: PlaceSource = p.source === 'location' || p.source === 'coordinates' ? p.source : 'city';
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 80) : 'My place';
  return { name, latitude, longitude, source };
}

export function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

/** "24.45° N, 54.38° E". */
export function coordinatesText(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat}, ${lon}`;
}

/** "Abu Dhabi, United Arab Emirates". */
export function cityPlaceName(city: City): string {
  return city.country ? `${city.name}, ${city.country}` : city.name;
}

function simple(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Cities whose name, country or other names contain every word typed. */
export function searchCities(query: string): City[] {
  const words = simple(query).split(' ').filter(Boolean);
  if (words.length === 0) return CAPITALS;
  return CAPITALS.filter((city) => {
    const text = ` ${simple(`${city.name} ${city.country} ${city.also ?? ''}`)}`;
    return words.every((word) => text.includes(` ${word}`));
  });
}

function c(name: string, country: string, latitude: number, longitude: number, also?: string): City {
  return { name, country, latitude, longitude, also };
}

/** The capital of every country (a few countries have two), sorted by city name. */
export const CAPITALS: City[] = [
  c('Kabul', 'Afghanistan', 34.53, 69.17),
  c('Tirana', 'Albania', 41.33, 19.82),
  c('Algiers', 'Algeria', 36.75, 3.06, 'alger'),
  c('Andorra la Vella', 'Andorra', 42.51, 1.52),
  c('Luanda', 'Angola', -8.84, 13.23),
  c("Saint John's", 'Antigua and Barbuda', 17.12, -61.85),
  c('Buenos Aires', 'Argentina', -34.6, -58.38),
  c('Yerevan', 'Armenia', 40.18, 44.51),
  c('Canberra', 'Australia', -35.28, 149.13),
  c('Vienna', 'Austria', 48.21, 16.37, 'wien'),
  c('Baku', 'Azerbaijan', 40.41, 49.87),
  c('Nassau', 'Bahamas', 25.05, -77.35),
  c('Manama', 'Bahrain', 26.23, 50.59),
  c('Dhaka', 'Bangladesh', 23.81, 90.41, 'dacca'),
  c('Bridgetown', 'Barbados', 13.1, -59.62),
  c('Minsk', 'Belarus', 53.9, 27.57),
  c('Brussels', 'Belgium', 50.85, 4.35, 'bruxelles brussel'),
  c('Belmopan', 'Belize', 17.25, -88.77),
  c('Porto-Novo', 'Benin', 6.5, 2.6),
  c('Thimphu', 'Bhutan', 27.47, 89.64),
  c('La Paz', 'Bolivia', -16.5, -68.15),
  c('Sucre', 'Bolivia', -19.04, -65.26),
  c('Sarajevo', 'Bosnia and Herzegovina', 43.86, 18.41),
  c('Gaborone', 'Botswana', -24.65, 25.91),
  c('Brasilia', 'Brazil', -15.79, -47.88, 'brasil'),
  c('Bandar Seri Begawan', 'Brunei', 4.9, 114.94),
  c('Sofia', 'Bulgaria', 42.7, 23.32),
  c('Ouagadougou', 'Burkina Faso', 12.37, -1.52),
  c('Gitega', 'Burundi', -3.43, 29.92),
  c('Praia', 'Cabo Verde', 14.93, -23.51, 'cape verde'),
  c('Phnom Penh', 'Cambodia', 11.56, 104.92),
  c('Yaounde', 'Cameroon', 3.85, 11.5),
  c('Ottawa', 'Canada', 45.42, -75.7),
  c('Bangui', 'Central African Republic', 4.39, 18.56),
  c("N'Djamena", 'Chad', 12.13, 15.06, 'ndjamena'),
  c('Santiago', 'Chile', -33.45, -70.67),
  c('Beijing', 'China', 39.9, 116.41, 'peking'),
  c('Bogota', 'Colombia', 4.71, -74.07),
  c('Moroni', 'Comoros', -11.7, 43.26),
  c('Brazzaville', 'Congo', -4.27, 15.28),
  c('Kinshasa', 'Congo (DR)', -4.44, 15.27, 'democratic republic drc zaire'),
  c('San Jose', 'Costa Rica', 9.93, -84.08),
  c('Yamoussoukro', "Cote d'Ivoire", 6.83, -5.29, 'ivory coast'),
  c('Zagreb', 'Croatia', 45.81, 15.98),
  c('Havana', 'Cuba', 23.11, -82.37),
  c('Nicosia', 'Cyprus', 35.19, 33.38),
  c('Prague', 'Czechia', 50.08, 14.44, 'czech republic praha'),
  c('Copenhagen', 'Denmark', 55.68, 12.57),
  c('Djibouti', 'Djibouti', 11.59, 43.15),
  c('Roseau', 'Dominica', 15.3, -61.39),
  c('Santo Domingo', 'Dominican Republic', 18.49, -69.93),
  c('Quito', 'Ecuador', -0.18, -78.47),
  c('Cairo', 'Egypt', 30.04, 31.24, 'misr qahira'),
  c('San Salvador', 'El Salvador', 13.69, -89.22),
  c('Malabo', 'Equatorial Guinea', 3.75, 8.78),
  c('Asmara', 'Eritrea', 15.32, 38.93),
  c('Tallinn', 'Estonia', 59.44, 24.75),
  c('Mbabane', 'Eswatini', -26.31, 31.14, 'swaziland'),
  c('Addis Ababa', 'Ethiopia', 9.03, 38.74),
  c('Suva', 'Fiji', -18.14, 178.44),
  c('Helsinki', 'Finland', 60.17, 24.94),
  c('Paris', 'France', 48.86, 2.35),
  c('Libreville', 'Gabon', 0.42, 9.47),
  c('Banjul', 'Gambia', 13.45, -16.58),
  c('Tbilisi', 'Georgia', 41.72, 44.79),
  c('Berlin', 'Germany', 52.52, 13.4, 'deutschland'),
  c('Accra', 'Ghana', 5.6, -0.19),
  c('Athens', 'Greece', 37.98, 23.73),
  c("Saint George's", 'Grenada', 12.06, -61.75),
  c('Guatemala City', 'Guatemala', 14.63, -90.51),
  c('Conakry', 'Guinea', 9.64, -13.58),
  c('Bissau', 'Guinea-Bissau', 11.86, -15.6),
  c('Georgetown', 'Guyana', 6.8, -58.16),
  c('Port-au-Prince', 'Haiti', 18.59, -72.31),
  c('Tegucigalpa', 'Honduras', 14.07, -87.19),
  c('Budapest', 'Hungary', 47.5, 19.04),
  c('Reykjavik', 'Iceland', 64.15, -21.94),
  c('New Delhi', 'India', 28.61, 77.21, 'delhi'),
  c('Jakarta', 'Indonesia', -6.21, 106.85),
  c('Tehran', 'Iran', 35.69, 51.39),
  c('Baghdad', 'Iraq', 33.32, 44.37),
  c('Dublin', 'Ireland', 53.35, -6.26),
  c('Jerusalem (Al-Quds)', '', 31.78, 35.23, 'quds palestine israel'),
  c('Rome', 'Italy', 41.9, 12.5, 'roma'),
  c('Kingston', 'Jamaica', 18.02, -76.8),
  c('Tokyo', 'Japan', 35.68, 139.69),
  c('Amman', 'Jordan', 31.95, 35.93),
  c('Astana', 'Kazakhstan', 51.17, 71.45, 'nur sultan'),
  c('Nairobi', 'Kenya', -1.29, 36.82),
  c('Tarawa', 'Kiribati', 1.33, 172.98),
  c('Pristina', 'Kosovo', 42.66, 21.17),
  c('Kuwait City', 'Kuwait', 29.38, 47.99),
  c('Bishkek', 'Kyrgyzstan', 42.87, 74.59),
  c('Vientiane', 'Laos', 17.98, 102.63),
  c('Riga', 'Latvia', 56.95, 24.11),
  c('Beirut', 'Lebanon', 33.89, 35.5),
  c('Maseru', 'Lesotho', -29.31, 27.48),
  c('Monrovia', 'Liberia', 6.3, -10.8),
  c('Tripoli', 'Libya', 32.89, 13.19),
  c('Vaduz', 'Liechtenstein', 47.14, 9.52),
  c('Vilnius', 'Lithuania', 54.69, 25.28),
  c('Luxembourg', 'Luxembourg', 49.61, 6.13),
  c('Antananarivo', 'Madagascar', -18.88, 47.51),
  c('Lilongwe', 'Malawi', -13.96, 33.79),
  c('Kuala Lumpur', 'Malaysia', 3.14, 101.69),
  c('Putrajaya', 'Malaysia', 2.93, 101.69),
  c('Male', 'Maldives', 4.18, 73.51),
  c('Bamako', 'Mali', 12.64, -8.0),
  c('Valletta', 'Malta', 35.9, 14.51),
  c('Majuro', 'Marshall Islands', 7.09, 171.38),
  c('Nouakchott', 'Mauritania', 18.08, -15.98),
  c('Port Louis', 'Mauritius', -20.16, 57.5),
  c('Mexico City', 'Mexico', 19.43, -99.13),
  c('Palikir', 'Micronesia', 6.92, 158.16),
  c('Chisinau', 'Moldova', 47.01, 28.86),
  c('Monaco', 'Monaco', 43.74, 7.42),
  c('Ulaanbaatar', 'Mongolia', 47.89, 106.91, 'ulan bator'),
  c('Podgorica', 'Montenegro', 42.44, 19.26),
  c('Rabat', 'Morocco', 34.02, -6.83, 'maroc'),
  c('Maputo', 'Mozambique', -25.97, 32.57),
  c('Naypyidaw', 'Myanmar', 19.76, 96.08, 'burma'),
  c('Windhoek', 'Namibia', -22.56, 17.08),
  c('Yaren', 'Nauru', -0.55, 166.92),
  c('Kathmandu', 'Nepal', 27.72, 85.32),
  c('Amsterdam', 'Netherlands', 52.37, 4.9, 'holland'),
  c('Wellington', 'New Zealand', -41.29, 174.78),
  c('Managua', 'Nicaragua', 12.11, -86.24),
  c('Niamey', 'Niger', 13.51, 2.13),
  c('Abuja', 'Nigeria', 9.08, 7.4),
  c('Pyongyang', 'North Korea', 39.04, 125.76),
  c('Skopje', 'North Macedonia', 42.0, 21.43, 'macedonia'),
  c('Oslo', 'Norway', 59.91, 10.75),
  c('Muscat', 'Oman', 23.59, 58.41, 'masqat'),
  c('Islamabad', 'Pakistan', 33.68, 73.05),
  c('Ngerulmud', 'Palau', 7.5, 134.62),
  c('Panama City', 'Panama', 8.98, -79.52),
  c('Port Moresby', 'Papua New Guinea', -9.44, 147.18),
  c('Asuncion', 'Paraguay', -25.26, -57.58),
  c('Lima', 'Peru', -12.05, -77.04),
  c('Manila', 'Philippines', 14.6, 120.98),
  c('Warsaw', 'Poland', 52.23, 21.01, 'warszawa'),
  c('Lisbon', 'Portugal', 38.72, -9.14, 'lisboa'),
  c('Doha', 'Qatar', 25.29, 51.53),
  c('Bucharest', 'Romania', 44.43, 26.1),
  c('Moscow', 'Russia', 55.76, 37.62, 'moskva'),
  c('Kigali', 'Rwanda', -1.94, 30.06),
  c('Basseterre', 'Saint Kitts and Nevis', 17.3, -62.72),
  c('Castries', 'Saint Lucia', 14.01, -60.99),
  c('Kingstown', 'Saint Vincent and the Grenadines', 13.16, -61.22),
  c('Apia', 'Samoa', -13.83, -171.76),
  c('San Marino', 'San Marino', 43.94, 12.45),
  c('Sao Tome', 'Sao Tome and Principe', 0.34, 6.73),
  c('Riyadh', 'Saudi Arabia', 24.71, 46.68, 'ksa'),
  c('Dakar', 'Senegal', 14.72, -17.47),
  c('Belgrade', 'Serbia', 44.79, 20.45, 'beograd'),
  c('Victoria', 'Seychelles', -4.62, 55.45),
  c('Freetown', 'Sierra Leone', 8.48, -13.23),
  c('Singapore', 'Singapore', 1.29, 103.85),
  c('Bratislava', 'Slovakia', 48.15, 17.11),
  c('Ljubljana', 'Slovenia', 46.06, 14.51),
  c('Honiara', 'Solomon Islands', -9.43, 159.95),
  c('Mogadishu', 'Somalia', 2.05, 45.32),
  c('Pretoria', 'South Africa', -25.75, 28.19),
  c('Cape Town', 'South Africa', -33.92, 18.42),
  c('Seoul', 'South Korea', 37.57, 126.98, 'korea'),
  c('Juba', 'South Sudan', 4.85, 31.58),
  c('Madrid', 'Spain', 40.42, -3.7, 'espana'),
  c('Sri Jayawardenepura Kotte', 'Sri Lanka', 6.89, 79.92, 'kotte'),
  c('Colombo', 'Sri Lanka', 6.93, 79.86),
  c('Khartoum', 'Sudan', 15.5, 32.56),
  c('Paramaribo', 'Suriname', 5.85, -55.2),
  c('Stockholm', 'Sweden', 59.33, 18.07),
  c('Bern', 'Switzerland', 46.95, 7.45, 'berne'),
  c('Damascus', 'Syria', 33.51, 36.29, 'dimashq sham'),
  c('Taipei', 'Taiwan', 25.03, 121.57),
  c('Dushanbe', 'Tajikistan', 38.56, 68.79),
  c('Dodoma', 'Tanzania', -6.16, 35.75),
  c('Dar es Salaam', 'Tanzania', -6.79, 39.21),
  c('Bangkok', 'Thailand', 13.76, 100.5),
  c('Dili', 'Timor-Leste', -8.56, 125.57, 'east timor'),
  c('Lome', 'Togo', 6.13, 1.22),
  c("Nuku'alofa", 'Tonga', -21.14, -175.2, 'nukualofa'),
  c('Port of Spain', 'Trinidad and Tobago', 10.66, -61.51),
  c('Tunis', 'Tunisia', 36.81, 10.18),
  c('Ankara', 'Turkiye', 39.93, 32.86, 'turkey'),
  c('Ashgabat', 'Turkmenistan', 37.96, 58.33),
  c('Funafuti', 'Tuvalu', -8.52, 179.2),
  c('Kampala', 'Uganda', 0.35, 32.58),
  c('Kyiv', 'Ukraine', 50.45, 30.52, 'kiev'),
  c('Abu Dhabi', 'United Arab Emirates', 24.45, 54.38, 'uae emirates'),
  c('London', 'United Kingdom', 51.51, -0.13, 'uk britain england'),
  c('Washington, D.C.', 'United States', 38.91, -77.04, 'usa america dc'),
  c('Montevideo', 'Uruguay', -34.9, -56.16),
  c('Tashkent', 'Uzbekistan', 41.3, 69.24),
  c('Port Vila', 'Vanuatu', -17.73, 168.32),
  c('Vatican City', 'Vatican City', 41.9, 12.45, 'holy see'),
  c('Caracas', 'Venezuela', 10.48, -66.9),
  c('Hanoi', 'Vietnam', 21.03, 105.85, 'viet nam'),
  c("Sana'a", 'Yemen', 15.37, 44.19, 'sanaa'),
  c('Lusaka', 'Zambia', -15.39, 28.32),
  c('Harare', 'Zimbabwe', -17.83, 31.05),
].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
