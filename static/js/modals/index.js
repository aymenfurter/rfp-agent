import { initializeCriteriaModal } from './criteria.js';
import { initializeResponsesModal } from './responses.js';
import { initializeCompetitiveModal } from './competitive.js';
import { initializeLogsModal } from './logs.js';

export function initializeModals() {
    initializeCriteriaModal();
    initializeResponsesModal();
    initializeCompetitiveModal();
    initializeLogsModal();
    
    // Global modal event listeners
    document.addEventListener('hideAllModals', hideAllModals);
}

function hideAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    });
}
