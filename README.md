# Hybrid Training Tracker V3.5

Adds goals/availability, date-based sleep/energy/stress/soreness check-ins, actual session minutes and effort, and a weekly workload summary. Inputs save locally and use the existing cloud sync. Summary buttons refresh calculated displays. Suggestions prefill recovery and equipment from saved entries. Preferences do not automatically reschedule workouts.

Weekly effort units are minutes multiplied by session RPE, a rough trend rather than a physiological recovery or injury score. Missing data remain unknown. Recorded sets use approximate primary muscle categories; use consistent names and units. Archived session metrics survive workout replacement.

29 automated checks pass. Existing Supabase setup remains compatible. No new SQL required. Garmin/Apple Health are not connected; official Garmin API approval or an iPhone HealthKit bridge would be separate integration work.
