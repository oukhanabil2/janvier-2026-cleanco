// =========================================================================
// CRUD AGENTS - VERSION DÉVELOPPEMENT
// =========================================================================

class AgentsCRUD {
    constructor() {
        this.agents = [];
        this.currentAgentId = null;
        this.init();
    }

    init() {
        console.log('🔧 CRUD Agents initialisé');
        this.loadMockData();
        this.renderAgentsList();
    }

    loadMockData() {
        // Données de test
        this.agents = [
            { id: 1, code: 'A01', nom: 'DUPONT', prenom: 'Alice', groupe: 'A', statut: 'actif' },
            { id: 2, code: 'B02', nom: 'MARTIN', prenom: 'Bob', groupe: 'B', statut: 'actif' },
            { id: 3, code: 'C03', nom: 'LEFEVRE', prenom: 'Carole', groupe: 'C', statut: 'actif' },
            { id: 4, code: 'D04', nom: 'DUBOIS', prenom: 'David', groupe: 'D', statut: 'actif' },
            { id: 5, code: 'E01', nom: 'ZAHIRI', prenom: 'Ahmed', groupe: 'E', statut: 'actif' }
        ];
    }

    addAgent(code, nom, prenom, groupe) {
        const newAgent = {
            id: Date.now(),
            code: code.toUpperCase(),
            nom: nom.toUpperCase(),
            prenom: prenom,
            groupe: groupe.toUpperCase(),
            statut: 'actif',
            dateCreation: new Date().toISOString()
        };

        this.agents.push(newAgent);
        this.log(`✅ Agent ${newAgent.code} ajouté`);
        this.renderAgentsList();
        return newAgent;
    }

    updateAgent(id, updates) {
        const agentIndex = this.agents.findIndex(a => a.id === id);
        if (agentIndex === -1) {
            this.log(`❌ Agent ID ${id} non trouvé`);
            return false;
        }

        Object.assign(this.agents[agentIndex], updates);
        this.log(`✏️ Agent ${this.agents[agentIndex].code} mis à jour`);
        this.renderAgentsList();
        return true;
    }

    deleteAgent(id) {
        const agentIndex = this.agents.findIndex(a => a.id === id);
        if (agentIndex === -1) {
            this.log(`❌ Agent ID ${id} non trouvé`);
            return false;
        }

        const agentCode = this.agents[agentIndex].code;
        this.agents.splice(agentIndex, 1);
        this.log(`🗑️ Agent ${agentCode} supprimé`);
        this.renderAgentsList();
        return true;
    }

    getAgent(id) {
        return this.agents.find(a => a.id === id);
    }

    getAllAgents() {
        return this.agents;
    }

    renderAgentsList() {
        const container = document.getElementById('agents-list');
        if (!container) return;

        if (this.agents.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucun agent enregistré</p>';
            return;
        }

        let html = '';
        this.agents.forEach(agent => {
            html += `
                <div class="data-item" data-id="${agent.id}">
                    <div>
                        <strong>${agent.code}</strong> - ${agent.nom} ${agent.prenom}
                        <span class="badge" style="background: ${this.getGroupColor(agent.groupe)}; margin-left: 10px">
                            ${agent.groupe}
                        </span>
                    </div>
                    <div>
                        <button onclick="selectAgent(${agent.id})" class="btn-small">✏️</button>
                        <button onclick="deleteAgent(${agent.id})" class="btn-small btn-danger">🗑️</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    getGroupColor(groupe) {
        const colors = {
            'A': '#3498db',
            'B': '#2ecc71',
            'C': '#e74c3c',
            'D': '#f39c12',
            'E': '#9b59b6'
        };
        return colors[groupe] || '#95a5a6';
    }

    log(message) {
        const logContainer = document.getElementById('crud-log');
        if (logContainer) {
            const entry = document.createElement('div');
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        console.log(message);
    }

    testCRUD() {
        this.log('🧪 Début des tests CRUD...');
        
        // Test création
        const testAgent = this.addAgent('TEST', 'Test', 'Agent', 'A');
        if (testAgent) this.log('✅ Test création réussi');
        
        // Test lecture
        const foundAgent = this.getAgent(testAgent.id);
        if (foundAgent) this.log('✅ Test lecture réussi');
        
        // Test modification
        const updated = this.updateAgent(testAgent.id, { nom: 'MODIFIE' });
        if (updated) this.log('✅ Test modification réussi');
        
        // Test suppression
        const deleted = this.deleteAgent(testAgent.id);
        if (deleted) this.log('✅ Test suppression réussi');
        
        this.log('🧪 Tests CRUD terminés');
        return { success: true };
    }
}

// Instance globale
const agentsCRUD = new AgentsCRUD();

// Fonctions globales pour HTML
function crudAddAgent() {
    const code = document.getElementById('agent-code').value;
    const nom = document.getElementById('agent-nom').value;
    const prenom = document.getElementById('agent-prenom').value;
    const groupe = document.getElementById('agent-groupe').value;

    if (!code || !nom || !groupe) {
        agentsCRUD.log('⚠️ Veuillez remplir tous les champs');
        return;
    }

    agentsCRUD.addAgent(code, nom, prenom, groupe);
    
    // Réinitialiser le formulaire
    document.getElementById('agent-code').value = '';
    document.getElementById('agent-nom').value = '';
    document.getElementById('agent-prenom').value = '';
}

function crudUpdateAgent() {
    if (!agentsCRUD.currentAgentId) {
        agentsCRUD.log('⚠️ Aucun agent sélectionné pour modification');
        return;
    }

    const code = document.getElementById('agent-code').value;
    const nom = document.getElementById('agent-nom').value;
    const prenom = document.getElementById('agent-prenom').value;
    const groupe = document.getElementById('agent-groupe').value;

    const updates = {};
    if (code) updates.code = code.toUpperCase();
    if (nom) updates.nom = nom.toUpperCase();
    if (prenom) updates.prenom = prenom;
    if (groupe) updates.groupe = groupe.toUpperCase();

    agentsCRUD.updateAgent(agentsCRUD.currentAgentId, updates);
    agentsCRUD.currentAgentId = null;
}

function crudDeleteAgent() {
    if (!agentsCRUD.currentAgentId) {
        agentsCRUD.log('⚠️ Aucun agent sélectionné pour suppression');
        return;
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) {
        agentsCRUD.deleteAgent(agentsCRUD.currentAgentId);
        agentsCRUD.currentAgentId = null;
        
        // Réinitialiser le formulaire
        document.getElementById('agent-code').value = '';
        document.getElementById('agent-nom').value = '';
        document.getElementById('agent-prenom').value = '';
        document.getElementById('agent-groupe').value = 'A';
    }
}

function selectAgent(id) {
    const agent = agentsCRUD.getAgent(id);
    if (!agent) return;

    agentsCRUD.currentAgentId = id;
    document.getElementById('agent-code').value = agent.code;
    document.getElementById('agent-nom').value = agent.nom;
    document.getElementById('agent-prenom').value = agent.prenom;
    document.getElementById('agent-groupe').value = agent.groupe;

    agentsCRUD.log(`📝 Agent ${agent.code} sélectionné pour modification`);
}

function deleteAgent(id) {
    if (confirm('Supprimer cet agent ?')) {
        agentsCRUD.deleteAgent(id);
    }
}
