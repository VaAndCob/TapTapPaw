// weather.js
// Works on macOS + Windows (Node.js 18+ for built-in fetch)
// API used: Open-Meteo (no API key)

const WEATHER_CODE_MAP = {
  0: "sun",
  1: "mainly_clear",
  2: "partly_cloudy",
  3: "cloudy",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  61: "rain",
  63: "rain",
  65: "heavy_rain",
  66: "freezing_rain",
  67: "freezing_rain",
  71: "snow",
  73: "snow",
  75: "snow",
  80: "rain_showers",
  81: "rain_showers",
  82: "heavy_showers",
  95: "thunderstorm",
  96: "thunderstorm_hail",
  99: "thunderstorm_hail",
};

function classify(code) {
  if ([0, 1].includes(code)) return 0;//"sun";
  if ([2, 3, 45, 48].includes(code)) return 1;//"cloud";
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 2;//"rain";
  if ([95, 96, 99].includes(code)) return 3;//"storm";
  if ([71, 73, 75, 77].includes(code)) return 4;//"snow";
  return "unknown";
}

async function getGeoLocation() {
  const url = 'http://ip-api.com/json/';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GeoLocation API failed: ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(`GeoLocation API failed: ${data.message || 'Unknown error'}`);
  }
  return {
    lat: data.lat,
    lon: data.lon,
  };
}
async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,precipitation` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);

  const data = await res.json();
  const c = data.current;

  return {
    temp_c: Math.round(c.temperature_2m),
    humidity: c.relative_humidity_2m,
  //  precipitation_mm: c.precipitation,
 //   weather_code: c.weather_code,
 //   weather_text: WEATHER_CODE_MAP[c.weather_code] || "unknown",
    weather_group: classify(c.weather_code), // sun/cloud/rain/storm/snow
    observed_at: data.current.time,
  };
}

// example usage

(async () => {
  try {
    const weather = await getWeather(13.7563, 100.5018); // Bangkok
    console.log(weather);
  } catch (err) {
    console.error(err.message);
  }
})();


module.exports = { getWeather, getGeoLocation };