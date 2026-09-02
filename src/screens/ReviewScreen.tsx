import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { useDocs } from '../state/DocsContext';
import { addPages, deletePage, movePage, retakePage, rotatePage } from '../lib/scanFlow';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

export function ReviewScreen({ route, navigation }: ScreenProps<'Review'>) {
  const { docId } = route.params;
  const { getDoc, putDoc, removeDoc } = useDocs();
  const doc = getDoc(docId);

  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      try {
        setBusy(label);
        await fn();
      } catch (err) {
        Alert.alert('Something went wrong', err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const pageCount = doc?.pages.length ?? 0;
  const headerSub = useMemo(() => {
    if (!doc) return '';
    return `${pageCount} page${pageCount === 1 ? '' : 's'}`;
  }, [doc, pageCount]);

  if (!doc) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>This scan is no longer available.</Text>
        <View style={styles.footer}>
          <Button title="Back" kind="secondary" onPress={() => navigation.popToTop()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={styles.sub}>{headerSub}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {doc.pages.map((page, index) => (
          <View key={page.id} style={styles.pageCard}>
            <Pressable onPress={() => setPreview(page.uri)}>
              <Image source={{ uri: page.uri }} style={styles.thumb} resizeMode="contain" />
            </Pressable>
            <View style={styles.pageMeta}>
              <Text style={styles.pageLabel}>
                Page {index + 1} · {page.orientation}
              </Text>
            </View>
            <View style={styles.actions}>
              <ActionButton
                label="Rotate"
                onPress={() =>
                  run('Rotating…', async () => putDoc(await rotatePage(doc, page.id)))
                }
              />
              <ActionButton
                label="Retake"
                onPress={() =>
                  run('Opening scanner…', async () => putDoc(await retakePage(doc, page.id)))
                }
              />
              <ActionButton
                label="↑"
                disabled={index === 0}
                onPress={() => run('…', async () => putDoc(await movePage(doc, page.id, -1)))}
              />
              <ActionButton
                label="↓"
                disabled={index === doc.pages.length - 1}
                onPress={() => run('…', async () => putDoc(await movePage(doc, page.id, 1)))}
              />
              <ActionButton
                label="Delete"
                danger
                onPress={() =>
                  Alert.alert('Delete page?', `Page ${index + 1} will be removed.`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        run('Deleting…', async () => {
                          const next = await deletePage(doc, page.id);
                          if (next.pages.length === 0) {
                            await removeDoc(doc.id);
                            navigation.popToTop();
                          } else {
                            putDoc(next);
                          }
                        }),
                    },
                  ])
                }
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Button
            title="Add pages"
            kind="secondary"
            icon="＋"
            onPress={() => run('Opening scanner…', async () => putDoc(await addPages(doc)))}
          />
        </View>
        <View style={styles.footerItem}>
          <Button
            title="Next"
            onPress={() => navigation.navigate('Export', { docId: doc.id })}
            disabled={pageCount === 0}
          />
        </View>
      </View>

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview ? (
            <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>

      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        danger && styles.actionBtnDanger,
        pressed && !disabled && styles.pressed,
        disabled && styles.actionDisabled,
      ]}
    >
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
  missing: { color: theme.colors.textDim, textAlign: 'center', marginTop: 80, fontSize: 15 },
  list: { padding: 16, gap: 16 },
  pageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 10,
  },
  thumb: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pageMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  pageLabel: { color: theme.colors.textDim, fontSize: 13, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 44,
    alignItems: 'center',
  },
  actionBtnDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  actionDisabled: { opacity: 0.35 },
  actionText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  actionTextDanger: { color: theme.colors.danger },
  pressed: { opacity: 0.6 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  footerItem: { flex: 1 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: '100%' },
});
