# Share Result Page (上传成功分享页) Design Spec

## Overview

上传视频/照片成功后，跳转分享结果页，引导用户分享到群以获取额外奖励。

## Page

- Path: `pages/share-result/share-result`
- 注册到 `app.json` pages 数组

## Page Parameters (URL query)

| Param | Type | Description |
|-------|------|-------------|
| `type` | `"video"` \| `"photo"` | 来源类型，决定文案和缩略图展示方式 |
| `mediaPath` | string | 视频文件路径或第一张照片临时文件路径(encodeURIComponent) |

## Layout

```
┌─────────────────────────────────┐  黄色渐变背景(背景图 Group 1321314654@2x.png)
│                                 │
│  ┌───────────────────────────┐  │  白色卡片 686rpx×1270rpx
│  │                           │  │  background: rgba(255,255,255,0.95)
│  │                           │  │  box-shadow: 0rpx 0rpx 48rpx 0rpx #F2EC87
│  │     🎁 奖励图标           │  │  border: 4rpx solid #FFFFFF, radius: 20rpx
│  │   每次分享到群             │  │
│  │   增加20%—50%奖励         │  │  Group 1321314959@2x.png 157×170rpx
│  │                           │  │  "20%—50%" 红色高亮(#FF4D4F)
│  │  ┌─────────────────────┐  │  │
│  │  │   [缩略图/照片]      │  │  │  574×322rpx, radius: 24rpx
│  │  │      ▶ (视频才有)    │  │  │  视频: 叠加 Frame@2x.png 播放按钮居中
│  │  └─────────────────────┘  │  │  照片: 第一张照片，无播放按钮
│  │                           │  │
│  │  ┌─────────────────────┐  │  │  立即分享按钮 574×110rpx
│  │  │     立即分享          │  │  │  background: linear-gradient(136deg, #FFC940 0%, #FFECAB 100%)
│  │  └─────────────────────┘  │  │  radius: 24rpx, font: 36rpx weight:600 color:#010005
│  │                           │  │
│  │  ┌──────┐  ┌──────────┐  │  │  两个并排按钮 各280×110rpx
│  │  │重新拍照│  │ 查看视频  │  │  │  浅黄/奶油色背景+金色边框(以设计图为准)
│  │  └──────┘  └──────────┘  │  │  radius: 24rpx
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Bottom Buttons Dynamic Text

| type | Left Button | Right Button |
|------|-------------|--------------|
| `video` | 重新拍摄 | 查看视频 |
| `photo` | 重新拍照 | 查看视频 |

## Interaction Logic

### 立即分享

- 使用 `<button open-type="share">` 触发微信分享
- `onShareAppMessage` 返回小程序首页链接
- 分享标题/图片可自定义（如"一起拍事故，领取奖励"）

### 重新拍照/重新拍摄

- `wx.navigateBack()` 返回上一页（上传视频或上传照片页面）
- 因为用 `wx.redirectTo` 跳转到分享页，navigateBack 会回到拍摄页面的上一页
- 所以应改用 `wx.redirectTo` 回到对应页面：
  - type=video → `wx.redirectTo({ url: '/pages/record-video/record-video' })`
  - type=photo → `wx.redirectTo({ url: '/pages/take-photo/take-photo' })`

### 查看视频

- 跳转上传记录页面
- upload-history 是否为 tabBar 页面决定使用 `wx.switchTab` 或 `wx.redirectTo`
- 当前 app.json tabBar 只有 index 和 mine，所以用 `wx.redirectTo({ url: '/pages/upload-history/upload-history' })`

## Upload Flow Changes

### record-video.js (上传成功回调)

**Before:**
```javascript
wx.showToast({ title: '上传成功', icon: 'success' })
setTimeout(() => wx.navigateBack(), 1500)
```

**After:**
```javascript
// videoPath 已存在于 this.data.videoPath
const mediaPath = encodeURIComponent(this.data.videoPath || '')
wx.redirectTo({
  url: `/pages/share-result/share-result?type=video&mediaPath=${mediaPath}`
})
```

record-video 页面没有现成的封面路径，但有 `videoPath`。传 videoPath 到分享页，分享页用 `<video>` 组件 + `bindloadedmetadata` 截取首帧作为封面，或直接显示 video 组件的默认封面。简单方案：分享页缩略图区域用 `<video>` 组件设置 `show-center-play-btn="{{false}}"` 并叠加自定义播放图标，无需额外截帧。

### take-photo.js (上传成功回调)

**Before:**
```javascript
wx.showToast({ title: '上传成功', icon: 'success' })
setTimeout(() => wx.navigateBack(), 1500)
```

**After:**
```javascript
const mediaPath = encodeURIComponent(this.data.photos[0] || '')
wx.redirectTo({
  url: `/pages/share-result/share-result?type=photo&mediaPath=${mediaPath}`
})
```

### requestSubscribeMessage 保留

两个页面的 `wx.requestSubscribeMessage` 调用保留不变，在跳转前执行。

## Assets

从 `/Users/weixi1/Downloads/分享3_slices/` 复制到项目 `images/share/`:

| Source | Dest | Usage |
|--------|------|-------|
| `Group 1321314654@2x.png` | `images/share/bg.png` | 页面黄色背景 |
| `Group 1321314959@2x.png` | `images/share/reward-icon.png` | 奖励图标(红包) |
| `Frame@2x.png` | `images/share/play-btn.png` | 视频播放按钮 |

## Files to Create

- `pages/share-result/share-result.js`
- `pages/share-result/share-result.json`
- `pages/share-result/share-result.wxml`
- `pages/share-result/share-result.wxss`

## Files to Modify

- `app.json` — 添加 `pages/share-result/share-result` 到 pages 数组
- `pages/record-video/record-video.js` — 上传成功后 redirectTo 分享页
- `pages/take-photo/take-photo.js` — 上传成功后 redirectTo 分享页
