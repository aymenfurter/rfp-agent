import { 
    getSearchTerm, 
    getFilterValue, 
    filterTableRows,
    truncateText,
    getScoreDisplay,
    getPositionName,
    getPositionIcon 
} from '../utils/helpers.js';
import { initializeCharts } from '../utils/charts.js';

export function showCompetitiveTable() {
    const modal = document.getElementById('competitive-modal');
    if (modal) {
        populateCompetitiveTable();
        setupCompetitiveEventListeners();
        
        // Initialize charts with real data only if we have analysis results
        if (window.competitiveAnalysisResults && window.competitiveAnalysisResults.length > 0) {
            setTimeout(() => {
                populateCompetitiveCharts();
            }, 100);
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

export function hideCompetitiveTable() {
    const modal = document.getElementById('competitive-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function populateCompetitiveTable() {
    const tbody = document.getElementById('competitive-table-body');
    if (!tbody) return;

    // Get competitive analysis results from the global scope or competitive step
    const competitiveAnalysisResults = window.competitiveAnalysisResults || [];

    if (competitiveAnalysisResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-foreground-600">No competitive analysis data available</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = competitiveAnalysisResults.map(item => `
        <tr>
            <td>${truncateText(item.criterionText, 50)}</td>
            <td>${truncateText(item.yourProduct?.summary || 'No response available', 60)}</td>
            <td><span class="score-badge ${item.yourProduct.score}">${getScoreDisplay(item.yourProduct.score)}</span></td>
            <td>${item.competitor?.name || ''}</td>
            <td><span class="score-badge ${item.competitor.score}">${getScoreDisplay(item.competitor.score)}</span></td>
            <td><span class="position-badge ${item.advantage?.replace('_', '-')}">
                <i class="fas ${getPositionIcon(item.advantage)}"></i>
                ${getPositionName(item.advantage)}
            </span></td>
            <td><span class="recommendation-text ${item.advantage === 'advantage' ? 'highlight' : ''}">${item.recommendation}</span></td>
        </tr>
    `).join('');
}

function setupCompetitiveEventListeners() {
    // Search and filter handlers
    const searchInput = document.getElementById('competitive-search');
    const advantageFilter = document.getElementById('advantage-filter');
    const competitorFilter = document.getElementById('competitor-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCompetitiveTable);
    }
    
    if (advantageFilter) {
        advantageFilter.addEventListener('change', filterCompetitiveTable);
    }
    
    if (competitorFilter) {
        competitorFilter.addEventListener('change', filterCompetitiveTable);
    }
    
    // Populate competitor filter with actual competitors
    populateCompetitorFilter();
}

function populateCompetitorFilter() {
    const competitorFilter = document.getElementById('competitor-filter');
    if (!competitorFilter) return;
    
    // Clear existing options except "All Competitors"
    competitorFilter.innerHTML = '<option value="">All Competitors</option>';
    
    // Get competitive analysis results
    const competitiveAnalysisResults = window.competitiveAnalysisResults || [];
    
    // Add options for actual competitors from analysis results
    const uniqueCompetitors = new Set();
    competitiveAnalysisResults.forEach(result => {
        if (result.competitor && result.competitor.name) {
            uniqueCompetitors.add(result.competitor.name);
        }
    });
    
    // Sort competitors alphabetically and add to filter
    Array.from(uniqueCompetitors).sort().forEach(competitorName => {
        const option = document.createElement('option');
        option.value = competitorName.toLowerCase();
        option.textContent = competitorName;
        competitorFilter.appendChild(option);
    });
}

function filterCompetitiveTable() {
    const searchTerm = document.getElementById('competitive-search')?.value.toLowerCase() || '';
    const advantageFilter = document.getElementById('advantage-filter')?.value || '';
    const competitorFilter = document.getElementById('competitor-filter')?.value || '';
    
    const rows = document.querySelectorAll('#competitive-table-body tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return; // Skip header or empty rows
        
        const criterionText = cells[0]?.textContent.toLowerCase() || '';
        const responseText = cells[1]?.textContent.toLowerCase() || '';
        const competitorName = cells[3]?.textContent.toLowerCase() || '';
        const positionBadge = cells[5]?.querySelector('.position-badge');
        const positionClass = positionBadge?.classList[1] || '';
        
        const matchesSearch = searchTerm === '' || 
            criterionText.includes(searchTerm) || 
            responseText.includes(searchTerm);
            
        const matchesAdvantage = advantageFilter === '' || 
            positionClass === advantageFilter;
            
        const matchesCompetitor = competitorFilter === '' ||
            competitorName.includes(competitorFilter);
        
        row.style.display = matchesSearch && matchesAdvantage && matchesCompetitor ? '' : 'none';
    });
}

// Make functions globally available
window.showCompetitiveTable = showCompetitiveTable;
window.hideCompetitiveTable = hideCompetitiveTable;

export function initializeCompetitiveModal() {
    setupCompetitiveFilters();
}

function setupCompetitiveFilters() {
    const searchInput = document.getElementById('competitive-search');
    const advantageFilter = document.getElementById('advantage-filter');
    const competitorFilter = document.getElementById('competitor-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCompetitiveTable);
    }
    
    if (advantageFilter) {
        advantageFilter.addEventListener('change', filterCompetitiveTable);
    }
    
    if (competitorFilter) {
        competitorFilter.addEventListener('change', filterCompetitiveTable);
    }
}

function populateCompetitiveCharts() {
    // Get competitive analysis results
    const competitiveAnalysisResults = window.competitiveAnalysisResults || [];
    
    // Only populate if we have real analysis data
    if (competitiveAnalysisResults.length === 0) {
        console.warn('No competitive analysis data available for charts');
        return;
    }
    
    // Prepare data for charts based on real analysis
    const chartData = prepareChartData(competitiveAnalysisResults);
    
    // Initialize compliance comparison chart
    initializeComplianceChart(chartData.complianceData);
    
    // Initialize category comparison chart
    initializeCategoryChart(chartData.categoryData);
    
    // Setup competitor selection
    setupCompetitorSelection();
}

function prepareChartData(competitiveAnalysisResults) {
    const productName = window.currentProductName || 'Your Product';
    
    // Calculate actual compliance scores from analysis results
    const yourOverallScore = calculateOverallComplianceScore('your', competitiveAnalysisResults);
    
    // Get unique competitors and their scores
    const competitorScores = {};
    const uniqueCompetitors = new Set();
    
    competitiveAnalysisResults.forEach(result => {
        if (result.competitor && result.competitor.name) {
            uniqueCompetitors.add(result.competitor.name);
        }
    });
    
    // Calculate scores for each competitor
    uniqueCompetitors.forEach(competitorName => {
        competitorScores[competitorName] = calculateOverallComplianceScore(competitorName, competitiveAnalysisResults);
    });
    
    // Prepare compliance comparison data
    const complianceData = {
        labels: [productName, ...Array.from(uniqueCompetitors)],
        scores: [yourOverallScore, ...Object.values(competitorScores)]
    };
    
    // Calculate category-wise scores based on actual data
    const categories = getCategoriesFromAnalysis(competitiveAnalysisResults);
    const categoryData = {
        labels: categories,
        yourCompliance: categories.map(cat => calculateCategoryComplianceCount('your', cat, competitiveAnalysisResults)),
        competitorCompliance: categories.map(cat => calculateAverageCompetitorComplianceCount(cat, competitiveAnalysisResults)),
        totals: categories.map(cat => getCategoryTotalCount(cat, competitiveAnalysisResults)),
        competitorLabel: 'Average Competitors'
    };
    
    return { complianceData, categoryData };
}

function initializeComplianceChart(data) {
    const ctx = document.getElementById('complianceChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.complianceChartInstance) {
        window.complianceChartInstance.destroy();
    }
    
    window.complianceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Compliance Score (%)',
                data: data.scores,
                backgroundColor: [
                    'rgba(80, 80, 168, 0.8)',      // Your product (accent color)
                    'rgba(255, 159, 10, 0.8)',     // Competitor 1
                    'rgba(52, 199, 89, 0.8)',      // Competitor 2
                    'rgba(255, 69, 58, 0.8)',      // Additional competitors
                    'rgba(64, 166, 255, 0.8)',
                    'rgba(174, 174, 178, 0.8)'
                ],
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#666',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#666',
                        maxRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initializeCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.categoryChartInstance) {
        window.categoryChartInstance.destroy();
    }
    
    const productName = window.currentProductName || 'Your Product';
    
    // Convert counts to percentages for accurate visual representation
    const yourPercentages = data.yourCompliance.map((count, index) => {
        const total = data.totals[index];
        return total > 0 ? Math.round((count / total) * 100) : 0;
    });
    
    const competitorPercentages = data.competitorCompliance.map((count, index) => {
        const total = data.totals[index];
        return total > 0 ? Math.round((count / total) * 100) : 0;
    });
    
    window.categoryChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: data.labels,
            datasets: [{
                label: productName,
                data: yourPercentages,
                borderColor: 'rgba(80, 80, 168, 1)',
                backgroundColor: 'rgba(80, 80, 168, 0.2)',
                pointBackgroundColor: 'rgba(80, 80, 168, 1)',
                pointBorderColor: '#fff',
                pointRadius: 6,
                borderWidth: 3
            }, {
                label: data.competitorLabel,
                data: competitorPercentages,
                borderColor: 'rgba(255, 159, 10, 1)',
                backgroundColor: 'rgba(255, 159, 10, 0.2)',
                pointBackgroundColor: 'rgba(255, 159, 10, 1)',
                pointBorderColor: '#fff',
                pointRadius: 6,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#666',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const categoryIndex = context.dataIndex;
                            const count = context.dataset.label === productName ? 
                                data.yourCompliance[categoryIndex] : 
                                data.competitorCompliance[categoryIndex];
                            const total = data.totals[categoryIndex];
                            const percentage = context.parsed.r;
                            return `${context.dataset.label}: ${count}/${total} (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#666',
                        stepSize: 20,
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.2)'
                    },
                    angleLines: {
                        color: 'rgba(0, 0, 0, 0.2)'
                    },
                    pointLabels: {
                        color: '#666',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function getCategoriesFromAnalysis(competitiveAnalysisResults) {
    const categories = new Set();
    
    // Get categories from the actual criteria data
    const validatedCriteria = window.validatedCriteria || [];
    const criteriaMap = {};
    
    // Build a map of criterion text to category using the actual API response data
    validatedCriteria.forEach(criterion => {
        if (criterion.criterion_text && criterion.category) {
            criteriaMap[criterion.criterion_text] = criterion.category;
        }
    });
    
    competitiveAnalysisResults.forEach(result => {
        // First, try to get the category from the actual criterion data
        if (criteriaMap[result.criterionText]) {
            const category = criteriaMap[result.criterionText];
            // Normalize category names for display
            const displayCategory = formatCategoryName(category);
            categories.add(displayCategory);
        } else {
            // Fallback to General if no category found
            categories.add('General Requirements');
        }
    });
    
    return Array.from(categories).sort();
}

function getCategoryResults(category, competitiveResults) {
    // Get the actual criteria data to match categories properly
    const validatedCriteria = window.validatedCriteria || [];
    const criteriaMap = {};
    
    // Build a map of criterion text to category using the actual API response data
    validatedCriteria.forEach(criterion => {
        if (criterion.criterion_text && criterion.category) {
            criteriaMap[criterion.criterion_text] = criterion.category;
        }
    });
    
    return competitiveResults.filter(r => {
        // Get the actual category from the criteria data
        const actualCategory = criteriaMap[r.criterionText];
        if (actualCategory) {
            const displayCategory = formatCategoryName(actualCategory);
            return displayCategory === category;
        }
        
        // Fallback for items without category mapping
        return category === 'General Requirements';
    });
}

function formatCategoryName(category) {
    // Map API category values to display names
    const categoryMap = {
        'technical': 'Technical Requirements',
        'security': 'Security & Compliance',
        'performance': 'Performance & Scalability',
        'support': 'Support & Maintenance',
        'compliance': 'Security & Compliance',
        'integration': 'Integration & Compatibility',
        'financial': 'Financial',
        'other': 'General Requirements'
    };
    
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function setupCompetitorSelection() {
    const competitorSelect = document.getElementById('chart-competitor-select');
    if (!competitorSelect) return;
    
    // Clear existing options except average
    competitorSelect.innerHTML = '<option value="average">Average Competitors</option>';
    
    // Get unique competitors from analysis results
    const uniqueCompetitors = new Set();
    const competitiveResults = window.competitiveAnalysisResults || [];
    
    competitiveResults.forEach(result => {
        if (result.competitor && result.competitor.name) {
            uniqueCompetitors.add(result.competitor.name);
        }
    });
    
    // Add competitor options
    Array.from(uniqueCompetitors).sort().forEach(competitorName => {
        const option = document.createElement('option');
        option.value = competitorName;
        option.textContent = competitorName;
        competitorSelect.appendChild(option);
    });
    
    // Add event listener for selection change
    competitorSelect.addEventListener('change', (e) => {
        const selectedCompetitor = e.target.value;
        updateCategoryChart(selectedCompetitor);
        updateSideBySideComparison(selectedCompetitor);
    });
}

function updateCategoryChart(selectedCompetitor) {
    const competitiveResults = window.competitiveAnalysisResults || [];
    const categories = getCategoriesFromAnalysis(competitiveResults);
    
    const yourCounts = categories.map(cat => calculateCategoryComplianceCount('your', cat, competitiveResults));
    const competitorCounts = categories.map(cat => {
        if (selectedCompetitor === 'average') {
            return calculateAverageCompetitorComplianceCount(cat, competitiveResults);
        } else {
            return calculateCategoryComplianceCount(selectedCompetitor, cat, competitiveResults);
        }
    });
    const totals = categories.map(cat => getCategoryTotalCount(cat, competitiveResults));
    
    // Convert to percentages
    const yourPercentages = yourCounts.map((count, index) => {
        const total = totals[index];
        return total > 0 ? Math.round((count / total) * 100) : 0;
    });
    
    const competitorPercentages = competitorCounts.map((count, index) => {
        const total = totals[index];
        return total > 0 ? Math.round((count / total) * 100) : 0;
    });
    
    const chartData = {
        labels: categories,
        yourCompliance: yourCounts,
        competitorCompliance: competitorCounts,
        totals: totals,
        competitorLabel: selectedCompetitor === 'average' ? 'Average Competitors' : selectedCompetitor
    };
    
    if (window.categoryChartInstance) {
        // Update chart data with percentages for display but keep original counts for tooltips
        window.categoryChartInstance.data.datasets[0].data = yourPercentages;
        window.categoryChartInstance.data.datasets[1].label = chartData.competitorLabel;
        window.categoryChartInstance.data.datasets[1].data = competitorPercentages;
        
        // Update tooltip data reference
        window.categoryChartInstance.config.options.plugins.tooltip.callbacks.label = function(context) {
            const categoryIndex = context.dataIndex;
            const count = context.dataset.label === (window.currentProductName || 'Your Product') ? 
                chartData.yourCompliance[categoryIndex] : 
                chartData.competitorCompliance[categoryIndex];
            const total = chartData.totals[categoryIndex];
            const percentage = context.parsed.r;
            return `${context.dataset.label}: ${count}/${total} (${percentage}%)`;
        };
        
        window.categoryChartInstance.update();
    }
}

function updateSideBySideComparison(selectedCompetitor) {
    const comparisonSection = document.getElementById('side-by-side-comparison');
    const selectedCompetitorName = document.getElementById('selected-competitor-name');
    const comparisonGrid = document.getElementById('comparison-grid');
    
    if (selectedCompetitor === 'average') {
        if (comparisonSection) comparisonSection.style.display = 'none';
        return;
    }
    
    if (!comparisonSection || !selectedCompetitorName || !comparisonGrid) return;
    
    // Show comparison section
    comparisonSection.style.display = 'block';
    selectedCompetitorName.textContent = selectedCompetitor;
    
    // Filter results for selected competitor
    const competitiveResults = window.competitiveAnalysisResults || [];
    const competitorResults = competitiveResults.filter(result => 
        result.competitor && result.competitor.name === selectedCompetitor
    );
    
    if (competitorResults.length === 0) {
        comparisonGrid.innerHTML = '<div class="text-center py-8">No data available for this competitor</div>';
        return;
    }
    
    // Populate comparison grid
    comparisonGrid.innerHTML = competitorResults.map(result => {
        const yourStatus = getComplianceStatus(result.yourProduct.isMet);
        const competitorStatus = getComplianceStatus(result.competitor.isMet);
        
        return `
            <div class="comparison-item">
                <div class="comparison-criterion">${result.criterionText}</div>
                <div class="comparison-response" title="Your response">
                    ${truncateText(result.yourProduct.summary || 'No response', 100)}
                </div>
                <div class="comparison-status ${yourStatus.class}">
                    <i class="fas ${yourStatus.icon}"></i>
                    <span>${yourStatus.text}</span>
                </div>
                <div class="comparison-response" title="${selectedCompetitor} likely response">
                    ${truncateText(result.competitor.summary || 'No response', 100)}
                </div>
                <div class="comparison-status ${competitorStatus.class}">
                    <i class="fas ${competitorStatus.icon}"></i>
                    <span>${competitorStatus.text}</span>
                </div>
                <div class="comparison-advantage ${result.advantage}">
                    <i class="fas ${getAdvantageIcon(result.advantage)}"></i>
                    <span>${getAdvantageText(result.advantage)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Helper functions for calculations
function calculateOverallComplianceScore(entity, competitiveResults) {
    if (entity === 'your') {
        const yourResults = competitiveResults.filter(r => r.yourProduct);
        if (yourResults.length === 0) return 0;
        
        const totalScore = yourResults.reduce((sum, result) => {
            return sum + (result.yourProduct.isMet === true ? 100 : 
                         result.yourProduct.isMet === false ? 0 : 50);
        }, 0);
        
        return Math.round(totalScore / yourResults.length);
    } else {
        const competitorResults = competitiveResults.filter(r => 
            r.competitor && r.competitor.name === entity
        );
        if (competitorResults.length === 0) return 0;
        
        const totalScore = competitorResults.reduce((sum, result) => {
            return sum + (result.competitor.isMet === true ? 100 : 
                         result.competitor.isMet === false ? 0 : 50);
        }, 0);
        
        return Math.round(totalScore / competitorResults.length);
    }
}

function calculateCategoryComplianceCount(entity, category, competitiveResults) {
    const categoryResults = getCategoryResults(category, competitiveResults);
    
    if (entity === 'your') {
        return categoryResults.filter(r => r.yourProduct.isMet === true).length;
    } else {
        return categoryResults.filter(r => 
            r.competitor && r.competitor.name === entity && r.competitor.isMet === true
        ).length;
    }
}

function calculateAverageCompetitorComplianceCount(category, competitiveResults) {
    const categoryResults = getCategoryResults(category, competitiveResults);
    const competitorCounts = {};
    
    categoryResults.forEach(result => {
        if (result.competitor && result.competitor.name) {
            const compName = result.competitor.name;
            if (!competitorCounts[compName]) {
                competitorCounts[compName] = { compliant: 0, total: 0 };
            }
            competitorCounts[compName].total++;
            if (result.competitor.isMet === true) {
                competitorCounts[compName].compliant++;
            }
        }
    });
    
    const competitorRates = Object.values(competitorCounts).map(c => 
        c.total > 0 ? c.compliant / c.total : 0
    );
    
    if (competitorRates.length === 0) return 0;
    
    const avgRate = competitorRates.reduce((sum, rate) => sum + rate, 0) / competitorRates.length;
    return Math.round(avgRate * categoryResults.length);
}

function getCategoryTotalCount(category, competitiveResults) {
    return getCategoryResults(category, competitiveResults).length;
}

function getComplianceStatus(isMet) {
    if (isMet === true) {
        return { class: 'compliant', icon: 'fa-check-circle', text: 'Yes' };
    } else if (isMet === false) {
        return { class: 'non-compliant', icon: 'fa-times-circle', text: 'No' };
    } else {
        return { class: 'partial', icon: 'fa-question-circle', text: 'Unknown' };
    }
}

function getAdvantageIcon(advantage) {
    const icons = {
        'advantage': 'fa-trophy',
        'competitive': 'fa-balance-scale',
        'needs_improvement': 'fa-arrow-up'
    };
    return icons[advantage] || 'fa-question';
}

function getAdvantageText(advantage) {
    const texts = {
        'advantage': 'Advantage',
        'competitive': 'Equal',
        'needs_improvement': 'Behind'
    };
    return texts[advantage] || 'Unknown';
}

function prepareCategoryChartData(selectedCompetitor = 'average') {
    const categories = getCategoriesFromAnalysis(competitiveAnalysisResults);
    const productName = window.currentProductName || 'Your Product';
    
    const yourCompliance = [];
    const competitorCompliance = [];
    const totals = [];
    
    categories.forEach(category => {
        const categoryResults = getCategoryResults(category, competitiveAnalysisResults);
        
        // Count your compliant results
        const yourCompliantCount = categoryResults.filter(r => r.yourProduct.isMet === true).length;
        
        // Count competitor compliant results
        let competitorCompliantCount;
        if (selectedCompetitor === 'average') {
            // Calculate average compliance across all competitors
            const competitorCounts = {};
            categoryResults.forEach(result => {
                const compName = result.competitor.name;
                if (!competitorCounts[compName]) {
                    competitorCounts[compName] = { compliant: 0, total: 0 };
                }
                competitorCounts[compName].total++;
                if (result.competitor.isMet === true) {
                    competitorCounts[compName].compliant++;
                }
            });
            
            // Average compliance rate
            const competitorRates = Object.values(competitorCounts).map(c => 
                c.total > 0 ? c.compliant / c.total : 0
            );
            const avgRate = competitorRates.length > 0 ? 
                competitorRates.reduce((sum, rate) => sum + rate, 0) / competitorRates.length : 0;
            competitorCompliantCount = Math.round(avgRate * categoryResults.length);
        } else {
            // Count for specific competitor
            competitorCompliantCount = categoryResults.filter(r => 
                r.competitor.name === selectedCompetitor && r.competitor.isMet === true
            ).length;
        }
        
        yourCompliance.push(yourCompliantCount);
        competitorCompliance.push(competitorCompliantCount);
        totals.push(categoryResults.length);
    });
    
    return {
        labels: categories,
        yourCompliance,
        competitorCompliance,
        totals,
        competitorLabel: selectedCompetitor === 'average' ? 'Average Competitors' : selectedCompetitor
    };
}