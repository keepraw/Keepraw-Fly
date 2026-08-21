export type SupportedLocale = "en" | "zh-CN";

export interface LocalizedText {
  en: string;
  "zh-CN": string;
}

export interface AirportReference {
  iata: string;
  name: LocalizedText;
  city: LocalizedText;
  country: string;
  countryName: LocalizedText;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface AirlineReferenceData {
  iata: string;
  name: LocalizedText;
}

export const airports: AirportReference[] = [
  { iata: "SFO", name: { en: "San Francisco International Airport", "zh-CN": "旧金山国际机场" }, city: { en: "San Francisco", "zh-CN": "旧金山" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 37.6213, longitude: -122.379, timezone: "America/Los_Angeles" },
  { iata: "LAX", name: { en: "Los Angeles International Airport", "zh-CN": "洛杉矶国际机场" }, city: { en: "Los Angeles", "zh-CN": "洛杉矶" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 33.9416, longitude: -118.4085, timezone: "America/Los_Angeles" },
  { iata: "JFK", name: { en: "John F. Kennedy International Airport", "zh-CN": "纽约肯尼迪国际机场" }, city: { en: "New York", "zh-CN": "纽约" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 40.6413, longitude: -73.7781, timezone: "America/New_York" },
  { iata: "BOS", name: { en: "Boston Logan International Airport", "zh-CN": "波士顿洛根国际机场" }, city: { en: "Boston", "zh-CN": "波士顿" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 42.3656, longitude: -71.0096, timezone: "America/New_York" },
  { iata: "ORD", name: { en: "Chicago O'Hare International Airport", "zh-CN": "芝加哥奥黑尔国际机场" }, city: { en: "Chicago", "zh-CN": "芝加哥" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 41.9742, longitude: -87.9073, timezone: "America/Chicago" },
  { iata: "DFW", name: { en: "Dallas Fort Worth International Airport", "zh-CN": "达拉斯沃思堡国际机场" }, city: { en: "Dallas", "zh-CN": "达拉斯" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 32.8998, longitude: -97.0403, timezone: "America/Chicago" },
  { iata: "SEA", name: { en: "Seattle-Tacoma International Airport", "zh-CN": "西雅图塔科马国际机场" }, city: { en: "Seattle", "zh-CN": "西雅图" }, country: "US", countryName: { en: "United States", "zh-CN": "美国" }, latitude: 47.4502, longitude: -122.3088, timezone: "America/Los_Angeles" },
  { iata: "PVG", name: { en: "Shanghai Pudong International Airport", "zh-CN": "上海浦东国际机场" }, city: { en: "Shanghai", "zh-CN": "上海" }, country: "CN", countryName: { en: "China", "zh-CN": "中国" }, latitude: 31.1443, longitude: 121.8083, timezone: "Asia/Shanghai" },
  { iata: "PEK", name: { en: "Beijing Capital International Airport", "zh-CN": "北京首都国际机场" }, city: { en: "Beijing", "zh-CN": "北京" }, country: "CN", countryName: { en: "China", "zh-CN": "中国" }, latitude: 40.0799, longitude: 116.6031, timezone: "Asia/Shanghai" },
  { iata: "CAN", name: { en: "Guangzhou Baiyun International Airport", "zh-CN": "广州白云国际机场" }, city: { en: "Guangzhou", "zh-CN": "广州" }, country: "CN", countryName: { en: "China", "zh-CN": "中国" }, latitude: 23.3924, longitude: 113.2988, timezone: "Asia/Shanghai" },
  { iata: "CTU", name: { en: "Chengdu Shuangliu International Airport", "zh-CN": "成都双流国际机场" }, city: { en: "Chengdu", "zh-CN": "成都" }, country: "CN", countryName: { en: "China", "zh-CN": "中国" }, latitude: 30.5785, longitude: 103.9471, timezone: "Asia/Shanghai" },
  { iata: "HKG", name: { en: "Hong Kong International Airport", "zh-CN": "香港国际机场" }, city: { en: "Hong Kong", "zh-CN": "香港" }, country: "HK", countryName: { en: "Hong Kong", "zh-CN": "中国香港" }, latitude: 22.308, longitude: 113.9185, timezone: "Asia/Hong_Kong" },
  { iata: "HND", name: { en: "Tokyo Haneda Airport", "zh-CN": "东京羽田机场" }, city: { en: "Tokyo", "zh-CN": "东京" }, country: "JP", countryName: { en: "Japan", "zh-CN": "日本" }, latitude: 35.5494, longitude: 139.7798, timezone: "Asia/Tokyo" },
  { iata: "NRT", name: { en: "Narita International Airport", "zh-CN": "东京成田国际机场" }, city: { en: "Tokyo", "zh-CN": "东京" }, country: "JP", countryName: { en: "Japan", "zh-CN": "日本" }, latitude: 35.772, longitude: 140.3929, timezone: "Asia/Tokyo" },
  { iata: "ICN", name: { en: "Incheon International Airport", "zh-CN": "首尔仁川国际机场" }, city: { en: "Seoul", "zh-CN": "首尔" }, country: "KR", countryName: { en: "South Korea", "zh-CN": "韩国" }, latitude: 37.4602, longitude: 126.4407, timezone: "Asia/Seoul" },
  { iata: "SIN", name: { en: "Singapore Changi Airport", "zh-CN": "新加坡樟宜机场" }, city: { en: "Singapore", "zh-CN": "新加坡" }, country: "SG", countryName: { en: "Singapore", "zh-CN": "新加坡" }, latitude: 1.3644, longitude: 103.9915, timezone: "Asia/Singapore" },
  { iata: "LHR", name: { en: "London Heathrow Airport", "zh-CN": "伦敦希思罗机场" }, city: { en: "London", "zh-CN": "伦敦" }, country: "GB", countryName: { en: "United Kingdom", "zh-CN": "英国" }, latitude: 51.47, longitude: -0.4543, timezone: "Europe/London" },
  { iata: "CDG", name: { en: "Paris Charles de Gaulle Airport", "zh-CN": "巴黎戴高乐机场" }, city: { en: "Paris", "zh-CN": "巴黎" }, country: "FR", countryName: { en: "France", "zh-CN": "法国" }, latitude: 49.0097, longitude: 2.5479, timezone: "Europe/Paris" },
  { iata: "FRA", name: { en: "Frankfurt Airport", "zh-CN": "法兰克福机场" }, city: { en: "Frankfurt", "zh-CN": "法兰克福" }, country: "DE", countryName: { en: "Germany", "zh-CN": "德国" }, latitude: 50.0379, longitude: 8.5622, timezone: "Europe/Berlin" },
  { iata: "SYD", name: { en: "Sydney Kingsford Smith Airport", "zh-CN": "悉尼金斯福德·史密斯机场" }, city: { en: "Sydney", "zh-CN": "悉尼" }, country: "AU", countryName: { en: "Australia", "zh-CN": "澳大利亚" }, latitude: -33.9399, longitude: 151.1753, timezone: "Australia/Sydney" },
  { iata: "YVR", name: { en: "Vancouver International Airport", "zh-CN": "温哥华国际机场" }, city: { en: "Vancouver", "zh-CN": "温哥华" }, country: "CA", countryName: { en: "Canada", "zh-CN": "加拿大" }, latitude: 49.1967, longitude: -123.1815, timezone: "America/Vancouver" }
];

export const airlines: AirlineReferenceData[] = [
  { iata: "UA", name: { en: "United Airlines", "zh-CN": "美国联合航空" } },
  { iata: "AA", name: { en: "American Airlines", "zh-CN": "美国航空" } },
  { iata: "DL", name: { en: "Delta Air Lines", "zh-CN": "达美航空" } },
  { iata: "MU", name: { en: "China Eastern Airlines", "zh-CN": "中国东方航空" } },
  { iata: "CA", name: { en: "Air China", "zh-CN": "中国国际航空" } },
  { iata: "CZ", name: { en: "China Southern Airlines", "zh-CN": "中国南方航空" } },
  { iata: "JL", name: { en: "Japan Airlines", "zh-CN": "日本航空" } },
  { iata: "NH", name: { en: "All Nippon Airways", "zh-CN": "全日空" } },
  { iata: "SQ", name: { en: "Singapore Airlines", "zh-CN": "新加坡航空" } },
  { iata: "BA", name: { en: "British Airways", "zh-CN": "英国航空" } },
  { iata: "LH", name: { en: "Lufthansa", "zh-CN": "汉莎航空" } },
  { iata: "CX", name: { en: "Cathay Pacific", "zh-CN": "国泰航空" } },
  { iata: "KE", name: { en: "Korean Air", "zh-CN": "大韩航空" } },
  { iata: "QF", name: { en: "Qantas", "zh-CN": "澳洲航空" } },
  { iata: "AC", name: { en: "Air Canada", "zh-CN": "加拿大航空" } },
  { iata: "AF", name: { en: "Air France", "zh-CN": "法国航空" } }
];

export const airportByIata = new Map(airports.map((airport) => [airport.iata, airport]));
export const airlineByIata = new Map(airlines.map((airline) => [airline.iata, airline]));
