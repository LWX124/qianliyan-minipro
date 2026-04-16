# Share Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track user sharing behavior (optimistic + precise counts) and display in admin accident list.

**Architecture:** Add two columns to `biz_wx_user`, two new API endpoints in `WxRestController`, update admin SQL/JS to show counts, modify mini-program to call APIs and pass `fromOpenId` in share paths.

**Tech Stack:** Spring Boot / MyBatis-Plus (backend), WeChat Mini Program (frontend), MySQL

---

### Task 1: Database Migration — Add share columns to biz_wx_user

**Files:**
- Create: `backend/sql/add_share_columns.sql`

- [ ] **Step 1: Create migration SQL script**

```sql
ALTER TABLE biz_wx_user
  ADD COLUMN share_count INT NOT NULL DEFAULT 0 COMMENT '分享发起次数（乐观计数）',
  ADD COLUMN share_open_count INT NOT NULL DEFAULT 0 COMMENT '分享被他人打开次数（精确计数）';
```

Save to: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/sql/add_share_columns.sql`

- [ ] **Step 2: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/backend
git add sql/add_share_columns.sql
git commit -m "feat: add share_count and share_open_count columns to biz_wx_user"
```

**Note:** The SQL needs to be executed on the database manually. This task only creates the script file.

---

### Task 2: Backend — BizWxUser entity + mapper + service layer

**Files:**
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/model/BizWxUser.java`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/dao/BizWxUserMapper.java`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/dao/mapping/BizWxUserMapper.xml`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/service/IBizWxUserService.java`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/service/impl/BizWxUserServiceImpl.java`

- [ ] **Step 1: Add fields to BizWxUser.java**

Add after the `version` field (line 79), before the `userType` field:

```java
    /**
     * 分享发起次数（乐观计数）
     */
    @TableField("share_count")
    private Integer shareCount;

    /**
     * 分享被他人打开次数（精确计数）
     */
    @TableField("share_open_count")
    private Integer shareOpenCount;
```

Add getter/setter methods after the existing getters/setters (before `pkVal()`):

```java
    public Integer getShareCount() {
        return shareCount;
    }

    public void setShareCount(Integer shareCount) {
        this.shareCount = shareCount;
    }

    public Integer getShareOpenCount() {
        return shareOpenCount;
    }

    public void setShareOpenCount(Integer shareOpenCount) {
        this.shareOpenCount = shareOpenCount;
    }
```

- [ ] **Step 2: Add mapper methods in BizWxUserMapper.java**

Add two methods to the interface:

```java
    int incrementShareCount(@Param("openid") String openid);

    int incrementShareOpenCount(@Param("openid") String openid);
```

- [ ] **Step 3: Add SQL in BizWxUserMapper.xml**

Add before the closing `</mapper>` tag:

```xml
    <update id="incrementShareCount">
        update biz_wx_user set share_count = share_count + 1 where openid = #{openid}
    </update>

    <update id="incrementShareOpenCount">
        update biz_wx_user set share_open_count = share_open_count + 1 where openid = #{openid}
    </update>
```

- [ ] **Step 4: Add service interface methods in IBizWxUserService.java**

```java
    int incrementShareCount(String openid);

    int incrementShareOpenCount(String openid);
```

- [ ] **Step 5: Add service implementation in BizWxUserServiceImpl.java**

```java
    @Override
    public int incrementShareCount(String openid) {
        return this.baseMapper.incrementShareCount(openid);
    }

    @Override
    public int incrementShareOpenCount(String openid) {
        return this.baseMapper.incrementShareOpenCount(openid);
    }
```

- [ ] **Step 6: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/backend
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/model/BizWxUser.java
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/dao/BizWxUserMapper.java
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/dao/mapping/BizWxUserMapper.xml
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/service/IBizWxUserService.java
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/service/impl/BizWxUserServiceImpl.java
git commit -m "feat: add share count increment methods to BizWxUser service layer"
```

---

### Task 3: Backend — API endpoints in WxRestController

