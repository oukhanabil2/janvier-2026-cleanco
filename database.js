// =========================================================================
// INDEXEDDB MANAGER - VERSION DÉVELOPPEMENT
// =========================================================================

class IndexedDBManager {
    constructor() {
        this.db = null;
        this.dbName = 'PlanningDB';
        this.version = 2;
        this.init();
    }

    async init() {
        try {
            this.db = await this.openDatabase();
            this.log('💾 IndexedDB initialisé');
            await this.updateStats();
        } catch (error) {
            this.log(`❌ Erreur initialisation DB: ${error.message}`);
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Création des stores
                if (!db.objectStoreNames.contains('agents')) {
                    const agentsStore = db.createObjectStore('agents', { keyPath: 'id', autoIncrement: true });
                    agentsStore.createIndex('code', 'code', { unique: true });
                    agentsStore.createIndex('groupe', 'groupe', { unique: false });
                }

                if (!db.objectStoreNames.contains('planning')) {
                    const planningStore = db.createObjectStore('planning', { keyPath: 'id', autoIncrement: true });
                    planningStore.createIndex('codeAgent', 'codeAgent', { unique: false });
                    planningStore.createIndex('date', 'date', { unique: false });
                }

                if (!db.objectStoreNames.contains('joursFeries')) {
                    db.createObjectStore('joursFeries', { keyPath: 'date' });
                }

                this.log('🔄 Structure DB créée/mise à jour');
            };
        });
    }

    // Opérations CRUD pour agents
    async addAgent(agent) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['agents'], 'readwrite');
            const store = transaction.objectStore('agents');
            
            const request = store.add({
                ...agent,
                dateCreation: new Date().toISOString(),
                statut: 'actif'
            });

            request.onsuccess = () => {
                this.log(`✅ Agent ${agent.code} ajouté à IndexedDB`);
                this.updateStats();
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllAgents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['agents'], 'readonly');
            const store = transaction.objectStore('agents');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAgent(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['agents'], 'readonly');
            const store = transaction.objectStore('agents');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateAgent(id, updates) {
        return new Promise(async (resolve, reject) => {
            const agent = await this.getAgent(id);
            if (!agent) {
                reject(new Error('Agent non trouvé'));
                return;
            }

            const transaction = this.db.transaction(['agents'], 'readwrite');
            const store = transaction.objectStore('agents');
            
            const updatedAgent = { ...agent, ...updates };
            const request = store.put(updatedAgent);

            request.onsuccess = () => {
                this.log(`✏️ Agent ID ${id} mis à jour`);
                this.updateStats();
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteAgent(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['agents'], 'readwrite');
            const store = transaction.objectStore('agents');
            const request = store.delete(id);

            request.onsuccess = () => {
                this.log(`🗑️ Agent ID ${id} supprimé`);
                this.updateStats();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Données de test
    async addSampleData() {
        const sampleAgents = [
            { code: 'A01', nom: 'DUPONT', prenom: 'Alice', groupe: 'A' },
            { code: 'B02', nom: 'MARTIN', prenom: 'Bob', groupe: 'B' },
            { code: 'C03', nom: 'LEFEVRE', prenom: 'Carole', groupe: 'C' },
            { code: 'D04', nom: 'DUBOIS', prenom: 'David', groupe: 'D' },
            { code: 'E01', nom: 'ZAHIRI', prenom: 'Ahmed', groupe: 'E' }
        ];

        try {
            for (const agent of sampleAgents) {
                await this.addAgent(agent);
            }
            this.log('📊 Données de test ajoutées');
        } catch (error) {
            this.log(`❌ Erreur ajout données test: ${error.message}`);
        }
    }

    async clearDatabase() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['agents', 'planning', 'joursFeries'], 'readwrite');
            
            transaction.objectStore('agents').clear();
            transaction.objectStore('planning').clear();
            transaction.objectStore('joursFeries').clear();

            transaction.oncomplete = () => {
                this.log('🗑️ Base de données vidée');
                this.updateStats();
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async exportData() {
        const agents = await this.getAllAgents();
        const blob = new Blob([JSON.stringify(agents, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `planning_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.log('📤 Données exportées');
    }

    async updateStats() {
        try {
            const agents = await this.getAllAgents();
            
            document.getElementById('db-agents-count').textContent = agents.length;
            document.getElementById('db-planning-count').textContent = '0';
            
            // Estimation taille
            const size = JSON.stringify(agents).length;
            document.getElementById('db-size').textContent = `${(size / 1024).toFixed(2)} KB`;
            
            // Afficher contenu
            this.displayContent(agents);
            
        } catch (error) {
            console.error('Erreur stats:', error);
        }
    }

    displayContent(agents) {
        const container = document.getElementById('db-content');
        if (!container) return;

        if (agents.length === 0) {
            container.textContent = '// Base de données vide';
            return;
        }

        let content = '// Agents dans IndexedDB:\n\n';
        agents.forEach(agent => {
            content += `• ${agent.code} - ${agent.nom} ${agent.prenom} (${agent.groupe})\n`;
        });

        container.textContent = content;
    }

    log(message) {
        const logContainer = document.getElementById('db-log');
        if (logContainer) {
            const entry = document.createElement('div');
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        console.log(message);
    }

    async testDatabase() {
        this.log('🧪 Début tests IndexedDB...');
        
        try {
            // Test ajout
            const testAgent = await this.addAgent({
                code: 'TEST',
                nom: 'Test',
                prenom: 'Database',
                groupe: 'A'
            });
            this.log('✅ Test ajout réussi');
            
            // Test lecture
            const agents = await this.getAllAgents();
            this.log(`✅ Test lecture réussi (${agents.length} agents)`);
            
            // Test suppression
            await this.deleteAgent(testAgent);
            this.log('✅ Test suppression réussi');
            
            this.log('🧪 Tests IndexedDB terminés');
            return { success: true, agentsCount: agents.length };
            
        } catch (error) {
            this.log(`❌ Erreur tests: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Instance globale
const dbManager = new IndexedDBManager();

// Fonctions globales pour HTML
async function dbInit() {
    await dbManager.init();
}

async function dbAddSample() {
    await dbManager.addSampleData();
}

async function dbClear() {
    if (confirm('Vider toute la base de données ?')) {
        await dbManager.clearDatabase();
    }
}

async function dbExport() {
    await dbManager.exportData();
}
