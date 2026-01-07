// === GESTION DES AGENTS (Version simplifiée) ===

class GestionAgents {
    constructor() {
        this.agents = this.loadFromStorage() || [];
    }
    
    // Ajouter un agent
    ajouterAgent(code, nom, prenom, groupe) {
        const agent = {
            code: code.toUpperCase(),
            nom: nom.trim(),
            prenom: prenom.trim(),
            groupe: groupe.toUpperCase(),
            dateEntree: new Date().toISOString().split('T')[0],
            statut: 'actif'
        };
        
        // Vérifier si l'agent existe déjà
        const existe = this.agents.find(a => a.code === agent.code);
        
        if (existe) {
            // Mettre à jour
            Object.assign(existe, agent);
        } else {
            // Ajouter
            this.agents.push(agent);
        }
        
        this.saveToStorage();
        return agent;
    }
    
    // Lister les agents
    listerAgents(groupe = null) {
        if (groupe) {
            return this.agents.filter(a => a.groupe === groupe && a.statut === 'actif');
        }
        return this.agents.filter(a => a.statut === 'actif');
    }
    
    // Modifier un agent
    modifierAgent(code, nouvellesDonnees) {
        const agent = this.agents.find(a => a.code === code.toUpperCase());
        if (agent) {
            Object.assign(agent, nouvellesDonnees);
            this.saveToStorage();
            return true;
        }
        return false;
    }
    
    // Supprimer (marquer comme inactif)
    supprimerAgent(code) {
        const agent = this.agents.find(a => a.code === code.toUpperCase());
        if (agent) {
            agent.statut = 'inactif';
            this.saveToStorage();
            return true;
        }
        return false;
    }
    
    // Stockage local
    saveToStorage() {
        localStorage.setItem('planning_agents', JSON.stringify(this.agents));
    }
    
    loadFromStorage() {
        const data = localStorage.getItem('planning_agents');
        return data ? JSON.parse(data) : null;
    }
}

