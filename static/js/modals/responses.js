import { mockData } from '../data/mock.js';
import { 
    getSearchTerm, 
    getFilterValue, 
    filterTableRows,
    truncateText,
    getComplianceName,
    getComplianceIcon,
    getConfidencePercent 
} from '../utils/helpers.js';

export function showResponsesTable() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        populateResponsesTable();
        setupResponsesEventListeners();
        modal.classList.add('show');
    }
}

export function hideResponsesTable() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function populateResponsesTable() {
    const tbody = document.getElementById('responses-table-body');
    if (!tbody) return;

    tbody.innerHTML = mockData.responses.map(item => `
        <tr>
            <td><span class="criterion-id">${item.id}</span></td>
            <td>${truncateText(item.criterion, 60)}</td>
            <td><span class="compliance-badge ${item.compliance}">
                <i class="fas ${getComplianceIcon(item.compliance)}"></i>
                ${getComplianceName(item.compliance)}
            </span></td>
            <td>${truncateText(item.response, 80)}</td>
            <td>${item.references}</td>
            <td><span class="confidence-score ${item.confidence}">${getConfidencePercent(item.confidence)}</span></td>
            <td>
                <div class="table-actions">
                    <button class="action-btn">Edit</button>
                    <button class="action-btn primary">Approve</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setupResponsesEventListeners() {
    // Search and filter handlers
    const searchInput = document.getElementById('responses-search');
    const complianceFilter = document.getElementById('compliance-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterResponsesTable);
    }
    
    if (complianceFilter) {
        complianceFilter.addEventListener('change', filterResponsesTable);
    }
}

function filterResponsesTable() {
    const searchTerm = document.getElementById('responses-search')?.value.toLowerCase() || '';
    const complianceFilter = document.getElementById('compliance-filter')?.value || '';
    
    const rows = document.querySelectorAll('#responses-table-body tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return; // Skip header or empty rows
        
        const criterionText = cells[1]?.textContent.toLowerCase() || '';
        const responseText = cells[3]?.textContent.toLowerCase() || '';
        const complianceStatus = cells[2]?.querySelector('.status-badge')?.classList[1] || '';
        
        const matchesSearch = searchTerm === '' || 
            criterionText.includes(searchTerm) || 
            responseText.includes(searchTerm);
            
        const matchesCompliance = complianceFilter === '' || 
            complianceStatus === complianceFilter;
        
        row.style.display = matchesSearch && matchesCompliance ? '' : 'none';
    });
}

// Make functions globally available
window.showResponsesTable = function() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        // Import and call the populate function from generate.js
        if (window.populateResponsesTable) {
            window.populateResponsesTable();
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
};

window.hideResponsesTable = function() {
    const modal = document.getElementById('responses-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

export function initializeResponsesModal() {
    // Set up search and filter functionality
    setupResponsesFilters();
}

function setupResponsesFilters() {
    const searchInput = document.getElementById('responses-search');
    const complianceFilter = document.getElementById('compliance-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterResponsesTable);
    }
    
    if (complianceFilter) {
        complianceFilter.addEventListener('change', filterResponsesTable);
    }
}
