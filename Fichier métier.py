# gestion_agents.py - VERSION COMPLÈTE AVEC RETOUR DE DONNÉES
import sqlite3
import pandas as pd 
import csv
from datetime import date, timedelta
from calendar import monthrange
import os
from tabulate import tabulate 

# Constantes pour la traduction et la logique
JOURS_FRANCAIS = {
    'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu',
    'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'
}

# Date d'affectation fixe demandée par l'utilisateur
DATE_AFFECTATION_BASE = "2025-11-01"

class GestionAgents:
    def __init__(self, db_name="planning.db"):
        self.db_name = db_name
        self.conn = sqlite3.connect(db_name)
        self.cursor = self.conn.cursor()
        self._initialiser_db()

    def _initialiser_db(self):
        """Initialise la base de données avec les tables nécessaires (complètes)."""
        # Tables principales
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                code TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                code_groupe TEXT NOT NULL,
                date_entree TEXT,
                date_sortie TEXT,
                statut TEXT DEFAULT 'actif'
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS planning (
                code_agent TEXT,
                date TEXT,
                shift TEXT,
                origine TEXT,
                PRIMARY KEY (code_agent, date)
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS jours_feries (
                date TEXT PRIMARY KEY,
                description TEXT
            )
        """)
        # Tables annexes 
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS codes_panique (
                code_agent TEXT PRIMARY KEY,
                code_panique TEXT NOT NULL,
                poste_nom TEXT NOT NULL,
                FOREIGN KEY (code_agent) REFERENCES agents(code)
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS radios (
                id_radio TEXT PRIMARY KEY,
                modele TEXT NOT NULL,
                statut TEXT NOT NULL
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS historique_radio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_radio TEXT,
                code_agent TEXT,
                date_attribution TEXT NOT NULL,
                date_retour TEXT,
                FOREIGN KEY (id_radio) REFERENCES radios(id_radio),
                FOREIGN KEY (code_agent) REFERENCES agents(code)
            )
        """)
        # Habillement
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS habillement (
                code_agent TEXT PRIMARY KEY,
                chemise_taille TEXT,
                chemise_date TEXT,
                jacket_taille TEXT,
                jacket_date TEXT,
                pantalon_taille TEXT,
                pantalon_date TEXT,
                cravate_oui TEXT,
                cravate_date TEXT,
                FOREIGN KEY (code_agent) REFERENCES agents(code)
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS avertissements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_agent TEXT,
                date_avertissement TEXT NOT NULL,
                type_avertissement TEXT NOT NULL,
                description TEXT,
                FOREIGN KEY (code_agent) REFERENCES agents(code)
            )
        """)
        # Table pour les congés par période
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS conges_periode (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_agent TEXT,
                date_debut TEXT NOT NULL,
                date_fin TEXT NOT NULL,
                date_creation TEXT NOT NULL,
                FOREIGN KEY (code_agent) REFERENCES agents(code)
            )
        """)

        self.conn.commit()

    def fermer_connexion(self):
        """Ferme la connexion à la base de données."""
        self.conn.close()

    # =========================================================================
    # IMPORTATION EXCEL CLEANCO - MÉTHODE CORRIGÉE
    # =========================================================================

    def importer_agents_excel(self, nom_fichier):
        """Importe les agents directement depuis un fichier Excel CleanCo - VERSION CORRIGÉE"""
        try:
            if not os.path.exists(nom_fichier):
                return {'erreur': f"Le fichier '{nom_fichier}' est introuvable.", 'conseil': "Vérifiez le nom du fichier et son emplacement."}
            
            resultats = {'importes': 0, 'ignores': 0, 'erreurs': []}
            
            # Lecture du fichier Excel avec gestion d'erreurs améliorée
            try:
                df = pd.read_excel(nom_fichier)
            except Exception as e:
                return {'erreur': f"ERREUR LECTURE EXCEL: {e}"}
            
            # Parcourir chaque ligne du fichier Excel
            for index, ligne in df.iterrows():
                try:
                    # Gestion robuste des valeurs NaN et conversion
                    code = str(ligne.iloc[0]).strip().upper() if pd.notna(ligne.iloc[0]) and ligne.iloc[0] != '' else ""
                    nom = str(ligne.iloc[1]).strip() if pd.notna(ligne.iloc[1]) and ligne.iloc[1] != '' else ""
                    prenom = str(ligne.iloc[2]).strip() if pd.notna(ligne.iloc[2]) and ligne.iloc[2] != '' else ""
                    groupe = str(ligne.iloc[3]).strip().upper() if pd.notna(ligne.iloc[3]) and ligne.iloc[3] != '' else ""
                    
                    # Vérifier que les champs obligatoires sont remplis
                    if not code or code == 'NAN' or code == 'NONE':
                        resultats['erreurs'].append(f"Ligne {index+1}: Code agent manquant ou invalide")
                        resultats['ignores'] += 1
                        continue
                    
                    if not nom:
                        resultats['erreurs'].append(f"Ligne {index+1}: Nom manquant")
                        resultats['ignores'] += 1
                        continue
                        
                    if not prenom:
                        resultats['erreurs'].append(f"Ligne {index+1}: Prénom manquant")
                        resultats['ignores'] += 1
                        continue
                        
                    if not groupe or groupe not in ['A', 'B', 'C', 'D', 'E']:
                        resultats['erreurs'].append(f"Ligne {index+1}: Groupe invalide '{groupe}' (doit être A, B, C, D ou E)")
                        resultats['ignores'] += 1
                        continue
                    
                    # Vérifier si l'agent existe déjà
                    self.cursor.execute("SELECT code FROM agents WHERE code=?", (code,))
                    existe = self.cursor.fetchone()
                    
                    if existe:
                        # Mettre à jour l'agent existant
                        self.cursor.execute('''
                            UPDATE agents 
                            SET nom = ?, prenom = ?, code_groupe = ?, date_sortie = NULL
                            WHERE code = ?
                        ''', (nom, prenom, groupe, code))
                    else:
                        # Ajouter un nouvel agent
                        self.cursor.execute('''
                            INSERT INTO agents (code, nom, prenom, code_groupe, date_entree, date_sortie)
                            VALUES (?, ?, ?, ?, ?, NULL)
                        ''', (code, nom, prenom, groupe, DATE_AFFECTATION_BASE))
                    
                    resultats['importes'] += 1
                    
                except Exception as e:
                    resultats['erreurs'].append(f"Ligne {index+1}: {str(e)}")
                    resultats['ignores'] += 1
                    continue
            
            # Sauvegarder les changements
            self.conn.commit()
            
            return resultats
            
        except PermissionError:
            return {'erreur': f"Permission refusée pour le fichier '{nom_fichier}'!", 'conseil': "Fermez le fichier Excel s'il est ouvert dans un autre programme."}
        except Exception as e:
            return {'erreur': f"ERREUR CRITIQUE lors de l'import Excel: {e}"}

    # =========================================================================
    # LOGIQUE DES CYCLES ET SHIFTS
    # =========================================================================

    def _cycle_standard_8j(self, jour_cycle):
        """Définit la rotation continue de 8 jours (1, 1, 2, 2, 3, 3, R, R)."""
        cycle = ['1', '1', '2', '2', '3', '3', 'R', 'R']
        return cycle[jour_cycle % 8]

    def _get_decalage_standard(self, code_groupe):
        """Définit le décalage en jours pour les groupes A/B/C/D."""
        if code_groupe.upper() == 'A':
            return 0
        elif code_groupe.upper() == 'B':
            return 2
        elif code_groupe.upper() == 'C':
            return 4
        elif code_groupe.upper() == 'D':
            return 6
        return 0

    def _cycle_c_diff(self, jour_date: date, code_agent):
        """Définit le cycle E (5/7) avec seulement les shifts 1 et 2."""
        jour_semaine = jour_date.weekday()
        
        # Weekend = repos
        if jour_semaine >= 5: 
            return 'R'
            
        self.cursor.execute("SELECT code FROM agents WHERE code_groupe='E' AND date_sortie IS NULL ORDER BY code")
        agents_du_groupe = [a[0] for a in self.cursor.fetchall()]
        
        try:
            index_agent = agents_du_groupe.index(code_agent)
        except ValueError:
            return 'R'

        num_semaine = jour_date.isocalendar()[1]
        jour_pair = (jour_semaine % 2 == 0)
        
        # Agent 1 (index 0) : S1 dominant les semaines impaires
        if index_agent == 0:
            if num_semaine % 2 != 0: 
                return '1' if jour_pair else '2' 
            else: 
                return '2' if jour_pair else '1'
        
        # Agent 2 (index 1) : S2 dominant les semaines impaires
        if index_agent == 1:
            if num_semaine % 2 != 0: 
                return '2' if jour_pair else '1'
            else: 
                return '1' if jour_pair else '2'

        # Pour les autres agents du groupe E, alternance similaire
        return '1' if (index_agent + num_semaine) % 2 == 0 else '2'
    
    def _get_shift_theorique_rotation(self, code_agent, jour_date: date):
        """Calcule le shift de rotation (1, 2, 3, R)."""
        self.cursor.execute("SELECT code_groupe, date_entree, date_sortie FROM agents WHERE code=?", (code_agent,))
        agent_info = self.cursor.fetchone()

        if not agent_info:
            return '-'

        code_groupe, date_entree_str, date_sortie_str = agent_info
        
        if date_sortie_str and jour_date >= date.fromisoformat(date_sortie_str):
             return '-' 
        
        date_entree = date.fromisoformat(date_entree_str)
        if jour_date < date_entree:
             return '-' 
        
        delta_jours = (jour_date - date_entree).days
        jour_cycle_base = delta_jours

        if code_groupe == 'E':
            return self._cycle_c_diff(jour_date, code_agent)
        
        elif code_groupe in ['A', 'B', 'C', 'D']:
            decalage = self._get_decalage_standard(code_groupe)
            jour_cycle_decale = jour_cycle_base + decalage
            return self._cycle_standard_8j(jour_cycle_decale)
        
        else:
            return 'R' 

    # =========================================================================
    # GESTION DES CONGÉS PAR PÉRIODE
    # =========================================================================

    def ajouter_conge_periode(self, code_agent, date_debut, date_fin):
        """Ajoute un congé sur une période donnée, les dimanches restent en repos."""
        code_agent = code_agent.upper()
        
        # Vérifier que l'agent existe
        self.cursor.execute("SELECT code FROM agents WHERE code=? AND date_sortie IS NULL", (code_agent,))
        if not self.cursor.fetchone():
            return {'erreur': f"Agent {code_agent} non trouvé ou inactif."}

        try:
            date_debut_obj = date.fromisoformat(date_debut)
            date_fin_obj = date.fromisoformat(date_fin)
            
            if date_debut_obj > date_fin_obj:
                return {'erreur': "La date de début doit être avant la date de fin."}

            # Enregistrer la période de congé
            date_creation = date.today().isoformat()
            self.cursor.execute(
                "INSERT INTO conges_periode (code_agent, date_debut, date_fin, date_creation) VALUES (?, ?, ?, ?)",
                (code_agent, date_debut, date_fin, date_creation)
            )

            # Appliquer les congés jour par jour
            current_date = date_debut_obj
            jours_conges = 0
            
            while current_date <= date_fin_obj:
                jour_date_str = current_date.isoformat()
                
                # Vérifier si c'est un dimanche (weekday() = 6)
                if current_date.weekday() == 6:
                    # Dimanche = repos forcé
                    self.cursor.execute(
                        "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'CONGE_DIMANCHE')",
                        (code_agent, jour_date_str, 'R')
                    )
                else:
                    # Jour de semaine = congé
                    self.cursor.execute(
                        "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'CONGE_PERIODE')",
                        (code_agent, jour_date_str, 'C')
                    )
                    jours_conges += 1
                
                current_date += timedelta(days=1)

            self.conn.commit()
            return {
                'succes': True,
                'message': f"Congé enregistré pour {code_agent} du {date_debut} au {date_fin}",
                'jours_conges': jours_conges,
                'duree': (date_fin_obj - date_debut_obj).days + 1
            }

        except Exception as e:
            return {'erreur': f"Erreur lors de l'ajout du congé: {e}"}

    def supprimer_conge_periode(self, code_agent, date_debut, date_fin):
        """Supprime un congé sur une période donnée et rétablit le planning théorique."""
        code_agent = code_agent.upper()
        
        try:
            date_debut_obj = date.fromisoformat(date_debut)
            date_fin_obj = date.fromisoformat(date_fin)
            
            # Supprimer la période de congé enregistrée
            self.cursor.execute(
                "DELETE FROM conges_periode WHERE code_agent=? AND date_debut=? AND date_fin=?",
                (code_agent, date_debut, date_fin)
            )
            
            # Supprimer les shifts de congé dans la période
            current_date = date_debut_obj
            jours_supprimes = 0
            
            while current_date <= date_fin_obj:
                jour_date_str = current_date.isoformat()
                
                # Supprimer les enregistrements de congé
                self.cursor.execute(
                    "DELETE FROM planning WHERE code_agent=? AND date=? AND origine IN ('CONGE_PERIODE', 'CONGE_DIMANCHE')",
                    (code_agent, jour_date_str)
                )
                
                # Supprimer aussi le shift théorique pour forcer le recalcul
                self.cursor.execute(
                    "DELETE FROM planning WHERE code_agent=? AND date=? AND origine='THEORIQUE'",
                    (code_agent, jour_date_str)
                )
                
                jours_supprimes += 1
                current_date += timedelta(days=1)

            self.conn.commit()
            return {
                'succes': True,
                'message': f"Congé supprimé pour {code_agent} du {date_debut} au {date_fin}",
                'jours_supprimes': jours_supprimes
            }

        except Exception as e:
            return {'erreur': f"Erreur lors de la suppression du congé: {e}"}

    def lister_conges_agent(self, code_agent):
        """Liste tous les congés enregistrés pour un agent."""
        code_agent = code_agent.upper()
        
        self.cursor.execute(
            "SELECT date_debut, date_fin, date_creation FROM conges_periode WHERE code_agent=? ORDER BY date_debut",
            (code_agent,)
        )
        conges = self.cursor.fetchall()
        
        if not conges:
            return {'message': f"Aucun congé enregistré pour l'agent {code_agent}."}

        liste_conges = []
        for date_debut, date_fin, date_creation in conges:
            debut_obj = date.fromisoformat(date_debut)
            fin_obj = date.fromisoformat(date_fin)
            duree = (fin_obj - debut_obj).days + 1
            liste_conges.append({
                'debut': date_debut,
                'fin': date_fin,
                'duree': duree,
                'creation': date_creation
            })
        
        return {'conges': liste_conges}

    # =========================================================================
    # GESTION DES AGENTS (AVEC DATE FIXE)
    # =========================================================================

    def ajouter_agent(self, code, nom, prenom, code_groupe):
        """Ajoute un nouvel agent à la base de données avec une date d'entrée fixe."""
        code = code.upper()
        code_groupe = code_groupe.upper()
        
        date_entree = DATE_AFFECTATION_BASE 
        
        if code_groupe not in ['A', 'B', 'C', 'D', 'E']:
             return {'erreur': "Code de groupe invalide. Utilisez A, B, C, D ou E."}
             
        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO agents (code, nom, prenom, code_groupe, date_entree, date_sortie) VALUES (?, ?, ?, ?, ?, NULL)",
                (code, nom, prenom, code_groupe, date_entree)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Agent {code} ajouté/mis à jour (Date d'entrée: {date_entree})."
            }
        except sqlite3.IntegrityError as e:
            return {'erreur': f"Erreur d'intégrité: {e}"}
        except Exception as e:
            return {'erreur': f"Erreur lors de l'ajout de l'agent {code}: {e}"}

    def modifier_agent(self, code_agent, nom, prenom, code_groupe, date_entree):
        """Modifie les informations d'un agent existant."""
        code_agent = code_agent.upper()
        
        self.cursor.execute("SELECT nom, prenom, code_groupe, date_entree FROM agents WHERE code=?", (code_agent,))
        agent_info = self.cursor.fetchone()
        
        if not agent_info:
            return {'erreur': f"Agent {code_agent} non trouvé."}

        nom_new = nom if nom else agent_info[0]
        prenom_new = prenom if prenom else agent_info[1]
        code_groupe_new = code_groupe.upper() if code_groupe else agent_info[2]
        date_entree_new = date_entree if date_entree else agent_info[3]
        
        if code_groupe_new not in ['A', 'B', 'C', 'D', 'E']:
            return {'erreur': "Nouveau code de groupe invalide. Modification annulée."}
            
        try:
            self.cursor.execute(
                """UPDATE agents SET nom=?, prenom=?, code_groupe=?, date_entree=? 
                   WHERE code=?""",
                (nom_new, prenom_new, code_groupe_new, date_entree_new, code_agent)
            )
            self.conn.commit()
            
            if code_groupe_new != agent_info[2] or date_entree_new != agent_info[3]:
                 self.cursor.execute("DELETE FROM planning WHERE code_agent=? AND origine='THEORIQUE'", (code_agent,))
                 self.conn.commit()
                 return {
                     'succes': True,
                     'message': f"Agent {code_agent} modifié avec succès. Planning théorique effacé pour forcer la regénération."
                 }
            else:
                return {
                    'succes': True,
                    'message': f"Agent {code_agent} modifié avec succès."
                }
                 
        except Exception as e:
            return {'erreur': f"Erreur lors de la modification de l'agent: {e}"}

    def supprimer_agent(self, code_agent):
        """Marque un agent comme sorti (date_sortie)."""
        code_agent = code_agent.upper()
        try:
            date_sortie = date.today().isoformat()
            self.cursor.execute(
                "UPDATE agents SET date_sortie = ? WHERE code = ? AND date_sortie IS NULL",
                (date_sortie, code_agent)
            )
            
            if self.cursor.rowcount > 0:
                date_debut_suppression = (date.today() + timedelta(days=1)).isoformat()
                self.cursor.execute(
                    "DELETE FROM planning WHERE code_agent = ? AND date >= ?",
                    (code_agent, date_debut_suppression)
                )
                self.conn.commit()
                return {
                    'succes': True,
                    'message': f"Agent {code_agent} marqué comme sorti à la date {date_sortie} et son planning futur a été effacé."
                }
            else:
                return {'message': f"Agent {code_agent} non trouvé ou déjà marqué comme inactif."}
        except Exception as e:
            return {'erreur': f"Erreur lors de la suppression de l'agent: {e}"}

    def lister_agents(self):
        """Liste tous les agents actifs."""
        self.cursor.execute("SELECT code, nom, prenom, code_groupe FROM agents WHERE date_sortie IS NULL ORDER BY code_groupe, code")
        agents = self.cursor.fetchall()
        if not agents:
            return {'message': "Aucun agent actif trouvé."}
            
        liste_agents = []
        for code, nom, prenom, groupe in agents:
            liste_agents.append({
                'code': code,
                'nom': nom,
                'prenom': prenom,
                'groupe': groupe
            })
        
        return {'agents': liste_agents}

    def importer_agents_csv(self, nom_fichier):
        """Importe les agents à partir d'un fichier CSV."""
        try:
            with open(nom_fichier, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                agents_importes = 0
                for row in reader:
                    code = row.get('code', '').upper()
                    nom = row.get('nom', '')
                    prenom = row.get('prenom', '')
                    code_groupe = row.get('code_groupe', '').upper()
                    date_entree = row.get('date_entree', DATE_AFFECTATION_BASE) 
                    
                    if code and nom and code_groupe:
                        result = self.ajouter_agent(code, nom, prenom, code_groupe)
                        if result.get('succes', False):
                            agents_importes += 1
            return {
                'succes': True,
                'message': f"{agents_importes} agent(s) importé(s) ou mis(s) à jour avec succès."
            }
        except FileNotFoundError:
            return {'erreur': f"Le fichier '{nom_fichier}' est introuvable."}
        except Exception as e:
            return {'erreur': f"Erreur lors de l'importation CSV: {e}"}

    def initialiser_agents_test(self):
        """Initialise des agents de test avec la date d'affectation fixe."""
        agents_de_test = [
            {'code': 'A01', 'nom': 'Dupont', 'prenom': 'Alice', 'code_groupe': 'A'},
            {'code': 'B02', 'nom': 'Martin', 'prenom': 'Bob', 'code_groupe': 'B'},
            {'code': 'C03', 'nom': 'Lefevre', 'prenom': 'Carole', 'code_groupe': 'C'},
            {'code': 'D04', 'nom': 'Dubois', 'prenom': 'David', 'code_groupe': 'D'},
            {'code': 'E01', 'nom': 'Zahiri', 'prenom': 'Ahmed', 'code_groupe': 'E'}, 
            {'code': 'E02', 'nom': 'Zarrouk', 'prenom': 'Benoit', 'code_groupe': 'E'}  
        ]
        
        compteur = 0
        for agent in agents_de_test:
            result = self.ajouter_agent(agent['code'], agent['nom'], agent['prenom'], agent['code_groupe'])
            if result.get('succes', False):
                compteur += 1
                
        self.conn.commit()
        return {
            'succes': True,
            'message': f"{compteur} agents de test ajoutés/mis à jour (Date d'entrée: {DATE_AFFECTATION_BASE})."
        }

    # =========================================================================
    # GESTION PLANNING & SHIFTS
    # =========================================================================
    
    def _get_shift_effectif(self, code_agent, jour_date: str):
        """Récupère le shift enregistré ou calcule le shift théorique, et l'enregistre."""
        
        self.cursor.execute("SELECT shift FROM planning WHERE code_agent=? AND date=?", (code_agent, jour_date))
        result = self.cursor.fetchone()
        
        if result:
            return result[0]

        # Si pas d'enregistrement manuel, on calcule le théorique
        date_obj = date.fromisoformat(jour_date)
        shift_theorique = self._get_shift_theorique_rotation(code_agent, date_obj) 
        
        if shift_theorique == '-':
             return '-' 
             
        self.cursor.execute(
            "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'THEORIQUE')",
            (code_agent, jour_date, shift_theorique)
        )
        self.conn.commit()
        return shift_theorique

    def obtenir_planning_mensuel(self, mois, annee):
        """Retourne le planning mensuel global sous forme de données structurées."""
        _, jours_mois = monthrange(annee, mois)
        
        self.cursor.execute("SELECT code, nom, prenom, code_groupe FROM agents WHERE date_sortie IS NULL ORDER BY code_groupe, code")
        agents_info = self.cursor.fetchall()
        
        if not agents_info:
            return {'erreur': 'Aucun agent actif trouvé.'}
        
        # Préparer les données
        planning_data = []
        jours_info = []
        
        # Informations sur les jours
        for i in range(1, jours_mois + 1):
            jour_date_obj = date(annee, mois, i)
            jour_date_str = jour_date_obj.isoformat()
            jours_info.append({
                'numero': i,
                'date': jour_date_str,
                'jour_semaine': JOURS_FRANCAIS[jour_date_obj.strftime('%a')],
                'ferie': self._est_jour_ferie(jour_date_str)
            })
        
        # Données par agent
        for code, nom, prenom, groupe in agents_info:
            agent_row = {
                'code': code,
                'nom_complet': f"{nom} {prenom}",
                'groupe': groupe,
                'shifts': []
            }
            
            for i in range(1, jours_mois + 1):
                jour_date = date(annee, mois, i).isoformat()
                shift = self._get_shift_effectif(code, jour_date)
                agent_row['shifts'].append(shift)
            
            planning_data.append(agent_row)
        
        return {
            'mois': mois,
            'annee': annee,
            'jours': jours_info,
            'agents': planning_data,
            'total_agents': len(agents_info)
        }

    def obtenir_planning_groupe(self, code_groupe, mois, annee):
        """Retourne le planning d'un groupe spécifique."""
        code_groupe = code_groupe.upper()
        
        self.cursor.execute("SELECT code, nom, prenom FROM agents WHERE code_groupe=? AND date_sortie IS NULL ORDER BY code", (code_groupe,))
        agents_info = self.cursor.fetchall()
        
        if not agents_info:
            return {'erreur': f"Aucun agent actif trouvé dans le groupe {code_groupe}."}

        _, jours_mois = monthrange(annee, mois)
        
        # Préparer les données
        planning_data = []
        jours_info = []
        
        for i in range(1, jours_mois + 1):
            jour_date_obj = date(annee, mois, i)
            jour_date_str = jour_date_obj.isoformat()
            jours_info.append({
                'numero': i,
                'date': jour_date_str,
                'jour_semaine': JOURS_FRANCAIS[jour_date_obj.strftime('%a')],
                'ferie': self._est_jour_ferie(jour_date_str)
            })
        
        for code, nom, prenom in agents_info:
            agent_row = {
                'code': code,
                'nom_complet': f"{nom} {prenom}",
                'shifts': []
            }
            
            for i in range(1, jours_mois + 1):
                jour_date = date(annee, mois, i).isoformat()
                shift = self._get_shift_effectif(code, jour_date)
                agent_row['shifts'].append(shift)
            
            planning_data.append(agent_row)
            
        return {
            'groupe': code_groupe,
            'mois': mois,
            'annee': annee,
            'jours': jours_info,
            'agents': planning_data,
            'total_agents': len(agents_info)
        }

    def obtenir_planning_agent(self, code_agent, mois, annee):
        """Retourne le planning d'un agent spécifique."""
        code_agent = code_agent.upper()
        
        self.cursor.execute("SELECT nom, prenom, code_groupe FROM agents WHERE code=?", (code_agent,))
        agent_info = self.cursor.fetchone()
        
        if not agent_info:
            return {'erreur': f'Agent {code_agent} non trouvé.'}
        
        nom, prenom, groupe = agent_info
        _, jours_mois = monthrange(annee, mois)
        
        planning_jours = []
        for i in range(1, jours_mois + 1):
            jour_date_obj = date(annee, mois, i)
            jour_date_str = jour_date_obj.isoformat()
            
            planning_jours.append({
                'jour_numero': i,
                'date': jour_date_str,
                'jour_semaine': JOURS_FRANCAIS[jour_date_obj.strftime('%a')],
                'shift': self._get_shift_effectif(code_agent, jour_date_str),
                'ferie': self._est_jour_ferie(jour_date_str)
            })
        
        # Calculer les statistiques
        stats_data = self.obtenir_statistiques_agent(code_agent, mois, annee)
        
        return {
            'agent': {
                'code': code_agent,
                'nom': nom,
                'prenom': prenom,
                'groupe': groupe
            },
            'mois': mois,
            'annee': annee,
            'jours': planning_jours,
            'statistiques': stats_data.get('statistiques', []) if 'statistiques' in stats_data else []
        }

    def obtenir_planning_trimestriel(self, mois_debut, annee):
        """Retourne le planning trimestriel (3 mois)."""
        resultats = []
        
        for i in range(3):
            mois_courant = (mois_debut + i - 1) % 12 + 1
            annee_courante = annee + (mois_debut + i - 1) // 12
            
            planning_mois = self.obtenir_planning_mensuel(mois_courant, annee_courante)
            resultats.append({
                'mois': mois_courant,
                'annee': annee_courante,
                'planning': planning_mois
            })
        
        return {'trimestre': resultats}

    def _calculer_stats_base(self, code_agent, mois, annee):
        """Calcule les statistiques brutes des shifts pour un mois donné."""
        _, jours_mois = monthrange(annee, mois)
        stats = {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0, '-': 0} 
        feries_travailles = 0 
        total_shifts_effectues = 0

        # Récupérer le groupe de l'agent
        self.cursor.execute("SELECT code_groupe FROM agents WHERE code=?", (code_agent,))
        result = self.cursor.fetchone()
        code_groupe = result[0] if result else None

        for i in range(1, jours_mois + 1):
            jour_date_str = date(annee, mois, i).isoformat()
            self._get_shift_effectif(code_agent, jour_date_str)

        date_debut = date(annee, mois, 1).isoformat()
        date_fin = date(annee, mois, jours_mois).isoformat()
        
        self.cursor.execute("""
            SELECT shift, date FROM planning 
            WHERE code_agent=? AND date BETWEEN ? AND ?
        """, (code_agent, date_debut, date_fin))
        
        planning_records = self.cursor.fetchall()

        for shift_effectif, jour_date_str in planning_records:
            
            if shift_effectif in stats:
                stats[shift_effectif] += 1
                
                if shift_effectif in ['1', '2', '3']:
                    total_shifts_effectues += 1
                    
                    if self._est_jour_ferie(jour_date_str):
                        feries_travailles += 1
                        
        if code_groupe == 'E':
            total_shifts_operationnels = total_shifts_effectues
        else:
            total_shifts_operationnels = total_shifts_effectues + feries_travailles
                        
        return stats, feries_travailles, total_shifts_effectues, total_shifts_operationnels

    def _calculer_stats_base_global(self, mois, annee):
        """Calcule les statistiques consolidées pour tous les agents actifs."""
        self.cursor.execute("SELECT code FROM agents WHERE date_sortie IS NULL")
        agents_codes = [a[0] for a in self.cursor.fetchall()]
        
        stats_globales = {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0, '-': 0}
        total_feries_global = 0
        total_shifts_global = 0
        total_operationnels_global = 0

        for code in agents_codes:
            try:
                stats_agent, feries_agent, total_shifts_agent, total_operationnels_agent = self._calculer_stats_base(code, mois, annee)
                for shift_type in stats_globales.keys():
                    stats_globales[shift_type] += stats_agent.get(shift_type, 0)
                total_feries_global += feries_agent
                total_shifts_global += total_shifts_agent
                total_operationnels_global += total_operationnels_agent
            except Exception:
                pass

        return stats_globales, total_feries_global, total_shifts_global, total_operationnels_global

    def obtenir_statistiques_agent(self, code_agent, mois, annee):
        """Retourne les statistiques d'un agent sous forme structurée."""
        code_agent = code_agent.upper()
        
        self.cursor.execute("SELECT nom, prenom, code_groupe FROM agents WHERE code=?", (code_agent,))
        agent_info = self.cursor.fetchone()
        
        if not agent_info:
            return {'erreur': f'Agent {code_agent} non trouvé'}
        
        nom, prenom, groupe = agent_info
        
        try:
            stats, total_feries, total_shifts, total_operationnels = self._calculer_stats_base(code_agent, mois, annee)
            
            donnees_stats = [
                {'description': 'Shifts Matin (1)', 'valeur': stats.get('1', 0)},
                {'description': 'Shifts Après-midi (2)', 'valeur': stats.get('2', 0)},
                {'description': 'Shifts Nuit (3)', 'valeur': stats.get('3', 0)},
                {'description': 'Jours Repos (R)', 'valeur': stats.get('R', 0)},
                {'description': 'Congés (C)', 'valeur': stats.get('C', 0)},
                {'description': 'Maladie (M)', 'valeur': stats.get('M', 0)},
                {'description': 'Autre Absence (A)', 'valeur': stats.get('A', 0)},
                {'description': 'Fériés travaillés', 'valeur': total_feries},
                {'description': 'Non-planifié (-)', 'valeur': stats.get('-', 0)},
                {'description': 'TOTAL SHIFTS OPÉRATIONNELS', 'valeur': total_operationnels, 'important': True}
            ]
            
            return {
                'agent': {
                    'code': code_agent,
                    'nom': nom,
                    'prenom': prenom,
                    'groupe': groupe
                },
                'mois': mois,
                'annee': annee,
                'statistiques': donnees_stats,
                'total_operationnels': total_operationnels
            }
            
        except Exception as e:
            return {'erreur': f'Erreur de calcul: {str(e)}'}

    def obtenir_statistiques_globales(self, mois, annee):
        """Retourne les statistiques globales sous forme structurée."""
        try:
            stats, total_feries, total_shifts, total_operationnels = self._calculer_stats_base_global(mois, annee)
            
            donnees_stats = [
                {'description': 'Shifts Matin (1)', 'valeur': stats.get('1', 0)},
                {'description': 'Shifts Après-midi (2)', 'valeur': stats.get('2', 0)},
                {'description': 'Shifts Nuit (3)', 'valeur': stats.get('3', 0)},
                {'description': 'Jours Repos (R)', 'valeur': stats.get('R', 0)},
                {'description': 'Congés (C)', 'valeur': stats.get('C', 0)},
                {'description': 'Maladie (M)', 'valeur': stats.get('M', 0)},
                {'description': 'Autre Absence (A)', 'valeur': stats.get('A', 0)},
                {'description': 'Fériés travaillés', 'valeur': total_feries},
                {'description': 'Non-planifié (-)', 'valeur': stats.get('-', 0)},
                {'description': 'TOTAL SHIFTS OPÉRATIONNELS', 'valeur': total_operationnels, 'important': True}
            ]
            
            # Compter les agents par groupe
            self.cursor.execute("""
                SELECT code_groupe, COUNT(*) 
                FROM agents 
                WHERE date_sortie IS NULL 
                GROUP BY code_groupe
            """)
            groupes_stats = {row[0]: row[1] for row in self.cursor.fetchall()}
            
            return {
                'mois': mois,
                'annee': annee,
                'statistiques': donnees_stats,
                'total_operationnels': total_operationnels,
                'groupes': groupes_stats,
                'total_agents': sum(groupes_stats.values())
            }
            
        except Exception as e:
            return {'erreur': f'Erreur de calcul: {str(e)}'}

    # =========================================================================
    #  TOTAL DES JOURS TRAVAILLÉS
    # =========================================================================

    def obtenir_jours_travailles_groupe(self, code_groupe, mois, annee):
        """Retourne le total des jours travaillés pour un groupe spécifique"""
        code_groupe = code_groupe.upper()
        
        self.cursor.execute("""
            SELECT code, nom, prenom FROM agents 
            WHERE code_groupe=? AND date_sortie IS NULL 
            ORDER BY code
        """, (code_groupe,))
        agents = self.cursor.fetchall()
        
        if not agents:
            return {'erreur': f'Aucun agent actif trouvé dans le groupe {code_groupe}.'}

        resultats = []
        total_groupe = 0
        
        for code, nom, prenom in agents:
            total_agent = self._calculer_jours_travailles_agent(code, mois, annee)
            resultats.append({
                'code': code,
                'nom': nom,
                'prenom': prenom,
                'jours_travailles': total_agent
            })
            total_groupe += total_agent
        
        return {
            'groupe': code_groupe,
            'mois': mois,
            'annee': annee,
            'agents': resultats,
            'total_groupe': total_groupe,
            'nombre_agents': len(agents)
        }

    def obtenir_jours_travailles_global(self, mois, annee):
        """Retourne le total des jours travaillés pour tous les groupes"""
        groupes = ['A', 'B', 'C', 'D', 'E']
        total_global = 0
        resultats_groupes = []
        
        for groupe in groupes:
            self.cursor.execute("""
                SELECT code, nom, prenom FROM agents 
                WHERE code_groupe=? AND date_sortie IS NULL 
                ORDER BY code
            """, (groupe,))
            agents = self.cursor.fetchall()
            
            if agents:
                total_groupe = 0
                for code, nom, prenom in agents:
                    total_agent = self._calculer_jours_travailles_agent(code, mois, annee)
                    total_groupe += total_agent
                
                resultats_groupes.append({
                    'groupe': groupe,
                    'total_jours': total_groupe,
                    'nombre_agents': len(agents)
                })
                total_global += total_groupe
        
        return {
            'mois': mois,
            'annee': annee,
            'groupes': resultats_groupes,
            'total_global': total_global
        }

    def _calculer_jours_travailles_agent(self, code_agent, mois, annee):
        """Calcule le nombre total de jours travaillés pour un agent sur un mois"""
        _, jours_mois = monthrange(annee, mois)
        jours_travailles = 0
        
        for i in range(1, jours_mois + 1):
            jour_date = date(annee, mois, i).isoformat()
            shift = self._get_shift_effectif(code_agent, jour_date)
            
            if shift in ['1', '2', '3']:
                jours_travailles += 1
        
        return jours_travailles

    def enregistrer_absence(self, code_agent, jour_date: str, shift_code):
        """Enregistre une absence pour un agent (C, M, A)."""
        code_agent = code_agent.upper()
        shift_code = shift_code.upper()
        if shift_code not in ['C', 'M', 'A']:
            return {'erreur': "Type d'absence invalide. Utilisez C (Congé), M (Maladie) ou A (Autre)."}
            
        self.cursor.execute("SELECT code FROM agents WHERE code=? AND date_sortie IS NULL", (code_agent,))
        if not self.cursor.fetchone():
            return {'erreur': f"Agent {code_agent} non trouvé ou inactif."}

        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'ABSENCE')",
                (code_agent, jour_date, shift_code)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Absence ({shift_code}) enregistrée pour {code_agent} le {jour_date}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'enregistrement de l'absence: {e}"}

    def modifier_shift_ponctuel(self, code_agent, jour_date: str, nouveau_shift):
        """Modifie le shift ponctuel d'un agent."""
        code_agent = code_agent.upper()
        nouveau_shift = nouveau_shift.upper()
        if nouveau_shift not in ['1', '2', '3', 'R', 'C', 'M', 'A']: 
            return {'erreur': "Shift invalide. Utilisez 1, 2, 3, R, C, M, ou A."}

        self.cursor.execute("SELECT code FROM agents WHERE code=? AND date_sortie IS NULL", (code_agent,))
        if not self.cursor.fetchone():
            return {'erreur': f"Agent {code_agent} non trouvé ou inactif."}

        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'MANUEL')",
                (code_agent, jour_date, nouveau_shift)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Shift de {code_agent} modifié en '{nouveau_shift}' pour le {jour_date}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de la modification du shift: {e}"}

    def echanger_shifts(self, code_agent_a, code_agent_b, jour_date: str):
        """Échange les shifts entre deux agents pour un jour donné."""
        code_agent_a = code_agent_a.upper()
        code_agent_b = code_agent_b.upper()
        
        self.cursor.execute("SELECT code FROM agents WHERE code=? OR code=?", (code_agent_a, code_agent_b))
        if len(self.cursor.fetchall()) < 2:
            return {'erreur': "Un ou les deux agents sont introuvables/inactifs."}

        shift_a = self._get_shift_effectif(code_agent_a, jour_date)
        shift_b = self._get_shift_effectif(code_agent_b, jour_date)
        
        if shift_a == '-' or shift_b == '-':
            return {'erreur': "L'un des agents n'est pas planifié à cette date."}
        
        if shift_a == shift_b:
            return {'message': "Les deux agents ont déjà le même shift. Aucun échange nécessaire."}

        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'ECHANGE')",
                (code_agent_a, jour_date, shift_b)
            )
            self.cursor.execute(
                "INSERT OR REPLACE INTO planning (code_agent, date, shift, origine) VALUES (?, ?, ?, 'ECHANGE')",
                (code_agent_b, jour_date, shift_a)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Échange de shifts réussi pour le {jour_date}: {code_agent_a} a pris {shift_b} et {code_agent_b} a pris {shift_a}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'échange des shifts: {e}"}

    # =========================================================================
    # GESTION JOURS FÉRIÉS AUTOMATIQUE MAROC
    # =========================================================================

    def ajouter_jour_ferie(self, jour_date: str, description):
        """Ajoute un jour férié manuellement."""
        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO jours_feries (date, description) VALUES (?, ?)",
                (jour_date, description)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Jour férié '{description}' ajouté le {jour_date}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'ajout du jour férié: {e}"}

    def supprimer_jour_ferie(self, jour_date: str):
        """Supprime un jour férié."""
        try:
            self.cursor.execute("DELETE FROM jours_feries WHERE date=?", (jour_date,))
            if self.cursor.rowcount > 0:
                self.conn.commit()
                self._recalculer_planning_apres_changement_ferie(jour_date)
                return {
                    'succes': True,
                    'message': f"Jour férié du {jour_date} supprimé et planning théorique recalculé."
                }
            else:
                return {'message': f"Aucun jour férié trouvé à cette date: {jour_date}."}
        except Exception as e:
            return {'erreur': f"Erreur lors de la suppression du jour férié: {e}"}

    def _recalculer_planning_apres_changement_ferie(self, jour_date_str):
        """Efface les shifts théoriques pour un jour donné pour forcer la regénération."""
        try:
            self.cursor.execute("DELETE FROM planning WHERE date = ? AND origine = 'THEORIQUE'", (jour_date_str,))
            self.conn.commit()
        except Exception:
            pass

    def _est_jour_ferie(self, jour_date: str):
        """Vérifie si une date est un jour férié (automatique Maroc + manuel)."""
        self.cursor.execute("SELECT 1 FROM jours_feries WHERE date=?", (jour_date,))
        if self.cursor.fetchone() is not None:
            return True
        
        return self._est_jour_ferie_maroc(jour_date)

    def _est_jour_ferie_maroc(self, jour_date: str):
        """Détermine si une date est un jour férié au Maroc (calcul automatique)."""
        from datetime import date
        
        try:
            annee = int(jour_date[:4])
            mois = int(jour_date[5:7])
            jour = int(jour_date[8:10])
            date_obj = date(annee, mois, jour)
        except:
            return False
        
        jours_feries_fixes = {
            (1, 1): "Nouvel An",
            (1, 11): "Manifeste de l'Indépendance",
            (5, 1): "Fête du Travail",
            (7, 30): "Fête du Trône",
            (8, 14): "Allégeance Oued Eddahab",
            (8, 20): "Révolution du Roi et du Peuple", 
            (8, 21): "Fête de la Jeunesse",
            (11, 6): "Marche Verte",
            (11, 18): "Fête de l'Indépendance"
        }
        
        return (mois, jour) in jours_feries_fixes

    def obtenir_jours_feries(self, annee):
        """Retourne tous les jours fériés (automatiques + manuels) pour une année donnée."""
        from datetime import date
        
        # Jours fériés fixes automatiques
        jours_fixes = [
            {'date': date(annee, 1, 1).isoformat(), 'description': 'Nouvel An', 'type': 'fixe'},
            {'date': date(annee, 1, 11).isoformat(), 'description': 'Manifeste de l\'Indépendance', 'type': 'fixe'},
            {'date': date(annee, 5, 1).isoformat(), 'description': 'Fête du Travail', 'type': 'fixe'},
            {'date': date(annee, 7, 30).isoformat(), 'description': 'Fête du Trône', 'type': 'fixe'},
            {'date': date(annee, 8, 14).isoformat(), 'description': 'Allégeance Oued Eddahab', 'type': 'fixe'},
            {'date': date(annee, 8, 20).isoformat(), 'description': 'Révolution du Roi et du Peuple', 'type': 'fixe'},
            {'date': date(annee, 8, 21).isoformat(), 'description': 'Fête de la Jeunesse', 'type': 'fixe'},
            {'date': date(annee, 11, 6).isoformat(), 'description': 'Marche Verte', 'type': 'fixe'},
            {'date': date(annee, 11, 18).isoformat(), 'description': 'Fête de l\'Indépendance', 'type': 'fixe'}
        ]
        
        # Jours fériés manuels
        date_debut = f"{annee}-01-01"
        date_fin = f"{annee}-12-31"
        
        self.cursor.execute("SELECT date, description FROM jours_feries WHERE date BETWEEN ? AND ? ORDER BY date", (date_debut, date_fin))
        feries_manuels = self.cursor.fetchall()
        
        jours_manuels = []
        for jour_date, description in feries_manuels:
            jours_manuels.append({
                'date': jour_date,
                'description': description,
                'type': 'manuel'
            })
        
        # Combiner et trier
        tous_jours = jours_fixes + jours_manuels
        tous_jours.sort(key=lambda x: x['date'])
        
        return {
            'annee': annee,
            'jours_feries': tous_jours,
            'total': len(tous_jours)
        }

    # =========================================================================
    # GESTION DES CODES PANIQUE
    # =========================================================================

    def ajouter_modifier_code_panique(self, code_agent, code_panique, poste_nom):
        """Ajoute ou modifie le code panique pour un agent."""
        code_agent = code_agent.upper()
        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO codes_panique (code_agent, code_panique, poste_nom) VALUES (?, ?, ?)",
                (code_agent, code_panique, poste_nom)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Code panique pour {code_agent} mis à jour : {code_panique} ({poste_nom})."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'ajout/modification du code panique: {e}"}

    def obtenir_codes_panique(self):
        """Retourne tous les codes panique."""
        self.cursor.execute("""
            SELECT c.code_agent, a.nom, a.prenom, c.code_panique, c.poste_nom 
            FROM codes_panique c JOIN agents a ON c.code_agent = a.code
            ORDER BY c.code_agent
        """)
        codes = self.cursor.fetchall()
        if not codes:
            return {'message': "Aucun code panique enregistré."}

        liste_codes = []
        for code_agent, nom, prenom, code_panique, poste_nom in codes:
            liste_codes.append({
                'code_agent': code_agent,
                'nom_complet': f"{nom} {prenom}",
                'code_panique': code_panique,
                'poste_nom': poste_nom
            })
        
        return {'codes': liste_codes}

    def supprimer_code_panique(self, code_agent):
        """Supprime le code panique d'un agent."""
        code_agent = code_agent.upper()
        try:
            self.cursor.execute("DELETE FROM codes_panique WHERE code_agent=?", (code_agent,))
            if self.cursor.rowcount > 0:
                self.conn.commit()
                return {
                    'succes': True,
                    'message': f"Code panique de {code_agent} supprimé."
                }
            else:
                return {'message': f"Aucun code panique trouvé pour l'agent {code_agent}."}
        except Exception as e:
            return {'erreur': f"Erreur lors de la suppression du code panique: {e}"}

    # =========================================================================
    # GESTION DU MATÉRIEL RADIO
    # =========================================================================

    def ajouter_modifier_radio(self, id_radio, modele, statut):
        """Ajoute ou modifie une radio."""
        id_radio = id_radio.upper()
        statut = statut.upper()
        if statut not in ['DISPONIBLE', 'HS', 'RÉPARATION', 'ATTRIBUÉE']:
            return {'erreur': "Statut invalide. Utilisez Disponible, HS, Réparation ou Attribuée."}

        try:
            self.cursor.execute(
                "INSERT OR REPLACE INTO radios (id_radio, modele, statut) VALUES (?, ?, ?)",
                (id_radio, modele, statut)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Radio {id_radio} ({modele}) mise à jour. Statut: {statut}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'ajout/modification de la radio: {e}"}

    def attribuer_radio(self, id_radio, code_agent):
        """Attribue une radio à un agent."""
        id_radio = id_radio.upper()
        code_agent = code_agent.upper()
        date_attribution = date.today().isoformat()
        
        self.cursor.execute("SELECT statut FROM radios WHERE id_radio=?", (id_radio,))
        radio_statut = self.cursor.fetchone()
        
        if not radio_statut:
            return {'erreur': f"Radio {id_radio} non trouvée."}
        if radio_statut[0] != 'DISPONIBLE':
            return {'message': f"Radio {id_radio} n'est pas DISPONIBLE (Statut: {radio_statut[0]})."}

        try:
            self.cursor.execute("UPDATE radios SET statut='ATTRIBUÉE' WHERE id_radio=?", (id_radio,))
            
            self.cursor.execute(
                "INSERT INTO historique_radio (id_radio, code_agent, date_attribution, date_retour) VALUES (?, ?, ?, NULL)",
                (id_radio, code_agent, date_attribution)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Radio {id_radio} attribuée à l'agent {code_agent} le {date_attribution}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'attribution de la radio: {e}"}

    def enregistrer_retour_radio(self, id_radio):
        """Enregistre le retour d'une radio et la marque comme DISPONIBLE."""
        id_radio = id_radio.upper()
        date_retour = date.today().isoformat()
        
        self.cursor.execute("SELECT statut FROM radios WHERE id_radio=?", (id_radio,))
        radio_statut = self.cursor.fetchone()
        
        if not radio_statut:
            return {'erreur': f"Radio {id_radio} non trouvée."}
        if radio_statut[0] != 'ATTRIBUÉE':
            return {'message': f"Radio {id_radio} n'est pas marquée comme ATTRIBUÉE (Statut: {radio_statut[0]})."}

        try:
            self.cursor.execute("UPDATE radios SET statut='DISPONIBLE' WHERE id_radio=?", (id_radio,))
            
            self.cursor.execute(
                """UPDATE historique_radio SET date_retour=? 
                   WHERE id_radio=? AND date_retour IS NULL""",
                (date_retour, id_radio)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Radio {id_radio} retournée et marquée comme DISPONIBLE le {date_retour}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'enregistrement du retour de la radio: {e}"}

    def obtenir_statut_radios(self):
        """Retourne le statut actuel de toutes les radios."""
        self.cursor.execute("""
            SELECT r.id_radio, r.modele, r.statut, 
                   h.code_agent, a.prenom, a.nom
            FROM radios r
            LEFT JOIN historique_radio h ON r.id_radio = h.id_radio AND h.date_retour IS NULL
            LEFT JOIN agents a ON h.code_agent = a.code
            ORDER BY r.id_radio
        """)
        rapport = self.cursor.fetchall()

        if not rapport:
            return {'message': "Aucune radio enregistrée."}

        liste_radios = []
        for id_r, modele, statut, code_a, prenom, nom in rapport:
            radio_info = {
                'id_radio': id_r,
                'modele': modele,
                'statut': statut,
                'attribue_a': None
            }
            
            if statut == 'ATTRIBUÉE' and code_a:
                radio_info['attribue_a'] = {
                    'code': code_a,
                    'nom_complet': f"{prenom} {nom}" if prenom and nom else code_a
                }
            
            liste_radios.append(radio_info)
        
        # Statistiques
        stats = {
            'total': len(liste_radios),
            'disponible': sum(1 for r in liste_radios if r['statut'] == 'DISPONIBLE'),
            'attribuee': sum(1 for r in liste_radios if r['statut'] == 'ATTRIBUÉE'),
            'hs': sum(1 for r in liste_radios if r['statut'] == 'HS'),
            'reparation': sum(1 for r in liste_radios if r['statut'] == 'RÉPARATION')
        }
        
        return {
            'radios': liste_radios,
            'statistiques': stats
        }

    # =========================================================================
    # EXPORTATIONS
    # =========================================================================

    def exporter_stats_excel(self, mois, annee, nom_fichier):
        """Exporte les statistiques complètes de tous les agents pour le mois donné."""
        if not nom_fichier.lower().endswith('.xlsx'):
            nom_fichier += '.xlsx'
            
        self.cursor.execute("SELECT code, nom, prenom, code_groupe FROM agents WHERE date_sortie IS NULL ORDER BY code_groupe, code")
        agents_info = self.cursor.fetchall()
        
        stats_data = []
        for code, nom, prenom, groupe in agents_info:
            stats, feries, total_shifts, total_operationnels = self._calculer_stats_base(code, mois, annee)
            
            row = {
                'Code': code,
                'Nom': nom,
                'Prénom': prenom,
                'Groupe': groupe,
                'Shifts Matin (1)': stats.get('1', 0),
                'Shifts Après-midi (2)': stats.get('2', 0),
                'Shifts Nuit (3)': stats.get('3', 0),
                'Repos (R)': stats.get('R', 0),
                'Congés (C)': stats.get('C', 0),
                'Maladie (M)': stats.get('M', 0),
                'Autres (A)': stats.get('A', 0),
                'Fériés (Crédit Prime)': feries,
                'TOTAL SHIFTS OPÉRATIONNELS (CPA)': total_operationnels
            }
            stats_data.append(row)
            
        df_stats = pd.DataFrame(stats_data)

        try:
            df_stats.to_excel(nom_fichier, index=False, sheet_name=f"Stats_{mois:02d}_{annee}")
            return {
                'succes': True,
                'message': f"Statistiques complètes exportées dans '{nom_fichier}'.",
                'fichier': nom_fichier
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'exportation des statistiques en Excel: {e}"}

    # =========================================================================
    # GESTION HABILLEMENT
    # =========================================================================

    def ajouter_modifier_habillement(self, code_agent, habillement_data):
        """Ajoute ou modifie les informations d'habillement d'un agent."""
        code_agent = code_agent.upper()
        try:
            self.cursor.execute(
                """INSERT OR REPLACE INTO habillement (code_agent, chemise_taille, chemise_date, jacket_taille, jacket_date, pantalon_taille, pantalon_date, cravate_oui, cravate_date) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (code_agent,
                 habillement_data['chemise'][0], habillement_data['chemise'][1],
                 habillement_data['jacket'][0], habillement_data['jacket'][1],
                 habillement_data['pantalon'][0], habillement_data['pantalon'][1],
                 habillement_data['cravate'][0], habillement_data['cravate'][1])
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Informations d'habillement pour {code_agent} mises à jour."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'ajout/modification de l'habillement: {e}"}

    def obtenir_rapport_habillement(self):
        """Retourne un rapport global des tailles d'habillement et des dates de fourniture."""
        self.cursor.execute("""
            SELECT a.code, a.nom, a.prenom, h.chemise_taille, h.chemise_date, 
                   h.jacket_taille, h.jacket_date, h.pantalon_taille, h.pantalon_date, 
                   h.cravate_oui, h.cravate_date
            FROM agents a 
            LEFT JOIN habillement h ON a.code = h.code_agent
            WHERE a.date_sortie IS NULL
            ORDER BY a.code
        """)
        rapport = self.cursor.fetchall()

        if not rapport:
            return {'message': "Aucun agent actif trouvé pour le rapport d'habillement."}

        liste_habillement = []
        for row in rapport:
            code, nom, prenom = row[0], row[1], row[2]
            
            habillement_info = {
                'code': code,
                'nom_complet': f"{nom} {prenom}",
                'chemise': {'taille': row[3], 'date': row[4]},
                'jacket': {'taille': row[5], 'date': row[6]},
                'pantalon': {'taille': row[7], 'date': row[8]},
                'cravate': {'oui_non': row[9], 'date': row[10]}
            }
            
            liste_habillement.append(habillement_info)
        
        return {'habillement': liste_habillement}

    # =========================================================================
    # GESTION DES AVERTISSEMENTS
    # =========================================================================

    def enregistrer_avertissement(self, code_agent, date_av, type_av, description):
        """Enregistre un avertissement disciplinaire pour un agent."""
        code_agent = code_agent.upper()
        type_av = type_av.upper()
        if type_av not in ['ORAL', 'ECRIT', 'MISE_A_PIED']:
            return {'erreur': "Type d'avertissement invalide (ORAL, ECRIT, MISE_A_PIED)."}

        try:
            self.cursor.execute(
                "INSERT INTO avertissements (code_agent, date_avertissement, type_avertissement, description) VALUES (?, ?, ?, ?)",
                (code_agent, date_av, type_av, description)
            )
            self.conn.commit()
            return {
                'succes': True,
                'message': f"Avertissement ({type_av}) enregistré pour {code_agent} le {date_av}."
            }
        except Exception as e:
            return {'erreur': f"Erreur lors de l'enregistrement de l'avertissement: {e}"}

    def obtenir_historique_avertissements_agent(self, code_agent):
        """Retourne l'historique des avertissements d'un agent."""
        code_agent = code_agent.upper()
        self.cursor.execute("""
            SELECT date_avertissement, type_avertissement, description 
            FROM avertissements 
            WHERE code_agent=? 
            ORDER BY date_avertissement DESC
        """, (code_agent,))
        historique = self.cursor.fetchall()
        
        if not historique:
            return {'message': f"Aucun avertissement trouvé pour l'agent {code_agent}."}

        liste_avertissements = []
        for date_avertissement, type_avertissement, description in historique:
            liste_avertissements.append({
                'date': date_avertissement,
                'type': type_avertissement,
                'description': description
            })
        
        return {'avertissements': liste_avertissements}

    def obtenir_rapport_avertissements(self):
        """Retourne un rapport global de tous les avertissements actifs."""
        self.cursor.execute("""
            SELECT a.code, a.nom, a.prenom, av.date_avertissement, av.type_avertissement, av.description
            FROM avertissements av
            JOIN agents a ON av.code_agent = a.code
            WHERE a.date_sortie IS NULL
            ORDER BY av.date_avertissement DESC, a.code
        """)
        rapport = self.cursor.fetchall()
        
        if not rapport:
            return {'message': "Aucun avertissement actif trouvé."}

        liste_avertissements = []
        for code, nom, prenom, date_av, type_av, description in rapport:
            liste_avertissements.append({
                'code_agent': code,
                'nom_complet': f"{nom} {prenom}",
                'date': date_av,
                'type': type_av,
                'description': description
            })
        
        return {'avertissements': liste_avertissements}
# gestion_agents_stats.py - EXTENSIONS POUR LES STATISTIQUES
from gestion_agents import GestionAgents
from datetime import datetime, date, timedelta

class GestionAgentsStats(GestionAgents):
    """Extension de GestionAgents avec des statistiques avancées"""
    
    def obtenir_stats_detaillees_agent(self, code_agent, mois, annee):
        """Retourne des statistiques détaillées pour un agent"""
        
        # Obtenir les statistiques de base
        stats_base = self.obtenir_statistiques_agent(code_agent, mois, annee)
        
        if 'erreur' in stats_base:
            return stats_base
        
        # Obtenir le planning pour calculer des indicateurs supplémentaires
        planning = self.obtenir_planning_agent(code_agent, mois, annee)
        
        if 'erreur' in planning:
            return stats_base
        
        # Calculer des indicateurs avancés
        jours_travailles = 0
        jours_repos = 0
        jours_conges = 0
        jours_maladie = 0
        jours_autres = 0
        jours_feries_travailles = 0
        
        for jour in planning['jours']:
            shift = jour['shift'].upper()
            est_ferie = jour.get('ferie', False)
            
            if shift in ['1', '2', '3']:
                jours_travailles += 1
                if est_ferie:
                    jours_feries_travailles += 1
            elif shift == 'R':
                jours_repos += 1
            elif shift == 'C':
                jours_conges += 1
            elif shift == 'M':
                jours_maladie += 1
            elif shift == 'A':
                jours_autres += 1
        
        total_jours = len(planning['jours'])
        taux_presence = (jours_travailles / total_jours * 100) if total_jours > 0 else 0
        
        # Ajouter les indicateurs avancés
        stats_base['indicateurs_avances'] = {
            'jours_travailles': jours_travailles,
            'jours_repos': jours_repos,
            'jours_conges': jours_conges,
            'jours_maladie': jours_maladie,
            'jours_autres': jours_autres,
            'jours_feries_travailles': jours_feries_travailles,
            'total_jours': total_jours,
            'taux_presence': round(taux_presence, 1),
            'shifts_par_jour': self._calculer_shifts_par_jour(code_agent, mois, annee)
        }
        
        return stats_base
    
    def _calculer_shifts_par_jour(self, code_agent, mois, annee):
        """Calcule la répartition des shifts par jour de la semaine"""
        
        from calendar import monthrange
        
        _, jours_mois = monthrange(annee, mois)
        shifts_par_jour = {
            'Lundi': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0},
            'Mardi': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0},
            'Mercredi': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0},
            'Jeudi': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0},
            'Vendredi': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0},
            'Samedi': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0},
            'Dimanche': {'1': 0, '2': 0, '3': 0, 'R': 0, 'C': 0, 'M': 0, 'A': 0}
        }
        
        jours_francais = {
            0: 'Lundi', 1: 'Mardi', 2: 'Mercredi', 3: 'Jeudi',
            4: 'Vendredi', 5: 'Samedi', 6: 'Dimanche'
        }
        
        for jour_num in range(1, jours_mois + 1):
            jour_date = date(annee, mois, jour_num)
            jour_semaine = jours_francais[jour_date.weekday()]
            jour_date_str = jour_date.isoformat()
            
            shift = self._get_shift_effectif(code_agent, jour_date_str)
            if shift and shift in shifts_par_jour[jour_semaine]:
                shifts_par_jour[jour_semaine][shift] += 1
        
        return shifts_par_jour
    
    def obtenir_classement_groupe(self, code_groupe, mois, annee):
        """Retourne le classement des agents d'un groupe par CPA"""
        
        # Récupérer les agents du groupe
        self.cursor.execute("""
            SELECT code, nom, prenom FROM agents 
            WHERE code_groupe=? AND date_sortie IS NULL 
            ORDER BY code
        """, (code_groupe,))
        agents = self.cursor.fetchall()
        
        if not agents:
            return {'erreur': f'Aucun agent dans le groupe {code_groupe}'}
        
        classement = []
        
        for code, nom, prenom in agents:
            stats = self.obtenir_statistiques_agent(code, mois, annee)
            cpa = 0
            
            if 'statistiques' in stats:
                for stat in stats['statistiques']:
                    if 'TOTAL SHIFTS OPÉRATIONNELS' in stat['description']:
                        cpa = stat['valeur']
                        break
            
            classement.append({
                'code': code,
                'nom': nom,
                'prenom': prenom,
                'nom_complet': f"{nom} {prenom}",
                'cpa': cpa
            })
        
        # Trier par CPA décroissant
        classement.sort(key=lambda x: x['cpa'], reverse=True)
        
        # Ajouter le rang
        for i, agent in enumerate(classement):
            agent['rang'] = i + 1
        
        return {
            'groupe': code_groupe,
            'mois': mois,
            'annee': annee,
            'classement': classement,
            'total_agents': len(classement)
        }
    
    def obtenir_evolution_mensuelle(self, code_agent, nb_mois=6):
        """Retourne l'évolution mensuelle sur plusieurs mois"""
        
        aujourdhui = date.today()
        mois_actuel = aujourdhui.month
        annee_actuelle = aujourdhui.year
        
        evolution = []
        
        for i in range(nb_mois):
            # Calculer le mois et année
            mois_calc = mois_actuel - i
            annee_calc = annee_actuelle
            
            if mois_calc <= 0:
                mois_calc += 12
                annee_calc -= 1
            
            # Obtenir les statistiques du mois
            stats = self.obtenir_statistiques_agent(code_agent, mois_calc, annee_calc)
            cpa = 0
            
            if 'statistiques' in stats:
                for stat in stats['statistiques']:
                    if 'TOTAL SHIFTS OPÉRATIONNELS' in stat['description']:
                        cpa = stat['valeur']
                        break
            
            evolution.append({
                'mois': mois_calc,
                'annee': annee_calc,
                'cpa': cpa,
                'periode': f"{mois_calc:02d}/{annee_calc}"
            })
        
        # Inverser pour avoir du plus ancien au plus récent
        evolution.reverse()
        
        # Calculer la tendance
        if len(evolution) >= 2:
            premier = evolution[0]['cpa']
            dernier = evolution[-1]['cpa']
            if premier > 0:
                tendance = ((dernier - premier) / premier) * 100
            else:
                tendance = 0
        else:
            tendance = 0
        
        return {
            'agent': code_agent,
            'evolution': evolution,
            'tendance': round(tendance, 1),
            'nb_mois': nb_mois
        }

if __name__ == "__main__":
    # Test de la classe
    gestion = GestionAgents()
    print("✅ Module gestion_agents chargé avec succès!")
    