import { computed } from 'vue';

// KLIMABAZAR F6: stan obslugi rozmowy -> pasek statusu + chip na liscie.
// Uzywane przez ConversationCard (legacy/domyslny) oraz ConversationCardExpanded (components-next).
// Wariant C: wiersz neutralny, status niesie TYLKO prawy pasek + chip (bez pelnego tla).
// Pasek to OSOBNY element absolutny (klasa `bar` = tlo), NIE CSS border - bo Chatwoot ma regule
// [&>div:has(+ div .active)>*]:!border-n-surface-1, ktora z !important + wyzsza specyficznoscia
// szarzy wszystkie krawedzie wiersza nad aktywnym (zlanie dzielnika) i zabijala pasek-border.
// Lewa krawedz zarezerwowana dla wskaznika "aktywny" (niebieski pasek), zeby sie nie mieszaly.
// Kolory: Nowy = bez koloru, W toku = zolty (amber), Oczekujace = "pomaranczowy" (ruby - brak
// orange w palecie n-*; pending i tak nie wystepuje bez botow), Rozwiazane = zielony (teal),
// Uspione = neutralny (slate).
export const HANDLING_STATES = {
  new: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.NEW',
    bar: '',
    badge: 'bg-n-slate-3 text-n-slate-11',
  },
  inProgress: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.IN_PROGRESS',
    bar: 'bg-n-amber-9',
    badge: 'bg-n-amber-3 text-n-amber-11',
  },
  resolved: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.RESOLVED',
    bar: 'bg-n-teal-9',
    badge: 'bg-n-teal-3 text-n-teal-11',
  },
  snoozed: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.SNOOZED',
    bar: 'bg-n-slate-8',
    badge: 'bg-n-slate-3 text-n-slate-11',
  },
  pending: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.PENDING',
    bar: 'bg-n-ruby-9',
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
