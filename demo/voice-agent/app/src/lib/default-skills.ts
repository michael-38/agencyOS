export const DEFAULT_SKILLS = [
  {
    name: 'check_availability',
    description: 'Check available appointment slots on the calendar for a given date and optional time range',
    type: 'check_availability',
    parameters_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date to check in YYYY-MM-DD format' },
        time_range_start: { type: 'string', description: 'Start of time range in HH:MM format (24h), e.g. 09:00' },
        time_range_end: { type: 'string', description: 'End of time range in HH:MM format (24h), e.g. 17:00' },
      },
      required: ['date'],
    },
    action_config: {},
    enabled: true,
  },
  {
    name: 'schedule_appointment',
    description: 'Book an appointment on the calendar for a caller',
    type: 'schedule_appointment',
    parameters_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        start_time: { type: 'string', description: 'Start time in HH:MM format (24h)' },
        end_time: { type: 'string', description: 'End time in HH:MM format (24h)' },
        caller_name: { type: 'string', description: 'Full name of the person booking' },
        caller_phone: { type: 'string', description: 'Phone number of the caller' },
        reason: { type: 'string', description: 'Reason for the appointment' },
      },
      required: ['date', 'start_time', 'caller_name'],
    },
    action_config: {},
    enabled: true,
  },
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new date and time',
    type: 'reschedule_appointment',
    parameters_schema: {
      type: 'object',
      properties: {
        caller_name: { type: 'string', description: 'Name of the person whose appointment to reschedule' },
        original_date: { type: 'string', description: 'Original appointment date in YYYY-MM-DD format' },
        new_date: { type: 'string', description: 'New date in YYYY-MM-DD format' },
        new_start_time: { type: 'string', description: 'New start time in HH:MM format (24h)' },
        new_end_time: { type: 'string', description: 'New end time in HH:MM format (24h)' },
      },
      required: ['caller_name', 'original_date', 'new_date', 'new_start_time'],
    },
    action_config: {},
    enabled: true,
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment on the calendar',
    type: 'cancel_appointment',
    parameters_schema: {
      type: 'object',
      properties: {
        caller_name: { type: 'string', description: 'Name of the person whose appointment to cancel' },
        appointment_date: { type: 'string', description: 'Date of the appointment to cancel in YYYY-MM-DD format' },
      },
      required: ['caller_name', 'appointment_date'],
    },
    action_config: {},
    enabled: true,
  },
] as const
