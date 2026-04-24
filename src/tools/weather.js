const ALERT_KEYWORDS = ['Storm', 'Tornado', 'Hurricane', 'Thunderstorm', 'Squall', 'Typhoon'];
const WIND_THRESHOLD_MPH = 45;

export async function fetchWeatherAlert(city) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return { city, condition: 'API key not set', windSpeed: 0, temperature: null, isAlertWorthy: false };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=imperial`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { city, condition: err.message ?? 'Request failed', windSpeed: 0, temperature: null, isAlertWorthy: false };
    }

    const data = await res.json();
    const condition = data.weather?.[0]?.main ?? 'Unknown';
    const description = data.weather?.[0]?.description ?? '';
    const windSpeed = data.wind?.speed ?? 0;
    const temperature = data.main?.temp ?? null;

    const isAlertWorthy =
      ALERT_KEYWORDS.some((kw) => condition.includes(kw) || description.includes(kw)) ||
      windSpeed > WIND_THRESHOLD_MPH;

    return { city, condition, description, windSpeed, temperature, isAlertWorthy };
  } catch {
    return { city, condition: 'Fetch error', windSpeed: 0, temperature: null, isAlertWorthy: false };
  }
}

export const weatherTool = {
  type: 'function',
  function: {
    name: 'fetchWeatherAlert',
    description:
      'Fetch current weather conditions for a port city. Returns wind speed, condition, and whether conditions are severe enough to disrupt shipping operations.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'Name of the port city to check, e.g. "Miami", "Los Angeles", "Rotterdam"',
        },
      },
      required: ['city'],
    },
  },
};
