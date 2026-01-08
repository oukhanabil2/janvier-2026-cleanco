// =========================================================================
// APP PRINCIPALE - NAVIGATION ET TESTS
// =========================================================================

class PlanningApp {
    constructor() {
        this.currentSection = 'agents';
        this.init();
    }

    init() {
        console.log('🚀 Planning App DEV initialisée');
        this.setupNavigation();
        this.showWelcome();
    }

    setupNavigation() {
        // Navigation entre sections
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });

        // Initialiser la première section
        this.showSection('agents');
    }

    showSection(sectionName) {
        // Mettre à jour les boutons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionName) {
                btn.classList.add('active');
            }
        });

        // Afficher la section correspondante
        document.querySelectorAll('.dev-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        this.currentSection = sectionName;
        console.log(`📱 Section active: ${sectionName}`);
    }

    showWelcome() {
        console.log(`
        ========================================
        📱 PLANNING PWA - MODE DÉVELOPPEMENT
        ========================================
        Fonctions en développement:
        1. 👥 CRUD Agents (En cours)
        2. 💾 IndexedDB (En cours)  
        3. 📅 Calcul Planning (En cours)
        
        Votre app est sur GitHub !
        ========================================
        `);
    }

    async runAllTests() {
        const consoleOutput = document.getElementById('test-console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML = '> Démarrage des tests...\n';
        }

        // Mettre à jour les statuts
        this.updateTestStatus('crud', '⏳');
        this.updateTestStatus('db', '⏳');
        this.updateTestStatus('planning', '⏳');

        let results = {
            crud: false,
            db: false,
            planning: false
        };

        // Test CRUD
        try {
            this.logTest('🧪 Test CRUD Agents...');
            const crudResult = agentsCRUD.testCRUD();
            results.crud = crudResult.success;
            this.updateTestStatus('crud', crudResult.success ? '✅' : '❌');
        } catch (error) {
            this.logTest(`❌ Erreur CRUD: ${error.message}`);
            this.updateTestStatus('crud', '❌');
        }

        // Test IndexedDB
        try {
            this.logTest('🧪 Test IndexedDB...');
            const dbResult = await dbManager.testDatabase();
            results.db = dbResult.success;
            this.updateTestStatus('db', dbResult.success ? '✅' : '❌');
        } catch (error) {
            this.logTest(`❌ Erreur IndexedDB: ${error.message}`);
            this.updateTestStatus('db', '❌');
        }

        // Test Planning
        try {
            this.logTest('🧪 Test Calcul Planning...');
            const planningResult = planningCalculator.testCalculPlanning();
            results.planning = planningResult.success;
            this.updateTestStatus('planning', planningResult.success ? '✅' : '❌');
        } catch (error) {
            this.logTest(`❌ Erreur Planning: ${error.message}`);
            this.updateTestStatus('planning', '❌');
        }

        // Résumé
        const successCount = Object.values(results).filter(r => r).length;
        const totalTests = Object.keys(results).length;

        this.logTest(`\n📊 RÉSULTATS: ${successCount}/${totalTests} tests réussis`);
        
        if (successCount === totalTests) {
            this.logTest('🎉 Tous les tests sont réussis !');
        } else {
            this.logTest('⚠️ Certains tests ont échoué');
        }
    }

    updateTestStatus(testName, status) {
        const testElement = document.getElementById(`test-${testName}`);
        if (testElement) {
            const statusElement = testElement.querySelector('.test-status');
            if (statusElement) {
                statusElement.textContent = status;
                statusElement.className = `test-status ${status}`;
            }
        }
    }

    logTest(message) {
        const consoleOutput = document.getElementById('test-console-output');
        if (consoleOutput) {
            consoleOutput.innerHTML += `> ${message}\n`;
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
        console.log(message);
    }
}

// Initialiser l'application
const app = new PlanningApp();

// Fonctions globales
function runAllTests() {
    app.runAllTests();
}

// Navigation rapide via console
window.showSection = function(section) {
    app.showSection(section);
};

// Message de bienvenue
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c📱 PLANNING PWA - DÉVELOPPEMENT ACTIF', 
        'color: #3498db; font-size: 16px; font-weight: bold;');
    console.log('%cVotre code est en ligne sur GitHub !', 
        'color: #2ecc71; font-size: 14px;');
});
