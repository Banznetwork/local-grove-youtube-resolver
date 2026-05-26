const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3456;

const PROXY_URL = process.env.PROXY_URL || '';
const YOUTUBE_COOKIE = process.env.YOUTUBE_COOKIE || '';

app.use(cors());

function cleanYouTubeUrl(input) {
  try {
    const raw = String(input || '').trim();

    if (raw.includes('youtu.be/')) {
      const url = new URL(raw);
      const id = url.pathname.replace('/', '').split('?')[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }

    if (raw.includes('youtube.com')) {
      const url = new URL(raw);
      const id = url.searchParams.get('v');
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }

    return raw;
  } catch {
    return input;
  }
}

function getYtdlOptions() {
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    'accept-language': 'en-US,en;q=0.9'
  };

  if (YOUTUBE_COOKIE) {
    headers.cookie = YOUTUBE_COOKIE;
  }

  const options = {
    requestOptions: { headers }
  };

  if (PROXY_URL) {
    options.agent = ytdl.createProxyAgent({
      uri: PROXY_URL
    });
  }

  return options;
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'local-grove-youtube-resolver',
    version: '2.7.0-m4a-preferred',
    proxyEnabled: Boolean(PROXY_URL),
    cookieEnabled: Boolean(YOUTUBE_COOKIE)
  });
});

app.get('/resolve', async (req, res) => {
  try {
    const originalUrl = req.query.url;

    if (!originalUrl) {
      return res.status(400).json({ error: 'Missing url' });
    }

    const cleanUrl = cleanYouTubeUrl(originalUrl);

    if (!ytdl.validateURL(cleanUrl)) {
      return res.json({
        streamUrl: originalUrl,
        title: originalUrl,
        direct: true,
        proxyEnabled: Boolean(PROXY_URL),
        cookieEnabled: Boolean(YOUTUBE_COOKIE)
      });
    }

    const info = await ytdl.getInfo(cleanUrl, getYtdlOptions());

    const mp4AudioFormats = info.formats
      .filter((format) =>
        format.hasAudio &&
        !format.hasVideo &&
        format.url &&
        (
          format.mimeType?.includes('audio/mp4') ||
          format.mimeType?.includes('audio/aac') ||
          format.container === 'mp4' ||
          format.container === 'm4a'
        )
      )
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    const fallbackAudioFormats = info.formats
      .filter((format) => format.hasAudio && !format.hasVideo && format.url)
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    const format = mp4AudioFormats[0] || fallbackAudioFormats[0];

    if (!format || !format.url) {
      return res.status(500).json({
        error: 'No playable audio format found',
        cleanUrl,
        proxyEnabled: Boolean(PROXY_URL),
        cookieEnabled: Boolean(YOUTUBE_COOKIE)
      });
    }

    return res.json({
      streamUrl: format.url,
      title: info.videoDetails?.title || cleanUrl,
      author: info.videoDetails?.author?.name || '',
      duration: info.videoDetails?.lengthSeconds || null,
      cleanUrl,
      selectedMimeType: format.mimeType || '',
      selectedContainer: format.container || '',
      proxyEnabled: Boolean(PROXY_URL),
      cookieEnabled: Boolean(YOUTUBE_COOKIE)
    });
  } catch (err) {
    console.error('Resolve failed:', err);

    return res.status(500).json({
      error: err.message || 'resolve failed',
      proxyEnabled: Boolean(PROXY_URL),
      cookieEnabled: Boolean(YOUTUBE_COOKIE)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Local Grove YouTube resolver running on port ${PORT}`);
  console.log(`Version: 2.7.0-m4a-preferred`);
  console.log(`Proxy enabled: ${Boolean(PROXY_URL)}`);
  console.log(`Cookie enabled: ${Boolean(YOUTUBE_COOKIE)}`);
});
