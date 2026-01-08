// =========================================================================
// CALCUL PLANNING - VERSION DÉVELOPPEMENT
// =========================================================================

class PlanningCalculator {
    constructor() {
        this.dateAffectationBase = "2025-11-01";
        this.joursFrancais = {
            0: 'Lun', 1: 'Mar', 2: 'Mer', 3: 'Jeu',
            4: 'Ven', 5: 'Sam', 6: 'Dim'
        };
        this.init();
    }

    init() {
        console.log('📅 Planning Calculator initialisé');
        this.log('Prêt pour les calculs de planning');
    }

    // Cycle standard 8 jours (1,1,2,2,3,3,R,R)
    cycleStandard8Jours(jourCycle) {
        const cycle = ['1', '1', '2', '2', '3', '3', 'R', 'R'];
        return cycle[jourCycle % 8];
    }

    // Décalage standard pour groupes A-D
    getDecalageStandard(codeGroupe) {
        const decalages = {
            'A': 0,
            'B': 2,
            'C': 4,
            'D': 6
        };
        return decalages[codeGroupe.toUpperCase()] || 0;
    }

    // Cycle groupe E (5/7 avec shifts 1 et 2 seulement)
    cycleGroupeE(dateObj, indexAgent, totalAgentsE) {
        const jourSemaine = dateObj.getDay();
        
        // Weekend = repos
        if (jourSemaine === 0 || jourSemaine === 6) {
            return 'R';
        }
        
        const semaine = this.getWeekNumber(dateObj);
        const jourPair = (jourSemaine % 2 === 1); // Lundi=0 (pair), Mardi=1 (impair), etc.
        
        // Agent 1 (index 0) : S1 dominant semaines impaires
        if (indexAgent === 0) {
            if (semaine % 2 !== 0) { // Semaine impaire
                return jourPair ? '2' : '1';
            } else { // Semaine paire
                return jourPair ? '1' : '2';
            }
        }
        
        // Agent 2 (index 1) : S2 dominant semaines impaires
        if (indexAgent === 1) {
            if (semaine % 2 !== 0) {
                return jourPair ? '1' : '2';
            } else {
                return jourPair ? '2' : '1';
            }
        }
        
        // Autres agents du groupe E
        return (indexAgent + semaine) % 2 === 0 ? '1' : '2';
    }

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    // Calcul du shift théorique
    calculerShiftTheorique(codeAgent, groupe, dateObj, indexAgent = 0, totalAgentsE = 2) {
        // Convertir la date d'affectation
        const dateAffectation = new Date(this.dateAffectationBase);
        
        // Calculer différence en jours
        const diffTemps = dateObj - dateAffectation;
        const diffJours = Math.floor(diffTemps / (1000 * 60 * 60 * 24));
        
        if (groupe === 'E') {
            return this.cycleGroupeE(dateObj, indexAgent, totalAgentsE);
        }
        
        if (['A', 'B', 'C', 'D'].includes(groupe)) {
            const decalage = this.getDecalageStandard(groupe);
            const jourCycleDecale = diffJours + decalage;
            return this.cycleStandard8Jours(jourCycleDecale);
        }
        
        return 'R'; // Par défaut
    }

    // Générer planning pour un mois
    genererPlanningMois(mois, annee, agents) {
        const joursMois = new Date(annee, mois, 0).getDate();
        const planning = {};
        
        // Organiser agents par groupe
        const agentsParGroupe = {
            'A': agents.filter(a => a.groupe === 'A'),
            'B': agents.filter(a => a.groupe === 'B'),
            'C': agents.filter(a => a.groupe === 'C'),
            'D': agents.filter(a => a.groupe === 'D'),
            'E': agents.filter(a => a.groupe === 'E')
        };
        
        // Pour chaque jour du mois
        for (let jour = 1; jour <= joursMois; jour++) {
            const dateObj = new Date(annee, mois - 1, jour);
            const dateStr = dateObj.toISOString().split('T')[0];
            
            planning[dateStr] = {};
            
            // Pour chaque groupe
            Object.keys(agentsParGroupe).forEach(groupe => {
                const agentsDuGroupe = agentsParGroupe[groupe];
                
                agentsDuGroupe.forEach((agent, index) => {
                    const shift = this.calculerShiftTheorique(
                        agent.code,
                        groupe,
                        dateObj,
                        index,
                        agentsDuGroupe.length
                    );
                    
                    planning[dateStr][agent.code] = {
                        shift: shift,
                        jourSemaine: this.joursFrancais[dateObj.getDay()],
                        jourNumero: jour
                    };
                });
            });
        }
        
        return planning;
    }

