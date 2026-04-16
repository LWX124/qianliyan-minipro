# Share Tracking Design

## Goal

Track user sharing behavior: optimistic count when user initiates share, precise count when shared link is opened by others. Display both counts in the admin accident list.

## Architecture

Two-layer tracking:

1. **Optimistic count** (`share_count`): Front-end calls API when user triggers share via `onShareAppMessage`. May over-count (user could cancel share sheet), but captures intent.
2. **Precise count** (`share_open_count`): Shared link includes `fromOpenId` param. When another user opens the link, front-end calls API to record. Self-opens excluded.

Admin sees both numbers in the accident list table.

## Data Storage

Add two columns to existing `biz_wx_user` table:

```sql
ALTER TABLE biz_wx_user
  ADD COLUMN share_count INT NOT NULL DEFAULT 0 COMMENT '分享发起次数（乐观计数）',
  ADD COLUMN share_open_count INT NOT NULL DEFAULT 0 COMMENT '分享被他人打开次数（精确计数）';
```

No new tables. Counts are user-level (not per-accident).

## Backend API

### 1. Record Share Action

```
POST /api/v1/wx/share/record?thirdSessionKey=xxx
```

- Auth: `thirdSessionKey` → resolve openid from Redis session
- Action: `UPDATE biz_wx_user SET share_count = share_count + 1 WHERE openid = ?`
- Response: `{ "errorCode": 0 }`
- No request body needed

### 2. Record Share Open

```
POST /api/v1/wx/share/open?thirdSessionKey=xxx
Content-Type: application/x-www-form-urlencoded

fromOpenId=oXXXXX
```

- Auth: `thirdSessionKey` → resolve current user's openid
- Validation: `fromOpenId != currentOpenId` (skip self-opens)
- Action: `UPDATE biz_wx_user SET share_open_count = share_open_count + 1 WHERE openid = ?` (where openid = fromOpenId)
- Response: `{ "errorCode": 0 }`
- If `fromOpenId` is missing or equals self: return success silently (no error, just no-op)

### 3. Admin Query Change

File: `AccdMapper.xml`

Add `d.share_count, d.share_open_count` to `Base_Column_List1` SQL fragment. Already joins `biz_wx_user d`, no new join needed.

## Admin Frontend

File: `accid.js`

Add two columns to `MgrAccd.initColumn`:

```javascript
{title: '分享次数', field: 'share_count', align: 'center', valign: 'middle', sortable: true},
{title: '被打开次数', field: 'share_open_count', align: 'center', valign: 'middle', sortable: true},
```

Position: after existing stats columns (上报总数/有效数/无效数).

## Mini-Program Changes

### 1. share-result.js — Record share on trigger

In `onShareAppMessage`, call share record API:

```javascript
onShareAppMessage() {
  const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
  request({
    url: '/api/v1/wx/share/record?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
    method: 'POST'
  })

  const openid = getApp().globalData.openid || ''
  return {
    title: '一起拍事故，领取现金奖励！',
    path: '/pages/index/index?fromOpenId=' + encodeURIComponent(openid)
  }
}
```

Fire-and-forget — don't block share flow on API response.

### 2. All onShareAppMessage — Add fromOpenId to path

Every page with `onShareAppMessage` (app.js global, index, mine, record-video) should include `fromOpenId` in the share path:

```javascript
onShareAppMessage() {
  const openid = getApp().globalData.openid || ''
  return {
    title: '...',
    path: '/pages/index/index?fromOpenId=' + encodeURIComponent(openid)
  }
}
```

### 3. index.js onLoad — Detect and report share open

```javascript
onLoad(options) {
  // ... existing logic ...
  if (options.fromOpenId) {
    this._reportShareOpen(options.fromOpenId)
  }
}

_reportShareOpen(fromOpenId) {
  const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
  if (!thirdSessionKey) return  // not logged in yet, skip
  request({
    url: '/api/v1/wx/share/open?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
    method: 'POST',
    header: { 'content-type': 'application/x-www-form-urlencoded' },
    data: 'fromOpenId=' + encodeURIComponent(fromOpenId)
  })
}
```

Fire-and-forget. Backend handles self-open exclusion.

### 4. Timing concern: index.js login flow

If user opens shared link but has no session yet, `thirdSessionKey` won't exist at `onLoad` time. Two options:

- **Option A (simple)**: Skip reporting if no session. Lose some data.
- **Option B (recommended)**: Save `fromOpenId` to a variable, report after login completes. In the login success callback, check if pending `fromOpenId` exists and report.

Use Option B: store `fromOpenId` on page instance, report after login flow completes.

## Edge Cases

1. **User shares but cancels**: `share_count` incremented (acceptable, it's "optimistic")
2. **Same person opens link multiple times**: Each open counts. Acceptable for now — could add dedup later if needed.
3. **User not logged in opens link**: Report after login completes (Option B above)
4. **fromOpenId user doesn't exist in biz_wx_user**: UPDATE affects 0 rows, no error. Silent no-op.

## Files Modified

### Backend (`icars-admin`)
- `BizWxUser.java` — Add `shareCount`, `shareOpenCount` fields
- `WxRestController.java` — Add two new endpoints
- `AccdMapper.xml` — Add columns to `Base_Column_List1`
- `accid.js` — Add two table columns
- New SQL migration script

### Mini-Program (`qianliyan-minipro`)
- `pages/share-result/share-result.js` — Add share record API call + fromOpenId in path
- `pages/index/index.js` — Detect fromOpenId, report share open
- `app.js` — Add fromOpenId to global onShareAppMessage path
- `pages/mine/mine.js` — Add fromOpenId to share path (if has onShareAppMessage)
- `pages/record-video/record-video.js` — Add fromOpenId to share path

## Out of Scope

- Per-accident share tracking (user-level only)
- Share deduplication (same recipient opening multiple times)
- Share reward calculation (separate feature)
- Share analytics dashboard (just two columns in existing table)
