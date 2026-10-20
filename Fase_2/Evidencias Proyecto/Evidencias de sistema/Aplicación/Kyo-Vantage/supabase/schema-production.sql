


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."calculate_installment_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.amount_per_installment := ROUND(NEW.amount_total / NEW.installment_total);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_installment_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE accounts
  SET balance = balance - amount
  WHERE id = account_id;
END;
$$;


ALTER FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_setup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.accounts (user_id, name, balance, include_in_total, color, type, is_deletable, currency)
  VALUES (
    NEW.id,
    'Efectivo',
    0,
    true,
    '#10B981', -- Verde Esmeralda corporativo
    'cash',
    false,     -- is_deletable = false (Previene destrucción desde el Front)
    'CLP'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_setup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_cleanup_expired_budgets"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  now_date date := current_date;
BEGIN
  -- Elimina los presupuestos que no son recurrentes y cuyo periodo ya expiró
  DELETE FROM budgets
  WHERE recurrent = false 
    AND (
      (period = 'weekly' AND (start_date::date + interval '7 days') <= now_date) OR
      (period = 'monthly' AND (start_date::date + interval '1 month') <= now_date) OR
      (period = 'annual' AND (start_date::date + interval '1 year') <= now_date)
    );
END;
$$;


ALTER FUNCTION "public"."kyo_cleanup_expired_budgets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_daily_engine"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 1. Gastos/Ingresos Recurrentes (Agenda)
  PERFORM public.kyo_generate_recurring();
  
  -- 2. Presupuestos (Limpieza)
  PERFORM public.kyo_cleanup_expired_budgets();
  
  -- 3. Metas (Matemáticas y Transacciones)
  PERFORM public.kyo_generate_goal_contributions();
  PERFORM public.kyo_generate_goal_reminders();
  
  -- 4. Tarjetas (Cierres y Estados de Cuenta)
  PERFORM public.kyo_generate_billing_statements();
END;
$$;


ALTER FUNCTION "public"."kyo_daily_engine"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_fetch_uf_daily"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  response json;
  uf_val numeric;
  today_date date := CURRENT_DATE;
BEGIN
  -- Hacer la petición HTTP a la API de mindicador
  SELECT content::json INTO response FROM http_get('https://mindicador.cl/api/uf');
  
  -- Extraer el valor de la UF del JSON de respuesta
  -- El JSON viene con un arreglo "serie" y tomamos el primer elemento (el de hoy)
  uf_val := (response->'serie'->0->>'valor')::numeric;
  
  -- Si logramos obtener un valor válido, lo guardamos o actualizamos
  IF uf_val > 0 THEN
    INSERT INTO uf_values (fecha, valor) 
    VALUES (today_date, uf_val)
    ON CONFLICT (fecha) DO UPDATE SET valor = EXCLUDED.valor;
  END IF;
END;
$$;


ALTER FUNCTION "public"."kyo_fetch_uf_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_generate_billing_statements"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  card RECORD;
  now_date timestamp := NOW();
  billing_year int := EXTRACT(YEAR FROM now_date);
  billing_month int := EXTRACT(MONTH FROM now_date);
  current_period text := to_char(now_date, 'YYYY-MM');
  previous_period text := to_char(now_date - interval '1 month', 'YYYY-MM');
  
  period_start timestamp;
  period_end timestamp;
  payment_due_date timestamp;
  payment_due_month int;
  payment_due_year int;
  last_day_payment_month int;
  
  consumed_amt numeric := 0;
  installments_amt numeric := 0;
  refinanced_bal numeric := 0;
  total_due numeric := 0;
  min_payment numeric := 0;
  
  uf_val numeric := 0;
  maint_cost numeric := 0;
BEGIN
  BEGIN
    SELECT valor INTO uf_val FROM uf_values ORDER BY fecha DESC LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    uf_val := 0;
  END;

  FOR card IN SELECT * FROM credit_cards LOOP
    IF EXTRACT(DAY FROM now_date) >= card.billing_date THEN
      
      IF NOT EXISTS (
        SELECT 1 FROM billing_statements 
        WHERE credit_card_id = card.id AND billing_period = current_period
      ) THEN
      
        period_start := date_trunc('month', now_date - interval '1 month') + (card.billing_date) * interval '1 day'; 
        period_end := date_trunc('month', now_date) + (card.billing_date - 1) * interval '1 day' + interval '23:59:59';
        
        payment_due_month := billing_month + 1;
        payment_due_year := billing_year;
        IF payment_due_month > 12 THEN
          payment_due_month := 1;
          payment_due_year := payment_due_year + 1;
        END IF;
        
        last_day_payment_month := EXTRACT(DAY FROM (make_date(payment_due_year, payment_due_month, 1) + interval '1 month - 1 day'));
        payment_due_date := make_date(payment_due_year, payment_due_month, LEAST(card.payment_date::int, last_day_payment_month));
        
        SELECT COALESCE(SUM(amount_per_installment), 0) INTO installments_amt
        FROM credit_card_ledger
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total > 1;
        
        SELECT COALESCE(SUM(amount_total), 0) INTO consumed_amt
        FROM credit_card_ledger
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total = 1 
          AND purchase_date >= period_start AND purchase_date <= period_end;
          
        SELECT COALESCE(MAX(GREATEST(0, total_due - amount_paid)), 0) INTO refinanced_bal
        FROM billing_statements
        WHERE credit_card_id = card.id AND billing_period = previous_period;
        
        maint_cost := card.maintenance_cost;
        IF card.maintenance_currency = 'uf' AND uf_val > 0 THEN
          maint_cost := ROUND(card.maintenance_cost * uf_val);
        ELSIF card.maintenance_currency = 'uf' THEN
          maint_cost := 0;
        END IF;
        
        total_due := consumed_amt + installments_amt + maint_cost;
        min_payment := ROUND(consumed_amt * 0.05) + installments_amt + maint_cost;
        
        INSERT INTO billing_statements (
          user_id, credit_card_id, billing_period, billing_date, payment_due_date,
          consumed_amount, installment_amount, maintenance_cost, refinanced_balance,
          interest_amount, total_due, minimum_payment, maintenance_in_uf, uf_value_used,
          amount_paid, status
        ) VALUES (
          card.user_id, card.id, current_period, period_end, payment_due_date,
          consumed_amt, installments_amt, maint_cost, refinanced_bal,
          0, total_due, min_payment, (card.maintenance_currency = 'uf'), NULLIF(uf_val, 0),
          0, CASE WHEN total_due <= 0 THEN 'paid' ELSE 'pending' END
        );

        -- Amortización del Ledger
        UPDATE credit_card_ledger 
        SET status = 'paid' 
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total = 1 
          AND purchase_date >= period_start AND purchase_date <= period_end;
          
        UPDATE credit_card_ledger 
        SET installment_current = installment_current + 1
        WHERE credit_card_id = card.id AND status = 'active' AND installment_total > 1;
        
        UPDATE credit_card_ledger
        SET status = 'paid'
        WHERE credit_card_id = card.id AND status = 'active' AND installment_current > installment_total;
        
      END IF;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."kyo_generate_billing_statements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_generate_goal_contributions"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  g RECORD;
  current_month text := to_char(NOW(), 'YYYY-MM');
  previous_month text := to_char(NOW() - interval '1 month', 'YYYY-MM');
  now_date date := current_date;
  start_day int;
  last_day_of_month int;
  actual_day int;
  target_date date;
  already_exists boolean;
  transfer_cat_id uuid;
  meses_restantes numeric;
  nueva_cuota numeric;
  paid_last_month numeric;
BEGIN
  -- 1. Evaluamos Metas AUTOMÁTICAS que no se pagaron el mes anterior
  FOR g IN 
    SELECT * FROM goals 
    WHERE contribution_type = 'auto' AND current_amount < target_amount AND deadline_date > now_date
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO paid_last_month
    FROM transactions 
    WHERE goal_id = g.id AND status = 'paid' AND to_char(date, 'YYYY-MM') = previous_month;
    
    IF paid_last_month < g.contribution_amount THEN
       meses_restantes := GREATEST(1, EXTRACT(YEAR FROM age(g.deadline_date, now_date)) * 12 + EXTRACT(MONTH FROM age(g.deadline_date, now_date)));
       nueva_cuota := CEIL((g.target_amount - g.current_amount) / meses_restantes);
       UPDATE goals SET contribution_amount = nueva_cuota WHERE id = g.id;
       g.contribution_amount := nueva_cuota; -- Actualizamos para el insert de abajo
    END IF;
  END LOOP;
  
  -- 2. Evaluamos Metas FIJAS que no se pagaron el mes anterior
  FOR g IN 
    SELECT * FROM goals 
    WHERE contribution_type = 'fixed' AND current_amount < target_amount
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO paid_last_month
    FROM transactions 
    WHERE goal_id = g.id AND status = 'paid' AND to_char(date, 'YYYY-MM') = previous_month;
    
    IF paid_last_month < g.contribution_amount AND g.deadline_date IS NOT NULL THEN
       -- Extiende la fecha límite un mes si no cumplió
       UPDATE goals SET deadline_date = deadline_date + interval '1 month' WHERE id = g.id;
    END IF;
  END LOOP;

  -- 3. Generamos transacciones pendientes solo para metas AUTO y FIXED
  FOR g IN 
    SELECT * FROM goals 
    WHERE contribution_type IN ('auto', 'fixed') AND current_amount < target_amount
  LOOP
    start_day := EXTRACT(DAY FROM g.start_date);
    last_day_of_month := EXTRACT(DAY FROM (date_trunc('month', now_date) + interval '1 month - 1 day'));
    actual_day := LEAST(start_day, last_day_of_month);
    target_date := date_trunc('month', now_date) + (actual_day - 1) * interval '1 day';
    
    SELECT EXISTS(
      SELECT 1 FROM transactions 
      WHERE goal_id = g.id AND to_char(date, 'YYYY-MM') = current_month
    ) INTO already_exists;
    
    IF NOT already_exists THEN
      SELECT id INTO transfer_cat_id FROM categories WHERE user_id = g.user_id AND name ILIKE '%transf%' LIMIT 1;
      IF transfer_cat_id IS NULL THEN
        SELECT id INTO transfer_cat_id FROM categories WHERE user_id = g.user_id LIMIT 1;
      END IF;

      INSERT INTO transactions (
        user_id, category_id, goal_id, name, amount, type, status, date, due_date, is_recurring
      ) VALUES (
        g.user_id, transfer_cat_id, g.id, 'Aporte a meta: ' || g.name, g.contribution_amount, 'expense', 'pending', target_date, target_date, true
      );
      
      INSERT INTO notifications (user_id, type, title, message, is_read)
      VALUES (
        g.user_id, 'alert', 'Ahorro Mensual', 
        'Se ha agendado tu aporte mensual de $' || g.contribution_amount || ' para la meta "' || g.name || '".', false
      );
    END IF;
  END LOOP;
END;
$_$;


ALTER FUNCTION "public"."kyo_generate_goal_contributions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_generate_goal_reminders"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  g RECORD;
  current_month text := to_char(NOW(), 'YYYY-MM');
  now_date date := current_date;
  start_day int;
  last_day_of_month int;
  actual_day int;
  current_month_contrib numeric;
  missing numeric;
BEGIN
  FOR g IN 
    SELECT * FROM goals 
    WHERE reminders = true AND current_amount < target_amount
  LOOP
    start_day := EXTRACT(DAY FROM g.start_date);
    last_day_of_month := EXTRACT(DAY FROM (date_trunc('month', now_date) + interval '1 month - 1 day'));
    actual_day := LEAST(start_day, last_day_of_month);
    
    -- Si faltan 5 días para la fecha límite de pago del mes y es auto/fixed
    IF EXTRACT(DAY FROM now_date) >= actual_day - 5 AND g.contribution_type IN ('auto', 'fixed') THEN
      SELECT COALESCE(SUM(amount), 0) INTO current_month_contrib
      FROM transactions 
      WHERE goal_id = g.id AND status = 'paid' AND to_char(date, 'YYYY-MM') = current_month;
      
      IF current_month_contrib < g.contribution_amount THEN
        missing := g.contribution_amount - current_month_contrib;
        
        IF NOT EXISTS(
          SELECT 1 FROM notifications 
          WHERE user_id = g.user_id 
            AND title = 'Recordatorio: ' || g.name 
            AND to_char(created_at, 'YYYY-MM') = current_month
        ) THEN
          INSERT INTO notifications (user_id, type, title, message, is_read)
          VALUES (
            g.user_id, 'system', 'Recordatorio: ' || g.name, 
            '¡Ey! Te faltan $' || missing || ' para cumplir la cuota de este mes.', false
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$_$;


ALTER FUNCTION "public"."kyo_generate_goal_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kyo_generate_recurring"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rec RECORD;
  current_month text := to_char(NOW(), 'YYYY-MM');
  now_date date := current_date;
  last_day_of_month int;
  actual_day int;
  target_date date;
  lead_date date;
  already_exists boolean;
BEGIN
  FOR rec IN 
    SELECT * FROM recurring_templates 
    WHERE last_generated_month IS NULL OR last_generated_month != current_month
  LOOP
    last_day_of_month := EXTRACT(DAY FROM (date_trunc('month', now_date) + interval '1 month - 1 day'));
    actual_day := LEAST(rec.day_of_month, last_day_of_month);
    target_date := date_trunc('month', now_date) + (actual_day - 1) * interval '1 day';
    lead_date := target_date - (rec.lead_days * interval '1 day');
    
    IF now_date >= lead_date THEN
      SELECT EXISTS(
        SELECT 1 FROM transactions 
        WHERE user_id = rec.user_id 
          AND name = rec.name 
          AND to_char(date, 'YYYY-MM') = current_month
      ) INTO already_exists;
      
      IF NOT already_exists THEN
        INSERT INTO transactions (
          user_id, account_id, category_id, name, amount, type, status, date, due_date, is_recurring
        ) VALUES (
          rec.user_id, rec.account_id, rec.category_id, rec.name, rec.expected_amount, rec.type, 'pending', target_date, target_date, true
        );
        
        INSERT INTO notifications (user_id, type, title, message, is_read)
        VALUES (
          rec.user_id, 'alert', 'Agenda Financiera', 
          'Se ha agregado el registro pendiente "' || rec.name || '" a tu billetera.', false
        );
        
        UPDATE recurring_templates 
        SET last_generated_month = current_month 
        WHERE id = rec.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."kyo_generate_recurring"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.beta_invitations
  SET is_used = TRUE,
      used_by_user_id = p_user_id,
      used_at = NOW()
  WHERE code = p_code AND is_used = FALSE;
END;
$$;


ALTER FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "bank_id" "uuid",
    "balance" numeric DEFAULT 0 NOT NULL,
    "include_in_total" boolean DEFAULT true,
    "color" "text",
    "type" "text",
    "last_digits" "text",
    "is_salary_account" boolean DEFAULT false,
    "is_deletable" boolean DEFAULT true,
    "currency" "text" DEFAULT 'CLP'::"text",
    "overdraft_limit" integer DEFAULT 0,
    "is_archived" boolean DEFAULT false
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text"
);


ALTER TABLE "public"."banks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "is_used" boolean DEFAULT false,
    "used_by_user_id" "uuid",
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."beta_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_card_id" "uuid" NOT NULL,
    "billing_period" "text" NOT NULL,
    "billing_date" "date" NOT NULL,
    "payment_due_date" "date" NOT NULL,
    "actual_payment_date" timestamp with time zone,
    "consumed_amount" numeric DEFAULT 0,
    "installment_amount" numeric DEFAULT 0,
    "maintenance_cost" numeric DEFAULT 0,
    "refinanced_balance" numeric DEFAULT 0,
    "interest_amount" numeric DEFAULT 0,
    "total_due" numeric DEFAULT 0,
    "minimum_payment" numeric DEFAULT 0,
    "amount_paid" numeric DEFAULT 0,
    "maintenance_in_uf" boolean DEFAULT false,
    "uf_value_used" numeric,
    "status" "text" DEFAULT 'pending'::"text",
    "days_late" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_historical_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "limit_amount" numeric NOT NULL,
    "final_spent" numeric NOT NULL,
    "percentage_used" numeric NOT NULL,
    "growth_rate_vs_prev" numeric DEFAULT 0,
    "was_exceeded" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."budget_historical_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "category_id" "uuid",
    "limit_amount" numeric NOT NULL,
    "period" "text",
    "recurrent" boolean DEFAULT true,
    "rollover" boolean DEFAULT false,
    "alert_threshold" numeric,
    "is_essential" boolean DEFAULT false,
    "start_date" "date" DEFAULT CURRENT_DATE,
    "is_recurring" boolean DEFAULT true,
    "rollover_active" boolean DEFAULT false,
    "periodicity" "text" DEFAULT 'monthly'::"text"
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "color" "text",
    "icon_name" "text",
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_card_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_card_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "amount_total" numeric NOT NULL,
    "installment_total" integer DEFAULT 1 NOT NULL,
    "installment_current" integer DEFAULT 1 NOT NULL,
    "amount_per_installment" numeric DEFAULT 0 NOT NULL,
    "purchase_date" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "credit_card_ledger_amount_total_check" CHECK (("amount_total" > (0)::numeric)),
    CONSTRAINT "credit_card_ledger_check" CHECK (("installment_current" <= "installment_total")),
    CONSTRAINT "credit_card_ledger_installment_total_check" CHECK (("installment_total" >= 1)),
    CONSTRAINT "credit_card_ledger_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paid'::"text", 'refinanced'::"text"])))
);


