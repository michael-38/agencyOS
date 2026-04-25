-- Seed default calendar skills for all existing agents that don't already have them

-- check_availability
INSERT INTO skills (agent_id, name, description, type, parameters_schema, action_config, enabled)
SELECT a.id,
       'check_availability',
       'Check available appointment slots on the calendar for a given date and optional time range',
       'check_availability',
       '{"type":"object","properties":{"date":{"type":"string","description":"Date to check in YYYY-MM-DD format"},"time_range_start":{"type":"string","description":"Start of time range in HH:MM format (24h), e.g. 09:00"},"time_range_end":{"type":"string","description":"End of time range in HH:MM format (24h), e.g. 17:00"}},"required":["date"]}'::jsonb,
       '{}'::jsonb,
       true
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.agent_id = a.id AND s.name = 'check_availability'
);

-- schedule_appointment
INSERT INTO skills (agent_id, name, description, type, parameters_schema, action_config, enabled)
SELECT a.id,
       'schedule_appointment',
       'Book an appointment on the calendar for a caller',
       'schedule_appointment',
       '{"type":"object","properties":{"date":{"type":"string","description":"Date in YYYY-MM-DD format"},"start_time":{"type":"string","description":"Start time in HH:MM format (24h)"},"end_time":{"type":"string","description":"End time in HH:MM format (24h)"},"caller_name":{"type":"string","description":"Full name of the person booking"},"caller_phone":{"type":"string","description":"Phone number of the caller"},"reason":{"type":"string","description":"Reason for the appointment"}},"required":["date","start_time","caller_name"]}'::jsonb,
       '{}'::jsonb,
       true
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.agent_id = a.id AND s.name = 'schedule_appointment'
);

-- reschedule_appointment
INSERT INTO skills (agent_id, name, description, type, parameters_schema, action_config, enabled)
SELECT a.id,
       'reschedule_appointment',
       'Reschedule an existing appointment to a new date and time',
       'reschedule_appointment',
       '{"type":"object","properties":{"caller_name":{"type":"string","description":"Name of the person whose appointment to reschedule"},"original_date":{"type":"string","description":"Original appointment date in YYYY-MM-DD format"},"new_date":{"type":"string","description":"New date in YYYY-MM-DD format"},"new_start_time":{"type":"string","description":"New start time in HH:MM format (24h)"},"new_end_time":{"type":"string","description":"New end time in HH:MM format (24h)"}},"required":["caller_name","original_date","new_date","new_start_time"]}'::jsonb,
       '{}'::jsonb,
       true
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.agent_id = a.id AND s.name = 'reschedule_appointment'
);

-- cancel_appointment
INSERT INTO skills (agent_id, name, description, type, parameters_schema, action_config, enabled)
SELECT a.id,
       'cancel_appointment',
       'Cancel an existing appointment on the calendar',
       'cancel_appointment',
       '{"type":"object","properties":{"caller_name":{"type":"string","description":"Name of the person whose appointment to cancel"},"appointment_date":{"type":"string","description":"Date of the appointment to cancel in YYYY-MM-DD format"}},"required":["caller_name","appointment_date"]}'::jsonb,
       '{}'::jsonb,
       true
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.agent_id = a.id AND s.name = 'cancel_appointment'
);
