import { initializeUploadStep } from './steps/upload.js';
import { initializeReviewStep } from './steps/review.js';
import { initializeGenerateStep } from './steps/generate.js';
import { initializeCompetitiveStep } from './steps/competitive.js';
import { initializeExportStep } from './steps/export.js';
import { initializeModals } from './modals/index.js';
import { initializeTheme } from './utils/theme.js';
import { initializeStepManagement } from './utils/steps.js';
import { apiClient } from './utils/api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize application
    initializeApp();
    setupEventListeners();
    setupGlobalErrorHandling();
    
    // Initialize with clean state
    resetToInitialState();
    
    // Initialize product specification
    initializeProductSpecification();
});

function initializeApp() {
    // Initialize theme
    initializeTheme();
    
    // Initialize step management
    initializeStepManagement();
    
    // Initialize all step modules
    initializeUploadStep();
    initializeReviewStep();
    initializeGenerateStep();
    initializeCompetitiveStep();
    initializeExportStep();
    
    // Initialize modals
    initializeModals();
    
    // Initialize analysis history functionality
    initializeAnalysisHistory();
}

function setupEventListeners() {
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const event = new CustomEvent('hideAllModals');
            document.dispatchEvent(event);
        }
    });

    // Modal backdrop click handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            const event = new CustomEvent('hideAllModals');
            document.dispatchEvent(event);
        }
    });
}

function setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Show user-friendly error message with improved notifications
        if (window.showError) {
            window.showError('An unexpected error occurred. Please try again.');
        }
        
        // Prevent the default behavior (logging to console)
        event.preventDefault();
    });

    // Handle general errors
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        
        if (window.showError) {
            window.showError('An error occurred. Please refresh the page if issues persist.');
        }
    });
}

function initializeProductSpecification() {
    const productInput = document.getElementById('product-input');
    const productSummary = document.getElementById('product-summary');
    const productNameDisplay = document.getElementById('product-name-display');
    
    // Set default product name
    if (productInput) {
        productInput.value = 'Your Solution';
    }
    
    // Update display
    updateProductDisplay();
}

// Global functions for product specification
window.setProductName = function() {
    const productInput = document.getElementById('product-input');
    const productName = productInput.value.trim();
    
    if (!productName) {
        window.showError && window.showError('Please enter a product/service name');
        return;
    }
    
    if (productName.length > 200) {
        window.showError && window.showError('Product name must be 200 characters or less');
        return;
    }
    
    // Store product name globally
    window.currentProductName = productName;
    
    // Update display
    updateProductDisplay();
    
    // Mark step as completed and enable next step
    completeProductStep();
    
    window.showSuccess && window.showSuccess(`Product set to: ${productName}`);
};

window.resetProductName = function() {
    const productInput = document.getElementById('product-input');
    productInput.value = 'Your Solution';
    setProductName();
};

function updateProductDisplay() {
    const productInput = document.getElementById('product-input');
    const productSummary = document.getElementById('product-summary');
    const productNameDisplay = document.getElementById('product-name-display');
    const generateProductName = document.getElementById('generate-product-name');
    
    const productName = productInput.value.trim() || 'Your Solution';
    window.currentProductName = productName;
    
    if (productNameDisplay) {
        productNameDisplay.textContent = productName;
    }
    
    if (generateProductName) {
        generateProductName.textContent = productName;
    }
    
    if (productSummary) {
        productSummary.style.display = 'flex';
    }
}

function completeProductStep() {
    const productCard = document.getElementById('step-product');
    const uploadCard = document.getElementById('step-upload');
    
    if (productCard) {
        productCard.classList.remove('active');
        productCard.classList.add('completed');
    }
    
    if (uploadCard) {
        uploadCard.classList.remove('disabled');
        uploadCard.classList.add('active');
    }
    
    // Update status summary
    updateStatusSummary('Ready to upload RFP documents');
}

