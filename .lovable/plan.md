# הפרדת קטלוג מתכנון, עם ניהול תקציב וכיסוי

## הרעיון המרכזי

היום כל הצפייה, הסטטוסים וההחלטות יושבים על אותו מסך. הקטלוג והתכנון מתערבבים — `Going` משמש גם "מאושר לשנה הזו" וגם "המנהל מתעניין". נפריד אותם:

- **`/` — Catalog**: רשימת **כל** הכנסים שהסוכן מצא + ידניים. גילוי, סינון, חקירה, עריכה. בלי החלטות תכנון.
- **`/planning` — Planning workspace**: שטח עבודה לתכנית השנתית. כאן בוחרים Must-go, מוסיפים מועמדים, רואים תקציב מול עלות בזמן אמת, ומקבלים המלצות לסגירת פערים.

תכנית אחת פעילה בכל רגע נתון (Plan 2026). כשתרצי לעבוד על 2027 — פותחים חדשה, וזו הופכת לארכיון.

## מודל הסטטוסים החדש (אחיד בין קטלוג לתכנון)

הסטטוס היום מבלבל כי הוא משרת שני עולמות. נפצל:

**שדה 1 — `catalog_status`** (נראה בקטלוג):
- `New` — האייג'נט הוסיף, לא נסקר
- `Reviewed` — נסקר ע"י מנהלת
- `Archived` — לא רלוונטי לנו ככלל

**שדה 2 — `plan_status`** (שייך לתכנית הפעילה, לא לכנס):
- `Must-go` — חובה, לא נמחק מהתכנית
- `Shortlist` — מועמד חזק, סביר שייכלל
- `Considering` — נשקל, צריך עוד מידע
- `Approved` — נכלל סופית בתכנית (זה שמחליף את `Going` של היום)
- `Dropped` — נשקל ונפסל לתכנית הזו

הסיבה לפיצול: כנס יכול להיות `Reviewed` בקטלוג ו-`Approved` בתכנית 2026 וגם `Considering` בתכנית 2027 בעתיד. אם נשמור סטטוס אחד על הכנס עצמו — נצטרך לשכתב אותו בכל פעם שעוברים שנה.

## תקציב ועלות

נוסיף שלושה שדות חדשים לכנס:
- `estimated_cost_usd` — עלות כוללת משוערת (כרטיס + טיסה + לינה לרפ אחד)
- `cost_confidence` — `estimated` / `quoted` / `actual`
- `cost_notes` — טקסט חופשי

תכנית מחזיקה:
- `annual_budget_usd`
- `planned_reps_per_conference` (ברירת מחדל 1 — מכפיל את העלות אם משנים)

מטריקה מחושבת בזמן אמת:
- סה"כ Must-go committed
- סה"כ Approved (כולל Must-go)
- נשאר בתקציב = budget − approved
- "אזור סיכון": Shortlist שאם נוסיף, נחרוג

## /planning — מבנה המסך