**Files:**
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/controller/WxRestController.java`

- [ ] **Step 1: Add share record endpoint**

Add to WxRestController (find a suitable location, e.g., near other user-related endpoints):

```java
    /**
     * 记录用户分享动作（乐观计数）
     */
    @PostMapping("/api/v1/wx/share/record")
    public Object recordShare(@RequestParam String thirdSessionKey) {
        WxSession wxSession = wxService.getWxSession(thirdSessionKey);
        if (wxSession == null) {
            return renderError(530, "session expired");
        }
        bizWxUserService.incrementShareCount(wxSession.getOpenId());
        return renderSuccess();
    }
```

- [ ] **Step 2: Add share open endpoint**

```java
    /**
     * 记录分享被他人打开（精确计数）
     */
    @PostMapping("/api/v1/wx/share/open")
    public Object recordShareOpen(@RequestParam String thirdSessionKey,
                                  @RequestParam(required = false) String fromOpenId) {
        if (StringUtils.isBlank(fromOpenId)) {
            return renderSuccess();
        }
        WxSession wxSession = wxService.getWxSession(thirdSessionKey);
        if (wxSession == null) {
            return renderError(530, "session expired");
        }
        // 排除自己打开自己的分享链接
        if (fromOpenId.equals(wxSession.getOpenId())) {
            return renderSuccess();
        }
        bizWxUserService.incrementShareOpenCount(fromOpenId);
        return renderSuccess();
    }
```

- [ ] **Step 3: Verify renderSuccess/renderError pattern**

The controller extends `BaseController`. Check that `renderSuccess()` and `renderError(int, String)` methods exist. Based on existing code patterns (e.g., `return new SuccessResponseData();`), adjust if needed. If `renderSuccess/renderError` don't exist, use the pattern seen in other endpoints:

```java
    // Alternative if renderSuccess doesn't exist:
    JSONObject result = new JSONObject();
    result.put("errorCode", 0);
    return result;
```

- [ ] **Step 4: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/backend
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/controller/WxRestController.java
git commit -m "feat: add share tracking API endpoints"
```

---

### Task 4: Backend — Admin SQL + JS for share count display

**Files:**
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/dao/mapping/AccdMapper.xml`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/webapp/static/modular/biz/accd/accid.js`

- [ ] **Step 1: Add share columns to AccdMapper.xml Base_Column_List1**

In AccdMapper.xml, find the `Base_Column_List1` SQL fragment (line 24-28). Change:

```xml
    <sql id="Base_Column_List1">
        a.id, a.openid, a.video, a.lng, a.lat, a.createTime, a.checkId, a.address, a.reason,a.realness, a.source,
        a.checkTime, a.status, a.version, c.name, d.phone, d.wxname, d.blackList, v.total as totalAcc, v.exist, v.notexist,
        m.amount, p.amount as backAmount
    </sql>
```

To:

```xml
    <sql id="Base_Column_List1">
        a.id, a.openid, a.video, a.lng, a.lat, a.createTime, a.checkId, a.address, a.reason,a.realness, a.source,
        a.checkTime, a.status, a.version, c.name, d.phone, d.wxname, d.blackList, d.share_count as shareCount, d.share_open_count as shareOpenCount, v.total as totalAcc, v.exist, v.notexist,
        m.amount, p.amount as backAmount
    </sql>
```

- [ ] **Step 2: Add table columns in accid.js**

In `MgrAccd.initColumn`, add two columns after the `notexist` column (after the line with `{title: '无效数', field: 'notexist', ...}`):

```javascript
        {title: '分享次数', field: 'shareCount', align: 'center', valign: 'middle', sortable: true},
        {title: '被打开次数', field: 'shareOpenCount', align: 'center', valign: 'middle', sortable: true},
```

- [ ] **Step 3: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/backend
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/dao/mapping/AccdMapper.xml
git add icars-master/icars-master/icars-admin/src/main/webapp/static/modular/biz/accd/accid.js
git commit -m "feat: display share counts in admin accident list"
```

---

### Task 5: Mini-Program — Add fromOpenId to all onShareAppMessage paths

**Files:**
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro/app.js`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro/pages/index/index.js`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro/pages/mine/mine.js`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro/pages/record-video/record-video.js`
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro/pages/share-result/share-result.js`