    // Afficher planning dans l'interface
    afficherPlanning(planning, mois, annee) {
        // Récupérer les shifts pour chaque groupe
        const groupes = ['A', 'B', 'C', 'D', 'E'];
        
        groupes.forEach(groupe => {
            const container = document.getElementById(`groupe-${groupe.toLowerCase()}-shifts`);
            if (!container) return;
            
            // Prendre les 7 premiers jours pour l'affichage
            let html = '';
            const joursAfficher = 7;
            
            for (let jour = 1; jour <= joursAfficher; jour++) {
                const dateObj = new Date(annee, mois - 1, jour);
                const dateStr = dateObj.toISOString().split('T')[0];
                
                // Trouver un shift pour ce groupe
                let shift = 'R';
                if (planning[dateStr]) {
                    const agentShift = Object.values(planning[dateStr]).find(s => true);
                    if (agentShift) {
                        shift = agentShift.shift;
                    }
                }
                
                html += `<div class="shift-cell shift-${shift}">${shift}</div>`;
            }
            
            container.innerHTML = html;
        });
        
        this.log(`📅 Planning ${mois}/${annee} généré`);
    }

    log(message) {
        const logContainer = document.getElementById('planning-log');
        if (logContainer) {
            const entry = document.createElement('div');
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        console.log(message);
    }

    testCalculPlanning() {
        this.log('🧪 Début tests calcul planning...');
        
        // Agents de test
        const agentsTest = [
            { code: 'A01', groupe: 'A', nom: 'TestA', prenom: 'Agent' },
            { code: 'B01', groupe: 'B', nom: 'TestB', prenom: 'Agent' },
            { code: 'E01', groupe: 'E', nom: 'TestE', prenom: 'Agent' }
        ];
        
        try {
            // Test calcul simple
            const dateTest = new Date();
            const shiftA = this.calculerShiftTheorique('A01', 'A', dateTest);
            const shiftB = this.calculerShiftTheorique('B01', 'B', dateTest);
            const shiftE = this.calculerShiftTheorique('E01', 'E', dateTest, 0, 1);
            
            this.log(`✅ Shift Groupe A: ${shiftA}`);
            this.log(`✅ Shift Groupe B: ${shiftB}`);
            this.log(`✅ Shift Groupe E: ${shiftE}`);
            
            // Test génération mois
            const planning = this.genererPlanningMois(
                dateTest.getMonth() + 1,
                dateTest.getFullYear(),
                agentsTest
            );
            
            const joursAvecPlanning = Object.keys(planning).length;
            this.log(`✅ Planning généré: ${joursAvecPlanning} jours`);
            
            this.log('🧪 Tests calcul planning terminés');
            return { success: true, planning: planning };
            
        } catch (error) {
            this.log(`❌ Erreur tests: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Instance globale
const planningCalculator = new PlanningCalculator();

// Fonction globale pour HTML
async function calculatePlanning() {
    const mois = parseInt(document.getElementById('planning-month').value);
    const annee = parseInt(document.getElementById('planning-year').value);
    
    // Utiliser les agents du CRUD ou des données de test
    const agents = agentsCRUD.getAllAgents();
    
    if (agents.length === 0) {
        planningCalculator.log('⚠️ Ajoutez d\'abord des agents');
        return;
    }
    
    planningCalculator.log(`🧮 Calcul du planning ${mois}/${annee}...`);
    
    const planning = planningCalculator.genererPlanningMois(mois, annee, agents);
    planningCalculator.afficherPlanning(planning, mois, annee);
    
    planningCalculator.log('✅ Calcul terminé');
}
