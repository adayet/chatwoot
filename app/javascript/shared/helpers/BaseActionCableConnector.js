import { createConsumer } from '@rails/actioncable';

const PRESENCE_INTERVAL = 20000;
const RECONNECT_INTERVAL = 1000;
// KLIMABAZAR F-wswake: jeśli okno było ukryte/bez fokusu dłużej niż tyle ms,
// po powrocie traktujemy socket jako potencjalnie martwy ("zombie") i wymuszamy
// reopen — przeglądarka/PWA w tle zamraża JS, więc ActionCable nie wykrywa
// martwego połączenia, a serwer go nie zamyka (wisi za NAT).
const WAKE_REOPEN_THRESHOLD = 10000;

class BaseActionCableConnector {
  static isDisconnected = false;

  constructor(
    app,
    pubsubToken,
    websocketHost = '',
    presenceInterval = PRESENCE_INTERVAL
  ) {
    const websocketURL = websocketHost ? `${websocketHost}/cable` : undefined;

    this.consumer = createConsumer(websocketURL);
    this.subscription = this.consumer.subscriptions.create(
      {
        channel: 'RoomChannel',
        pubsub_token: pubsubToken,
        account_id: app.$store.getters.getCurrentAccountId,
        user_id: app.$store.getters.getCurrentUserID,
      },
      {
        updatePresence() {
          this.perform('update_presence');
        },
        received: this.onReceived,
        disconnected: () => {
          BaseActionCableConnector.isDisconnected = true;
          this.onDisconnected();
          this.initReconnectTimer();
        },
      }
    );
    this.app = app;
    this.events = {};
    this.reconnectTimer = null;
    this.isAValidEvent = () => true;
    this.triggerPresenceInterval = () => {
      setTimeout(() => {
        this.subscription.updatePresence();
        this.triggerPresenceInterval();
      }, presenceInterval);
    };
    this.triggerPresenceInterval();

    // KLIMABAZAR F-wswake: po wybudzeniu/powrocie do okna wymuś reopen socketu,
    // żeby naprawić "zombie connection" (nieaktualne wiadomości do czasu ręcznego
    // odświeżenia). reopen przechodzi przez istniejący łańcuch
    // disconnected → checkConnection → onReconnect → dociągnięcie wiadomości.
    this.lastHiddenAt = null;
    this.lastReopenAt = null;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleWindowFocus);
  }

  // KLIMABAZAR F-wswake
  handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.lastHiddenAt = Date.now();
    } else {
      this.reopenIfStale();
    }
  };

  // KLIMABAZAR F-wswake
  handleWindowFocus = () => {
    this.reopenIfStale();
  };

  // KLIMABAZAR F-wswake
  reopenIfStale = () => {
    const now = Date.now();
    // unik podwójnego reopen, gdy visibilitychange i focus odpalą razem
    if (this.lastReopenAt && now - this.lastReopenAt < WAKE_REOPEN_THRESHOLD) {
      return;
    }
    const hiddenMs = this.lastHiddenAt ? now - this.lastHiddenAt : 0;
    this.lastHiddenAt = null;
    const connection = this.consumer && this.consumer.connection;
    if (!connection) return;
    if (!connection.isOpen() || hiddenMs > WAKE_REOPEN_THRESHOLD) {
      this.lastReopenAt = now;
      connection.reopen();
    }
  };

  checkConnection() {
    const isConnectionActive = this.consumer.connection.isOpen();
    const isReconnected =
      BaseActionCableConnector.isDisconnected && isConnectionActive;
    if (isReconnected) {
      this.clearReconnectTimer();
      this.onReconnect();
      BaseActionCableConnector.isDisconnected = false;
    } else {
      this.initReconnectTimer();
    }
  }

  clearReconnectTimer = () => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  };

  initReconnectTimer = () => {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.checkConnection();
    }, RECONNECT_INTERVAL);
  };

  // eslint-disable-next-line class-methods-use-this
  onReconnect = () => {};

  // eslint-disable-next-line class-methods-use-this
  onDisconnected = () => {};

  disconnect() {
    // KLIMABAZAR F-wswake
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );
    window.removeEventListener('focus', this.handleWindowFocus);
    this.consumer.disconnect();
  }

  onReceived = ({ event, data } = {}) => {
    if (this.isAValidEvent(data)) {
      if (this.events[event] && typeof this.events[event] === 'function') {
        this.events[event](data);
      }
    }
  };
}

export default BaseActionCableConnector;
