import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getDocuments } from '../../lib/api/supabase-api';

type Document = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  created_at: string;
};

export default function ClientDocumentsScreen() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const result = await getDocuments(user.id);
    result.match({
      Success: (data: Document[]) => {
        setDocuments(data);
        setLoading(false);
      },
      Failure: (err: string) => {
        console.error('Failed to fetch documents:', err);
        Alert.alert('Error', 'Failed to load documents');
        setLoading(false);
      }
    });
  };

  const handleViewDocument = async (url: string) => {
    if (!url) {
      Alert.alert('Error', 'No document URL available');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open document URL');
      }
    } catch (error) {
      console.error('Failed to open document:', error);
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <View style={styles.documentCard}>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName}>{item.name || 'Untitled Document'}</Text>
        <Text style={styles.documentDate}>
          {new Date(item.created_at).toLocaleDateString('en-GB')}
        </Text>
      </View>

      {item.url ? (
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handleViewDocument(item.url)}
        >
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noLinkText}>No Link</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && documents.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No documents found</Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchDocuments}
        />
      )}
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
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  documentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 14,
    color: '#666',
  },
  viewButton: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  noLinkText: {
    fontSize: 14,
    color: '#999',
  },
});