ALTER TABLE "public"."credit_card_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "bank_id" "uuid",
    "total_limit" numeric NOT NULL,
    "recommended_threshold" numeric,
    "billing_date" integer,
    "payment_date" integer,
    "maintenance_cost" numeric DEFAULT 0,
    "monthly_interest_rate" numeric DEFAULT 0,
    "type" "text",
    "issuer" "text",
    "last_4_digits" integer,
    "current_debt" numeric DEFAULT 0,
    "maintenance_currency" "text" DEFAULT 'clp'::"text",
    "currency" "text" DEFAULT 'CLP'::"text",
    "default_interest_rate" numeric DEFAULT 2.9
);


ALTER TABLE "public"."credit_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_health_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "score" integer,
    "credit_readiness_score" numeric,
    "projected_savings" numeric,
    "analysis_date" timestamp with time zone DEFAULT "now"(),
    "insights" "jsonb"
);


ALTER TABLE "public"."financial_health_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "target_amount" numeric NOT NULL,
    "current_amount" numeric DEFAULT 0,
    "deadline_date" timestamp with time zone,
    "start_date" timestamp with time zone DEFAULT "now"(),
    "contribution_amount" numeric,
    "contribution_type" "text",
    "priority" "text",
    "reminders" boolean DEFAULT true,
    "color" "text",
    "icon_name" "text"
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyo_score_historical_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "credit_utilization_rate" numeric DEFAULT 0.0,
    "on_time_payment_rate" numeric DEFAULT 1.0,
    "budget_efficiency_rate" numeric DEFAULT 0.0,
    "savings_progress_rate" numeric DEFAULT 0.0,
    "calculated_score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kyo_score_historical_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "category_id" "uuid",
    "account_id" "uuid",
    "name" "text" NOT NULL,
    "expected_amount" numeric NOT NULL,
    "day_of_month" integer,
    "is_essential" boolean DEFAULT false,
    "lead_days" integer DEFAULT 5,
    "type" "text",
    "last_generated_month" "text",
    CONSTRAINT "recurring_templates_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "recurring_templates_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."recurring_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subject" "text",
    "status" "text" DEFAULT 'open'::"text"
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "account_id" "uuid",
    "credit_card_id" "uuid",
    "goal_id" "uuid",
    "category_id" "uuid",
    "type" "text",
    "amount" numeric NOT NULL,
    "date" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "installment_current" integer,
    "installment_total" integer,
    "note" "text",
    "is_recurring" boolean DEFAULT false,
    "status" "text" DEFAULT 'paid'::"text",
    "due_date" timestamp with time zone,
    "validated_at" timestamp with time zone,
    "transfer_group_id" "uuid",
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uf_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "valor" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."uf_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_bank_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bank_id" "uuid" NOT NULL,
    "is_visible" boolean DEFAULT true
);


