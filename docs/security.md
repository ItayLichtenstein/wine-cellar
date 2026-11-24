# אבטחה – רשימת בדיקה

הרשימה נבנתה מתוך מדריכי אבטחה לאפליקציות שנבנו בעזרת AI ("vibe coding"), מהמדריך של Supabase, מה־OWASP Cheat Sheets ל־Next.js ול־MCP.
**הרקע**: סריקות של אפליקציות כאלה מצאו שוב ושוב את אותן שגיאות – בעיקר טבלאות בלי RLS ומפתחות סודיים שדלפו לדפדפן. במקרה אחד שתועד, 170 אפליקציות חשפו נתוני משתמשים בגלל RLS כבוי.

## שתי המטרות העיקריות
1. **אף אחד לא יכול לשנות את הנתונים שלך** – רק חברי משק הבית שלך (RLS, נבדק), ואת קוד האתר רק אתה (גיטהאב + 2FA).
2. **כתובות מייל לא נחשפות** – הן נשמרות רק ב־`auth.users`, סכמה שה־API לא חושף. אף טבלה גלויה לא מכילה מייל (בדיקה אוטומטית), ושמות משתמשים לא נגזרים מהמייל.

**מקרא** (➖ = לא רלוונטי אחרי החלטה): ✅ בוצע ונבדק · 📐 מתוכנן באפיון · 🔜 לביצוע בשלב שמצוין

## מסד הנתונים (Supabase)
| # | דגש | מצב |
|---|---|---|
| 1 | RLS מופעל על **כל** טבלה | ✅ ויש בדיקה אוטומטית שנכשלת אם תתווסף טבלה בלי RLS |
| 2 | לכל טבלה יש מדיניות, והיא מוגבלת למשתמש המחובר | ✅ כל המדיניות `to authenticated`, דרך `is_cellar_member` / `is_cellar_editor` |
| 3 | גישה לנתונים של מרתף אחר נחסמת | ✅ נבדק: קריאה, כתיבה והפניה בין מרתפים |
| 4 | **הגנה כפולה** – לאנונימי אין הרשאות בכלל, לא רק חסימת RLS | ✅ migration 0005 + 3 בדיקות. (Supabase נותן ל־`anon` הרשאות כברירת מחדל) |
| 5 | פונקציות `SECURITY DEFINER` קובעות `search_path` | ✅ ובדיקה אוטומטית |
| 6 | פונקציות לא חשופות לקריאה מבחוץ בלי צורך | ✅ `execute` רק ל־`authenticated`, ורק למה שצריך |
| 7 | שלמות נתונים נאכפת במסד ולא בקוד | ✅ מפתחות זרים מורכבים, `UNIQUE`, `CHECK`, טריגרים |
| 8 | קישורים בטוחים – בלי `javascript:` | ✅ `link_url` חייב להתחיל ב־`http(s)://` (מונע XSS דרך קישור), ונבדק |
| 8א | **הגבלת אורך בכל עמודת טקסט** – הדפדפן מדבר ישירות עם המסד, אז הגבלה בממשק היא רק המלצה | ✅ migration 0006 + בדיקה |
| 8ב | **מדיניות UPDATE לא מאפשרת "להעביר" שורה למרתף אחר** | ✅ `with check` + מפתח זר מורכב, ונבדק |
| 8ג | **ציון אישי רק בשם מישהו ממשק הבית** – בני הבית סומכים זה על זה ויכולים להזין ציון זה בשם זה, אבל לא בשם מי שמחוץ למשק הבית | ✅ migration 0006 + בדיקות |
| 8ד | **אי אפשר להצטרף למרתף או לקדם את עצמך מצופה** | ✅ אין מדיניות כתיבה על החברות; נבדק |
| 8ה | **Views עוקפים RLS** אם לא הוגדרו `security_invoker` | ✅ אין views; בדיקה אוטומטית לעתיד |
| 8ו | **סנכרון בזמן אמת**: Postgres Changes מכבד RLS; ערוצי Broadcast צריכים להיות פרטיים | 🔜 שלב 2 |
| 8ז | **גיבויים**: במסלול החינמי אין גיבוי שאפשר לשחזר ממנו בקלות | 🔜 ייצוא CSV למשתמשים + גיבוי תקופתי (שלב 6) |
| 9 | טוקנים של הזמנות: אקראיים, שמורים כ־hash, פגי תוקף, חד־פעמיים | 📐 שלב 2 |
| 10 | הרשאות על קובצי תמונות (Storage) לפי מרתף | 🔜 כשנוסיף תמונות. Bucket **פרטי**, מדיניות לפי תיקיית המרתף |
| 10א | **תמונות מטלפון מכילות מיקום GPS** (EXIF) – תמונת תווית תחשוף איפה גרים | ✅ קידוד מחדש בדפדפן (canvas ← WebP) מוחק את המטא־דאטה |
| 10ב | **SVG יכול להכיל קוד** | ✅ רק JPEG/PNG/WebP – נאכף גם ב־bucket עצמו (`allowed_mime_types`), נבדק ב־pgTAP |

