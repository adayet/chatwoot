import { computed } from 'vue';

// KLIMABAZAR F6: stan obslugi rozmowy -> kolor tla / lewy pasek / badge na liscie.
// Mapowanie tokenow n-* (radix, auto dark-mode). Uzywane przez ConversationCard (legacy,
// waski ekran) oraz ConversationCardExpanded (components-next, desktop).
export const HANDLING_STATES = {
  new: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.NEW',
    tone: 'bg-n-amber-2',
    border: 'border-l-2 border-l-n-amber-9',
    badge: 'bg-n-amber-3 text-n-amber-11',
  },
  inProgress: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.IN_PROGRESS',
    tone: 'bg-n-blue-2',
    border: 'border-l-2 border-l-n-blue-9',
    badge: 'bg-n-blue-3 text-n-blue-11',
  },
  resolved: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.RESOLVED',
    tone: 'bg-n-teal-2',
    border: 'border-l-2 border-l-n-teal-9',
    badge: 'bg-n-teal-3 text-n-teal-11',
  },
  snoozed: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.SNOOZED',
    tone: 'bg-n-slate-2',
    border: 'border-l-2 border-l-n-slate-8',
    badge: 'bg-n-slate-3 text-n-slate-11',
  },
  pending: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.PENDING',
    tone: 'bg-n-iris-2',
    border: 'border-l-2 border-l-n-iris-9',
    badge: 'bg-n-iris-3 text-n-iris-11',
  },
};

// getChat / getIsActiveChat / getSelected: gettery (() => props.x), by zachowac reaktywnosc.
export function useConversationHandlingState(
  getChat,
  { isActiveChat = () => false, selected = () => false } = {}
) {
  const stateKey = computed(() => {
    const chat = getChat() || {};
    if (chat.status === 'resolved') return 'resolved';
    if (chat.status === 'snoozed') return 'snoozed';
    if (chat.status === 'pending') return 'pending';
    // open: nieobsluzony (brak assignee + zero odpowiedzi) vs w toku
    const hasAssignee = Boolean(chat.meta?.assignee?.id);
    const hasReplied = Number(chat.first_reply_created_at) > 0;
    return hasAssignee || hasReplied ? 'inProgress' : 'new';
  });

  const handlingState = computed(() => HANDLING_STATES[stateKey.value]);

  // tlo tylko gdy wiersz nie jest aktywny/zaznaczony (zeby nie nadpisywac tych stanow)
  const toneClass = computed(() =>
    isActiveChat() || selected() ? '' : handlingState.value.tone
  );

  return { handlingState, toneClass };
}
