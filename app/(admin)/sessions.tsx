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
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../lib/supabase';
import { getSessions, getClients, getActiveUser, getUserMeetings } from '../../lib/api/supabase-api';
import type { Session, Client, Meeting } from '../../types/admin';

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Session, 'id'>>({
    client_id: '',
    participant_id: '',
    start_time: '',
    end_time: '',
    cost: 0,
    paid: false,
    attendance: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const userResult = await getActiveUser();

    // We can fetch Sessions and Clients concurrently (or fallback to empty on error)
    // For a pure-effect approach, we pattern match the results.
    // In a real monadic flow we might use sequence or map, but here we handle them sequentially for simplicity.

    const user = userResult.match({
      Success: (u: any) => u,
      Failure: () => null
    });

    if (!user) {
      setLoading(false);
      return;
    }

    const [sessionsResult, clientsResult, meetingsResult] = await Promise.all([
      getSessions(user.id, true),
      getClients(),
      getUserMeetings(user.id)
    ]);

    sessionsResult.match({
      Success: (data: Session[]) => setSessions(data),
      Failure: (err: string) => {
        console.error('Failed to fetch sessions:', err);
        Alert.alert('Error', 'Failed to load sessions');
      }
    });

    clientsResult.match({
      Success: (profiles: any[]) => {
        const clientsList: Client[] = profiles
          .map((p: any) => ({
            id: p.id,
            name: `${p.given_name} ${p.family_name}`,
            given_name: p.given_name,
            family_name: p.family_name,
          }));
        setClients(clientsList);
      },
      Failure: (err: string) => console.error('Failed to fetch clients:', err)
    });

    meetingsResult.match({
      Success: (mResult: any[]) => {
        setMeetings(
          mResult.map((m: any) => ({
            id: m.meeting_id,
            name: 'Meeting',
            date: '',
            participants: [],
          }))
        );
      },
      Failure: (err: string) => console.error('Failed to fetch user meetings:', err)
    });

    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingSessionId(null);
    setFormData({
      client_id: '',
      participant_id: '',
      start_time: '',
      end_time: '',
      cost: 0,
      paid: false,
      attendance: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (session: Session) => {
    setEditingSessionId(session.id);
    setFormData({
      client_id: session.client_id,
      participant_id: session.participant_id,
      start_time: session.start_time,
      end_time: session.end_time,
      cost: session.cost,
      paid: session.paid,
      attendance: session.attendance,
    });
    setModalOpen(true);
  };

  const saveSession = async () => {
    if (!formData.client_id || !formData.participant_id || !formData.start_time || !formData.end_time) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (editingSessionId) {
        // Update existing session
        const { error } = await supabase
          .from('Session')
          .update(formData)
          .eq('id', editingSessionId);

        if (error) throw error;

        setSessions((prev) =>
          prev.map((s) =>
            s.id === editingSessionId ? { ...s, ...formData } : s
          )
        );
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('Session')
          .insert([formData])
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          setSessions((prev) => [...prev, data[0]]);
        }
      }

      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save session:', error);
      Alert.alert('Error', 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    Alert.alert('Delete Session', 'Are you sure you want to delete this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('Session')
              .delete()
              .eq('id', sessionId);

            if (error) throw error;

            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          } catch (error) {
            console.error('Failed to delete session:', error);
            Alert.alert('Error', 'Failed to delete session');
          }
        },
      },
    ]);
  };

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || 'Unknown Client';
  };

  const renderSession = ({ item }: { item: Session }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionClient}>{getClientName(item.client_id)}</Text>
        <Text style={styles.sessionTime}>
          {new Date(item.start_time).toLocaleString()} - {new Date(item.end_time).toLocaleString()}
        </Text>
        <View style={styles.sessionDetails}>
          <Text style={styles.sessionCost}>£{item.cost}</Text>
          <Text style={[styles.sessionPaid, item.paid ? styles.paidYes : styles.paidNo]}>
            {item.paid ? 'Paid' : 'Unpaid'}
          </Text>
          <Text style={styles.sessionAttendance}>{item.attendance}</Text>
        </View>
      </View>
      <View style={styles.sessionActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteSession(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={openCreateModal}
      >
        <Text style={styles.createButtonText}>+ Create Session</Text>
      </TouchableOpacity>

      {loading && sessions.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingSessionId ? 'Edit Session' : 'Create Session'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Client</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.client_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, client_id: value })
                    }
                  >
                    <Picker.Item label="Select a client" value="" />
                    {clients.map((client) => (
                      <Picker.Item
                        key={client.id}
                        label={client.name}
                        value={client.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Participant ID</Text>
                <TextInput
                  style={styles.input}
                  value={formData.participant_id}
                  onChangeText={(text) =>
                    setFormData({ ...formData, participant_id: text })
                  }
                  placeholder="Enter participant ID"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.start_time}
                  onChangeText={(text) =>
                    setFormData({ ...formData, start_time: text })
                  }
                  placeholder="YYYY-MM-DD HH:MM:SS"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.end_time}
                  onChangeText={(text) =>
                    setFormData({ ...formData, end_time: text })
                  }
                  placeholder="YYYY-MM-DD HH:MM:SS"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cost (GBP)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.cost.toString()}
                  onChangeText={(text) =>
                    setFormData({ ...formData, cost: parseFloat(text) || 0 })
                  }
                  keyboardType="numeric"
                  placeholder="0.00"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Attendance</Text>
                <TextInput
                  style={styles.input}
                  value={formData.attendance}
                  onChangeText={(text) =>
                    setFormData({ ...formData, attendance: text })
                  }
                  placeholder="e.g. Present"
                />
              </View>

              <View style={styles.switchGroup}>
                <Text style={styles.label}>Paid</Text>
                <Switch
                  value={formData.paid}
                  onValueChange={(value) =>
                    setFormData({ ...formData, paid: value })
                  }
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setModalOpen(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={saveSession}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  sessionInfo: {
    marginBottom: 12,
  },
  sessionClient: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionCost: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionPaid: {
    fontSize: 14,
    fontWeight: '500',
  },
  paidYes: {
    color: '#34c759',
  },
  paidNo: {
    color: '#ff3b30',
  },
  sessionAttendance: {
    fontSize: 14,
    color: '#666',
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fff0f0',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
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
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
