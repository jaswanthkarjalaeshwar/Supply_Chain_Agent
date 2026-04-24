const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

export async function fetchDisruptionNews(location, eventType) {
  const query = encodeURIComponent(`${location} ${eventType}`);
  const url = `${GDELT_BASE}?query=${query}&mode=artlist&maxrecords=10&format=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const articles = data?.articles ?? [];

    return articles.slice(0, 5).map((a) => ({
      title: a.title ?? '(no title)',
      url: a.url,
      publishDate: a.seendatetime
        ? `${a.seendatetime.slice(0, 4)}-${a.seendatetime.slice(4, 6)}-${a.seendatetime.slice(6, 8)}`
        : null,
      summary: `[${a.domain}] ${a.title ?? ''}`.trim(),
    }));
  } catch {
    return [];
  }
}

export const newsTool = {
  type: 'function',
  function: {
    name: 'fetchDisruptionNews',
    description:
      'Search recent news articles for supply chain disruption events at a given location (port, city, region). Returns up to 5 relevant articles.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Port city or geographic region to search, e.g. "Miami", "Suez Canal"',
        },
        eventType: {
          type: 'string',
          description: 'Type of disruption to search for, e.g. "hurricane", "strike", "congestion"',
        },
      },
      required: ['location', 'eventType'],
    },
  },
};
