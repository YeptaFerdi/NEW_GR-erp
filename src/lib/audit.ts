import { supabase } from './supabase';
import { ActionType } from './types';

export async function logAudit(
  module: string,
  action: ActionType,
  dataId: string,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('users_profile')
      .select('name, role_name')
      .eq('id', user.id)
      .maybeSingle();
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: profile?.name || user.email || '',
      user_role: profile?.role_name || '',
      module,
      data_id: dataId,
      action,
      old_data: oldData || null,
      new_data: newData || null,
    });
  } catch {
    // audit errors should not block main flow
  }
}
