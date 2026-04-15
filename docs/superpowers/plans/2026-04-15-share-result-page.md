# Share Result Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a share-result page that users land on after successful video/photo upload, encouraging them to share to WeChat groups for bonus rewards.

**Architecture:** New page `pages/share-result/share-result` receives `type` (video|photo) and `mediaPath` via URL query. Upload success handlers in record-video and take-photo are modified to `wx.redirectTo` this page instead of showing toast + navigateBack.

**Tech Stack:** WeChat Mini Program (WXML/WXSS/JS), WeChat Share API (`onShareAppMessage` + `<button open-type="share">`)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `images/share/bg.png` | Create (copy) | Yellow gradient background |
| `images/share/reward-icon.png` | Create (copy) | Red envelope reward icon |
| `images/share/play-btn.png` | Create (copy) | Video play button overlay |
| `pages/share-result/share-result.json` | Create | Page config (nav title) |
| `pages/share-result/share-result.wxml` | Create | Page template |
| `pages/share-result/share-result.wxss` | Create | Page styles |
| `pages/share-result/share-result.js` | Create | Page logic (params, share, navigation) |
| `app.json` | Modify | Register new page in pages array |
| `pages/record-video/record-video.js` | Modify | Upload success → redirectTo share-result |
| `pages/take-photo/take-photo.js` | Modify | Upload success → redirectTo share-result |

---

### Task 1: Copy image assets

**Files:**
- Create: `images/share/bg.png`
- Create: `images/share/reward-icon.png`
- Create: `images/share/play-btn.png`

- [ ] **Step 1: Create images/share directory and copy assets**

```bash
mkdir -p images/share
cp "/Users/weixi1/Downloads/分享3_slices/Group 1321314654@2x.png" images/share/bg.png
cp "/Users/weixi1/Downloads/分享3_slices/Group 1321314959@2x.png" images/share/reward-icon.png
cp "/Users/weixi1/Downloads/分享3_slices/Frame@2x.png" images/share/play-btn.png
```

- [ ] **Step 2: Verify files exist**

```bash
ls -la images/share/
```

Expected: 3 files — bg.png, reward-icon.png, play-btn.png

- [ ] **Step 3: Commit**

```bash
git add images/share/
git commit -m "chore: add share page image assets"
```

---

### Task 2: Register page in app.json

**Files:**
- Modify: `app.json:2-9` (pages array)

- [ ] **Step 1: Add share-result to pages array**

In `app.json`, add `"pages/share-result/share-result"` after `"pages/reward-records/reward-records"`:

```json
"pages": [
    "pages/index/index",
    "pages/record-video/record-video",
    "pages/take-photo/take-photo",
    "pages/mine/mine",
    "pages/upload-history/upload-history",
    "pages/reward-records/reward-records",
    "pages/share-result/share-result"
],
```

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "chore: register share-result page in app.json"
```

---

### Task 3: Create share-result page skeleton (json + wxml + wxss + js)

**Files:**
- Create: `pages/share-result/share-result.json`
- Create: `pages/share-result/share-result.wxml`
- Create: `pages/share-result/share-result.wxss`
- Create: `pages/share-result/share-result.js`

- [ ] **Step 1: Create page config**

Create `pages/share-result/share-result.json`:

```json
{
  "navigationBarTitleText": "一起拍事故",
  "navigationBarBackgroundColor": "#f9f4a2",
  "navigationBarTextStyle": "black"
}
```

- [ ] **Step 2: Create page template**

Create `pages/share-result/share-result.wxml`:

```xml
<view class="page">
  <!-- 黄色渐变背景 -->
  <image class="page-bg" src="/images/share/bg.png" mode="aspectFill" />

  <!-- 白色主卡片 -->
  <view class="card">
    <!-- 奖励图标 -->
    <image class="reward-icon" src="/images/share/reward-icon.png" mode="aspectFit" />

    <!-- 文案 -->
    <view class="reward-text">
      <text class="reward-line">每次分享到群</text>
      <view class="reward-line">
        <text>增加</text>
        <text class="reward-highlight">20%—50%</text>
        <text>奖励</text>
      </view>
    </view>

    <!-- 缩略图区域 -->
    <view class="media-preview">
      <!-- 视频: 用 video 组件 + 自定义播放按钮叠加 -->
      <block wx:if="{{type === 'video'}}">
        <video
          class="media-thumb"
          src="{{mediaPath}}"
          controls="{{false}}"
          show-center-play-btn="{{false}}"
          show-play-btn="{{false}}"
          show-fullscreen-btn="{{false}}"
          object-fit="cover"
          autoplay="{{false}}"
        />
        <image class="play-btn" src="/images/share/play-btn.png" mode="aspectFit" />
      </block>
      <!-- 照片: 直接显示第一张照片 -->
      <block wx:else>
        <image class="media-thumb" src="{{mediaPath}}" mode="aspectFill" />
      </block>
    </view>

    <!-- 立即分享按钮 -->
    <button class="btn-share" open-type="share">立即分享</button>

    <!-- 底部两个按钮 -->
    <view class="btn-row">
      <view class="btn-retake" bindtap="onRetake">{{type === 'video' ? '重新拍摄' : '重新拍照'}}</view>
      <view class="btn-history" bindtap="onViewHistory">查看视频</view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Create page styles**

