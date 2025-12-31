# 🔍 דו"ח אבחון - חיבור Claude ודפדפן

## 📊 סטטוס נוכחי (30/12/2025)

### ❌ בעיה מזוהה: **401 Unauthorized**

```
[UsageMonitor] API error: 401 Unauthorized
```

**משמעות:** הטוקן של Claude לא תקין או לא קיים.

---

## 🔐 1. בדיקת חיבור Claude

### איך המערכת מתחברת ל-Claude:

#### A. **Claude Profile Manager** 
מיקום: `apps/frontend/src/main/claude-profile-manager.ts`

המערכת תומכת ב**multi-account** - מספר חשבונות Claude במקביל.

#### B. **שיטות אימות:**

1. **OAuth Token (מומלץ)** 
   - הטוקן מוצפן בדיסק
   - נשמר ב: `~/.config/auto-claude/config/claude-profiles.json`
   - API Endpoint: `https://api.anthropic.com/api/oauth/usage`

2. **Session Token (fallback)**
   - אם OAuth נכשל
   - מקומי ב: `~/.claude/config.json`

#### C. **Usage Monitor** (ניטור אוטומטי)
מיקום: `apps/frontend/src/main/claude-profile/usage-monitor.ts`

- בודק כל 30 שניות (ברירת מחדל)
- מנסה API ראשון, אחר כך CLI fallback
- **השגיאה 401 אומרת שאין טוקן תקין**

---

## 🔧 כיצד לתקן את חיבור Claude:

### אפשרות 1: דרך ממשק האפליקציה

1. **פתח את האפליקציה**
2. עבור ל: **Settings > Claude Profiles**
3. לחץ על **Authenticate** או **Add OAuth Token**
4. הזן את הטוקן שלך

### אפשרות 2: באמצעות CLI

```bash
# התחבר דרך Claude CLI
claude auth login

# או הגדר טוקן ידני
claude config set oauth_token YOUR_TOKEN_HERE
```

### אפשרות 3: קובץ ידני

ערוך את הקובץ:
```
~/.claude/config.json
```

הוסף:
```json
{
  "oauth_token": "YOUR_CLAUDE_TOKEN_HERE"
}
```

---

## 🌐 2. בדיקת חיבור דפדפן

### איך המערכת משתמשת בדפדפן:

#### A. **Playwright Integration**
מיקום: `apps/backend/spec/validation_strategy.py`

השימושים:
- ✅ בדיקות אוטומטיות (`playwright test`)
- ✅ צילומי מסך (`playwright screenshot`)
- ✅ בדיקת שגיאות console

#### B. **לא נמצא Puppeteer יעודי**
המערכת לא משתמשת ב-Puppeteer לאוטומציה של Claude.

#### C. **Browser Automation הוא לבדיקות בלבד**
- לא לאוטומציה של החיבור ל-Claude
- רק לבדיקות validation של התוצרים

---

## 🔍 3. אבחון מעמיק - מה קורה כרגע:

### סימפטומים שזוהו:

```
✅ Build עובד - האפליקציה בנויה כראוי
✅ Python env - קיים אבל עם בעיות התקנה
❌ Claude Token - לא תקין (401)
⚠️  Cache errors - בעיות זיכרון מטמון (לא קריטי)
⚠️  Python deps - חסר real_ladybug (לא חיוני)
```

### הבעיה המרכזית:

**אין טוקן Claude תקין** ← זו הבעיה היחידה שחוסמת שימוש.

---

## ✅ 4. פתרון מומלץ (צעד אחר צעד):

### שלב 1: קבלת טוקן Claude

```bash
# אם יש לך Claude CLI מותקן
claude auth login

# זה יפתח דפדפן ויבקש ממך להתחבר
# אחרי ההתחברות, הטוקן נשמר אוטומטית
```

### שלב 2: וידוא שהטוקן נשמר

```bash
# Windows
type %USERPROFILE%\.claude\config.json

# Linux/Mac
cat ~/.claude/config.json
```

אמור להכיל:
```json
{
  "oauth_token": "sk-ant-..."
}
```

### שלב 3: הפעלת האפליקציה מחדש

```bash
cd apps/frontend
npm run build
npm run dev
```

### שלב 4: בדיקה בממשק

1. פתח **Settings**
2. לך ל-**Claude Profiles**
3. וודא שיש פרופיל פעיל עם סימן ✓ ירוק

---

## 🎯 5. בדיקת יציבות החיבור:

### A. בדיקת API ישירה

צור קובץ `test-claude-api.js`:

