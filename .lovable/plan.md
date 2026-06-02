# State A → גם מנקה את ה־Supabase

## מטרה
כשלוחצים **State A · Clean slate**, מלבד ניקוי ה־localStorage גם נמחקות **כל** השורות מטבלאות הכנסים ב־Supabase, כך שאפשר להריץ את סוכן הגילוי מאפס.

## מה נמחק (hard delete)
- `plan_items` (תלוי ב־`conferences`)
- `conference_change_flags` (תלוי ב־`conferences`)
- `agent_candidates` (תלוי ב־`conferences`, ו־`run_id`)
- `agent_runs` (היסטוריית ריצות סוכן — כדי להתחיל נקי)
- `conferences` (הטבלה עצמה)

**לא נוגעים** ב־`plans` (תכנית השנה נשארת), וב־`do_not_resurrect` (רשימת חסומים נשארת — אם רוצים לאפס גם אותה זה שינוי של שורה אחת).

States B/C לא נוגעים ב־Supabase בכלל — רק ממפים שמות ל־IDs קיימים, כמו היום.

## קבצים

### 1. `src/lib/demo-data.functions.ts` (חדש)
server function `wipeConferences` שמוחק את כל השורות בסדר הנכון:

```ts
import { createServerFn } from "@tanstack/react-start";

export const wipeConferences = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // סדר חשוב: ילדים לפני אבות
  for (const table of ["plan_items", "conference_change_flags", "agent_candidates", "agent_runs", "conferences"] as const) {
    const { error } = await supabaseAdmin.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`Failed to wipe ${table}: ${error.message}`);
  }
  return { ok: true };
});
```

שימוש ב־`supabaseAdmin` כי לטבלאות האלה אין RLS/auth. הטעינה בתוך ה־handler כדי לא לדלוף ל־client bundle (חוק התבנית).

### 2. `src/lib/demo-data.ts` — שינוי ב־`loadDemoState`
- להפוך את הפונקציה ל־`async`.
- ב־State A: לקרוא ל־`await wipeConferences()` **לפני** כתיבת ה־localStorage.
- אם המחיקה נכשלה — לזרוק; settings.tsx יציג toast שגיאה ולא יעשה reload.

### 3. `src/routes/settings.tsx` — שינוי קטן ב־`handleLoadDemo`
- להמתין ל־`await loadDemoState(...)`.
- ספינר ממשיך עד שהמחיקה והכתיבה הסתיימו, ואז checkmark + toast + reload (כמו היום).
- הודעת ה־toast ב־State A: "Demo A loaded — conferences cleared, reloading…".

## איך זה ייראה למשתמש
1. לחיצה על State A → ספינר (כי המחיקה ב־Supabase לוקחת רגע).
2. ✓ ירוק + toast.
3. Reload — הדף Conferences/Planning ריק לגמרי, מוכן להרצת הסוכן.

## גודל השינוי
~25 שורות סך הכל, קובץ חדש אחד קטן + 3 שורות שינוי בכל אחד מ־`demo-data.ts` ו־`settings.tsx`. עבודה של דקה.

## שאלה אחרונה לפני שאני בונה
האם למחוק גם את `do_not_resurrect` ב־State A? (אם משאירים — כנסים שדחית בעבר לא יחזרו כשהסוכן ירוץ שוב. אם מוחקים — הסוכן רשאי להציע שוב כל דבר.)