// Exporter pour utilisation globale
window.GestionAgents = GestionAgents;
class PlanningApp {
    constructor() {
        this.db = window.PlanningDB;
        this.currentMonth = new Date().getMonth() + 1;
        this.currentYear = new Date().getFullYear();
        this.currentTab = 'dashboard';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateDateSelectors();
        await this.loadDashboard();
        this.setupInstallPrompt();
        this.checkForUpdates();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Boutons d'action
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleAction(action);
            });
        });

        // Bouton sync
        document.getElementById('sync-btn')?.addEventListener('click', () => {
            window.OfflineManager?.manualSync();
        });

        // Bouton export
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportData();
        });

        // Refresh planning
        document.getElementById('refresh-planning')?.addEventListener('click', () => {
            this.loadPlanning();
        });

        // Modal agent
        document.getElementById('btn-add-agent')?.addEventListener('click', () => {
            this.showAgentModal();
        });

        document.querySelector('.modal-close')?.addEventListener('click', () => {
            this.hideAgentModal();
        });

        document.querySelector('.btn-cancel')?.addEventListener('click', () => {
            this.hideAgentModal();
        });

        document.getElementById('agent-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAgent();
        });
    }

    async switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
        
        // Load data for tab
        switch(tabName) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'planning':
                await this.loadPlanning();
                break;
            case 'agents':
                await this.loadAgents();
                break;
            case 'stats':
                await this.loadStats();
                break;
        }
    }

    async loadDashboard() {
        try {
            const stats = await this.db.getStats(this.currentMonth, this.currentYear);
            
            // Update stats cards
            document.getElementById('stat-agents').textContent = stats.totalAgents;
            
            const totalShifts = Object.values(stats.shifts).reduce((a, b) => a + b, 0);
            document.getElementById('stat-shifts').textContent = totalShifts;
            
            // TODO: Add radios count
            document.getElementById('stat-radios').textContent = '0';
            
            // Calculate working days
            const workingDays = stats.shifts['1'] + stats.shifts['2'] + stats.shifts['3'];
            document.getElementById('stat-days').textContent = workingDays;
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async loadPlanning() {
        const container = document.getElementById('planning-container');
        if (!container) return;
        
        const mois = document.getElementById('planning-month')?.value?.split('-')[1] || this.currentMonth;
        const annee = document.getElementById('planning-month')?.value?.split('-')[0] || this.currentYear;
        const groupe = document.getElementById('planning-group')?.value || 'all';
        
        try {
            container.innerHTML = '<div class="loading">Chargement du planning...</div>';
            
            const planning = await this.db.getPlanning(mois, annee, groupe === 'all' ? null : groupe);
            
            if (planning.length === 0) {
                container.innerHTML = '<div class="empty-state">Aucun planning disponible</div>';
                return;
            }
            
            // Generate calendar grid
            let html = '<div class="calendar-grid">';
            
            // Header with days
            html += '<div class="calendar-header">';
            html += '<div class="header-cell agent-header">Agent</div>';
            
            const daysInMonth = new Date(annee, mois, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(annee, mois - 1, i);
                const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                html += `<div class="header-cell day-header">${i}<br><small>${dayName}</small></div>`;
            }
            html += '</div>';
            
            // Agent rows
            for (const item of planning) {
                html += '<div class="calendar-row">';
                html += `<div class="agent-cell">${item.agent.nom} ${item.agent.prenom}<br><small>${item.agent.groupe}</small></div>`;
                
                for (let i = 1; i <= daysInMonth; i++) {
                    const shift = item.shifts.find(s => new Date(s.date).getDate() === i);
                    html += `<div class="shift-cell shift-${shift?.shift || 'R'}">${shift?.shift || 'R'}</div>`;
                }
                
                html += '</div>';
            }
            
            html += '</div>';
            container.innerHTML = html;
            
        } catch (error) {
            container.innerHTML = `<div class="error">Erreur: ${error.message}</div>`;
        }
    }

    async loadAgents() {
        const container = document.getElementById('agents-list');
        if (!container) return;
        
        try {
            container.innerHTML = '<div class="loading">Chargement des agents...</div>';
            
            const agents = await this.db.getAgents();
            
            if (agents.length === 0) {
                container.innerHTML = '<div class="empty-state">Aucun agent enregistré</div>';
                return;
            }
            
            let html = '';
            for (const agent of agents) {
                html += `
                    <div class="agent-card">
                        <div class="agent-header">
                            <h3>${agent.nom} ${agent.prenom}</h3>
                            <span class="agent-code">${agent.code}</span>
                        </div>
                        <div class="agent-details">
                            <p><strong>Groupe:</strong> ${agent.groupe}</p>
                            <p><strong>Entrée:</strong> ${agent.dateEntree}</p>
                            <p><strong>Statut:</strong> <span class="status-${agent.statut}">${agent.statut}</span></p>
                        </div>
                        <div class="agent-actions">
                            <button onclick="app.editAgent('${agent.code}')" class="btn-small">Modifier</button>
                            <button onclick="app.deleteAgent('${agent.code}')" class="btn-small btn-danger">Supprimer</button>
                        </div>
                    </div>
                `;
            }
            
            container.innerHTML = html;
            
        } catch (error) {
            container.innerHTML = `<div class="error">Erreur: ${error.message}</div>`;
        }
    }

    async loadStats() {
        const container = document.getElementById('stats-content');
        if (!container) return;
        
        try {
            const stats = await this.db.getStats(this.currentMonth, this.currentYear);
            
            let html = `
                <div class="stats-grid">
                    <div class="stat-card large">
                        <h3>Répartition des Shifts</h3>
                        <div class="chart-container">
                            <canvas id="shiftsChart"></canvas>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <h3>Agents par Groupe</h3>
                        <div class="groups-list">
            `;
            
            for (const [groupe, count] of Object.entries(stats.groupes)) {
                html += `
                    <div class="group-item">
                        <span class="group-name">Groupe ${groupe}</span>
                        <span class="group-count">${count}</span>
                    </div>
                `;
            }
            
            html += `
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <h3>Totaux Shifts</h3>
                        <div class="shifts-totals">
            `;
            
            for (const [shift, count] of Object.entries(stats.shifts)) {
                if (count > 0) {
                    html += `
                        <div class="shift-total">
                            <span class="shift-type">Shift ${shift}:</span>
                            <span class="shift-count">${count}</span>
                        </div>
                    `;
                }
            }
            
            html += `
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
            
            // Initialize chart if Chart.js is available
            if (typeof Chart !== 'undefined') {
                this.renderShiftsChart(stats.shifts);
            }
            
        } catch (error) {
            container.innerHTML = `<div class="error">Erreur: ${error.message}</div>`;
        }
    }

    renderShiftsChart(shiftsData) {
        const ctx = document.getElementById('shiftsChart')?.getContext('2d');
        if (!ctx) return;
        
        const data = {
            labels: ['Matin (1)', 'Après-midi (2)', 'Nuit (3)', 'Repos (R)', 'Congés (C)', 'Maladie (M)', 'Autre (A)'],
            datasets: [{
                data: [shiftsData['1'], shiftsData['2'], shiftsData['3'], shiftsData['R'], shiftsData['C'], shiftsData['M'], shiftsData['A']],
                backgroundColor: [
                    '#a8e6cf', '#ffd3b6', '#ffaaa5', '#dcedc1', '#ff8b94', '#ffd3b6', '#a8a8a8'
                ],
                borderWidth: 1
            }]
        };
        
        new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    showAgentModal(agent = null) {
        const modal = document.getElementById('agent-modal');
        const form = document.getElementById('agent-form');
        
        if (agent) {
            document.getElementById('modal-title').textContent = 'Modifier Agent';
            document.getElementById('agent-code').value = agent.code;
            document.getElementById('agent-code').readOnly = true;
            document.getElementById('agent-nom').value = agent.nom;
            document.getElementById('agent-prenom').value = agent.prenom;
            document.getElementById('agent-groupe').value = agent.groupe;
        } else {
            document.getElementById('modal-title').textContent = 'Nouvel Agent';
            form.reset();
            document.getElementById('agent-code').readOnly = false;
        }
        
        modal.style.display = 'flex';
    }

    hideAgentModal() {
        document.getElementById('agent-modal').style.display = 'none';
        document.getElementById('agent-form').reset();
    }

    async saveAgent() {
        const form = document.getElementById('agent-form');
        const agentData = {
            code: document.getElementById('agent-code').value,
            nom: document.getElementById('agent-nom').value,
            prenom: document.getElementById('agent-prenom').value,
            groupe: document.getElementById('agent-groupe').value,
            dateEntree: '2025-11-01'
        };
        
        try {
            const result = await this.db.addAgent(agentData);
            
            if (result.success) {
                this.showNotification('Agent enregistré avec succès', 'success');
                this.hideAgentModal();
                
                // Refresh data
                if (this.currentTab === 'agents') {
                    await this.loadAgents();
                }
                await this.loadDashboard();
                
                // Add to sync queue
                window.OfflineManager?.addToSyncQueue({
                    type: 'agent',
                    action: 'add',
                    data: agentData
                });
                
            } else {
                this.showNotification(`Erreur: ${result.error}`, 'error');
            }
            
        } catch (error) {
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    async editAgent(code) {
        const agent = await this.db.getAgent(code);
        if (agent) {
            this.showAgentModal(agent);
        }
    }

    async deleteAgent(code) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${code} ?`)) {
            return;
        }
        
        try {
            const result = await this.db.deleteAgent(code);
            
            if (result.success) {
                this.showNotification('Agent supprimé avec succès', 'success');
                
                // Refresh data
                if (this.currentTab === 'agents') {
                    await this.loadAgents();
                }
                await this.loadDashboard();
                
                // Add to sync queue
                window.OfflineManager?.addToSyncQueue({
                    type: 'agent',
                    action: 'delete',
                    data: { code }
                });
                
            } else {
                this.showNotification(`Erreur: ${result.error}`, 'error');
            }
            
        } catch (error) {
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    async handleAction(action) {
        switch(action) {
            case 'import-excel':
                this.switchTab('import');
                break;
            case 'add-agent':
                this.showAgentModal();
                break;
            case 'generate-planning':
                await this.generatePlanning();
                break;
            case 'view-reports':
                this.switchTab('stats');
                break;
        }
    }

    async generatePlanning() {
        if (!confirm('Générer le planning pour le mois en cours ?')) {
            return;
        }
        
        try {
            const now = new Date();
            await this.db.generateShiftsForAllAgents(now.getFullYear(), now.getMonth() + 1);
            
            this.showNotification('Planning généré avec succès', 'success');
            
            if (this.currentTab === 'planning') {
                await this.loadPlanning();
            }
            
        } catch (error) {
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    async exportData() {
        try {
            const result = await this.db.exportToExcel('agents');
            this.showNotification(`Export réussi: ${result.filename}`, 'success');
        } catch (error) {
            this.showNotification(`Erreur export: ${error.message}`, 'error');
        }
    }

    updateDateSelectors() {
        const monthSelect = document.getElementById('planning-month');
        if (monthSelect) {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            monthSelect.value = currentMonth;
            
            // Add 6 months options
            let html = '';
            for (let i = -3; i <= 3; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                html += `<option value="${value}">${label}</option>`;
            }
            monthSelect.innerHTML = html;
            monthSelect.value = currentMonth;
        }
    }

    setupInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'flex';
                installBtn.addEventListener('click', async () => {
                    if (!deferredPrompt) return;
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.style.display = 'none';
                    }
                    deferredPrompt = null;
                });
            }
        });
    }

    checkForUpdates() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js').then(registration => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showNotification('Mise à jour disponible! Rechargez l\'application.', 'info');
                        }
                    });
                });
            });
        }
    }

    showNotification(message, type = 'info') {
        if (window.OfflineManager) {
            window.OfflineManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    async refreshData() {
        switch(this.currentTab) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'planning':
                await this.loadPlanning();
                break;
            case 'agents':
                await this.loadAgents();
                break;
            case 'stats':
                await this.loadStats();
                break;
        }
    }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier la compatibilité
    if (!('indexedDB' in window)) {
        alert('Votre navigateur ne supporte pas IndexedDB. L\'application ne peut pas fonctionner hors ligne.');
        return;
    }
    
    // Initialiser l'application
    window.app = new PlanningApp();
});
