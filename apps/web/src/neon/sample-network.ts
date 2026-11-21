import type { RoutePoint } from "@keepraw-fly/core";

export interface NeonAirport extends RoutePoint {
  name: string;
  city: string;
}

export interface NeonRoute {
  id: string;
  origin: NeonAirport;
  destination: NeonAirport;
  count: number;
}

export const NEON_AIRPORTS: NeonAirport[] = [
  {
    iata: "TPE",
    name: "Taiwan Taoyuan",
    city: "Taipei",
    latitude: 25.0797,
    longitude: 121.2342,
  },
  {
    iata: "LAX",
    name: "Los Angeles International",
    city: "Los Angeles",
    latitude: 33.9416,
    longitude: -118.4085,
  },
  {
    iata: "PVG",
    name: "Shanghai Pudong",
    city: "Shanghai",
    latitude: 31.1443,
    longitude: 121.8083,
  },
  {
    iata: "CDG",
    name: "Charles de Gaulle",
    city: "Paris",
    latitude: 49.0097,
    longitude: 2.5479,
  },
  {
    iata: "NRT",
    name: "Narita International",
    city: "Tokyo",
    latitude: 35.772,
    longitude: 140.3929,
  },
  {
    iata: "ICN",
    name: "Incheon International",
    city: "Seoul",
    latitude: 37.4602,
    longitude: 126.4407,
  },
  {
    iata: "HKG",
    name: "Hong Kong International",
    city: "Hong Kong",
    latitude: 22.308,
    longitude: 113.9185,
  },
  {
    iata: "SIN",
    name: "Singapore Changi",
    city: "Singapore",
    latitude: 1.3644,
    longitude: 103.9915,
  },
  {
    iata: "BKK",
    name: "Suvarnabhumi",
    city: "Bangkok",
    latitude: 13.69,
    longitude: 100.7501,
  },
  {
    iata: "KUL",
    name: "Kuala Lumpur International",
    city: "Kuala Lumpur",
    latitude: 2.7456,
    longitude: 101.7072,
  },
  {
    iata: "DEL",
    name: "Indira Gandhi International",
    city: "Delhi",
    latitude: 28.5562,
    longitude: 77.1,
  },
  {
    iata: "BOM",
    name: "Chhatrapati Shivaji Maharaj",
    city: "Mumbai",
    latitude: 19.0896,
    longitude: 72.8656,
  },
  {
    iata: "DXB",
    name: "Dubai International",
    city: "Dubai",
    latitude: 25.2532,
    longitude: 55.3657,
  },
  {
    iata: "DOH",
    name: "Hamad International",
    city: "Doha",
    latitude: 25.2731,
    longitude: 51.6081,
  },
  {
    iata: "IST",
    name: "Istanbul Airport",
    city: "Istanbul",
    latitude: 41.2753,
    longitude: 28.7519,
  },
  {
    iata: "LHR",
    name: "Heathrow",
    city: "London",
    latitude: 51.47,
    longitude: -0.4543,
  },
  {
    iata: "AMS",
    name: "Amsterdam Schiphol",
    city: "Amsterdam",
    latitude: 52.3105,
    longitude: 4.7683,
  },
  {
    iata: "FRA",
    name: "Frankfurt Airport",
    city: "Frankfurt",
    latitude: 50.0379,
    longitude: 8.5622,
  },
  {
    iata: "MAD",
    name: "Adolfo Suárez Madrid–Barajas",
    city: "Madrid",
    latitude: 40.4983,
    longitude: -3.5676,
  },
  {
    iata: "FCO",
    name: "Leonardo da Vinci–Fiumicino",
    city: "Rome",
    latitude: 41.8003,
    longitude: 12.2389,
  },
  {
    iata: "ZRH",
    name: "Zurich Airport",
    city: "Zurich",
    latitude: 47.4581,
    longitude: 8.5555,
  },
  {
    iata: "SFO",
    name: "San Francisco International",
    city: "San Francisco",
    latitude: 37.6213,
    longitude: -122.379,
  },
  {
    iata: "JFK",
    name: "John F. Kennedy International",
    city: "New York",
    latitude: 40.6413,
    longitude: -73.7781,
  },
  {
    iata: "SEA",
    name: "Seattle–Tacoma International",
    city: "Seattle",
    latitude: 47.4502,
    longitude: -122.3088,
  },
  {
    iata: "ORD",
    name: "O'Hare International",
    city: "Chicago",
    latitude: 41.9742,
    longitude: -87.9073,
  },
  {
    iata: "ATL",
    name: "Hartsfield–Jackson Atlanta",
    city: "Atlanta",
    latitude: 33.6407,
    longitude: -84.4277,
  },
  {
    iata: "MIA",
    name: "Miami International",
    city: "Miami",
    latitude: 25.7959,
    longitude: -80.287,
  },
  {
    iata: "YYZ",
    name: "Toronto Pearson",
    city: "Toronto",
    latitude: 43.6777,
    longitude: -79.6248,
  },
  {
    iata: "YVR",
    name: "Vancouver International",
    city: "Vancouver",
    latitude: 49.1947,
    longitude: -123.1792,
  },
  {
    iata: "GRU",
    name: "São Paulo–Guarulhos",
    city: "São Paulo",
    latitude: -23.4356,
    longitude: -46.4731,
  },
  {
    iata: "EZE",
    name: "Ministro Pistarini",
    city: "Buenos Aires",
    latitude: -34.8222,
    longitude: -58.5358,
  },
  {
    iata: "CPT",
    name: "Cape Town International",
    city: "Cape Town",
    latitude: -33.97,
    longitude: 18.5972,
  },
  {
    iata: "JNB",
    name: "O. R. Tambo International",
    city: "Johannesburg",
    latitude: -26.1367,
    longitude: 28.2411,
  },
  {
    iata: "NBO",
    name: "Jomo Kenyatta International",
    city: "Nairobi",
    latitude: -1.3192,
    longitude: 36.9278,
  },
  {
    iata: "SYD",
    name: "Sydney Kingsford Smith",
    city: "Sydney",
    latitude: -33.9399,
    longitude: 151.1753,
  },
  {
    iata: "MEL",
    name: "Melbourne Airport",
    city: "Melbourne",
    latitude: -37.669,
    longitude: 144.841,
  },
  {
    iata: "AKL",
    name: "Auckland Airport",
    city: "Auckland",
    latitude: -37.0082,
    longitude: 174.785,
  },
  {
    iata: "PER",
    name: "Perth Airport",
    city: "Perth",
    latitude: -31.9403,
    longitude: 115.9672,
  },
  {
    iata: "HNL",
    name: "Daniel K. Inouye International",
    city: "Honolulu",
    latitude: 21.3187,
    longitude: -157.9225,
  },
  {
    iata: "SCL",
    name: "Arturo Merino Benítez",
    city: "Santiago",
    latitude: -33.393,
    longitude: -70.7858,
  },
  {
    iata: "MEX",
    name: "Mexico City International",
    city: "Mexico City",
    latitude: 19.4363,
    longitude: -99.0721,
  },
  {
    iata: "LIS",
    name: "Humberto Delgado",
    city: "Lisbon",
    latitude: 38.7742,
    longitude: -9.1342,
  },
  {
    iata: "HEL",
    name: "Helsinki Airport",
    city: "Helsinki",
    latitude: 60.3172,
    longitude: 24.9633,
  },
  {
    iata: "ARN",
    name: "Stockholm Arlanda",
    city: "Stockholm",
    latitude: 59.6519,
    longitude: 17.9186,
  },
  {
    iata: "ATH",
    name: "Athens International",
    city: "Athens",
    latitude: 37.9364,
    longitude: 23.9445,
  },
];

