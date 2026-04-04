# QQ音乐自动下载插件 - 实现计划

## 项目概述
开发一款 Chrome 浏览器插件，当用户在 QQ 音乐网站 (https://y.qq.com/n/ryqq_v2/player) 在线听歌时，能够自动下载当前播放列表中的歌曲。

## 技术方案

### 实现方式
- **Chrome Extension Manifest V3** (最新版本)
- 前端页面：HTML + CSS + JavaScript (原生)
- 背景服务：Service Worker
- 内容脚本：注入 QQ 音乐页面

### 核心功能点

#### 1. 播放列表获取
- 通过内容脚本监听 QQ 音乐页面的 DOM 变化
- 解析当前播放列表中的歌曲信息（歌名、歌手、歌曲ID）
- 捕获页面中的音频源地址或通过 API 获取下载链接

#### 2. 歌曲下载功能
- 支持 128kbps 和 320kbps 两种音质选择
- 使用 Chrome Downloads API 触发下载
- 文件命名格式：`歌手 - 歌名.mp3`

#### 3. Cookie 设置界面
- 弹出式 Popup 页面
- 设置 QQ 音乐登录后的 Cookie（用于 VIP 权限）
- Cookie 保存到 Chrome Storage
- Cookie 有效性验证

#### 4. 下载控制
- 批量下载当前播放列表
- 下载进度显示
- 下载历史记录

---

## 文件结构规划

```
qqmusic-downloader/
├── manifest.json                 # 插件配置文件
├── popup/
│   ├── popup.html               # 插件弹窗界面
│   ├── popup.css                # 弹窗样式
│   └── popup.js                 # 弹窗逻辑
├── content/
│   └── content.js               # 内容脚本（注入QQ音乐页面）
├── background/
│   └── background.js            # Service Worker（后台服务）
├── styles/
│   └── common.css               # 通用样式
├── icons/
│   ├── icon16.png               # 16x16 图标
│   ├── icon48.png               # 48x48 图标
│   └── icon128.png              # 128x128 图标
└── utils/
    ├── cookie-manager.js        # Cookie 管理工具
    └── song-parser.js           # 歌曲信息解析工具
```

---

## 实现步骤

### 第一步：项目初始化与配置
1. 创建项目目录结构
2. 编写 `manifest.json`（声明权限、图标、弹出页面等）
3. 配置 Content Security Policy

### 第二步：Popup 界面开发
1. 创建 `popup.html` - 包含：
   - Cookie 设置入口
   - 音质选择（128k/320k 单选框）
   - 当前播放列表显示区域
   - 下载按钮
   - 下载状态显示
2. 编写 `popup.css` - 样式美化
3. 实现 `popup.js` - 交互逻辑

### 第三步：内容脚本开发
1. 创建 `content.js`
2. 实现功能：
   - 监听 QQ 音乐页面 DOM 变化
   - 解析播放列表数据（歌曲名、歌手、mid）
   - 获取歌曲源地址
   - 与 background script 通信

### 第四步：后台 Service Worker 开发
1. 创建 `background.js`
2. 实现功能：
   - 接收来自 content script 的下载请求
   - 调用 Chrome Downloads API
   - 管理下载任务状态

### 第五步：Cookie 管理功能
1. 创建 `cookie-manager.js`
2. 实现功能：
   - 从 QQ 音乐域名读取 Cookie
   - 验证 Cookie 有效性
   - 保存/读取 Cookie 到 Chrome Storage

### 第六步：工具函数开发
1. 创建 `song-parser.js`
2. 实现歌曲信息解析和数据格式化

---

## 关键技术与注意事项

### QQ 音乐网站特殊处理
- QQ 音乐使用 React 构建，DOM 结构复杂，需要使用 MutationObserver 监听变化
- 音频源地址可能需要通过特定的 API 接口获取
- Cookie 包含登录态信息，需要用户手动粘贴或从页面导入

### Chrome Extension 权限
- `downloads`：下载功能
- `storage`：本地存储设置
- `activeTab`：访问当前标签页
- `scripting`：注入内容脚本
- `cookies`：读取 Cookie（需声明域名）
- Host Permissions: `https://y.qq.com/*`

### VIP 权限说明
- 128k 音质：普通用户可用
- 320k 音质：需要 VIP Cookie 才能获取
- 需要提示用户登录 QQ 音乐并提供 Cookie

---

## 验证方案
1. 加载插件到 Chrome（开发者模式）
2. 打开 QQ 音乐播放页面
3. 验证播放列表能否正确识别
4. 测试 Cookie 设置功能
5. 测试 128k 和 320k 下载功能