ALTER TABLE "public"."user_bank_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_custom_banks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#534AB7'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_custom_banks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_custom_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "icon_name" "text" DEFAULT 'Tag'::"text" NOT NULL,
    "color" "text" DEFAULT '#534AB7'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_custom_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_invitations"
    ADD CONSTRAINT "beta_invitations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."beta_invitations"
    ADD CONSTRAINT "beta_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_historical_analytics"
    ADD CONSTRAINT "budget_historical_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyo_score_historical_features"
    ADD CONSTRAINT "kyo_score_historical_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uf_values"
    ADD CONSTRAINT "uf_values_fecha_key" UNIQUE ("fecha");



ALTER TABLE ONLY "public"."uf_values"
    ADD CONSTRAINT "uf_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_bank_settings"
    ADD CONSTRAINT "user_bank_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_bank_settings"
    ADD CONSTRAINT "user_bank_user_unique" UNIQUE ("user_id", "bank_id");



ALTER TABLE ONLY "public"."user_custom_banks"
    ADD CONSTRAINT "user_custom_banks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_custom_categories"
    ADD CONSTRAINT "user_custom_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_billing_statements_user_card" ON "public"."billing_statements" USING "btree" ("user_id", "credit_card_id", "status");



CREATE INDEX "idx_budget_analytics_lookup" ON "public"."budget_historical_analytics" USING "btree" ("user_id", "period");



