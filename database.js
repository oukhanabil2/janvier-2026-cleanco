// Base de données IndexedDB pour stockage hors ligne
class PlanningDatabase {
    constructor() {
        this.db = new Dexie('PlanningAgentsDB');
        this.setupDatabase();
        this.init();
    }

    setupDatabase() {
        // Définition des tables
        this.db.version(1).stores({
            agents: 'code, nom, prenom, groupe, dateEntree, dateSortie, statut',
            planning: '++id, codeAgent, date, shift, origine',
            shifts: '++id, codeAgent, date, shift',
            joursFeries: 'date, description',
            radios: 'idRadio, modele, statut, agent',
            habillement: 'codeAgent, *tailles',
            avertissements: '++id, codeAgent, date, type, description',
            conges: '++id, codeAgent, debut, fin, type',
            importHistory: '++id, filename, type, date, result',
            settings: 'key, value'
        });
    }

    async init() {
        try {
            await this.db.open();
            console.log('Base de données IndexedDB initialisée');
            await this.createDefaultData();
        } catch (error) {
            console.error('Erreur initialisation DB:', error);
        }
    }

    async createDefaultData() {
        // Données par défaut si base vide
        const count = await this.db.agents.count();
        if (count === 0) {
            await this.addDefaultAgents();
            await this.generateInitialPlanning();
        }
    }

    async addDefaultAgents() {
        const agents = [
            { code: 'A01', nom: 'DUPONT', prenom: 'Alice', groupe: 'A', dateEntree: '2025-11-01', statut: 'actif' },
            { code: 'B02', nom: 'MARTIN', prenom: 'Bob', groupe: 'B', dateEntree: '2025-11-01', statut: 'actif' },
            { code: 'C03', nom: 'LEFEVRE', prenom: 'Carole', groupe: 'C', dateEntree: '2025-11-01', statut: 'actif' },
            { code: 'D04', nom: 'DUBOIS', prenom: 'David', groupe: 'D', dateEntree: '2025-11-01', statut: 'actif' },
            { code: 'E01', nom: 'ZAHIRI', prenom: 'Ahmed', groupe: 'E', dateEntree: '2025-11-01', statut: 'actif' },
            { code: 'E02', nom: 'ZARROUK', prenom: 'Benoit', groupe: 'E', dateEntree: '2025-11-01', statut: 'actif' }
        ];

        await this.db.agents.bulkPut(agents);
    }

    // Gestion des agents
    async getAgents(groupe = null) {
        if (groupe) {
            return await this.db.agents.where('groupe').equals(groupe).and(a => a.statut === 'actif').toArray();
        }
        return await this.db.agents.where('statut').equals('actif').toArray();
    }

    async getAgent(code) {
        return await this.db.agents.where('code').equals(code.toUpperCase()).first();
    }

