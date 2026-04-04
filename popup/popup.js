(function() {
  const playBtn = document.getElementById('playBtn');
  const exportBtn = document.getElementById('exportBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const clearDownloadsBtn = document.getElementById('clearDownloadsBtn');
  const downloadListContainer = document.getElementById('downloadListContainer');
  const downloadCount = document.getElementById('downloadCount');
  const statusMessage = document.getElementById('statusMessage');
  const playStatus = document.getElementById('playStatus');

  let downloadRecords = [];
  let isPlaying = false;
  let isDownloading = false;
  let statusUpdateTimer = null;
  let downloadRefreshTimer = null;

  function init() {
    bindEvents();
    loadDownloadRecords();
    updatePlayStatus();
    // 每1秒刷新一次下载记录
    downloadRefreshTimer = setInterval(loadDownloadRecords, 1000);
    // 页面关闭时清理定时器
    window.addEventListener('unload', () => {
      if (statusUpdateTimer) clearInterval(statusUpdateTimer);
      if (downloadRefreshTimer) clearInterval(downloadRefreshTimer);
    });
  }

  function bindEvents() {
    playBtn.addEventListener('click', togglePlay);
    exportBtn.addEventListener('click', exportList);
    downloadAllBtn.addEventListener('click', downloadAllFiles);
    clearDownloadsBtn.addEventListener('click', clearDownloadRecords);
  }

  async function loadDownloadRecords() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDownloadRecords' });
      const allRecords = response.records || [];
      
      // 按歌曲名称去重，保留最新的记录
      const uniqueMap = new Map();
      allRecords.forEach(record => {
        const key = record.songName || record.filename;
        // 如果不存在，或者存在但当前记录更新，就替换
        if (!uniqueMap.has(key) || record.time > uniqueMap.get(key).time) {
          uniqueMap.set(key, record);
        }
      });
      
      downloadRecords = Array.from(uniqueMap.values());
      downloadRecords.sort((a, b) => b.time - a.time); // 按时间倒序排列
      renderDownloadList(downloadRecords);
    } catch (err) {
      console.error('加载下载记录失败:', err);
      showStatus('加载下载记录失败', 'error');
    }
  }

  function renderDownloadList(records) {
    downloadCount.textContent = records.length;

    if (!records || records.length === 0) {
      downloadListContainer.innerHTML = '<div class="empty-state">暂无下载记录</div>';
      return;
    }

    downloadListContainer.innerHTML = records.map(record => {
      const displayName = record.songName || record.filename;

      return `
        <div class="list-item">
          <div class="item-header">
            <div class="item-info">
              <div class="item-name">
                ${displayName}
              </div>
              <div class="item-meta">${record.mime || ''}</div>
            </div>
            <div class="item-actions">
              <button class="action-btn copy-btn" data-url="${record.url}">复制链接</button>
              <button class="action-btn download-btn" data-url="${record.url}" data-filename="${record.songName || record.filename}">重新下载</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    downloadListContainer.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        copyToClipboard(url);
      });
    });

    downloadListContainer.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        const filename = btn.getAttribute('data-filename');
        await redownload(url, filename);
      });
    });
  }

  async function clearDownloadRecords() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearDownloadRecords' });
      downloadRecords = [];
      renderDownloadList([]);
      showStatus('已清空下载记录', 'success');
    } catch (err) {
      showStatus('清空失败', 'error');
    }
  }

  async function redownload(url, filename) {
    try {
      showStatus(`正在重新下载: ${filename}`, 'info');
      const response = await chrome.runtime.sendMessage({ 
        action: 'redownload', 
        url: url, 
        filename: filename 
      });

      if (response.success) {
        showStatus('已加入下载队列', 'success');
      } else {
        showStatus(response.error || '下载失败', 'error');
      }
    } catch (err) {
      showStatus('下载失败: ' + err.message, 'error');
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '0B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + sizes[i];
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showStatus('已复制到剪贴板', 'success');
    }).catch(err => {
      showStatus('复制失败', 'error');
    });
  }

  function showStatus(message, type) {
    statusMessage.innerHTML = `<span class="${type}">${message}</span>`;
    if (type !== 'info') {
      setTimeout(() => {
        statusMessage.innerHTML = '';
      }, 3000);
    }
  }

  // 自动播放控制
  async function togglePlay() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('qq.com')) {
        showStatus('请先打开QQ音乐页面', 'error');
        return;
      }

      if (isPlaying) {
        // 停止播放
        await chrome.tabs.sendMessage(tab.id, { action: 'stopAutoPlay' });
        isPlaying = false;
        playBtn.textContent = '▶️ 开始自动播放';
        playBtn.classList.remove('playing');
        showStatus('已停止自动播放', 'success');
        clearInterval(statusUpdateTimer);
        updatePlayStatus();
      } else {
        // 开始播放
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'startAutoPlay' });
        if (response.success) {
          isPlaying = true;
          playBtn.textContent = '⏸️ 停止自动播放';
          playBtn.classList.add('playing');
          showStatus(`开始自动播放，共${response.total}首歌曲`, 'success');
          // 每秒更新状态
          statusUpdateTimer = setInterval(updatePlayStatus, 1000);
        } else {
          showStatus(response.message || '启动失败', 'error');
        }
      }
    } catch (err) {
      console.error('播放控制失败:', err);
      showStatus('操作失败: ' + err.message, 'error');
    }
  }

  async function updatePlayStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('qq.com')) {
        playStatus.textContent = '请打开QQ音乐页面';
        playStatus.className = 'play-status error';
        playBtn.textContent = '▶️ 开始自动播放';
        playBtn.classList.remove('playing');
        isPlaying = false;
        return;
      }

      const status = await chrome.tabs.sendMessage(tab.id, { action: 'getPlayStatus' });
      
      // 同步播放状态
      isPlaying = status.isPlaying;
      if (isPlaying) {
        playBtn.textContent = '⏸️ 停止自动播放';
        playBtn.classList.add('playing');
        playStatus.textContent = `正在播放：${status.currentSong ? status.currentSong.name : '加载中...'} (第${status.currentIndex}首/共${status.total}首)`;
        playStatus.className = 'play-status playing';
      } else if (status.total > 0 && status.currentIndex >= status.total) {
        playBtn.textContent = '▶️ 开始自动播放';
        playBtn.classList.remove('playing');
        playStatus.textContent = `播放完成！共${status.total}首歌曲`;
        playStatus.className = 'play-status success';
        if (statusUpdateTimer) clearInterval(statusUpdateTimer);
      } else {
        playBtn.textContent = '▶️ 开始自动播放';
        playBtn.classList.remove('playing');
        playStatus.textContent = '就绪，点击开始自动播放';
        playStatus.className = 'play-status';
      }
    } catch (err) {
      playStatus.textContent = '获取状态失败';
      playStatus.className = 'play-status error';
      playBtn.textContent = '▶️ 开始自动播放';
      playBtn.classList.remove('playing');
      isPlaying = false;
    }
  }

  // 导出功能
  function exportList() {
    if (downloadRecords.length === 0) {
      showStatus('没有可导出的记录', 'error');
      return;
    }

    // 生成时间戳
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

    // 导出JSON
    const jsonContent = JSON.stringify(downloadRecords, null, 2);
    const jsonBlob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = jsonUrl;
    a.download = `QQ音乐歌曲列表_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(jsonUrl);

    showStatus(`已导出 ${downloadRecords.length} 条记录`, 'success');
  }

  // 批量下载所有音频并打包为ZIP
  async function downloadAllFiles() {
    if (isDownloading) {
      showStatus('正在下载中，请耐心等待...', 'info');
      return;
    }

    if (downloadRecords.length === 0) {
      showStatus('没有可下载的音频记录', 'error');
      return;
    }

    try {
      isDownloading = true;
      downloadAllBtn.disabled = true;
      downloadAllBtn.textContent = '下载中...';

      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;

      // 合法音视频后缀列表
      const validMediaExts = ['mp4', 'm4a', 'mp3', 'aac', 'flac', 'ogg', 'wav', 'wma', 'ape', 'alac', 'opus', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpeg', 'mpg', 'rmvb', 'ts'];
      
      for (let i = 0; i < downloadRecords.length; i++) {
        const record = downloadRecords[i];
        const songName = record.songName || `歌曲${i+1}`;
        // 清理文件名中的非法字符，避免解压乱码
        const cleanSongName = songName.replace(/[\/\\:*?"<>|]/g, '_').trim();
        
        // 正确提取文件后缀
        let ext = '';
        const urlWithoutQuery = record.url.split('?')[0].toLowerCase();
        const lastDotIndex = urlWithoutQuery.lastIndexOf('.');
        if (lastDotIndex > 0) {
          ext = urlWithoutQuery.substring(lastDotIndex + 1);
          // 验证后缀是否是合法的音视频后缀，不是的话用m4a作为默认
          if (!validMediaExts.includes(ext)) {
            ext = 'm4a';
          }
        } else {
          ext = 'm4a'; // 默认后缀用QQ音乐常用的m4a格式
        }
        
        const filename = `${cleanSongName}.${ext}`;
        
        try {
          downloadAllBtn.textContent = `下载中 ${i+1}/${downloadRecords.length}`;
          showStatus(`正在下载：${songName} (${i+1}/${downloadRecords.length})`, 'info');

          // 下载音频文件
          const response = await fetch(record.url, {
            credentials: 'include'
          });
          
          if (!response.ok) {
            throw new Error('下载失败: ' + response.status);
          }

          const arrayBuffer = await response.arrayBuffer();
          
          // 添加到zip
          zip.file(filename, arrayBuffer);

          successCount++;
        } catch (err) {
          console.error(`下载失败 ${songName}:`, err);
          failCount++;
        }
      }

      // 生成zip并下载，设置UTF-8编码确保mac解压不乱码
      downloadAllBtn.textContent = '打包中...';
      showStatus('正在生成ZIP包...', 'info');
      
      const zipContent = await zip.generateAsync({ 
        type: 'blob',
        encodeFileName: (filename) => {
          // 强制使用UTF-8编码文件名，解决mac解压乱码问题
          return unescape(encodeURIComponent(filename));
        }
      });
      const url = URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      a.href = url;
      a.download = `QQ音乐歌曲打包_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (failCount === 0) {
        showStatus(`下载完成！成功 ${successCount} 首`, 'success');
      } else {
        showStatus(`下载完成！成功 ${successCount} 首，失败 ${failCount} 首`, 'error');
      }

    } catch (err) {
      console.error('批量下载失败:', err);
      showStatus('下载失败: ' + err.message, 'error');
    } finally {
      isDownloading = false;
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = '📥 批量下载';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();