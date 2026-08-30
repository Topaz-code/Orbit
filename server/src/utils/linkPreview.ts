/**
 * Open-Graph link preview fetcher.
 *
 * Self-hosted Orbit instances are often offline or behind a firewall, so this never throws and
 * always degrades to a domain-only preview. Requests are aborted after 4s, capped at 512KB, and
 * restricted to http(s) so a malicious link cannot make the server read local files.
 */
export interface LinkPreviewData {
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const TIMEOUT_MS = 4000;
const MAX_BYTES = 512 * 1024;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function metaContent(html: string, ...names: string[]): string {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
        'i',
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1]);
    }
  }
  return '';
}

function fallbackPreview(url: string, domain: string): LinkPreviewData {
  return {
    url,
    domain,
    title: domain,
    description: '',
    image: '',
    siteName: domain,
  };
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const domain = parsed.hostname.replace(/^www\./, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'OrbitBot/1.0 (+https://github.com/Topaz-code/Orbit)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok || !response.body) return fallbackPreview(parsed.toString(), domain);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return fallbackPreview(parsed.toString(), domain);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    await reader.cancel().catch(() => undefined);

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '';
    let image = metaContent(html, 'og:image', 'twitter:image', 'twitter:image:src');
    if (image && !/^https?:\/\//i.test(image)) {
      try {
        image = new URL(image, parsed).toString();
      } catch {
        image = '';
      }
    }

    return {
      url: parsed.toString(),
      domain,
      title: metaContent(html, 'og:title', 'twitter:title') || decodeEntities(titleTag) || domain,
      description: metaContent(html, 'og:description', 'twitter:description', 'description'),
      image,
      siteName: metaContent(html, 'og:site_name') || domain,
    };
  } catch {
    return fallbackPreview(parsed.toString(), domain);
  } finally {
    clearTimeout(timer);
  }
}