- [ ] **Step 1: Store openid in app.globalData**

In `app.js`, the login success handler (line 141-154) already stores `thirdSessionKey`. We need openid too. The backend `getSession` API response includes the openid. Check what `loginRes.data.data` contains.

Actually, openid is available from the WxSession on the backend side but may not be returned to the frontend. Instead of relying on openid from login response, we can use the `thirdSessionKey` as a proxy — the backend will resolve it.

But for the share path, we need an identifier to embed. Options:
- Use `thirdSessionKey` as fromUser identifier → but it expires, not good
- Request openid from backend and cache it → extra API call
- Use a simpler approach: use the user's `userId` from login response

Looking at app.js line 147: `userId: userData.userId || 0` — userId is already stored in globalData.

**Decision:** Use userId instead of openid for the share path. It's already available in `app.globalData.userInfo.userId`. Backend can look up openid from userId.

Wait — looking at `biz_wx_user`, there's no simple userId → openid mapping in the current code. The `id` field in biz_wx_user is auto-increment, and the login response's userId comes from `getSession` which creates the WxSession.

**Better approach:** Have the backend return the openid in the getSession response, and store it in globalData. Let me check what getSession returns...

Actually, the simplest approach: add `openid` to app.globalData. The getSession response likely includes it. If not, we need to add it.

For now, let's use `thirdSessionKey` to identify the sharer — the backend `/api/v1/wx/share/open` endpoint can accept `fromThirdSessionKey` but that expires...

**Final decision:** The cleanest approach is to store the wx user's `id` (integer) from biz_wx_user in globalData, and use that in share links. The backend can look up openid from this id. OR, even simpler: have the backend return openid in getSession response (it likely already has it since it creates a WxSession with openid).

Let me look at what getSession returns. From the login handler in app.js:
```javascript
loginRes.data.data.sessionId  // thirdSessionKey
userData.userId               // some user id
userData.wxname               // nickname
userData.headImg              // avatar
```

The getSession endpoint in WxRestController returns WxSession data. Let me check if openid is included...

**Simplest approach:** Store the biz_wx_user openid in globalData. The WxService.createWxSession already creates a session with the openid. We just need to make sure the getSession API response includes it, and store it client-side. If it's not returned, we need to add it to the response.

For now, let's assume we'll add `openid` to the getSession response and store it in globalData. If it's already there, even better.

Actually, looking more carefully — the mini-program never needs to know its own openid for normal operations. But for share tracking, we need to embed the sharer's identity in the link. The backend resolves `thirdSessionKey` → openid, but thirdSessionKey expires and changes between sessions.