שלוש קומות במסך אחד:

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Plan 2026 · Budget $X · Committed $Y · Remaining $Z │
├──────────────────────────────┬──────────────────────────────┤
│ Timeline (כל השנה, צבוע      │ Coverage panel:              │
│ לפי plan_status)             │ • Region coverage (meters)   │
│                              │ • Vertical coverage          │
│                              │ • Calendar gaps              │
│                              │ • Recommendations live       │
├──────────────────────────────┴──────────────────────────────┤
│ Planning table: עמודות = שם, תאריכים, אזור, עלות, סטטוס    │
│ פעולות מהירות: Must-go / Approved / Drop                    │
│ שורת סיכום בתחתית: סך עלות נבחר, חריגה מתקציב              │
└─────────────────────────────────────────────────────────────┘
```

המפה (Geographic) נשארת בקטלוג — שם היא משרתת חקירה. בתכנון היא פחות פעילה; אם נרצה אפשר לפתוח אותה כ-tab משני בתוך הפאנל הימני.

## המלצות חיות (לא רק בסוף)

הפאנל הימני מציג בכל רגע:
- **Coverage meters**: לכל region/vertical — % כיסוי לפי קונפיגורציה ידועה (אזורים פעילים מההגדרות הקיימות), צבע אדום/כתום/ירוק
- **Gap suggestions**: "אין כיסוי ב-APAC ברבעון 2 — 3 כנסים מתאימים, מהזולים: X ($1.2k), Y ($2k), Z..." — לחיצה מוסיפה ל-Shortlist
- **Budget reality**: "נשאר $14k. אם תאשרי את כל ה-Shortlist, תחרגי ב-$3k. ה-3 הזולים מתוכם פותרים את פער ה-EU בלי לחרוג."
- **Calendar conflicts**: שני כנסים שחופפים בתאריכים → אזהרה

ההמלצות פשוטות וחישוביות (לא AI חדש) — דירוג לפי `gap_score × (1/cost) × icp_score`. מהיר, מקומי, צפוי.

## קטלוג — שינויים מינימליים

המסך הקיים נשאר כמעט זהה, אבל:
- עמודת הסטטוס משנה שם ל-`Catalog Status` (New/Reviewed/Archived)
- הסטטוסים הישנים (Going/Considering/Passed) ממופים אוטומטית: `Going → plan_status=Approved`, `Considering → plan_status=Considering`, `Passed → plan_status=Dropped`. הקטלוג עצמו של כולם נהיה `Reviewed`.
- מתווסף כפתור "Add to Plan 2026" על כל שורה — מוסיף ל-Shortlist בתכנית הפעילה
- הפאנל הימני (DecisionPanel הקיים) נשאר עם תובנות חקירה כלליות, **בלי** ניהול החלטות תכנון

## ניווט

`SidebarTrigger` בכותרת + סייד-בר עם:
- Catalog
- Planning · Plan 2026 (badge: $Z remaining)
- Agent runs (קיים)

## פרטים טכניים

**שינויי DB (מיגרציה אחת):**
- טבלה חדשה `plans`: `id, name, year, annual_budget_usd, planned_reps_per_conference, is_active, created_at, archived_at`
- טבלה חדשה `plan_items`: `id, plan_id, conference_id, plan_status, planned_reps_override, estimated_cost_override, must_go_locked_at, notes, created_at, updated_at` + unique (plan_id, conference_id)
- `conferences`: הוספת `estimated_cost_usd`, `cost_confidence`, `cost_notes`. השדה הקיים `status` נשאר זמנית לקריאה בלבד עד שכל הקוד יעבור
- migration data step: יצירת `Plan 2026`, מילוי `plan_items` מכל conference עם המיפוי הנ"ל

**קוד:**
- `src/routes/planning.tsx` חדש
- `src/components/planning/` — `PlanHeader`, `PlanTimeline`, `CoveragePanel`, `RecommendationsList`, `PlanningTable`, `BudgetMeter`
- `src/lib/planning.functions.ts` — server fns: `getActivePlan`, `addToPlan`, `setPlanStatus`, `updatePlanBudget`, `updateConferenceCost`, `getRecommendations`
- `src/lib/recommendations.ts` — לוגיקת ניקוד פערים (טהור, נבחן בקלות)
- הסיידבר מתווסף ל-`__root.tsx`
- `index.tsx` הקיים מתעדכן: עמודת סטטוס + כפתור Add to Plan, הסרת `DecisionPanel`'s status actions (נשארות התובנות בלבד)

**מה לא נוגעים:**
- האייג'נט וכל הלוגיקה שלו
- `do_not_resurrect`
- `conference_change_flags` ו-Needs Review (המסך החדש יציג גם flags פתוחים על כנסים בתכנית, אבל הזרימה זהה)
- ה-API הציבורי של ה-cron

## מה לא בתכנית הזו (יבוא בנפרד אם תרצי)

- ניהול תקציב לפי רבעון/קוודרנט (כרגע שנתי בלבד)
- היסטוריית תכניות קודמות עם השוואה
- שיתוף תכנית עם הצוות + הרשאות
- שמירת snapshots של התכנית בכל שינוי

## שאלה אחת שנשארה לפני בנייה

האם להזין עכשיו עלות ידנית לכל כנס, או שמספיק שהשדות יהיו ריקים בהתחלה ואת ממלאת תוך כדי שאת בוחנת? אני ממליץ ריק + הוספת מסנן "Has cost / Missing cost" בקטלוג כדי שתוכלי לרדוף אחרי המידע — אבל זו החלטה שלך.
