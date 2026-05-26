const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3456;

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

      if (id) {
        return `https://www.youtube.com/watch?v=${id}`;
      }

      const parts = url.pathname.split('/').filter(Boolean);
      const possibleId = parts[parts.length - 1];
      if (possibleId) {
        return `https://www.youtube.com/watch?v=${possibleId}`;
      }
    }

    return raw;
  } catch (err) {
    return input;
  }
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'local-grove-youtube-resolver',
    version: '2.2.0'
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
        direct: true
      });
    }

    const info = await ytdl.getInfo(cleanUrl);

    const audioFormats = info.formats
      .filter(f => f.hasAudio && !f.hasVideo && f.url)
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    const format = audioFormats[0] || ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    if (!format || !format.url) {
      return res.status(500).json({
        error: 'No playable audio format found',
        cleanUrl
      });
    }

    res.json({
      streamUrl: format.url,
      title: info.videoDetails?.title || cleanUrl,
      author: info.videoDetails?.author?.name || '',
      duration: info.videoDetails?.lengthSeconds || null,
      cleanUrl
    });
  } catch (err) {
    console.error('Resolve failed:', err);
    res.status(500).json({
      error: err.message || 'resolve failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Local Grove YouTube resolver v2.2 running on http://127.0.0.1:${PORT}`);
});
