-- Auditable Rentauto host-application workflow.
-- Host intent is no longer an authorization signal; only the server-side review
-- function may grant the Rentauto host role.

CREATE TABLE IF NOT EXISTS rentauto.host_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','withdrawn')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_host_applications_status_idx
  ON rentauto.host_applications(status, applied_at);

DROP TRIGGER IF EXISTS rentauto_host_applications_updated_at
  ON rentauto.host_applications;
CREATE TRIGGER rentauto_host_applications_updated_at
BEFORE UPDATE ON rentauto.host_applications
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

ALTER TABLE rentauto.host_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_host_applications_self_read
  ON rentauto.host_applications;
CREATE POLICY rentauto_host_applications_self_read
ON rentauto.host_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_host_applications_admin_read
  ON rentauto.host_applications;
CREATE POLICY rentauto_host_applications_admin_read
ON rentauto.host_applications
FOR SELECT
TO authenticated
USING (rentauto.has_role('admin'::rentauto.app_role));

GRANT SELECT ON rentauto.host_applications TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON rentauto.host_applications
  FROM anon, authenticated;
GRANT ALL ON rentauto.host_applications TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_submit_host_application(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_identity_id uuid;
  v_application rentauto.host_applications%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_required' USING ERRCODE = '22023';
  END IF;

  v_identity_id := public.ensure_shared_identity_for_auth_user(p_user_id);
  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION 'verified_master_identity_required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.bootstrap_rentauto_account(p_user_id);

  SELECT *
  INTO v_application
  FROM rentauto.host_applications
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rentauto.host_applications (
      user_id,
      status,
      applied_at
    )
    VALUES (
      p_user_id,
      'pending',
      now()
    )
    RETURNING * INTO v_application;
  ELSIF v_application.status IN ('rejected','withdrawn') THEN
    UPDATE rentauto.host_applications
    SET
      status = 'pending',
      applied_at = now(),
      reviewed_at = NULL,
      reviewer_user_id = NULL,
      reviewer_notes = NULL,
      updated_at = now()
    WHERE id = v_application.id
    RETURNING * INTO v_application;
  END IF;

  RETURN jsonb_build_object(
    'id', v_application.id,
    'status', v_application.status,
    'appliedAt', v_application.applied_at,
    'reviewedAt', v_application.reviewed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_submit_host_application(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_submit_host_application(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_review_host_application(
  p_admin_user_id uuid,
  p_application_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_application rentauto.host_applications%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF NOT rentauto.has_role('admin'::rentauto.app_role, p_admin_user_id) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_application
  FROM rentauto.host_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'host_application_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'host_application_not_pending' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approved' THEN
    PERFORM public.bootstrap_rentauto_account(v_application.user_id);

    INSERT INTO rentauto.account_roles (
      auth_user_id,
      role
    )
    VALUES (
      v_application.user_id,
      'host'::rentauto.app_role
    )
    ON CONFLICT (auth_user_id, role) DO NOTHING;

    UPDATE rentauto.accounts
    SET
      host_onboarding_status = 'approved',
      updated_at = v_now
    WHERE auth_user_id = v_application.user_id;
  END IF;

  UPDATE rentauto.host_applications
  SET
    status = p_decision,
    reviewed_at = v_now,
    reviewer_user_id = p_admin_user_id,
    reviewer_notes = NULLIF(left(COALESCE(p_notes,''), 2000), ''),
    updated_at = v_now
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  INSERT INTO rentauto.notifications (
    user_id,
    type,
    title,
    body,
    link,
    payload
  )
  VALUES (
    v_application.user_id,
    CASE
      WHEN p_decision = 'approved' THEN 'host_application_approved'
      ELSE 'host_application_rejected'
    END,
    CASE
      WHEN p_decision = 'approved' THEN 'Host application approved'
      ELSE 'Host application update'
    END,
    CASE
      WHEN p_decision = 'approved'
        THEN 'Your Rentauto host application was approved. Complete host setup to publish vehicles.'
      ELSE 'Your Rentauto host application was not approved. Review the application page for next steps.'
    END,
    '/become-host',
    jsonb_build_object(
      'applicationId', v_application.id,
      'status', v_application.status
    )
  );

  RETURN jsonb_build_object(
    'id', v_application.id,
    'userId', v_application.user_id,
    'status', v_application.status,
    'reviewedAt', v_application.reviewed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_review_host_application(
  uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_review_host_application(
  uuid, uuid, text, text
) TO service_role;

-- Preserve host intents created by the legacy frontend as pending applications.
INSERT INTO rentauto.host_applications (
  user_id,
  status,
  applied_at
)
SELECT
  u.id,
  'pending',
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'host_applied_at','')::timestamptz,
    u.created_at,
    now()
  )
FROM auth.users u
WHERE COALESCE((u.raw_user_meta_data->>'host_intent')::boolean, false) = true
ON CONFLICT (user_id) DO NOTHING;
