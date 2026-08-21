-- ============================================
-- HABIT TRACKER - SCHEMA COMPLETO E OTIMIZADO
-- ============================================

-- 1. TABELA USERS (autenticação por Telegram)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);

-- RLS: cada usuário vê só seus próprios dados
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_see_own_data" ON users 
  FOR SELECT USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS "users_can_update_own" ON users
  FOR UPDATE USING (id = auth.uid());


-- 2. TABELA HABITS (máximo 3 por usuário, com validação)
-- ============================================
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'exercício', 'estudo', 'saúde', 'leitura', 'meditação', etc
  icon TEXT, -- emoji ou ícone
  color TEXT DEFAULT '#3B82F6', -- cor do hábito
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_name CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_is_active ON habits(user_id, is_active);

-- RLS: usuário vê só seus hábitos
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "habits_user_access" ON habits 
  FOR ALL USING (user_id = auth.uid());


-- 3. TABELA HABIT_LOGS (rastreamento diário detalhado)
-- ============================================
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  
  -- Data e hora (com defaults)
  logged_date DATE DEFAULT CURRENT_DATE, -- se não informar, usa hoje
  logged_time TIME DEFAULT CURRENT_TIME, -- se não informar, usa hora atual
  logged_at TIMESTAMPTZ DEFAULT now(), -- quando foi registrado no sistema
  
  -- Descrição e detalhes (o que o usuário digitou)
  description TEXT NOT NULL, -- ex: "20 min de nike", "1 hora de estudo"
  
  -- Métricas extraídas da descrição ou informadas manualmente
  duration_minutes INT, -- 20, 30, 45, 60, etc (extraído do texto ou manual)
  duration_hours DECIMAL(4,2), -- 0.5, 1.0, 1.5, 2.0, etc (alternativa ao minutes)
  activity_type TEXT, -- 'exercício', 'estudo', 'meditação', 'leitura', 'atividade_física', etc
  intensity TEXT DEFAULT 'moderado', -- 'leve', 'moderado', 'intenso'
  
  -- Métricas opcionais (para exercícios/atividades)
  calories_burned INT, -- opcional
  distance_km DECIMAL(6,2), -- opcional (corrida, caminhada)
  
  -- Notas e feedback
  notes TEXT, -- notas adicionais do usuário
  mood TEXT, -- 'muito_bem', 'bem', 'normal', 'mal' (feedback emocional)
  
  -- Rastreamento interno
  streak_day_number INT DEFAULT 1, -- qual dia da sequência é esse?
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_logged_date ON habit_logs(logged_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, logged_date);

-- RLS: usuário vê só seus logs
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "habit_logs_user_access" ON habit_logs 
  FOR ALL USING (user_id = auth.uid());


-- 4. TABELA HABIT_METRICS (agregações e métricas automáticas)
-- ============================================
CREATE TABLE IF NOT EXISTS habit_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  
  -- Streaks
  current_streak INT DEFAULT 0, -- dias consecutivos atuais
  longest_streak INT DEFAULT 0, -- maior sequência já alcançada
  
  -- Totalizações
  total_days_completed INT DEFAULT 0, -- total de dias que fez
  total_sessions INT DEFAULT 0, -- total de registros/sessões
  total_hours_spent DECIMAL(10,2) DEFAULT 0, -- total de horas
  total_minutes_spent INT DEFAULT 0, -- total de minutos
  
  -- Médias
  average_duration_minutes DECIMAL(6,2) DEFAULT 0, -- duração média por sessão
  average_intensity TEXT, -- intensidade média
  
  -- Datas importantes
  first_completion_date DATE, -- primeira vez
  last_completion_date DATE, -- última vez (hoje ou ontem)
  
  -- Consistência
  completion_rate_percent DECIMAL(5,2) DEFAULT 0, -- % de dias completados no mês
  
  -- Atualização automática
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, habit_id)
);