CREATE INDEX "idx_kyo_score_features_lookup" ON "public"."kyo_score_historical_features" USING "btree" ("user_id", "period");



CREATE INDEX "idx_transactions_transfer_group" ON "public"."transactions" USING "btree" ("transfer_group_id");



CREATE OR REPLACE TRIGGER "on_credit_purchase_inserted" BEFORE INSERT OR UPDATE ON "public"."credit_card_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_installment_amount"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beta_invitations"
    ADD CONSTRAINT "beta_invitations_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_statements"
    ADD CONSTRAINT "billing_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budget_historical_analytics"
    ADD CONSTRAINT "budget_historical_analytics_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_historical_analytics"
    ADD CONSTRAINT "budget_historical_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id");



ALTER TABLE ONLY "public"."credit_card_ledger"
    ADD CONSTRAINT "credit_card_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id");



ALTER TABLE ONLY "public"."credit_cards"
    ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_health_snapshots"
    ADD CONSTRAINT "financial_health_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyo_score_historical_features"
    ADD CONSTRAINT "kyo_score_historical_features_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_bank_settings"
    ADD CONSTRAINT "user_bank_settings_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id");



ALTER TABLE ONLY "public"."user_bank_settings"
    ADD CONSTRAINT "user_bank_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_custom_banks"
    ADD CONSTRAINT "user_custom_banks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_custom_categories"
    ADD CONSTRAINT "user_custom_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Bancos visibles para todos" ON "public"."banks" FOR SELECT USING (true);



