# KLIMABAZAR F-podpis: doklejanie stopki agenta do treści wiadomości wychodzącej.
#
# Cel: stopka ma trafiać na każdą wiadomość agenta niezależnie od klienta — panel webowy,
# aplikacja mobilna i integracje przez API. Wcześniej doklejał ją front, więc wiadomości
# wysyłane z aplikacji na telefonie szły bez stopki.
#
# Miejsce: wołane z Messages::MessageBuilder, czyli z jedynego wspólnego punktu wejścia
# dla wszystkich tych klientów. Operuje na zbudowanym (jeszcze niezapisanym) rekordzie,
# dzięki czemu zmiana w pliku upstreamowym to jedna linia — mniej konfliktów przy mergach.
#
# Front NIE dokleja już stopki — pokazuje wyłącznie podgląd pod polem edycji.
class Messages::AgentSignature
  DELIMITER = "\n\n--\n\n".freeze

  def initialize(message)
    @message = message
  end

  def apply!
    return unless applicable?

    @message.content = "#{@message.content.rstrip}#{DELIMITER}#{@message.sender.message_signature}"
  end

  private

  def applicable?
    outgoing_text_message? && agent_with_signature? && enabled_for_channel?
  end

  # `content_type` inne niż `text` to wiadomości strukturalne (karty, formularze)
  # i połączenia głosowe — nie są korespondencją, stopka do nich nie należy.
  # Uwaga: działamy na rekordzie przed zapisem, a `message_params` ustawia
  # `content_type` wprost na `nil`, gdy klient go nie podał (domyślne `text` wchodzi
  # dopiero z bazy) — dlatego `nil` traktujemy jak zwykły tekst.
  def outgoing_text_message?
    @message.content.present? && @message.outgoing? && !@message.private? &&
      (@message.content_type.nil? || @message.text?)
  end

  # Nadawcą wiadomości wychodzącej bywa też bot — stopkę dostaje wyłącznie agent.
  # Automatyzacje tworzą wiadomości bez użytkownika, więc odpadają tutaj.
  def agent_with_signature?
    @message.sender.is_a?(User) && @message.sender.message_signature.present?
  end

  # Ta sama flaga i ten sam slug kanału, których używa panel
  # (`slugifyChannel` w `useUISettings.js`), np. Channel::Email -> channel_email.
  def enabled_for_channel?
    slug = @message.inbox.channel_type.downcase.tr(' -', '__').gsub('::', '_')
    @message.sender.ui_settings.to_h["#{slug}_signature_enabled"].present?
  end
end
