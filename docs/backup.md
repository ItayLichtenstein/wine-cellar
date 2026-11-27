# גיבוי ושחזור

## מה מגובה
כל לילה ב־01:23 UTC ה־workflow `.github/workflows/backup.yml` שומר שלושה קבצים מהמסד החי: `roles.sql` (תפקידים), `schema.sql` (מבנה) ו־`data.sql` (הנתונים). הם נדחסים ומוצפנים, ונשמרים כ־artifact בגיטהאב ל־30 יום.

**תמונות התוויות** (Storage) לא נכללות עדיין. המטא־דאטה שלהן נמצא ב־`data.sql`, אבל הקבצים עצמם דורשים מפתח S3 של Supabase (סוד נוסף), וזה השלב הבא.

## למה מוצפן
המאגר ציבורי, ולכן כל אחד יכול להוריד artifacts שלו. הגיבוי מוצפן ב־[age](https://github.com/FiloSottile/age) למפתח הציבורי שב־`backup/age-recipient.txt`. רק המפתח הפרטי פותח אותו, והוא אצל הבעלים בלבד (במנהל סיסמאות), אף פעם לא בגיט ולא בגיטהאב.

## מה צריך פעם אחת
- סוד במאגר בשם `SUPABASE_DB_PASSWORD` (Settings → Secrets and variables → Actions). בלעדיו העבודה מדלגת על עצמה.
- המפתח הפרטי נשמר במנהל סיסמאות. אם הוא אבד, הגיבויים הקיימים לא נפתחים: יוצרים זוג מפתחות חדש (`age-keygen`) ומחליפים את הקובץ הציבורי.

## שחזור
1. מורידים את ה־artifact מעמוד ה־Actions (או `gh run download`).
2. מפענחים: `age -d -i <המפתח הפרטי> wine-cellar-YYYY-MM-DD.tar.gz.age | tar -xzf -`
3. משחזרים לפרויקט Supabase **חדש** (לא דורסים את החי), לפי [המדריך של Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore):
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file roles.sql --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql --dbname "<כתובת המסד החדש>"
   ```
4. מחליפים ב־Vercel את כתובת Supabase ואת המפתחות לפרויקט החדש.

## תרגול
פעם בחודש: מורידים את הגיבוי האחרון, מפענחים, ובודקים שיש בו את הטבלאות (`grep -c '^COPY' data.sql`). גיבוי שלא ניסו לשחזר הוא רק תקווה.

נבדק ב־27 בנובמבר 2026 על המסד המקומי: dump → הצפנה → פענוח החזיר קובץ זהה בבית (61 טבלאות).