**REVISED APPROACH:** Instead of embedding openid in the share path (which the frontend doesn't have), embed the biz_wx_user `id` (which is already returned as `userId` in the login response).

Then the backend `/api/v1/wx/share/open` endpoint accepts `fromUserId` (integer), looks up the openid from biz_wx_user where id=fromUserId, and increments share_open_count.

This is cleaner because:
1. userId is already available in `app.globalData.userInfo.userId`
2. No need to expose openid to the frontend
3. userId is stable (doesn't expire like thirdSessionKey)

- [ ] **Step 1: Update app.js onShareAppMessage**

Change line 232-236 from:
```javascript
  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
```

To:
```javascript
  onShareAppMessage() {
    const userId = this.globalData.userInfo.userId || ''
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index?fromUserId=' + userId
    }
  }
```

- [ ] **Step 2: Update index.js onShareAppMessage**

Change from:
```javascript
  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
```

To:
```javascript
  onShareAppMessage() {
    const userId = app.globalData.userInfo.userId || ''
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index?fromUserId=' + userId
    }
  }
```

- [ ] **Step 3: Update mine.js onShareAppMessage**

Change from:
```javascript
  onShareAppMessage() {
    return { title: '拍事故 - 事故快拍', path: '/pages/index/index' }
  }
```

To:
```javascript
  onShareAppMessage() {
    const app = getApp()
    const userId = app.globalData.userInfo.userId || ''
    return { title: '拍事故 - 事故快拍', path: '/pages/index/index?fromUserId=' + userId }
  }
```

Note: Check if `app` or `getApp()` is already available at the top of mine.js. If `const app = getApp()` is already defined at the top, just use `app.globalData.userInfo.userId`.

- [ ] **Step 4: Update record-video.js onShareAppMessage**

`const app = getApp()` is already at line 3 of record-video.js.

Change from:
```javascript
  onShareAppMessage() {
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index'
    }
  }
```

To:
```javascript
  onShareAppMessage() {
    const userId = app.globalData.userInfo.userId || ''
    return {
      title: '拍事故 - 事故快拍',
      path: '/pages/index/index?fromUserId=' + userId
    }
  }
```

- [ ] **Step 5: Update share-result.js onShareAppMessage + add share record API call**

This is the main share page. Add `request` import and share recording.

Add at top of file:
```javascript
const { request } = require('../../utils/request')
```

Change onShareAppMessage from:
```javascript
  onShareAppMessage() {
    return {
      title: '一起拍事故，领取现金奖励！',
      path: '/pages/index/index'
    }
  },
```

To:
```javascript
  onShareAppMessage() {
    // 记录分享动作（乐观计数，fire-and-forget）
    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    if (thirdSessionKey) {
      request({
        url: '/api/v1/wx/share/record?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
        method: 'POST'
      }).catch(() => {})
    }

    const app = getApp()
    const userId = app.globalData.userInfo.userId || ''
    return {
      title: '一起拍事故，领取现金奖励！',
      path: '/pages/index/index?fromUserId=' + userId
    }
  },
```

- [ ] **Step 6: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro
git add app.js pages/index/index.js pages/mine/mine.js pages/record-video/record-video.js pages/share-result/share-result.js
git commit -m "feat: add fromUserId to share paths and record share action"
```

---

### Task 6: Mini-Program — Detect fromUserId on index page and report share open

**Files:**
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro/pages/index/index.js`

- [ ] **Step 1: Update onLoad to detect fromUserId**

Change onLoad from:
```javascript
  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarHeight = sysInfo.statusBarHeight || 20
    const navBarHeight = statusBarHeight + 44
    this.setData({ statusBarHeight, navBarHeight })
  },
```

To:
```javascript
  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarHeight = sysInfo.statusBarHeight || 20
    const navBarHeight = statusBarHeight + 44
    this.setData({ statusBarHeight, navBarHeight })

    // 检测分享链接打开
    if (options.fromUserId) {
      this._pendingFromUserId = options.fromUserId
      this._tryReportShareOpen()
    }
  },
```

- [ ] **Step 2: Add _tryReportShareOpen method**

Add after closePhoneModal method:

```javascript
  // 尝试上报分享被打开（需要登录后才能调用）
  _tryReportShareOpen() {
    const fromUserId = this._pendingFromUserId
    if (!fromUserId) return

    const thirdSessionKey = wx.getStorageSync('thirdSessionKey') || ''
    if (!thirdSessionKey) {
      // 未登录，等登录完成后再上报
      // app.js login flow 会设置 thirdSessionKey，在 onShow 时重试
      return
    }

    this._pendingFromUserId = null
    request({
      url: '/api/v1/wx/share/open?thirdSessionKey=' + encodeURIComponent(thirdSessionKey),
      method: 'POST',
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      data: 'fromUserId=' + encodeURIComponent(fromUserId)
    }).catch(() => {})
  },
```

- [ ] **Step 3: Add retry in onShow for delayed login**

In the existing onShow method, add a retry check:

Change from:
```javascript
  onShow() {
    this._requestLocation()
    this._checkPhoneForReturningUser()
  },
```

To:
```javascript
  onShow() {
    this._requestLocation()
    this._checkPhoneForReturningUser()

    // 分享打开上报重试（首次打开时可能尚未登录）
    if (this._pendingFromUserId) {
      this._tryReportShareOpen()
    }
  },
```

- [ ] **Step 4: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/qianliyan-minipro
git add pages/index/index.js
git commit -m "feat: detect and report share link opens on index page"
```

---

### Task 7: Backend — Update share/open endpoint to accept fromUserId

Since Task 3 was designed with `fromOpenId`, but Task 5-6 use `fromUserId` (the biz_wx_user.id), we need to adjust the backend endpoint.

**Files:**
- Modify: `/Users/weixi1/Documents/PartWorkspace/qianliyan/backend/icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/controller/WxRestController.java`

- [ ] **Step 1: Update the share/open endpoint to use fromUserId**

Replace the endpoint from Task 3 Step 2 with:

```java
    /**
     * 记录分享被他人打开（精确计数）
     */
    @PostMapping("/api/v1/wx/share/open")
    public Object recordShareOpen(@RequestParam String thirdSessionKey,
                                  @RequestParam(required = false) String fromUserId) {
        if (StringUtils.isBlank(fromUserId)) {
            return renderSuccess();
        }
        WxSession wxSession = wxService.getWxSession(thirdSessionKey);
        if (wxSession == null) {
            return renderError(530, "session expired");
        }

        // 根据fromUserId查找分享者的openid
        try {
            Integer shareUserId = Integer.parseInt(fromUserId);
            BizWxUser shareUser = bizWxUserService.selectById(shareUserId);
            if (shareUser == null) {
                return renderSuccess(); // 用户不存在，静默忽略
            }
            // 排除自己打开自己的分享链接
            if (shareUser.getOpenid().equals(wxSession.getOpenId())) {
                return renderSuccess();
            }
            bizWxUserService.incrementShareOpenCount(shareUser.getOpenid());
        } catch (NumberFormatException e) {
            // fromUserId 格式无效，静默忽略
        }
        return renderSuccess();
    }
```

Note: `bizWxUserService.selectById()` is inherited from MyBatis-Plus `IService<BizWxUser>`, no need to add this method.

- [ ] **Step 2: Verify renderSuccess pattern**

Check WxRestController for existing response patterns. If it uses a custom response object, match that pattern. Common patterns in this codebase:
- `return new SuccessResponseData();`
- Or a JSONObject with errorCode

Adjust accordingly.

- [ ] **Step 3: Commit**

```bash
cd /Users/weixi1/Documents/PartWorkspace/qianliyan/backend
git add icars-master/icars-master/icars-admin/src/main/java/com/stylefeng/guns/modular/system/controller/WxRestController.java
git commit -m "feat: update share/open endpoint to use fromUserId"
```

---

### Task 8: Verify the userId in login response

**Files:**
- Check: WxRestController getSession endpoint

- [ ] **Step 1: Verify getSession returns userId that matches biz_wx_user.id**

Read the getSession endpoint in WxRestController. Confirm that `userData.userId` returned to the mini-program corresponds to `biz_wx_user.id`. If it maps to a different ID (e.g., sys_user.id), we need to adjust.

If `userId` in getSession response is NOT `biz_wx_user.id`, we have two options:
- Add `biz_wx_user.id` (aliased as `wxUserId`) to the getSession response
- Use openid approach instead

This is a verification step — check before implementing.

- [ ] **Step 2: If userId doesn't match biz_wx_user.id, adjust approach**

If needed, modify the getSession response to include `biz_wx_user.id` and update app.js to store it separately.

---

### Execution Notes

- **Task order**: Tasks 1-4 are backend, Tasks 5-8 are frontend. Tasks 1-2 must be done first (DB + service layer before controller). Task 3 and Task 7 both modify WxRestController — if done by same implementer, merge them. Task 8 is a verification that should be done early to avoid rework.
- **Recommended execution order**: Task 8 (verify) → Task 1 → Task 2 → Task 3+7 (merged) → Task 4 → Task 5 → Task 6
- **Testing**: After all tasks, test in WeChat DevTools:
  1. Open share-result page → click 立即分享 → verify API call to `/share/record`
  2. Share link includes `fromUserId` parameter
  3. Open shared link as different user → verify API call to `/share/open`
  4. Check admin accident list shows share_count and share_open_count columns
