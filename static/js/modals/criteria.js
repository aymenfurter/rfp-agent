import { apiClient } from '../utils/api.js';
import { 
    getSearchTerm, 
    getFilterValue, 
    filterTableRows,
    getCategoryName,
    getStatusName 
} from '../utils/helpers.js';
import { showNotification } from '../utils/notifications.js';
import { getCurrentCriteria } from '../steps/review.js';

let currentCriteriaData = [];

export function showCriteriaTable() {
    const modal = document.getElementById('criteria-modal');
    if (modal) {
        // Get criteria from review step
        const reviewCriteria = getCurrentCriteria();
        if (reviewCriteria && reviewCriteria.length > 0) {
            currentCriteriaData = reviewCriteria;
            populateCriteriaTable();
        } else {
            // If no criteria in review step, try to load from API
            loadAndPopulateCriteriaTable();
        }
        setupCriteriaEventListeners();
        modal.classList.add('show');
    }
}

export function hideCriteriaTable() {
    const modal = document.getElementById('criteria-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function loadAndPopulateCriteriaTable() {
    try {
        const tbody = document.getElementById('criteria-table-body');
        if (!tbody) return;

        // Show loading state
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8">Loading criteria...</td></tr>';

        // Load criteria data from API
        const response = await apiClient.request('/criteria?limit=1000');
        
        if (response.criteria) {
            currentCriteriaData = response.criteria;
            populateCriteriaTable();
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8">No criteria found</td></tr>';
        }
        
    } catch (error) {
        console.error('Failed to load criteria:', error);
        const tbody = document.getElementById('criteria-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-error-600">Failed to load criteria</td></tr>';
        }
        showNotification('Failed to load criteria data', 'error');
    }
}

function populateCriteriaTable() {
    const tbody = document.getElementById('criteria-table-body');
    if (!tbody) return;

    if (currentCriteriaData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8">No criteria found</td></tr>';
        return;
    }

    tbody.innerHTML = currentCriteriaData.map(item => `
        <tr data-criterion-id="${item.id}">
            <td><span class="criterion-id">${item.id.substring(0, 8)}</span></td>
            <td><span class="category-badge ${item.category}">${getCategoryName(item.category)}</span></td>
            <td class="criterion-text-cell">
                <div class="criterion-text" title="${escapeHtml(item.criterion_text)}">
                    ${truncateText(item.criterion_text, 100)}
                </div>
            </td>
            <td>${item.source_reference || 'Unknown'}</td>
            <td><span class="status-badge ${item.status}">${getStatusName(item.status)}</span></td>
            <td>
                <div class="table-actions">
                    <button class="action-btn" onclick="editCriterion('${item.id}')">Edit</button>
                    <button class="action-btn primary" onclick="approveCriterion('${item.id}')" 
                            ${item.status === 'approved' ? 'disabled' : ''}>
                        ${item.status === 'approved' ? 'Approved' : 'Approve'}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupCriteriaEventListeners() {
    // Search and filter handlers
    const searchInput = document.getElementById('criteria-search');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCriteriaTable);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterCriteriaTable);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', filterCriteriaTable);
    }

    // Make functions globally available for onclick handlers
    window.editCriterion = editCriterion;
    window.approveCriterion = approveCriterion;
}

function filterCriteriaTable() {
    const searchTerm = getSearchTerm('criteria-search');
    const categoryFilter = getFilterValue('category-filter');
    const statusFilter = getFilterValue('status-filter');
    
    filterTableRows('#criteria-table-body tr', (row) => {
        if (!row.cells || row.cells.length < 5) return true;
        
        const criterion = row.cells[2].textContent.toLowerCase();
        const category = row.cells[1].textContent.toLowerCase();
        const status = row.cells[4].textContent.toLowerCase();
        
        return criterion.includes(searchTerm) &&
               (!categoryFilter || category.includes(categoryFilter)) &&
               (!statusFilter || status.includes(statusFilter));
    });
}

async function editCriterion(criterionId) {
    try {
        const criterion = currentCriteriaData.find(c => c.id === criterionId);
        if (!criterion) {
            showNotification('Criterion not found', 'error');
            return;
        }

        // Create an inline edit interface instead of using prompt
        const row = document.querySelector(`tr[data-criterion-id="${criterionId}"]`);
        const textCell = row.querySelector('.criterion-text-cell');
        const originalText = criterion.criterion_text;
        
        // Replace cell content with editable textarea
        textCell.innerHTML = `
            <div class="inline-edit">
                <textarea class="edit-textarea" style="width: 100%; min-height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">${originalText}</textarea>
                <div class="edit-actions" style="margin-top: 8px;">
                    <button class="btn btn-sm btn-primary save-edit">Save</button>
                    <button class="btn btn-sm btn-secondary cancel-edit">Cancel</button>
                </div>
            </div>
        `;
        
        const textarea = textCell.querySelector('.edit-textarea');
        const saveBtn = textCell.querySelector('.save-edit');
        const cancelBtn = textCell.querySelector('.cancel-edit');
        
        // Focus on textarea
        textarea.focus();
        textarea.select();
        
        // Save handler
        saveBtn.addEventListener('click', async () => {
            const newText = textarea.value.trim();
            if (newText && newText !== originalText) {
                try {
                    saveBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i>';
                    saveBtn.disabled = true;
                    
                    // Update via API
                    const response = await apiClient.request(`/criteria/${criterionId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            criterion_text: newText,
                            status: 'modified'
                        })
                    });

                    // Update local data
                    const index = currentCriteriaData.findIndex(c => c.id === criterionId);
                    if (index !== -1) {
                        currentCriteriaData[index] = response;
                        populateCriteriaTable();
                    }

                    showNotification('Criterion updated successfully', 'success');
                } catch (error) {
                    console.error('Failed to update criterion:', error);
                    showNotification('Failed to update criterion', 'error');
                    
                    // Restore original content
                    textCell.innerHTML = `
                        <div class="criterion-text" title="${escapeHtml(originalText)}">
                            ${truncateText(originalText, 100)}
                        </div>
                    `;
                }
            } else {
                // No changes, just restore
                textCell.innerHTML = `
                    <div class="criterion-text" title="${escapeHtml(originalText)}">
                        ${truncateText(originalText, 100)}
                    </div>
                `;
            }
        });
        
        // Cancel handler
        cancelBtn.addEventListener('click', () => {
            textCell.innerHTML = `
                <div class="criterion-text" title="${escapeHtml(originalText)}">
                    ${truncateText(originalText, 100)}
                </div>
            `;
        });
        
        // Handle Enter key to save, Escape to cancel
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                saveBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

    } catch (error) {
        console.error('Failed to setup edit mode:', error);
        showNotification('Failed to edit criterion', 'error');
    }
}

async function approveCriterion(criterionId) {
    try {
        // Update via API
        const response = await apiClient.request(`/criteria/${criterionId}/approve`, {
            method: 'POST'
        });

        // Update local data
        const index = currentCriteriaData.findIndex(c => c.id === criterionId);
        if (index !== -1) {
            currentCriteriaData[index] = response;
            populateCriteriaTable();
        }

        showNotification('Criterion approved successfully', 'success');

    } catch (error) {
        console.error('Failed to approve criterion:', error);
        showNotification('Failed to approve criterion', 'error');
    }
}

// Make functions globally available
window.showCriteriaTable = showCriteriaTable;
window.hideCriteriaTable = hideCriteriaTable;

export function initializeCriteriaModal() {
    // Initialize criteria modal functionality
    console.log('Criteria modal initialized');
}
