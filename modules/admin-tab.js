// admin-tab.js - Admin panel module

const AdminTab = {
    users: [],

    async render() {
        const container = document.getElementById('admin');
        
        container.innerHTML = `
            <h2 style="margin-bottom: 30px;">Admin Panel</h2>
            
            <div class="admin-section">
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <h3>User Management</h3>
                            <p style="margin-top: 10px; color: var(--text-light);">
                                Approve or deny user access requests and manage user roles
                            </p>
                        </div>
                        <button class="btn btn-primary" onclick="AdminTab.refresh()">
                            🔄 Refresh
                        </button>
                    </div>
                    
                    <!-- User Statistics -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 20px; background: var(--light); border-radius: 12px;">
                        <div style="text-align: center;">
                            <div style="font-size: 2em; font-weight: bold; color: var(--primary);" id="totalUsers">0</div>
                            <div style="color: var(--text-light); font-size: 0.9em;">Total Users</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 2em; font-weight: bold; color: var(--success);" id="approvedUsers">0</div>
                            <div style="color: var(--text-light); font-size: 0.9em;">Approved</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 2em; font-weight: bold; color: var(--warning);" id="pendingUsers">0</div>
                            <div style="color: var(--text-light); font-size: 0.9em;">Pending</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 2em; font-weight: bold; color: var(--danger);" id="adminUsers">0</div>
                            <div style="color: var(--text-light); font-size: 0.9em;">Admins</div>
                        </div>
                    </div>

                    <!-- Filter Tabs -->
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border);">
                        <button class="filter-tab active" data-filter="all" onclick="AdminTab.filterUsers('all', event.target)">
                            All Users
                        </button>
                        <button class="filter-tab" data-filter="pending" onclick="AdminTab.filterUsers('pending', event.target)">
                            Pending (<span id="pendingCount">0</span>)
                        </button>
                        <button class="filter-tab" data-filter="approved" onclick="AdminTab.filterUsers('approved', event.target)">
                            Approved
                        </button>
                        <button class="filter-tab" data-filter="admin" onclick="AdminTab.filterUsers('admin', event.target)">
                            Admins
                        </button>
                    </div>
                    
                    <div style="overflow-x: auto;">
                        <table class="user-management-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Status</th>
                                    <th>Role</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="userManagementList">
                                <tr>
                                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
                                        Loading users...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>
                .filter-tab {
                    padding: 10px 20px;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--text-light);
                    transition: all 0.3s;
                }
                
                .filter-tab:hover {
                    color: var(--primary);
                }
                
                .filter-tab.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                }
            </style>
        `;

        await this.init();
    },

    async init() {
        // Check if user is admin
         await this.loadCurrentUser(); // ensure user is loaded first
        
        if (!requireAdmin(window.currentUser)) {
            document.getElementById('admin').innerHTML = `
                <div class="card">
                    <h3 style="color: var(--danger);">Access Denied</h3>
                    <p>You do not have permission to access the admin panel.</p>
                </div>
            `;
            return;
        }

        console.log('Initializing Admin Panel...');
        await this.loadUsers();
        this.displayUsers();
    },

    async loadUsers() {
        try {
            this.users = await fetchUsers();
            console.log(`Loaded ${this.users.length} users`);
            this.updateStatistics();
        } catch (error) {
            console.error('Error loading users:', error);
            document.getElementById('userManagementList').innerHTML = 
                `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">
                    Error loading users: ${error.message}
                </td></tr>`;
        }
    },

    updateStatistics() {
        const total = this.users.length;
        const approved = this.users.filter(u => u.status === 'approved').length;
        const pending = this.users.filter(u => u.status === 'pending').length;
        const admins = this.users.filter(u => u.role === 'admin').length;

        document.getElementById('totalUsers').textContent = total;
        document.getElementById('approvedUsers').textContent = approved;
        document.getElementById('pendingUsers').textContent = pending;
        document.getElementById('adminUsers').textContent = admins;
        document.getElementById('pendingCount').textContent = pending;
    },

    displayUsers(filter = 'all') {
        const tbody = document.getElementById('userManagementList');
        
        let filteredUsers = this.users;
        if (filter === 'pending') {
            filteredUsers = this.users.filter(u => u.status === 'pending');
        } else if (filter === 'approved') {
            filteredUsers = this.users.filter(u => u.status === 'approved');
        } else if (filter === 'admin') {
            filteredUsers = this.users.filter(u => u.role === 'admin');
        }

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
                No users found
            </td></tr>`;
            return;
        }

        tbody.innerHTML = filteredUsers.map(user => `
            <tr>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>${user.phone || '-'}</td>
                <td>
                    <span class="badge badge-${user.status === 'approved' ? 'success' : 'pending'}">
                        ${user.status}
                    </span>
                </td>
                <td>
                    <span class="badge badge-${user.role === 'admin' ? 'admin' : 'user'}">
                        ${user.role}
                    </span>
                </td>
                <td style="font-size: 0.9em; color: var(--text-light);">
                    ${formatDateShort(user.createdAt)}
                </td>
                <td>
                    ${this.renderUserActions(user)}
                </td>
            </tr>
        `).join('');
    },

    renderUserActions(user) {
        const protectedEmails = ['azzamunza@gmail.com', 'amp41286@gmail.com'];
        const isProtected = protectedEmails.includes(user.email);
        const isCurrentUser = user.email === window.currentUser.email;

        if (isProtected) {
            return '<span style="color: var(--text-light); font-size: 0.9em;">🔒 Protected</span>';
        }

        if (isCurrentUser) {
            return '<span style="color: var(--text-light); font-size: 0.9em;">Current User</span>';
        }

        if (user.status === 'pending') {
            return `
                <button class="btn-sm btn-success" onclick="AdminTab.approveUser(${user.id})">
                    ✓ Approve
                </button>
                <button class="btn-sm btn-danger" onclick="AdminTab.denyUser(${user.id})">
                    ✕ Deny
                </button>
            `;
        }

        let actions = `
            <button class="btn-sm btn-danger" onclick="AdminTab.confirmDeleteUser(${user.id})">
                🗑️ Delete
            </button>
        `;

        if (user.role === 'user') {
            actions += `
                <button class="btn-sm btn-primary" onclick="AdminTab.makeAdmin(${user.id})">
                    ⬆️ Make Admin
                </button>
            `;
        } else if (user.role === 'admin') {
            actions += `
                <button class="btn-sm btn-secondary" onclick="AdminTab.removeAdmin(${user.id})">
                    ⬇️ Remove Admin
                </button>
            `;
        }

        return actions;
    },

    filterUsers(filter, element) {
        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
        element.classList.add('active');
        
        this.displayUsers(filter);
    },

    async approveUser(userId) {
        try {
            const user = this.users.find(u => u.id === userId);
            if (!user) return;

            user.status = 'approved';
            await saveUsers(this.users);
            
            alert(`✓ User "${user.name}" has been approved!`);
            await this.refresh();
        } catch (error) {
            alert('Error approving user: ' + error.message);
        }
    },

    async denyUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (!confirm(`Are you sure you want to deny access for "${user.name}"?\n\nThis will permanently delete their access request.`)) {
            return;
        }
        
        try {
            this.users = this.users.filter(u => u.id !== userId);
            await saveUsers(this.users);
            
            alert('User request denied and removed');
            await this.refresh();
        } catch (error) {
            alert('Error denying user: ' + error.message);
        }
    },

    confirmDeleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`⚠️ Are you sure you want to delete "${user.name}"?\n\nThis action cannot be undone.`)) {
            this.deleteUser(userId);
        }
    },

    async deleteUser(userId) {
        try {
            this.users = this.users.filter(u => u.id !== userId);
            await saveUsers(this.users);
            
            alert('User deleted successfully');
            await this.refresh();
        } catch (error) {
            alert('Error deleting user: ' + error.message);
        }
    },

    async makeAdmin(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (!confirm(`Are you sure you want to make "${user.name}" an administrator?\n\nAdministrators have full access to all CRM features and user management.`)) {
            return;
        }
        
        try {
            user.role = 'admin';
            await saveUsers(this.users);
            
            alert(`✓ ${user.name} is now an administrator!`);
            await this.refresh();
        } catch (error) {
            alert('Error updating user role: ' + error.message);
        }
    },

    async removeAdmin(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (!confirm(`Are you sure you want to remove admin privileges from "${user.name}"?\n\nThey will become a regular user.`)) {
            return;
        }
        
        try {
            user.role = 'user';
            await saveUsers(this.users);
            
            alert(`${user.name} is now a regular user`);
            await this.refresh();
        } catch (error) {
            alert('Error updating user role: ' + error.message);
        }
    },

    async refresh() {
        await this.loadUsers();
        this.displayUsers();
    }
};
window.AdminTab = AdminTab;
