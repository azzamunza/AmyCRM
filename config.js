// config.example.js - Configuration template for AmyCRM
// IMPORTANT: Copy this to config.js and fill in your actual values
// DO NOT commit config.js to version control - it contains sensitive data

window.CRM_CONFIG = {
    // Cloudflare Worker URL (replace with your actual worker URL after deployment)
    WORKER_URL: 'shiny-pond-2e87.azzamunza.workers.dev',
    
    // Google OAuth Configuration (optional - for Google Sign-In)
    GOOGLE_CLIENT_ID: '',
    
    // GitHub Configuration (for reference only - token now stored securely in Cloudflare Worker)
    GITHUB_USERNAME: 'azzamunza',
    GITHUB_REPO: 'AmyCRM',
    
    // Data file paths in GitHub repository
    DATA_FILE: 'data/crm-data.json',
    USERS_FILE: 'data/users.json',
    
    // Google Cloud KMS (optional - for future use)
    USE_KMS: false,
    GCP_PROJECT_ID: ''
};

// Note: The GITHUB_TOKEN is NO LONGER stored here for security
// It is now stored as an environment variable in your Cloudflare Worker
