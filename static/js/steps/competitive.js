import { showNotification } from '../utils/notifications.js';
import { apiClient } from '../utils/api.js';
import { competitiveStorage } from '../utils/storage.js';

let competitors = [];
let competitiveAnalysisResults = [];
let currentAnalysisId = null;

export function initializeCompetitiveStep() {
    // Initialize local functions first
    setupCompetitiveEventListeners();
    
    // Update product name when it changes
    updateCompetitiveProductName();
    
    // Listen for product name changes
    document.addEventListener('productNameChanged', updateCompetitiveProductName);
    
    // Initialize analysis history UI (this will define the functions)
    initializeAnalysisHistory();
    
    // Update the global history button
    updateGlobalAnalysisHistoryButton();
    
    // Make functions globally available AFTER they are defined
    window.showCompetitiveTable = showCompetitiveTable;
    window.hideCompetitiveTable = hideCompetitiveTable;
    window.addCompetitor = addCompetitor;
    window.removeCompetitor = removeCompetitor;
    window.saveCompetitor = saveCompetitor;
    window.hideAddCompetitorModal = hideAddCompetitorModal;
    window.runCompetitiveAnalysis = runCompetitiveAnalysis;
    window.saveCurrentAnalysis = saveCurrentAnalysis;
    window.loadPreviousAnalysis = loadPreviousAnalysis;
    window.showAnalysisHistory = showAnalysisHistory;
    window.deleteStoredAnalysis = deleteStoredAnalysis;
    window.exportStoredAnalysis = exportStoredAnalysis;
    window.importAnalysisFile = importAnalysisFile;
    window.clearAllAnalyses = clearAllAnalyses;
    window.populateAnalysisHistory = populateAnalysisHistory;
    window.hideAnalysisHistory = hideAnalysisHistory;
}

function setupCompetitiveEventListeners() {
    // Set up modal backdrop clicks
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') && e.target.id === 'add-competitor-modal') {
            hideAddCompetitorModal();
        }
    });
}

function updateCompetitiveProductName() {
    const productName = window.currentProductName || 'Your Solution';
    const competitiveProductNameElement = document.getElementById('competitive-product-name');
    
    if (competitiveProductNameElement) {
        competitiveProductNameElement.textContent = productName;
    }
}

function addCompetitor() {
    if (competitors.length >= 2) {
        showNotification('Maximum of 2 competitors allowed', 'warning');
        return;
    }
    
    const modal = document.getElementById('add-competitor-modal');
    if (modal) {
        // Clear previous input
        document.getElementById('competitor-name').value = '';
        document.getElementById('competitor-description').value = '';
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        
        // Focus on name input
        document.getElementById('competitor-name').focus();
    }
}

