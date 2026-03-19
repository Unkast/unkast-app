-- Unkast Seed Data
-- Run this in Supabase SQL Editor AFTER schema.sql
-- Creates 6 fake profiles with projects and cross-credits

-- First, create auth users (Supabase auth.users)
-- We use fixed UUIDs so we can reference them in profiles
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'lucas.meriaux@demo.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'chloe.bernard@demo.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'romain.dufour@demo.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'sofia.leclerc@demo.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'mehdi.kaci@demo.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'camille.roux@demo.com', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Also insert into auth.identities (required by Supabase Auth)
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '{"sub":"a1000000-0000-0000-0000-000000000001","email":"lucas.meriaux@demo.com"}', 'email', NOW(), NOW(), NOW()),
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '{"sub":"a1000000-0000-0000-0000-000000000002","email":"chloe.bernard@demo.com"}', 'email', NOW(), NOW(), NOW()),
  ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', '{"sub":"a1000000-0000-0000-0000-000000000003","email":"romain.dufour@demo.com"}', 'email', NOW(), NOW(), NOW()),
  ('a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', '{"sub":"a1000000-0000-0000-0000-000000000004","email":"sofia.leclerc@demo.com"}', 'email', NOW(), NOW(), NOW()),
  ('a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', '{"sub":"a1000000-0000-0000-0000-000000000005","email":"mehdi.kaci@demo.com"}', 'email', NOW(), NOW(), NOW()),
  ('a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', '{"sub":"a1000000-0000-0000-0000-000000000006","email":"camille.roux@demo.com"}', 'email', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PROFILES
-- ============================================================
INSERT INTO profiles (id, full_name, slug, bio, avatar_url, location, is_available, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Lucas Meriaux', 'lucas-meriaux',
   'Realisateur et directeur de la photographie base a Paris. Passionne par le cinema d''auteur et les recits intimes. 8 ans d''experience entre courts-metrages et publicites.',
   NULL, 'Paris', TRUE, 'approved'),

  ('a1000000-0000-0000-0000-000000000002', 'Chloe Bernard', 'chloe-bernard',
   'Monteuse et etalonneuse freelance. J''aime donner le rythme aux histoires et sculpter la lumiere en post-production. Disponible pour des projets courts et documentaires.',
   NULL, 'Lyon', TRUE, 'approved'),

  ('a1000000-0000-0000-0000-000000000003', 'Romain Dufour', 'romain-dufour',
   'Ingenieur son et compositeur. Du tournage au mixage, je cree des univers sonores sur mesure. Collaborations avec des marques et des realisateurs independants.',
   NULL, 'Marseille', FALSE, 'approved'),

  ('a1000000-0000-0000-0000-000000000004', 'Sofia Leclerc', 'sofia-leclerc',
   'Comedienne et scenariste. Formee au Cours Florent, j''ecris et j''interprete des personnages entre drame et comedie. Toujours en quete de projets qui bousculent.',
   NULL, 'Paris', TRUE, 'approved'),

  ('a1000000-0000-0000-0000-000000000005', 'Mehdi Kaci', 'mehdi-kaci',
   'Directeur artistique et motion designer. Je conçois des identites visuelles fortes pour le cinema, la musique et la publicite. Base a Bordeaux.',
   NULL, 'Bordeaux', FALSE, 'approved'),

  ('a1000000-0000-0000-0000-000000000006', 'Camille Roux', 'camille-roux',
   'Productrice independante. Je developpe et finance des courts-metrages et documentaires. Selection Clermont-Ferrand 2024. Ouverte aux co-productions.',
   NULL, 'Toulouse', TRUE, 'approved');

-- ============================================================
-- PROFILE ROLES
-- ============================================================
INSERT INTO profile_roles (profile_id, role_name) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Realisateur'),
  ('a1000000-0000-0000-0000-000000000001', 'Directeur de la photographie'),
  ('a1000000-0000-0000-0000-000000000002', 'Monteuse'),
  ('a1000000-0000-0000-0000-000000000002', 'Etalonneuse'),
  ('a1000000-0000-0000-0000-000000000003', 'Ingenieur son'),
  ('a1000000-0000-0000-0000-000000000003', 'Compositeur'),
  ('a1000000-0000-0000-0000-000000000004', 'Comedienne'),
  ('a1000000-0000-0000-0000-000000000004', 'Scenariste'),
  ('a1000000-0000-0000-0000-000000000005', 'Directeur artistique'),
  ('a1000000-0000-0000-0000-000000000005', 'Motion designer'),
  ('a1000000-0000-0000-0000-000000000006', 'Productrice');

-- ============================================================
-- PROJECTS (10 projects across 6 profiles)
-- ============================================================

-- Lucas Meriaux: 2 projects
INSERT INTO projects (id, profile_id, title, slug, description, category, year, video_url) VALUES
  ('b1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'Les Ombres du Matin',
   'les-ombres-du-matin',
   'Court-metrage dramatique sur un pere et son fils qui se retrouvent apres 15 ans de silence. Tourne en pellicule 16mm dans la campagne normande. Selection officielle festival de Clermont-Ferrand 2025.',
   'court-metrage', 2024,
   'https://vimeo.com/1084537371'),

  ('b1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000001',
   'Volvo — Horizons',
   'volvo-horizons',
   'Film publicitaire pour le lancement du Volvo EX90. Road trip cinematographique a travers les paysages des Alpes françaises. Direction photo et realisation.',
   'publicite', 2025,
   'https://vimeo.com/1084537371');

-- Chloe Bernard: 2 projects
INSERT INTO projects (id, profile_id, title, slug, description, category, year, video_url) VALUES
  ('b1000000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000002',
   'Memoires Vives',
   'memoires-vives',
   'Documentaire intimiste sur trois femmes agees qui partagent leurs souvenirs de jeunesse a travers des photos et des objets. Montage et etalonnage.',
   'documentaire', 2024,
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),

  ('b1000000-0000-0000-0000-000000000004',
   'a1000000-0000-0000-0000-000000000002',
   'Neon Dreams',
   'neon-dreams',
   'Clip musical pour le groupe electro KODA. Esthetique cyberpunk, lumieres neon et montage rythmique nerveux. 2.3M de vues sur YouTube.',
   'clip', 2025,
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

-- Romain Dufour: 2 projects
INSERT INTO projects (id, profile_id, title, slug, description, category, year, video_url) VALUES
  ('b1000000-0000-0000-0000-000000000005',
   'a1000000-0000-0000-0000-000000000003',
   'Le Silence des Abeilles',
   'le-silence-des-abeilles',
   'Court-metrage eco-poetique sur la disparition des abeilles. Design sonore immersif melant sons de la nature et nappes electroniques. Prix du son au Festival de Brest.',
   'court-metrage', 2023,
   'https://vimeo.com/1084537371'),

  ('b1000000-0000-0000-0000-000000000006',
   'a1000000-0000-0000-0000-000000000003',
   'Nike — Pulse',
   'nike-pulse',
   'Publicite Nike Running — "Feel your pulse". Composition musicale originale et sound design. Mixage 5.1 pour diffusion cinema.',
   'publicite', 2025,
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

-- Sofia Leclerc: 2 projects
INSERT INTO projects (id, profile_id, title, slug, description, category, year, video_url) VALUES
  ('b1000000-0000-0000-0000-000000000007',
   'a1000000-0000-0000-0000-000000000004',
   'Dernier Acte',
   'dernier-acte',
   'Scene d''audition filmee — monologue dramatique ecrit et interprete par Sofia Leclerc. Un personnage de femme qui confronte son passe lors d''un entretien d''embauche.',
   'scene-extrait', 2025,
   'https://vimeo.com/1084537371'),

  ('b1000000-0000-0000-0000-000000000008',
   'a1000000-0000-0000-0000-000000000004',
   'Sous la Surface',
   'sous-la-surface',
   'Court-metrage psychologique. Deux soeurs se retrouvent dans la maison familiale apres le deces de leur mere. Ecriture et role principal.',
   'court-metrage', 2024,
   'https://vimeo.com/1084537371');

-- Mehdi Kaci: 1 project
INSERT INTO projects (id, profile_id, title, slug, description, category, year, video_url) VALUES
  ('b1000000-0000-0000-0000-000000000009',
   'a1000000-0000-0000-0000-000000000005',
   'KODA — Bande Demo 2025',
   'koda-bande-demo-2025',
   'Bande demo regroupant les meilleurs travaux de direction artistique et motion design pour le cinema et la musique. Clients: Canal+, Deezer, mk2.',
   'bande-demo', 2025,
   'https://vimeo.com/1084537371');

-- Camille Roux: 1 project
INSERT INTO projects (id, profile_id, title, slug, description, category, year, video_url) VALUES
  ('b1000000-0000-0000-0000-000000000010',
   'a1000000-0000-0000-0000-000000000006',
   'Terre Rouge',
   'terre-rouge',
   'Documentaire sur les vignerons bio du Sud-Ouest qui luttent contre le changement climatique. 52 minutes. En developpement — recherche de co-producteurs.',
   'documentaire', 2025,
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

-- ============================================================
-- PROJECT CREDITS (cross-referencing between profiles)
-- This is the core of Unkast: people discover each other
-- through shared projects.
-- ============================================================

-- "Les Ombres du Matin" by Lucas — team of 5
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', NULL, 'Realisateur & Chef operateur'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', NULL, 'Monteuse'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', NULL, 'Ingenieur son'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', NULL, 'Comedienne'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', NULL, 'Productrice');

-- "Volvo — Horizons" by Lucas — team of 4
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', NULL, 'Realisateur & DOP'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', NULL, 'Directeur artistique'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', NULL, 'Compositeur'),
  ('b1000000-0000-0000-0000-000000000002', NULL, 'Antoine Moreau', 'Premier assistant realisateur');

-- "Memoires Vives" by Chloe — team of 4
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', NULL, 'Monteuse & Etalonneuse'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', NULL, 'Productrice'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', NULL, 'Mixage son'),
  ('b1000000-0000-0000-0000-000000000003', NULL, 'Julie Fontaine', 'Realisatrice');

-- "Neon Dreams" by Chloe — team of 3
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', NULL, 'Montage'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005', NULL, 'Direction artistique & Motion design'),
  ('b1000000-0000-0000-0000-000000000004', NULL, 'KODA', 'Artiste');

-- "Le Silence des Abeilles" by Romain — team of 4
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', NULL, 'Design sonore & Compositeur'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', NULL, 'Chef operateur'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', NULL, 'Montage'),
  ('b1000000-0000-0000-0000-000000000005', NULL, 'Marie Petit', 'Realisatrice');

-- "Nike — Pulse" by Romain — team of 3
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', NULL, 'Compositeur & Sound designer'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000005', NULL, 'Motion design'),
  ('b1000000-0000-0000-0000-000000000006', NULL, 'Studio Noire', 'Realisation');

-- "Dernier Acte" by Sofia — team of 2
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004', NULL, 'Scenariste & Comedienne'),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', NULL, 'Realisateur & DOP');

-- "Sous la Surface" by Sofia — team of 5
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000004', NULL, 'Scenariste & Comedienne'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', NULL, 'Chef operateur'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', NULL, 'Monteuse'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000003', NULL, 'Ingenieur son'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000006', NULL, 'Productrice');

-- "KODA — Bande Demo 2025" by Mehdi — solo
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000005', NULL, 'Directeur artistique & Motion designer');

-- "Terre Rouge" by Camille — team of 3
INSERT INTO project_credits (project_id, profile_id, ghost_name, role_on_project) VALUES
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000006', NULL, 'Productrice'),
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', NULL, 'Chef operateur'),
  ('b1000000-0000-0000-0000-000000000010', NULL, 'Thomas Garnier', 'Realisateur');

-- ============================================================
-- CONTACT REQUESTS (2 examples)
-- ============================================================
INSERT INTO contact_requests (from_name, from_email, to_profile_id, subject, message) VALUES
  ('Marie Dupont', 'marie.dupont@production.fr', 'a1000000-0000-0000-0000-000000000001',
   'collaboration',
   'Bonjour Lucas, je suis productrice chez Studio 47. J''ai vu "Les Ombres du Matin" au festival de Clermont et j''aimerais discuter d''un projet de long-metrage. Seriez-vous disponible pour un appel cette semaine ?'),

  ('Jean-Pierre Martin', 'jp.martin@agence.com', 'a1000000-0000-0000-0000-000000000004',
   'project',
   'Bonjour Sofia, nous preparons un court-metrage pour une marque de mode et votre profil correspond parfaitement au role principal. Budget et dates a definir. Interesse ?');
