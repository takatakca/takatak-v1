-- Rentauto concierge and travel-planning persistence in the shared backend.

CREATE TABLE IF NOT EXISTS rentauto.concierge_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS rentauto_concierge_threads_updated_at
  ON rentauto.concierge_threads;
CREATE TRIGGER rentauto_concierge_threads_updated_at
BEFORE UPDATE ON rentauto.concierge_threads
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.concierge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL
    REFERENCES rentauto.concierge_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  client_message_id text,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_concierge_messages_thread_idx
  ON rentauto.concierge_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS rentauto.travel_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  origin text,
  arrival_at timestamptz,
  departure_at timestamptz,
  passengers integer NOT NULL DEFAULT 1 CHECK (passengers >= 1 AND passengers <= 50),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS rentauto_travel_itineraries_updated_at
  ON rentauto.travel_itineraries;
CREATE TRIGGER rentauto_travel_itineraries_updated_at
BEFORE UPDATE ON rentauto.travel_itineraries
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

ALTER TABLE rentauto.concierge_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.concierge_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.travel_itineraries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_concierge_threads_self
  ON rentauto.concierge_threads;
CREATE POLICY rentauto_concierge_threads_self
ON rentauto.concierge_threads
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_concierge_messages_select
  ON rentauto.concierge_messages;
CREATE POLICY rentauto_concierge_messages_select
ON rentauto.concierge_messages
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_concierge_messages_insert
  ON rentauto.concierge_messages;
CREATE POLICY rentauto_concierge_messages_insert
ON rentauto.concierge_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM rentauto.concierge_threads t
    WHERE t.id = thread_id
      AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS rentauto_concierge_messages_delete
  ON rentauto.concierge_messages;
CREATE POLICY rentauto_concierge_messages_delete
ON rentauto.concierge_messages
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_travel_itineraries_self
  ON rentauto.travel_itineraries;
CREATE POLICY rentauto_travel_itineraries_self
ON rentauto.travel_itineraries
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON rentauto.concierge_threads TO authenticated;
GRANT SELECT, INSERT, DELETE
  ON rentauto.concierge_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON rentauto.travel_itineraries TO authenticated;

GRANT ALL ON rentauto.concierge_threads,
  rentauto.concierge_messages,
  rentauto.travel_itineraries TO service_role;
