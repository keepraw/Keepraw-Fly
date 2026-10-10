// Bounds are [west, south, east, north] in geographic degrees, not airports.
// Core boxes extend +/-0.25 degrees around city centers; periphery excludes them.
export const nightRegions = [
  {
    id: "beijing-tianjin",
    name: "Beijing / Tianjin",
    bounds: [115.5, 38.5, 118.5, 41],
    cores: [
      [116.4074, 39.9042],
      [117.2, 39.1333],
    ],
  },
  {
    id: "yangtze-delta",
    name: "Shanghai / Yangtze River Delta",
    bounds: [119, 29.5, 122.5, 32.5],
    cores: [
      [121.4737, 31.2304],
      [120.5853, 31.2989],
      [120.1551, 30.2741],
    ],
  },
  {
    id: "pearl-delta",
    name: "Guangzhou / Shenzhen / Pearl River Delta",
    bounds: [112, 21.5, 115.5, 24],
    cores: [
      [113.2644, 23.1291],
      [114.0579, 22.5431],
      [113.7518, 23.0207],
    ],
  },
  {
    id: "chengdu",
    name: "Chengdu",
    bounds: [102.5, 29.5, 105.5, 32],
    cores: [[104.0665, 30.5728]],
  },
  {
    id: "tokyo",
    name: "Tokyo",
    bounds: [138, 34.5, 141, 37],
    cores: [[139.6917, 35.6895]],
  },
  {
    id: "seoul",
    name: "Seoul",
    bounds: [125.5, 36.5, 128.5, 39],
    cores: [[126.978, 37.5665]],
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    bounds: [-119.5, 32.5, -116.5, 35],
    cores: [[-118.2437, 34.0522]],
  },
  {
    id: "tibet",
    name: "Remote Tibetan Plateau",
    bounds: [82, 32, 88, 35],
    dark: true,
    cores: [],
  },
  {
    id: "sahara",
    name: "Remote Sahara",
    bounds: [15, 22, 21, 26],
    dark: true,
    cores: [],
  },
  {
    id: "ocean",
    name: "Remote North Pacific",
    bounds: [-160, 10, -150, 20],
    dark: true,
    cores: [],
  },
];
