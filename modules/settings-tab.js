// settings-tab.js - Settings module

const SettingsTab = {
    async render() {
        const container = document.getElementById('settings');
        
        container.innerHTML = `
            <h2 style="margin-bottom: 30px;">Settings</h2>

            <!-- User Profile Section -->
            <div class="card">
                <h3>User Profile</h3>
                <div style="margin-top: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; max-width: 600px;">
                        <div style="color: var(--text-light);">Name:</div>
                        <div><strong>${window.currentUser?.name || 'N/A'}</strong></div>
                        
                        <div style="color: var(--text-light);">Email:</div>
                        <div><strong>${window.currentUser?.email || 'N/A'}</strong></div>
                        
                        <div style="color: var(--text-light);">Role:</div>
                        <div>
                            <span class="badge badge-${window.currentUser?.role === 'admin' ? 'admin' : 'user'}">
                                ${window.currentUser?.role === 'admin' ? 'Administrator' : 'User'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- GitHub Sync Status -->
            <div class="card">
                <h3>GitHub Sync Status</h3>
                <p id="syncStatus" style="margin-top: 10px;">Checking connection...</p>
                <button class="btn btn-secondary" style="margin-top: 15px;" onclick="SettingsTab.testConnection()">
                    🔄 Test Connection
                </button>
            </div>

            <!-- Configuration Status -->
            <div class="card">
                <h3>System Configuration</h3>
                <p style="margin-top: 10px; color: var(--text-light); margin-bottom: 15px;">
                    Current configuration status for integrated services
                </p>
                <div id="configStatus" style="margin-top: 10px;"></div>
            </div>

            <!-- Data Management -->
            <div class="card">
                <h3>Data Management</h3>
                <p style="margin-top: 10px; color: var(--text-light); margin-bottom: 15px;">
                    Export or backup your CRM data
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="SettingsTab.exportAllData()">
                        📥 Export All Data (JSON)
                    </button>
                    <button class="btn btn-secondary" onclick="SettingsTab.exportContacts()">
                        📥 Export Contacts (CSV)
                    </button>
                    <button class="btn btn-secondary" onclick="SettingsTab.exportIncidents()">
                        📥 Export Incidents (CSV)
                    </button>
                </div>
            </div>

            <!-- Data Statistics -->
            <div class="card">
                <h3>Data Statistics</h3>
                <div id="dataStats" style="margin-top: 20px;">
                    <p style="color: var(--text-light);">Loading statistics...</p>
                </div>
            </div>

            <!-- System Information -->
            <div class="card">
                <h3>System Information</h3>
                <div style="margin-top: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; max-width: 600px; font-size: 0.95em;">
                        <div style="color: var(--text-light);">Version:</div>
                        <div><strong>1.0.0</strong></div>
                        
                        <div style="color: var(--text-light);">Last Updated:</div>
                        <div id="lastUpdated"><strong>Loading...</strong></div>
                        
                        <div style="color: var(--text-light);">Browser:</div>
                        <div><strong>${this.getBrowserInfo()}</strong></div>
                        
                        <div style="color: var(--text-light);">Storage:</div>
                        <div><strong>GitHub Pages</strong></div>
                    </div>
                </div>
            </div>

            <!-- Danger Zone -->
            ${window.currentUser?.role === 'admin' ? `
            <div class="card" style="border: 2px solid var(--danger);">
                <h3 style="color: var(--danger);">⚠️ Danger Zone</h3>
                <p style="margin-top: 10px; color: var(--text-light); margin-bottom: 15px;">
                    These actions are irreversible. Use with caution.
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-danger" onclick="SettingsTab.clearAllData()">
                        🗑️ Clear All Data
                    </button>
                </div>
            </div>
            ` : ''}
        `;

        await this.init();
    },

    async init() {
        console.log('Initializing Settings...');
        await this.checkConnection();
        this.updateConfigStatus();
        await this.loadDataStatistics();
    },

    async checkConnection() {
        const statusEl = document.getElementById('syncStatus');
        const CONFIG = window.CRM_CONFIG;

        if (!CONFIG.GITHUB_TOKEN) {
            statusEl.innerHTML = '<span style="color: var(--danger);">✗ GitHub token not configured</span>';
            return;
        }

        try {
            statusEl.innerHTML = '<span style="color: var(--text-light);">⏳ Testing connection...</span>';
            
            const response = await fetch(
                `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}`,
                {
                    headers: {
                        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                statusEl.innerHTML = `
                    <div style="color: var(--success);">
                        <strong>✓ Connected to GitHub</strong>
                        <div style="margin-top: 10px; font-size: 0.9em;">
                            <div>Repository: <strong>${data.full_name}</strong></div>
                            <div>Last Push: <strong>${formatDate(data.pushed_at)}</strong></div>
                            <div>Visibility: <strong>${data.private ? 'Private' : 'Public'}</strong></div>
                        </div>
                    </div>
                `;
            } else {
                statusEl.innerHTML = '<span style="color: var(--danger);">✗ Connection failed - Check credentials</span>';
            }
        } catch (error) {
            console.error('Connection test error:', error);
            statusEl.innerHTML = '<span style="color: var(--danger);">✗ Connection error: ' + error.message + '</span>';
        }
    },

    async testConnection() {
        await this.checkConnection();
    },

    updateConfigStatus() {
        const statusEl = document.getElementById('configStatus');
        const CONFIG = window.CRM_CONFIG;

        const checks = [
            { name: 'Google Client ID', value: CONFIG.GOOGLE_CLIENT_ID, description: 'For Google OAuth sign-in' },
            { name: 'GitHub Username', value: CONFIG.GITHUB_USERNAME, description: 'GitHub account username' },
            { name: 'GitHub Repository', value: CONFIG.GITHUB_REPO, description: 'Repository name for data storage' },
            { name: 'GitHub Token', value: CONFIG.GITHUB_TOKEN, description: 'Personal access token for API' }
        ];

        const html = checks.map(check => {
            const isConfigured = check.value && check.value !== '';
            const status = isConfigured ? '✅' : '❌';
            const color = isConfigured ? 'var(--success)' : 'var(--danger)';
            const statusText = isConfigured ? 'Configured' : 'Missing';
            
            return `
                <div style="display: flex; align-items: center; padding: 12px; background: var(--light); border-radius: 8px; margin-bottom: 10px;">
                    <span style="color: ${color}; font-size: 1.2em; margin-right: 15px;">${status}</span>
                    <div style="flex: 1;">
                        <strong>${check.name}</strong>
                        <div style="font-size: 0.85em; color: var(--text-light);">${check.description}</div>
                    </div>
                    <span style="padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; background: ${isConfigured ? '#d1fae5' : '#fee2e2'}; color: ${isConfigured ? '#065f46' : '#991b1b'};">
                        ${statusText}
                    </span>
                </div>
            `;
        }).join('');

        statusEl.innerHTML = html;
    },

    async loadDataStatistics() {
        try {
            const crmData = await fetchCRMData();
            const statsEl = document.getElementById('dataStats');
            const lastUpdatedEl = document.getElementById('lastUpdated');

            const stats = getStatistics(crmData);

            statsEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                    <div style="text-align: center; padding: 15px; background: var(--light); border-radius: 12px;">
                        <div style="font-size: 2em; font-weight: bold; color: var(--primary);">${stats.totalContacts}</div>
                        <div style="color: var(--text-light); font-size: 0.9em;">Contacts</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: var(--light); border-radius: 12px;">
                        <div style="font-size: 2em; font-weight: bold; color: var(--primary);">${stats.totalCommunications}</div>
                        <div style="color: var(--text-light); font-size: 0.9em;">Communications</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: var(--light); border-radius: 12px;">
                        <div style="font-size: 2em; font-weight: bold; color: var(--primary);">${stats.totalDocuments}</div>
                        <div style="color: var(--text-light); font-size: 0.9em;">Documents</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: var(--light); border-radius: 12px;">
                        <div style="font-size: 2em; font-weight: bold; color: ${stats.openIncidents > 0 ? 'var(--danger)' : 'var(--primary)'};">${stats.totalIncidents}</div>
                        <div style="color: var(--text-light); font-size: 0.9em;">Incidents (${stats.openIncidents} open)</div>
                    </div>
                </div>
            `;

            if (crmData.lastUpdated) {
                lastUpdatedEl.innerHTML = `<strong>${formatDate(crmData.lastUpdated)}</strong>`;
            } else {
                lastUpdatedEl.innerHTML = '<strong>Never</strong>';
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            document.getElementById('dataStats').innerHTML = 
                '<p style="color: var(--danger);">Error loading statistics</p>';
        }
    },

    async exportAllData() {
        try {
            const crmData = await fetchCRMData();
            const users = await fetchUsers();
            
            const exportData = {
                crmData: crmData,
                users: users.map(u => ({ ...u, password: '[REDACTED]' })), // Don't export passwords
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            };
            
            exportToJSON(exportData, 'safecare-crm-full-backup');
            alert('✓ Full data export complete!');
        } catch (error) {
            alert('Error exporting data: ' + error.message);
        }
    },

    async exportContacts() {
        try {
            const contacts = await getContacts();
            if (contacts.length === 0) {
                alert('No contacts to export');
                return;
            }
            exportToCSV(contacts, 'safecare-contacts');
            alert('✓ Contacts exported successfully!');
        } catch (error) {
            alert('Error exporting contacts: ' + error.message);
        }
    },

    async exportIncidents() {
        try {
            const incidents = await getIncidents();
            if (incidents.length === 0) {
                alert('No incidents to export');
                return;
            }
            exportToCSV(incidents, 'safecare-incidents');
            alert('✓ Incidents exported successfully!');
        } catch (error) {
            alert('Error exporting incidents: ' + error.message);
        }
    },

    async clearAllData() {
        if (!requireAdmin(window.currentUser)) return;

        const confirmation = prompt(
            '⚠️ WARNING: This will permanently delete ALL CRM data!\n\n' +
            'This includes:\n' +
            '- All contacts\n' +
            '- All communications\n' +
            '- All documents\n' +
            '- All incidents\n\n' +
            'Users will NOT be deleted.\n\n' +
            'Type "DELETE ALL DATA" to confirm:'
        );

        if (confirmation !== 'DELETE ALL DATA') {
            alert('Action cancelled');
            return;
        }

        try {
            const emptyData = {
                contacts: [],
                communications: [],
                documents: [],
                incidents: [],
                lastUpdated: new Date().toISOString()
            };

            await saveCRMData(emptyData);
            alert('✓ All CRM data has been cleared');
            await this.loadDataStatistics();
            
            // Refresh dashboard if it exists
            if (typeof DashboardTab !== 'undefined') {
                await DashboardTab.refresh();
            }
        } catch (error) {
            alert('Error clearing data: ' + error.message);
        }
    },

    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.indexOf('Chrome') > -1) return 'Chrome';
        if (ua.indexOf('Safari') > -1) return 'Safari';
        if (ua.indexOf('Firefox') > -1) return 'Firefox';
        if (ua.indexOf('Edge') > -1) return 'Edge';
        return 'Unknown';
    }
};
window.SettingsTab = SettingsTab;
