import { Success, Failure, type Result } from './result';
import type { Meeting } from '../../types/admin';

// Configuration
const RTK_ACCOUNT_ID = process.env.EXPO_PUBLIC_RTK_ACCOUNT_ID || '';
const RTK_APP_ID = process.env.EXPO_PUBLIC_RTK_APP_ID || '';
const RTK_API_URL = `https://api.cloudflare.com/client/v4/accounts/${RTK_ACCOUNT_ID}/realtime/kit/${RTK_APP_ID}`;
const RTK_AUTH_HEADER = `Bearer ${process.env.EXPO_PUBLIC_RTK_API_AUTH_HEADER || ''}`;

const headers = {
  Accept: 'application/json',
  Authorization: RTK_AUTH_HEADER,
  'Content-Type': 'application/json',
};

/**
 * Core wrapper for fetching from Cloudflare Realtime API.
 * Uses Result to handle Success and Failure functionally.
 */
export const fetchCF = async <T>(
  endpoint: string,
  options?: RequestInit
): Promise<Result<T>> => {
  try {
    const res = await fetch(`${RTK_API_URL}${endpoint}`, { headers, ...options });
    const json: any = await res.json();

    if (!res.ok) {
      if (res.status === 404) {
        return Failure(`CF API Error: Not found (404)`);
      }
      const errorMsg =
        json?.error?.message || json?.errors?.[0]?.message || res.statusText;
      return Failure(`CF API Error: ${errorMsg}`);
    }

    // CF RealtimeKit API wraps responses in { success, data }
    return Success((json.data || json.result || json) as T);
  } catch (e) {
    return Failure(e instanceof Error ? e.message : 'Unknown Network Error');
  }
};

/**
 * Meeting specific API wrappers
 */

export const listMeetingsCF = async (): Promise<Result<any[]>> => {
  return fetchCF<any[]>(`/meetings`);
};

export const getMeetingCF = async (meetingId: string): Promise<Result<any>> => {
  return fetchCF<any>(`/meetings/${meetingId}`);
};

export const createMeetingCF = async (title: string): Promise<Result<any>> => {
  return fetchCF<any>(`/meetings`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
};

export const getParticipantsCF = async (meetingId: string): Promise<Result<any[]>> => {
  return fetchCF<any[]>(`/meetings/${meetingId}/participants`);
};

export const addParticipantCF = async (
  meetingId: string,
  preset_name: string,
  custom_participant_id: string
): Promise<Result<any>> => {
  return fetchCF<any>(`/meetings/${meetingId}/participants`, {
    method: 'POST',
    body: JSON.stringify({
      preset_name,
      custom_participant_id,
    }),
  });
};

export const deleteParticipantCF = async (
  meetingId: string,
  participantId: string
): Promise<Result<void>> => {
  return fetchCF<void>(`/meetings/${meetingId}/participants/${participantId}`, {
    method: 'DELETE',
  });
};
