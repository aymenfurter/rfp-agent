export function getSearchTerm(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.value.toLowerCase() : '';
}

export function getFilterValue(selectId) {
    const select = document.getElementById(selectId);
    return select ? select.value : '';
}

export function filterTableRows(selector, filterFn) {
    const rows = document.querySelectorAll(selector);
    rows.forEach(row => {
        row.style.display = filterFn(row) ? '' : 'none';
    });
}

export function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

export function getAgentName(type) {
    const agents = {
        upload: 'Document Agent',
        generate: 'Response Agent',
        competitive: 'Competitive Agent'
    };
    return agents[type] || 'Processing Agent';
}

export function getCategoryName(category) {
    const names = {
        technical: 'Technical',
        security: 'Security',
        performance: 'Performance',
        support: 'Support',
        compliance: 'Compliance',
        integration: 'Integration',
        financial: 'Financial',
        other: 'Other'
    };
    return names[category] || category;
}

export function getStatusName(status) {
    const names = {
        extracted: 'Extracted',
        approved: 'Approved',
        modified: 'Modified',
        rejected: 'Rejected',
        pending: 'Pending'
    };
    return names[status] || status;
}

export function getComplianceName(compliance) {
    const names = {
        compliant: 'Compliant',
        partial: 'Partial',
        'non-compliant': 'Non-Compliant',
        pending: 'Pending'
    };
    return names[compliance] || compliance;
}

export function getComplianceIcon(compliance) {
    const icons = {
        compliant: 'fa-check-circle',
        partial: 'fa-exclamation-triangle',
        'non-compliant': 'fa-times-circle',
        pending: 'fa-clock'
    };
    return icons[compliance] || 'fa-question-circle';
}

export function getConfidencePercent(confidence) {
    const percents = {
        high: '95%',
        medium: '78%',
        low: '45%'
    };
    return percents[confidence] || '0%';
}

export function getScoreDisplay(score) {
    const scores = {
        high: '95%',
        medium: '75%',
        low: '45%'
    };
    return scores[score] || '--';
}

export function getPositionName(position) {
    const names = {
        advantage: 'Advantage',
        competitive: 'Competitive',
        improvement: 'Needs Improvement'
    };
    return names[position] || position;
}

export function getPositionIcon(position) {
    const icons = {
        advantage: 'fa-trophy',
        competitive: 'fa-balance-scale',
        improvement: 'fa-arrow-up'
    };
    return icons[position] || 'fa-question-circle';
}
