class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.init();
    }

    init() {
        // Détection changement connexion
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Mettre à jour l'affichage
        this.updateConnectionStatus();
        
        // Initialiser la base de données
        this.db = window.PlanningDB;
        
        // Vérifier les données en attente
        this.checkPendingData();
    }

    handleOnline() {
        this.isOnline = true;
        this.updateConnectionStatus();
        this.showNotification('Connexion rétablie', 'success');
        
        // Synchroniser les données en attente
        this.syncPendingData();
    }

    handleOffline() {
        this.isOnline = false;
        this.updateConnectionStatus();
        this.showNotification('Mode hors ligne activé', 'warning');
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connection-indicator');
        const lastSync = document.getElementById('last-sync');
        
        if (this.isOnline) {
            indicator.className = 'online';
            indicator.textContent = '● En ligne';
            indicator.style.color = '#27ae60';
        } else {
            indicator.className = 'offline';
            indicator.textContent = '● Hors ligne';
            indicator.style.color = '#e74c3c';
        }
        
        // Mettre à jour la dernière synchronisation
        const lastSyncTime = localStorage.getItem('lastSync');
        if (lastSyncTime) {
            lastSync.textContent = `Dernière synchro: ${new Date(lastSyncTime).toLocaleString()}`;
        }
    }

    async syncPendingData() {
        if (!this.isOnline) return;
        
        const pending = JSON.parse(localStorage.getItem('pendingSync') || '[]');
        if (pending.length === 0) return;
        
        this.showNotification('Synchronisation des données en cours...', 'info');
        
        try {
            // Synchroniser chaque élément
            for (const item of pending) {
                await this.syncItem(item);
            }
            
            // Vider la file d'attente
            localStorage.removeItem('pendingSync');
            localStorage.setItem('lastSync', new Date().toISOString());
            
            this.showNotification('Synchronisation terminée', 'success');
            this.updateConnectionStatus();
            
        } catch (error) {
            this.showNotification(`Erreur synchronisation: ${error.message}`, 'error');
        }
    }

    async syncItem(item) {
        // Implémentez votre logique de synchronisation ici
        // Par exemple, envoyer à un serveur
        const serverUrl = localStorage.getItem('serverUrl') || 'https://votre-serveur.com/api';
        
        const response = await fetch(`${serverUrl}/${item.type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        return await response.json();
    }

    addToSyncQueue(item) {
        const pending = JSON.parse(localStorage.getItem('pendingSync') || '[]');
        pending.push({
            ...item,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        
        localStorage.setItem('pendingSync', JSON.stringify(pending));
        
        if (this.isOnline) {
            this.syncPendingData();
        }
    }

    checkPendingData() {
        const pending = JSON.parse(localStorage.getItem('pendingSync') || '[]');
        if (pending.length > 0) {
            this.showNotification(`${pending.length} élément(s) en attente de synchronisation`, 'warning');
        }
    }

    async manualSync() {
        if (!this.isOnline) {
            this.showNotification('Pas de connexion internet', 'error');
            return;
        }
        
        this.showNotification('Synchronisation manuelle en cours...', 'info');
        
        try {
            await this.syncPendingData();
            // Synchroniser également toutes les données
            await this.db.syncWithServer(localStorage.getItem('serverUrl'));
            
            this.showNotification('Synchronisation complète réussie', 'success');
        } catch (error) {
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    async backupLocalData() {
        try {
            const backup = await this.db.backup();
            this.showNotification(`Sauvegarde créée: ${backup.filename}`, 'success');
        } catch (error) {
            this.showNotification(`Erreur sauvegarde: ${error.message}`, 'error');
        }
    }

    async restoreLocalData(file) {
        if (!confirm('Êtes-vous sûr de vouloir restaurer ? Toutes les données actuelles seront remplacées.')) {
            return;
        }
        
        try {
            await this.db.restore(file);
            this.showNotification('Restauration réussie', 'success');
            
            // Recharger l'application
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            this.showNotification(`Erreur restauration: ${error.message}`, 'error');
        }
    }

    getStorageInfo() {
        return new Promise((resolve, reject) => {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                navigator.storage.estimate().then(estimate => {
                    resolve({
                        usage: estimate.usage,
                        quota: estimate.quota,
                        percent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
                    });
                }).catch(reject);
            } else {
                reject(new Error('API Storage non disponible'));
            }
        });
    }

    showNotification(message, type = 'info') {
        const notificationCenter = document.getElementById('notification-center') || this.createNotificationCenter();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${this.getNotificationIcon(type)}</strong>
                <span>${message}</span>
            </div>
        `;
        
        notificationCenter.appendChild(notification);
        
        // Auto-remove
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    createNotificationCenter() {
        const div = document.createElement('div');
        div.id = 'notification-center';
        document.body.appendChild(div);
        return div;
    }
}

// Initialiser
document.addEventListener('DOMContentLoaded', () => {
    window.OfflineManager = new OfflineManager();
});