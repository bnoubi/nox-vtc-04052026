-- Allow anonymous users to read trip_requests (filtered by token in app queries)
CREATE POLICY "anon_select_trip_requests" ON trip_requests
  FOR SELECT TO anon USING (true);

-- Allow anonymous users to fill a pending, non-expired trip request
CREATE POLICY "anon_update_trip_requests" ON trip_requests
  FOR UPDATE TO anon
  USING (status = 'pending' AND expires_at > now())
  WITH CHECK (status = 'filled');