// Add function to complete upload step
window.completeUploadStep = function() {
    const uploadCard = document.getElementById('step-upload');
    const reviewCard = document.getElementById('step-review');
    
    if (uploadCard) {
        uploadCard.classList.remove('active');
        uploadCard.classList.add('completed');
        
        // Update progress to show completion
        const progressFill = uploadCard.querySelector('.progress-fill');
        const progressText = uploadCard.querySelector('.progress-text');
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = 'Documents uploaded successfully';
    }
    
    if (reviewCard) {
        reviewCard.classList.remove('disabled');
        reviewCard.classList.add('active');
        
        // Update review step progress
        const reviewProgressText = reviewCard.querySelector('.progress-text');
        if (reviewProgressText) {
            reviewProgressText.textContent = 'Ready for criteria extraction';
        }
    }
    
    // Update status summary
    updateStatusSummary('Documents uploaded - ready for criteria extraction');
};

function updateStatusSummary(message) {
    const statusItems = document.querySelector('.status-items');
    if (statusItems) {
        statusItems.innerHTML = `
            <div class="status-item">
                <i class="fas fa-circle-notch text-accent-550"></i>
                <span>${message}</span>
            </div>
        `;
    }
}

function resetToInitialState() {
    // Set initial step states
    const productCard = document.getElementById('step-product');
    const uploadCard = document.getElementById('step-upload');
    const reviewCard = document.getElementById('step-review');
    const generateCard = document.getElementById('step-generate');
    const competitiveCard = document.getElementById('step-competitive');
    const exportCard = document.getElementById('step-export');

    // Reset all steps to initial state
    [uploadCard, reviewCard, generateCard, competitiveCard, exportCard].forEach(card => {
        if (card) {
            card.classList.remove('completed', 'active');
            card.classList.add('disabled');
        }
    });

    // Enable only the product step
    if (productCard) {
        productCard.classList.remove('disabled', 'completed');
        productCard.classList.add('active');
    }

    // Reset progress bars
    document.querySelectorAll('.progress-fill').forEach(fill => {
        fill.style.width = '0%';
    });

    document.querySelectorAll('.progress-text').forEach(text => {
        text.textContent = 'Ready to start';
    });
    
    // Update status
    updateStatusSummary('Specify your product/service to begin');
}

