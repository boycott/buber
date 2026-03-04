import { Success, Failure, type Result } from './result';
import { supabase } from '../supabase';

/**
 * Standard data extraction from Supabase responses
 */
const resolveDataOrFailure = <T>(data: T | null, error: any, context?: string): Result<T> => {
  if (error) {
    return Failure(`Supabase Error${context ? ` [${context}]` : ''}: ${error.message || 'Unknown'}`);
  }
  if (!data) {
    return Failure(`Supabase Error${context ? ` [${context}]` : ''}: Unexpectedly got null data without an error`);
  }
  return Success(data);
};

export const getUserProfiles = async (): Promise<Result<any[]>> => {
  try {
    const { data, error } = await supabase.from('Profile').select('*');
    return resolveDataOrFailure(data, error, 'getUserProfiles');
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const getClients = async (): Promise<Result<any[]>> => {
  try {
    const { data, error } = await supabase.from('Profile').select('*').eq('role', 'client');
    return resolveDataOrFailure(data, error, 'getClients');
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const getUserProfile = async (userId: string): Promise<Result<any>> => {
  try {
    const { data, error } = await supabase.from('Profile').select('*').eq('id', userId).single();
    return resolveDataOrFailure(data, error, 'getUserProfile');
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const getDocuments = async (userId: string): Promise<Result<any[]>> => {
  try {
    const { data, error } = await supabase.from('Document').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return resolveDataOrFailure(data, error, 'getDocuments');
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const getSessions = async (userId: string, isProvider: boolean = false): Promise<Result<any[]>> => {
  try {
    const query = supabase.from('Session').select(`
      *,
      provider:provider_id(id, full_name, role),
      client:client_id(id, full_name, role)
    `);

    if (isProvider) {
      query.eq('provider_id', userId);
    } else {
      query.eq('client_id', userId);
    }

    query.order('date', { ascending: false });

    const { data, error } = await query;
    return resolveDataOrFailure(data, error, 'getSessions');
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const getUserMeetings = async (userId: string): Promise<Result<any[]>> => {
  try {
    const { data, error } = await supabase.from('Meeting').select('meeting_id').eq('user_id', userId);
    return resolveDataOrFailure(data, error, 'getUserMeetings');
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const insertMeeting = async (userId: string, meetingId: string): Promise<Result<null>> => {
  try {
    const { error } = await supabase.from('Meeting').insert({ user_id: userId, meeting_id: meetingId });
    return error ? Failure(`Database Error: ${error.message}`) : Success(null);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const insertParticipant = async (
  participantId: string,
  meetingId: string,
  token: string,
  customParticipantId: string,
  presetName: string
): Promise<Result<null>> => {
  try {
    const { error } = await supabase.from('MeetingParticipant').insert({
      participant_id: participantId,
      meeting_id: meetingId,
      token: token,
      custom_participant_id: customParticipantId,
      preset_name: presetName,
    });
    return error ? Failure(`Database Error: ${error.message}`) : Success(null);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const deleteParticipant = async (participantId: string): Promise<Result<null>> => {
  try {
    const { error } = await supabase.from('MeetingParticipant').delete().eq('participant_id', participantId);
    return error ? Failure(`Database Error: ${error.message}`) : Success(null);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

/**
 * Retrieves the currently authenticated user
 */
export const getActiveUser = async (): Promise<Result<any>> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return Failure(`Auth Error: ${error.message}`);
    if (!user) return Failure(`Auth Error: No active user session`);
    return Success(user);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const getMeetingParticipantToken = async (customParticipantId: string): Promise<Result<string>> => {
  try {
    const { data, error } = await supabase
      .from('MeetingParticipant')
      .select('token')
      .eq('custom_participant_id', customParticipantId)
      .limit(1)
      .single();

    if (error) {
      return Failure(error.message);
    }

    if (!data?.token) {
      return Failure('No token found for this participant');
    }

    return Success(data.token);
  } catch (error: any) {
    return Failure(error.message || 'An unknown error occurred fetching participant token');
  }
};

/**
 * Moderates Blog Comments
 */

export const getBlogComments = async (page: number, perPage: number = 20): Promise<Result<{ comments: any[], totalCount: number, totalPages: number }>> => {
  try {
    const offset = (page - 1) * perPage;

    const [countResult, dataResult] = await Promise.all([
      supabase
        .from('blog_comments')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('blog_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1),
    ]);

    if (countResult.error) {
      return Failure(`Database Error (Count): ${countResult.error.message}`);
    }
    if (dataResult.error) {
      return Failure(`Database Error (Data): ${dataResult.error.message}`);
    }

    const comments = dataResult.data || [];
    const totalCount = countResult.count || 0;
    const totalPages = Math.ceil(totalCount / perPage);

    return Success({ comments, totalCount, totalPages });
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const toggleCommentApproval = async (commentId: string, currentApprovalStatus: boolean): Promise<Result<null>> => {
  try {
    const { error } = await supabase
      .from('blog_comments')
      .update({ is_approved: !currentApprovalStatus })
      .eq('id', commentId);

    return error ? Failure(`Database Error: ${error.message}`) : Success(null);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};

export const deleteComment = async (commentId: string): Promise<Result<null>> => {
  try {
    const { error } = await supabase
      .from('blog_comments')
      .delete()
      .eq('id', commentId);

    return error ? Failure(`Database Error: ${error.message}`) : Success(null);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Network Error');
  }
};
