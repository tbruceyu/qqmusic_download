(function() {
  function parseCookieString(cookieString) {
    if (!cookieString || typeof cookieString !== 'string') {
      return {};
    }

    const cookie = {};
    const pairs = cookieString.split(';');

    for (const pair of pairs) {
      const [name, ...valueParts] = pair.split('=');
      if (name && valueParts.length > 0) {
        const trimmedName = name.trim();
        const value = valueParts.join('=').trim();
        cookie[trimmedName] = decodeURIComponent(value);
      }
    }

    return cookie;
  }

  function validateCookie(cookieString) {
    const cookie = parseCookieString(cookieString);

    const requiredFields = ['uin', 'qzdata_version'];
    const hasRequired = requiredFields.every(field => cookie[field]);

    if (!hasRequired) {
      return {
        valid: false,
        message: 'Cookie缺少必要字段'
      };
    }

    const uinPattern = /^\d+$/;
    if (!uinPattern.test(cookie.uin)) {
      return {
        valid: false,
        message: 'uin格式不正确'
      };
    }

    return {
      valid: true,
      message: 'Cookie有效',
      uin: cookie.uin
    };
  }

  async function saveCookieToStorage(cookieString) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ cookie: cookieString }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async function getCookieFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['cookie'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.cookie || null);
        }
      });
    });
  }

  async function getCookieFromQQMusic() {
    return new Promise((resolve, reject) => {
      chrome.cookies.get({
        url: 'https://y.qq.com/',
        name: 'qqMusic_key'
      }, (cookie) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (cookie) {
          resolve(cookie.value);
        } else {
          resolve(null);
        }
      });
    });
  }

  window.CookieManager = {
    parseCookieString,
    validateCookie,
    saveCookieToStorage,
    getCookieFromStorage,
    getCookieFromQQMusic
  };
})();