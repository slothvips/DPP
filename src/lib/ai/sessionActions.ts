export interface ClearSessionAction {
  action: 'session_context_cleared';
}

export interface NewSessionAction {
  action: 'new_session_requested';
  title?: string;
  role_id?: string;
  role_title?: string;
  opening_message?: string;
  initial_user_message?: string;
}

export type SessionAction = ClearSessionAction | NewSessionAction;

export function isSessionAction(value: unknown): value is SessionAction {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const action = value as Record<string, unknown>;
  if (action.action === 'session_context_cleared') return true;
  if (action.action !== 'new_session_requested') return false;
  if (action.role_id !== undefined && action.role_title !== undefined) return false;

  return ['title', 'role_id', 'role_title', 'opening_message', 'initial_user_message'].every(
    (key) => action[key] === undefined || typeof action[key] === 'string'
  );
}
