// crm.js - CRM data management functions for SafeCare CRM

// Fetch CRM data from GitHub
async function fetchCRMData() {
    const CONFIG = window.CRM_CONFIG;

    try {
        const data = await GitHubProxy.getFileContents(
            CONFIG.GITHUB_USERNAME,
            CONFIG.GITHUB_REPO,
            CONFIG.DATA_FILE
        );

        if (!data) {
            console.log('CRM data file not found, creating default structure');
            const defaultData = {
                contacts: [],
                communications: [],
                documents: [],
                incidents: [],
                lastUpdated: new Date().toISOString()
            };
            await saveCRMData(defaultData);
            return defaultData;
        }

        const content = atob(data.content);
        return JSON.parse(content);
        
    } catch (error) {
        console.error('Error fetching CRM data:', error);
        throw error;
    }
}

// Save CRM data to GitHub
async function saveCRMData(crmData) {
    const CONFIG = window.CRM_CONFIG;

    try {
        let sha = null;
        const fileData = await GitHubProxy.getFileContents(
            CONFIG.GITHUB_USERNAME,
            CONFIG.GITHUB_REPO,
            CONFIG.DATA_FILE
        );

        if (fileData) {
            sha = fileData.sha;
        }

        // Update lastUpdated timestamp
        crmData.lastUpdated = new Date().toISOString();

        const content = btoa(unescape(encodeURIComponent(JSON.stringify(crmData, null, 2))));
        await GitHubProxy.updateFile(
            CONFIG.GITHUB_USERNAME,
            CONFIG.GITHUB_REPO,
            CONFIG.DATA_FILE,
            content,
            `Update CRM data - ${new Date().toISOString()}`,
            sha
        );

        console.log('CRM data saved successfully');
        return true;
        
    } catch (error) {
        console.error('Error saving CRM data:', error);
        throw error;
    }
}

// Contact Management Functions
async function addContact(contactData) {
    try {
        const crmData = await fetchCRMData();
        
        const newContact = {
            id: Date.now(),
            ...contactData,
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser?.email || 'unknown'
        };

        crmData.contacts.push(newContact);
        await saveCRMData(crmData);
        
        return newContact;
    } catch (error) {
        console.error('Error adding contact:', error);
        throw error;
    }
}

