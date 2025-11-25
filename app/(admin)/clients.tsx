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
} from 'react-native';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types/admin';

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('Profile')
        .select('*')
        .eq('role', 'client');

      if (error) throw error;

      if (profiles) {
        const clientsData: Client[] = profiles.map((p: any) => ({
          id: p.id,
          name: `${p.given_name} ${p.family_name}`,
          given_name: p.given_name,
          family_name: p.family_name,
        }));
        setClients(clientsData);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (client: Client) => {
    setEditingClient({ ...client });
    setEditModalOpen(true);
  };

  const saveClient = async () => {
    if (!editingClient) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('Profile')
        .update({
          given_name: editingClient.given_name,
          family_name: editingClient.family_name,
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      // Update local state
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? {
              ...editingClient,
              name: `${editingClient.given_name} ${editingClient.family_name}`,
            }
            : c
        )
      );

      setEditModalOpen(false);
      setEditingClient(null);
    } catch (error) {
      console.error('Failed to update client:', error);
      Alert.alert('Error', 'Failed to update client');
    } finally {
      setLoading(false);
    }
  };

  const renderClient = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.clientInfo}>
        <Text style={styles.clientName}>{item.name}</Text>
      </View>
      <Text style={styles.editButton}>Edit</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading && clients.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={clients}
          renderItem={renderClient}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={editModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Client</Text>

            {editingClient && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Given Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editingClient.given_name}
                    onChangeText={(text) =>
                      setEditingClient({ ...editingClient, given_name: text })
                    }
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Family Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editingClient.family_name}
                    onChangeText={(text) =>
                      setEditingClient({ ...editingClient, family_name: text })
                    }
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setEditModalOpen(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={saveClient}
                    disabled={loading}
                  >
                    <Text style={styles.saveButtonText}>
                      {loading ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  listContent: {
    padding: 16,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    color: '#007AFF',
    fontSize: 14,
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
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
