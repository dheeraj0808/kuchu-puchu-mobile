import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getPromptCatalog, putPrompts } from '@/api/endpoints/profile';
import { errorMessage } from '@/api/errors';
import type { PromptAnswer, PromptQuestion } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { ANSWER_MAX, answerProblem, canAddPrompt, removeAnswer, upsertAnswer } from '@/features/onboarding/rules';
import { contactDetailsField, useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

type SheetState = { kind: 'pick' } | { kind: 'answer'; question: PromptQuestion; editing: boolean } | null;

/**
 * Screen 13 — Prompts. Up to 3 answers (≤ 200 chars) picked from
 * GET /catalog/prompts; edit or remove each. PUT /profile/prompts.
 * Skip keeps whatever is answered so far (often nothing).
 */
export default function PromptsScreen() {
  const { user } = useAuth();
  const catalog = useQuery({ queryKey: ['catalog', 'prompts'], queryFn: getPromptCatalog, staleTime: Infinity });
  const [answers, setAnswers] = useState<PromptAnswer[]>(user?.profile?.prompts ?? []);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveStep((list: PromptAnswer[]) => putPrompts(list));

  const questionFor = (id: string) => catalog.data?.find((q) => q.id === id);
  const unanswered = (catalog.data ?? []).filter((q) => !answers.some((a) => a.promptId === q.id));

  const submit = async () => {
    setFormError(null);
    setBlocked(null);
    try {
      await save.mutateAsync(answers);
    } catch (err) {
      const field = contactDetailsField(err);
      // details.field is "prompts.<index>" — point at that answer.
      if (field) setBlocked(answers[Number(field.split('.')[1])]?.promptId ?? null);
      else setFormError(errorMessage(err));
    }
  };

  return (
    <OnboardingScreen
      step="prompts"
      title={t('prompts.title')}
      subtitle={t('prompts.subtitle')}
      onSkip={submit}
      skipDisabled={save.isPending}
      footer={
        <Button
          label={t('common.continue')}
          disabled={answers.length === 0}
          loading={save.isPending}
          loadingLabel={t('common.saving')}
          onPress={submit}
        />
      }>
      {catalog.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : catalog.isError ? (
        <Banner message={t('prompts.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void catalog.refetch()} />
      ) : (
        <View style={styles.list}>
          {answers.map((a) => {
            const question = questionFor(a.promptId);
            if (!question) return null;
            return (
              <PromptCard
                key={a.promptId}
                question={question.text}
                answer={a.answer}
                error={blocked === a.promptId ? t('about.contactNotAllowed') : null}
                onEdit={() => setSheet({ kind: 'answer', question, editing: true })}
              />
            );
          })}
          {canAddPrompt(answers) && unanswered.length > 0 ? <AddPromptCard onPress={() => setSheet({ kind: 'pick' })} /> : null}
          {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}
        </View>
      )}

      <Sheet visible={sheet?.kind === 'pick'} onClose={() => setSheet(null)}>
        <PromptPicker questions={unanswered} onPick={(question) => setSheet({ kind: 'answer', question, editing: false })} />
      </Sheet>
      <Sheet visible={sheet?.kind === 'answer'} onClose={() => setSheet(null)}>
        {sheet?.kind === 'answer' ? (
          <AnswerForm
            key={sheet.question.id}
            question={sheet.question}
            initial={answers.find((a) => a.promptId === sheet.question.id)?.answer ?? ''}
            editing={sheet.editing}
            onSave={(text) => {
              setAnswers((list) => upsertAnswer(list, sheet.question.id, text));
              if (blocked === sheet.question.id) setBlocked(null);
              setSheet(null);
            }}
            onRemove={() => {
              setAnswers((list) => removeAnswer(list, sheet.question.id));
              setSheet(null);
            }}
          />
        ) : null}
      </Sheet>
    </OnboardingScreen>
  );
}

function PromptCard({ question, answer, error, onEdit }: { question: string; answer: string; error: string | null; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('prompts.editLabel', { question })}. ${answer}`}
        onPress={onEdit}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : 'transparent', opacity: pressed ? 0.85 : 1 },
        ]}>
        <View style={styles.cardHead}>
          <AppText style={[typography.label, styles.flex]} tone="primary">
            {question}
          </AppText>
          <Icon name="pencil-outline" size={20} color="textMuted" />
        </View>
        <AppText variant="heading">{answer}</AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" tone="danger" role="alert" style={styles.cardError}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function AddPromptCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('prompts.choose')}
      onPress={onPress}
      style={({ pressed }) => [styles.add, { borderColor: colors.primaryBorder, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="plus" size={22} color="primary" />
      <AppText style={typography.button} tone="primary">
        {t('prompts.choose')}
      </AppText>
    </Pressable>
  );
}

function PromptPicker({ questions, onPick }: { questions: PromptQuestion[]; onPick: (q: PromptQuestion) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sheetBody}>
      <AppText variant="title">{t('prompts.pickTitle')}</AppText>
      {questions.length === 0 ? (
        <AppText tone="muted">{t('prompts.allUsed')}</AppText>
      ) : (
        <ScrollView style={styles.pickList}>
          {questions.map((q, i) => (
            <Pressable
              key={q.id}
              accessibilityRole="button"
              accessibilityLabel={q.text}
              onPress={() => onPick(q)}
              style={({ pressed }) => [
                styles.pickRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surface },
              ]}>
              <AppText style={[typography.body, styles.flex]}>{q.text}</AppText>
              <Icon name="chevron-right" size={22} color="textSubtle" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

interface AnswerFormProps {
  question: PromptQuestion;
  initial: string;
  editing: boolean;
  onSave: (text: string) => void;
  onRemove: () => void;
}

function AnswerForm({ question, initial, editing, onSave, onRemove }: AnswerFormProps) {
  const [text, setText] = useState(initial);
  const problem = answerProblem(text);
  return (
    <View style={styles.sheetBody}>
      <AppText style={typography.label} tone="primary">
        {question.text}
      </AppText>
      <TextField
        label={t('prompts.answerLabel', { question: question.text })}
        value={text}
        onChangeText={setText}
        placeholder={t('prompts.answerPlaceholder')}
        multiline
        maxLength={ANSWER_MAX}
        showCounter
        autoFocus
      />
      <Button label={t('prompts.save')} disabled={problem !== null} onPress={() => onSave(text)} />
      {editing ? <Button variant="plain" label={t('prompts.remove')} onPress={onRemove} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { paddingVertical: spacing.xl },
  list: { gap: spacing.sm + 2 },
  card: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, gap: spacing.xxs + 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardError: { marginTop: spacing.xxs, marginLeft: spacing.xxs },
  add: {
    minHeight: 112,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  sheetBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  pickList: { maxHeight: 360 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingVertical: spacing.sm },
});
