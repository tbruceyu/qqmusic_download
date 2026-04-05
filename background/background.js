const mediaResources = new Map();
let currentSongName = '';
const mediaExtensions = ['.mp4', '.m4a', '.mp3', '.aac', '.flac', '.ogg', '.wav', '.wma', '.ape', '.alac', '.opus',
                        '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mpeg', '.mpg', '.rmvb', '.ts'];
// 要排除的非音视频后缀
const excludeExtensions = ['.data', '.tff', '.ttf', '.woff', '.woff2', '.css', '.js', '.html', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.json', '.xml'];

console.log('✅ [QQ音乐资源监控器] 后台服务已启动');

function isMediaResource(details) {
  const url = details.url || '';
  const urlWithoutQuery = url.split('?')[0].toLowerCase();
  
  // 先检查排除列表
  for (const ext of excludeExtensions) {
    if (urlWithoutQuery.endsWith(ext)) {
      return false;
    }
  }
  
  // 再检查是否是音视频后缀
  for (const ext of mediaExtensions) {
    if (urlWithoutQuery.endsWith(ext)) {
      return true;
    }
  }
  
  return false;
}

// 去重规则：URL唯一
function isDuplicate(url) {
  return mediaResources.has(url);
}

// 监听请求完成事件，获取完整的资源信息
chrome.webRequest.onCompleted.addListener(
  (details) => {
    try {
      if (details.statusCode >= 200 && details.statusCode < 300) {
        if (isMediaResource(details)) {
          const url = details.url;
          
          // 去重检查
          if (isDuplicate(url)) {
            console.log('🔄 [重复资源，已跳过]', url);
            return;
          }

          const urlWithoutQuery = url.split('?')[0];
          const filename = urlWithoutQuery.split('/').pop() || 'unknown';
          
          // 获取Content-Length
          let size = 0;
          if (details.responseHeaders) {
            const contentLengthHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-length');
            if (contentLengthHeader) {
              size = parseInt(contentLengthHeader.value) || 0;
            }
          }

          // 获取Content-Type
          let mimeType = '';
          if (details.responseHeaders) {
            const contentTypeHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
            if (contentTypeHeader) {
              mimeType = contentTypeHeader.value;
            }
          }

          // 没有获取到歌名的资源直接忽略，保证记录有效性
          if (!currentSongName || currentSongName.trim() === '') {
            console.log('⚠️ [资源忽略] 未获取到歌曲名，跳过:', url);
            return;
          }

          // 只保留必要字段，不需要下载状态
          const resource = {
            url: url,
            filename: filename,
            songName: currentSongName,
            size: size,
            mime: mimeType,
            time: Date.now()
          };
          mediaResources.set(url, resource);
          
          console.log('🎬 [捕获媒体资源]', {
            文件名: filename,
            大小: size ? `${(size/1024/1024).toFixed(2)}MB` : '未知',
            URL: url
          });
        }
      }
    } catch (err) {
      console.error('❌ 处理请求失败:', err);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 [收到消息] Action:', message.action, '来自:', sender.url || 'popup');

  if (message.action === 'updateSongName') {
    currentSongName = message.songName;
    console.log('🎵 更新当前歌曲名:', currentSongName);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'getDownloadRecords') {
    const records = Array.from(mediaResources.values());
    records.sort((a, b) => b.time - a.time);
    console.log('📤 [返回资源记录] 共', records.length, '条');
    sendResponse({ records: records });
  } else if (message.action === 'clearDownloadRecords') {
    mediaResources.clear();
    currentSongName = '';
    console.log('🗑️ [清空记录] 所有资源记录已清空');
    sendResponse({ success: true });
  } else if (message.action === 'redownload') {
    const url = message.url;
    const filename = message.filename;
    console.log('⬇️ [下载资源] URL:', url, '文件名:', filename);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('❌ [下载失败]', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log('✅ [已加入下载队列] 新下载ID:', downloadId);
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('🎉 [插件安装] QQ音乐资源监控器已安装/更新');
});