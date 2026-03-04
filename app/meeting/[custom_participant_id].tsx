import { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { getMeetingParticipantToken } from '../../lib/api/supabase-api';
export default function MeetingPage() {
  const { custom_participant_id } = useLocalSearchParams<{ custom_participant_id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchToken();
  }, [custom_participant_id]);

  const fetchToken = async () => {
    if (!custom_participant_id) {
      Alert.alert('Error', 'No participant ID provided');
      router.back();
      return;
    }

    const tokenRes = await getMeetingParticipantToken(custom_participant_id);

    tokenRes.match({
      Success: (resolvedToken: string) => {
        setToken(resolvedToken);
        setLoading(false);
      },
      Failure: (err: string) => {
        console.error('Failed to fetch token:', err);
        Alert.alert('Error', 'Failed to load meeting. Please try again.');
        router.back();
        setLoading(false);
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token) {
    return null;
  }

  // Create the meeting HTML with embedded Cloudflare RTK
  const meetingHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Meeting</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }
    #root {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script type="module">
    import { createRoot } from 'https://esm.sh/react-dom@18/client';
    import { createElement, useEffect } from 'https://esm.sh/react@18';
    import { useRealtimeKitClient } from 'https://esm.sh/@cloudflare/realtimekit-react@0.0.7';
    import { RtkMeeting } from 'https://esm.sh/@cloudflare/realtimekit-react-ui@0.0.7';

    function MeetingRoom() {
      const [meeting, initMeeting] = useRealtimeKitClient();

      useEffect(() => {
        initMeeting({
          authToken: '${token}',
          defaults: {
            audio: false,
            video: false
          }
        });
      }, [initMeeting]);

      return createElement(RtkMeeting, { meeting });
    }

    const root = createRoot(document.getElementById('root'));
    root.render(createElement(MeetingRoom));
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: meetingHTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          Alert.alert('Error', 'Failed to load meeting');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
});