    async addAgent(agent) {
        agent.code = agent.code.toUpperCase();
        agent.groupe = agent.groupe.toUpperCase();
        agent.dateEntree = agent.dateEntree || '2025-11-01';
        agent.statut = 'actif';
        
        try {
            await this.db.agents.put(agent);
            return { success: true, message: 'Agent ajouté avec succès' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateAgent(code, updates) {
        const agent = await this.getAgent(code);
        if (!agent) return { success: false, error: 'Agent non trouvé' };
        
        Object.assign(agent, updates);
        await this.db.agents.put(agent);
        return { success: true, message: 'Agent modifié avec succès' };
    }

    async deleteAgent(code) {
        await this.db.agents.where('code').equals(code).modify({ statut: 'inactif' });
        return { success: true, message: 'Agent marqué comme inactif' };
    }

    // Gestion du planning
    async getPlanning(mois, annee, groupe = null) {
        const dateDebut = new Date(annee, mois - 1, 1);
        const dateFin = new Date(annee, mois, 0);
        
        let agents = await this.getAgents(groupe);
        const planning = [];

        for (const agent of agents) {
            const shifts = await this.getAgentShifts(agent.code, dateDebut, dateFin);
            planning.push({
                agent: agent,
                shifts: shifts
            });
        }

        return planning;
    }

    async getAgentShifts(codeAgent, dateDebut, dateFin) {
        const shifts = await this.db.shifts
            .where('codeAgent').equals(codeAgent)
            .and(shift => {
                const date = new Date(shift.date);
                return date >= dateDebut && date <= dateFin;
            })
            .toArray();

        // Générer les shifts manquants si nécessaire
        if (shifts.length === 0) {
            return await this.generateShiftsForAgent(codeAgent, dateDebut, dateFin);
        }

        return shifts;
    }

    async generateShiftsForAgent(codeAgent, dateDebut, dateFin) {
        const agent = await this.getAgent(codeAgent);
        if (!agent) return [];

        const shifts = [];
        const currentDate = new Date(dateDebut);

        while (currentDate <= dateFin) {
            const shift = this.calculateShift(agent, currentDate);
            shifts.push({
                codeAgent: codeAgent,
                date: currentDate.toISOString().split('T')[0],
                shift: shift,
                origine: 'theorique'
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Sauvegarder les shifts générés
        await this.db.shifts.bulkPut(shifts);
        return shifts;
    }

    calculateShift(agent, date) {
        // Implémentez votre logique de calcul de shift ici
        // Similaire à votre code Python
        const groupes = ['A', 'B', 'C', 'D'];
        if (groupes.includes(agent.groupe)) {
            return this.calculateStandardShift(agent, date);
        } else if (agent.groupe === 'E') {
            return this.calculateGroupEShift(agent, date);
        }
        return 'R';
    }

    calculateStandardShift(agent, date) {
        // Logique pour groupes A-D
        const cycle = ['1', '1', '2', '2', '3', '3', 'R', 'R'];
        const decalage = { A: 0, B: 2, C: 4, D: 6 }[agent.groupe] || 0;
        
        const dateEntree = new Date(agent.dateEntree);
        const joursDiff = Math.floor((date - dateEntree) / (1000 * 60 * 60 * 24));
        const indexCycle = (joursDiff + decalage) % 8;
        
        return cycle[indexCycle];
    }

    calculateGroupEShift(agent, date) {
        // Logique pour groupe E (5/7)
        const jourSemaine = date.getDay();
        if (jourSemaine === 0 || jourSemaine === 6) return 'R'; // Weekend
        
        // Simplifié - vous pouvez implémenter la logique exacte
        return (date.getDate() % 2 === 0) ? '1' : '2';
    }

    // Import/Export
    async importFromExcel(file, type) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    
                    let result;
                    switch(type) {
                        case 'agents':
                            result = await this.processAgentsImport(jsonData);
                            break;
                        case 'planning':
                            result = await this.processPlanningImport(jsonData);
                            break;
                        case 'radios':
                            result = await this.processRadiosImport(jsonData);
                            break;
                        default:
                            result = { success: false, error: 'Type d\'import non supporté' };
                    }
                    
                    resolve(result);
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        });
    }

    async processAgentsImport(data) {
        let importes = 0;
        let ignores = 0;
        let erreurs = [];

        for (const row of data) {
            try {
                const code = row['Code'] || row['CODE'] || row['code'];
                const nom = row['Nom'] || row['NOM'] || row['nom'];
                const prenom = row['Prénom'] || row['PRENOM'] || row['prenom'];
                const groupe = row['Groupe'] || row['GROUPE'] || row['groupe'];

                if (!code || !nom || !groupe) {
                    ignores++;
                    continue;
                }

                const agent = {
                    code: code.toString().toUpperCase().trim(),
                    nom: nom.toString().trim(),
                    prenom: (prenom || '').toString().trim(),
                    groupe: groupe.toString().toUpperCase().trim(),
                    dateEntree: '2025-11-01',
                    statut: 'actif'
                };

                await this.db.agents.put(agent);
                importes++;

            } catch (error) {
                erreurs.push(`Ligne ${importes + ignores + 1}: ${error.message}`);
                ignores++;
            }
        }

        return {
            success: true,
            total: data.length,
            importes,
            ignores,
            erreurs
        };
    }

    async exportToExcel(type) {
        let data;
        let filename;

        switch(type) {
            case 'agents':
                data = await this.getAgents();
                filename = `agents_${new Date().toISOString().split('T')[0]}.xlsx`;
                break;
            case 'planning':
                const now = new Date();
                data = await this.getPlanning(now.getMonth() + 1, now.getFullYear());
                filename = `planning_${now.getFullYear()}_${now.getMonth() + 1}.xlsx`;
                break;
            default:
                throw new Error('Type d\'export non supporté');
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        
        XLSX.writeFile(workbook, filename);
        return { success: true, filename };
    }

    // Synchronisation
    async syncWithServer(serverUrl) {
        if (!navigator.onLine) {
            return { success: false, error: 'Pas de connexion internet' };
        }

        try {
            // Récupérer les données locales modifiées
            const pendingChanges = await this.getPendingChanges();
            
            // Envoyer au serveur
            const response = await fetch(`${serverUrl}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingChanges)
            });

            if (response.ok) {
                const serverData = await response.json();
                await this.applyServerData(serverData);
                return { success: true, message: 'Synchronisation réussie' };
            } else {
                return { success: false, error: 'Erreur serveur' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getPendingChanges() {
        // Récupérer les données modifiées localement
        // (implémentez selon vos besoins)
        return {
            agents: await this.db.agents.toArray(),
            planning: await this.db.shifts.toArray()
        };
    }

    async applyServerData(serverData) {
        // Appliquer les données du serveur
        if (serverData.agents) {
            await this.db.agents.clear();
            await this.db.agents.bulkPut(serverData.agents);
        }
        
        if (serverData.planning) {
            await this.db.shifts.clear();
            await this.db.shifts.bulkPut(serverData.planning);
        }
    }

    // Statistiques
    async getStats(mois, annee) {
        const agents = await this.getAgents();
        const planning = await this.getPlanning(mois, annee);
        
        const stats = {
            totalAgents: agents.length,
            shifts: { '1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0 },
            groupes: {}
        };

        for (const agent of agents) {
            const groupe = agent.groupe;
            if (!stats.groupes[groupe]) {
                stats.groupes[groupe] = 0;
            }
            stats.groupes[groupe]++;
        }

        for (const agentPlanning of planning) {
            for (const shift of agentPlanning.shifts) {
                if (stats.shifts[shift.shift] !== undefined) {
                    stats.shifts[shift.shift]++;
                }
            }
        }

        return stats;
    }

    // Backup/Restore
    async backup() {
        const backup = {
            agents: await this.db.agents.toArray(),
            planning: await this.db.shifts.toArray(),
            radios: await this.db.radios.toArray(),
            date: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_planning_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        return { success: true, filename: a.download };
    }

    async restore(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    await this.db.agents.clear();
                    await this.db.shifts.clear();
                    await this.db.radios.clear();
                    
                    if (backup.agents) await this.db.agents.bulkPut(backup.agents);
                    if (backup.planning) await this.db.shifts.bulkPut(backup.planning);
                    if (backup.radios) await this.db.radios.bulkPut(backup.radios);
                    
                    resolve({ success: true, message: 'Restauration réussie' });
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }
}

// Export global
window.PlanningDB = new PlanningDatabase();