import { apiClient } from '../utils/api.js';
import { showNotification } from '../utils/notifications.js';
import { getUploadedFiles } from './upload.js';

let currentCriteria = [];

export function initializeReviewStep() {
    // Make functions globally available
    window.showCriteriaTable = showCriteriaTable;
    window.hideCriteriaTable = hideCriteriaTable;
    window.approveAllCriteria = approveAllCriteria;
    window.extractCriteria = extractCriteria;
}

async function extractCriteria() {
    try {
        const uploadedFiles = getUploadedFiles();
        if (uploadedFiles.length === 0) {
            showNotification('No documents available for criteria extraction', 'error');
            return;
        }

        // Update button to show processing
        const extractBtn = document.getElementById('view-criteria-btn');
        if (extractBtn) {
            extractBtn.disabled = true;
            extractBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Extracting Criteria...';
        }

        showNotification('Starting criteria extraction...', 'info');
        
        let allCriteria = [];
        let processedCount = 0;
        
        for (const uploadedFile of uploadedFiles) {
            try {
                console.log('Extracting criteria from document:', uploadedFile.documentId);
                
                // Use the correct backend endpoint
                const criteriaResult = await apiClient.request(`/criteria/extract/${uploadedFile.documentId}?auto_categorize=true`, {
                    method: 'POST'
                });
                
                console.log('Criteria extraction result:', criteriaResult);
                
                if (criteriaResult.criteria && criteriaResult.criteria.length > 0) {
                    allCriteria = allCriteria.concat(criteriaResult.criteria);
                    processedCount++;
                }
                
            } catch (error) {
                console.error(`Failed to extract criteria from ${uploadedFile.file.name}:`, error);
                showNotification(`Failed to extract criteria from ${uploadedFile.file.name}: ${error.message}`, 'error');
            }
        }
        
        if (allCriteria.length > 0) {
            currentCriteria = allCriteria;
            updateReviewStepUI();
            
            // Update button to show success and enable viewing
            if (extractBtn) {
                extractBtn.disabled = false;
                extractBtn.innerHTML = '<i class="fas fa-table"></i> View Criteria';
                extractBtn.onclick = () => showCriteriaTable();
            }
            
            // Enable approve all button
            const approveAllBtn = document.getElementById('approve-all-btn');
            if (approveAllBtn) {
                approveAllBtn.classList.remove('btn-disabled');
                approveAllBtn.removeAttribute('disabled');
                approveAllBtn.classList.add('btn-primary');
            }
            
            showNotification(`Successfully extracted ${allCriteria.length} criteria from ${processedCount} documents`, 'success');
        } else {
            // Reset button if no criteria found
            if (extractBtn) {
                extractBtn.disabled = false;
                extractBtn.innerHTML = '<i class="fas fa-search"></i> Extract Criteria';
            }
            showNotification('No criteria found in the uploaded documents', 'warning');
        }
        
    } catch (error) {
        console.error('Criteria extraction failed:', error);
        showNotification('Failed to extract criteria', 'error');
        
        // Reset button on error
        const extractBtn = document.getElementById('view-criteria-btn');
        if (extractBtn) {
            extractBtn.disabled = false;
            extractBtn.innerHTML = '<i class="fas fa-search"></i> Extract Criteria';
        }
    }
}

function showCriteriaTable() {
    const modal = document.getElementById('criteria-modal');
    if (modal) {
        // Only extract criteria if we don't have any yet
        if (currentCriteria.length === 0) {
            extractCriteria();
            return; // Don't show modal until extraction is complete
        }
        
        // Import and call the modal function
        import('../modals/criteria.js').then(module => {
            module.showCriteriaTable();
        });
    }
}

