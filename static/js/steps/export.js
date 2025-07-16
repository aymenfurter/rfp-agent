import { DocumentGenerator } from '../utils/document-generator.js';
import { showNotification } from '../utils/notifications.js';

let documentGenerator;

export function initializeExportStep() {
    documentGenerator = new DocumentGenerator();
    
    // Make functions globally available
    window.generateRFPPackage = generateRFPPackage;
    window.generateCompetitiveReport = generateCompetitiveReport;
    window.generateComplianceMatrix = generateComplianceMatrix;
    window.generateCompletePackage = generateCompletePackage;
    
    setupExportEventListeners();
    
    // Check if export should be enabled immediately
    setTimeout(() => {
        checkAndEnableExport();
    }, 500);
}

function setupExportEventListeners() {
    // Generate Package button
    const generateBtn = document.querySelector('#step-export .btn-primary, #step-export .btn-disabled');
    if (generateBtn) {
        generateBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!generateBtn.disabled && !generateBtn.classList.contains('btn-disabled')) {
                await generateCompletePackage();
            }
        });
        
        // Make sure onclick is also set for HTML calls
        generateBtn.onclick = async (e) => {
            e.preventDefault();
            if (!generateBtn.disabled && !generateBtn.classList.contains('btn-disabled')) {
                await generateCompletePackage();
            }
        };
    }

    // Individual export buttons for export items
    setupIndividualExportButtons();
}

function setupIndividualExportButtons() {
    const exportItems = document.querySelectorAll('.export-item');
    
    exportItems.forEach((item, index) => {
        // Add click handler to each export item
        item.style.cursor = 'pointer';
        item.addEventListener('click', async () => {
            const statusBadge = item.querySelector('.status-badge');
            
            // Only allow download if ready
            if (statusBadge && statusBadge.classList.contains('success')) {
                const exportType = getExportTypeFromIndex(index);
                await handleIndividualExport(exportType, item);
            }
        });
    });
}

async function generateCompletePackage() {
    console.log('generateCompletePackage called');
    
    const exportCard = document.getElementById('step-export');
    const progressFill = exportCard?.querySelector('.progress-fill');
    const progressText = exportCard?.querySelector('.progress-text');
    const generateBtn = exportCard?.querySelector('button');
    
    if (!progressFill || !progressText || !generateBtn) {
        console.error('Missing export UI elements');
        return;
    }
    
    // Check if we have the required data
    const validatedCriteria = window.validatedCriteria || [];
    const competitiveResults = window.competitiveAnalysisResults || [];
    
    if (validatedCriteria.length === 0) {
        showNotification('No validated criteria available for export. Please complete the response generation step first.', 'warning');
        return;
    }
    
    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Generating Package...';
        
        // Update progress and generate each document
        await updateExportProgress(10, 'Preparing document generation...');
        
        // Generate RFP Response Document
        await updateExportProgress(25, 'Generating RFP Response Document...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
        const rfpResult = await documentGenerator.generateRFPResponse();
        updateExportItem(0, 'success', 'Ready for Download');
        showNotification('RFP Response Document generated successfully', 'success');
        
        // Generate Competitive Analysis Report (if data available)
        if (competitiveResults.length > 0) {
            await updateExportProgress(50, 'Generating Competitive Analysis Report...');
            await new Promise(resolve => setTimeout(resolve, 500));
            const competitiveResult = await documentGenerator.generateCompetitiveAnalysis();
            updateExportItem(1, 'success', 'Ready for Download');
            showNotification('Competitive Analysis Report generated successfully', 'success');
        } else {
            updateExportItem(1, 'warning', 'No competitive data available');
        }
        
        // Generate Compliance Matrix
        await updateExportProgress(75, 'Generating Compliance Matrix...');
        await new Promise(resolve => setTimeout(resolve, 500));
        const matrixResult = await documentGenerator.generateComplianceMatrix();
        updateExportItem(2, 'success', 'Ready for Download');
        showNotification('Compliance Matrix generated successfully', 'success');
        
        // Complete
        await updateExportProgress(100, 'Package generation complete!');
        
        // Update button
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Package Ready';
        generateBtn.classList.remove('btn-primary');
        generateBtn.classList.add('btn-completed');
        
        // Mark step as completed
        exportCard.classList.remove('active');
        exportCard.classList.add('completed');
        
        showNotification('Export package generated successfully! Click on individual items to download.', 'success');
        
    } catch (error) {
        console.error('Error generating export package:', error);
        showNotification(`Failed to generate export package: ${error.message}`, 'error');
        
        // Reset button
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-download"></i> Generate Package';
        generateBtn.classList.remove('btn-completed');
        generateBtn.classList.add('btn-primary');
    }
}

async function updateExportProgress(percentage, text) {
    const exportCard = document.getElementById('step-export');
    const progressFill = exportCard.querySelector('.progress-fill');
    const progressText = exportCard.querySelector('.progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = text;
    }
    
    // Small delay to show progress
    await new Promise(resolve => setTimeout(resolve, 100));
}

