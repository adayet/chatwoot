import { computed } from 'vue';

// KLIMABAZAR F6: stan obslugi rozmowy -> kolor tla / lewy pasek / badge na liscie.
// Mapowanie tokenow n-* (radix, auto dark-mode). Uzywane przez ConversationCard (legacy,
// waski ekran) oraz ConversationCardExpanded (components-next, desktop).
// Wariant C: wiersz neutralny, status niesie TYLKO lewy pasek + chip (bez pelnego tla).
// Kolory: Nowy = bez koloru, W toku = zolty (amber), Oczekujace = "pomaranczowy" (ruby -
// brak orange w palecie n-*; pending i tak nie wystepuje bez botow), Rozwiazane = zielony (teal),
// Uspione = neutralny (slate).
export const HANDLING_STATES = {
  new: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.NEW',
    border: '',
    badge: 'bg-n-slate-3 text-n-slate-11',
  },
  inProgress: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.IN_PROGRESS',
    border: 'border-l-2 border-l-n-amber-9',
    badge: 'bg-n-amber-3 text-n-amber-11',
  },
  resolved: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.RESOLVED',
    border: 'border-l-2 border-l-n-teal-9',
    badge: 'bg-n-teal-3 text-n-teal-11',
  },
  snoozed: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.SNOOZED',
    border: 'border-l-2 border-l-n-slate-8',
    badge: 'bg-n-slate-3 text-n-slate-11',
  },
  pending: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.PENDING',
    border: 'border-l-2 border-l-n-ruby-9',
    badge: 'bg-n-ruby-3 text-n-ruby-11',
  },
};

// getChat: getter (() => props.chat), by zachowac reaktywnosc.
export function useConversationHandlingState(getChat) {
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
  return { handlingState };
}