Create `pages/share-result/share-result.wxss`:

```css
/* ===== 分享结果页 ===== */
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}

/* 黄色渐变背景图 */
.page-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

/* 白色主卡片 */
.card {
  position: relative;
  z-index: 1;
  width: 686rpx;
  margin-top: 40rpx;
  padding: 48rpx 56rpx 60rpx;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0rpx 0rpx 48rpx 0rpx #F2EC87;
  border-radius: 20rpx;
  border: 4rpx solid #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 奖励图标 */
.reward-icon {
  width: 157rpx;
  height: 170rpx;
  margin-bottom: 20rpx;
}

/* 奖励文案 */
.reward-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.reward-line {
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 40rpx;
  color: #262626;
  text-align: center;
  line-height: 60rpx;
}

.reward-highlight {
  color: #FF4D4F;
}

/* 缩略图区域 */
.media-preview {
  width: 574rpx;
  height: 322rpx;
  border-radius: 24rpx;
  overflow: hidden;
  position: relative;
  margin-bottom: 48rpx;
}

.media-thumb {
  width: 100%;
  height: 100%;
  display: block;
}

.play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80rpx;
  height: 80rpx;
}

/* 立即分享按钮 */
.btn-share {
  width: 574rpx;
  height: 110rpx;
  background: linear-gradient(136deg, #FFC940 0%, #FFECAB 100%);
  border-radius: 24rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 36rpx;
  color: #010005;
  line-height: 110rpx;
  text-align: center;
  border: none;
  padding: 0;
  margin: 0 0 24rpx 0;
}

/* 微信按钮默认样式覆盖 */
.btn-share::after {
  border: none;
}

/* 底部按钮行 */
.btn-row {
  display: flex;
  justify-content: space-between;
  width: 574rpx;
}

.btn-retake {
  width: 280rpx;
  height: 110rpx;
  border-radius: 24rpx;
  border: 2rpx solid #E8D28A;
  background: rgba(255, 249, 219, 0.6);
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 36rpx;
  color: #B78A16;
  line-height: 110rpx;
  text-align: center;
}

.btn-history {
  width: 280rpx;
  height: 110rpx;
  border-radius: 24rpx;
  background: linear-gradient(136deg, #FFC940 0%, #FFECAB 100%);
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 36rpx;
  color: #010005;
  line-height: 110rpx;
  text-align: center;
}
```

- [ ] **Step 4: Create page logic**

Create `pages/share-result/share-result.js`:

