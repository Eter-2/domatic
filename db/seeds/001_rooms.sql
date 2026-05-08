-- =============================================================================
-- Dom'Atic — Seed 001: Default Rooms
-- 10 default rooms covering a typical home layout
-- =============================================================================

INSERT INTO rooms (name, icon, floor, color) VALUES
    ('Living Room',   'sofa',        0,  '#3B82F6'),
    ('Kitchen',       'utensils',    0,  '#10B981'),
    ('Bedroom',       'bed',         1,  '#8B5CF6'),
    ('Bathroom',      'shower-head', 1,  '#06B6D4'),
    ('Office',        'monitor',     1,  '#EC4899'),
    ('Garage',        'car',         0,  '#6B7280'),
    ('Garden',        'tree-pine',   0,  '#22C55E'),
    ('Hallway',       'door-open',   0,  '#F97316'),
    ('Dining Room',   'utensils-crossed', 0, '#F59E0B'),
    ('Basement',      'archive',    -1,  '#71717A')
ON CONFLICT (name) DO NOTHING;
