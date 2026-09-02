import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from './ui';
import { theme } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render/lifecycle errors so a bug shows a readable screen instead of
 *  crashing the app to the home screen. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
          <Text style={styles.message}>{error.message}</Text>
          {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
        </ScrollView>
        <Button title="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 20, paddingTop: 80, gap: 16 },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  box: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  boxContent: { padding: 14 },
  message: { color: theme.colors.danger, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  stack: { color: theme.colors.textDim, fontSize: 11, fontFamily: 'Courier' },
});