```javascript
Page({
  data: {
    type: 'video',    // 'video' | 'photo'
    mediaPath: ''     // 视频路径或照片路径
  },

  onLoad(options) {
    const type = options.type || 'video'
    const mediaPath = options.mediaPath ? decodeURIComponent(options.mediaPath) : ''
    this.setData({ type, mediaPath })
  },

  // 立即分享 — 由 <button open-type="share"> 触发
  onShareAppMessage() {
    return {
      title: '一起拍事故，领取现金奖励！',
      path: '/pages/index/index'
    }
  },

  // 重新拍照/重新拍摄
  onRetake() {
    const url = this.data.type === 'video'
      ? '/pages/record-video/record-video'
      : '/pages/take-photo/take-photo'
    wx.redirectTo({ url })
  },

  // 查看视频 → 上传记录页
  onViewHistory() {
    wx.redirectTo({ url: '/pages/upload-history/upload-history' })
  }
})
```

- [ ] **Step 5: Commit**

```bash
git add pages/share-result/
git commit -m "feat: add share-result page with UI and interaction logic"
```

---

### Task 4: Modify record-video.js upload success handler

**Files:**
- Modify: `pages/record-video/record-video.js:333-339`

- [ ] **Step 1: Replace upload success callback**

In `pages/record-video/record-video.js`, find lines 333-339:

```javascript
      wx.requestSubscribeMessage({
        tmplIds: [config.subscribeTemplateId],
        success() { },
        fail() { }
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
```

Replace with:

```javascript
      wx.requestSubscribeMessage({
        tmplIds: [config.subscribeTemplateId],
        success() { },
        fail() { }
      })
      const mediaPath = encodeURIComponent(this.data.videoPath || '')
      wx.redirectTo({
        url: '/pages/share-result/share-result?type=video&mediaPath=' + mediaPath
      })
```

- [ ] **Step 2: Commit**

```bash
git add pages/record-video/record-video.js
git commit -m "feat: redirect to share-result page after video upload success"
```

---

### Task 5: Modify take-photo.js upload success handler

**Files:**
- Modify: `pages/take-photo/take-photo.js:130-136`

- [ ] **Step 1: Replace upload success callback**

In `pages/take-photo/take-photo.js`, find lines 130-136:

```javascript
      wx.requestSubscribeMessage({
        tmplIds: [config.subscribeTemplateId],
        success() { },
        fail() { }
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
```

Replace with:

```javascript
      wx.requestSubscribeMessage({
        tmplIds: [config.subscribeTemplateId],
        success() { },
        fail() { }
      })
      const mediaPath = encodeURIComponent(this.data.photos[0] || '')
      wx.redirectTo({
        url: '/pages/share-result/share-result?type=photo&mediaPath=' + mediaPath
      })
```

- [ ] **Step 2: Commit**

```bash
git add pages/take-photo/take-photo.js
git commit -m "feat: redirect to share-result page after photo upload success"
```

---

### Task 6: Manual QA verification

- [ ] **Step 1: Verify video flow**

1. Open WeChat DevTools, run mini program
2. Go to record-video page, record/select a video
3. Upload → should redirect to share-result page
4. Check: reward icon visible, video thumbnail with play button overlay, "重新拍摄" text on left button
5. Tap "立即分享" → WeChat share dialog opens
6. Tap "重新拍摄" → redirects to record-video page
7. Tap "查看视频" → redirects to upload-history page

- [ ] **Step 2: Verify photo flow**

1. Go to take-photo page, take/select photos
2. Upload → should redirect to share-result page
3. Check: first photo displayed (no play button), "重新拍照" text on left button
4. Tap "立即分享" → WeChat share dialog opens
5. Tap "重新拍照" → redirects to take-photo page
6. Tap "查看视频" → redirects to upload-history page

- [ ] **Step 3: Visual check against design**

Compare share-result page against design image (`/Users/weixi1/Downloads/分享3.png`):
- Yellow background
- White card with shadow
- Reward icon position and size
- Text sizing and color (especially red "20%—50%")
- Button styles match design (golden gradient for share + history, cream/bordered for retake)
