-- GM operational inbox: data-entry exception reasons + edit requests.
-- The previous store was process memory, so a save on one request never
-- reached the GM panel on the next.

CREATE TABLE IF NOT EXISTS plant_notifications (
  id               text PRIMARY KEY,
  type             text NOT NULL,
  status           text NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL,
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  created_by       text NOT NULL,
  target_persona   text NOT NULL DEFAULT 'gm',
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  history          jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_by      text,
  resolved_at      timestamptz,
  resolution_note  text
);

CREATE INDEX IF NOT EXISTS plant_notifications_status_created_idx
  ON plant_notifications (status, created_at DESC);

ALTER TABLE plant_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plant_notifications_service_role_all ON plant_notifications;
CREATE POLICY plant_notifications_service_role_all ON plant_notifications
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.plant_notifications TO anon, authenticated, service_role;
