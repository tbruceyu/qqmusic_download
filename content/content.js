(function() {
  const QQ_MUSIC_DOMAIN = 'y.qq.com';
  let currentSongName = '';

  // 自动播放相关变量
  let autoPlayTimer = null;
  let isPlaying = false;
  let currentPlayIndex = 0;
  let songList = [];
  let playRetryCount = 0; // 播放重试次数，最多重试2次

  function isQQMusicPage() {
    return window.location.hostname.includes(QQ_MUSIC_DOMAIN);
  }



  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isQQMusicPage()) {
      sendResponse({ error: '不在QQ音乐页面' });
      return false;
    }

    if (message.action === 'ping') {
      sendResponse({ success: true, message: 'pong' });
      return true;
    } else if (message.action === 'getCurrentSongName') {
      sendResponse({ songName: currentSongName });
      return true;
    } else if (message.action === 'startAutoPlay') {
      const result = startAutoPlay();
      sendResponse(result);
      return true;
    } else if (message.action === 'stopAutoPlay') {
      stopAutoPlay();
      sendResponse({ success: true });
      return true;
    } else if (message.action === 'getPlayStatus') {
      // 每次获取状态前重新解析最新歌曲列表，确保状态准确
      parseSongList();
      // 正在播放的是currentPlayIndex-1，因为playNext执行后currentPlayIndex会+1
      const currentSong = isPlaying && currentPlayIndex > 0 && currentPlayIndex <= songList.length 
        ? songList[currentPlayIndex - 1] 
        : null;
      
      sendResponse({
        isPlaying: isPlaying,
        currentIndex: currentPlayIndex,
        total: songList.length,
        currentSong: currentSong
      });
      return true;
    }

    return false;
  });

  // 自动播放功能
  function parseSongList() {
    songList = [];
    const listEl = document.querySelector('.songlist__list');
    if (!listEl) {
      return [];
    }

    const items = listEl.querySelectorAll('li');
    items.forEach((item, index) => {
      const songNameEl = item.querySelector('.songlist__songname_txt a');
      const singerEl = item.querySelector('.songlist__artist a');
      const playBtnEl = item.querySelector('.list_menu__play');

      if (songNameEl && playBtnEl) {
        songList.push({
          index: index + 1,
          name: songNameEl.textContent.trim(),
          singer: singerEl ? singerEl.textContent.trim() : '未知歌手',
          playBtn: playBtnEl,
          element: item
        });
      }
    });

    return songList;
  }

  function playNext() {
    if (currentPlayIndex >= songList.length) {
      // 重新解析歌曲列表，确保列表最新
      parseSongList();
      const totalSongs = songList.length;
      
      // 检查已捕获的有效资源数量
      chrome.runtime.sendMessage({ action: 'getDownloadRecords' }, (response) => {
        const records = response.records || [];
        // 去重后统计有效数量，和实际期望数量对比
        const uniqueSongs = new Set(records.map(r => r.songName));
        const validCount = uniqueSongs.size;
        console.log(`📊 播放完成检查：期望${totalSongs}首，实际捕获${validCount}首`);
        
        // 如果捕获数量不足，最多重试2次，尽可能补全所有歌曲
        if (validCount < totalSongs && playRetryCount < 2) {
          playRetryCount++;
          currentPlayIndex = 0;
          console.log(`🔄 捕获数量不足，还差${totalSongs - validCount}首，开始第${playRetryCount}次重试`);
          // 重试前清空IndexedDB缓存，避免旧缓存影响新的资源捕获
          clearAudioDB().then(() => {
            setTimeout(() => {
              playNext();
            }, 1000); // 清空完成后延迟1秒开始重试
          });
        } else {
          stopAutoPlay();
          if (validCount < totalSongs) {
            console.log(`⚠️  获取完成，仍有${totalSongs - validCount}首歌曲捕获失败，可能是歌曲无有效资源或网络问题`);
          } else {
            console.log('✅ 全部获取完成，有效资源共', validCount, '首');
          }
        }
      });
      return;
    }

    const song = songList[currentPlayIndex];
    if (song && song.playBtn) {
      // 直接从列表项获取歌名和歌手，100%准确
      currentSongName = `${song.name}-${song.singer}`;
      // 通知background更新当前歌曲名
      chrome.runtime.sendMessage({
        action: 'updateSongName',
        songName: currentSongName
      });
      
      // 模拟点击播放按钮
      song.playBtn.click();
      console.log('▶️ 正在播放第', currentPlayIndex + 1, '首:', currentSongName);
    }

    currentPlayIndex++;
  }

  // 清空qma_db.audio数据库
  function clearAudioDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('qma_db');
      
      request.onsuccess = function(event) {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('audio')) {
          db.close();
          resolve(true);
          return;
        }
        
        try {
          const transaction = db.transaction('audio', 'readwrite');
          const objectStore = transaction.objectStore('audio');
          const clearRequest = objectStore.clear();
          
          clearRequest.onsuccess = function() {
            console.log('🗑️ qma_db.audio 数据库已清空');
            db.close();
            resolve(true);
          };
          
          clearRequest.onerror = function(err) {
            console.error('❌ 清空数据库失败:', err);
            db.close();
            resolve(false);
          };
        } catch (err) {
          console.error('❌ 清空数据库异常:', err);
          db.close();
          resolve(false);
        }
      };
      
      request.onerror = function(err) {
        console.error('❌ 打开数据库失败:', err);
        resolve(false);
      };
    });
  }

  function startAutoPlay() {
    if (isPlaying) {
      return { success: false, message: '已经在播放中' };
    }

    const list = parseSongList();
    if (list.length === 0) {
      return { success: false, message: '未找到歌曲列表' };
    }

    // 开始播放前先清空数据库
    clearAudioDB().then(() => {
      isPlaying = true;
      currentPlayIndex = 0;
      playRetryCount = 0; // 重置重试计数
      console.log('▶️ 开始自动播放，共', list.length, '首歌曲');

      // 立即播放第一首
      playNext();

      // 每2秒播放下一首
      autoPlayTimer = setInterval(() => {
        playNext();
      }, 2000);
    });

    return {
      success: true,
      total: list.length
    };
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
    isPlaying = false;
    console.log('⏸️ 自动播放已停止');
  }

  // 页面卸载时自动停止
  window.addEventListener('beforeunload', () => {
    stopAutoPlay();
  });

  function init() {
    if (!isQQMusicPage()) return;
    console.log('QQ音乐自动播放模块已加载');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();