function hideCriteriaTable() {
    const modal = document.getElementById('criteria-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

async function approveAllCriteria() {
    // Check if there are criteria to approve
    const pendingCriteria = currentCriteria.filter(c => 
        c.status === 'extracted' || c.status === 'pending'
    );
    
    if (pendingCriteria.length === 0) {
        showNotification('All criteria are already processed', 'info');
        return;
    }

    // Show confirmation using notification instead of dialog
    const btn = event.target.closest('button');
    const originalContent = btn.innerHTML;
    
    // First click: Show confirmation
    if (!btn.dataset.confirmClicked) {
        btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Click again to confirm (${pendingCriteria.length} criteria)`;
        btn.classList.add('btn-warning');
        btn.dataset.confirmClicked = 'true';
        
        showNotification(`Click "Approve All" again to approve ${pendingCriteria.length} criteria`, 'warning');
        
        // Reset confirmation state after 5 seconds
        setTimeout(() => {
            if (btn.dataset.confirmClicked) {
                btn.innerHTML = originalContent;
                btn.classList.remove('btn-warning');
                delete btn.dataset.confirmClicked;
            }
        }, 5000);
        
        return;
    }
    
    // Second click: Proceed with approval
    delete btn.dataset.confirmClicked;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Approving...';
    btn.classList.remove('btn-warning');
    
    try {
        // Bulk approve all pending criteria
        const criteriaIds = pendingCriteria.map(c => c.id);
        
        const response = await apiClient.request('/criteria/bulk', {
            method: 'PUT',
            body: JSON.stringify({
                criteria_ids: criteriaIds,
                updates: {
                    status: 'approved',
                    review_notes: 'Bulk approved by user'
                },
                reviewed_by: 'user'
            })
        });
        
        // Update local criteria data
        currentCriteria = currentCriteria.map(criterion => {
            if (criteriaIds.includes(criterion.id)) {
                return { ...criterion, status: 'approved' };
            }
            return criterion;
        });
        
        // Update UI
        updateReviewStepUI();
        
        // Reset button
        btn.innerHTML = '<i class="fas fa-check"></i> All Approved';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-completed');
        
        // Show success notification
        showNotification(`Successfully approved ${response.success_count || criteriaIds.length} criteria!`, 'success');
        
        // Enable next step if all criteria are processed
        checkAndEnableNextStep();
        
    } catch (error) {
        console.error('Failed to approve criteria:', error);
        showNotification('Failed to approve criteria', 'error');
        
        // Reset button
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

function updateReviewStepUI() {
    const reviewCard = document.getElementById('step-review');
    
    // Calculate statistics
    const stats = {
        total: currentCriteria.length,
        approved: currentCriteria.filter(c => c.status === 'approved').length,
        modified: currentCriteria.filter(c => c.status === 'modified').length,
        pending: currentCriteria.filter(c => c.status === 'pending' || c.status === 'extracted').length
    };
    
    // Update statistics display
    const statNumbers = reviewCard.querySelectorAll('.stat-number');
    if (statNumbers[0]) statNumbers[0].textContent = stats.total;
    if (statNumbers[1]) statNumbers[1].textContent = stats.approved;
    if (statNumbers[2]) statNumbers[2].textContent = stats.modified;
    
    // Update collapsed summary
    const collapsedStats = reviewCard.querySelectorAll('.collapsed-stat span');
    if (collapsedStats[0]) collapsedStats[0].textContent = `${stats.approved} approved`;
    if (collapsedStats[1]) collapsedStats[1].textContent = `${stats.modified} modified`;
    
    // Update progress
    const progressFill = reviewCard.querySelector('.progress-fill');
    const progressText = reviewCard.querySelector('.progress-text');
    
    const progressPercent = stats.total > 0 ? ((stats.approved + stats.modified) / stats.total) * 100 : 0;
    
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressText) {
        if (progressPercent === 100) {
            progressText.textContent = 'Review Complete';
        } else {
            progressText.textContent = `${stats.pending} criteria pending review`;
        }
    }
    
    // Check if step should be marked as completed
    if (stats.pending === 0 && stats.total > 0) {
        reviewCard.classList.remove('active');
        reviewCard.classList.add('completed');
        checkAndEnableNextStep();
    }
}

function checkAndEnableNextStep() {
    const stats = {
        total: currentCriteria.length,
        pending: currentCriteria.filter(c => c.status === 'pending' || c.status === 'extracted').length
    };
    
    if (stats.pending === 0 && stats.total > 0) {
        // Enable generate step
        const generateCard = document.getElementById('step-generate');
        const generateBtn = document.getElementById('generate-responses-btn');
        
        if (generateCard) {
            generateCard.classList.remove('disabled');
            generateCard.classList.add('active');
            
            // Update progress text
            const progressText = generateCard.querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = `Ready to generate responses for ${stats.total} criteria`;
            }
        }
        
        // Enable the generate button and set up click handler
        if (generateBtn) {
            generateBtn.classList.remove('btn-disabled');
            generateBtn.removeAttribute('disabled');
            generateBtn.classList.add('btn-primary');
            
            // Set up click handler
            generateBtn.onclick = window.generateAIResponses;
        }
        
        showNotification(`Criteria review complete! Ready to generate AI responses for ${stats.total} criteria.`, 'success');
    }
}

async function generateResponses() {
    try {
        const generateCard = document.getElementById('step-generate');
        updateGenerateProgress(10, 'Starting response generation...');
        
        // In a real implementation, this would call the response generation API
        // For now, we'll simulate the process
        await simulateResponseGeneration();
        
    } catch (error) {
        console.error('Response generation error:', error);
        showNotification('Failed to generate responses', 'error');
    }
}

async function simulateResponseGeneration() {
    const generateCard = document.getElementById('step-generate');
    
    // Simulate response generation progress
    for (let i = 10; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        updateGenerateProgress(i, `Generating responses (${i}%)...`);
    }
    
    updateGenerateProgress(100, 'Response generation complete');
    
    // Update generate step UI
    setTimeout(() => {
        updateGenerateStepUI();
    }, 500);
}

function updateGenerateProgress(percentage, text) {
    const generateCard = document.getElementById('step-generate');
    const progressFill = generateCard.querySelector('.progress-fill');
    const progressText = generateCard.querySelector('.progress-text');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = text;
}

function updateGenerateStepUI() {
    const generateCard = document.getElementById('step-generate');
    
    // Simulate compliance statistics based on criteria
    const totalCriteria = currentCriteria.length;
    const compliant = Math.floor(totalCriteria * 0.7);
    const partial = Math.floor(totalCriteria * 0.2);
    const nonCompliant = Math.floor(totalCriteria * 0.05);
    const pending = totalCriteria - compliant - partial - nonCompliant;
    
    // Update compliance cards
    const complianceCards = generateCard.querySelectorAll('.compliance-card');
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
    const collapsedStats = generateCard.querySelectorAll('.collapsed-stat span');
    if (collapsedStats[0]) collapsedStats[0].textContent = `${compliant} compliant`;
    
    // Mark step as completed
    generateCard.classList.remove('active');
    generateCard.classList.add('completed');
    
    // Enable competitive analysis step
    const competitiveCard = document.getElementById('step-competitive');
    if (competitiveCard) {
        competitiveCard.classList.remove('disabled');
        competitiveCard.classList.add('active');
    }
}

export function getReviewStatus() {
    const stats = {
        total: currentCriteria.length,
        approved: currentCriteria.filter(c => c.status === 'approved').length,
        modified: currentCriteria.filter(c => c.status === 'modified').length,
        pending: currentCriteria.filter(c => c.status === 'pending' || c.status === 'extracted').length
    };
    
    return {
        completed: stats.pending === 0 && stats.total > 0,
        approved: stats.approved,
        modified: stats.modified,
        pending: stats.pending
    };
}

export function getCurrentCriteria() {
    return currentCriteria;
}