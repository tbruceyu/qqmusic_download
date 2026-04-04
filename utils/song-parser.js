(function() {
  function escapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function unescapeHtml(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent;
  }

  function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unknown';
    }

    return filename
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatSongTitle(songName, singerName) {
    if (!songName) {
      return '未知歌曲';
    }

    if (singerName) {
      return `${singerName} - ${songName}`;
    }

    return songName;
  }

  function parseSongInfo(rawInfo) {
    if (!rawInfo) {
      return { name: '', singer: '', mid: '' };
    }

    if (typeof rawInfo === 'string') {
      return { name: rawInfo, singer: '', mid: '' };
    }

    return {
      name: rawInfo.name || rawInfo.songName || rawInfo.title || '',
      singer: rawInfo.singer || rawInfo.singerName || rawInfo.artist || '',
      mid: rawInfo.mid || rawInfo.songMid || rawInfo.songmid || ''
    };
  }

  window.SongParser = {
    escapeHtml,
    unescapeHtml,
    sanitizeFilename,
    formatSongTitle,
    parseSongInfo
  };
})();