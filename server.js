const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'local-grove-youtube-resolver' });
});

app.get('/resolve', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    if (!ytdl.validateURL(url)) {
      return res.json({ streamUrl: url, title: url, direct: true });
    }

    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    if (!format || !format.url) {
      return res.status(500).json({ error: 'No audio format found' });
    }

    res.json({
      streamUrl: format.url,
      title: info.videoDetails?.title || url,
      author: info.videoDetails?.author?.name || '',
      duration: info.videoDetails?.lengthSeconds || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'resolve failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Local Grove YouTube resolver running on http://127.0.0.1:${PORT}`);
});