async function updateContact(contactId, updates) {
    try {
        const crmData = await fetchCRMData();
        const contactIndex = crmData.contacts.findIndex(c => c.id === contactId);
        
        if (contactIndex === -1) {
            throw new Error('Contact not found');
        }

        crmData.contacts[contactIndex] = {
            ...crmData.contacts[contactIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: window.currentUser?.email || 'unknown'
        };

        await saveCRMData(crmData);
        return crmData.contacts[contactIndex];
    } catch (error) {
        console.error('Error updating contact:', error);
        throw error;
    }
}

async function deleteContact(contactId) {
    try {
        const crmData = await fetchCRMData();
        crmData.contacts = crmData.contacts.filter(c => c.id !== contactId);
        await saveCRMData(crmData);
        return true;
    } catch (error) {
        console.error('Error deleting contact:', error);
        throw error;
    }
}

async function getContacts() {
    try {
        const crmData = await fetchCRMData();
        return crmData.contacts || [];
    } catch (error) {
        console.error('Error getting contacts:', error);
        throw error;
    }
}

// Communication Management Functions
async function addCommunication(communicationData) {
    try {
        const crmData = await fetchCRMData();
        
        const newCommunication = {
            id: Date.now(),
            ...communicationData,
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser?.email || 'unknown'
        };

        crmData.communications.push(newCommunication);
        await saveCRMData(crmData);
        
        return newCommunication;
    } catch (error) {
        console.error('Error adding communication:', error);
        throw error;
    }
}

async function updateCommunication(communicationId, updates) {
    try {
        const crmData = await fetchCRMData();
        const commIndex = crmData.communications.findIndex(c => c.id === communicationId);
        
        if (commIndex === -1) {
            throw new Error('Communication not found');
        }

        crmData.communications[commIndex] = {
            ...crmData.communications[commIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: window.currentUser?.email || 'unknown'
        };

        await saveCRMData(crmData);
        return crmData.communications[commIndex];
    } catch (error) {
        console.error('Error updating communication:', error);
        throw error;
    }
}

async function deleteCommunication(communicationId) {
    try {
        const crmData = await fetchCRMData();
        crmData.communications = crmData.communications.filter(c => c.id !== communicationId);
        await saveCRMData(crmData);
        return true;
    } catch (error) {
        console.error('Error deleting communication:', error);
        throw error;
    }
}

async function getCommunications() {
    try {
        const crmData = await fetchCRMData();
        return crmData.communications || [];
    } catch (error) {
        console.error('Error getting communications:', error);
        throw error;
    }
}

// Document Management Functions
async function addDocument(documentData) {
    try {
        const crmData = await fetchCRMData();
        
        const newDocument = {
            id: Date.now(),
            ...documentData,
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser?.email || 'unknown'
        };

        crmData.documents.push(newDocument);
        await saveCRMData(crmData);
        
        return newDocument;
    } catch (error) {
        console.error('Error adding document:', error);
        throw error;
    }
}

async function updateDocument(documentId, updates) {
    try {
        const crmData = await fetchCRMData();
        const docIndex = crmData.documents.findIndex(d => d.id === documentId);
        
        if (docIndex === -1) {
            throw new Error('Document not found');
        }

        crmData.documents[docIndex] = {
            ...crmData.documents[docIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: window.currentUser?.email || 'unknown'
        };

        await saveCRMData(crmData);
        return crmData.documents[docIndex];
    } catch (error) {
        console.error('Error updating document:', error);
        throw error;
    }
}

async function deleteDocument(documentId) {
    try {
        const crmData = await fetchCRMData();
        crmData.documents = crmData.documents.filter(d => d.id !== documentId);
        await saveCRMData(crmData);
        return true;
    } catch (error) {
        console.error('Error deleting document:', error);
        throw error;
    }
}

async function getDocuments() {
    try {
        const crmData = await fetchCRMData();
        return crmData.documents || [];
    } catch (error) {
        console.error('Error getting documents:', error);
        throw error;
    }
}

// Incident Management Functions
async function addIncident(incidentData) {
    try {
        const crmData = await fetchCRMData();
        
        const newIncident = {
            id: Date.now(),
            ...incidentData,
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser?.email || 'unknown',
            status: incidentData.status || 'open'
        };

        crmData.incidents.push(newIncident);
        await saveCRMData(crmData);
        
        return newIncident;
    } catch (error) {
        console.error('Error adding incident:', error);
        throw error;
    }
}

async function updateIncident(incidentId, updates) {
    try {
        const crmData = await fetchCRMData();
        const incidentIndex = crmData.incidents.findIndex(i => i.id === incidentId);
        
        if (incidentIndex === -1) {
            throw new Error('Incident not found');
        }

        crmData.incidents[incidentIndex] = {
            ...crmData.incidents[incidentIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: window.currentUser?.email || 'unknown'
        };

        await saveCRMData(crmData);
        return crmData.incidents[incidentIndex];
    } catch (error) {
        console.error('Error updating incident:', error);
        throw error;
    }
}

async function deleteIncident(incidentId) {
    try {
        const crmData = await fetchCRMData();
        crmData.incidents = crmData.incidents.filter(i => i.id !== incidentId);
        await saveCRMData(crmData);
        return true;
    } catch (error) {
        console.error('Error deleting incident:', error);
        throw error;
    }
}

async function getIncidents() {
    try {
        const crmData = await fetchCRMData();
        return crmData.incidents || [];
    } catch (error) {
        console.error('Error getting incidents:', error);
        throw error;
    }
}

// Search and Filter Functions
function searchContacts(contacts, searchTerm) {
    if (!searchTerm) return contacts;
    
    const term = searchTerm.toLowerCase();
    return contacts.filter(contact => 
        contact.name?.toLowerCase().includes(term) ||
        contact.email?.toLowerCase().includes(term) ||
        contact.phone?.toLowerCase().includes(term) ||
        contact.organization?.toLowerCase().includes(term) ||
        contact.notes?.toLowerCase().includes(term)
    );
}

function searchCommunications(communications, searchTerm) {
    if (!searchTerm) return communications;
    
    const term = searchTerm.toLowerCase();
    return communications.filter(comm => 
        comm.subject?.toLowerCase().includes(term) ||
        comm.notes?.toLowerCase().includes(term) ||
        comm.type?.toLowerCase().includes(term)
    );
}

function searchIncidents(incidents, searchTerm) {
    if (!searchTerm) return incidents;
    
    const term = searchTerm.toLowerCase();
    return incidents.filter(incident => 
        incident.title?.toLowerCase().includes(term) ||
        incident.description?.toLowerCase().includes(term) ||
        incident.status?.toLowerCase().includes(term) ||
        incident.severity?.toLowerCase().includes(term)
    );
}

function filterByDate(items, startDate, endDate) {
    return items.filter(item => {
        const itemDate = new Date(item.createdAt);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
    });
}

function filterByStatus(items, status) {
    if (!status) return items;
    return items.filter(item => item.status === status);
}

// Export/Import Functions
function exportToJSON(data, filename = 'safecare-crm-export') {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportToCSV(items, filename) {
    if (!items || items.length === 0) {
        alert('No data to export');
        return;
    }

    const headers = Object.keys(items[0]);
    const csvContent = [
        headers.join(','),
        ...items.map(item => 
            headers.map(header => {
                const value = item[header];
                // Escape quotes and wrap in quotes if contains comma
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? '';
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    });
}

function getRecentActivity(crmData, limit = 10) {
    const allActivity = [
        ...(crmData.contacts || []).map(c => ({ 
            type: 'contact', 
            action: 'added', 
            data: c, 
            date: c.createdAt,
            icon: '👤',
            description: `Contact added: ${c.name}`
        })),
        ...(crmData.communications || []).map(c => ({ 
            type: 'communication', 
            action: 'logged', 
            data: c, 
            date: c.createdAt,
            icon: '💬',
            description: `Communication logged: ${c.subject || 'No subject'}`
        })),
        ...(crmData.documents || []).map(d => ({ 
            type: 'document', 
            action: 'uploaded', 
            data: d, 
            date: d.createdAt,
            icon: '📄',
            description: `Document uploaded: ${d.name}`
        })),
        ...(crmData.incidents || []).map(i => ({ 
            type: 'incident', 
            action: 'reported', 
            data: i, 
            date: i.createdAt,
            icon: '⚠️',
            description: `Incident reported: ${i.title}`
        }))
    ];

    return allActivity
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);
}

function getStatistics(crmData) {
    return {
        totalContacts: crmData.contacts?.length || 0,
        totalCommunications: crmData.communications?.length || 0,
        totalDocuments: crmData.documents?.length || 0,
        totalIncidents: crmData.incidents?.length || 0,
        openIncidents: crmData.incidents?.filter(i => i.status === 'open').length || 0,
        closedIncidents: crmData.incidents?.filter(i => i.status === 'closed').length || 0
    };
}
