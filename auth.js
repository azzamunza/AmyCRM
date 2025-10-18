// auth.js - Shared authentication functions for SafeCare CRM

// GitHub API Functions
async function fetchUsers() {
    const CONFIG = window.CRM_CONFIG;
    
    if (!CONFIG.GITHUB_TOKEN) {
        throw new Error('GitHub token not configured');
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.USERS_FILE}`,
            {
                headers: {
                    'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (response.status === 404) {
            console.log('Users file not found, creating default admins');
            const defaultUsers = [
                {
                    id: 1,
                    name: 'Administrator',
                    email: 'azzamunza@gmail.com',
                    phone: '',
                    password: '',
                    role: 'admin',
                    status: 'approved',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    name: 'Administrator',
                    email: 'amp41286@gmail.com',
                    phone: '',
                    password: '',
                    role: 'admin',
                    status: 'approved',
                    createdAt: new Date().toISOString()
                }
            ];
            await saveUsers(defaultUsers);
            return defaultUsers;
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        const content = atob(data.content);
        return JSON.parse(content);
        
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

async function saveUsers(users) {
    const CONFIG = window.CRM_CONFIG;
    
    if (!CONFIG.GITHUB_TOKEN) {
        throw new Error('GitHub token not configured');
    }

    try {
        let sha = null;
        const getResponse = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.USERS_FILE}`,
            {
                headers: {
                    'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }

        const content = btoa(unescape(encodeURIComponent(JSON.stringify(users, null, 2))));
        const putResponse = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.USERS_FILE}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update users - ${new Date().toISOString()}`,
                    content: content,
                    sha: sha
                })
            }
        );

        if (!putResponse.ok) {
            const errorData = await putResponse.json();
            throw new Error(`Failed to save users: ${errorData.message}`);
        }

        console.log('Users saved successfully');
        return true;
        
    } catch (error) {
        console.error('Error saving users:', error);
        throw error;
    }
}

// Authentication check function for protected pages
function checkAuth() {
    const session = localStorage.getItem('userSession');
    if (!session) {
        console.log('No session found, redirecting to login');
        window.location.href = 'index.html';
        return null;
    }
    
    try {
        const currentUser = JSON.parse(session);
        console.log('Session valid for:', currentUser.email);
        return currentUser;
    } catch (e) {
        console.error('Invalid session:', e);
        localStorage.removeItem('userSession');
        window.location.href = 'index.html';
        return null;
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to sign out?')) {
        localStorage.removeItem('userSession');
        window.location.href = 'index.html';
    }
}

// Verify user is admin
function requireAdmin(currentUser) {
    if (!currentUser || currentUser.role !== 'admin') {
        console.error('Admin access required');
        alert('You do not have permission to access this feature.');
        return false;
    }
    return true;
}

// Parse JWT token (for Google Sign-In)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        throw new Error('Invalid token format');
    }
}