// Global function for generating AI responses
window.generateAIResponses = async function() {
    const useDeepResearch = document.getElementById('deep-research-toggle').checked;
    const productName = window.currentProductName || 'Your Solution';
    
    if (useDeepResearch) {
        const confirmed = confirm(
            'Deep Research is enabled. This will provide more comprehensive analysis but will take longer and cost more. Continue?'
        );
        if (!confirmed) return;
    }
    
    const generateBtn = document.getElementById('generate-responses-btn');
    const originalContent = generateBtn.innerHTML;
    
    try {
        // Update button to show processing
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Generating...';
        
        window.showInfo && window.showInfo('Starting AI response generation...');
        
        // Get approved criteria
        const criteria = await apiClient.getCriteria();
        if (!criteria || criteria.length === 0) {
            window.showNotification('No criteria available for response generation', 'warning');
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalContent;
            return;
        }
        
        // Update progress
        updateGenerateProgress(10, `Initializing AI agents for ${productName}...`);
        
        // Simulate AI agent initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Process each criterion
        updateGenerateProgress(20, `Generating responses for ${criteria.length} criteria...`);
        
        let processed = 0;
        let compliant = 0;
        let partial = 0;
        let nonCompliant = 0;
        let failed = 0;
        let responseCount = 0;
        
        // Store validated criteria for the responses modal
        window.validatedCriteria = [];
        
        for (const criterion of criteria) {
            try {
                // Call the agent validation endpoint
                updateGenerateProgress(
                    20 + (processed / criteria.length) * 60, 
                    `Validating criterion ${processed + 1}/${criteria.length} with ${productName}...`
                );
                
                const validation = await apiClient.validateCriterion(
                    criterion.id, 
                    productName, 
                    useDeepResearch
                );
                
                // Store the validated criterion for display
                window.validatedCriteria.push(validation);
                responseCount++;
                
                // Enable View Responses button as soon as we have the first response
                if (responseCount === 1) {
                    enableViewResponsesButton();
                }
                
                // Count results based on validation
                if (validation.is_met === true) {
                    compliant++;
                } else if (validation.is_met === false) {
                    nonCompliant++;
                } else if (validation.is_met === null) {
                    // Handle unknown/failed validations
                    if (validation.validation_summary && validation.validation_summary.includes('failed')) {
                        failed++;
                    } else {
                        partial++; // Uncertain results
                    }
                } else {
                    partial++; // Default for other cases
                }
                
                processed++;
                
                // Update compliance results in real-time
                displayComplianceResults(compliant, partial, nonCompliant + failed, criteria.length - processed);
                
            } catch (error) {
                console.error(`Error validating criterion ${criterion.id}:`, error);
                
                // Don't show notification for every individual error, just log it
                console.warn(`Criterion ${criterion.id} validation failed: ${error.message}`);
                
                failed++; // Count errors as failed validations
                processed++;
            }
        }
        
        // Show final results
        updateGenerateProgress(100, 'AI validation complete!');
        
        // Display final compliance results
        displayComplianceResults(compliant, partial, nonCompliant + failed, 0);
        
        // Enable other buttons
        enableGenerateStepButtons();
        
        // Complete the step
        completeGenerateStep();
        
        let message = `AI response generation completed! ${compliant} compliant, ${partial} partial, ${nonCompliant} non-compliant`;
        if (failed > 0) {
            message += `, ${failed} failed validation`;
        }
        
        window.showSuccess && window.showSuccess(message);
        
    } catch (error) {
        console.error('Error generating AI responses:', error);
        window.showError && window.showError('Failed to generate AI responses: ' + error.message);
        
        // Reset button
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalContent;
    }
};

function enableViewResponsesButton() {
    const viewResponsesBtn = document.getElementById('view-responses-btn');
    
    if (viewResponsesBtn) {
        viewResponsesBtn.classList.remove('btn-disabled');
        viewResponsesBtn.removeAttribute('disabled');
        viewResponsesBtn.classList.add('btn-secondary');
        
        // Add click handler if not already added
        if (!viewResponsesBtn.onclick) {
            viewResponsesBtn.onclick = () => window.showResponsesTable && window.showResponsesTable();
        }
        
        window.showInfo && window.showInfo('Responses are now available for viewing!');
    }
}

function enableGenerateStepButtons() {
    const viewResponsesBtn = document.getElementById('view-responses-btn');
    const generateLogsBtn = document.getElementById('generate-logs-btn');
    
    if (viewResponsesBtn) {
        viewResponsesBtn.classList.remove('btn-disabled');
        viewResponsesBtn.removeAttribute('disabled');
        viewResponsesBtn.classList.add('btn-secondary');
        
        // Ensure click handler is set
        viewResponsesBtn.onclick = () => window.showResponsesTable && window.showResponsesTable();
    }
    
    if (generateLogsBtn) {
        generateLogsBtn.classList.remove('btn-disabled');
        generateLogsBtn.removeAttribute('disabled');
        generateLogsBtn.classList.add('btn-ghost');
        
        // Ensure click handler is set
        generateLogsBtn.onclick = () => window.showLogs && window.showLogs('generate');
    }
}

