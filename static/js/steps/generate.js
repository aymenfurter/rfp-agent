import { showNotification } from '../utils/notifications.js';

export function initializeGenerateStep() {
    // Make functions globally available
    window.showResponsesTable = showResponsesTable;
    window.hideResponsesTable = hideResponsesTable;
    window.approveAllResponses = approveAllResponses;
    
    setupGenerateEventListeners();
}

function setupGenerateEventListeners() {
    // Set up event listeners for generate step buttons
    const viewResponsesBtn = document.getElementById('view-responses-btn');
    const generateLogsBtn = document.getElementById('generate-logs-btn');
    
    if (viewResponsesBtn) {
        viewResponsesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!viewResponsesBtn.disabled) {
                showResponsesTable();
            }
        });
    }
    
    if (generateLogsBtn) {
        generateLogsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!generateLogsBtn.disabled) {
                window.showLogs && window.showLogs('generate');
            }
        });
    }
}

function showResponsesTable() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        // Populate the responses table with current data
        populateResponsesTable();
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

function hideResponsesTable() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function approveAllResponses() {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to approve all 216 responses? This action cannot be undone.')) {
        return;
    }

    // Simulate approval process
    const btn = event.target.closest('button');
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Approving...';
    
    setTimeout(() => {
        // Update compliance statistics
        updateComplianceStats(172, 0, 0, 0);
        
        // Reset button
        btn.innerHTML = '<i class="fas fa-check"></i> All Approved';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-completed');
        
        // Show success notification
        showNotification('All responses have been approved successfully!', 'success');
    }, 2000);
}

function updateComplianceStats(compliant, partial, nonCompliant, pending) {
    const complianceCards = document.querySelectorAll('#step-generate .compliance-card');
    
    if (complianceCards[0]) {
        complianceCards[0].querySelector('.compliance-number').textContent = compliant;
    }
    if (complianceCards[1]) {
        complianceCards[1].querySelector('.compliance-number').textContent = partial;
    }
    if (complianceCards[2]) {
        complianceCards[2].querySelector('.compliance-number').textContent = nonCompliant;
    }
    if (complianceCards[3]) {
        complianceCards[3].querySelector('.compliance-number').textContent = pending;
    }
    
    // Update collapsed summary
    const compliantStat = document.querySelector('#step-generate .collapsed-stat.success span');
    if (compliantStat) compliantStat.textContent = `${compliant} compliant`;
}

export function getGenerateStatus() {
    return {
        completed: true,
        compliant: 142,
        partial: 22,
        nonCompliant: 8,
        pending: 0
    };
}

