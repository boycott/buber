import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCF, getMeetingCF, createMeetingCF, getParticipantsCF, addParticipantCF, deleteParticipantCF } from '../cf-api';

global.fetch = vi.fn();

describe('Cloudflare API pure-effect wrappers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetchCF handles successful responses securely', async () => {
    const mockData = { result: { id: '123', name: 'Test' } };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const res = await fetchCF('/test');

    expect(res._tag).toBe('Success');
    res.match({
      Success: (val) => expect(val).toEqual(mockData.result),
      Failure: () => expect.fail('Should have succeeded')
    });
  });

  it('fetchCF handles 404 responses gracefully functionally', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({})
    });

    const res = await fetchCF('/not-found');
    res.match({
      Failure: (err) => expect(err).toContain('404'),
      Success: () => expect.fail('Should have failed')
    });
  });

  it('fetchCF catches network errors and returns Failure', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network offline'));

    const res = await fetchCF('/test');
    res.match({
      Failure: (err) => expect(err).toBe('Network offline'),
      Success: () => expect.fail('Should have failed')
    });
  });
});
