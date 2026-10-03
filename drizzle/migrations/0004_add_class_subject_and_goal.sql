ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS goal_text text;

COMMENT ON COLUMN public.classes.subject IS 'Student-selected subject category used to personalize study tools.';
COMMENT ON COLUMN public.classes.goal_text IS 'Optional free-text academic goal for the class.';