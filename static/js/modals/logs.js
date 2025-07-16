export function initializeLogsModal() {
    window.showLogs = showLogs;
    window.hideLogs = hideLogs;
}

function showLogs(step) {
    const modal = document.getElementById('logs-modal');
    const title = document.getElementById('logs-title');
    const container = document.getElementById('logs-container');
    
    if (!modal || !title || !container) return;
    
    const stepNames = {
        upload: 'Upload & Processing Logs',
        extract: 'Criteria Extraction Logs',
        generate: 'Response Generation Logs',
        competitive: 'Competitive Analysis Logs'
    };
    
    title.textContent = stepNames[step] || 'Processing Logs';
    
    const logs = window.getProcessingLogs ? window.getProcessingLogs(step) : [];
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-foreground-600">No logs available for this step</div>';
    } else {
        container.innerHTML = logs.map(log => `
            <div class="log-entry ${log.type}">
                <div class="log-timestamp">${log.timestamp}</div>
                <div class="log-message">${log.message}</div>
            </div>
        `).join('');
    }
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function hideLogs() {
    const modal = document.getElementById('logs-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}