// dashboard-tab.js - Dashboard overview module

const DashboardTab = {
    stats: {
        totalContacts: 0,
        totalCommunications: 0,
        totalDocuments: 0,
        totalIncidents: 0,
        openIncidents: 0,
        closedIncidents: 0
    },
    recentActivity: [],

    async render() {
        const container = document.getElementById('dashboard');
        
        container.innerHTML = `
            <h2 style="margin-bottom: 30px;">Dashboard Overview</h2>
            
            <!-- Statistics Cards -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" id="totalContacts">0</div>
                    <div class="stat-label">Total Contacts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="totalCommunications">0</div>
                    <div class="stat-label">Communications</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="totalDocuments">0</div>
                    <div class="stat-label">Documents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="totalIncidents">0</div>
                    <div class="stat-label">Incident Reports</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="margin-bottom: 20px;">Quick Actions</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <button class="btn btn-primary" onclick="DashboardTab.quickAction('contacts')">
                        👤 Add Contact
                    </button>
                    <button class="btn btn-primary" onclick="DashboardTab.quickAction('communications')">
                        💬 Log Communication
                    </button>
                    <button class="btn btn-primary" onclick="DashboardTab.quickAction('documents')">
                        📄 Upload Document
                    </button>
                    <button class="btn btn-primary" onclick="DashboardTab.quickAction('incidents')">
                        ⚠️ Report Incident
                    </button>
                </div>
            </div>

            <!-- Recent Activity -->
            <h3 style="margin-bottom: 20px;">Recent Activity</h3>
            <div id="recentActivityContainer">
                <div class="card">
                    <p style="color: var(--text-light); text-align: center;">Loading activity...</p>
                </div>
            </div>

            <!-- Open Incidents Summary (if any) -->
            <div id="openIncidentsSummary"></div>
        `;

        await this.init();
    },

    async init() {
        console.log('Initializing Dashboard...');
        await this.loadData();
        this.displayStats();
        this.displayRecentActivity();
        this.displayOpenIncidents();
    },

    async loadData() {
        try {
            const crmData = await fetchCRMData();
            
            // Get statistics
            this.stats = getStatistics(crmData);
            
            // Get recent activity
            this.recentActivity = getRecentActivity(crmData, 10);
            
            console.log('Dashboard data loaded:', this.stats);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    },

    displayStats() {
        document.getElementById('totalContacts').textContent = this.stats.totalContacts;
        document.getElementById('totalCommunications').textContent = this.stats.totalCommunications;
        document.getElementById('totalDocuments').textContent = this.stats.totalDocuments;
        document.getElementById('totalIncidents').textContent = this.stats.totalIncidents;
    },

    displayRecentActivity() {
        const container = document.getElementById('recentActivityContainer');
        
        if (this.recentActivity.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>No activity yet</h3>
                    <p>Start using the CRM to see your activity here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.recentActivity.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-description">${activity.description}</div>
                    <div class="activity-meta">
                        ${formatDate(activity.date)} • ${activity.data.createdBy || 'System'}
                    </div>
                </div>
            </div>
        `).join('');
    },

    displayOpenIncidents() {
        const container = document.getElementById('openIncidentsSummary');
        
        if (this.stats.openIncidents === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="card" style="border-left: 4px solid var(--danger);">
                <h3 style="color: var(--danger); margin-bottom: 10px;">
                    ⚠️ ${this.stats.openIncidents} Open Incident${this.stats.openIncidents > 1 ? 's' : ''}
                </h3>
                <p style="color: var(--text-light); margin-bottom: 15px;">
                    You have ${this.stats.openIncidents} incident${this.stats.openIncidents > 1 ? 's' : ''} that require${this.stats.openIncidents === 1 ? 's' : ''} attention
                </p>
                <button class="btn btn-danger" onclick="showTab('incidents')">
                    View Incidents
                </button>
            </div>
        `;
    },

    async refresh() {
        await this.loadData();
        this.displayStats();
        this.displayRecentActivity();
        this.displayOpenIncidents();
    },

    // Quick action handler
    quickAction(tabName) {
        showTab(tabName);
    }
};
