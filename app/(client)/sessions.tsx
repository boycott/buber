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
import { router } from 'expo-router';
import type { Session } from '../../types/admin';

const SQUARE_API = process.env.EXPO_PUBLIC_SQUARE_API || 'https://connect.squareup.com/v2';
const SQUARE_ACCESS_TOKEN = process.env.EXPO_PUBLIC_SQUARE_ACCESS_TOKEN || '';
const SQUARE_LOCATION_ID = process.env.EXPO_PUBLIC_SQUARE_LOCATION_ID || '';

export default function ClientSessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingSessionId, setPayingSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSessions([]);
        return;
      }

      const { data, error } = await supabase
        .from('Session')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;

      if (data) {
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (session: Session) => {
    if (session.paid) {
      Alert.alert('Already Paid', 'This session has already been paid for.');
      return;
    }

    setPayingSessionId(session.id);

    try {
      // Create Square Payment Link
      const response = await fetch(`${SQUARE_API}/online-checkout/payment-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          description: session.id,
          quick_pay: {
            name: `Therapy session on ${new Date(session.start_time).toLocaleDateString('en-GB')}`,
            price_money: {
              amount: session.cost * 100, // Amount in cents
              currency: 'GBP',
            },
            location_id: SQUARE_LOCATION_ID,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Square API Error:', data);
        throw new Error('Failed to create payment link');
      }

      if (data.payment_link?.url) {
        // Open payment link in browser
        const canOpen = await Linking.canOpenURL(data.payment_link.url);
        if (canOpen) {
          await Linking.openURL(data.payment_link.url);
        } else {
          Alert.alert('Error', 'Cannot open payment link');
        }
      } else {
        throw new Error('No payment URL returned');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Failed to create payment link');
    } finally {
      setPayingSessionId(null);
    }
  };

  const joinMeeting = (participantId: string) => {
    router.push(`/meeting/${participantId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderSession = ({ item }: { item: Session }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>
          {new Date(item.start_time).toLocaleDateString('en-GB')}
        </Text>
        <View style={[styles.badge, item.paid ? styles.badgePaid : styles.badgeUnpaid]}>
          <Text style={[styles.badgeText, item.paid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
            {item.paid ? 'Paid' : 'Unpaid'}
          </Text>
        </View>
      </View>

      <View style={styles.sessionDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time:</Text>
          <Text style={styles.detailValue}>
            {formatTime(item.start_time)} - {formatTime(item.end_time)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Cost:</Text>
          <Text style={styles.detailValue}>£{item.cost}</Text>
        </View>

        {item.attendance && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Attendance:</Text>
            <Text style={styles.detailValue}>{item.attendance}</Text>
          </View>
        )}
      </View>

      <View style={styles.sessionActions}>
        {item.participant_id && (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => joinMeeting(item.participant_id)}
          >
            <Text style={styles.joinButtonText}>Join Meeting</Text>
          </TouchableOpacity>
        )}
        {!item.paid && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => handlePay(item)}
            disabled={payingSessionId === item.id}
          >
            <Text style={styles.payButtonText}>
              {payingSessionId === item.id ? 'Processing...' : 'Pay Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && sessions.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No sessions found</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchSessions}
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
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePaid: {
    backgroundColor: '#d4edda',
  },
  badgeUnpaid: {
    backgroundColor: '#f8d7da',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextPaid: {
    color: '#155724',
  },
  badgeTextUnpaid: {
    color: '#721c24',
  },
  sessionDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  joinButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    flex: 1,
    backgroundColor: '#34c759',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