function completeGenerateStep() {
    const generateCard = document.getElementById('step-generate');
    const competitiveCard = document.getElementById('step-competitive');
    
    if (generateCard) {
        generateCard.classList.remove('active');
        generateCard.classList.add('completed');
    }
    
    if (competitiveCard) {
        competitiveCard.classList.remove('disabled');
        competitiveCard.classList.add('active');
    }
    
    // Update generate button to completed state
    const generateBtn = document.getElementById('generate-responses-btn');
    if (generateBtn) {
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Analysis Complete';
        generateBtn.classList.remove('btn-disabled');
        generateBtn.classList.add('btn-completed');
        generateBtn.disabled = true;
    }
    
    // Dispatch event to notify that validated criteria are ready
    const event = new CustomEvent('validatedCriteriaReady', {
        detail: { criteriaCount: window.validatedCriteria?.length || 0 }
    });
    document.dispatchEvent(event);
    
    // Also enable export directly
    const exportCard = document.getElementById('step-export');
    if (exportCard) {
        exportCard.classList.remove('disabled');
        exportCard.classList.add('active');
        
        const exportBtn = exportCard.querySelector('button');
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.classList.remove('btn-disabled');
            exportBtn.classList.add('btn-primary');
        }
    }
}

function displayComplianceResults(compliant, partial, nonCompliant, pending) {
    // Show the compliance grid
    const complianceResults = document.getElementById('compliance-results');
    if (complianceResults) {
        complianceResults.style.display = 'grid';
    }
    
    // Update the numbers in the compliance cards
    const complianceCards = document.querySelectorAll('.compliance-card');
    
    if (complianceCards[0]) {
        const compliantNumber = complianceCards[0].querySelector('.compliance-number');
        if (compliantNumber) compliantNumber.textContent = compliant;
    }
    
    if (complianceCards[1]) {
        const partialNumber = complianceCards[1].querySelector('.compliance-number');
        if (partialNumber) partialNumber.textContent = partial;
    }
    
    if (complianceCards[2]) {
        const nonCompliantNumber = complianceCards[2].querySelector('.compliance-number');
        if (nonCompliantNumber) nonCompliantNumber.textContent = nonCompliant;
    }
    
    if (complianceCards[3]) {
        const pendingNumber = complianceCards[3].querySelector('.compliance-number');
        if (pendingNumber) pendingNumber.textContent = pending;
    }
    
    // Update collapsed summary
    const generateCard = document.getElementById('step-generate');
    const collapsedStats = generateCard.querySelectorAll('.collapsed-stat span');
    
    if (collapsedStats[0]) collapsedStats[0].textContent = `${compliant} compliant`;
    if (collapsedStats[1]) collapsedStats[1].textContent = `${partial} partial`;
}

function updateGenerateProgress(percentage, text) {
    const progressFill = document.querySelector('#step-generate .progress-fill');
    const progressText = document.querySelector('#step-generate .progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = text;
    }
}

// Global function to populate responses table
window.populateResponsesTable = function() {
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
};

