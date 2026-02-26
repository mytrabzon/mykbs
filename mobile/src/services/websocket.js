import { logger } from '../utils/logger';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
    this.connectionUrl = null;
  }

  connect(url, token) {
    try {
      logger.log('WebSocket connecting', { url });
      
      if (this.socket) {
        this.disconnect();
      }

      this.connectionUrl = `${url}?token=${token}`;
      this.socket = new WebSocket(this.connectionUrl);

      this.socket.onopen = () => {
        logger.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.log('WebSocket message received', { type: data.type });
          this.emit(data.type, data);
        } catch (error) {
          logger.error('WebSocket message parse error', error);
        }
      };

      this.socket.onerror = (error) => {
        logger.error('WebSocket error', error);
        this.emit('error', error);
      };

      this.socket.onclose = (event) => {
        logger.log('WebSocket disconnected', { 
          code: event.code, 
          reason: event.reason,
          wasClean: event.wasClean 
        });
        
        this.isConnected = false;
        this.emit('disconnected', event);
        
        // Yeniden bağlanmayı dene
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      logger.error('WebSocket connection error', error);
    }
  }

  attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.log('Attempting to reconnect', { 
      attempt: this.reconnectAttempts, 
      delay 
    });

    setTimeout(() => {
      if (this.connectionUrl) {
        this.connect(this.connectionUrl.split('?')[0], this.connectionUrl.split('token=')[1]);
      }
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      logger.log('WebSocket disconnecting');
      this.socket.close(1000, 'Normal closure');
      this.socket = null;
      this.isConnected = false;
    }
  }

  send(type, data) {
    if (this.socket && this.isConnected) {
      try {
        const message = JSON.stringify({ type, ...data });
        this.socket.send(message);
        logger.log('WebSocket message sent', { type });
        return true;
      } catch (error) {
        logger.error('WebSocket send error', error);
        return false;
      }
    } else {
      logger.warn('WebSocket not connected, cannot send message');
      return false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Cleanup fonksiyonu
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('WebSocket listener error', error);
        }
      });
    }
  }

  // Özel mesaj tipleri için yardımcı fonksiyonlar
  subscribeToRoom(roomId) {
    return this.send('subscribe', { room: `room:${roomId}` });
  }

  unsubscribeFromRoom(roomId) {
    return this.send('unsubscribe', { room: `room:${roomId}` });
  }

  subscribeToAllRooms() {
    return this.send('subscribe', { room: 'rooms:all' });
  }

  sendRoomUpdate(roomId, data) {
    return this.send('room:update', { roomId, ...data });
  }

  sendCheckIn(roomId, guestData) {
    return this.send('room:checkin', { roomId, guest: guestData });
  }

  sendCheckOut(roomId) {
    return this.send('room:checkout', { roomId });
  }

  sendKBSStatus(roomId, status, error = null) {
    return this.send('room:kbs:status', { 
      roomId, 
      status, 
      error,
      timestamp: new Date().toISOString() 
    });
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export default websocketService;
