import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import type { Meeting, Participant } from '../../types/admin';

const RTK_API_URL = 'https://api.realtime.cloudflare.com/v2';
const RTK_AUTH_HEADER = process.env.EXPO_PUBLIC_RTK_API_AUTH_HEADER || '';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addParticipantModalOpen, setAddParticipantModalOpen] = useState(false);
  const [editParticipantModalOpen, setEditParticipantModalOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('group_call_participant');
  const [editingParticipant, setEditingParticipant] = useState<{
    meetingId: string;
    participant: Participant;
  } | null>(null);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMeetings([]);
        return;
      }

      // Get meeting IDs from Supabase
      const { data: userMeetings, error } = await supabase
        .from('Meeting')
        .select('meeting_id')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!userMeetings || userMeetings.length === 0) {
        setMeetings([]);
        return;
      }

      // Fetch details from Cloudflare
      const meetingPromises = userMeetings.map(async (um: { meeting_id: string }) => {
        try {
          const response = await fetch(`${RTK_API_URL}/meetings/${um.meeting_id}`, {
            headers: {
              Accept: 'application/json',
              Authorization: RTK_AUTH_HEADER,
            },
          });

          if (!response.ok) {
            if (response.status === 404) {
              console.warn(`Meeting ${um.meeting_id} not found`);
              return null;
            }
            throw new Error(`Failed to fetch meeting: ${response.statusText}`);
          }

          const json = await response.json();
          const m = json.result || json.data || json;

          return {
            id: m.id,
            name: m.title || m.name || 'Untitled Meeting',
            date: m.created_at
              ? new Date(m.created_at).toLocaleDateString()
              : new Date().toLocaleDateString(),
            participants: [],
          };
        } catch (err) {
          console.error(err);
          return null;
        }
      });

      const fetchedMeetings = (await Promise.all(meetingPromises)).filter(
        (m) => m !== null
      ) as Meeting[];

      // Fetch participants for each meeting
      await Promise.all(
        fetchedMeetings.map(async (meeting) => {
          try {
            const response = await fetch(
              `${RTK_API_URL}/meetings/${meeting.id}/participants`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: RTK_AUTH_HEADER,
                },
              }
            );

            if (response.ok) {
              const json = await response.json();
              const pData = json.result || json.data || json;
              const participantsData = Array.isArray(pData) ? pData : [];

              meeting.participants = participantsData.map((p: any) => ({
                id: p.id,
                name: p.custom_participant_id,
                email: p.email || '',
                preset_name: p.preset_name || 'group_call_participant',
              }));
            }
          } catch (err) {
            console.error(`Failed to fetch participants for meeting ${meeting.id}`, err);
          }
        })
      );

      setMeetings(fetchedMeetings);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      Alert.alert('Error', 'Please enter a meeting title');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${RTK_API_URL}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: RTK_AUTH_HEADER,
        },
        body: JSON.stringify({ title: newMeetingTitle }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create meeting: ${response.statusText}`);
      }

      const data = await response.json();
      const newMeeting = data.result || data;
      const meetingId = newMeeting.id || crypto.randomUUID();

      // Save to Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from('Meeting').insert({
          user_id: user.id,
          meeting_id: meetingId,
        });

        if (error) {
          console.error('Failed to save meeting to Supabase:', error);
          Alert.alert('Warning', 'Meeting created but failed to save to database');
        }
      }

      setMeetings([
        ...meetings,
        {
          id: meetingId,
          name: newMeeting.name || newMeetingTitle,
          date: newMeeting.created_at
            ? new Date(newMeeting.created_at).toLocaleDateString()
            : new Date().toLocaleDateString(),
          participants: [],
        },
      ]);

      setCreateModalOpen(false);
      setNewMeetingTitle('');
    } catch (error) {
      console.error('Failed to create meeting:', error);
      Alert.alert('Error', 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = async () => {
    if (!selectedMeetingId) return;

    setLoading(true);
    try {
      const custom_participant_id = new Date().getTime().toString(36);
      const response = await fetch(
        `${RTK_API_URL}/meetings/${selectedMeetingId}/participants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: RTK_AUTH_HEADER,
          },
          body: JSON.stringify({
            preset_name: selectedPreset,
            custom_participant_id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add participant: ${response.statusText}`);
      }

      const data = await response.json();
      const newParticipantData = data.data || data;

      // Save to Supabase
      const { error } = await supabase.from('MeetingParticipant').insert({
        participant_id: newParticipantData.id,
        meeting_id: selectedMeetingId,
        token: newParticipantData.token,
        custom_participant_id: custom_participant_id,
        preset_name: selectedPreset,
      });

      if (error) {
        console.error('Failed to save participant to Supabase:', error);
        Alert.alert('Warning', 'Participant added but failed to save to database');
      }

      // Update local state
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === selectedMeetingId
            ? {
              ...m,
              participants: [
                ...m.participants,
                {
                  id: newParticipantData.id || custom_participant_id,
                  name: newParticipantData.name || `Participant ${m.participants.length + 1}`,
                  email: newParticipantData.email || '',
                  preset_name: selectedPreset,
                },
              ],
            }
            : m
        )
      );

      setAddParticipantModalOpen(false);
      setSelectedMeetingId(null);
    } catch (error) {
      console.error('Failed to add participant:', error);
      Alert.alert('Error', 'Failed to add participant');
    } finally {
      setLoading(false);
    }
  };

  const deleteParticipant = async (meetingId: string, participantId: string) => {
    Alert.alert('Delete Participant', 'Are you sure you want to delete this participant?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Optimistically remove from UI
          setMeetings((prev) =>
            prev.map((m) =>
              m.id === meetingId
                ? {
                  ...m,
                  participants: m.participants.filter((p) => p.id !== participantId),
                }
                : m
            )
          );

          try {
            // Delete from Supabase
            await supabase.from('MeetingParticipant').delete().eq('participant_id', participantId);

            // Delete from Cloudflare
            await fetch(`${RTK_API_URL}/meetings/${meetingId}/participants/${participantId}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: RTK_AUTH_HEADER,
              },
            });
          } catch (error) {
            console.error('Error deleting participant:', error);
            Alert.alert('Error', 'Failed to delete participant. Please refresh.');
            fetchMeetings();
          }
        },
      },
    ]);
  };

  const toggleMeetingExpanded = (meetingId: string) => {
    setExpandedMeetings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  const joinMeeting = (customParticipantId: string) => {
    router.push(`/meeting/${customParticipantId}`);
  };

  const renderParticipant = (meetingId: string, participant: Participant) => (
    <View key={participant.id} style={styles.participantRow}>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{participant.name}</Text>
        <Text style={styles.participantPreset}>{participant.preset_name}</Text>
      </View>
      <View style={styles.participantActions}>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => joinMeeting(participant.name)}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteParticipant(meetingId, participant.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMeeting = ({ item }: { item: Meeting }) => {
    const isExpanded = expandedMeetings.has(item.id);

    return (
      <View style={styles.meetingCard}>
        <TouchableOpacity
          style={styles.meetingHeader}
          onPress={() => toggleMeetingExpanded(item.id)}
        >
          <View style={styles.meetingInfo}>
            <Text style={styles.meetingName}>{item.name}</Text>
            <Text style={styles.meetingDate}>{item.date}</Text>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.meetingDetails}>
            <TouchableOpacity
              style={styles.addParticipantButton}
              onPress={() => {
                setSelectedMeetingId(item.id);
                setSelectedPreset('group_call_participant');
                setAddParticipantModalOpen(true);
              }}
            >
              <Text style={styles.addParticipantButtonText}>+ Add Participant</Text>
            </TouchableOpacity>

            {item.participants.length > 0 && (
              <View style={styles.participantsList}>
                <Text style={styles.participantsTitle}>Participants</Text>
                {item.participants.map((p) => renderParticipant(item.id, p))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setCreateModalOpen(true)}
      >
        <Text style={styles.createButtonText}>+ Create Meeting</Text>
      </TouchableOpacity>

      {loading && meetings.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={meetings}
          renderItem={renderMeeting}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Create Meeting Modal */}
      <Modal
        visible={createModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Meeting</Text>
            <TextInput
              style={styles.input}
              placeholder="Meeting Title"
              value={newMeetingTitle}
              onChangeText={setNewMeetingTitle}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setCreateModalOpen(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={createMeeting}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Participant Modal */}
      <Modal
        visible={addParticipantModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddParticipantModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Participant</Text>
            <Text style={styles.label}>Preset</Text>
            <View style={styles.presetButtons}>
              <TouchableOpacity
                style={[
                  styles.presetButton,
                  selectedPreset === 'group_call_host' && styles.presetButtonActive,
                ]}
                onPress={() => setSelectedPreset('group_call_host')}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedPreset === 'group_call_host' && styles.presetButtonTextActive,
                  ]}
                >
                  Host
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.presetButton,
                  selectedPreset === 'group_call_participant' && styles.presetButtonActive,
                ]}
                onPress={() => setSelectedPreset('group_call_participant')}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedPreset === 'group_call_participant' && styles.presetButtonTextActive,
                  ]}
                >
                  Participant
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setAddParticipantModalOpen(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={addParticipant}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: '#000',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  meetingCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meetingDate: {
    fontSize: 14,
    color: '#666',
  },
  expandIcon: {
    fontSize: 12,
    color: '#666',
  },
  meetingDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 16,
  },
  addParticipantButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  addParticipantButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  participantsList: {
    marginTop: 8,
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 8,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  participantPreset: {
    fontSize: 12,
    color: '#666',
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  joinButton: {
    backgroundColor: '#34c759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  presetButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  presetButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#000',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