// Global function to view full response details
window.viewFullResponse = function(responseId) {
    const responses = window.validatedCriteria || [];
    const response = responses.find(r => r.id === responseId) || responses[parseInt(responseId)];
    
    if (!response) {
        window.showError && window.showError('Response not found');
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

// Global function to show responses table
window.showResponsesTable = function() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        // Populate the responses table with current data
        populateResponsesTable();
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
};

// Global function to hide responses table
window.hideResponsesTable = function() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// Add a function to show logs modal
window.showLogs = function(step) {
    // For now, show a simple notification
    window.showInfo && window.showInfo(`Processing logs for ${step} step would be displayed here`);
    
    // In a real implementation, you would:
    // 1. Fetch logs from the backend API
    // 2. Display them in a modal
    // 3. Allow filtering and searching
};

// Enhanced export functionality
window.generateCompletePackage = async function() {
    const validatedCriteria = window.validatedCriteria || [];
    const competitiveResults = window.competitiveAnalysisResults || [];
    
    if (validatedCriteria.length === 0) {
        showNotification('No validated criteria available for export. Please complete the response generation step first.', 'warning');
        return;
    }
    
    try {
        const { DocumentGenerator } = await import('./utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        
        showNotification('Starting document package generation...', 'info');
        
        // Show progress indicator
        const exportCard = document.getElementById('step-export');
        if (exportCard) {
            const progressFill = exportCard.querySelector('.progress-fill');
            const progressText = exportCard.querySelector('.progress-text');
            
            if (progressFill && progressText) {
                progressFill.style.width = '20%';
                progressText.textContent = 'Generating RFP Response...';
            }
        }
        
        // Generate RFP Response
        const rfpResult = await documentGenerator.generateRFPResponse();
        showNotification('RFP Response Document generated', 'success');
        
        if (exportCard) {
            const progressFill = exportCard.querySelector('.progress-fill');
            const progressText = exportCard.querySelector('.progress-text');
            
            if (progressFill && progressText) {
                progressFill.style.width = '60%';
                progressText.textContent = 'Generating reports...';
            }
        }
        
        // Generate Competitive Analysis if data is available
        if (competitiveResults.length > 0) {
            const competitiveResult = await documentGenerator.generateCompetitiveAnalysis();
            showNotification('Competitive Analysis Report generated', 'success');
        }
        
        // Generate Compliance Matrix
        const matrixResult = await documentGenerator.generateComplianceMatrix();
        showNotification('Compliance Matrix generated', 'success');
        
        if (exportCard) {
            const progressFill = exportCard.querySelector('.progress-fill');
            const progressText = exportCard.querySelector('.progress-text');
            
            if (progressFill && progressText) {
                progressFill.style.width = '100%';
                progressText.textContent = 'Package generation complete!';
            }
        }
        
        showNotification('Complete RFP package generated successfully! Check your downloads folder.', 'success');
        
    } catch (error) {
        console.error('Error generating complete package:', error);
        showNotification(`Failed to generate complete package: ${error.message}`, 'error');
        
        // Reset progress on error
        const exportCard = document.getElementById('step-export');
        if (exportCard) {
            const progressFill = exportCard.querySelector('.progress-fill');
            const progressText = exportCard.querySelector('.progress-text');
            
            if (progressFill && progressText) {
                progressFill.style.width = '0%';
                progressText.textContent = 'Ready to generate response package';
            }
        }
    }
};

// Individual export functions
window.generateRFPPackage = async function() {
    try {
        const { DocumentGenerator } = await import('./utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        const result = await documentGenerator.generateRFPResponse();
        showNotification(`RFP Response Document downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate RFP Response: ${error.message}`, 'error');
    }
};

window.generateCompetitiveReport = async function() {
    try {
        const competitiveResults = window.competitiveAnalysisResults || [];
        if (competitiveResults.length === 0) {
            showNotification('No competitive analysis data available. Please run competitive analysis first.', 'warning');
            return;
        }
        
        const { DocumentGenerator } = await import('./utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        const result = await documentGenerator.generateCompetitiveAnalysis();
        showNotification(`Competitive Analysis Report downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate Competitive Analysis: ${error.message}`, 'error');
    }
};

window.generateComplianceMatrix = async function() {
    try {
        const { DocumentGenerator } = await import('./utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        const result = await documentGenerator.generateComplianceMatrix();
        showNotification(`Compliance Matrix downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate Compliance Matrix: ${error.message}`, 'error');
    }
};

function initializeAnalysisHistory() {
    // Create the analysis history modal if it doesn't exist
    if (!document.getElementById('analysis-history-modal')) {
        createAnalysisHistoryModal();
    }
    
    // Make analysis history functions globally available
    window.showAnalysisHistory = function() {
        // Check if the competitive step is loaded and has the function
        if (window.competitiveStorage) {
            // Call the actual function from competitive step
            const modal = document.getElementById('analysis-history-modal');
            if (modal) {
                if (window.populateAnalysisHistory) {
                    window.populateAnalysisHistory();
                }
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            }
        } else {
            showNotification('Analysis history not available. Please ensure competitive analysis is loaded.', 'warning');
        }
    };
    
    // Make save function available globally - Fix: Remove recursive call
    window.saveCurrentAnalysis = function() {
        // Check if we have competitive analysis data
        if (window.competitiveAnalysisResults && window.competitiveAnalysisResults.length > 0) {
            // Call the competitive step's save function directly
            if (window.competitiveStorage) {
                // Get current competitive statistics
                const advantages = window.competitiveAnalysisResults.filter(r => r.advantage === 'advantage').length;
                const competitive = window.competitiveAnalysisResults.filter(r => r.advantage === 'competitive').length;
                const improvements = window.competitiveAnalysisResults.filter(r => r.advantage === 'needs_improvement').length;
                
                // Show save dialog
                const analysisName = prompt('Enter a name for this analysis (optional):') || '';
                
                const metadata = {
                    customName: analysisName,
                    competitorCount: window.competitors?.length || 0,
                    criteriaCount: window.competitiveAnalysisResults.length,
                    advantages: advantages,
                    competitive: competitive,
                    improvements: improvements,
                    competitors: window.competitors?.map(c => ({ name: c.name, description: c.description })) || [],
                    manualSave: true,
                    useDeepResearch: false
                };

                try {
                    const analysisId = window.competitiveStorage.saveAnalysis(window.competitiveAnalysisResults, metadata);
                    
                    const displayName = analysisName || `${window.currentProductName || 'Analysis'} vs ${metadata.competitorCount} competitors`;
                    showNotification(`Analysis saved successfully: "${displayName}" (ID: ${analysisId.substr(-8)})`, 'success');
                    
                    // Update global history button
                    if (window.updateAnalysisHistoryButton) {
                        window.updateAnalysisHistoryButton();
                    }
                    
                } catch (error) {
                    console.error('Failed to save analysis:', error);
                    showNotification('Failed to save analysis: ' + error.message, 'error');
                }
            } else {
                showNotification('Storage not available. Please ensure competitive analysis is loaded.', 'warning');
            }
        } else {
            showNotification('No competitive analysis data to save. Please run an analysis first.', 'warning');
        }
    };
    
    // Update history button with count
    updateAnalysisHistoryButton();
}

function createAnalysisHistoryModal() {
    // Check if modal already exists
    if (document.getElementById('analysis-history-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'analysis-history-modal';
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3 class="text-xl-medium text-foreground-900">Competitive Analysis History</h3>
                <button class="modal-close" onclick="hideAnalysisHistory()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="analysis-history-header">
                    <div class="analysis-history-info">
                        <p class="text-sm text-foreground-600">
                            Manage your saved competitive analyses. Load previous results or export data for sharing.
                        </p>
                    </div>
                    <div class="analysis-history-actions">
                        <button class="btn-secondary" onclick="saveCurrentAnalysis()">
                            <i class="fas fa-save"></i>
                            Save Current Analysis
                        </button>
                        <button class="btn-secondary" onclick="importAnalysisFile()">
                            <i class="fas fa-upload"></i>
                            Import Analysis
                        </button>
                        <button class="btn-ghost" onclick="clearAllAnalyses()">
                            <i class="fas fa-trash-alt"></i>
                            Clear All
                        </button>
                    </div>
                </div>
                <div class="analysis-history-list" id="analysis-history-list">
                    <!-- History items will be populated here -->
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (window.hideAnalysisHistory) {
                window.hideAnalysisHistory();
            } else {
                modal.classList.remove('show');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        }
    });
    
    // Make hide function globally available
    window.hideAnalysisHistory = function() {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    };
}

function updateAnalysisHistoryButton() {
    // This will be called by the competitive step to update the button
    // when analyses are saved/loaded
    const historyButton = document.querySelector('.action-buttons button[onclick="showAnalysisHistory()"]');
    
    if (historyButton && window.competitiveStorage) {
        const analyses = window.competitiveStorage.getStoredAnalyses();
        const count = analyses.length;
        const countText = count > 0 ? ` (${count})` : '';
        
        const buttonText = historyButton.querySelector('span');
        if (buttonText) {
            buttonText.textContent = `Analysis History${countText}`;
        }
    }
}

// Make the update function globally available
window.updateAnalysisHistoryButton = updateAnalysisHistoryButton;
window.updateAnalysisHistoryButton = updateAnalysisHistoryButton;