## סודות
| # | דגש | מצב |
|---|---|---|
| 11 | `.env*` לא נכנס לגיט; יש `.env.example` בלי ערכים | ✅ `.gitignore` / 🔜 `.env.example` בשלב ההתחברות |
| 12 | מפתח `service_role` לעולם לא בדפדפן, ולא עם קידומת `NEXT_PUBLIC_` | 📐 כלל ב־`CLAUDE.md`. האתר בכלל לא אמור להשתמש בו |
| 13 | בדיקה שאין סודות בקבצים שנשלחים לדפדפן (`.next/static`) | 🔜 שלב 6 – צעד ב־CI |
| 14 | Secret scanning ו־push protection בגיטהאב | 🔜 כשניצור את המאגר בגיטהאב |
| 15 | נתונים אישיים (קובץ הייצוא) לא בגיט | ✅ נבדק עם `git check-ignore` |

## צד השרת (Next.js)
| # | דגש | מצב |
|---|---|---|
| 16 | **לא לסמוך על middleware להרשאות** (CVE-2025-29927) | 📐 ההרשאה נאכפת במסד (RLS). ה־middleware רק מרענן את ההתחברות |
| 17 | כל Server Action הוא נקודת קצה ציבורית: בודקים התחברות וקלט בכל אחד | 📐 כלל ב־`CLAUDE.md`; שכבת שירותים אחת עם ולידציה |
| 18 | ולידציה של כל קלט בשרת (סכמה) | 🔜 שלב 1, בשכבת השירותים |
| 19 | שגיאות למשתמש לא חושפות פרטים פנימיים | 🔜 שלב 1 |
| 20 | לא להשתמש ב־`dangerouslySetInnerHTML` | 📐 כלל ב־`CLAUDE.md` (React מנטרל HTML כברירת מחדל) |
| 21 | כותרות אבטחה | ✅ `nosniff`, `X-Frame-Options: DENY` (נגד clickjacking), `Referrer-Policy`, `Permissions-Policy`. 🔜 CSP בשלב 6 |
| 21א | **React Server Components RCE** (CVE-2025-55182, דצמבר 2025, חומרה 10/10) | ✅ Next.js 16.4.6 ו־React 19.3.0 – אחרי התיקון |
| 21ב | **מטמון של Next.js** (`use cache`) עלול להגיש נתונים של משתמש אחד לאחר | 📐 כלל ב־`CLAUDE.md` |
| 21ג | **ייצוא CSV**: תא שמתחיל ב־`=` יורץ כנוסחה באקסל (CSV injection) | 📐 כלל ב־`CLAUDE.md` |
| 21ד | **PWA**: service worker שמטמין נתונים אישיים משאיר אותם במכשיר משותף אחרי יציאה | 📐 כלל ב־`CLAUDE.md`; ניקוי ביציאה |
| 21ה | **קישור צפייה**: הטוקן בכתובת יכול לדלוף (היסטוריה, Referer, מנועי חיפוש) | 📐 `Referrer-Policy` ✅, `noindex` לעמוד, טוקן ארוך שנשמר כ־hash, ביטול |

## התחברות
| # | דגש | מצב |
|---|---|---|
| 22 | לא שומרים סיסמאות | ✅ התחברות עם גוגל בלבד (ADR 0006), דרך Supabase Auth |
| 23 | הגבלת קצב לשליחת מיילים ולהתחברות | 🔜 Supabase מגביל כברירת מחדל; לבדוק בהגדרות לפני העלייה לאוויר |
| 24 | כתובות חזרה (redirect) מותרות רק לדומיין שלנו | 🔜 שלב 1: רשימה מותרת ב־Supabase + בדיקת `next=` בקוד (open redirect) |
| 24א | **סורקי מייל בארגונים "לוחצים" על קישור הקסם** לפני המשתמש, והוא נשרף | ➖ לא רלוונטי – אין קישור קסם (ADR 0006) |
| 24ב | **מגבלת 2 מיילים לשעה** בשרת המייל המובנה של Supabase | ➖ לא רלוונטי – אין קישור קסם (ADR 0006) |
| 24ג | **הרשמות סרק** שמנצלות את מכסת המיילים | ➖ לא רלוונטי – אין קישור קסם (ADR 0006) |
| 24ד | **הרשמה במייל/סיסמה** פתוחה כברירת מחדל ב־Supabase | 🔜 בפרויקט בענן: לכבות את ספק ה־Email לגמרי ולהשאיר רק Google |

