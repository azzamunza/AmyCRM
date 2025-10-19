// contacts-tab.js - Contacts management module

const ContactsTab = {
    // Module state
    data: [],
    filters: {
        search: '',
        type: 'all'
    },
    currentContact: null,

    // Render the tab HTML
    async render() {
        const container = document.getElementById('contacts');
        
        container.innerHTML = `
            <div class="tab-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h2>Contacts</h2>
                    <p style="color: var(--text-light); margin-top: 5px;">Manage your provider and care team contacts</p>
                </div>
                <button class="btn btn-primary" onclick="ContactsTab.showAddModal()">
                    ➕ Add Contact
                </button>
            </div>

            <!-- Toolbar with search and filters -->
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-bar">
                        <span class="search-icon">🔍</span>
                        <input 
                            type="text" 
                            id="contactSearchInput" 
                            placeholder="Search contacts..." 
                            oninput="ContactsTab.handleSearch(this.value)"
                        >
                    </div>
                </div>
                <div class="toolbar-right">
                    <select onchange="ContactsTab.handleFilter('type', this.value)">
                        <option value="all">All Types</option>
                        <option value="provider">Healthcare Provider</option>
                        <option value="support">Support Worker</option>
                        <option value="therapist">Therapist</option>
                        <option value="coordinator">Care Coordinator</option>
                        <option value="emergency">Emergency Contact</option>
                        <option value="other">Other</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="ContactsTab.exportData()">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <!-- Content area -->
            <div id="contactsContent">
                <div class="card">
                    <p style="text-align: center; color: var(--text-light);">Loading contacts...</p>
                </div>
            </div>

            <!-- Add/Edit Modal -->
            <div id="contactModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="contactModalTitle">Add New Contact</h3>
                        <button class="modal-close" onclick="ContactsTab.closeModal()">✕</button>
                    </div>
                    <form id="contactForm" onsubmit="ContactsTab.handleSubmit(event)">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" id="contactName" required placeholder="Dr. Jane Smith">
                        </div>

                        <div class="form-group">
                            <label>Contact Type *</label>
                            <select id="contactType" required>
                                <option value="">Select type...</option>
                                <option value="provider">Healthcare Provider</option>
                                <option value="support">Support Worker</option>
                                <option value="therapist">Therapist</option>
                                <option value="coordinator">Care Coordinator</option>
                                <option value="emergency">Emergency Contact</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="contactEmail" placeholder="email@example.com">
                            </div>

                            <div class="form-group">
                                <label>Phone</label>
                                <input type="tel" id="contactPhone" placeholder="(555) 123-4567">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Organization / Practice</label>
                            <input type="text" id="contactOrganization" placeholder="ABC Medical Center">
                        </div>

                        <div class="form-group">
                            <label>Role / Specialty</label>
                            <input type="text" id="contactRole" placeholder="General Practitioner">
                        </div>

                        <div class="form-group">
                            <label>Address</label>
                            <textarea id="contactAddress" rows="2" placeholder="123 Main St, City, State ZIP"></textarea>
                        </div>

                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="contactNotes" rows="3" placeholder="Additional information, office hours, etc."></textarea>
                        </div>

                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex: 1;">
                                💾 Save Contact
                            </button>
                            <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="ContactsTab.closeModal()">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- View Contact Modal -->
            <div id="viewContactModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Contact Details</h3>
                        <button class="modal-close" onclick="ContactsTab.closeViewModal()">✕</button>
                    </div>
                    <div id="viewContactContent"></div>
                </div>
            </div>
        `;

        await this.init();
    },

    // Initialize the tab
    async init() {
        console.log('Initializing Contacts tab...');
        await this.loadData();
        this.displayData();
    },

    // Load data from CRM
    async loadData() {
        try {
            const crmData = await fetchCRMData();
            this.data = crmData.contacts || [];
            console.log(`Loaded ${this.data.length} contacts`);
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.showError('Failed to load contacts: ' + error.message);
        }
    },

    // Display data in the UI
    displayData() {
        const contentEl = document.getElementById('contactsContent');
        const filteredData = this.getFilteredData();

        if (filteredData.length === 0) {
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3>No contacts found</h3>
                    <p>Add your first contact to get started</p>
                    <button class="btn btn-primary" onclick="ContactsTab.showAddModal()">
                        ➕ Add Contact
                    </button>
                </div>
            `;
            return;
        }

        // Group contacts by type
        const grouped = this.groupByType(filteredData);

        contentEl.innerHTML = Object.entries(grouped).map(([type, contacts]) => `
            <div style="margin-bottom: 30px;">
                <h3 style="margin-bottom: 15px; color: var(--text-light); text-transform: capitalize;">
                    ${this.getTypeIcon(type)} ${this.getTypeLabel(type)} (${contacts.length})
                </h3>
                <div style="display: grid; gap: 15px;">
                    ${contacts.map(contact => this.renderContactCard(contact)).join('')}
                </div>
            </div>
        `).join('');
    },

    // Render individual contact card
    renderContactCard(contact) {
        return `
            <div class="card" style="transition: all 0.3s; cursor: pointer;" onmouseenter="this.style.transform='translateX(5px)'" onmouseleave="this.style.transform='translateX(0)'">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 20px;">
                    <div style="flex: 1;" onclick="ContactsTab.viewContact(${contact.id})">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <h4 style="margin: 0;">${contact.name}</h4>
                            <span class="badge badge-user">${this.getTypeLabel(contact.type)}</span>
                        </div>
                        
                        ${contact.organization ? `
                            <p style="color: var(--text-light); margin-bottom: 8px;">
                                🏢 ${contact.organization}${contact.role ? ` • ${contact.role}` : ''}
                            </p>
                        ` : ''}
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.9em; color: var(--text-light);">
                            ${contact.email ? `
                                <span>📧 ${contact.email}</span>
                            ` : ''}
                            ${contact.phone ? `
                                <span>📞 ${contact.phone}</span>
                            ` : ''}
                        </div>
                        
                        ${contact.notes ? `
                            <p style="margin-top: 10px; font-size: 0.9em; color: var(--text-light); font-style: italic;">
                                ${contact.notes.substring(0, 100)}${contact.notes.length > 100 ? '...' : ''}
                            </p>
                        ` : ''}
                    </div>
                    
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        ${contact.email ? `
                            <button class="btn-sm btn-secondary" onclick="event.stopPropagation(); window.location.href='mailto:${contact.email}'" title="Send Email">
                                📧
                            </button>
                        ` : ''}
                        ${contact.phone ? `
                            <button class="btn-sm btn-secondary" onclick="event.stopPropagation(); window.location.href='tel:${contact.phone}'" title="Call">
                                📞
                            </button>
                        ` : ''}
                        <button class="btn-sm btn-primary" onclick="event.stopPropagation(); ContactsTab.showEditModal(${contact.id})" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-sm btn-danger" onclick="event.stopPropagation(); ContactsTab.confirmDelete(${contact.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // View contact details
    viewContact(contactId) {
        const contact = this.data.find(c => c.id === contactId);
        if (!contact) return;

        const content = document.getElementById('viewContactContent');
        content.innerHTML = `
            <div style="padding: 20px 0;">
                <div style="margin-bottom: 20px;">
                    <h2 style="margin-bottom: 5px;">${contact.name}</h2>
                    <span class="badge badge-user">${this.getTypeLabel(contact.type)}</span>
                </div>

                ${contact.organization || contact.role ? `
                    <div style="margin-bottom: 20px; padding: 15px; background: var(--light); border-radius: 8px;">
                        ${contact.organization ? `<p><strong>Organization:</strong> ${contact.organization}</p>` : ''}
                        ${contact.role ? `<p style="margin-top: 5px;"><strong>Role/Specialty:</strong> ${contact.role}</p>` : ''}
                    </div>
                ` : ''}

                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">Contact Information</h4>
                    ${contact.email ? `
                        <p style="margin: 8px 0;">
                            <strong>Email:</strong> 
                            <a href="mailto:${contact.email}" style="color: var(--primary);">${contact.email}</a>
                        </p>
                    ` : ''}
                    ${contact.phone ? `
                        <p style="margin: 8px 0;">
                            <strong>Phone:</strong> 
                            <a href="tel:${contact.phone}" style="color: var(--primary);">${contact.phone}</a>
                        </p>
                    ` : ''}
                    ${contact.address ? `
                        <p style="margin: 8px 0;">
                            <strong>Address:</strong><br>
                            ${contact.address.replace(/\n/g, '<br>')}
                        </p>
                    ` : ''}
                </div>

                ${contact.notes ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px;">Notes</h4>
                        <p style="padding: 15px; background: var(--light); border-radius: 8px; white-space: pre-wrap;">${contact.notes}</p>
                    </div>
                ` : ''}

                <div style="padding-top: 15px; border-top: 1px solid var(--border); font-size: 0.85em; color: var(--text-light);">
                    <p>Created: ${formatDate(contact.createdAt)}${contact.createdBy ? ` by ${contact.createdBy}` : ''}</p>
                    ${contact.updatedAt ? `<p style="margin-top: 5px;">Last updated: ${formatDate(contact.updatedAt)}${contact.updatedBy ? ` by ${contact.updatedBy}` : ''}</p>` : ''}
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="ContactsTab.closeViewModal(); ContactsTab.showEditModal(${contact.id})">
                        ✏️ Edit Contact
                    </button>
                    <button class="btn btn-secondary" style="flex: 1;" onclick="ContactsTab.closeViewModal()">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.getElementById('viewContactModal').classList.add('active');
    },

    closeViewModal() {
        document.getElementById('viewContactModal').classList.remove('active');
    },

    // Get filtered data based on current filters
    getFilteredData() {
        let filtered = [...this.data];

        // Search filter
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filtered = searchContacts(filtered, search);
        }

        // Type filter
        if (this.filters.type !== 'all') {
            filtered = filtered.filter(contact => contact.type === this.filters.type);
        }

        // Sort by name
        filtered.sort((a, b) => a.name.localeCompare(b.name));

        return filtered;
    },

    // Group contacts by type
    groupByType(contacts) {
        const grouped = {};
        contacts.forEach(contact => {
            const type = contact.type || 'other';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(contact);
        });
        return grouped;
    },

    // Get type label
    getTypeLabel(type) {
        const labels = {
            provider: 'Healthcare Provider',
            support: 'Support Worker',
            therapist: 'Therapist',
            coordinator: 'Care Coordinator',
            emergency: 'Emergency Contact',
            other: 'Other'
        };
        return labels[type] || 'Other';
    },

    // Get type icon
    getTypeIcon(type) {
        const icons = {
            provider: '👨‍⚕️',
            support: '🤝',
            therapist: '🧠',
            coordinator: '📋',
            emergency: '🚨',
            other: '👤'
        };
        return icons[type] || '👤';
    },

    // Handle search input
    handleSearch(value) {
        this.filters.search = value;
        this.displayData();
    },

    // Handle filter changes
    handleFilter(filterType, value) {
        this.filters[filterType] = value;
        this.displayData();
    },

    // Show add modal
    showAddModal() {
        this.currentContact = null;
        document.getElementById('contactModalTitle').textContent = 'Add New Contact';
        document.getElementById('contactForm').reset();
        document.getElementById('contactModal').classList.add('active');
    },

    // Show edit modal
    showEditModal(contactId) {
        this.currentContact = this.data.find(c => c.id === contactId);
        if (!this.currentContact) return;

        document.getElementById('contactModalTitle').textContent = 'Edit Contact';
        document.getElementById('contactName').value = this.currentContact.name || '';
        document.getElementById('contactType').value = this.currentContact.type || '';
        document.getElementById('contactEmail').value = this.currentContact.email || '';
        document.getElementById('contactPhone').value = this.currentContact.phone || '';
        document.getElementById('contactOrganization').value = this.currentContact.organization || '';
        document.getElementById('contactRole').value = this.currentContact.role || '';
        document.getElementById('contactAddress').value = this.currentContact.address || '';
        document.getElementById('contactNotes').value = this.currentContact.notes || '';
        
        document.getElementById('contactModal').classList.add('active');
    },

    // Close modal
    closeModal() {
        document.getElementById('contactModal').classList.remove('active');
        document.getElementById('contactForm').reset();
        this.currentContact = null;
    },

    // Handle form submission
    async handleSubmit(event) {
        event.preventDefault();

        const formData = {
            name: document.getElementById('contactName').value.trim(),
            type: document.getElementById('contactType').value,
            email: document.getElementById('contactEmail').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            organization: document.getElementById('contactOrganization').value.trim(),
            role: document.getElementById('contactRole').value.trim(),
            address: document.getElementById('contactAddress').value.trim(),
            notes: document.getElementById('contactNotes').value.trim()
        };

        try {
            if (this.currentContact) {
                // Update existing
                await updateContact(this.currentContact.id, formData);
                this.showSuccess('✓ Contact updated successfully');
            } else {
                // Create new
                await addContact(formData);
                this.showSuccess('✓ Contact added successfully');
            }

            this.closeModal();
            await this.loadData();
            this.displayData();

            // Refresh dashboard if it exists
            if (typeof DashboardTab !== 'undefined') {
                await DashboardTab.refresh();
            }
        } catch (error) {
            console.error('Error saving contact:', error);
            this.showError('Failed to save contact: ' + error.message);
        }
    },

    // Confirm delete
    confirmDelete(contactId) {
        const contact = this.data.find(c => c.id === contactId);
        if (!contact) return;

        if (confirm(`Are you sure you want to delete "${contact.name}"?\n\nThis action cannot be undone.`)) {
            this.deleteContact(contactId);
        }
    },

    // Delete contact
    async deleteContact(contactId) {
        try {
            await deleteContact(contactId);
            
            await this.loadData();
            this.displayData();
            this.showSuccess('✓ Contact deleted successfully');

            // Refresh dashboard if it exists
            if (typeof DashboardTab !== 'undefined') {
                await DashboardTab.refresh();
            }
        } catch (error) {
            console.error('Error deleting contact:', error);
            this.showError('Failed to delete contact: ' + error.message);
        }
    },

    // Export data
    exportData() {
        const filteredData = this.getFilteredData();
        if (filteredData.length === 0) {
            alert('No contacts to export');
            return;
        }

        exportToCSV(filteredData, 'safecare-contacts');
    },

    // Show success message
    showSuccess(message) {
        alert(message);
    },

    // Show error message
    showError(message) {
        alert(message);
    }
};

window.ContactsTab = ContactsTab;
