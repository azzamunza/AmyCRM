// config.example.js - Configuration template for AmyCRM
// IMPORTANT: Copy this file to config.js and fill in your actual values
// DO NOT commit config.js with real credentials to version control

window.CRM_CONFIG = {
    // Cloudflare Worker URL (REQUIRED)
    // Replace with your actual worker URL after deployment
    // Example: 'https://your-worker-name.your-subdomain.workers.dev'
    WORKER_URL: 'https://your-worker-name.your-subdomain.workers.dev',
    
    // Google OAuth Configuration (optional - for Google Sign-In)
    GOOGLE_CLIENT_ID: '',
    
    // GitHub Configuration
    // The GitHub token is NOT stored here for security reasons
    // It is stored as an environment variable in your Cloudflare Worker
    GITHUB_USERNAME: 'your-github-username',
    GITHUB_REPO: 'your-repo-name',
    
    // Data file paths in GitHub repository
    DATA_FILE: 'data/crm-data.json',
    USERS_FILE: 'data/users.json',
    
    // Google Cloud KMS (optional - for future encryption features)
    USE_KMS: false,
    GCP_PROJECT_ID: ''
};

// Security Note:
// The GITHUB_TOKEN should be configured as an environment variable 
// in your Cloudflare Worker. Never store it in client-side code.
// See CLOUDFLARE_SETUP.md for deployment instructions.