```javascript
const token = 'YOUR_TOKEN_HERE';

fetch('https://api.anthropic.com/api/oauth/usage', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'anthropic-version': '2023-06-01'
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

הרץ:
```bash
node test-claude-api.js
```

**תוצאה צפויה:**
```json
{
  "five_hour_utilization": 0.0,
  "seven_day_utilization": 0.0,
  "five_hour_reset_at": "2025-12-30T...",
  "seven_day_reset_at": "2025-01-06T..."
}
```

### B. מעקב אחר לוגים

בטרמינל של האפליקציה, חפש:

**חיבור תקין:**
```
[UsageMonitor] Successfully fetched via API
[UsageMonitor] Usage: session=5%, weekly=12%
```

**חיבור לא תקין:**
```
[UsageMonitor] API error: 401 Unauthorized
[UsageMonitor] Failed to fetch usage
```

---

## 📋 6. Checklist לוידוא יציבות:

### חיבור Claude:
- [ ] טוקן קיים ב-`~/.claude/config.json`
- [ ] טוקן תקף (לא expired)
- [ ] Profile מוגדר באפליקציה
- [ ] API מחזירה 200 (לא 401)
- [ ] Usage data מוצג בממשק

### חיבור דפדפן:
- [ ] Playwright מותקן (אם צריך בדיקות)
- [ ] לא נדרש לפעולה רגילה
- [ ] רק לבדיקות validation

---

## 🚨 7. בעיות נפוצות ופתרונות:

### בעיה: "401 Unauthorized"
**פתרון:** 
```bash
# הסר טוקן ישן
rm ~/.claude/config.json

# התחבר מחדש
claude auth login
```

### בעיה: "Profile not found"
**פתרון:**
1. Settings > Claude Profiles
2. Add New Profile
3. הזן OAuth Token

### בעיה: "API timeout"
**פתרון:**
- בדוק חיבור אינטרנט
- וודא שאין firewall חוסם
- נסה VPN אם יש הגבלה גיאוגרפית

### בעיה: "Rate limit exceeded"
**פתרון:**
- המערכת תעבור אוטומטית לפרופיל אחר (אם יש)
- חכה לreset (5 שעות / 7 ימים)

---

## 🎉 8. מה קורה אחרי תיקון:

כשהטוקן יהיה תקין:

1. ✅ **UsageMonitor יתחיל לעבוד**
   - יציג שימוש בזמן אמת
   - יתריע על התקרבות ל-limits

2. ✅ **Auto-Switch יפעל**
   - מעבר אוטומטי בין חשבונות
   - למנוע rate limits

3. ✅ **Tasks יתחילו לרוץ**
   - Claude יהיה זמין
   - אין blocking על authentication

4. ✅ **UI יציג סטטוס**
   - אינדיקטור ירוק
   - אחוזי שימוש
   - זמן reset

---

## 📊 9. מידע טכני למפתחים:

### תהליך Authentication:

```typescript
// 1. קריאת טוקן (מוצפן)
const profileManager = getClaudeProfileManager();
const token = profileManager.getProfileToken(profileId);

// 2. בדיקת תקפות
const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. אם 401 - אין אימות
if (!response.ok) {
  throw new Error('Authentication required');
}

// 4. אם 200 - אימות תקין
const usage = await response.json();
```

### קבצים רלוונטיים:

```
apps/frontend/src/main/
├── claude-profile-manager.ts         # ניהול profiles
├── claude-profile/
│   ├── usage-monitor.ts              # ניטור שימוש (כאן השגיאה 401)
│   ├── token-encryption.ts           # הצפנת טוקנים
│   └── profile-storage.ts            # שמירה בדיסק
└── ipc-handlers/
    └── task/execution-handlers.ts    # בדיקת auth לפני task
```

---

## ✅ סיכום:

### הבעיה:
- ❌ אין טוקן Claude תקין
- ⚠️ שגיאת 401 Unauthorized

### הפתרון:
1. הוסף טוקן דרך `claude auth login`
2. או הוסף ידנית דרך Settings > Claude Profiles
3. הפעל מחדש את האפליקציה

### יציבות:
- ✅ המערכת תומכת ב-multi-account (יציבות גבוהה)
- ✅ Auto-switch למניעת rate limits
- ✅ Monitoring אוטומטי כל 30 שניות
- ✅ Fallback mechanisms (API → CLI)

### דפדפן:
- ✅ לא משפיע על חיבור Claude
- ✅ משמש רק לבדיקות (Playwright)
- ✅ לא נדרש לפעולה רגילה

---

**נוצר:** 30 בדצמבר 2025  
**סטטוס:** מחכה לטוקן Claude תקין  
**Priority:** 🔥 HIGH - חוסם שימוש באפליקציה
