const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3456;

const PROXY_URL = process.env.PROXY_URL || '';

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

      const parts = url.pathname.split('/').filter(Boolean);
      const possibleId = parts[parts.length - 1];
      if (possibleId) return `https://www.youtube.com/watch?v=${possibleId}`;
    }

    return raw;
  } catch {
    return input;
  }
}

function getYtdlOptions() {
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'accept-language': 'en-US,en;q=0.9'
  };

  if (!PROXY_URL) {
    return {
      requestOptions: { headers }
    };
  }

  const agent = ytdl.createProxyAgent({
    uri: PROXY_URL
  });

  return {
    agent,
    requestOptions: { headers }
  };
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'local-grove-youtube-resolver',
    version: '2.5.0-webshare-ytdl-agent',
    proxyEnabled: Boolean(PROXY_URL)
  });
});

app.get('/resolve', async (req, res) => {
  try {
    const originalUrl = req.query.url;

    if (!originalUrl) {
      return res.status(400).json({
        error: 'Missing url'
      });
    }

    const cleanUrl = cleanYouTubeUrl(originalUrl);

    if (!ytdl.validateURL(cleanUrl)) {
      return res.json({
        streamUrl: originalUrl,
        title: originalUrl,
        direct: true,
        proxyEnabled: Boolean(PROXY_URL)
      });
    }

    const info = await ytdl.getInfo(cleanUrl, getYtdlOptions());

    const audioFormats = info.formats
      .filter((format) => format.hasAudio && !format.hasVideo && format.url)
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    const format =
      audioFormats[0] ||
      ytdl.chooseFormat(info.formats, {
        quality: 'highestaudio',
        filter: 'audioonly'
      });

    if (!format || !format.url) {
      return res.status(500).json({
        error: 'No playable audio format found',
        cleanUrl,
        proxyEnabled: Boolean(PROXY_URL)
      });
    }

    res.json({
      streamUrl: format.url,
      title: info.videoDetails?.title || cleanUrl,
      author: info.videoDetails?.author?.name || '',
      duration: info.videoDetails?.lengthSeconds || null,
      cleanUrl,
      proxyEnabled: Boolean(PROXY_URL)
    });
  } catch (err) {
    console.error('Resolve failed:', err);

    res.status(500).json({
      error: err.message || 'resolve failed',
      proxyEnabled: Boolean(PROXY_URL)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Local Grove YouTube resolver running on port ${PORT}`);
  console.log(`Version: 2.5.0-webshare-ytdl-agent`);
  console.log(`Proxy enabled: ${Boolean(PROXY_URL)}`);
});
