-- Class 2 Maths textbook syllabus (NCERT "Joyful Mathematics", 14 chapters), loaded as the shared
-- "School syllabus": every teacher sees it on the Syllabus page and in Child Assessment, and the
-- 20-question papers are built only from these topics.
--
-- Run AFTER schema.sql, and after you have made yourself an admin (README step 5) - the rows are
-- saved in an admin's name. Safe to re-run: a month that already exists (including one an admin
-- has edited) is left alone, so re-running never overwrites changes.
--
-- The textbook groups its chapters into four units:
--   Number Sense & Place Value ... chapters 1, 3, 6, 9
--   Arithmetic Operations ....... chapters 2, 4, 7, 8, 12
--   Geometry, Shapes & Patterns . chapters 5, 14
--   Measurement & Data Handling . chapters 10, 11, 13
--
-- The textbook has no month plan, so the chapters follow the book's own order, one chapter a month
-- from April, two in each of January and February, and chapter 14 in March. Change any month on the
-- Syllabus page (admins can save the change as the School syllabus), or edit the list below before
-- running. Each chapter is split into its learning outcomes so a child can be rated, and a weak
-- area found, per outcome rather than per whole chapter.
--
-- Academic years: the app offers this year and the two before it. The range below (2024-25 to
-- 2028-29) keeps working for the next few Aprils; widen generate_series to add more years.

do $$
declare
  admin_id uuid;
begin
  select id into admin_id from public.profiles where role = 'admin' order by created_at limit 1;

  if admin_id is null then
    raise exception 'There is no admin yet. Make your account an admin first (supabase/README.md, step 5), then run this file again.';
  end if;

  insert into public.syllabus_entries (owner_id, is_shared, academic_year, class_name, subject, month, topics)
  select
    admin_id,
    true,
    format('%s-%s', y, lpad(((y + 1) % 100)::text, 2, '0')),
    'Class 2',
    'Math',
    plan.month,
    plan.topics
  from generate_series(2024, 2028) as y
  cross join (values
    ('April', '[
      "Chapter 1: What’s in a Name? – Reading and writing numbers up to 100 through names",
      "Chapter 1: What’s in a Name? – Sequencing and sorting numbers up to 100 through activities"
    ]'::jsonb),
    ('May', '[
      "Chapter 2: Toy Joy – Basic counting and comparison through visual toys",
      "Chapter 2: Toy Joy – Initial addition concepts through visual toys"
    ]'::jsonb),
    ('June', '[
      "Chapter 3: Double Century – Extending counting on number lines",
      "Chapter 3: Double Century – Working with numbers up to 200"
    ]'::jsonb),
    ('July', '[
      "Chapter 4: Vacation with My Nani Maa – Addition word problems based on real-life scenarios (within 200)",
      "Chapter 4: Vacation with My Nani Maa – Subtraction word problems based on real-life scenarios (within 200)"
    ]'::jsonb),
    ('August', '[
      "Chapter 5: Fun with Shapes – Identifying and understanding 2D and 3D shapes",
      "Chapter 5: Fun with Shapes – Drawing 2D and 3D shapes"
    ]'::jsonb),
    ('September', '[
      "Chapter 6: House of Hundreds – I – Introduction to the place value system",
      "Chapter 6: House of Hundreds – I – Expanding and composing numbers up to 500"
    ]'::jsonb),
    ('October', '[
      "Chapter 7: Raksha Bandhan – Introducing multi-step math operations",
      "Chapter 7: Raksha Bandhan – Initial groupings"
    ]'::jsonb),
    ('November', '[
      "Chapter 8: Fair Share – Foundations of division through equal groups",
      "Chapter 8: Fair Share – Fractions: halves and quarters"
    ]'::jsonb),
    ('December', '[
      "Chapter 9: House of Hundreds – II – Deepening understanding of place values",
      "Chapter 9: House of Hundreds – II – Comparing larger numbers up to 1,000"
    ]'::jsonb),
    ('January', '[
      "Chapter 10: Fun at Class Party! – Understanding length (long vs. short)",
      "Chapter 10: Fun at Class Party! – Basic measurements",
      "Chapter 11: Filling and Lifting – Volume and capacity (more/less)",
      "Chapter 11: Filling and Lifting – Weight (heavy/light)"
    ]'::jsonb),
    ('February', '[
      "Chapter 12: Give and Take – Advancing mental math",
      "Chapter 12: Give and Take – Calculating additions and subtractions with daily utility items like money",
      "Chapter 13: Time Goes On – Learning to read a clock",
      "Chapter 13: Time Goes On – Checking calendars and tracking duration of time"
    ]'::jsonb),
    ('March', '[
      "Chapter 14: The Surajkund Fair – Visual estimation and patterns",
      "Chapter 14: The Surajkund Fair – Symmetry, mirror reflections, and tiling/paths"
    ]'::jsonb)
  ) as plan(month, topics)
  on conflict (academic_year, class_name, subject, month) where is_shared do nothing;
end $$;
