# ייבוא המרתף הישן לאתר החי

הסקריפטים פועלים **בשמכם**, עם טוקן התחברות זמני מהאתר. כך כל כתיבה עוברת דרך RLS, בדיוק כמו באתר עצמו. לא צריך מפתח סודי (`secret` / `service_role`), והסקריפט לא קורא מפתח כזה.

## לפני שמתחילים

- הייבוא נכנס רק **למרתף שעוד אין בו יינות**. אם כבר יש בו יינות, הסקריפט נעצר ולא כותב כלום.
- הייבוא יוצר מקרר חדש בשם "מקרר יין". מקרר ריק שכבר יצרתם יישאר, ואפשר לסדר אחר כך.
- אף פעם לא מדביקים את הטוקן בצ'אט או בקוד. הוא נכנס רק לקובץ המקומי `.env.import.local`, שגיט מתעלם ממנו.

## צעד 1: הקובץ המקומי

בתיקיית הפרויקט יוצרים קובץ בשם `.env.import.local`, עם שלוש שורות:

```
IMPORT_SUPABASE_URL=https://ethqfevmpulthrcnqgkc.supabase.co
IMPORT_SUPABASE_PUBLISHABLE_KEY=<ה־publishable key, אותו אחד כמו ב־Vercel>
IMPORT_ACCESS_TOKEN=<צעד 2>
```

## צעד 2: הטוקן, בתוקף כשעה

1. נכנסים לאתר החי ומתחברים עם גוגל.
2. פותחים את כלי המפתח של הדפדפן (`Cmd+Option+J` ב־Chrome), בלשונית Console.
3. מדביקים את השורה הזאת ולוחצים Enter. היא מעתיקה את הטוקן ללוח (רק את עוגיות `-auth-token` ו־`.0`, `.1`..., ולא את `code-verifier`):

```js
(()=>{const c=Object.fromEntries(document.cookie.split("; ").map(x=>[x.slice(0,x.indexOf("=")),x.slice(x.indexOf("=")+1)]));const k=Object.keys(c).filter(n=>/-auth-token(\.\d+)?$/.test(n)).sort((a,b)=>(+a.split(".").pop()||0)-(+b.split(".").pop()||0));let v=decodeURIComponent(k.map(n=>c[n]).join(""));if(v.startsWith("base64-"))v=atob(v.slice(7).replace(/-/g,"+").replace(/_/g,"/"));copy(JSON.parse(v).access_token);return "done"})()
```

4. מדביקים את הטוקן אחרי `IMPORT_ACCESS_TOKEN=` בקובץ, ושומרים.

## צעד 3: הרצה

```bash
node --experimental-strip-types scripts/import-old-app.ts מרתף-היין-2026-11-24.html
```

```bash
node --experimental-strip-types scripts/import-label-photos.ts מרתף-היין-2026-11-24.html
```

השורה הראשונה בפלט צריכה להיות `Importing into: production (ethqfevmpulthrcnqgkc.supabase.co)`.

## צעד 4: ניקוי

מוחקים את `.env.import.local`. ממילא אחרי שעה הטוקן כבר לא בתוקף.