function updateExportItem(index, status, message) {
    const exportItems = document.querySelectorAll('.export-item');
    if (exportItems[index]) {
        const statusBadge = exportItems[index].querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge ${status}`;
            
            let icon = 'fa-clock';
            if (status === 'success') icon = 'fa-download';
            else if (status === 'warning') icon = 'fa-exclamation-triangle';
            else if (status === 'error') icon = 'fa-times';
            
            statusBadge.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${message}</span>
            `;
        }
    }
}

function getExportTypeFromIndex(index) {
    const types = ['rfp-response', 'competitive-analysis', 'compliance-matrix'];
    return types[index] || 'unknown';
}

async function handleIndividualExport(exportType, item) {
    const statusBadge = item.querySelector('.status-badge');
    
    try {
        // Show loading state
        statusBadge.innerHTML = '<i class="fas fa-spinner animate-spin"></i> <span>Downloading...</span>';
        
        let result;
        
        switch (exportType) {
            case 'rfp-response':
                result = await documentGenerator.generateRFPResponse();
                break;
            case 'competitive-analysis':
                result = await documentGenerator.generateCompetitiveAnalysis();
                break;
            case 'compliance-matrix':
                result = await documentGenerator.generateComplianceMatrix();
                break;
            default:
                throw new Error('Unknown export type');
        }
        
        // Reset status
        statusBadge.innerHTML = '<i class="fas fa-download"></i> <span>Ready for Download</span>';
        showNotification(`${result.filename} downloaded successfully`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        statusBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Download failed</span>';
        showNotification(`Failed to download: ${error.message}`, 'error');
        
        // Reset after delay
        setTimeout(() => {
            statusBadge.innerHTML = '<i class="fas fa-download"></i> <span>Ready for Download</span>';
        }, 3000);
    }
}

// Individual export functions with proper error handling
async function generateRFPPackage() {
    try {
        showNotification('Generating RFP Response Document...', 'info');
        const result = await documentGenerator.generateRFPResponse();
        showNotification(`RFP Response Document downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate RFP Response: ${error.message}`, 'error');
    }
}

async function generateCompetitiveReport() {
    try {
        const competitiveResults = window.competitiveAnalysisResults || [];
        if (competitiveResults.length === 0) {
            showNotification('No competitive analysis data available. Please run competitive analysis first.', 'warning');
            return;
        }
        
        showNotification('Generating Competitive Analysis Report...', 'info');
        const result = await documentGenerator.generateCompetitiveAnalysis();
        showNotification(`Competitive Analysis Report downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate Competitive Analysis: ${error.message}`, 'error');
    }
}

async function generateComplianceMatrix() {
    try {
        showNotification('Generating Compliance Matrix...', 'info');
        const result = await documentGenerator.generateComplianceMatrix();
        showNotification(`Compliance Matrix downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate Compliance Matrix: ${error.message}`, 'error');
    }
}

export function getExportStatus() {
    const exportCard = document.getElementById('step-export');
    return {
        completed: exportCard ? exportCard.classList.contains('completed') : false,
        ready: true,
        progress: 100
    };
}

function checkAndEnableExport() {
    const validatedCriteria = window.validatedCriteria || [];
    const competitiveResults = window.competitiveAnalysisResults || [];
    
    // Enable export if we have validated criteria (competitive analysis is optional)
    if (validatedCriteria.length > 0) {
        enableExportStep();
        console.log('Export enabled: Found', validatedCriteria.length, 'validated criteria');
    } else {
        console.log('Export not enabled: No validated criteria found');
    }
}

function enableExportStep() {
    const exportCard = document.getElementById('step-export');
    const generateBtn = exportCard?.querySelector('button');
    
    if (exportCard) {
        // Enable export step
        exportCard.classList.remove('disabled');
        exportCard.classList.add('active');
        
        // Update export progress
        const exportProgress = exportCard.querySelector('.progress-fill');
        const exportText = exportCard.querySelector('.progress-text');
        
        if (exportProgress && exportText && generateBtn) {
            exportProgress.style.width = '0%';
            exportText.textContent = 'Ready to generate response package';
            
            // Enable the button
            generateBtn.disabled = false;
            generateBtn.classList.remove('btn-disabled');
            generateBtn.classList.add('btn-primary');
            
            console.log('Export button enabled successfully');
        }
        
        showNotification('Export step enabled! Ready to generate RFP response package.', 'success');
    }
}

// Auto-enable export when competitive analysis is complete
document.addEventListener('competitiveAnalysisComplete', () => {
    enableExportStep();
});

// Enable export when the module loads if competitive analysis is already complete
setTimeout(() => {
    checkAndEnableExport();
}, 1000);

// Listen for events that should enable export
document.addEventListener('validatedCriteriaReady', () => {
    console.log('Received validatedCriteriaReady event');
    checkAndEnableExport();
});

document.addEventListener('competitiveAnalysisComplete', () => {
    console.log('Received competitiveAnalysisComplete event');
    enableExportStep();
});