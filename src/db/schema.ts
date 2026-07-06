export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  goal_kcal INTEGER NOT NULL DEFAULT 2000,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dish_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, meal_date DESC);

CREATE TABLE IF NOT EXISTS daily_uploads (
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, upload_date)
);

CREATE TABLE IF NOT EXISTS pending_meals (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dish_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  advice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_meals_user ON pending_meals(user_id, created_at DESC);
`;