const airportByCode = new Map(
  NEON_AIRPORTS.map((airport) => [airport.iata, airport]),
);

function makeRoute(from: string, to: string, count: number): NeonRoute {
  const origin = airportByCode.get(from);
  const destination = airportByCode.get(to);
  if (!origin || !destination)
    throw new Error(`Unknown sample route ${from}-${to}.`);
  return {
    id: `${from}-${to}`,
    origin,
    destination,
    count,
  };
}

export const SPARSE_ROUTES: NeonRoute[] = [
  makeRoute("TPE", "HKG", 8),
  makeRoute("TPE", "PVG", 12),
  makeRoute("TPE", "NRT", 9),
  makeRoute("HKG", "SIN", 6),
  makeRoute("PVG", "CDG", 5),
  makeRoute("ICN", "FRA", 4),
  makeRoute("SIN", "LHR", 3),
  makeRoute("BKK", "IST", 2),
];

function seededRoutes(): NeonRoute[] {
  let seed = 0x5eed1234;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const routes = new Map<string, NeonRoute>();
  const add = (fromIndex: number, toIndex: number, count: number) => {
    const from = NEON_AIRPORTS[fromIndex]!;
    const to = NEON_AIRPORTS[toIndex]!;
    if (from.iata === to.iata) return;
    const [origin, destination] = from.iata < to.iata ? [from, to] : [to, from];
    const id = `${origin.iata}-${destination.iata}`;
    if (!routes.has(id))
      routes.set(id, makeRoute(origin.iata, destination.iata, count));
  };
  for (let index = 0; index < NEON_AIRPORTS.length; index += 1) {
    add(
      index,
      (index + 13) % NEON_AIRPORTS.length,
      1 + Math.floor(random() * 18),
    );
  }
  while (routes.size < 140) {
    const from = Math.floor(random() * NEON_AIRPORTS.length);
    let to = Math.floor(random() * NEON_AIRPORTS.length);
    if (to === from) to = (to + 1) % NEON_AIRPORTS.length;
    add(from, to, 1 + Math.floor(random() * 18));
  }
  return [...routes.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export const DENSE_ROUTES = seededRoutes();

export const NEON_PASSPORT_STATS = {
  flights: 87,
  distanceKm: 152_318,
  flightTime: "9d 14h",
  airports: 41,
  airlines: 19,
} as const;
