// KLIMABAZAR F2: deterministyczny kolor nazwy agenta na liscie rozmow.
// Hash z ID agenta -> indeks w palecie tokenow n-* (krok -11 = czytelny tekst w dark/light).
const AGENT_TEXT_COLORS = [
  'text-n-iris-11',
  'text-n-teal-11',
  'text-n-ruby-11',
  'text-n-amber-11',
  'text-n-blue-11',
  'text-n-violet-11',
];

const hashString = str => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000007;
  }
  return hash;
};

export const agentColorClass = agentId => {
  if (!agentId) return 'text-n-slate-11';
  const index = hashString(String(agentId)) % AGENT_TEXT_COLORS.length;
  return AGENT_TEXT_COLORS[index];
};