function populateResponsesTable() {
    const tableBody = document.getElementById('responses-table-body');
    if (!tableBody) return;
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    // Get validated criteria from global storage
    const responses = window.validatedCriteria || [];
    
    if (responses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-foreground-600">No response data available</td>
            </tr>
        `;
        return;
    }
    
    // Populate table with response data
    responses.forEach((response, index) => {
        const row = document.createElement('tr');
        
        // Determine compliance status and icon
        let complianceStatus = 'unknown';
        let complianceIcon = 'fa-question-circle';
        let complianceText = 'Unknown';
        
        if (response.is_met === true) {
            complianceStatus = 'compliant';
            complianceIcon = 'fa-check-circle';
            complianceText = 'Compliant';
        } else if (response.is_met === false) {
            complianceStatus = 'non-compliant';
            complianceIcon = 'fa-times-circle';
            complianceText = 'Non-Compliant';
        } else {
            complianceStatus = 'partial';
            complianceIcon = 'fa-exclamation-triangle';
            complianceText = 'Partial/Unknown';
        }
        
        // Truncate long texts for display
        const truncatedCriterion = response.criterion_text.length > 100 
            ? response.criterion_text.substring(0, 100) + '...' 
            : response.criterion_text;
            
        const truncatedResponse = response.validation_summary && response.validation_summary.length > 150
            ? response.validation_summary.substring(0, 150) + '...'
            : (response.validation_summary || 'No response available');
        
        // Format references properly with links - handle the actual data structure
        let referencesHtml = 'No references';
        if (response.validation_references && response.validation_references.length > 0) {
            const referenceLinks = response.validation_references.map((ref, refIndex) => {
                if (ref.url && ref.url.trim()) {
                    // Extract domain name for display text if no title is available
                    let displayText = ref.title;
                    if (!displayText || !displayText.trim()) {
                        try {
                            const urlObj = new URL(ref.url);
                            displayText = urlObj.hostname.replace('www.', '');
                        } catch (e) {
                            displayText = `Source ${refIndex + 1}`;
                        }
                    }
                    return `<a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="text-accent-550 hover:underline">${displayText}</a>`;
                } else if (ref.title && ref.title.trim()) {
                    // If we only have a title, just show it as text
                    return `<span class="text-foreground-600">${ref.title}</span>`;
                } else {
                    // Fallback for malformed references
                    return `<span class="text-foreground-500">Source ${refIndex + 1}</span>`;
                }
            });
            referencesHtml = referenceLinks.join(', ');
        }
        
        row.innerHTML = `
            <td class="text-sm font-mono">${response.id ? response.id.substring(0, 8) : index + 1}</td>
            <td class="text-sm" title="${response.criterion_text}">${truncatedCriterion}</td>
            <td class="text-center">
                <span class="status-badge ${complianceStatus}">
                    <i class="fas ${complianceIcon}"></i>
                    <span>${complianceText}</span>
                </span>
            </td>
            <td class="text-sm" title="${response.validation_summary || 'No response available'}">${truncatedResponse}</td>
            <td class="text-sm references-cell">${referencesHtml}</td>
            <td class="text-center">
                <button class="btn-ghost-small" onclick="viewFullResponse('${response.id || index}')" title="View details">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Add function to view full response details
window.viewFullResponse = function(responseId) {
    const responses = window.validatedCriteria || [];
    const response = responses.find(r => r.id === responseId) || responses[parseInt(responseId)];
    
    if (!response) {
        showNotification('Response not found', 'error');
        return;
    }
    
    // Format references for the detail view - handle the actual data structure
    let referencesSection = '';
    if (response.validation_references && response.validation_references.length > 0) {
        const referencesList = response.validation_references.map((ref, index) => {
            if (ref.url && ref.url.trim()) {
                // Extract domain name for display text if no title is available
                let displayText = ref.title;
                if (!displayText || !displayText.trim()) {
                    try {
                        const urlObj = new URL(ref.url);
                        displayText = urlObj.hostname.replace('www.', '') + ' - ' + urlObj.pathname.split('/').pop();
                        if (displayText.endsWith(' - ')) {
                            displayText = urlObj.hostname.replace('www.', '');
                        }
                    } catch (e) {
                        displayText = `Source ${index + 1}`;
                    }
                }
                return `<li><a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="text-accent-550 hover:underline">${displayText}</a></li>`;
            } else if (ref.title && ref.title.trim()) {
                return `<li><span class="text-foreground-700">${ref.title}</span></li>`;
            } else {
                return `<li><span class="text-foreground-500">Source ${index + 1} (no URL available)</span></li>`;
            }
        }).join('');
        
        referencesSection = `
            <div>
                <h4 class="text-base font-medium text-foreground-900 mb-2">References</h4>
                <ul class="text-sm text-foreground-700 space-y-1 list-disc list-inside">
                    ${referencesList}
                </ul>
            </div>
        `;
    }
    
    // Create a detailed view modal
    const detailsModal = document.createElement('div');
    detailsModal.className = 'modal-overlay';
    detailsModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="text-xl-medium text-foreground-900">Response Details</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div>
                        <h4 class="text-base font-medium text-foreground-900 mb-2">Criterion</h4>
                        <p class="text-sm text-foreground-700 bg-background-100 p-3 rounded">${response.criterion_text}</p>
                    </div>
                    
                    <div>
                        <h4 class="text-base font-medium text-foreground-900 mb-2">Compliance Status</h4>
                        <p class="text-sm">${response.is_met === true ? 'Compliant' : response.is_met === false ? 'Non-Compliant' : 'Partial/Unknown'}</p>
                    </div>
                    
                    <div>
                        <h4 class="text-base font-medium text-foreground-900 mb-2">Response Summary</h4>
                        <p class="text-sm text-foreground-700 bg-background-100 p-3 rounded">${response.validation_summary || 'No response available'}</p>
                    </div>
                    
                    ${referencesSection}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(detailsModal);
    setTimeout(() => detailsModal.classList.add('show'), 10);
};

