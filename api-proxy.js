// api-proxy.js - Secure API proxy layer for GitHub operations
// This replaces direct GitHub API calls with calls to your Cloudflare Worker

const GitHubProxy = {
    /**
     * Get the Cloudflare Worker URL from config
     * @returns {string} Worker URL
     */
    getWorkerURL() {
        let workerUrl = window.CRM_CONFIG?.WORKER_URL;
        if (!workerUrl || workerUrl.includes('your-worker-name')) {
            throw new Error('Cloudflare Worker URL not configured. Please update config.js');
        }
        // Ensure the URL has a protocol
        if (!workerUrl.startsWith('http://') && !workerUrl.startsWith('https://')) {
            workerUrl = `https://${workerUrl}`;
        }
        return workerUrl;
    },

    /**
     * Make a request to GitHub API via Cloudflare Worker
     * @param {string} path - GitHub API path (e.g., '/repos/user/repo/contents/file.json')
     * @param {Object} options - Fetch options (method, body, etc.)
     * @returns {Promise<Response>} Fetch response
     */
    async request(path, options = {}) {
        const workerUrl = this.getWorkerURL();
        
        // Build the full URL to the worker
        const url = `${workerUrl}${path}`;
        
        const fetchOptions = {
            method: options.method || 'GET',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (options.body) {
            fetchOptions.body = typeof options.body === 'string' 
                ? options.body 
                : JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, fetchOptions);
            return response;
        } catch (error) {
            console.error('GitHub Proxy request failed:', error);
            throw error;
        }
    },

    /**
     * Get file contents from GitHub repository
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @returns {Promise<Object>} File data
     */
    async getFileContents(owner, repo, path) {
        const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
        const response = await this.request(apiPath);
        
        if (!response.ok) {
            if (response.status === 404) {
                return null; // File not found
            }
            throw new Error(`Failed to get file: ${response.status}`);
        }
        
        return await response.json();
    },

    /**
     * Create or update a file in GitHub repository
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @param {string} content - Base64 encoded content
     * @param {string} message - Commit message
     * @param {string} sha - File SHA (required for updates)
     * @returns {Promise<Object>} Response data
     */
    async updateFile(owner, repo, path, content, message, sha = null) {
        const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
        
        const body = {
            message: message,
            content: content
        };
        
        if (sha) {
            body.sha = sha;
        }

        const response = await this.request(apiPath, {
            method: 'PUT',
            body: body
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to update file: ${errorData.message}`);
        }

        return await response.json();
    },

    /**
     * Get repository information
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {Promise<Object>} Repository data
     */
    async getRepository(owner, repo) {
        const apiPath = `/repos/${owner}/${repo}`;
        const response = await this.request(apiPath);
        
        if (!response.ok) {
            throw new Error(`Failed to get repository: ${response.status}`);
        }
        
        return await response.json();
    }
};

// Make it available globally
window.GitHubProxy = GitHubProxy;