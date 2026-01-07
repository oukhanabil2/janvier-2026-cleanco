class ExcelImportManager {
    constructor() {
        this.db = window.PlanningDB;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // Bouton parcourir
        document.getElementById('browse-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        // Sélection fichier
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Télécharger template
        document.getElementById('download-template').addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadTemplate();
        });

        // Fermer résultats
        document.getElementById('close-results').addEventListener('click', () => {
            this.hideResults();
        });
    }

    setupDragAndDrop() {
        const dropArea = document.getElementById('drop-area');
        
        // Empêcher les comportements par défaut
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('dragover');
            }, false);
        });

        // Gérer le drop
        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFileSelect(files[0]);
        }, false);
    }

    handleFileSelect(file) {
        if (!file) return;

        // Vérifier l'extension
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validExtensions.includes(fileExt)) {
            this.showNotification('Format non supporté. Utilisez .xlsx, .xls ou .csv', 'error');
            return;
        }

        // Afficher le nom du fichier
        this.updateDropArea(`📁 ${file.name} (${this.formatFileSize(file.size)})`);

        // Démarrer l'import
        this.startImport(file);
    }

    async startImport(file) {
        const importType = document.querySelector('input[name="import-type"]:checked').value;
        
        // Afficher la progression
        this.showProgress(true);
        this.updateProgress(0, 'Lecture du fichier...');

        try {
            // Lire le fichier
            this.updateProgress(20, 'Traitement des données...');
            const result = await this.db.importFromExcel(file, importType);
            
            this.updateProgress(80, 'Sauvegarde dans la base...');
            
            // Attendre un peu pour l'animation
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.updateProgress(100, 'Import terminé !');
            
            // Afficher les résultats
            this.showResults(result, importType);
            
            // Notification
            this.showNotification(`Import réussi: ${result.importes} enregistrements`, 'success');
            
            // Actualiser l'interface si nécessaire
            if (window.app && typeof window.app.refreshData === 'function') {
                window.app.refreshData();
            }

        } catch (error) {
            this.updateProgress(0, 'Erreur lors de l\'import');
            this.showNotification(`Erreur: ${error.message}`, 'error');
        } finally {
            this.showProgress(false);
        }
    }

    showProgress(show) {
        const progress = document.getElementById('import-progress');
        const dropArea = document.getElementById('drop-area');
        
        if (show) {
            progress.classList.remove('hidden');
            dropArea.style.opacity = '0.5';
        } else {
            progress.classList.add('hidden');
            dropArea.style.opacity = '1';
            this.updateDropArea('Glissez-déposez votre fichier Excel ici');
        }
    }

    updateProgress(percent, message) {
        const fill = document.getElementById('progress-fill');
        const percentText = document.getElementById('progress-percent');
        const messageText = document.getElementById('progress-message');
        
        fill.style.width = `${percent}%`;
        percentText.textContent = `${Math.round(percent)}%`;
        messageText.textContent = message;
    }

    showResults(result, type) {
        const resultsDiv = document.getElementById('results-content');
        const resultsContainer = document.getElementById('import-results');
        
        let html = `
            <div class="result-summary">
                <h4>Résumé de l'importation (${type})</h4>
                <div class="result-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total lignes:</span>
                        <span class="stat-value">${result.total}</span>
                    </div>
                    <div class="stat-item success">
                        <span class="stat-label">Importés:</span>
                        <span class="stat-value">${result.importes}</span>
                    </div>
                    <div class="stat-item warning">
                        <span class="stat-label">Ignorés:</span>
                        <span class="stat-value">${result.ignores}</span>
                    </div>
                </div>
        `;

        if (result.erreurs && result.erreurs.length > 0) {
            html += `
                <div class="errors-section">
                    <h5>Erreurs rencontrées:</h5>
                    <ul class="error-list">
                        ${result.erreurs.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += `</div>`;
        
        resultsDiv.innerHTML = html;
        resultsContainer.classList.remove('hidden');
    }

    hideResults() {
        document.getElementById('import-results').classList.add('hidden');
    }

    downloadTemplate() {
        // Créer un template Excel vide
        const templateData = [
            ['CODE', 'NOM', 'PRENOM', 'GROUPE', 'DATE_ENTREE'],
            ['A01', 'DUPONT', 'Alice', 'A', '2025-11-01'],
            ['B02', 'MARTIN', 'Bob', 'B', '2025-11-01'],
            ['C03', 'LEFEVRE', 'Carole', 'C', '2025-11-01'],
            ['', '', '', '', ''],
            ['Note: CODE doit être unique', '', '', '', ''],
            ['GROUPE: A, B, C, D ou E', '', '', '', '']
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');

        XLSX.writeFile(wb, 'template_agents.xlsx');
        
        this.showNotification('Template téléchargé avec succès', 'success');
    }

    updateDropArea(text) {
        const dropArea = document.getElementById('drop-area');
        const p = dropArea.querySelector('p');
        if (p) {
            p.textContent = text;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        const notificationCenter = document.getElementById('notification-center');
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</strong>
                <span>${message}</span>
            </div>
        `;
        
        notificationCenter.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Démarrer quand la page est prête
document.addEventListener('DOMContentLoaded', () => {
    window.ExcelImport = new ExcelImportManager();
});