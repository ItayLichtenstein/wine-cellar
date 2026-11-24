# הגדרת התחברות עם גוגל

מדריך חד־פעמי ליצירת מפתחות ההתחברות של גוגל. בלי השלב הזה הכפתור "המשך עם Google" לא עובד.
(שמות הכפתורים במסוף של גוגל משתנים מדי פעם – העיקרון נשאר.)

## מה זה ולמה
כשמישהו לוחץ "המשך עם Google", גוגל צריכה לדעת **איזו אפליקציה מבקשת** ו**לאן מותר להחזיר את המשתמש**.
לשם כך יוצרים "לקוח OAuth" ומקבלים:
- **Client ID** – תעודת הזהות של האתר אצל גוגל. לא סודי.
- **Client Secret** – הסיסמה של האתר מול גוגל. **סודי** – לא בגיט ולא בצ'אט.

## 1. פרויקט
1. https://console.cloud.google.com – עם חשבון הגוגל של הפרויקט.
2. בורר הפרויקטים ← **New Project** ← שם: `wine-cellar` ← **Create**, ולוודא שהוא נבחר.

## 2. מסך ההסכמה
1. בתפריט: **Google Auth Platform** (בגרסאות ישנות: APIs & Services ← OAuth consent screen) ← **Get started**.
2. **App name**: `Wine Cellar` · **User support email**: מייל הפרויקט · **Audience**: External · **Contact**: מייל הפרויקט ← **Create**.

## 3. משתמשי בדיקה
**Audience** ← **Test users** ← **Add users** – המיילים שיורשו להתחבר בזמן הפיתוח.
במצב "Testing" רק הם יכולים להתחבר. לפני עלייה לאוויר עוברים ל־**Publish app** (מבקשים רק שם ומייל, אז גוגל לא דורשת בדיקה מיוחדת).

## 4. הלקוח
**Clients** ← **Create client**:
- **Application type**: Web application
- **Name**: `Wine Cellar – local`
- **Authorized JavaScript origins**: `http://127.0.0.1:3000`, `http://localhost:3000`
- **Authorized redirect URIs**: `http://127.0.0.1:54321/auth/v1/callback`

**למה רשימת כתובות?** גוגל תחזיר משתמש (יחד עם אישור ההתחברות שלו) **רק** לכתובות שאושרו מראש. אחרת אפשר היה לבנות קישור שמעביר את האישור לאתר של תוקף.

## 5. שמירת המפתחות
1. **להעתיק את ה־Secret מיד** – ייתכן שגוגל לא תציג אותו שוב.
2. `code supabase/.env` – להדביק כל ערך אחרי ה־`=` המתאים (בלי רווחים ובלי מרכאות) ולשמור.
3. להפעיל מחדש את Supabase המקומי: `supabase stop && supabase start`.

## לעלייה לאוויר (בהמשך)
לקוח נפרד (`Wine Cellar – production`) עם כתובת האתר האמיתית ועם ה־callback של פרויקט ה־Supabase בענן. את המפתחות מזינים בלוח הבקרה של Supabase (Authentication ← Providers ← Google), לא בקובץ.
