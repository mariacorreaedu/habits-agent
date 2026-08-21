CREATE TABLE habitos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  habito TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  dias_consecutivos INT DEFAULT 0,
  data TIMESTAMP DEFAULT NOW(),
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);