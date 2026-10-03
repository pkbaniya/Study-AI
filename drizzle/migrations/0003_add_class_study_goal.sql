ALTER TABLE public.classes ADD COLUMN goal_percentage integer NOT NULL DEFAULT 80;
ALTER TABLE public.classes ADD CONSTRAINT classes_goal_percentage_range CHECK (goal_percentage BETWEEN 0 AND 100);