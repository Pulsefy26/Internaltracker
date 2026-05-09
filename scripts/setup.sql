CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'agent')) DEFAULT 'agent',
  department TEXT,
  max_open_cases INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  account_number TEXT,
  task_type TEXT CHECK (task_type IN ('Water Order', 'Chase', 'Amend')) NOT NULL,
  case_owner TEXT,
  actions_taken TEXT,
  comment TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  case_id INT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  agent_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INT REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'closed')),
  resolution TEXT CHECK (resolution IN ('awaiting customer response', 'closed')),
  submitted_at TIMESTAMP,
  closed_at TIMESTAMP,
  notes TEXT,
  UNIQUE(case_id, agent_id)
);

CREATE TABLE IF NOT EXISTS department_targets (
  id SERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  target_date DATE NOT NULL,
  target_cases INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(department, target_date, is_active)
);

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  department TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action TEXT,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignments_agent_status ON assignments(agent_id, status);
CREATE INDEX idx_assignments_assigned_at ON assignments(assigned_at);
CREATE INDEX idx_cases_case_number ON cases(case_number);
CREATE INDEX idx_templates_user_id ON templates(user_id);

INSERT INTO users (full_name, password_hash, role, department)
VALUES ('admin', '$2b$10$5c4Xb5Yx6z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X', 'admin', 'Management')
ON CONFLICT (full_name) DO NOTHING;

INSERT INTO department_targets (department, target_date, target_cases, created_by, is_active)
SELECT 'Customer Service', CURRENT_DATE, 0, 1, true
WHERE NOT EXISTS (SELECT 1 FROM department_targets WHERE department = 'Customer Service' AND target_date = CURRENT_DATE);
