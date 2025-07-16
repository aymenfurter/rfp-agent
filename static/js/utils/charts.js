export function initializeCharts() {
    initComplianceChart();
    initCategoryChart();
}

function initComplianceChart() {
    const ctx = document.getElementById('complianceChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Your Company', 'Amazon AWS', 'Microsoft Azure', 'Google Cloud', 'IBM Cloud', 'Oracle Cloud'],
            datasets: [{
                label: 'Compliance Score (%)',
                data: [88, 91, 89, 76, 73, 68],
                backgroundColor: [
                    'rgba(80, 80, 168, 0.8)',
                    'rgba(255, 159, 10, 0.8)',
                    'rgba(52, 199, 89, 0.8)',
                    'rgba(255, 69, 58, 0.8)',
                    'rgba(64, 166, 255, 0.8)',
                    'rgba(174, 174, 178, 0.8)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#8e8e93'
                    },
                    grid: {
                        color: 'rgba(142, 142, 147, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: '#8e8e93'
                    },
                    grid: {
                        color: 'rgba(142, 142, 147, 0.2)'
                    }
                }
            }
        }
    });
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Technical', 'Security', 'Performance', 'Support', 'Compliance', 'Integration'],
            datasets: [{
                label: 'Your Company',
                data: [90, 95, 75, 92, 88, 85],
                borderColor: 'rgba(80, 80, 168, 1)',
                backgroundColor: 'rgba(80, 80, 168, 0.2)',
                pointBackgroundColor: 'rgba(80, 80, 168, 1)',
                borderWidth: 2
            }, {
                label: 'Best Competitor Average',
                data: [88, 82, 90, 78, 85, 80],
                borderColor: 'rgba(255, 159, 10, 1)',
                backgroundColor: 'rgba(255, 159, 10, 0.2)',
                pointBackgroundColor: 'rgba(255, 159, 10, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#c7c7cc'
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#8e8e93',
                        stepSize: 20
                    },
                    grid: {
                        color: 'rgba(142, 142, 147, 0.3)'
                    },
                    angleLines: {
                        color: 'rgba(142, 142, 147, 0.3)'
                    },
                    pointLabels: {
                        color: '#c7c7cc'
                    }
                }
            }
        }
    });
}
