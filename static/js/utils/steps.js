export function initializeStepManagement() {
    // Make functions globally available
    window.toggleStep = toggleStep;
    window.expandAllSteps = expandAllSteps;
    window.collapseAllCompletedSteps = collapseAllCompletedSteps;
}

export function toggleStep(stepId) {
    const step = document.getElementById(stepId);
    if (!step) return;
    
    const content = step.querySelector('.step-content');
    const toggle = step.querySelector('.step-toggle i');
    
    if (content && toggle) {
        const isExpanded = content.style.display !== 'none';
        
        content.style.display = isExpanded ? 'none' : 'block';
        toggle.style.transform = isExpanded ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

export function expandAllSteps() {
    document.querySelectorAll('.step-card').forEach(step => {
        const content = step.querySelector('.step-content');
        const toggle = step.querySelector('.step-toggle i');
        
        if (content && toggle) {
            content.style.display = 'block';
            toggle.style.transform = 'rotate(0deg)';
        }
    });
}

export function collapseAllCompletedSteps() {
    document.querySelectorAll('.step-card.completed').forEach(step => {
        const content = step.querySelector('.step-content');
        const toggle = step.querySelector('.step-toggle i');
        
        if (content && toggle) {
            content.style.display = 'none';
            toggle.style.transform = 'rotate(-90deg)';
        }
    });
}

export function activateStep(stepId) {
    document.querySelectorAll('.step-card').forEach(card => {
        card.classList.remove('active');
    });
    
    const targetStep = document.getElementById(stepId);
    if (targetStep) {
        targetStep.classList.remove('disabled');
        targetStep.classList.add('active');
    }
}

export function completeStep(stepId) {
    const step = document.getElementById(stepId);
    if (step) {
        step.classList.remove('active', 'disabled');
        step.classList.add('completed');
        
        // Update progress to 100%
        const progressFill = step.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = '100%';
        }
        
        // Update progress text to indicate completion
        const progressText = step.querySelector('.progress-text');
        if (progressText && !progressText.textContent.includes('complete')) {
            progressText.textContent = progressText.textContent.replace('Ready', 'Complete') || 'Complete';
        }
    }
}

// Add helper function to mark step as completed with custom message
export function completeStepWithMessage(stepId, message) {
    const step = document.getElementById(stepId);
    if (step) {
        step.classList.remove('active', 'disabled');
        step.classList.add('completed');
        
        // Update progress to 100%
        const progressFill = step.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = '100%';
        }
        
        // Update progress text with custom message
        const progressText = step.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = message;
        }
    }
}

// Make functions globally available
window.completeStep = completeStep;
window.completeStepWithMessage = completeStepWithMessage;