## חשבונות (באחריותך)
| # | דגש | מצב |
|---|---|---|
| 34 | אימות דו־שלבי (2FA) בגיטהאב, Supabase ו־Vercel – מי שנכנס לאחד מהם יכול לשנות את האתר או לקרוא את המיילים | 🔜 פעולה שלך |
| 35 | הגנה על הענף `main` בגיטהאב – שינוי רק דרך Pull Request | 🔜 כשניצור את המאגר |

## תלויות
| # | דגש | מצב |
|---|---|---|
| 25 | אין חולשות ידועות בתלויות | ✅ `npm audit`: 0. 🔜 Dependabot בשלב 6 |
| 26 | Next.js מעודכן לגרסת אבטחה אחרונה | ✅ 16.4.6. 🔜 Dependabot |
| 27 | לא מוסיפים ספריות בלי צורך | 📐 כלל ב־`CLAUDE.md` (לשאול לפני ספרייה חדשה) |

## שרת MCP (שלב 7)
| # | דגש | מצב |
|---|---|---|
| 28 | OAuth 2.1 עם PKCE, ובדיקת קהל היעד של הטוקן | 📐 |
| 29 | הרשאה נבדקת **בכל קריאה לכלי**, לא רק בהתחברות | 📐 כל כלי רץ בשם המשתמש, ולכן RLS בודק כל שאילתה |
| 30 | קלט מכלי MCP הוא קלט לא אמין (נכתב על ידי מודל) | 📐 אותה ולידציה של הממשק, בשכבת השירותים |
| 31 | **Prompt injection**: טקסט בנתונים (למשל הערה של חבר) יכול להכיל "הוראות" ל־AI | 📐 כל כתיבה היא טיוטה שאדם מאשר; תשובות הכלים מסמנות טקסט חופשי כנתונים |
| 32 | אין כלים שמביאים כתובות URL שרירותיות (SSRF) | 📐 |
| 33 | הגבלת קצב לכל משתמש | 🔜 שלב 7 |

## סיכונים שאנחנו מקבלים במודע
- **הרבה שורות**: משתמש מחובר יכול להכניס אלפי בקבוקים. אין מכסת שורות – המחיר (טבלאות מורכבות, טריגרים) לא מוצדק בקנה המידה הזה. אם ננוצל, נוסיף מגבלה.
- **ערימה מלאה בו־זמנית**: שתי הוספות באותה שנייה לערימה עם מקום אחד עלולות שתיהן להצליח. השלכה זניחה.

## מקורות
- [OWASP – Next.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html)
- [OWASP – MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP%5FSecurity%5FCheat%5FSheet.html)
- [Supabase – Securing your data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Security Retro: 2025](https://supabase.com/blog/supabase-security-2025-retro)
- [Next.js – Data Security guide](https://nextjs.org/docs/app/guides/data-security)
- [JFrog – CVE-2025-29927](https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/)
- [vibe-coding-security checklist (GitHub)](https://github.com/boxed-dev/vibe-coding-security)
- [Supabase – Production security checklist](https://supabase.com/docs/guides/security/production-checklist)
- [Supabase – Magic links consumed by email scanners](https://github.com/orgs/supabase/discussions/41618)
- [Vercel – CVE-2025-55182](https://vercel.com/changelog/cve-2025-55182)
- [Next.js – Authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components)
- [GuardLayer – Open redirects in Next.js](https://www.guardlayer.io/blog/nextjs-open-redirect)
- [GuardLayer – UPDATE policy WITH CHECK](https://www.guardlayer.io/blog/supabase-update-policy-with-check)
- [OWASP – CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [W3C – Good Practices for Capability URLs](https://www.w3.org/2001/tag/doc/capability-urls)
- [web.dev – Sign-out best practices](https://web.dev/articles/sign-out-best-practices)
- [Cloud Security Alliance – Agentic MCP Security Best Practices](https://labs.cloudsecurityalliance.org/research/agentic-mcp-security-best-practices-v1/)