CREATE POLICY "Categorías visibles para todos" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Permitir control total de configuracion bancaria propia" ON "public"."user_bank_settings" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Permitir inserciones anónimas" ON "public"."waitlist" FOR INSERT WITH CHECK (true);



CREATE POLICY "Permitir inserción de snapshots propios" ON "public"."financial_health_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Permitir lectura de snapshots propios" ON "public"."financial_health_snapshots" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Permitir lectura publica de codigos beta" ON "public"."beta_invitations" FOR SELECT USING (true);



CREATE POLICY "Privacidad total de plantillas" ON "public"."recurring_templates" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "UF visible para todos" ON "public"."uf_values" FOR SELECT USING (true);



CREATE POLICY "Users can delete their own credit card ledger" ON "public"."credit_card_ledger" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own accounts" ON "public"."accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own budgets" ON "public"."budgets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own credit cards" ON "public"."credit_cards" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own goals" ON "public"."goals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own credit card ledger" ON "public"."credit_card_ledger" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own support tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their custom banks" ON "public"."user_custom_banks" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their custom categories" ON "public"."user_custom_categories" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own accounts" ON "public"."accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own credit card ledger" ON "public"."credit_card_ledger" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own accounts" ON "public"."accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own budgets" ON "public"."budgets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credit cards" ON "public"."credit_cards" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own goals" ON "public"."goals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own credit card ledger" ON "public"."credit_card_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own support tickets" ON "public"."support_tickets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios pueden gestionar su propio historial de Kyo Score" ON "public"."kyo_score_historical_features" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios pueden gestionar sus historiales analíticos de presup" ON "public"."budget_historical_analytics" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios pueden gestionar sus propios estados de cuenta" ON "public"."billing_statements" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beta_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_historical_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_card_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_health_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyo_score_historical_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_accounts" ON "public"."accounts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_budgets" ON "public"."budgets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_cards" ON "public"."credit_cards" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_goals" ON "public"."goals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_transactions" ON "public"."transactions" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."recurring_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uf_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_bank_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_custom_banks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_custom_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_installment_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_installment_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_installment_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_account_balance"("account_id" "uuid", "amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_cleanup_expired_budgets"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_cleanup_expired_budgets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_cleanup_expired_budgets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_daily_engine"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_daily_engine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_daily_engine"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_fetch_uf_daily"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_fetch_uf_daily"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_fetch_uf_daily"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_generate_billing_statements"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_generate_billing_statements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_generate_billing_statements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_generate_goal_contributions"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_generate_goal_contributions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_generate_goal_contributions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_generate_goal_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_generate_goal_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_generate_goal_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyo_generate_recurring"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyo_generate_recurring"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyo_generate_recurring"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_beta_code"("p_code" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."banks" TO "anon";
GRANT ALL ON TABLE "public"."banks" TO "authenticated";
GRANT ALL ON TABLE "public"."banks" TO "service_role";



GRANT ALL ON TABLE "public"."beta_invitations" TO "anon";
GRANT ALL ON TABLE "public"."beta_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."billing_statements" TO "anon";
GRANT ALL ON TABLE "public"."billing_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_statements" TO "service_role";



GRANT ALL ON TABLE "public"."budget_historical_analytics" TO "anon";
GRANT ALL ON TABLE "public"."budget_historical_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_historical_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."credit_card_ledger" TO "anon";
GRANT ALL ON TABLE "public"."credit_card_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_card_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."credit_cards" TO "anon";
GRANT ALL ON TABLE "public"."credit_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_cards" TO "service_role";



GRANT ALL ON TABLE "public"."financial_health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."financial_health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_health_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."kyo_score_historical_features" TO "anon";
GRANT ALL ON TABLE "public"."kyo_score_historical_features" TO "authenticated";
GRANT ALL ON TABLE "public"."kyo_score_historical_features" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_templates" TO "anon";
GRANT ALL ON TABLE "public"."recurring_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_templates" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."uf_values" TO "anon";
GRANT ALL ON TABLE "public"."uf_values" TO "authenticated";
GRANT ALL ON TABLE "public"."uf_values" TO "service_role";



GRANT ALL ON TABLE "public"."user_bank_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_bank_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_bank_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_custom_banks" TO "anon";
GRANT ALL ON TABLE "public"."user_custom_banks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_custom_banks" TO "service_role";



GRANT ALL ON TABLE "public"."user_custom_categories" TO "anon";
GRANT ALL ON TABLE "public"."user_custom_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."user_custom_categories" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