function hideAddCompetitorModal() {
    const modal = document.getElementById('add-competitor-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function saveCompetitor() {
    const nameInput = document.getElementById('competitor-name');
    const descriptionInput = document.getElementById('competitor-description');
    
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    
    if (!name) {
        showNotification('Please enter a competitor name', 'error');
        return;
    }
    
    if (name.length > 200) {
        showNotification('Competitor name must be 200 characters or less', 'error');
        return;
    }
    
    // Check for duplicates
    if (competitors.some(comp => comp.name.toLowerCase() === name.toLowerCase())) {
        showNotification('This competitor has already been added', 'error');
        return;
    }
    
    const competitor = {
        id: Date.now().toString(),
        name: name,
        description: description || 'Competitor product/service',
        status: 'pending',
        score: null,
        analysisComplete: false
    };
    
    competitors.push(competitor);
    updateCompetitorsDisplay();
    hideAddCompetitorModal();
    
    showNotification(`Added competitor: ${name}`, 'success');
    
    // Enable analysis button if we have competitors and validated criteria
    updateCompetitiveButtons();
}

function removeCompetitor(competitorId) {
    const competitor = competitors.find(c => c.id === competitorId);
    if (!competitor) return;
    
    if (confirm(`Remove ${competitor.name} from analysis?`)) {
        competitors = competitors.filter(c => c.id !== competitorId);
        updateCompetitorsDisplay();
        updateCompetitiveButtons();
        showNotification(`Removed ${competitor.name}`, 'info');
    }
}

function updateCompetitorsDisplay() {
    const competitorsGrid = document.getElementById('competitors-grid');
    const placeholder = document.getElementById('competitor-placeholder');
    const addBtn = document.getElementById('add-competitor-btn');
    
    if (!competitorsGrid) return;
    
    // Clear existing competitor cards (but keep placeholder)
    const existingCards = competitorsGrid.querySelectorAll('.competitor-card:not(.competitor-placeholder)');
    existingCards.forEach(card => card.remove());
    
    if (competitors.length === 0) {
        placeholder.style.display = 'flex';
        if (addBtn) addBtn.style.display = 'flex';
    } else {
        placeholder.style.display = 'none';
        
        // Add competitor cards
        competitors.forEach(competitor => {
            const card = createCompetitorCard(competitor);
            competitorsGrid.appendChild(card);
        });
        
        // Hide add button if we have max competitors
        if (addBtn) {
            addBtn.style.display = competitors.length >= 2 ? 'none' : 'flex';
        }
    }
}

function createCompetitorCard(competitor) {
    const card = document.createElement('div');
    card.className = 'competitor-card';
    card.innerHTML = `
        <div class="competitor-info">
            <div class="competitor-icon">
                <i class="fas fa-building text-orange-500"></i>
            </div>
            <div class="competitor-details">
                <h5 class="competitor-name">${competitor.name}</h5>
                <p class="competitor-type">${competitor.description}</p>
                <div class="competitor-stats">
                    <span class="stat-item ${competitor.status}">
                        <i class="fas ${getStatusIcon(competitor.status)}"></i>
                        <span>${getStatusText(competitor.status)}</span>
                    </span>
                </div>
            </div>
        </div>
        <div class="competitor-actions">
            <button class="btn-ghost-small" onclick="removeCompetitor('${competitor.id}')" title="Remove competitor">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="analysis-score" style="display: ${competitor.score ? 'flex' : 'none'};">
            <span class="score-number">${competitor.score || '--'}</span>
            <span class="score-label">Compliance</span>
        </div>
    `;
    return card;
}

function getStatusIcon(status) {
    const icons = {
        'pending': 'fa-clock',
        'analyzing': 'fa-spinner animate-spin',
        'completed': 'fa-check-circle',
        'failed': 'fa-times-circle'
    };
    return icons[status] || 'fa-clock';
}

function getStatusText(status) {
    const texts = {
        'pending': 'Pending analysis',
        'analyzing': 'Analyzing...',
        'completed': 'Analysis complete',
        'failed': 'Analysis failed'
    };
    return texts[status] || 'Unknown';
}

function updateCompetitiveButtons() {
    const analysisBtn = document.getElementById('competitive-analysis-btn');
    const viewBtn = document.getElementById('view-competitive-btn');
    
    // Enable analysis if we have competitors and validated criteria
    const hasCompetitors = competitors.length > 0;
    const hasValidatedCriteria = window.validatedCriteria && window.validatedCriteria.length > 0;
    
    if (analysisBtn) {
        if (hasCompetitors && hasValidatedCriteria) {
            analysisBtn.classList.remove('btn-disabled');
            analysisBtn.removeAttribute('disabled');
            analysisBtn.classList.add('btn-primary');
        } else {
            analysisBtn.classList.add('btn-disabled');
            analysisBtn.setAttribute('disabled', 'true');
            analysisBtn.classList.remove('btn-primary');
        }
    }
    
    // Enable view button if analysis is complete
    if (viewBtn) {
        const analysisComplete = competitiveAnalysisResults.length > 0;
        if (analysisComplete) {
            viewBtn.classList.remove('btn-disabled');
            viewBtn.removeAttribute('disabled');
            viewBtn.classList.add('btn-secondary');
        } else {
            viewBtn.classList.add('btn-disabled');
            viewBtn.setAttribute('disabled', 'true');
            viewBtn.classList.remove('btn-secondary');
        }
    }
}

async function runCompetitiveAnalysis() {
    if (competitors.length === 0) {
        showNotification('Please add at least one competitor before running analysis', 'warning');
        return;
    }
    
    const validatedCriteria = window.validatedCriteria || [];
    if (validatedCriteria.length === 0) {
        showNotification('No validated criteria available for analysis', 'warning');
        return;
    }
    
    // Get deep research setting for competitive analysis
    const useDeepResearch = document.getElementById('competitive-deep-research-toggle')?.checked || false;
    
    if (useDeepResearch) {
        const confirmed = confirm(
            'Deep Research is enabled for competitor analysis. This will provide more comprehensive analysis but will take longer and cost more. Continue?'
        );
        if (!confirmed) return;
    }
    
    const analysisBtn = document.getElementById('competitive-analysis-btn');
    const originalContent = analysisBtn.innerHTML;
    
    try {
        // Update button to show processing
        analysisBtn.disabled = true;
        analysisBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Analyzing...';
        
        showNotification('Starting competitive analysis...', 'info');
        
        // Update progress
        updateCompetitiveProgress(10, 'Initializing competitive analysis...');
        
        // Update your product status - we're reusing existing data
        const yourStatusElement = document.getElementById('your-analysis-status');
        if (yourStatusElement) {
            yourStatusElement.innerHTML = '<i class="fas fa-check-circle text-success-600"></i> Using existing analysis data';
        }
        
        const productName = window.currentProductName || 'Your Solution';
        
        // Calculate your product's compliance score from existing data
        const yourComplianceScore = calculateYourProductScore(validatedCriteria);
        
        // Show your product score
        const yourProductScoreElement = document.getElementById('your-product-score');
        if (yourProductScoreElement) {
            yourProductScoreElement.style.display = 'flex';
            const scoreNumber = yourProductScoreElement.querySelector('.score-number');
            if (scoreNumber) {
                scoreNumber.textContent = `${yourComplianceScore}%`;
            }
        }
        
        // Only analyze competitors (we already have your product data)
        const totalAnalyses = competitors.length * validatedCriteria.length;
        let completedAnalyses = 0;
        
        // Clear previous results
        competitiveAnalysisResults = [];
        
        // Make results globally available for the modal
        window.competitiveAnalysisResults = competitiveAnalysisResults;
        
        updateCompetitiveProgress(20, 'Reusing your product analysis data...');
        
        // Analyze each competitor against each criterion
        for (const competitor of competitors) {
            // Update competitor status
            competitor.status = 'analyzing';
            updateCompetitorsDisplay();
            
            updateCompetitiveProgress(
                30 + (completedAnalyses / totalAnalyses) * 60, 
                `Analyzing ${competitor.name}${useDeepResearch ? ' with deep research' : ''}...`
            );
            
            let competitorCompliantCount = 0;
            let competitorTotalCount = 0;
            
            // Run validation for each criterion for this competitor
            for (const criterion of validatedCriteria) {
                try {
                    // Validate criterion against competitor with optional deep research
                    const competitorValidation = await apiClient.validateCriterion(
                        criterion.id, 
                        competitor.name, 
                        useDeepResearch // Use the deep research setting from the toggle
                    );
                    
                    // Count for competitor score calculation
                    competitorTotalCount++;
                    if (competitorValidation.is_met === true) {
                        competitorCompliantCount++;
                    }
                    
                    // Create comparison result using existing your product data
                    const comparisonResult = {
                        criterionId: criterion.id,
                        criterionText: criterion.criterion_text,
                        yourProduct: {
                            name: productName,
                            isMet: criterion.is_met, // Use existing validation result
                            summary: criterion.validation_summary, // Use existing summary
                            score: criterion.is_met === true ? 'high' : criterion.is_met === false ? 'low' : 'medium'
                        },
                        competitor: {
                            name: competitor.name,
                            isMet: competitorValidation.is_met,
                            summary: competitorValidation.validation_summary,
                            score: competitorValidation.is_met === true ? 'high' : competitorValidation.is_met === false ? 'low' : 'medium'
                        },
                        advantage: determineAdvantage(criterion.is_met, competitorValidation.is_met),
                        recommendation: generateRecommendation(criterion.is_met, competitorValidation.is_met, competitor.name)
                    };
                    
                    competitiveAnalysisResults.push(comparisonResult);
                    
                } catch (error) {
                    console.error(`Error analyzing ${competitor.name} for criterion ${criterion.id}:`, error);
                    competitorTotalCount++;
                }
                
                completedAnalyses++;
                updateCompetitiveProgress(
                    30 + (completedAnalyses / totalAnalyses) * 60, 
                    `Analyzed ${completedAnalyses}/${totalAnalyses} criteria...`
                );
            }
            
            // Calculate real compliance score based on actual results
            const realComplianceScore = competitorTotalCount > 0 ? 
                Math.round((competitorCompliantCount / competitorTotalCount) * 100) : 0;
            
            competitor.score = `${realComplianceScore}%`;
            competitor.status = 'completed';
            competitor.analysisComplete = true;
        }
        
        // Update final display
        updateCompetitorsDisplay();
        updateCompetitiveProgress(100, 'Competitive analysis complete!');
        
        // Calculate summary statistics
        const advantages = competitiveAnalysisResults.filter(r => r.advantage === 'advantage').length;
        const competitive = competitiveAnalysisResults.filter(r => r.advantage === 'competitive').length;
        const improvements = competitiveAnalysisResults.filter(r => r.advantage === 'needs_improvement').length;
        
        // Update summary display
        const advantageCount = document.getElementById('competitive-advantage-count');
        const analysisCount = document.getElementById('competitive-analysis-count');
        
        if (advantageCount) advantageCount.textContent = `${advantages} advantages`;
        if (analysisCount) analysisCount.textContent = `${competitors.length} analyzed`;
        
        // After analysis is complete, update the global reference
        window.competitiveAnalysisResults = competitiveAnalysisResults;
        
        // Enable buttons
        updateCompetitiveButtons();
        
        // Complete step
        const competitiveCard = document.getElementById('step-competitive');
        const exportCard = document.getElementById('step-export');
        
        if (competitiveCard) {
            competitiveCard.classList.remove('active');
            competitiveCard.classList.add('completed');
        }
        
        if (exportCard) {
            exportCard.classList.remove('disabled');
            exportCard.classList.add('active');
        }
        
        // Dispatch event to notify export step
        const event = new CustomEvent('competitiveAnalysisComplete', {
            detail: { 
                competitorCount: competitors.length,
                advantages: advantages,
                competitive: competitive,
                improvements: improvements
            }
        });
        document.dispatchEvent(event);
        
        // Reset button
        analysisBtn.innerHTML = '<i class="fas fa-check"></i> Analysis Complete';
        analysisBtn.classList.remove('btn-primary');
        analysisBtn.classList.add('btn-completed');
        
        const researchNote = useDeepResearch ? ' (with deep research)' : '';
        showNotification(`Competitive analysis complete${researchNote}! Found ${advantages} advantages, ${competitive} competitive areas, ${improvements} improvement opportunities.`, 'success');
        
        // After successful analysis completion, auto-save the results
        const metadata = {
            competitorCount: competitors.length,
            criteriaCount: validatedCriteria.length,
            advantages: advantages,
            competitive: competitive,
            improvements: improvements,
            competitors: competitors.map(c => ({ name: c.name, description: c.description })),
            useDeepResearch: useDeepResearch
        };
        
        // Save the analysis
        currentAnalysisId = competitiveStorage.saveAnalysis(competitiveAnalysisResults, metadata);
        
        // Update UI to show save status
        updateAnalysisHistoryUI();
        showNotification(`Analysis saved automatically (ID: ${currentAnalysisId.substr(-8)})`, 'success');
        
    } catch (error) {
        console.error('Error running competitive analysis:', error);
        showNotification('Failed to run competitive analysis: ' + error.message, 'error');
        
        // Reset button
        analysisBtn.disabled = false;
        analysisBtn.innerHTML = originalContent;
        
        // Reset competitor statuses
        competitors.forEach(comp => comp.status = 'pending');
        updateCompetitorsDisplay();
        
        // Reset your product status
        if (yourStatusElement) {
            yourStatusElement.innerHTML = '<i class="fas fa-circle-notch"></i> Ready for analysis';
        }
    }
}

function calculateYourProductScore(validatedCriteria) {
    if (!validatedCriteria || validatedCriteria.length === 0) return 0;
    
    let compliantCount = 0;
    let totalCount = 0;
    
    validatedCriteria.forEach(criterion => {
        totalCount++;
        if (criterion.is_met === true) {
            compliantCount++;
        }
    });
    
    return totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;
}

function determineAdvantage(yourScore, competitorScore) {
    if (yourScore === true && competitorScore !== true) return 'advantage';
    if (yourScore === competitorScore) return 'competitive';
    return 'needs_improvement';
}

function generateRecommendation(yourScore, competitorScore, competitorName) {
    if (yourScore === true && competitorScore !== true) {
        return `Strong advantage over ${competitorName}. Highlight this capability in your proposal.`;
    } else if (yourScore === false && competitorScore === true) {
        return `${competitorName} has an advantage here. Consider addressing this gap or finding alternative approaches.`;
    } else if (yourScore === competitorScore) {
        return `Competitive parity with ${competitorName}. Focus on implementation quality and support.`;
    }
    return `Review implementation details to differentiate from ${competitorName}.`;
}

function calculateOverallScore(results) {
    if (results.length === 0) return 0;
    
    const scores = results.map(r => {
        if (r.competitor.isMet === true) return 100;
        if (r.competitor.isMet === false) return 0;
        return 50; // Unknown/partial
    });
    
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(average);
}

function updateCompetitiveProgress(percentage, text) {
    const progressFill = document.querySelector('#step-competitive .progress-fill');
    const progressText = document.querySelector('#step-competitive .progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = text;
    }
}

function showCompetitiveTable() {
    if (competitiveAnalysisResults.length === 0) {
        showNotification('No competitive analysis data available. Please run the analysis first.', 'warning');
        return;
    }
    
    // Make sure the global reference is updated
    window.competitiveAnalysisResults = competitiveAnalysisResults;
    
    const modal = document.getElementById('competitive-modal');
    if (modal) {
        // Populate the competitive table and charts with real data
        populateCompetitiveTable();
        populateCompetitiveCharts();
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
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
                        color: getComputedStyle(document.body).getPropertyValue('--foreground-600'),
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.body).getPropertyValue('--stroke-200')
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--foreground-600'),
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
    
    // Create chart with compliance count instead of percentages
    window.categoryChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: data.labels,
            datasets: [{
                label: productName,
                data: data.yourCompliance,
                borderColor: 'rgba(80, 80, 168, 1)',
                backgroundColor: 'rgba(80, 80, 168, 0.2)',
                pointBackgroundColor: 'rgba(80, 80, 168, 1)',
                pointBorderColor: '#fff',
                pointRadius: 6,
                borderWidth: 3
            }, {
                label: data.competitorLabel,
                data: data.competitorCompliance,
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
                        color: getComputedStyle(document.body).getPropertyValue('--foreground-700'),
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.totals[context.dataIndex];
                            const value = context.parsed.r;
                            return `${context.dataset.label}: ${value}/${total} compliant`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: Math.max(...data.totals),
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--foreground-600'),
                        stepSize: 1,
                        callback: function(value) {
                            return Number.isInteger(value) ? value : '';
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.body).getPropertyValue('--stroke-300')
                    },
                    angleLines: {
                        color: getComputedStyle(document.body).getPropertyValue('--stroke-300')
                    },
                    pointLabels: {
                        color: getComputedStyle(document.body).getPropertyValue('--foreground-700'),
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function populateCompetitiveTable() {
    const tableBody = document.getElementById('competitive-table-body');
    if (!tableBody) return;
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    if (competitiveAnalysisResults.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-foreground-600">No competitive analysis data available</td>
            </tr>
        `;
        return;
    }
    
    // Populate table with analysis results
    competitiveAnalysisResults.forEach((result, index) => {
        const row = document.createElement('tr');
        
        // Truncate long criterion text
        const truncatedCriterion = result.criterionText.length > 80 
            ? result.criterionText.substring(0, 80) + '...' 
            : result.criterionText;
        
        const truncatedYourResponse = result.yourProduct.summary && result.yourProduct.summary.length > 100
            ? result.yourProduct.summary.substring(0, 100) + '...'
            : (result.yourProduct.summary || 'No response available');
        
        // Get position display
        const positionClass = result.advantage.replace('_', '-');
        const positionText = result.advantage === 'advantage' ? 'Advantage' : 
                           result.advantage === 'competitive' ? 'Competitive' : 'Needs Improvement';
        const positionIcon = result.advantage === 'advantage' ? 'fa-trophy' : 
                           result.advantage === 'competitive' ? 'fa-balance-scale' : 'fa-arrow-up';
        
        row.innerHTML = `
            <td class="text-sm" title="${result.criterionText}">${truncatedCriterion}</td>
            <td class="text-sm" title="${result.yourProduct.summary || 'No response available'}">${truncatedYourResponse}</td>

            <td class="text-sm">${result.competitor.name}</td>
            <td class="text-center">
                <span class="position-badge ${positionClass}">
                    <i class="fas ${positionIcon}"></i>
                    <span>${positionText}</span>
                </span>
            </td>
            <td class="text-sm">${result.recommendation}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function getScoreDisplay(score) {
    const scoreMap = {
        'high': '95%',
        'medium': '75%',
        'low': '45%'
    };
    return scoreMap[score] || '--';
}

function hideCompetitiveTable() {
    const modal = document.getElementById('competitive-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

export function getCompetitiveStatus() {
    const advantages = competitiveAnalysisResults.filter(r => r.advantage === 'advantage').length;
    const competitive = competitiveAnalysisResults.filter(r => r.advantage === 'competitive').length;
    const improvements = competitiveAnalysisResults.filter(r => r.advantage === 'needs_improvement').length;
    
    return {
        completed: competitiveAnalysisResults.length > 0,
        competitorsAnalyzed: competitors.filter(c => c.analysisComplete).length,
        totalCompetitors: competitors.length,
        advantages: advantages,
        competitive: competitive,
        improvements: improvements
    };
}

function populateCompetitiveCharts() {
    // Prepare data for charts
    const chartData = prepareChartData();
    
    // Initialize compliance comparison chart
    initializeComplianceChart(chartData.complianceData);
    
    // Initialize category comparison chart
    initializeCategoryChart(chartData.categoryData);
    
    // Setup competitor selection for category chart
    setupCompetitorSelection();
}

function prepareChartData() {
    const productName = window.currentProductName || 'Your Product';
    
    // Calculate actual compliance scores from analysis results
    const yourOverallScore = calculateYourProductScore(window.validatedCriteria || []);
    
    // Get unique competitors and their scores from analysis
    const competitorScores = {};
    const uniqueCompetitors = new Set();
    
    competitiveAnalysisResults.forEach(result => {
        if (result.competitor && result.competitor.name) {
            uniqueCompetitors.add(result.competitor.name);
        }
    });
    
    // Calculate scores for each competitor based on analysis results
    uniqueCompetitors.forEach(competitorName => {
        const competitorResults = competitiveAnalysisResults.filter(r => 
            r.competitor && r.competitor.name === competitorName
        );
        
        if (competitorResults.length > 0) {
            const totalScore = competitorResults.reduce((sum, result) => {
                return sum + (result.competitor.isMet === true ? 100 : 
                             result.competitor.isMet === false ? 0 : 50);
            }, 0);
            competitorScores[competitorName] = Math.round(totalScore / competitorResults.length);
        }
    });
    
    // Prepare compliance comparison data
    const complianceData = {
        labels: [productName, ...Array.from(uniqueCompetitors)],
        scores: [yourOverallScore, ...Object.values(competitorScores)]
    };
    
    // Prepare category data
    const categories = getCategoriesFromAnalysis(competitiveAnalysisResults);
    const categoryData = prepareCategoryChartData('average');
    
    return { complianceData, categoryData };
}

function getCategoriesFromAnalysis(competitiveResults) {
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
    
    competitiveResults.forEach(result => {
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
    
    const chartData = {
        labels: categories,
        yourCompliance: categories.map(cat => calculateCategoryComplianceCount('your', cat, competitiveResults)),
        competitorCompliance: categories.map(cat => {
            if (selectedCompetitor === 'average') {
                return calculateAverageCompetitorComplianceCount(cat, competitiveResults);
            } else {
                return calculateCategoryComplianceCount(selectedCompetitor, cat, competitiveResults);
            }
        }),
        totals: categories.map(cat => getCategoryTotalCount(cat, competitiveResults)),
        competitorLabel: selectedCompetitor === 'average' ? 'Average Competitors' : selectedCompetitor
    };
    
    if (window.categoryChartInstance) {
        // Update chart data
        window.categoryChartInstance.data.datasets[1].label = chartData.competitorLabel;
        window.categoryChartInstance.data.datasets[1].data = chartData.competitorCompliance;
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

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Add missing global functions for document generation
window.generateRFPPackage = async function() {
    try {
        const { DocumentGenerator } = await import('../utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        const result = await documentGenerator.generateRFPResponse();
        showNotification(`RFP Response Document downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate RFP Response: ${error.message}`, 'error');
    }
};

window.generateCompetitiveReport = async function() {
    try {
        const { DocumentGenerator } = await import('../utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        const result = await documentGenerator.generateCompetitiveAnalysis();
        showNotification(`Competitive Analysis Report downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate Competitive Analysis: ${error.message}`, 'error');
    }
};

window.generateComplianceMatrix = async function() {
    try {
        const { DocumentGenerator } = await import('../utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        const result = await documentGenerator.generateComplianceMatrix();
        showNotification(`Compliance Matrix downloaded: ${result.filename}`, 'success');
    } catch (error) {
        showNotification(`Failed to generate Compliance Matrix: ${error.message}`, 'error');
    }
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
        const { DocumentGenerator } = await import('../utils/document-generator.js');
        const documentGenerator = new DocumentGenerator();
        
        showNotification('Starting document package generation...', 'info');
        
        // Generate all documents
        const rfpResult = await documentGenerator.generateRFPResponse();
        showNotification('RFP Response Document generated', 'success');
        
        if (competitiveResults.length > 0) {
            const competitiveResult = await documentGenerator.generateCompetitiveAnalysis();
            showNotification('Competitive Analysis Report generated', 'success');
        }
        
        const matrixResult = await documentGenerator.generateComplianceMatrix();
        showNotification('Compliance Matrix generated', 'success');
        
        showNotification('Complete package generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating complete package:', error);
        showNotification(`Failed to generate complete package: ${error.message}`, 'error');
    }
};

// Export function to make competitive data available to other modules
export function getCompetitiveAnalysisResults() {
    return competitiveAnalysisResults;
}

export function getCompetitors() {
    return competitors;
}

// Function to check if competitive analysis is ready for export
export function isCompetitiveAnalysisComplete() {
    return competitiveAnalysisResults.length > 0 && 
           competitors.every(c => c.analysisComplete);
}

function initializeAnalysisHistory() {
    // Create analysis history modal if it doesn't exist
    if (!document.getElementById('analysis-history-modal')) {
        createAnalysisHistoryModal();
    }
    
    updateAnalysisHistoryUI();
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
            hideAnalysisHistory();
        }
    });
}

function updateAnalysisHistoryUI() {
    const analyses = competitiveStorage.getStoredAnalyses();
    
    // Update the global history button
    updateGlobalAnalysisHistoryButton();
}

function updateGlobalAnalysisHistoryButton() {
    const analyses = competitiveStorage.getStoredAnalyses();
    
    // Update the global history button
    if (window.updateAnalysisHistoryButton) {
        window.updateAnalysisHistoryButton();
    }
    
    // Also update any local history buttons
    const historyButton = document.querySelector('.analysis-history-controls button[onclick="showAnalysisHistory()"]');
    
    if (historyButton) {
        const count = analyses.length;
        const countText = count > 0 ? ` (${count})` : '';
        historyButton.innerHTML = `
            <i class="fas fa-history"></i>
            Analysis History${countText}
        `;
    }
}

function showAnalysisHistory() {
    const modal = document.getElementById('analysis-history-modal');
    if (modal) {
        populateAnalysisHistory();
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

function hideAnalysisHistory() {
    const modal = document.getElementById('analysis-history-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function populateAnalysisHistory() {
    const historyList = document.getElementById('analysis-history-list');
    if (!historyList) return;

    const analyses = competitiveStorage.getStoredAnalyses();
    
    if (analyses.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history text-4xl text-foreground-400 mb-4"></i>
                <p class="text-foreground-600">No saved analyses found</p>
                <p class="text-sm text-foreground-500">Run a competitive analysis to save results</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = analyses.map(analysis => {
        const summary = competitiveStorage.getAnalysisSummary(analysis);
        const isCurrentAnalysis = currentAnalysisId === analysis.id;
        
        return `
            <div class="analysis-history-item ${isCurrentAnalysis ? 'current' : ''}" data-analysis-id="${analysis.id}">
                <div class="analysis-info">
                    <div class="analysis-title">
                        ${analysis.customName || summary.title}
                        ${isCurrentAnalysis ? '<span class="current-badge">Current</span>' : ''}
                        ${analysis.imported ? '<span class="imported-badge">Imported</span>' : ''}
                        ${analysis.manualSave ? '<span class="manual-badge">Manual Save</span>' : ''}
                    </div>
                    <div class="analysis-meta">
                        <span class="analysis-date">${summary.date}</span>
                        <span class="analysis-stats">
                            ${summary.criteriaCount} criteria • 
                            ${summary.advantages} advantages • 
                            ${summary.competitors.length} competitors
                            ${summary.useDeepResearch ? ' • Deep Research' : ''}
                        </span>
                    </div>
                    <div class="analysis-competitors">
                        <strong>Competitors:</strong> ${summary.competitors.map(c => c.name).join(', ') || 'None'}
                    </div>
                </div>
                <div class="analysis-actions">
                    <button class="btn-ghost-small" onclick="loadPreviousAnalysis('${analysis.id}')" title="Load analysis">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-ghost-small" onclick="exportStoredAnalysis('${analysis.id}')" title="Export analysis">
                        <i class="fas fa-share-square"></i>
                    </button>
                    <button class="btn-ghost-small text-error-600" onclick="deleteStoredAnalysis('${analysis.id}')" title="Delete analysis">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function loadPreviousAnalysis(analysisId) {
    try {
        const analysis = competitiveStorage.loadAnalysis(analysisId);
        if (!analysis) {
            showNotification('Analysis not found', 'error');
            return;
        }

        // Confirm loading (will replace current analysis)
        if (competitiveAnalysisResults.length > 0) {
            const confirmed = confirm('Loading this analysis will replace your current work. Continue?');
            if (!confirmed) return;
        }

        // Load the analysis data
        competitiveAnalysisResults = analysis.analysisData;
        window.competitiveAnalysisResults = competitiveAnalysisResults;
        currentAnalysisId = analysisId;

        // Reconstruct competitors from metadata
        if (analysis.competitors) {
            competitors = analysis.competitors.map((comp, index) => ({
                id: `loaded_${index}_${Date.now()}`,
                name: comp.name,
                description: comp.description || 'Loaded competitor',
                status: 'completed',
                score: calculateCompetitorOverallScore(comp.name) + '%',
                analysisComplete: true
            }));
        }

        // Update UI
        updateCompetitorsDisplay();
        updateCompetitiveButtons();
        
        // Update product name if different
        if (analysis.productName && analysis.productName !== window.currentProductName) {
            const changeProduct = confirm(`This analysis was for "${analysis.productName}". Update current product name?`);
            if (changeProduct) {
                window.currentProductName = analysis.productName;
                updateCompetitiveProductName();
            }
        }

        // Update step to completed state
        const competitiveCard = document.getElementById('step-competitive');
        if (competitiveCard) {
            competitiveCard.classList.remove('active', 'disabled');
            competitiveCard.classList.add('completed');
        }

        // Update summary display
        const advantages = competitiveAnalysisResults.filter(r => r.advantage === 'advantage').length;
        const competitive = competitiveAnalysisResults.filter(r => r.advantage === 'competitive').length;
        const improvements = competitiveAnalysisResults.filter(r => r.advantage === 'needs_improvement').length;

        const advantageCount = document.getElementById('competitive-advantage-count');
        const analysisCount = document.getElementById('competitive-analysis-count');
        
        if (advantageCount) advantageCount.textContent = `${advantages} advantages`;
        if (analysisCount) analysisCount.textContent = `${competitors.length} analyzed`;

        showNotification(`Loaded analysis: ${analysis.customName || analysis.productName}`, 'success');
        
        // Hide analysis history modal
        hideAnalysisHistory();

    } catch (error) {
        console.error('Failed to load analysis:', error);
        showNotification('Failed to load analysis: ' + error.message, 'error');
    }
}

function deleteStoredAnalysis(analysisId) {
    const analysis = competitiveStorage.loadAnalysis(analysisId);
    if (!analysis) return;

    const analysisName = analysis.customName || `${analysis.productName} analysis`;
    
    if (confirm(`Delete "${analysisName}"? This action cannot be undone.`)) {
        try {
            competitiveStorage.deleteAnalysis(analysisId);
            populateAnalysisHistory();
            updateAnalysisHistoryUI();
            
            // Clear current analysis if it was deleted
            if (currentAnalysisId === analysisId) {
                currentAnalysisId = null;
            }
            
            showNotification('Analysis deleted successfully', 'success');
        } catch (error) {
            showNotification('Failed to delete analysis', 'error');
        }
    }
}

function exportStoredAnalysis(analysisId) {
    try {
        const filename = competitiveStorage.exportAnalysis(analysisId);
        if (filename) {
            showNotification(`Analysis exported: ${filename}`, 'success');
        }
    } catch (error) {
        showNotification('Failed to export analysis: ' + error.message, 'error');
    }
}

function importAnalysisFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const importedAnalysis = await competitiveStorage.importAnalysis(file);
            updateAnalysisHistoryUI();
            populateAnalysisHistory();
            showNotification(`Analysis imported: ${importedAnalysis.productName}`, 'success');
        } catch (error) {
            showNotification('Failed to import analysis: ' + error.message, 'error');
        }
    };
    input.click();
}

function clearAllAnalyses() {
    if (confirm('Delete all saved analyses? This action cannot be undone.')) {
        try {
            competitiveStorage.clearAllAnalyses();
            populateAnalysisHistory();
            updateAnalysisHistoryUI();
            
            // Clear current analysis if it was deleted
            currentAnalysisId = null;
            
            showNotification('All analyses deleted successfully', 'success');
        } catch (error) {
            showNotification('Failed to delete analyses', 'error');
        }
    }
}

function saveCurrentAnalysis() {
    if (!competitiveAnalysisResults || competitiveAnalysisResults.length === 0) {
        showNotification('No analysis data to save. Please run a competitive analysis first.', 'warning');
        return;
    }

    // Show save dialog with better user experience
    const analysisName = prompt('Enter a name for this analysis (optional):') || '';
    
    // Get current competitive statistics
    const advantages = competitiveAnalysisResults.filter(r => r.advantage === 'advantage').length;
    const competitive = competitiveAnalysisResults.filter(r => r.advantage === 'competitive').length;
    const improvements = competitiveAnalysisResults.filter(r => r.advantage === 'needs_improvement').length;
    
    const metadata = {
        customName: analysisName,
        competitorCount: competitors.length,
        criteriaCount: competitiveAnalysisResults.length,
        advantages: advantages,
        competitive: competitive,
        improvements: improvements,
        competitors: competitors.map(c => ({ name: c.name, description: c.description })),
        manualSave: true,
        useDeepResearch: false // Default for manual saves
    };

    try {
        const analysisId = competitiveStorage.saveAnalysis(competitiveAnalysisResults, metadata);
        updateAnalysisHistoryUI();
        
        const displayName = analysisName || `${window.currentProductName || 'Analysis'} vs ${competitors.length} competitors`;
        showNotification(`Analysis saved successfully: "${displayName}" (ID: ${analysisId.substr(-8)})`, 'success');
        
        currentAnalysisId = analysisId;
        
        // Update global history button immediately
        if (window.updateAnalysisHistoryButton) {
            window.updateAnalysisHistoryButton();
        }
        
    } catch (error) {
        console.error('Failed to save analysis:', error);
        showNotification('Failed to save analysis: ' + error.message, 'error');
    }
}
