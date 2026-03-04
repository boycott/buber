import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet, View, AppState } from 'react-native';
import { supabase } from '../lib/supabase';

import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { getActiveUser, getUserProfile } from '../lib/api/supabase-api';

// Simple UI components since we don't have @rneui/themed installed yet or configured
// and I want to keep dependencies minimal as per plan, but I can use basic RN components.
// Actually, the plan didn't specify a UI library, so I'll use standard React Native components
// or expo-router's Link if needed, but for form I need RN components.

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    getActiveUser().then(res => {
      res.match({
        Success: (user) => checkUserRole(user.id),
        Failure: () => { } // Not logged in
      });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkUserRole(session.user.id);
      }
    });
  }, []);

  async function checkUserRole(userId: string) {
    const profileResult = await getUserProfile(userId);

    profileResult.match({
      Success: (profile: any) => {
        if (profile?.role === 'admin') {
          router.replace('/(admin)');
        } else {
          router.replace('/(client)');
        }
      },
      Failure: (err: any) => {
        console.error('Error fetching profile:', err);
      }
    });
  }

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) Alert.alert(error.message);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <TextInput
          style={styles.input}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          autoCapitalize={'none'}
        />
      </View>
      <View style={styles.verticallySpaced}>
        <TextInput
          style={styles.input}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize={'none'}
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => signInWithEmail()}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 12,
    flex: 1,
    justifyContent: 'center',
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  input: {
    backgroundColor: 'white',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 10,
  },
  buttonOutlineText: {
    color: '#000',
  },
});
