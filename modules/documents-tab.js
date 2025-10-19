// tab-module-template.js - Template for creating new tab modules
// Copy this file and rename it to: [tabname]-tab.js
// Replace all instances of "ModuleName" with your actual module name (e.g., "Contacts", "Documents")

const DocumentsTab = {
    // Module state
    data: [],
    filters: {
        search: '',
        status: 'all',
        dateFrom: null,
        dateTo: null
    },
    currentItem: null,

    // Render the tab HTML
    async render() {
        const container = document.getElementById('documents'); // Change to your tab ID
        
        container.innerHTML = `
            <div class="tab-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <h2>Module Name</h2>
                <button class="btn btn-primary" onclick="DocumentsTab.showAddModal()">
                    ➕ Add New
                </button>
            </div>

            <!-- Toolbar with search and filters -->
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-bar">
                        <span class="search-icon">🔍</span>
                        <input 
                            type="text" 
                            id="moduleSearchInput" 
                            placeholder="Search..." 
                            oninput="DocumentsTab.handleSearch(this.value)"
                        >
                    </div>
                </div>
                <div class="toolbar-right">
                    <select onchange="DocumentsTab.handleFilter('status', this.value)">
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="DocumentsTab.exportData()">
                        📥 Export
                    </button>
                </div>
            </div>

            <!-- Content area -->
            <div id="moduleContent">
                <div class="card">
                    <p style="text-align: center; color: var(--text-light);">Loading...</p>
                </div>
            </div>

            <!-- Add/Edit Modal -->
            <div id="moduleModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Add New Item</h3>
                        <button class="modal-close" onclick="DocumentsTab.closeModal()">✕</button>
                    </div>
                    <form id="moduleForm" onsubmit="DocumentsTab.handleSubmit(event)">
                        <!-- Add your form fields here -->
                        <div class="form-group">
                            <label>Name *</label>
                            <input type="text" id="itemName" required>
                        </div>

                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="itemDescription" rows="4"></textarea>
                        </div>

                        <div class="form-group">
                            <label>Status</label>
                            <select id="itemStatus">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex: 1;">Save</button>
                            <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="DocumentsTab.closeModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        await this.init();
    },

    // Initialize the tab
    async init() {
        console.log('Initializing Documents tab...');
        await this.loadData();
        this.displayData();
    },

    // Load data from CRM
    async loadData() {
        try {
            const crmData = await fetchCRMData();
            this.data = crmData.documents || []; // Change to your data property
            console.log(`Loaded ${this.data.length} items`);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data');
        }
    },

    // Display data in the UI
    displayData() {
        const contentEl = document.getElementById('moduleContent');
        const filteredData = this.getFilteredData();

        if (filteredData.length === 0) {
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No items found</h3>
                    <p>Get started by adding your first item</p>
                    <button class="btn btn-primary" onclick="DocumentsTab.showAddModal()">Add New Item</button>
                </div>
            `;
            return;
        }

        // Render items as cards or table
        contentEl.innerHTML = filteredData.map(item => `
            <div class="card" style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 10px;">${item.name}</h4>
                        <p style="color: var(--text-light); margin-bottom: 10px;">${item.description || 'No description'}</p>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span class="badge badge-${item.status === 'active' ? 'success' : 'secondary'}">
                                ${item.status || 'active'}
                            </span>
                            <span style="font-size: 0.85em; color: var(--text-light);">
                                Created: ${formatDateShort(item.createdAt)}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-sm btn-primary" onclick="DocumentsTab.showEditModal(${item.id})">
                            ✏️ Edit
                        </button>
                        <button class="btn-sm btn-danger" onclick="DocumentsTab.confirmDelete(${item.id})">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // Get filtered data based on current filters
    getFilteredData() {
        let filtered = [...this.data];

        // Search filter
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filtered = filtered.filter(item => 
                item.name?.toLowerCase().includes(search) ||
                item.description?.toLowerCase().includes(search)
            );
        }

        // Status filter
        if (this.filters.status !== 'all') {
            filtered = filtered.filter(item => item.status === this.filters.status);
        }

        // Date filters
        if (this.filters.dateFrom || this.filters.dateTo) {
            filtered = filterByDate(filtered, this.filters.dateFrom, this.filters.dateTo);
        }

        return filtered;
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
        this.currentItem = null;
        document.getElementById('modalTitle').textContent = 'Add New Item';
        document.getElementById('moduleForm').reset();
        document.getElementById('moduleModal').classList.add('active');
    },

    // Show edit modal
    showEditModal(itemId) {
        this.currentItem = this.data.find(item => item.id === itemId);
        if (!this.currentItem) return;

        document.getElementById('modalTitle').textContent = 'Edit Item';
        document.getElementById('itemName').value = this.currentItem.name || '';
        document.getElementById('itemDescription').value = this.currentItem.description || '';
        document.getElementById('itemStatus').value = this.currentItem.status || 'active';
        
        document.getElementById('moduleModal').classList.add('active');
    },

    // Close modal
    closeModal() {
        document.getElementById('moduleModal').classList.remove('active');
        document.getElementById('moduleForm').reset();
        this.currentItem = null;
    },

    // Handle form submission
    async handleSubmit(event) {
        event.preventDefault();

        const formData = {
            name: document.getElementById('itemName').value,
            description: document.getElementById('itemDescription').value,
            status: document.getElementById('itemStatus').value
        };

        try {
            if (this.currentItem) {
                // Update existing
                await this.updateItem(this.currentItem.id, formData);
                this.showSuccess('Item updated successfully');
            } else {
                // Create new
                await this.addItem(formData);
                this.showSuccess('Item added successfully');
            }

            this.closeModal();
            await this.loadData();
            this.displayData();
        } catch (error) {
            console.error('Error saving item:', error);
            this.showError('Failed to save item: ' + error.message);
        }
    },

    // Add new item
    async addItem(data) {
        // Replace with your actual add function from crm.js
        // Example: await addContact(data);
        console.log('Adding item:', data);
    },

    // Update existing item
    async updateItem(id, data) {
        // Replace with your actual update function from crm.js
        // Example: await updateContact(id, data);
        console.log('Updating item:', id, data);
    },

    // Confirm delete
    confirmDelete(itemId) {
        const item = this.data.find(i => i.id === itemId);
        if (!item) return;

        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
            this.deleteItem(itemId);
        }
    },

    // Delete item
    async deleteItem(itemId) {
        try {
            // Replace with your actual delete function from crm.js
            // Example: await deleteContact(itemId);
            console.log('Deleting item:', itemId);
            
            await this.loadData();
            this.displayData();
            this.showSuccess('Item deleted successfully');
        } catch (error) {
            console.error('Error deleting item:', error);
            this.showError('Failed to delete item');
        }
    },

    // Export data
    exportData() {
        const filteredData = this.getFilteredData();
        if (filteredData.length === 0) {
            alert('No data to export');
            return;
        }

        exportToCSV(filteredData, 'Documents-export');
    },

    // Show success message
    showSuccess(message) {
        // You can implement a toast notification system
        alert(message);
    },

    // Show error message
    showError(message) {
        alert(message);
    }
};
window.DocumentsTab = DocumentsTab;

// Auto-initialize when tab is shown
// This will be called from dashboard.html when the tab is clicked