CREATE INDEX IF NOT EXISTS idx_habit_metrics_user_id ON habit_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_metrics_habit_id ON habit_metrics(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_metrics_last_completion ON habit_metrics(user_id, last_completion_date);

-- RLS: usuário vê só suas métricas
ALTER TABLE habit_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "habit_metrics_user_access" ON habit_metrics 
  FOR ALL USING (user_id = auth.uid());


-- ============================================
-- VIEWS ÚTEIS (consultas prontas)
-- ============================================

-- View: hábitos com métricas resumidas
CREATE OR REPLACE VIEW user_habits_summary AS
SELECT 
  h.id,
  h.user_id,
  h.name,
  h.description,
  h.category,
  h.icon,
  h.is_active,
  COALESCE(m.current_streak, 0) as current_streak,
  COALESCE(m.longest_streak, 0) as longest_streak,
  COALESCE(m.total_days_completed, 0) as total_days_completed,
  COALESCE(m.total_hours_spent, 0) as total_hours_spent,
  m.last_completion_date,
  CASE 
    WHEN m.last_completion_date = CURRENT_DATE THEN 'Feito hoje'
    WHEN m.last_completion_date = CURRENT_DATE - INTERVAL '1 day' THEN 'Feito ontem'
    ELSE 'Parado há ' || (CURRENT_DATE - m.last_completion_date)::INT || ' dias'
  END as status_text,
  h.created_at
FROM habits h
LEFT JOIN habit_metrics m ON h.id = m.habit_id AND h.user_id = m.user_id
WHERE h.is_active = true
ORDER BY h.created_at DESC;


-- View: últimos 30 dias de atividades com detalhes
CREATE OR REPLACE VIEW recent_habit_activities AS
SELECT 
  hl.id,
  hl.user_id,
  hl.habit_id,
  h.name as habit_name,
  h.category,
  hl.logged_date,
  hl.logged_time,
  hl.description,
  hl.duration_minutes,
  hl.duration_hours,
  hl.activity_type,
  hl.intensity,
  hl.calories_burned,
  hl.distance_km,
  hl.mood,
  hl.created_at
FROM habit_logs hl
JOIN habits h ON hl.habit_id = h.id
WHERE hl.logged_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY hl.logged_date DESC, hl.logged_time DESC;


-- View: estatísticas do mês atual
CREATE OR REPLACE VIEW monthly_habit_stats AS
SELECT 
  h.id,
  h.user_id,
  h.name,
  DATE_TRUNC('month', CURRENT_DATE)::DATE as month_start,
  COUNT(DISTINCT hl.logged_date) as days_completed,
  COUNT(hl.id) as total_sessions,
  COALESCE(SUM(hl.duration_minutes), 0) as total_minutes,
  ROUND(COALESCE(SUM(hl.duration_minutes), 0) / 60.0, 2) as total_hours,
  ROUND(COALESCE(AVG(hl.duration_minutes), 0), 2) as avg_duration_minutes
FROM habits h
LEFT JOIN habit_logs hl ON h.id = hl.habit_id 
  AND hl.logged_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE
  AND hl.logged_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE h.is_active = true
GROUP BY h.id, h.user_id, h.name
ORDER BY h.created_at DESC;


-- ============================================
-- FUNÇÃO PARA CALCULAR MÉTRICAS (dispara automaticamente)
-- ============================================
CREATE OR REPLACE FUNCTION calculate_habit_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_habit_id UUID;
  v_current_streak INT;
  v_longest_streak INT;
  v_total_days INT;
  v_total_sessions INT;
  v_total_hours DECIMAL;
  v_total_minutes INT;
  v_avg_duration DECIMAL;
  v_first_date DATE;
  v_last_date DATE;
BEGIN
  v_user_id := NEW.user_id;
  v_habit_id := NEW.habit_id;
  
  -- 1. Calcular streak atual (dias consecutivos a partir de hoje/ontem)
  WITH streak_data AS (
    SELECT 
      logged_date,
      ROW_NUMBER() OVER (ORDER BY logged_date DESC) - 1 as days_back
    FROM habit_logs
    WHERE habit_id = v_habit_id AND user_id = v_user_id
    GROUP BY logged_date
    ORDER BY logged_date DESC
  )
  SELECT COUNT(*) INTO v_current_streak
  FROM streak_data
  WHERE logged_date = CURRENT_DATE - days_back::INT;
  
  -- Se nenhuma hoje/ontem, streak = 0
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
  END IF;
  
  -- 2. Maior streak de todos os tempos
  WITH all_streaks AS (
    SELECT 
      logged_date,
      ROW_NUMBER() OVER (ORDER BY logged_date) - ROW_NUMBER() OVER (ORDER BY logged_date DESC) as streak_group
    FROM habit_logs
    WHERE habit_id = v_habit_id AND user_id = v_user_id
  )
  SELECT COALESCE(MAX(COUNT(*)), 0) INTO v_longest_streak
  FROM all_streaks
  GROUP BY streak_group;
  
  -- 3. Total de dias completados (distinct dates)
  SELECT COUNT(DISTINCT logged_date) INTO v_total_days
  FROM habit_logs
  WHERE habit_id = v_habit_id AND user_id = v_user_id;
  
  -- 4. Total de sessões (registros)
  SELECT COUNT(*) INTO v_total_sessions
  FROM habit_logs
  WHERE habit_id = v_habit_id AND user_id = v_user_id;
  
  -- 5. Total de minutos (converte horas também)
  SELECT 
    COALESCE(SUM(
      COALESCE(duration_minutes, 0) + 
      COALESCE((duration_hours * 60)::INT, 0)
    ), 0)
  INTO v_total_minutes
  FROM habit_logs
  WHERE habit_id = v_habit_id AND user_id = v_user_id;
  
  -- Total de horas
  v_total_hours := v_total_minutes / 60.0;
  
  -- 6. Duração média
  SELECT ROUND(
    COALESCE(AVG(
      COALESCE(duration_minutes, 0) + 
      COALESCE((duration_hours * 60)::INT, 0)
    ), 0), 2
  ) INTO v_avg_duration
  FROM habit_logs
  WHERE habit_id = v_habit_id AND user_id = v_user_id
  AND (duration_minutes IS NOT NULL OR duration_hours IS NOT NULL);
  
  -- 7. Primeira e última data
  SELECT MIN(logged_date) INTO v_first_date
  FROM habit_logs
  WHERE habit_id = v_habit_id AND user_id = v_user_id;
  
  SELECT MAX(logged_date) INTO v_last_date
  FROM habit_logs
  WHERE habit_id = v_habit_id AND user_id = v_user_id;
  
  -- 8. Atualizar ou inserir métrica
  INSERT INTO habit_metrics (
    user_id, 
    habit_id, 
    current_streak, 
    longest_streak, 
    total_days_completed,
    total_sessions,
    total_hours_spent,
    total_minutes_spent,
    average_duration_minutes, 
    first_completion_date, 
    last_completion_date,
    last_calculated_at
  ) VALUES (
    v_user_id, 
    v_habit_id, 
    v_current_streak, 
    v_longest_streak, 
    v_total_days,
    v_total_sessions,
    v_total_hours,
    v_total_minutes,
    v_avg_duration, 
    v_first_date, 
    v_last_date,
    now()
  )
  ON CONFLICT (user_id, habit_id) DO UPDATE SET
    current_streak = v_current_streak,
    longest_streak = GREATEST(habit_metrics.longest_streak, v_longest_streak),
    total_days_completed = v_total_days,
    total_sessions = v_total_sessions,
    total_hours_spent = v_total_hours,
    total_minutes_spent = v_total_minutes,
    average_duration_minutes = v_avg_duration,
    first_completion_date = v_first_date,
    last_completion_date = v_last_date,
    last_calculated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- TRIGGERS (executam automaticamente)
-- ============================================

-- Trigger: toda vez que INSERIR um log, recalcula métricas
DROP TRIGGER IF NOT EXISTS trg_calculate_metrics_on_insert ON habit_logs;
CREATE TRIGGER trg_calculate_metrics_on_insert
AFTER INSERT ON habit_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_habit_metrics();

-- Trigger: toda vez que ATUALIZAR um log, recalcula métricas
DROP TRIGGER IF NOT EXISTS trg_calculate_metrics_on_update ON habit_logs;
CREATE TRIGGER trg_calculate_metrics_on_update
AFTER UPDATE ON habit_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_habit_metrics();

-- Trigger: toda vez que DELETAR um log, recalcula métricas
DROP TRIGGER IF NOT EXISTS trg_calculate_metrics_on_delete ON habit_logs;
CREATE TRIGGER trg_calculate_metrics_on_delete
AFTER DELETE ON habit_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_habit_metrics();


-- ============================================
-- FUNÇÃO PARA GARANTIR MÁXIMO 3 HÁBITOS
-- ============================================
CREATE OR REPLACE FUNCTION check_max_habits_per_user()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM habits
  WHERE user_id = NEW.user_id AND is_active = true;
  
  IF v_count > 3 THEN
    RAISE EXCEPTION 'Limite de 3 hábitos ativos por usuário. Delete ou desative um antes de criar novo.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: valida antes de inserir hábito
DROP TRIGGER IF NOT EXISTS trg_check_max_habits ON habits;
CREATE TRIGGER trg_check_max_habits
BEFORE INSERT ON habits
FOR EACH ROW
EXECUTE FUNCTION check_max_habits_per_user();


-- ============================================
-- TESTES (DADOS DE EXEMPLO - remover depois)
-- ============================================

-- Descomentar para testar:
/*
-- Criar usuário de teste
INSERT INTO users (telegram_chat_id, telegram_username, first_name)
VALUES (123456789, 'maria_testa', 'Maria') 
ON CONFLICT DO NOTHING;

-- Pegar o ID do usuário
-- SELECT id FROM users WHERE telegram_chat_id = 123456789;

-- Criar hábitos de teste (substituir user_id pelo valor acima)
INSERT INTO habits (user_id, name, description, category, icon)
SELECT id, 'Corrida', 'Corrida matinal 5km', 'exercício', '🏃'
FROM users WHERE telegram_chat_id = 123456789;

INSERT INTO habits (user_id, name, description, category, icon)
SELECT id, 'Estudo', 'Estudo de programação', 'estudo', '📚'
FROM users WHERE telegram_chat_id = 123456789;

-- Adicionar logs de teste
INSERT INTO habit_logs (user_id, habit_id, logged_date, logged_time, description, duration_minutes, activity_type, intensity)
SELECT h.user_id, h.id, CURRENT_DATE - INTERVAL '2 days', '08:00', '5km corrida', 25, 'exercício', 'moderado'
FROM habits h WHERE h.name = 'Corrida'
LIMIT 1;

-- Verificar as métricas calculadas
SELECT * FROM habit_metrics;
SELECT * FROM user_habits_summary;
*/

-- ============================================
-- FIM DO SCHEMA
-- ============================================